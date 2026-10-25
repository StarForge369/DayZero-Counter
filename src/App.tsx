import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Counter, Milestone, Habit, HabitCheckIn } from './types';
import { Header } from './components/Header';
import { Logo } from './components/Logo';
import { PrimaryHeroCounter } from './components/PrimaryHeroCounter';
import { HabitTracker } from './components/HabitTracker';
import { TargetEvents } from './components/TargetEvents';
import { CalendarMatrix } from './components/CalendarMatrix';
import { MilestonesSection } from './components/MilestonesSection';
import { DateCalculator } from './components/DateCalculator';
import { DailyJournal } from './components/DailyJournal';
import { CounterModal } from './components/CounterModal';
import { ShareCardModal } from './components/ShareCardModal';
import { BackupModal } from './components/BackupModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { MilestoneCelebrationModal } from './components/MilestoneCelebrationModal';
import {
  getCalendarDaysElapsed,
  toLocalDateString,
  toLocalTimeString,
  formatDDMMYYYY,
  playHapticSound,
  STANDARD_MILESTONES,
} from './utils/dateUtils';
import {
  getOrCreateSyncKey,
  setCustomSyncKey,
  pushDataToCloud,
  pullDataFromCloud,
  subscribeToRealTimeSync,
  savePendingSyncPayload,
  getPendingSyncPayload,
  clearPendingSyncPayload,
  CloudPayload,
} from './utils/syncService';
import {
  checkUncelebratedMilestone,
  markMilestoneNotified,
  sendNativeNotification,
} from './utils/notificationUtils';
import { Layers, RotateCcw, HardDrive, Cloud } from 'lucide-react';

// Fixed origin counter: 13-10-2026 at 1:47 P.M. (13:47:00)
const DEFAULT_INITIAL_COUNTER: Counter = {
  id: 'primary-origin-13-10-2026-1347',
  title: 'Days from 13-10-2026',
  startDate: '2026-10-13',
  startTime: '13:47:00', // 1:47 P.M.
  description: 'Origin date is 13-10-2026 at 1:47 PM (Day 0). 14-10-2026 is Day 1.',
  createdAt: '2026-10-13T13:47:00.000Z',
};

const DEFAULT_HABITS: Habit[] = [
  { id: 'h-1', counterId: 'default', name: 'Drink 2 Liters of Water', category: 'health', createdAt: new Date().toISOString() },
  { id: 'h-2', counterId: 'default', name: '30 Mins Workout or Walk', category: 'health', createdAt: new Date().toISOString() },
  { id: 'h-3', counterId: 'default', name: 'Focused Deep Work / Code', category: 'focus', createdAt: new Date().toISOString() },
  { id: 'h-4', counterId: 'default', name: 'Read 20 Mins / Learn', category: 'mind', createdAt: new Date().toISOString() },
];

