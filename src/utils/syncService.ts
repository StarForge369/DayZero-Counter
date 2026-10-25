/**
 * Cross-platform Real-Time Cloud Sync Service
 * Allows users to sync their Day Zero state across desktop, mobile, and tablets
 * in real-time using Server-Sent Events (SSE) and instant cloud push.
 */

export const CANONICAL_SYNC_KEY = 'DAYZERO_PRIMARY';
const SYNC_KEY_STORAGE = 'dayzero_cloud_synckey';
const SYNC_OUTBOX_PREFIX = 'dayzero_sync_pending_';
// AI Studio serves the frontend and API from one origin. GitHub Pages is static,
// so it calls the separately hosted API. Keeping this as runtime host detection
// avoids AI Studio prompting for a build-time secret/value that is not required.
const SYNC_API_BASE_URL =
  typeof window !== 'undefined' && window.location.hostname === 'starforge369.github.io'
    ? 'https://day-zero-precise-days-counter.ai.studio'
    : '';
const syncApiUrl = (path: string) => `${SYNC_API_BASE_URL}${path}`;
let volatileSyncKey: string | null = null;

function isValidSyncKey(key: string | null | undefined): key is string {
  return !!key && key.length >= 3 && key.length <= 64 && /^[A-Z0-9_-]+$/.test(key);
}

