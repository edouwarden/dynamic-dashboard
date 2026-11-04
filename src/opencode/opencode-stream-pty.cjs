#!/usr/bin/env node
/**
 * Node.js PTY bridge pour opencode run.
 * Lance `opencode run --format json` via node-pty (allocation PTY),
 * force le line-buffered output, et relaie les lignes NDJSON sur stdout.
 *
 * Utilisé par opencode-session-manager.ts via `node opencode-stream-pty.cjs`.
 * (Bun + node-pty = ESPIPE, donc ce script tourne obligatoirement sous Node.)
 *
 * Usage: node opencode-stream-pty.cjs <args-json>
 *   args-json = JSON.stringify({ bin, args, cwd, env })
 *   stdout = NDJSON lines (une ligne JSON par event)
 */
const pty = require('node-pty');

const args = JSON.parse(process.argv[2]);

const ptyProcess = pty.spawn(args.bin, args.args, {
  name: 'xterm-256color',
  cols: 120,
  rows: 30,
  cwd: args.cwd,
  env: args.env || process.env,
});

// Line buffer pour rassembler les chunks PTY en lignes complètes
let buffer = '';

ptyProcess.onData((data) => {
  // Normaliser les retours chariot PTY
  const cleaned = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  buffer += cleaned;
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    // Écrire directement sur stdout — le parent lit chaque ligne NDJSON
    process.stdout.write(line + '\n');
  }
});

ptyProcess.onExit(({ exitCode }) => {
  // Vider le buffer restant
  if (buffer.trim()) {
    process.stdout.write(buffer.trim() + '\n');
  }
  process.exit(exitCode);
});

// Propager SIGTERM → PTY
process.on('SIGTERM', () => {
  ptyProcess.kill('SIGTERM');
});
