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
  pushDataToCloud,
  pullDataFromCloud,
  subscribeToRealTimeSync,
  CANONICAL_SYNC_KEY,
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

  // Cloud Sync Key state (defaults to canonical key so laptop & mobile bridge automatically)
  const [syncKey, setSyncKey] = useState<string>(() => getOrCreateSyncKey());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isRealTimeConnected, setIsRealTimeConnected] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);
  const hasInitialPullCompleted = useRef<boolean>(false);

  // Persistent Counters
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
      if (savedH) setHabits(JSON.parse(savedH));
      const savedC = localStorage.getItem(`habit_checkins_${activeCounter.id}`);
      if (savedC) setCheckIns(JSON.parse(savedC));
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
  const [currentTab, setCurrentTab] = useState<string>('counter');
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

  // Immediate Cloud Push Function
  const pushFullPayloadToCloud = useCallback(
    async (
      overrideCounters = counters,
      overrideHabits = habits,
      overrideCheckIns = checkIns
    ) => {
      setIsSyncing(true);
      const payload: CloudPayload = {
        counters: overrideCounters,
        activeCounterId,
        notes: {},
        milestones: {},
        habits: { [activeCounter.id]: overrideHabits },
        checkIns: { [activeCounter.id]: overrideCheckIns },
        targetEvents: {},
        notifiedMilestones: [],
        themeMode: isDarkMode ? 'dark' : 'light',
      };

      try {
        const notes = localStorage.getItem(`notes_${activeCounter.id}`);
        if (notes) payload.notes[activeCounter.id] = JSON.parse(notes);
        const ms = localStorage.getItem(`milestones_${activeCounter.id}`);
        if (ms) payload.milestones[activeCounter.id] = JSON.parse(ms);
        const ev = localStorage.getItem(`target_events_${activeCounter.id}`);
        if (ev) payload.targetEvents[activeCounter.id] = JSON.parse(ev);
      } catch {}

      const res = await pushDataToCloud(syncKey, payload);
      setIsSyncing(false);
      if (res.success && res.updatedAt) {
        setLastSyncedAt(res.updatedAt);
      }
    },
    [counters, activeCounterId, activeCounter.id, habits, checkIns, isDarkMode, syncKey]
  );

  // Apply incoming cloud data helper
  const applyCloudData = useCallback(
    (cloudData: CloudPayload, updatedAt?: string) => {
      if (Array.isArray(cloudData.counters) && cloudData.counters.length > 0) {
        setCounters(cloudData.counters);
        localStorage.setItem('dayzero_counters_v5', JSON.stringify(cloudData.counters));
      }
      if (cloudData.activeCounterId) {
        setActiveCounterId(cloudData.activeCounterId);
        localStorage.setItem('dayzero_active_id_v5', cloudData.activeCounterId);
      }

      const cId = cloudData.activeCounterId || activeCounter.id;

      if (cloudData.habits && cloudData.habits[cId]) {
        setHabits(cloudData.habits[cId]);
        localStorage.setItem(`habits_${cId}`, JSON.stringify(cloudData.habits[cId]));
      }

      if (cloudData.checkIns && cloudData.checkIns[cId]) {
        setCheckIns(cloudData.checkIns[cId]);
        localStorage.setItem(`habit_checkins_${cId}`, JSON.stringify(cloudData.checkIns[cId]));
      }

      if (cloudData.notes) {
        Object.keys(cloudData.notes).forEach((cid) => {
          localStorage.setItem(`notes_${cid}`, JSON.stringify(cloudData.notes[cid]));
        });
      }

      if (cloudData.milestones) {
        Object.keys(cloudData.milestones).forEach((cid) => {
          localStorage.setItem(`milestones_${cid}`, JSON.stringify(cloudData.milestones[cid]));
        });
      }

      if (cloudData.targetEvents) {
        Object.keys(cloudData.targetEvents).forEach((cid) => {
          localStorage.setItem(`target_events_${cid}`, JSON.stringify(cloudData.targetEvents[cid]));
        });
      }

      // Notify all child components to re-read updated storage immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dayzero_data_synced'));
      }

      if (updatedAt) setLastSyncedAt(updatedAt);
    },
    [activeCounter.id]
  );

  // REAL-TIME SSE SUBSCRIPTION: Broadcasts changes across devices within milliseconds!
  useEffect(() => {
    const unsubscribe = subscribeToRealTimeSync(
      syncKey,
      (cloudData, updatedAt) => {
        applyCloudData(cloudData, updatedAt);
      },
      (connected) => {
        setIsRealTimeConnected(connected);
      }
    );

    return () => unsubscribe();
  }, [syncKey, applyCloudData]);

  // Periodic poll + Focus/Visibility refresh (e.g. when laptop powers on or opens browser)
  useEffect(() => {
    const refreshFromCloud = async () => {
      const res = await pullDataFromCloud(syncKey);
      if (res.success && res.data) {
        applyCloudData(res.data, res.updatedAt);
      }
      hasInitialPullCompleted.current = true;
    };

    // Initial pull
    refreshFromCloud();

    // 5-second polling safeguard
    const interval = setInterval(refreshFromCloud, 5000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshFromCloud();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [syncKey, applyCloudData]);

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
    pushFullPayloadToCloud(counters, habits, updatedCheckIns);
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
    pushFullPayloadToCloud(counters, updatedHabits, checkIns);
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
    pushFullPayloadToCloud(counters, updatedHabits, updatedCheckIns);
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
    pushFullPayloadToCloud(updated);
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
    pushFullPayloadToCloud(updated);
  };

  // Safe and accurate data restoration from backup
  const handleDataRestored = (restoredData?: Record<string, any>) => {
    try {
      // 1. Reload counters
      const savedCounters = localStorage.getItem('dayzero_counters_v5');
      let newCounters: Counter[] = counters;
      if (savedCounters) {
        const parsed = JSON.parse(savedCounters);
        if (Array.isArray(parsed) && parsed.length > 0) {
          newCounters = parsed;
          setCounters(parsed);
        }
      }

      // 2. Reload active counter ID
      const savedActiveId =
        localStorage.getItem('dayzero_active_id_v5') ||
        newCounters[0]?.id ||
        activeCounterId;
      setActiveCounterId(savedActiveId);

      // 3. Reload habits for active counter
      const savedHabits = localStorage.getItem(`habits_${savedActiveId}`);
      let newHabits = habits;
      if (savedHabits) {
        newHabits = JSON.parse(savedHabits);
        setHabits(newHabits);
      }

      // 4. Reload checkIns for active counter
      const savedCheckIns = localStorage.getItem(`habit_checkins_${savedActiveId}`);
      let newCheckIns = checkIns;
      if (savedCheckIns) {
        newCheckIns = JSON.parse(savedCheckIns);
        setCheckIns(newCheckIns);
      }

      // 5. Notify all child components to refresh immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dayzero_data_synced'));
      }

      // 6. Push the newly restored data to cloud so other devices immediately sync to the backup!
      pushFullPayloadToCloud(newCounters, newHabits, newCheckIns);
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
      {/* 3-zone Header with Minimal Logo, Navigation Tabs & Real-Time Cloud Sync */}
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
            <span className={`w-2 h-2 rounded-full ${isRealTimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>
              {isRealTimeConnected ? 'Cross-Platform Sync Active' : 'Connecting to Cloud...'} ({syncKey})
            </span>
          </div>
          <button
            onClick={() => setIsCloudSyncModalOpen(true)}
            className="text-stone-700 dark:text-stone-300 hover:underline cursor-pointer flex items-center gap-1 font-medium"
          >
            <Cloud className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>{isSyncing ? 'Syncing...' : lastSyncedAt ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Sync Code'}</span>
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
          <TargetEvents counter={activeCounter} soundEnabled={soundEnabled} />
        )}

        {currentTab === 'calendar' && (
          <CalendarMatrix
            counter={activeCounter}
            onSelectDayForNote={handleSelectDayForNote}
            soundEnabled={soundEnabled}
          />
        )}

        {currentTab === 'milestones' && (
          <MilestonesSection counter={activeCounter} />
        )}

        {currentTab === 'calculator' && (
          <DateCalculator counter={activeCounter} soundEnabled={soundEnabled} />
        )}

        {currentTab === 'notes' && (
          <DailyJournal
            counter={activeCounter}
            initialDay={journalInitialDay}
            initialDateStr={journalInitialDateStr}
            soundEnabled={soundEnabled}
          />
        )}
      </main>

      {/* Clean Footer with Minimal Logo, Cloud Sync & Backup Link */}
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
              <RotateCcw className="w-3 h-3" />
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
        onSyncKeyChange={(newKey) => setSyncKey(newKey)}
        onTriggerSyncNow={pushFullPayloadToCloud}
        lastSyncedAt={lastSyncedAt}
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
