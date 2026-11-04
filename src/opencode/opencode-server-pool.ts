/**
 * OpenCode Server Pool — manages persistent opencode serve processes per cwd.
 * Each unique working directory gets its own server instance.
 * Servers are started on-demand and kept alive for reuse.
 */

import { EventEmitter } from 'events';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const OPENCODE_BIN = process.env.OPENCODE_BIN || 'opencode';
const SERVER_PORT_RANGE = { min: 41000, max: 41099 };
const SERVER_STARTUP_TIMEOUT = 15000;
const SERVER_IDLE_TIMEOUT = 5 * 60 * 1000;

interface ServerInfo {
  port: number;
  proc: Bun.Subprocess;
  cwd: string;
  lastUsed: number;
}

class OpenCodeServerPool extends EventEmitter {
  private servers = new Map<string, ServerInfo>();
  private nextPort = SERVER_PORT_RANGE.min;

  private getAvailablePort(): number {
    const port = this.nextPort;
    this.nextPort = port >= SERVER_PORT_RANGE.max ? SERVER_PORT_RANGE.min : port + 1;
    return port;
  }

  async getServer(cwd: string): Promise<{ port: number; url: string }> {
    const existing = this.servers.get(cwd);
    if (existing && existsSync(`/proc/${existing.proc.pid}`)) {
      existing.lastUsed = Date.now();
      return { port: existing.port, url: `http://127.0.0.1:${existing.port}` };
    }

    const port = this.getAvailablePort();
    await this.startServer(cwd, port);
    return { port, url: `http://127.0.0.1:${port}` };
  }

  private async startServer(cwd: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = Bun.spawn({
        cmd: [OPENCODE_BIN, 'serve', '--port', String(port)],
        cwd,
        env: { ...process.env },
        stderr: 'pipe',
        stdout: 'pipe',
      });

      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error(`Server startup timeout for ${cwd}`));
      }, SERVER_STARTUP_TIMEOUT);

      const info: ServerInfo = {
        port,
        proc,
        cwd,
        lastUsed: Date.now(),
      };

      this.servers.set(cwd, info);

      // Poll until server is ready
      const checkReady = () => {
        fetch(`http://127.0.0.1:${port}/config`)
          .then((res) => {
            if (res.ok) {
              clearTimeout(timeout);
              resolve();
            } else {
              if (!existsSync(`/proc/${proc.pid}`)) {
                clearTimeout(timeout);
                reject(new Error(`Server process died for ${cwd}`));
              } else {
                setTimeout(checkReady, 200);
              }
            }
          })
          .catch(() => {
            if (!existsSync(`/proc/${proc.pid}`)) {
              clearTimeout(timeout);
              reject(new Error(`Server process died for ${cwd}`));
            } else {
              setTimeout(checkReady, 200);
            }
          });
      };

      checkReady();
    });
  }

  async stopServer(cwd: string): Promise<void> {
    const info = this.servers.get(cwd);
    if (!info) return;
    info.proc.kill('SIGTERM');
    this.servers.delete(cwd);
  }

  stopAll(): void {
    for (const [cwd, info] of this.servers) {
      info.proc.kill('SIGTERM');
    }
    this.servers.clear();
  }
}

export const serverPool = new OpenCodeServerPool();

export async function createSessionOnServer(
  serverUrl: string,
  cwd: string,
  agent: string
): Promise<{ sessionId: string; slug: string }> {
  const res = await fetch(`${serverUrl}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directory: cwd, agent }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create session: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return { sessionId: data.id, slug: data.slug };
}

export async function* streamSSE(
  serverUrl: string,
  signal?: AbortSignal
): AsyncGenerator<{ type: string; data: any }, void, unknown> {
  const controller = new AbortController();
  const res = await fetch(`${serverUrl}/event`, {
    headers: { Accept: 'text/event-stream' },
    signal: signal ?? controller.signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`SSE connection failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            yield { type: event.type, data: event.properties || event };
          } catch { /* skip malformed */ }
        }
      }
    }
  } finally {
    reader.releaseLock();
    controller.abort();
  }
}

export async function sendMessageToSession(
  serverUrl: string,
  sessionId: string,
  content: string,
  images?: { name: string; type: string; data: string }[]
): Promise<void> {
  const parts: any[] = [{ type: 'text', text: content }];

  const body: any = { parts };
  if (images?.length) {
    body.images = images;
  }

  const res = await fetch(`${serverUrl}/session/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Failed to send message: ${res.status} ${await res.text()}`);
  }
}