export default function App() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('theme_mode');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (isDarkMode) {
        root.classList.add('dark');
        localStorage.setItem('theme_mode', 'dark');
      } else {
        root.classList.remove('dark');
        localStorage.setItem('theme_mode', 'light');
      }
    } catch (e) {
      console.error('Failed to sync theme', e);
    }
  }, [isDarkMode]);

  const handleToggleTheme = () => {
    if (soundEnabled) playHapticSound('click');
    setIsDarkMode((prev) => !prev);
  };

  // Audio feedback state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sound_enabled');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem('sound_enabled', String(next));
    } catch {}
    if (next) playHapticSound('click');
  };

  // Cloud Sync Key state
  const [syncKey, setSyncKey] = useState<string>(() => getOrCreateSyncKey());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isRealTimeConnected, setIsRealTimeConnected] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);

  // Persistent Counters: local storage is the source of truth on startup
  const [counters, setCounters] = useState<Counter[]>(() => {
    try {
      const savedV5 = localStorage.getItem('dayzero_counters_v5');
      if (savedV5) {
        const parsed = JSON.parse(savedV5);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error reading saved counters', e);
    }
    return [DEFAULT_INITIAL_COUNTER];
  });

  const [activeCounterId, setActiveCounterId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem('dayzero_active_id_v5');
      if (savedId) return savedId;
    } catch {}
    return DEFAULT_INITIAL_COUNTER.id;
  });

  const activeCounter =
    counters.find((c) => c.id === activeCounterId) || counters[0] || DEFAULT_INITIAL_COUNTER;

  // Real-Time Controlled Habits State
  const [habits, setHabits] = useState<Habit[]>(() => {
    try {
      const saved = localStorage.getItem(`habits_${activeCounter.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_HABITS.map((h) => ({ ...h, counterId: activeCounter.id }));
  });

  // Real-Time Controlled Check-ins State
  const [checkIns, setCheckIns] = useState<HabitCheckIn[]>(() => {
    try {
      const saved = localStorage.getItem(`habit_checkins_${activeCounter.id}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Reload habits/check-ins when active counter changes
  useEffect(() => {
    try {
      const savedH = localStorage.getItem(`habits_${activeCounter.id}`);
      if (savedH) {
        setHabits(JSON.parse(savedH));
      } else {
        setHabits(DEFAULT_HABITS.map((h) => ({ ...h, counterId: activeCounter.id })));
      }
      const savedC = localStorage.getItem(`habit_checkins_${activeCounter.id}`);
      if (savedC) {
        setCheckIns(JSON.parse(savedC));
      } else {
        setCheckIns([]);
      }
    } catch {}
  }, [activeCounter.id]);

  // Persist counters locally
  useEffect(() => {
    try {
      localStorage.setItem('dayzero_counters_v5', JSON.stringify(counters));
    } catch (e) {
      console.error('Failed to persist counters', e);
    }
  }, [counters]);

  useEffect(() => {
    try {
      localStorage.setItem('dayzero_active_id_v5', activeCounterId);
    } catch (e) {
      console.error('Failed to persist active counter ID', e);
    }
  }, [activeCounterId]);

  // Modals & Tabs
  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (typeof window === 'undefined') return 'counter';
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    const validTabs = ['counter', 'habits', 'countdowns', 'calendar', 'milestones', 'calculator', 'notes'];
    return validTabs.includes(requestedTab || '') ? requestedTab! : 'counter';
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
  const [counterToEdit, setCounterToEdit] = useState<Counter | null>(null);

  // Milestone Celebration alert state
  const [celebratingMilestone, setCelebratingMilestone] = useState<Milestone | null>(null);

  // Journal pre-selection from calendar
  const [journalInitialDay, setJournalInitialDay] = useState<number | undefined>(undefined);
  const [journalInitialDateStr, setJournalInitialDateStr] = useState<string | undefined>(undefined);

  // Keep callbacks stable so applying cloud snapshots does not restart SSE or polling.
  const latestSyncStateRef = useRef({
    counters,
    habits,
    checkIns,
    activeCounterId,
    isDarkMode,
    syncKey,
  });
  const pendingCloudPushesRef = useRef(0);
  latestSyncStateRef.current = {
    counters,
    habits,
    checkIns,
    activeCounterId,
    isDarkMode,
    syncKey,
  };

  useEffect(() => {
    setLastSyncedAt(undefined);
    setIsRealTimeConnected(false);
  }, [syncKey]);

  // Immediate Cloud Push Function: scans all counters to preserve entire dataset
  const pushFullPayloadToCloud = useCallback(
    async (
      overrideCounters?: Counter[],
      overrideHabits?: Habit[],
      overrideCheckIns?: HabitCheckIn[],
      overrideActiveId?: string,
      overrideSyncKey?: string
    ): Promise<boolean> => {
      const current = latestSyncStateRef.current;
      const targetSyncKey = (overrideSyncKey || current.syncKey).toUpperCase();
      const targetCounters = Array.isArray(overrideCounters)
        ? overrideCounters
        : Array.isArray(current.counters) && current.counters.length > 0
        ? current.counters
        : [DEFAULT_INITIAL_COUNTER];
      const targetHabits = Array.isArray(overrideHabits)
        ? overrideHabits
        : Array.isArray(current.habits)
        ? current.habits
        : [];
      const targetCheckIns = Array.isArray(overrideCheckIns)
        ? overrideCheckIns
        : Array.isArray(current.checkIns)
        ? current.checkIns
        : [];
      const targetActiveId =
        (typeof overrideActiveId === 'string' && overrideActiveId)
          ? overrideActiveId
          : current.activeCounterId || targetCounters[0]?.id || '';

      const payload: CloudPayload = {
        counters: targetCounters,
        activeCounterId: targetActiveId,
        notes: {},
        milestones: {},
        habits: {},
        checkIns: {},
        targetEvents: {},
        notifiedMilestones: [],
        themeMode: current.isDarkMode ? 'dark' : 'light',
      };

      // Scan all counters to gather complete dataset
      targetCounters.forEach((counter) => {
        try {
          const habitsForCounter = localStorage.getItem(`habits_${counter.id}`);
          if (habitsForCounter) payload.habits[counter.id] = JSON.parse(habitsForCounter);
          const checkInsForCounter = localStorage.getItem(`habit_checkins_${counter.id}`);
          if (checkInsForCounter) payload.checkIns[counter.id] = JSON.parse(checkInsForCounter);
          const notes = localStorage.getItem(`notes_${counter.id}`);
          if (notes) payload.notes[counter.id] = JSON.parse(notes);
          const milestones = localStorage.getItem(`milestones_${counter.id}`);
          if (milestones) payload.milestones[counter.id] = JSON.parse(milestones);
          const events = localStorage.getItem(`target_events_${counter.id}`);
          if (events) payload.targetEvents[counter.id] = JSON.parse(events);
        } catch {}
      });

      // Preserve in-flight edits to the active counter.
      payload.habits[targetActiveId] = targetHabits;
      payload.checkIns[targetActiveId] = targetCheckIns;

      // Keep a local outbox so a reload during a network outage cannot cause
      // the next cloud pull to replace edits that have not reached the server.
      const pendingRaw = savePendingSyncPayload(targetSyncKey, payload);
      setIsSyncing(true);
      pendingCloudPushesRef.current += 1;
      try {
        const res = await pushDataToCloud(targetSyncKey, payload);
        if (res.success) {
          if (pendingRaw) clearPendingSyncPayload(targetSyncKey, pendingRaw);
          if (latestSyncStateRef.current.syncKey === targetSyncKey) {
            setIsRealTimeConnected(true);
            if (res.updatedAt) setLastSyncedAt(res.updatedAt);
          }
          return true;
        }
        if (latestSyncStateRef.current.syncKey === targetSyncKey) setIsRealTimeConnected(false);
        return false;
      } finally {
        pendingCloudPushesRef.current = Math.max(0, pendingCloudPushesRef.current - 1);
        setIsSyncing(pendingCloudPushesRef.current > 0);
      }
    },
    []
  );

  // Apply incoming cloud data helper with CLIENT-FIRST PERSISTENCE & HEALING
  const applyCloudData = useCallback(
    (cloudData: CloudPayload, updatedAt?: string) => {
      if (!cloudData) return;

      const current = latestSyncStateRef.current;
      const currentActiveCounter =
        current.counters.find((counter) => counter.id === current.activeCounterId) ||
        current.counters[0];

      // Guard: Never let an empty cloud payload wipe non-empty local device data.
      const hasLocalCounters = current.counters.length > 0;
      const isCloudEmpty = !Array.isArray(cloudData.counters) || cloudData.counters.length === 0;
      if (isCloudEmpty) {
        if (hasLocalCounters) pushFullPayloadToCloud();
        return;
      }

      // Avoid replacing state with an equivalent snapshot; this keeps subscriptions stable.
      const serializedCounters = JSON.stringify(cloudData.counters);
      if (localStorage.getItem('dayzero_counters_v5') !== serializedCounters) {
        localStorage.setItem('dayzero_counters_v5', serializedCounters);
      }
      setCounters((previous) =>
        JSON.stringify(previous) === serializedCounters ? previous : cloudData.counters
      );

      if (cloudData.activeCounterId) {
        setActiveCounterId((previous) =>
          previous === cloudData.activeCounterId ? previous : cloudData.activeCounterId
        );
        localStorage.setItem('dayzero_active_id_v5', cloudData.activeCounterId);
      }

      const counterId =
        cloudData.activeCounterId || current.activeCounterId || currentActiveCounter?.id || '';

      if (cloudData.habits && typeof cloudData.habits === 'object') {
        Object.keys(cloudData.habits).forEach((id) => {
          const serialized = JSON.stringify(cloudData.habits[id]);
          if (localStorage.getItem(`habits_${id}`) !== serialized) {
            localStorage.setItem(`habits_${id}`, serialized);
          }
        });
        if (cloudData.habits[counterId]) {
          setHabits((previous) =>
            JSON.stringify(previous) === JSON.stringify(cloudData.habits[counterId])
              ? previous
              : cloudData.habits[counterId]
          );
        }
      }

      if (cloudData.checkIns && typeof cloudData.checkIns === 'object') {
        Object.keys(cloudData.checkIns).forEach((id) => {
          const serialized = JSON.stringify(cloudData.checkIns[id]);
          if (localStorage.getItem(`habit_checkins_${id}`) !== serialized) {
            localStorage.setItem(`habit_checkins_${id}`, serialized);
          }
        });
        if (cloudData.checkIns[counterId]) {
          setCheckIns((previous) =>
            JSON.stringify(previous) === JSON.stringify(cloudData.checkIns[counterId])
              ? previous
              : cloudData.checkIns[counterId]
          );
        }
      }

      if (cloudData.notes && typeof cloudData.notes === 'object') {
        Object.keys(cloudData.notes).forEach((id) => {
          const serialized = JSON.stringify(cloudData.notes[id]);
          if (localStorage.getItem(`notes_${id}`) !== serialized) {
            localStorage.setItem(`notes_${id}`, serialized);
          }
        });
      }

      if (cloudData.milestones && typeof cloudData.milestones === 'object') {
        Object.keys(cloudData.milestones).forEach((id) => {
          const serialized = JSON.stringify(cloudData.milestones[id]);
          if (localStorage.getItem(`milestones_${id}`) !== serialized) {
            localStorage.setItem(`milestones_${id}`, serialized);
          }
        });
      }

      if (cloudData.targetEvents && typeof cloudData.targetEvents === 'object') {
        Object.keys(cloudData.targetEvents).forEach((id) => {
          const serialized = JSON.stringify(cloudData.targetEvents[id]);
          if (localStorage.getItem(`target_events_${id}`) !== serialized) {
            localStorage.setItem(`target_events_${id}`, serialized);
          }
        });
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dayzero_data_synced'));
      }
      if (updatedAt) setLastSyncedAt(updatedAt);
    },
    []
  );

  // REAL-TIME SSE SUBSCRIPTION: Broadcasts changes across devices in milliseconds!
  useEffect(() => {
    const unsubscribe = subscribeToRealTimeSync(
      syncKey,
      (cloudData, updatedAt) => {
        if (getPendingSyncPayload(syncKey)) return;
        applyCloudData(cloudData, updatedAt);
      },
      (connected) => {
        // An SSE error alone does not prove that the HTTP sync API is offline.
        if (connected) setIsRealTimeConnected(true);
      }
    );

    return () => unsubscribe();
  }, [syncKey, applyCloudData]);

  // Periodic poll + Focus/Visibility refresh (e.g. when devices wake or unlock)
  useEffect(() => {
    let disposed = false;
    let isPulling = false;

    const refreshFromCloud = async () => {
      if (disposed || isPulling) return;
      isPulling = true;
      try {
        if (getPendingSyncPayload(syncKey)) {
          await pushFullPayloadToCloud();
          return;
        }
        const res = await pullDataFromCloud(syncKey);
        if (disposed) return;
        if (res.success && res.data) {
          setIsRealTimeConnected(true);
          applyCloudData(res.data, res.updatedAt);
        } else if (res.notFound && latestSyncStateRef.current.counters.length > 0) {
          // A missing cloud entry is safe to heal from this device's local data.
          pushFullPayloadToCloud();
        } else if (!res.success) {
          setIsRealTimeConnected(false);
        } else {
          setIsRealTimeConnected(true);
        }
      } finally {
        isPulling = false;
      }
    };

    // Initial pull
    refreshFromCloud();

    // Poll less often as a fallback; SSE handles normal real-time updates.
    const interval = setInterval(refreshFromCloud, 30000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshFromCloud();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      disposed = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [syncKey, applyCloudData, pushFullPayloadToCloud]);

  const handleConnectSyncKey = useCallback(async (
    requestedKey: string
  ): Promise<'loaded' | 'created' | 'failed'> => {
    const targetKey = requestedKey.trim().toUpperCase();
    const pending = getPendingSyncPayload(targetKey);

    // If this browser already has unsent edits for this key, preserve and send
    // those before considering a server copy.
    if (pending) {
      const saved = await pushDataToCloud(targetKey, pending.payload);
      if (!saved.success) return 'failed';
      clearPendingSyncPayload(targetKey, pending.raw);
      setCustomSyncKey(targetKey);
      setSyncKey(targetKey);
      applyCloudData(pending.payload, saved.updatedAt);
      setIsRealTimeConnected(true);
      if (saved.updatedAt) setLastSyncedAt(saved.updatedAt);
      return 'created';
    }

    const result = await pullDataFromCloud(targetKey);
    if (result.success && result.data) {
      setCustomSyncKey(targetKey);
      setSyncKey(targetKey);
      applyCloudData(result.data, result.updatedAt);
      setIsRealTimeConnected(true);
      return 'loaded';
    }

    if (result.notFound) {
      setCustomSyncKey(targetKey);
      setSyncKey(targetKey);
      setLastSyncedAt(undefined);
      const saved = await pushFullPayloadToCloud(undefined, undefined, undefined, undefined, targetKey);
      return saved ? 'created' : 'failed';
    }

    return 'failed';
  }, [applyCloudData, pushFullPayloadToCloud]);

  // Listen for local mutations (notes, milestones, countdowns) and push immediately
  useEffect(() => {
    const handleMutation = () => {
      pushFullPayloadToCloud();
    };
    window.addEventListener('dayzero_local_mutated', handleMutation);
    return () => window.removeEventListener('dayzero_local_mutated', handleMutation);
  }, [pushFullPayloadToCloud]);

  // Real-Time Habit Actions
  const handleToggleHabit = (habitId: string, dateStr: string, dayNumber: number) => {
    const isCompleted = checkIns.some(
      (c) => c.habitId === habitId && c.dateStr === dateStr
    );

    let updatedCheckIns: HabitCheckIn[];
    if (isCompleted) {
      if (soundEnabled) playHapticSound('click');
      updatedCheckIns = checkIns.filter(
        (c) => !(c.habitId === habitId && c.dateStr === dateStr)
      );
    } else {
      updatedCheckIns = [
        ...checkIns,
        {
          habitId,
          dateStr,
          dayNumber,
        },
      ];

      const remaining = habits.filter(
        (h) => h.id !== habitId && !checkIns.some((c) => c.habitId === h.id && c.dateStr === dateStr)
      );
      if (remaining.length === 0) {
        if (soundEnabled) playHapticSound('celebrate');
      } else {
        if (soundEnabled) playHapticSound('click');
      }
    }

    setCheckIns(updatedCheckIns);
    localStorage.setItem(`habit_checkins_${activeCounter.id}`, JSON.stringify(updatedCheckIns));

    // INSTANT REAL-TIME CLOUD PUSH!
    pushFullPayloadToCloud(counters, habits, updatedCheckIns, activeCounter.id);
  };

  const handleAddHabit = (name: string, category: 'health' | 'focus' | 'mind' | 'routine') => {
    if (soundEnabled) playHapticSound('click');
    const newHabit: Habit = {
      id: `h-${Date.now()}`,
      counterId: activeCounter.id,
      name,
      category,
      createdAt: new Date().toISOString(),
    };
    const updatedHabits = [...habits, newHabit];
    setHabits(updatedHabits);
    localStorage.setItem(`habits_${activeCounter.id}`, JSON.stringify(updatedHabits));

    // INSTANT REAL-TIME CLOUD PUSH!
    pushFullPayloadToCloud(counters, updatedHabits, checkIns, activeCounter.id);
  };

  const handleDeleteHabit = (habitId: string) => {
    if (soundEnabled) playHapticSound('click');
    const updatedHabits = habits.filter((h) => h.id !== habitId);
    const updatedCheckIns = checkIns.filter((c) => c.habitId !== habitId);

    setHabits(updatedHabits);
    setCheckIns(updatedCheckIns);
    localStorage.setItem(`habits_${activeCounter.id}`, JSON.stringify(updatedHabits));
    localStorage.setItem(`habit_checkins_${activeCounter.id}`, JSON.stringify(updatedCheckIns));

    // INSTANT REAL-TIME CLOUD PUSH!
    pushFullPayloadToCloud(counters, updatedHabits, updatedCheckIns, activeCounter.id);
  };

  // Milestone Notification Check (Standard & Custom e.g. 15 days, 100 days, 1 year)
  useEffect(() => {
    const currentDay = getCalendarDaysElapsed(activeCounter.startDate, new Date());
    let customMilestones: Milestone[] = [];
    try {
      const saved = localStorage.getItem(`milestones_${activeCounter.id}`);
      if (saved) customMilestones = JSON.parse(saved);
    } catch {}

    const allMilestones: Milestone[] = [
      ...STANDARD_MILESTONES,
      ...customMilestones,
    ];

    const uncelebrated = checkUncelebratedMilestone(activeCounter.id, currentDay, allMilestones);
    if (uncelebrated) {
      setCelebratingMilestone(uncelebrated);
      markMilestoneNotified(activeCounter.id, uncelebrated.day);
      if (soundEnabled) playHapticSound('celebrate');
      sendNativeNotification(
        `🏆 Milestone Reached: Day ${uncelebrated.day}!`,
        `${uncelebrated.label} reached on Day Zero! Congratulations on maintaining your streak.`
      );
    }
  }, [activeCounter.id, activeCounter.startDate, soundEnabled]);

  const handleOpenNewCounter = () => {
    if (soundEnabled) playHapticSound('click');
    setCounterToEdit(null);
    setIsModalOpen(true);
  };

  const handleEditActiveCounter = () => {
    setCounterToEdit(activeCounter);
    setIsModalOpen(true);
  };

  const handleSaveCounter = (counter: Counter) => {
    const exists = counters.some((c) => c.id === counter.id);
    let updated: Counter[];
    if (exists) {
      updated = counters.map((c) => (c.id === counter.id ? counter : c));
    } else {
      updated = [...counters, counter];
    }
    setCounters(updated);
    setActiveCounterId(counter.id);
    pushFullPayloadToCloud(updated, habits, checkIns, counter.id);
  };

  const handleResetToToday = () => {
    // Reset to the requested origin: 13-10-2026 at 1:47 PM
    const updated = counters.map((c) =>
      c.id === activeCounter.id
        ? {
            ...c,
            startDate: '2026-10-13',
            startTime: '13:47:00',
            title: 'Days from 13-10-2026',
            description: 'Origin date is 13-10-2026 at 1:47 PM (Day 0). 14-10-2026 is Day 1.',
          }
        : c
    );
    setCounters(updated);
    pushFullPayloadToCloud(updated, habits, checkIns, activeCounter.id);
  };

  // Safe and accurate data restoration from backup (all versions supported)
  const handleDataRestored = (restored: {
    counters: Counter[];
    activeCounterId: string;
    rawStorage?: Record<string, any>;
  }) => {
    try {
      const newCounters =
        restored.counters && restored.counters.length > 0 ? restored.counters : counters;
      const newActiveId = restored.activeCounterId || newCounters[0]?.id || activeCounterId;

      // 1. Update counters & active ID synchronously
      setCounters(newCounters);
      setActiveCounterId(newActiveId);

      // 2. Hydrate active habits
      let newHabits = DEFAULT_HABITS.map((h) => ({ ...h, counterId: newActiveId }));
      const savedHabits = localStorage.getItem(`habits_${newActiveId}`);
      if (savedHabits) {
        try {
          newHabits = JSON.parse(savedHabits);
        } catch {}
      }
      setHabits(newHabits);

      // 3. Hydrate active check-ins
      let newCheckIns: HabitCheckIn[] = [];
      const savedCheckIns = localStorage.getItem(`habit_checkins_${newActiveId}`);
      if (savedCheckIns) {
        try {
          newCheckIns = JSON.parse(savedCheckIns);
        } catch {}
      }
      setCheckIns(newCheckIns);

      // 4. Notify child views (Journal, Milestones, Countdowns)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dayzero_data_synced'));
      }

      // 5. Cloud Push: push the restored payload with the exact restored active counter ID
      pushFullPayloadToCloud(newCounters, newHabits, newCheckIns, newActiveId);
    } catch (e) {
      console.error('Error applying restored data:', e);
    }
  };

  const handleSelectDayForNote = (dayNumber: number, dateStr: string) => {
    setJournalInitialDay(dayNumber);
    setJournalInitialDateStr(dateStr);
    setCurrentTab('notes');
  };

  const todayDayNumber = getCalendarDaysElapsed(activeCounter.startDate, new Date());

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col transition-colors selection:bg-stone-900 selection:text-white dark:selection:bg-white dark:selection:text-stone-900">
      {/* 3-zone Header with Provided Logo, Navigation Tabs & Real-Time Cloud Sync */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenNewCounter={handleOpenNewCounter}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenCloudSyncModal={() => setIsCloudSyncModalOpen(true)}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
      />

      {/* Main Body - responsive padding with safe mobile clearance */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 pb-20 lg:pb-8">
        {/* Real-time sync status indicator banner */}
        <div className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-stone-100/80 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 text-[11px] font-mono text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isRealTimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>
              {isRealTimeConnected ? 'Cloud Sync Available' : 'Cloud Sync Unavailable'}{' '}
              ({syncKey})
            </span>
          </div>
          <button
            onClick={() => setIsCloudSyncModalOpen(true)}
            className="text-stone-700 dark:text-stone-300 hover:underline cursor-pointer flex items-center gap-1 font-medium"
          >
            <Cloud className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>
              {isSyncing
                ? 'Syncing...'
                : lastSyncedAt
                ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString()}`
                : 'Sync Code'}
            </span>
          </button>
        </div>

        {/* Counter Switcher (when multiple counters exist) */}
        {counters.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 shrink-0 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              Counters:
            </span>
            {counters.map((c) => {
              const isActive = c.id === activeCounter.id;
              const days = getCalendarDaysElapsed(c.startDate, new Date());
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    if (soundEnabled) playHapticSound('click');
                    setActiveCounterId(c.id);
                  }}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                      : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800 hover:border-stone-300'
                  }`}
                >
                  <span>{c.title}</span>
                  <span className="font-mono text-[11px] opacity-80">
                    Day {days}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Tab content rendering */}
        {currentTab === 'counter' && (
          <PrimaryHeroCounter
            key={activeCounter.id}
            counter={activeCounter}
            onEdit={handleEditActiveCounter}
            onResetToToday={handleResetToToday}
            onViewMilestones={() => setCurrentTab('milestones')}
            onViewCalendar={() => setCurrentTab('calendar')}
            onAddNoteForToday={() => {
              setJournalInitialDay(todayDayNumber);
              setCurrentTab('notes');
            }}
            onOpenShareModal={() => setIsShareModalOpen(true)}
            soundEnabled={soundEnabled}
          />
        )}

        {currentTab === 'habits' && (
          <HabitTracker
            key={activeCounter.id}
            counter={activeCounter}
            habits={habits}
            checkIns={checkIns}
            onToggleHabit={handleToggleHabit}
            onAddHabit={handleAddHabit}
            onDeleteHabit={handleDeleteHabit}
            soundEnabled={soundEnabled}
          />
        )}

        {currentTab === 'countdowns' && (
          <TargetEvents key={activeCounter.id} counter={activeCounter} soundEnabled={soundEnabled} />
        )}

        {currentTab === 'calendar' && (
          <CalendarMatrix
            key={activeCounter.id}
            counter={activeCounter}
            onSelectDayForNote={handleSelectDayForNote}
            soundEnabled={soundEnabled}
          />
        )}

        {currentTab === 'milestones' && (
          <MilestonesSection key={activeCounter.id} counter={activeCounter} />
        )}

        {currentTab === 'calculator' && (
          <DateCalculator key={activeCounter.id} counter={activeCounter} soundEnabled={soundEnabled} />
        )}

        {currentTab === 'notes' && (
          <DailyJournal
            key={activeCounter.id}
            counter={activeCounter}
            initialDay={journalInitialDay}
            initialDateStr={journalInitialDateStr}
            soundEnabled={soundEnabled}
          />
        )}
      </main>

      {/* Clean Footer with Provided Logo, Cloud Sync & Backup Link */}
      <footer className="border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 py-6 text-xs text-stone-500 dark:text-stone-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <Logo size="sm" showText={false} />
            <span className="font-semibold text-stone-900 dark:text-stone-100">
              Day Zero
            </span>
            <span aria-hidden="true">·</span>
            <span>Origin: 13-10-2026 at 1:47 PM (Day 0)</span>
            <span aria-hidden="true">·</span>
            <span>Next Day = Day 1</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => setIsCloudSyncModalOpen(true)}
              className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Real-Time Sync ({syncKey})</span>
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer flex items-center gap-1 text-stone-600 dark:text-stone-400"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Backup</span>
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={handleResetToToday}
              className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer flex items-center gap-1 text-stone-600 dark:text-stone-400"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Origin</span>
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={handleOpenNewCounter}
              className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
            >
              + New Counter
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CounterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        counterToEdit={counterToEdit}
        onSave={handleSaveCounter}
        soundEnabled={soundEnabled}
      />

      <ShareCardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        counter={activeCounter}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onDataRestored={handleDataRestored}
        soundEnabled={soundEnabled}
      />

      <CloudSyncModal
        isOpen={isCloudSyncModalOpen}
        onClose={() => setIsCloudSyncModalOpen(false)}
        syncKey={syncKey}
        onConnectSyncKey={handleConnectSyncKey}
        onTriggerSyncNow={async () => { await pushFullPayloadToCloud(); }}
        lastSyncedAt={lastSyncedAt}
        isConnected={isRealTimeConnected}
        isSyncing={isSyncing}
        soundEnabled={soundEnabled}
      />

      <MilestoneCelebrationModal
        milestone={celebratingMilestone}
        counter={activeCounter}
        onClose={() => setCelebratingMilestone(null)}
        onShare={() => {
          setCelebratingMilestone(null);
          setIsShareModalOpen(true);
        }}
        soundEnabled={soundEnabled}
      />
    </div>
  );
}

