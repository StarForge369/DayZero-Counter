import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.SYNC_DATA_DIR
  ? path.resolve(process.env.SYNC_DATA_DIR)
  : path.join(__dirname, 'data');
const SYNC_FILE = path.join(DATA_DIR, 'sync-store.json');

function normalizeSyncKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toUpperCase();
  return /^[A-Z0-9_-]{3,64}$/.test(key) ? key : null;
}

// Ensure data directory and storage file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(SYNC_FILE)) {
  fs.writeFileSync(SYNC_FILE, JSON.stringify({}), 'utf-8');
}

function readSyncStore(): Record<string, any> {
  try {
    const raw = fs.readFileSync(SYNC_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeSyncStore(data: Record<string, any>): boolean {
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
const sseClients: Map<string, Set<express.Response>> = new Map();

function broadcastToClients(syncKey: string, payload: any) {
  const normalizedKey = syncKey.toUpperCase();
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

async function startServer() {
  const app = express();

  // Permit the public GitHub Pages frontend to call the separate sync API.
  const allowedFrontendOrigin = 'https://starforge369.github.io';
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin === allowedFrontendOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedFrontendOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });
  app.use(express.json({ limit: '15mb' }));

  // Each sync code is an isolated namespace; never return another key's data.
  const getLatestEntry = (requestedKey: string) => {
    const store = readSyncStore();
    const key = normalizeSyncKey(requestedKey);
    return key ? store[key] || null : null;
  };

  // API Route: Real-time Server-Sent Events (SSE) stream for instant sync
  app.get('/api/sync/stream/:syncKey', (req, res) => {
    const syncKey = normalizeSyncKey(req.params.syncKey);
    if (!syncKey) return res.status(400).json({ error: 'Invalid sync key' });

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

    // Send latest available state immediately on connection
    const entry = getLatestEntry(syncKey);
    if (entry) {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    }

    // Keepalive heartbeat ping every 15s to keep connection open across mobile backgrounding
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
  });

  // API Route: Save sync data & instantly broadcast to all listening devices
  app.post('/api/sync/save', (req, res) => {
    const { syncKey, data } = req.body;
    const key = normalizeSyncKey(syncKey);
    if (!key || !data || typeof data !== 'object' || !Array.isArray(data.counters) || data.counters.length === 0) {
      return res.status(400).json({ error: 'Invalid sync key or payload' });
    }

    const store = readSyncStore();
    const now = new Date().toISOString();
    const payload = {
      data,
      updatedAt: now,
    };

    // Store each device group under its own key; do not merge users into a global bucket.
    store[key] = payload;
    if (!writeSyncStore(store)) return res.status(500).json({ error: 'Failed to persist sync data' });

    // Instant real-time broadcast to devices using this exact key.
    broadcastToClients(key, payload);

    return res.json({ success: true, updatedAt: now });
  });

  // API Route: Load sync data for a specific sync key
  app.get('/api/sync/load/:syncKey', (req, res) => {
    const syncKey = normalizeSyncKey(req.params.syncKey);
    if (!syncKey) return res.status(400).json({ error: 'Invalid sync key' });
    const entry = getLatestEntry(syncKey);

    if (!entry) {
      return res.status(404).json({ error: 'Sync data not found' });
    }

    return res.json({ success: true, data: entry.data, updatedAt: entry.updatedAt });
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mount Vite middleware in development
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Day Zero full-stack real-time server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup error:', err);
});

