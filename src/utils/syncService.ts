/**
 * Cross-device synchronization backed by Cloud Firestore.
 * Sync codes remain bearer capabilities; Firebase Anonymous Auth is used to
 * make Firestore Rules apply, while hashed document IDs keep codes out of paths.
 */
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentData,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { ensureFirebaseAuthentication, firestore } from '../firebase';
import type { CloudPayload } from '../types';
import { mergeCloudPayloads, normalizeCloudPayload } from './cloudPayload';

export const CANONICAL_SYNC_KEY = 'DAYZERO_PRIMARY';
const SYNC_KEY_STORAGE = 'dayzero_cloud_synckey';
const SYNC_OUTBOX_PREFIX = 'dayzero_sync_pending_';
const configuredSyncApiBase = import.meta.env.VITE_SYNC_API_BASE_URL?.trim().replace(/\/$/, '');
const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
const usesSameOriginLegacyApi = isLocalHost || hostname.endsWith('.ai.studio');
const SYNC_API_BASE_URL = configuredSyncApiBase || (
  usesSameOriginLegacyApi ? '' : 'https://day-zero-precise-days-counter.ai.studio'
);
const MAX_SYNC_BYTES = 15 * 1024 * 1024;
const CHUNK_BYTES = 240 * 1024;
const MAX_CHUNKS = Math.ceil(MAX_SYNC_BYTES / CHUNK_BYTES);
const syncApiUrl = (path: string) => `${SYNC_API_BASE_URL}${path}`;
let volatileSyncKey: string | null = null;

interface SyncBase {
  revision: number;
  payload: CloudPayload;
}

interface PendingSyncEnvelope {
  version: 2;
  payload: CloudPayload;
  base: CloudPayload | null;
}

interface PushResult {
  success: boolean;
  updatedAt?: string;
  data?: CloudPayload;
}

interface PullResult {
  success: boolean;
  data?: CloudPayload;
  updatedAt?: string;
  revision?: number;
  notFound?: boolean;
}

interface StoredChunk {
  id: string;
  index: number;
  data: string;
}

const remoteBases = new Map<string, SyncBase>();
const pushQueues = new Map<string, Promise<PushResult>>();
const legacyCheckedKeys = new Set<string>();
const legacyMigrations = new Map<string, Promise<PullResult>>();

function normalizeSyncKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toUpperCase();
  return /^[A-Z0-9_-]{3,64}$/.test(key) ? key : null;
}

export function isValidSyncKey(key: string | null | undefined): key is string {
  return normalizeSyncKey(key) !== null;
}

