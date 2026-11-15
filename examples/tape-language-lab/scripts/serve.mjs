import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL(process.env.TAPE_RESOURCE_CHECK === '1' ? '../dist/' : '../', import.meta.url));
const allowed = new Set(['index.html', 'style.css', 'src/app.js', 'src/machine.js', 'src/examples.js', 'sw.js']);
const port = Number(process.env.PORT || 4186);
export const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!allowed.has(relative)) { response.writeHead(404); response.end('Not found'); return; }
    const data = await readFile(path.join(root, relative));
    response.writeHead(200, {
      'Content-Type': ({ html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8' })[relative.split('.').at(-1)],
      'Cache-Control': 'no-cache',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'",
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(data);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`编程语言实验：http://127.0.0.1:${server.address().port}`));
