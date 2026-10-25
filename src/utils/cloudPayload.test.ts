import assert from 'node:assert/strict';
import test from 'node:test';
import type { CloudPayload, Counter, DayNote, Habit, TargetEvent } from '../types';
import { mergeCloudPayloads, normalizeCloudPayload } from './cloudPayload';

const counter: Counter = {
  id: 'counter-1',
  title: 'Primary',
  startDate: '2026-10-13',
  createdAt: '2026-10-13T00:00:00.000Z',
};

function payload(): CloudPayload {
  return {
    counters: [counter],
    activeCounterId: counter.id,
    notes: {},
    milestones: {},
    habits: {},
    checkIns: {},
    targetEvents: {},
    notifiedMilestones: {},
    themeMode: 'dark',
  };
}

test('normalizes legacy notification history while validating calendar dates', () => {
  const normalized = normalizeCloudPayload({
    ...payload(),
    notifiedMilestones: [],
  });
  assert.deepEqual(normalized?.notifiedMilestones, {});
  assert.equal(normalizeCloudPayload({
    ...payload(),
    counters: [{ ...counter, startDate: '2026-02-30' }],
  }), null);
});

test('rejects malformed saved collections instead of silently dropping their records', () => {
  assert.equal(normalizeCloudPayload({
    ...payload(),
    notes: { [counter.id]: [{ id: 'bad-note' }] },
  }), null);
});

test('three-way merge preserves concurrent additions and chooses the changed value', () => {
  const base = payload();
  const initialNote: DayNote = {
    id: 'note-1',
    counterId: counter.id,
    dayNumber: 1,
    dateStr: '2026-10-14',
    text: 'Original',
    createdAt: '2026-10-14T10:00:00.000Z',
  };
  base.notes[counter.id] = [initialNote];

  const local = structuredClone(base);
  local.notes[counter.id] = [{
    ...initialNote,
    text: 'Edited on this device',
    createdAt: '2026-10-14T11:00:00.000Z',
  }];
  const localHabit: Habit = {
    id: 'habit-local',
    counterId: counter.id,
    name: 'Local addition',
    createdAt: '2026-10-15T10:00:00.000Z',
  };
  local.habits[counter.id] = [localHabit];

  const remote = structuredClone(base);
  const remoteEvent: TargetEvent = {
    id: 'event-remote',
    counterId: counter.id,
    title: 'Remote addition',
    targetDate: '2026-11-12',
    createdAt: '2026-10-15T12:00:00.000Z',
  };
  remote.targetEvents[counter.id] = [remoteEvent];

  const merged = mergeCloudPayloads(base, local, remote);
  assert.equal(merged.notes[counter.id][0].text, 'Edited on this device');
  assert.deepEqual(merged.habits[counter.id], [localHabit]);
  assert.deepEqual(merged.targetEvents[counter.id], [remoteEvent]);
});

test('three-way merge preserves an offline deletion when the remote item is unchanged', () => {
  const base = payload();
  const event: TargetEvent = {
    id: 'event-1',
    counterId: counter.id,
    title: 'Remove me',
    targetDate: '2026-11-12',
    createdAt: '2026-10-15T12:00:00.000Z',
  };
  base.targetEvents[counter.id] = [event];
  const local = structuredClone(base);
  local.targetEvents[counter.id] = [];
  const remote = structuredClone(base);

  assert.deepEqual(mergeCloudPayloads(base, local, remote).targetEvents[counter.id], []);
});

test('merge without a known baseline does not replace an existing remote record on conflict', () => {
  const local = payload();
  const remote = payload();
  local.notes[counter.id] = [{
    id: 'note-shared',
    counterId: counter.id,
    dayNumber: 1,
    dateStr: '2026-10-14',
    text: 'Unbased local copy',
    createdAt: '2026-10-14T10:00:00.000Z',
  }];
  remote.notes[counter.id] = [{
    id: 'note-shared',
    counterId: counter.id,
    dayNumber: 1,
    dateStr: '2026-10-14',
    text: 'Existing remote copy',
    createdAt: '2026-10-14T09:00:00.000Z',
  }];

  assert.equal(mergeCloudPayloads(null, local, remote).notes[counter.id][0].text, 'Existing remote copy');
});

test('a remote edit wins when it conflicts with an offline deletion', () => {
  const base = payload();
  const event: TargetEvent = {
    id: 'event-1',
    counterId: counter.id,
    title: 'Before',
    targetDate: '2026-11-12',
    createdAt: '2026-10-15T10:00:00.000Z',
  };
  base.targetEvents[counter.id] = [event];
  const local = structuredClone(base);
  local.targetEvents[counter.id] = [];
  const remote = structuredClone(base);
  remote.targetEvents[counter.id] = [{ ...event, title: 'Changed on the other device' }];

  assert.deepEqual(
    mergeCloudPayloads(base, local, remote).targetEvents[counter.id],
    remote.targetEvents[counter.id],
  );
});
