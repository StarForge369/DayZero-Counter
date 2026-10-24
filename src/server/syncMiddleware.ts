import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SYNC_FILE = path.join(DATA_DIR, 'sync-store.json');
const PRIMARY_SYNC_KEY = 'DAYZERO_PRIMARY';

// Ensure data directory and storage file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(SYNC_FILE)) {
  fs.writeFileSync(SYNC_FILE, JSON.stringify({}), 'utf-8');
}

export function readSyncStore(): Record<string, any> {
  try {
    const raw = fs.readFileSync(SYNC_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function writeSyncStore(data: Record<string, any>) {
  try {
    fs.writeFileSync(SYNC_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write sync store:', err);
  }
}

// Active SSE client connections map by syncKey
const sseClients: Map<string, Set<ServerResponse>> = new Map();

export function broadcastToClients(syncKey: string, payload: any) {
  const normalizedKey = (syncKey || PRIMARY_SYNC_KEY).toUpperCase();
  const keysToBroadcast = [normalizedKey];
  if (normalizedKey !== PRIMARY_SYNC_KEY) {
    keysToBroadcast.push(PRIMARY_SYNC_KEY);
  }

  for (const k of keysToBroadcast) {
    const clients = sseClients.get(k);
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
}

export function handleSyncApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = req.url || '';

  // 1. SSE Stream: /api/sync/stream/:syncKey
  if (url.startsWith('/api/sync/stream')) {
    const parts = url.split('/');
    const rawKey = parts[4]?.split('?')[0];
    const syncKey = (rawKey || PRIMARY_SYNC_KEY).toUpperCase();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    if (!sseClients.has(syncKey)) {
      sseClients.set(syncKey, new Set());
    }
    const clients = sseClients.get(syncKey)!;
    clients.add(res);

    // Send immediate initial state
    const store = readSyncStore();
    const entry = store[syncKey] || store[PRIMARY_SYNC_KEY];
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

    req.on('close', () => {
      clearInterval(keepalive);
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(syncKey);
      }
    });
    return;
  }

  // 2. Save Data: POST /api/sync/save
  if (url === '/api/sync/save' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const { syncKey, data } = parsed;
        if (!data) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing data' }));
          return;
        }

        const key = (syncKey || PRIMARY_SYNC_KEY).toUpperCase();
        const store = readSyncStore();
        const entry = {
          data,
          updatedAt: new Date().toISOString(),
        };

        store[key] = entry;
        store[PRIMARY_SYNC_KEY] = entry;
        writeSyncStore(store);

        // Instant broadcast
        broadcastToClients(key, entry);

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true, updatedAt: entry.updatedAt }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to save sync data' }));
      }
    });
    return;
  }

  // 3. Load Data: GET /api/sync/load/:syncKey
  if (url.startsWith('/api/sync/load')) {
    const parts = url.split('/');
    const rawKey = parts[4]?.split('?')[0];
    const syncKey = (rawKey || PRIMARY_SYNC_KEY).toUpperCase();

    const store = readSyncStore();
    const entry = store[syncKey] || store[PRIMARY_SYNC_KEY];

    if (!entry) {
      res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Sync data not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: true, data: entry.data, updatedAt: entry.updatedAt }));
    return;
  }

  // 4. Health Check: GET /api/health
  if (url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // Delegate all other routes to Vite
  next();
}