function createPrivateSyncKey(): string {
  const bytes = new Uint8Array(30);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Only used by non-secure local previews. Production hosts use Web Crypto.
    bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  }
  return `DAY-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function getOutboxStorageKey(syncKey: string) {
  return `${SYNC_OUTBOX_PREFIX}${encodeURIComponent(syncKey.toUpperCase())}`;
}

export function getRemoteBasePayload(syncKey: string): CloudPayload | null {
  return remoteBases.get(syncKey.toUpperCase())?.payload || null;
}

export function savePendingSyncPayload(
  syncKey: string,
  payload: CloudPayload,
  base: CloudPayload | null = getRemoteBasePayload(syncKey),
): string | null {
  try {
    const raw = JSON.stringify({ version: 2, payload, base } satisfies PendingSyncEnvelope);
    localStorage.setItem(getOutboxStorageKey(syncKey), raw);
    return raw;
  } catch {
    return null;
  }
}

export function getPendingSyncPayload(
  syncKey: string,
): { payload: CloudPayload; base: CloudPayload | null; raw: string } | null {
  try {
    const raw = localStorage.getItem(getOutboxStorageKey(syncKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const envelope = parsed && parsed.version === 2
      ? parsed as Partial<PendingSyncEnvelope>
      : { payload: parsed, base: null };
    const payload = normalizeCloudPayload(envelope.payload);
    const base = envelope.base === null ? null : normalizeCloudPayload(envelope.base);
    return payload ? { payload, base, raw } : null;
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
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const urlKey = normalizeSyncKey(urlParams.get('sync'));
    if (urlKey) {
      try {
        localStorage.setItem(SYNC_KEY_STORAGE, urlKey);
      } catch {
        volatileSyncKey = urlKey;
      }
      urlParams.delete('sync');
      const queryString = urlParams.toString();
      const cleanUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', cleanUrl);
      return urlKey;
    }
  }

  try {
    const saved = normalizeSyncKey(localStorage.getItem(SYNC_KEY_STORAGE));
    if (saved) return saved;
  } catch {
    // A private in-memory key still allows this session to use sync.
  }

  volatileSyncKey ??= createPrivateSyncKey();
  try {
    localStorage.setItem(SYNC_KEY_STORAGE, volatileSyncKey);
  } catch {
    // Storage may be disabled or full; keep the key for this page session.
  }
  return volatileSyncKey;
}

export function setCustomSyncKey(key: string): void {
  const normalized = normalizeSyncKey(key);
  if (!normalized) return;
  volatileSyncKey = normalized;
  try {
    localStorage.setItem(SYNC_KEY_STORAGE, normalized);
  } catch {
    // The active session can still use the in-memory key.
  }
}

export function getShareableSyncUrl(syncKey: string): string {
  if (typeof window === 'undefined') return '';
  const shareUrl = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
  shareUrl.searchParams.set('sync', syncKey || CANONICAL_SYNC_KEY);
  return shareUrl.toString();
}

async function getSpaceId(syncKey: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure browser encryption is unavailable. Open Day Zero over HTTPS and try again.');
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(syncKey),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getSpaceDocument(spaceId: string) {
  return doc(firestore, 'syncSpaces', spaceId);
}

function chunkId(index: number): string {
  return `chunk_${String(index).padStart(4, '0')}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const sliceSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += sliceSize) {
    const slice = bytes.subarray(offset, Math.min(offset + sliceSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodePayload(payload: CloudPayload): { chunks: string[]; byteLength: number } | null {
  const raw = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(raw);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_SYNC_BYTES) return null;

  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
    chunks.push(bytesToBase64(bytes.subarray(offset, Math.min(offset + CHUNK_BYTES, bytes.length))));
  }
  if (chunks.length === 0 || chunks.length > MAX_CHUNKS) return null;
  return { chunks, byteLength: bytes.byteLength };
}

function decodePayloadChunks(
  chunks: StoredChunk[],
  expectedCount: number,
  expectedByteLength: number,
): CloudPayload | null {
  if (
    !Number.isInteger(expectedCount) || expectedCount < 1 || expectedCount > MAX_CHUNKS ||
    !Number.isInteger(expectedByteLength) || expectedByteLength < 1 || expectedByteLength > MAX_SYNC_BYTES ||
    chunks.length !== expectedCount
  ) return null;

  const bytes = new Uint8Array(expectedByteLength);
  let offset = 0;
  for (let index = 0; index < expectedCount; index += 1) {
    const chunk = chunks[index];
    if (chunk.index !== index || typeof chunk.data !== 'string') return null;
    let decoded: Uint8Array;
    try {
      decoded = base64ToBytes(chunk.data);
    } catch {
      return null;
    }
    if (offset + decoded.length > bytes.length) return null;
    bytes.set(decoded, offset);
    offset += decoded.length;
  }
  if (offset !== expectedByteLength) return null;

  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    return normalizeCloudPayload(value);
  } catch {
    return null;
  }
}

function toIsoTimestamp(value: unknown): string | undefined {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

async function readFirestoreEntry(
  syncKey: string,
  spaceId: string,
): Promise<PullResult> {
  const spaceRef = getSpaceDocument(spaceId);
  const result = await runTransaction(firestore, async (transaction) => {
    const metadataSnapshot = await transaction.get(spaceRef);
    if (!metadataSnapshot.exists()) return null;

    const metadata = metadataSnapshot.data();
    const chunkCount = Number(metadata.chunkCount);
    if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > MAX_CHUNKS) {
      return { metadata, chunks: [] as DocumentSnapshot<DocumentData>[] };
    }
    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, index) =>
        transaction.get(doc(collection(spaceRef, 'chunks'), chunkId(index))),
      ),
    );
    return { metadata, chunks };
  });

  if (!result) {
    remoteBases.delete(syncKey);
    return { success: false, notFound: true };
  }

  const { metadata, chunks: chunkSnapshots } = result;
  const revision = Number(metadata.revision);
  const chunkCount = Number(metadata.chunkCount);
  const byteLength = Number(metadata.byteLength);
  const chunks: StoredChunk[] = chunkSnapshots.flatMap((snapshot) => {
    if (!snapshot.exists()) return [];
    const value = snapshot.data();
    return [{
      id: snapshot.id,
      index: Number(value.index),
      data: typeof value.data === 'string' ? value.data : '',
    }];
  });
  const data = decodePayloadChunks(chunks, chunkCount, byteLength);
  if (!data || !Number.isInteger(revision) || revision < 1) {
    return { success: false };
  }

  remoteBases.set(syncKey, { revision, payload: data });
  return {
    success: true,
    data,
    revision,
    updatedAt: toIsoTimestamp(metadata.updatedAt),
  };
}

