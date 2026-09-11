import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.md': 'text/plain; charset=utf-8',
};

// Local development only. Never expose the repository root or follow links outside dist/.
export async function startServer({ port = 4173, root = defaultRoot } = {}) {
  const base = await realpath(root);
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    const fail = (code) => {
      response.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(`${code}\n`);
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      return fail(405);
    }
    let pathname;
    try {
      pathname = decodeURIComponent(request.url.split('?')[0]);
    } catch {
      return fail(400);
    }
    if (!pathname.startsWith('/') || /[\\\0]/.test(pathname)) return fail(400);
    if (pathname.split('/').some((part) => part.startsWith('.'))) return fail(403);
    if (pathname.endsWith('/')) pathname += 'index.html';
    try {
      const file = await realpath(path.join(base, pathname));
      const relative = path.relative(base, file);
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        return fail(403);
      }
      if (!(await stat(file)).isFile()) return fail(404);
      const data = await readFile(file);
      response.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Content-Length': data.length,
      });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      fail(['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 500);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const port = args.length === 0 ? 4173 : Number(args[1]);
  if (
    (args.length > 0 && (args.length !== 2 || args[0] !== '--port')) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    console.error('Usage: npm start -- --port 4173');
    process.exitCode = 1;
  } else {
    try {
      const server = await startServer({ port });
      console.log(`Motion Foundry: http://127.0.0.1:${server.address().port}/`);
      console.log('Serving dist/ for local development. Press Ctrl+C to stop.');
    } catch (error) {
      console.error(`Cannot start local server: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
