/**
 * Cross-platform Real-Time Cloud Sync Service
 * Allows users to sync their Day Zero state across desktop, mobile, and tablets
 * in real-time using Server-Sent Events (SSE) and instant cloud push.
 */

export const CANONICAL_SYNC_KEY = 'DAYZERO_PRIMARY';
const SYNC_KEY_STORAGE = 'dayzero_cloud_synckey';
const SYNC_API_BASE_URL = (import.meta.env.VITE_SYNC_API_BASE_URL || '').replace(/\\/+$/, '');
const syncApiUrl = (path: string) => `${SYNC_API_BASE_URL}${path}`;

export function getOrCreateSyncKey(): string {
  try {
    // Check if query param exists in URL (?sync=...)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlKey = urlParams.get('sync')?.toUpperCase();
      if (urlKey && urlKey.length >= 3) {
        localStorage.setItem(SYNC_KEY_STORAGE, urlKey);
        // Clean URL query param without full reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        return urlKey;
      }
    }

    const saved = localStorage.getItem(SYNC_KEY_STORAGE);
    if (saved && saved.trim().length >= 3) {
      return saved.toUpperCase();
    }

    // Default canonical key shared across all devices for this user
    localStorage.setItem(SYNC_KEY_STORAGE, CANONICAL_SYNC_KEY);
    return CANONICAL_SYNC_KEY;
  } catch {
    return CANONICAL_SYNC_KEY;
  }
}

export function setCustomSyncKey(key: string) {
  try {
    const formatted = (key || CANONICAL_SYNC_KEY).toUpperCase().trim();
    localStorage.setItem(SYNC_KEY_STORAGE, formatted);
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
  try {
    const res = await fetch(syncApiUrl('/api/sync/save'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncKey: (syncKey || CANONICAL_SYNC_KEY).toUpperCase(), data: payload }),
    });
    if (!res.ok) return { success: false };
    const data = await res.json();
    return { success: true, updatedAt: data.updatedAt };
  } catch (err) {
    console.warn('Cloud sync push offline or server unreachable');
    return { success: false };
  }
}

export async function pullDataFromCloud(
  syncKey: string
): Promise<{ success: boolean; data?: CloudPayload; updatedAt?: string; notFound?: boolean }> {
  try {
    const res = await fetch(syncApiUrl(`/api/sync/load/${encodeURIComponent((syncKey || CANONICAL_SYNC_KEY).toUpperCase())}`));
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
      const targetKey = (syncKey || CANONICAL_SYNC_KEY).toUpperCase();
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
