import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.SYNC_DATA_DIR
  ? path.resolve(process.env.SYNC_DATA_DIR)
  : path.resolve(process.cwd(), 'data');
const SYNC_FILE = path.join(DATA_DIR, 'sync-store.json');
const ALLOWED_FRONTEND_ORIGIN = 'https://starforge369.github.io';

function normalizeSyncKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toUpperCase();
  return /^[A-Z0-9_-]{3,64}$/.test(key) ? key : null;
}

function decodeSyncKey(value: string): string | null {
  try {
    return normalizeSyncKey(decodeURIComponent(value));
  } catch {
    return null;
  }
}

// Ensure data directory and storage file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(SYNC_FILE)) {
  fs.writeFileSync(SYNC_FILE, JSON.stringify({}), 'utf-8');
}

export function readSyncStore(): Record<string, any> {
  const raw = fs.readFileSync(SYNC_FILE, 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Sync storage must contain a JSON object.');
  }
  return parsed as Record<string, any>;
}

export function writeSyncStore(data: Record<string, any>): boolean {
  const tempFile = `${SYNC_FILE}.tmp`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, SYNC_FILE);
    return true;
  } catch (err) {
    console.error('Failed to write sync store:', err);
    try { fs.rmSync(tempFile, { force: true }); } catch {}
    return false;
  }
}

// Active SSE client connections map by syncKey
const sseClients: Map<string, Set<ServerResponse>> = new Map();

export function broadcastToClients(syncKey: string, payload: any) {
  const normalizedKey = (syncKey || '').toUpperCase();
  const clients = sseClients.get(normalizedKey);
  if (clients && clients.size > 0) {
    const dataStr = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of clients) {
      try {
        client.write(dataStr);
      } catch {
        clients.delete(client);
      }
    }
  }
}

export function handleSyncApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = req.url || '';
  const pathname = url.split('?')[0];
  const origin = req.headers.origin;

  if (origin === ALLOWED_FRONTEND_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_FRONTEND_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. SSE Stream: /api/sync/stream/:syncKey
  if (pathname.startsWith('/api/sync/stream/')) {
    const rawKey = pathname.slice('/api/sync/stream/'.length);
    const syncKey = decodeSyncKey(rawKey);
    if (!syncKey) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid sync key' }));
      return;
    }

    let entry: Record<string, any> | undefined;
    try {
      entry = readSyncStore()[syncKey];
    } catch (error) {
      console.error('Failed to read sync store:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Sync storage is unavailable' }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    if (!sseClients.has(syncKey)) {
      sseClients.set(syncKey, new Set());
    }
    const clients = sseClients.get(syncKey)!;
    clients.add(res);

    // Send only this key's state; never fall back to a shared global record.
    if (entry) {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    }

    // Keepalive ping every 15s
    const keepalive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepalive);
      }
    }, 15000);

    res.on('close', () => {
      clearInterval(keepalive);
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(syncKey);
      }
    });
    return;
  }

  // 2. Save Data: POST /api/sync/save
  if (pathname === '/api/sync/save' && req.method === 'POST') {
    let body = '';
    let tooLarge = false;
    req.on('data', (chunk) => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > 15 * 1024 * 1024) {
        tooLarge = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Sync payload is too large' }));
      }
    });

    req.on('end', () => {
      if (tooLarge) return;
      try {
        const parsed = JSON.parse(body);
        const { syncKey, data } = parsed;
        const key = normalizeSyncKey(syncKey);
        if (!key || !data || typeof data !== 'object' || !Array.isArray(data.counters) || data.counters.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid sync key or payload' }));
          return;
        }

        const store = readSyncStore();
        const entry = {
          data,
          updatedAt: new Date().toISOString(),
        };

        store[key] = entry;
        if (!writeSyncStore(store)) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to persist sync data' }));
          return;
        }

        // Notify only devices using this exact sync key.
        broadcastToClients(key, entry);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, updatedAt: entry.updatedAt }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to save sync data' }));
      }
    });
    return;
  }

  // 3. Load Data: GET /api/sync/load/:syncKey
  if (pathname.startsWith('/api/sync/load/')) {
    const rawKey = pathname.slice('/api/sync/load/'.length);
    const syncKey = decodeSyncKey(rawKey);
    if (!syncKey) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid sync key' }));
      return;
    }

    let entry: Record<string, any> | undefined;
    try {
      entry = readSyncStore()[syncKey];
    } catch (error) {
      console.error('Failed to read sync store:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Sync storage is unavailable' }));
      return;
    }

    if (!entry) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Sync data not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: entry.data, updatedAt: entry.updatedAt }));
    return;
  }

  // 4. Health Check: GET /api/health
  if (pathname === '/api/health') {
    try {
      readSyncStore();
    } catch (error) {
      console.error('Sync health check could not read storage:', error);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'storage-unavailable' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // Delegate all other routes to Vite
  next();
}

