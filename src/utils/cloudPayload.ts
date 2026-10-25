import type {
  CloudPayload,
  Counter,
  DayNote,
  Habit,
  HabitCheckIn,
  Milestone,
  TargetEvent,
} from '../types';
import { isValidDateString } from './dateUtils';

type DataRecord = Record<string, unknown>;

function isRecord(value: unknown): value is DataRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecordOfArrays(value: unknown): value is Record<string, unknown[]> {
  return isRecord(value) && Object.values(value).every(Array.isArray);
}

function hasStringId(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0;
}

function hasCounterShape(value: unknown): value is Counter {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.title === 'string'
    && isValidDateString(value.startDate)
    && typeof value.createdAt === 'string';
}

function cleanRecordMap<T>(
  input: unknown,
  isValidItem: (item: unknown) => item is T,
): Record<string, T[]> | null {
  if (input === undefined || input === null) return {};
  if (!isStringRecordOfArrays(input)) return null;
  const result: Record<string, T[]> = {};
  for (const [key, values] of Object.entries(input)) {
    if (!values.every(isValidItem)) return null;
    result[key] = values as T[];
  }
  return result;
}

export function normalizeCloudPayload(value: unknown): CloudPayload | null {
  if (!isRecord(value) || !Array.isArray(value.counters)) return null;
  const counters = value.counters.filter(hasCounterShape);
  if (counters.length === 0 || counters.length !== value.counters.length) return null;

  const activeCounterId = typeof value.activeCounterId === 'string'
    && counters.some((counter) => counter.id === value.activeCounterId)
    ? value.activeCounterId
    : counters[0].id;

  const notes = cleanRecordMap<DayNote>(value.notes, (item): item is DayNote =>
    isRecord(item)
      && typeof item.id === 'string'
      && typeof item.counterId === 'string'
      && Number.isInteger(item.dayNumber)
      && isValidDateString(item.dateStr)
      && typeof item.text === 'string',
  );
  const milestones = cleanRecordMap<Milestone>(value.milestones, (item): item is Milestone =>
    isRecord(item) && Number.isInteger(item.day) && typeof item.label === 'string',
  );
  const habits = cleanRecordMap<Habit>(value.habits, (item): item is Habit =>
    isRecord(item)
      && typeof item.id === 'string'
      && typeof item.counterId === 'string'
      && typeof item.name === 'string'
      && typeof item.createdAt === 'string',
  );
  const checkIns = cleanRecordMap<HabitCheckIn>(value.checkIns, (item): item is HabitCheckIn =>
    isRecord(item)
      && typeof item.habitId === 'string'
      && isValidDateString(item.dateStr)
      && Number.isInteger(item.dayNumber),
  );
  const targetEvents = cleanRecordMap<TargetEvent>(value.targetEvents, (item): item is TargetEvent =>
    isRecord(item)
      && typeof item.id === 'string'
      && typeof item.counterId === 'string'
      && typeof item.title === 'string'
      && isValidDateString(item.targetDate)
      && typeof item.createdAt === 'string',
  );
  if (!notes || !milestones || !habits || !checkIns || !targetEvents) return null;

  const notifiedMilestones: Record<string, number[]> = {};
  if (isRecord(value.notifiedMilestones)) {
    for (const [counterId, days] of Object.entries(value.notifiedMilestones)) {
      if (Array.isArray(days)) {
        if (!days.every((day) => Number.isInteger(day) && Number(day) >= 0)) return null;
        notifiedMilestones[counterId] = [...new Set(days.filter((day): day is number =>
          Number.isInteger(day) && day >= 0,
        ))];
      }
    }
  } else if (Array.isArray(value.notifiedMilestones)) {
    // Older clients stored no per-counter notification state in the cloud.
    // Ignore that legacy placeholder instead of treating it as user data.
  } else if (value.notifiedMilestones !== undefined && value.notifiedMilestones !== null) {
    return null;
  }

  return {
    counters,
    activeCounterId,
    notes,
    milestones,
    habits,
    checkIns,
    targetEvents,
    notifiedMilestones,
    themeMode: value.themeMode === 'dark' ? 'dark' : 'light',
  };
}