async function writeFirestorePayload(syncKey: string, requestedPayload: CloudPayload): Promise<PushResult> {
  const payload = normalizeCloudPayload(requestedPayload);
  if (!payload) return { success: false };
  const encoded = encodePayload(payload);
  if (!encoded) return { success: false };

  await ensureFirebaseAuthentication();
  const spaceId = await getSpaceId(syncKey);
  const spaceRef = getSpaceDocument(spaceId);
  const chunksRef = collection(spaceRef, 'chunks');
  const previousBase = remoteBases.get(syncKey);
  let committedData: CloudPayload = payload;
  let committedRevision = 0;

  await runTransaction(firestore, async (transaction) => {
    const metadataSnapshot = await transaction.get(spaceRef);
    let remoteData: CloudPayload | null = null;
    let existingChunks: DocumentSnapshot<DocumentData>[] = [];
    let remoteRevision = 0;

    if (metadataSnapshot.exists()) {
      const metadata = metadataSnapshot.data();
      remoteRevision = Number(metadata.revision);
      const chunkCount = Number(metadata.chunkCount);
      const byteLength = Number(metadata.byteLength);
      if (!Number.isInteger(remoteRevision) || remoteRevision < 1) {
        throw new Error('Cloud sync metadata is invalid; refusing to replace it.');
      }
      if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > MAX_CHUNKS) {
        throw new Error('Cloud sync chunk metadata is invalid; refusing to replace it.');
      }
      existingChunks = await Promise.all(
        Array.from({ length: chunkCount }, (_, index) =>
          transaction.get(doc(chunksRef, chunkId(index))),
        ),
      );
      const chunks: StoredChunk[] = existingChunks.flatMap((snapshot) => {
        if (!snapshot.exists()) return [];
        const value = snapshot.data();
        return [{
          id: snapshot.id,
          index: Number(value.index),
          data: typeof value.data === 'string' ? value.data : '',
        }];
      });
      remoteData = decodePayloadChunks(chunks, chunkCount, byteLength);
      if (!remoteData) {
        throw new Error('Cloud sync data could not be validated; refusing to replace it.');
      }
    }

    const nextData = remoteData
      ? mergeCloudPayloads(previousBase?.payload || null, payload, remoteData)
      : payload;
    const nextEncoding = encodePayload(nextData);
    if (!nextEncoding) throw new Error('This backup is too large to sync (maximum 15 MB).');

    committedData = nextData;
    committedRevision = remoteRevision + 1;
    transaction.set(spaceRef, {
      revision: committedRevision,
      chunkCount: nextEncoding.chunks.length,
      byteLength: nextEncoding.byteLength,
      updatedAt: serverTimestamp(),
    });

    nextEncoding.chunks.forEach((chunk, index) => {
      transaction.set(doc(chunksRef, chunkId(index)), {
        index,
        data: chunk,
      });
    });
    existingChunks.forEach((snapshot, index) => {
      if (snapshot.exists() && index >= nextEncoding.chunks.length) transaction.delete(snapshot.ref);
    });
  });

  const updatedAt = new Date().toISOString();
  remoteBases.set(syncKey, { revision: committedRevision, payload: committedData });
  return { success: true, updatedAt, data: committedData };
}

async function pullLegacyPayload(syncKey: string): Promise<PullResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(syncApiUrl(`/api/sync/load/${encodeURIComponent(syncKey)}`), {
      signal: controller.signal,
    });
    if (response.status === 404) return { success: false, notFound: true };
    if (!response.ok) return { success: false };
    const json = await response.json();
    const data = normalizeCloudPayload(json?.data);
    if (!json?.success || !data) return { success: false };
    return { success: true, data, updatedAt: toIsoTimestamp(json.updatedAt) };
  } catch {
    // A legacy API failure is not proof that a sync space is empty.
    return { success: false };
  } finally {
    clearTimeout(timeout);
  }
}

async function pushDataDirect(syncKey: string, payload: CloudPayload): Promise<PushResult> {
  const key = normalizeSyncKey(syncKey);
  if (!key) return { success: false };

  const previous = pushQueues.get(key) || Promise.resolve({ success: true });
  const request = previous
    .catch((): PushResult => ({ success: false }))
    .then(() => writeFirestorePayload(key, payload))
    .catch((error): PushResult => {
      console.warn('Cloud sync push failed:', error);
      return { success: false };
    });

  pushQueues.set(key, request);
  try {
    return await request;
  } finally {
    if (pushQueues.get(key) === request) pushQueues.delete(key);
  }
}

