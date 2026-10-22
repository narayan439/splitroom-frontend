import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const browserRoot = resolve(projectRoot, 'dist', 'splitroom-frontend', 'browser');
const portArgumentIndex = process.argv.indexOf('--port');
const argumentPort = portArgumentIndex >= 0 ? process.argv[portArgumentIndex + 1] : undefined;
if (portArgumentIndex >= 0 && !argumentPort) {
  console.error('Pass a port number after --port.');
  process.exit(1);
}
const configuredPort = Number(process.env.PORT ?? argumentPort ?? 10000);

if (!Number.isInteger(configuredPort) || configuredPort < 1 || configuredPort > 65535) {
  console.error('PORT must be a valid TCP port number.');
  process.exit(1);
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400);
    response.end('Bad request');
    return;
  }

  if (pathname === '/healthz') {
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    });
    response.end('ok');
    return;
  }

  const requestedPath = resolve(browserRoot, `.${pathname}`);
  const relativePath = relative(browserRoot, requestedPath);
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  let filePath = requestedPath;
  try {
    if (!statSync(filePath).isFile()) {
      filePath = resolve(browserRoot, 'index.html');
    }
  } catch {
    if (extname(pathname)) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    filePath = resolve(browserRoot, 'index.html');
  }

  let fileStats;
  try {
    fileStats = statSync(filePath);
  } catch (error) {
    console.error(
      'Production frontend files are missing. Build the app before starting it.',
      error,
    );
    response.writeHead(503);
    response.end('Application is not built');
    return;
  }

  const filename = filePath.slice(filePath.lastIndexOf(sep) + 1);
  const isHashedAsset = /-[A-Z0-9_-]{8,}\./i.test(filename);
  response.writeHead(200, {
    'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    'Content-Length': fileStats.size,
    'Content-Type': contentTypes.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on('error', (error) => {
    console.error('Could not read a production frontend asset.', error);
    if (!response.headersSent) {
      response.writeHead(500);
    }
    response.end();
  });
  stream.pipe(response);
});

server.listen(configuredPort, '0.0.0.0', () => {
  console.log(`SplitRoom frontend listening on port ${configuredPort}.`);
});