function itemKey(value: unknown, collection: keyof CloudPayload): string | null {
  if (collection === 'notifiedMilestones' && Number.isInteger(value)) {
    return String(value);
  }
  if (!isRecord(value)) return null;
  switch (collection) {
    case 'counters':
    case 'notes':
    case 'habits':
    case 'targetEvents':
      return typeof value.id === 'string' ? value.id : null;
    case 'milestones':
      return Number.isInteger(value.day) ? String(value.day) : null;
    case 'checkIns':
      return typeof value.habitId === 'string' && typeof value.dateStr === 'string'
        ? `${value.habitId}\u0000${value.dateStr}`
        : null;
    case 'notifiedMilestones':
      return Number.isInteger(value.day) ? String(value.day) : null;
    default:
      return null;
  }
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function timestampOf(value: unknown): number {
  if (!isRecord(value)) return 0;
  const timestamp = typeof value.updatedAt === 'string'
    ? value.updatedAt
    : typeof value.createdAt === 'string'
      ? value.createdAt
      : '';
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeArray<T>(
  base: T[] | undefined,
  local: T[] | undefined,
  remote: T[] | undefined,
  collection: keyof CloudPayload,
): T[] {
  const baseByKey = new Map((base || []).map((item) => [itemKey(item, collection), item] as const));
  const localByKey = new Map((local || []).map((item) => [itemKey(item, collection), item] as const));
  const remoteByKey = new Map((remote || []).map((item) => [itemKey(item, collection), item] as const));
  const allKeys = new Set([...baseByKey.keys(), ...localByKey.keys(), ...remoteByKey.keys()]);
  const merged: T[] = [];

  for (const key of allKeys) {
    if (!key) continue;
    const baseValue = baseByKey.get(key);
    const localValue = localByKey.get(key);
    const remoteValue = remoteByKey.get(key);
    const localChanged = !equal(localValue, baseValue);
    const remoteChanged = !equal(remoteValue, baseValue);

    let selected: T | undefined;
    if (!localChanged) selected = remoteValue;
    else if (!remoteChanged) selected = localValue;
    else if (equal(localValue, remoteValue)) selected = localValue;
    else if (baseValue === undefined) selected = remoteValue;
    else if (localValue === undefined) selected = remoteValue;
    else if (remoteValue === undefined) selected = localValue;
    else selected = timestampOf(localValue) >= timestampOf(remoteValue) ? localValue : remoteValue;

    if (selected !== undefined) merged.push(selected);
  }
  return merged;
}

function mergeRecordArrays<T>(
  base: Record<string, T[]> | undefined,
  local: Record<string, T[]> | undefined,
  remote: Record<string, T[]> | undefined,
  collection: keyof CloudPayload,
): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  const allIds = new Set([
    ...Object.keys(base || {}),
    ...Object.keys(local || {}),
    ...Object.keys(remote || {}),
  ]);
  for (const id of allIds) {
    result[id] = mergeArray(base?.[id], local?.[id], remote?.[id], collection);
  }
  return result;
}

function mergeScalar<T>(base: T | undefined, local: T, remote: T): T {
  const localChanged = !equal(local, base);
  const remoteChanged = !equal(remote, base);
  if (!localChanged) return remote;
  if (!remoteChanged || equal(local, remote)) return local;
  return base === undefined ? remote : local;
}

export function mergeCloudPayloads(
  base: CloudPayload | null,
  local: CloudPayload,
  remote: CloudPayload,
): CloudPayload {
  return {
    counters: mergeArray(base?.counters, local.counters, remote.counters, 'counters'),
    activeCounterId: mergeScalar(base?.activeCounterId, local.activeCounterId, remote.activeCounterId),
    notes: mergeRecordArrays(base?.notes, local.notes, remote.notes, 'notes'),
    milestones: mergeRecordArrays(base?.milestones, local.milestones, remote.milestones, 'milestones'),
    habits: mergeRecordArrays(base?.habits, local.habits, remote.habits, 'habits'),
    checkIns: mergeRecordArrays(base?.checkIns, local.checkIns, remote.checkIns, 'checkIns'),
    targetEvents: mergeRecordArrays(base?.targetEvents, local.targetEvents, remote.targetEvents, 'targetEvents'),
    notifiedMilestones: mergeRecordArrays(
      base?.notifiedMilestones,
      local.notifiedMilestones,
      remote.notifiedMilestones,
      'notifiedMilestones',
    ),
    themeMode: mergeScalar(base?.themeMode, local.themeMode, remote.themeMode),
  };
}
