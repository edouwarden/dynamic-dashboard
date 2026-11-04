/**
 * Local preview for the built static demo.
 *
 * Usage: bun demo-static/tools/serve.mjs [port]
 */

import { existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';

const root = join(import.meta.dir, '..', 'public');
const port = Number(process.argv[2] || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
};

if (!existsSync(root)) {
  console.error('Missing demo-static/public. Run `bun run demo:build` first.');
  process.exit(1);
}

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';

    const file = normalize(join(root, pathname));
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
      return new Response('Not found', { status: 404 });
    }

    const extension = file.slice(file.lastIndexOf('.'));
    return new Response(Bun.file(file), {
      headers: {
        'Content-Type': TYPES[extension] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      },
    });
  },
});

console.log(`Static demo: http://localhost:${port}/`);
