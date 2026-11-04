'use strict';
// Script lancé via `node` (pas bun) pour éviter l'erreur ESPIPE de node-pty sous bun.
// Retourne un JSON sur stdout : { requests, cost, raw }

const pty = require('node-pty');

const env = { ...process.env };

let output = '';
let killTimer = null;
let settled = false;

function _stripAnsi(str) {
  return str
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b[<>]/g, '')
    .replace(/\r/g, '');
}

function _parse() {
  const raw = _stripAnsi(output).replace(/\s+/g, ' ').trim().substring(0, 800);
  
  // Parse OpenCode stats output
  // Example format: "Requests: 42 | Cost: $0.05 | Tokens: 12,345"
  const requestsMatch = raw.match(/requests[:\s]+(\d+)/i);
  const costMatch = raw.match(/cost[:\s]+\$?([\d.]+)/i);
  
  return {
    requests: requestsMatch ? parseInt(requestsMatch[1], 10) : 0,
    cost: costMatch ? parseFloat(costMatch[1]) : 0,
    raw: raw
  };
}

function done() {
  if (!settled) {
    settled = true;
    if (killTimer) clearTimeout(killTimer);
    process.stdout.write(JSON.stringify(_parse()) + '\n');
    process.exit(0);
  }
}

const proc = pty.spawn(process.env.OPENCODE_BIN || 'opencode', ['stats', '--json'], {
  name: 'xterm-256color',
  cols: 220,
  rows: 50,
  env,
  cwd: process.env.HOME || '.',
});

proc.onData(d => {
  output += d;
  if (!killTimer && output.includes('requests')) {
    killTimer = setTimeout(() => { try { proc.kill('SIGTERM'); } catch (_) {} }, 1500);
  }
});

proc.onExit(() => done());

// Kill de secours après 14s
setTimeout(() => {
  try { proc.kill('SIGTERM'); } catch (_) {}
  done();
}, 14000);