export async function pushDataToCloud(syncKey: string, payload: CloudPayload): Promise<PushResult> {
  const key = normalizeSyncKey(syncKey);
  if (!key) return { success: false };

  // First read the Firestore space and check the previous API before writing.
  // This keeps a quick local edit from masking the only copy on the old host.
  if (!remoteBases.has(key)) {
    const existing = await pullDataFromCloud(key);
    if (!existing.success && !existing.notFound) return { success: false };
  }
  return pushDataDirect(key, payload);
}

export async function pullDataFromCloud(syncKey: string): Promise<PullResult> {
  const key = normalizeSyncKey(syncKey);
  if (!key) return { success: false };

  try {
    await ensureFirebaseAuthentication();
    const spaceId = await getSpaceId(key);
    const firestoreResult = await readFirestoreEntry(key, spaceId);
    if (!firestoreResult.notFound) return firestoreResult;

    // Copy any existing sync space from the previous API on first access. This
    // migration is additive: the old copy is left untouched for recovery.
    if (legacyCheckedKeys.has(key)) return { success: false, notFound: true };
    const existingMigration = legacyMigrations.get(key);
    if (existingMigration) return existingMigration;

    const migration = (async (): Promise<PullResult> => {
      const legacyResult = await pullLegacyPayload(key);
      if (legacyResult.success && legacyResult.data) {
        const migrated = await pushDataDirect(key, legacyResult.data);
        if (!migrated.success || !migrated.data) return { success: false };
        legacyCheckedKeys.add(key);
        return {
          success: true,
          data: migrated.data,
          updatedAt: migrated.updatedAt || legacyResult.updatedAt,
        };
      }
      if (legacyResult.notFound) {
        legacyCheckedKeys.add(key);
        return { success: false, notFound: true };
      }
      return { success: false };
    })();
    legacyMigrations.set(key, migration);
    try {
      return await migration;
    } finally {
      if (legacyMigrations.get(key) === migration) legacyMigrations.delete(key);
    }
  } catch (error) {
    console.warn('Cloud sync pull failed:', error);
    return { success: false };
  }
}

/** Notify App.tsx that a child feature saved new local data. */
export function notifyLocalStateChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dayzero_local_mutated'));
  }
}

/** Listens to the versioned Firestore document and loads its atomic chunk set. */
export function subscribeToRealTimeSync(
  syncKey: string,
  onData: (data: CloudPayload, updatedAt?: string) => void,
  onStatusChange?: (connected: boolean) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  let isClosed = false;
  let unsubscribe: (() => void) | null = null;
  let offlineTimer: ReturnType<typeof setTimeout> | null = null;
  let lastRevision = 0;

  const reportStatus = (connected: boolean, immediate = false) => {
    if (isClosed) return;
    if (connected) {
      if (offlineTimer) clearTimeout(offlineTimer);
      offlineTimer = null;
      onStatusChange?.(true);
      return;
    }
    if (immediate) {
      if (offlineTimer) clearTimeout(offlineTimer);
      offlineTimer = null;
      onStatusChange?.(false);
      return;
    }
    if (!offlineTimer) {
      offlineTimer = setTimeout(() => {
        offlineTimer = null;
        if (!isClosed) onStatusChange?.(false);
      }, 2500);
    }
  };

  const connect = async () => {
    const key = normalizeSyncKey(syncKey);
    if (!key) {
      reportStatus(false, true);
      return;
    }
    try {
      await ensureFirebaseAuthentication();
      const spaceId = await getSpaceId(key);
      if (isClosed) return;
      unsubscribe = onSnapshot(
        getSpaceDocument(spaceId),
        { includeMetadataChanges: true },
        async (snapshot) => {
          reportStatus(!snapshot.metadata.fromCache);
          if (!snapshot.exists()) return;
          const revision = Number(snapshot.data().revision);
          if (revision === lastRevision && !snapshot.metadata.fromCache) return;
          const result = await readFirestoreEntry(key, spaceId);
          if (isClosed || !result.success || !result.data) return;
          lastRevision = result.revision || revision;
          if (!snapshot.metadata.fromCache) reportStatus(true);
          onData(result.data, result.updatedAt);
        },
        (error) => {
          console.warn('Cloud sync listener failed:', error);
          reportStatus(false, true);
        },
      );
    } catch (error) {
      console.warn('Cloud sync could not connect:', error);
      reportStatus(false, true);
    }
  };

  void connect();
  return () => {
    isClosed = true;
    if (offlineTimer) clearTimeout(offlineTimer);
    unsubscribe?.();
  };
}
