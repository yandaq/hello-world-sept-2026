import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { getMessage } from './db.js';

const port = process.env.PORT || 3000;
const PUBLIC_DIR = new URL('../public/', import.meta.url);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

const notFound = (res) => sendJson(res, 404, { error: 'not found' });

function handleMessage(res) {
  try {
    const message = getMessage();
    if (message === null) {
      sendJson(res, 503, { error: 'no message in database' });
      return;
    }
    sendJson(res, 200, { message });
  } catch (err) {
    console.error('GET /api/message failed:', err?.stack ?? err);
    sendJson(res, 500, { error: 'failed to read message from database' });
  }
}

async function handleStatic(res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const ext = relative.slice(relative.lastIndexOf('.'));
  const contentType = MIME[ext];
  if (!contentType) {
    notFound(res);
    return;
  }

  // Resolve against public/ and reject anything that escapes it (e.g. ../).
  const fileUrl = new URL(relative, PUBLIC_DIR);
  if (!fileUrl.href.startsWith(PUBLIC_DIR.href)) {
    notFound(res);
    return;
  }

  try {
    const body = await readFile(fileUrl);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(body);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`GET ${pathname} failed:`, err.stack);
    notFound(res);
  }
}

const server = createServer((req, res) => {
  if (req.method !== 'GET') {
    notFound(res);
    return;
  }

  const { pathname } = new URL(req.url, 'http://localhost');

  if (pathname === '/api/message') {
    handleMessage(res);
    return;
  }

  handleStatic(res, pathname).catch((err) => {
    console.error('static handler failed:', err.stack);
    notFound(res);
  });
});

server.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
