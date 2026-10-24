import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const SYNC_FILE = path.join(DATA_DIR, 'sync-store.json');

const CANONICAL_PRIMARY_KEY = 'DAYZERO_PRIMARY';

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

function writeSyncStore(data: Record<string, any>) {
  try {
    fs.writeFileSync(SYNC_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write sync store:', err);
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

  // Helper to find the freshest data across keys (e.g. DAYZERO_PRIMARY or user keys like DAY-1398)
  const getLatestEntry = (requestedKey?: string) => {
    const store = readSyncStore();
    const primary = store[CANONICAL_PRIMARY_KEY];
    if (requestedKey) {
      const specific = store[requestedKey.toUpperCase()];
      if (specific && primary) {
        const timeSpec = new Date(specific.updatedAt || 0).getTime();
        const timePrim = new Date(primary.updatedAt || 0).getTime();
        return timeSpec >= timePrim ? specific : primary;
      }
      if (specific) return specific;
    }
    return primary || null;
  };

  // API Route: Real-time Server-Sent Events (SSE) stream for instant sync
  app.get('/api/sync/stream/:syncKey', (req, res) => {
    const syncKey = (req.params.syncKey || CANONICAL_PRIMARY_KEY).toUpperCase();

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

    // Also register on CANONICAL_PRIMARY_KEY if different, so cross-device broadcasts always reach it
    if (syncKey !== CANONICAL_PRIMARY_KEY) {
      if (!sseClients.has(CANONICAL_PRIMARY_KEY)) {
        sseClients.set(CANONICAL_PRIMARY_KEY, new Set());
      }
      sseClients.get(CANONICAL_PRIMARY_KEY)!.add(res);
    }

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
      if (syncKey !== CANONICAL_PRIMARY_KEY) {
        const primClients = sseClients.get(CANONICAL_PRIMARY_KEY);
        if (primClients) {
          primClients.delete(res);
          if (primClients.size === 0) sseClients.delete(CANONICAL_PRIMARY_KEY);
        }
      }
    });
  });

  // API Route: Save sync data & instantly broadcast to all listening devices
  app.post('/api/sync/save', (req, res) => {
    const { syncKey, data } = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Missing sync data' });
    }

    const key = (syncKey || CANONICAL_PRIMARY_KEY).toUpperCase();
    const store = readSyncStore();
    const now = new Date().toISOString();
    const payload = {
      data,
      updatedAt: now,
    };

    // Store under the user's syncKey AND mirror to CANONICAL_PRIMARY_KEY
    store[key] = payload;
    store[CANONICAL_PRIMARY_KEY] = payload;
    writeSyncStore(store);

    // Instant Real-Time Broadcast to devices listening to this key and/or CANONICAL_PRIMARY_KEY
    broadcastToClients(key, payload);
    if (key !== CANONICAL_PRIMARY_KEY) {
      broadcastToClients(CANONICAL_PRIMARY_KEY, payload);
    }

    return res.json({ success: true, updatedAt: now });
  });

  // API Route: Load sync data for a specific sync key
  app.get('/api/sync/load/:syncKey', (req, res) => {
    const syncKey = (req.params.syncKey || CANONICAL_PRIMARY_KEY).toUpperCase();
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
