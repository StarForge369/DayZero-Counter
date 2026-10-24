import React, { useState, useEffect } from 'react';
import { Counter, TargetEvent } from '../types';
import {
  getCalendarDaysElapsed,
  getDateForDayNumber,
  formatReadableDate,
  formatDDMMYYYY,
  formatFullDate,
  toLocalDateString,
  playHapticSound,
} from '../utils/dateUtils';
import {
  Timer,
  Plus,
  Trash2,
  Calendar,
  Hourglass,
  Clock,
  Sparkles,
} from 'lucide-react';
import { notifyLocalStateChanged } from '../utils/syncService';

interface TargetEventsProps {
  counter: Counter;
  soundEnabled?: boolean;
}

const DEFAULT_TARGET_EVENTS: TargetEvent[] = [
  {
    id: 'evt-1',
    counterId: 'default',
    title: '30-Day Checkpoint',
    targetDate: '2026-11-12',
    category: 'Milestone',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'evt-2',
    counterId: 'default',
    title: 'End of Year / New Year Eve',
    targetDate: '2026-12-31',
    category: 'Celebration',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'evt-3',
    counterId: 'default',
    title: '100 Days Club Target',
    targetDate: '2027-01-21',
    category: 'Achievement',
    createdAt: new Date().toISOString(),
  },
];

export const TargetEvents: React.FC<TargetEventsProps> = ({
  counter,
  soundEnabled = true,
}) => {
  const [events, setEvents] = useState<TargetEvent[]>(() => {
    try {
      const saved = localStorage.getItem(`target_events_${counter.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_TARGET_EVENTS.map((e) => ({ ...e, counterId: counter.id }));
  });

  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventCategory, setNewEventCategory] = useState('Goal');
  const [showAddForm, setShowAddForm] = useState(false);

  // Re-render tick every second for live countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const reload = () => {
      try {
        const saved = localStorage.getItem(`target_events_${counter.id}`);
        if (saved) setEvents(JSON.parse(saved));
      } catch {}
    };
    reload();
    window.addEventListener('dayzero_data_synced', reload);
    return () => window.removeEventListener('dayzero_data_synced', reload);
  }, [counter.id]);

  useEffect(() => {
    try {
      localStorage.setItem(`target_events_${counter.id}`, JSON.stringify(events));
    } catch {}
  }, [events, counter.id]);

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventDate) return;

    if (soundEnabled) playHapticSound('click');
    const newEvt: TargetEvent = {
      id: `evt-${Date.now()}`,
      counterId: counter.id,
      title: newEventTitle.trim(),
      targetDate: newEventDate,
      category: newEventCategory,
      createdAt: new Date().toISOString(),
    };
    const updated = [...events, newEvt];
    setEvents(updated);
    localStorage.setItem(`target_events_${counter.id}`, JSON.stringify(updated));
    notifyLocalStateChanged();
    setNewEventTitle('');
    setNewEventDate('');
    setShowAddForm(false);
  };

  const handleDeleteEvent = (id: string) => {
    if (soundEnabled) playHapticSound('click');
    const updated = events.filter((e) => e.id !== id);
    setEvents(updated);
    localStorage.setItem(`target_events_${counter.id}`, JSON.stringify(updated));
    notifyLocalStateChanged();
  };

  const currentDay = getCalendarDaysElapsed(counter.startDate, new Date());
  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <Timer className="w-5 h-5 text-stone-700 dark:text-stone-300" />
            <span>Target Events & Future Countdowns</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Count down days and exact time until key future dates and deadlines.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all self-start sm:self-auto cursor-pointer shadow-xs active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Target Countdown</span>
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddEvent}
          className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center gap-3 animate-in fade-in shadow-xs"
        >
          <div className="w-full sm:flex-1">
            <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
              Event Title
            </label>
            <input
              type="text"
              placeholder="e.g. 50-Day Review"
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none"
              required
            />
          </div>

          <div className="w-full sm:w-44">
            <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
              Target Date
            </label>
            <input
              type="date"
              value={newEventDate}
              onChange={(e) => setNewEventDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none"
              required
            />
          </div>

          <div className="w-full sm:w-36">
            <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
              Category
            </label>
            <input
              type="text"
              placeholder="e.g. Goal"
              value={newEventCategory}
              onChange={(e) => setNewEventCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto sm:mt-5 w-full sm:w-auto">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all cursor-pointer flex-1 sm:flex-initial"
            >
              Add Countdown
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-2 text-xs font-medium rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Countdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events
          .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime())
          .map((evt) => {
            const targetDateObj = new Date(`${evt.targetDate}T00:00:00`);
            const targetDayNumber = getCalendarDaysElapsed(counter.startDate, targetDateObj);
            const daysLeft = targetDayNumber - currentDay;

            const diffMs = targetDateObj.getTime() - now.getTime();
            const isReached = diffMs <= 0;
            const absMs = Math.abs(diffMs);
            const totalHours = Math.floor(absMs / (1000 * 60 * 60));
            const remHours = totalHours % 24;
            const remMins = Math.floor((absMs / (1000 * 60)) % 60);
            const remSecs = Math.floor((absMs / 1000) % 60);

            return (
              <div
                key={evt.id}
                className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 block">
                        {evt.category || 'Target'} · Day {targetDayNumber}
                      </span>
                      <h3 className="text-base font-bold text-stone-900 dark:text-white mt-1">
                        {evt.title}
                      </h3>
                    </div>

                    <button
                      onClick={() => handleDeleteEvent(evt.id)}
                      aria-label="Delete countdown"
                      className="text-stone-300 dark:text-stone-700 hover:text-rose-500 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Big Days Left */}
                  <div className="my-4">
                    {isReached ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="w-3.5 h-3.5" />
                        Target Date Reached!
                      </span>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold font-mono text-stone-950 dark:text-white tabular-nums">
                          {daysLeft}
                        </span>
                        <span className="text-sm font-semibold text-stone-500 dark:text-stone-400">
                          {daysLeft === 1 ? 'day left' : 'days left'}
                        </span>
                      </div>
                    )}

                    {!isReached && (
                      <div className="text-xs font-mono text-stone-500 dark:text-stone-400 mt-1">
                        {remHours}h {remMins}m {remSecs}s remaining
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 dark:border-stone-800/80 text-xs text-stone-500 dark:text-stone-400 flex items-center justify-between">
                  <span>{formatReadableDate(targetDateObj, true)}</span>
                  <span className="font-mono">{formatDDMMYYYY(targetDateObj)}</span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