function createPrivateSyncKey(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Web Crypto is available on all supported HTTPS hosts; this fallback is
    // for restricted local previews only.
    bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  }
  return `DAY-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

const pushQueues = new Map<string, Promise<{ success: boolean; updatedAt?: string }>>();

function getOutboxStorageKey(syncKey: string) {
  return `${SYNC_OUTBOX_PREFIX}${encodeURIComponent(syncKey.toUpperCase())}`;
}

export function savePendingSyncPayload(syncKey: string, payload: CloudPayload): string | null {
  try {
    const raw = JSON.stringify(payload);
    localStorage.setItem(getOutboxStorageKey(syncKey), raw);
    return raw;
  } catch {
    return null;
  }
}

export function getPendingSyncPayload(
  syncKey: string
): { payload: CloudPayload; raw: string } | null {
  try {
    const raw = localStorage.getItem(getOutboxStorageKey(syncKey));
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || !Array.isArray(payload.counters) || payload.counters.length === 0) {
      localStorage.removeItem(getOutboxStorageKey(syncKey));
      return null;
    }
    return { payload, raw };
  } catch {
    return null;
  }
}

export function clearPendingSyncPayload(syncKey: string, expectedRaw: string): boolean {
  try {
    const storageKey = getOutboxStorageKey(syncKey);
    if (localStorage.getItem(storageKey) !== expectedRaw) return false;
    localStorage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}

export function getOrCreateSyncKey(): string {
  try {
    // Check if query param exists in URL (?sync=...)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlKey = urlParams.get('sync')?.trim().toUpperCase();
      if (isValidSyncKey(urlKey)) {
        localStorage.setItem(SYNC_KEY_STORAGE, urlKey);
        // Remove only the secret sync code; keep routes and other query state.
        urlParams.delete('sync');
        const query = urlParams.toString();
        const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', newUrl);
        return urlKey;
      }
    }

    const saved = localStorage.getItem(SYNC_KEY_STORAGE)?.trim().toUpperCase();
    if (isValidSyncKey(saved)) {
      return saved;
    }

    // New installs receive a private, shareable bearer key instead of sharing
    // one public namespace with every other installation.
    volatileSyncKey = createPrivateSyncKey();
    localStorage.setItem(SYNC_KEY_STORAGE, volatileSyncKey);
    return volatileSyncKey;
  } catch {
    volatileSyncKey ??= createPrivateSyncKey();
    return volatileSyncKey;
  }
}

export function setCustomSyncKey(key: string) {
  try {
    const formatted = (key || '').toUpperCase().trim();
    if (isValidSyncKey(formatted)) localStorage.setItem(SYNC_KEY_STORAGE, formatted);
  } catch {}
}

export function getShareableSyncUrl(syncKey: string): string {
  if (typeof window === 'undefined') return '';
  const shareUrl = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
  shareUrl.searchParams.set('sync', syncKey || CANONICAL_SYNC_KEY);
  return shareUrl.toString();
}

export interface CloudPayload {
  counters: any[];
  activeCounterId: string;
  notes: Record<string, any[]>;
  milestones: Record<string, any[]>;
  habits: Record<string, any[]>;
  checkIns: Record<string, any[]>;
  targetEvents: Record<string, any[]>;
  notifiedMilestones: string[];
  themeMode: string;
}

export async function pushDataToCloud(
  syncKey: string,
  payload: CloudPayload
): Promise<{ success: boolean; updatedAt?: string }> {
  const key = (syncKey || '').trim().toUpperCase();
  if (!isValidSyncKey(key)) return { success: false };

  // Serialize writes per sync key so a slower earlier request cannot finish
  // after a newer edit and replace it on the server.
  const previous = pushQueues.get(key) || Promise.resolve({ success: true });
  const request = previous.catch(() => ({ success: false })).then(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(syncApiUrl('/api/sync/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncKey: key, data: payload }),
        signal: controller.signal,
      });
      if (!res.ok) return { success: false };
      const data = await res.json();
      return { success: true, updatedAt: data.updatedAt };
    } catch {
      console.warn('Cloud sync push offline or server unreachable');
      return { success: false };
    } finally {
      clearTimeout(timeout);
    }
  });

  pushQueues.set(key, request);
  try {
    return await request;
  } finally {
    if (pushQueues.get(key) === request) pushQueues.delete(key);
  }
}

export async function pullDataFromCloud(
  syncKey: string
): Promise<{ success: boolean; data?: CloudPayload; updatedAt?: string; notFound?: boolean }> {
  try {
    const key = (syncKey || '').trim().toUpperCase();
    if (!isValidSyncKey(key)) return { success: false };
    const res = await fetch(syncApiUrl(`/api/sync/load/${encodeURIComponent(key)}`), {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { success: false, notFound: res.status === 404 };
    const json = await res.json();
    if (json.success && json.data) {
      return { success: true, data: json.data, updatedAt: json.updatedAt };
    }
    return { success: false };
  } catch (err) {
    console.warn('Cloud sync pull failed:', err);
    return { success: false };
  }
}

/**
 * Dispatches a custom event to alert App.tsx that child components
 * (notes, milestones, countdowns) have saved new changes locally.
 */
export function notifyLocalStateChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dayzero_local_mutated'));
  }
}

/**
 * Subscribes to real-time updates via Server-Sent Events (SSE).
 * Broadcasts changes between devices within milliseconds!
 */
export function subscribeToRealTimeSync(
  syncKey: string,
  onData: (data: CloudPayload, updatedAt?: string) => void,
  onStatusChange?: (connected: boolean) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  let eventSource: EventSource | null = null;
  let isClosed = false;

  function connect() {
    if (isClosed) return;
    try {
      const targetKey = (syncKey || '').trim().toUpperCase();
      if (!isValidSyncKey(targetKey)) {
        onStatusChange?.(false);
        return;
      }
      const url = syncApiUrl(`/api/sync/stream/${encodeURIComponent(targetKey)}`);
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        onStatusChange?.(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.data) {
            onData(parsed.data, parsed.updatedAt);
          }
        } catch (err) {
          console.warn('Error parsing SSE sync message', err);
        }
      };

      eventSource.onerror = () => {
        // EventSource reconnects on its own. Closing and replacing it here creates
        // unnecessary connection churn, especially behind hosting proxies.
        onStatusChange?.(false);
      };
    } catch {
      onStatusChange?.(false);
    }
  }

  connect();

  return () => {
    isClosed = true;
    eventSource?.close();
  };
}

