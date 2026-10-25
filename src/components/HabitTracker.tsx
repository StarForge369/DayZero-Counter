import React, { useState } from 'react';
import { Counter, Habit, HabitCheckIn } from '../types';
import {
  getCalendarDaysElapsed,
  getDateForDayNumber,
  formatDDMMYYYY,
  formatReadableDate,
  toLocalDateString,
  playHapticSound,
} from '../utils/dateUtils';
import {
  CheckCircle2,
  Circle,
  Flame,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface HabitTrackerProps {
  counter: Counter;
  habits: Habit[];
  checkIns: HabitCheckIn[];
  onToggleHabit: (habitId: string, dateStr: string, dayNumber: number) => void;
  onAddHabit: (name: string, category: 'health' | 'focus' | 'mind' | 'routine') => void;
  onDeleteHabit: (habitId: string) => void;
  soundEnabled?: boolean;
}

export const HabitTracker: React.FC<HabitTrackerProps> = ({
  counter,
  habits,
  checkIns,
  onToggleHabit,
  onAddHabit,
  onDeleteHabit,
  soundEnabled = true,
}) => {
  const currentDay = getCalendarDaysElapsed(counter.startDate, new Date());
  const todayStr = toLocalDateString(new Date());

  // Date view state (defaults to today)
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(currentDay);

  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitCat, setNewHabitCat] = useState<'health' | 'focus' | 'mind' | 'routine'>('health');
  const [showAddForm, setShowAddForm] = useState(false);

  const selectedDate = getDateForDayNumber(counter.startDate, selectedDayNumber);
  const selectedDateStr = toLocalDateString(selectedDate);
  const isSelectedToday = selectedDateStr === todayStr;

  const handleToggle = (habitId: string) => {
    onToggleHabit(habitId, selectedDateStr, selectedDayNumber);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    onAddHabit(newHabitName.trim(), newHabitCat);
    setNewHabitName('');
    setShowAddForm(false);
  };

  const checkedDaysByHabit = new Map<string, Set<number>>();
  const completedDays = new Set<number>();
  const activeHabitIds = new Set(habits.map((habit) => habit.id));
  for (const checkIn of checkIns) {
    if (!activeHabitIds.has(checkIn.habitId)) continue;
    let checkedDays = checkedDaysByHabit.get(checkIn.habitId);
    if (!checkedDays) {
      checkedDays = new Set<number>();
      checkedDaysByHabit.set(checkIn.habitId, checkedDays);
    }
    checkedDays.add(checkIn.dayNumber);
    completedDays.add(checkIn.dayNumber);
  }

  // Streak calculation for a specific habit
  const getHabitStreak = (habitId: string) => {
    let streak = 0;
    let day = currentDay;
    while (day >= 0) {
      const hasChecked = checkedDaysByHabit.get(habitId)?.has(day) || false;
      if (hasChecked) {
        streak++;
        day--;
      } else {
        if (day === currentDay) {
          day--;
          continue;
        }
        break;
      }
    }
    return streak;
  };

  // Daily completion for selected day
  const completedTodayCount = habits.filter((habit) =>
    checkedDaysByHabit.get(habit.id)?.has(selectedDayNumber),
  ).length;

  const totalHabits = habits.length;
  const completionPercent = totalHabits > 0 ? Math.round((completedTodayCount / totalHabits) * 100) : 0;

  // Active overall streak (days with at least 1 habit completed)
  let overallStreak = 0;
  for (let d = currentDay; d >= 0; d--) {
    const anyDone = completedDays.has(d);
    if (anyDone) {
      overallStreak++;
    } else {
      if (d === currentDay) continue;
      break;
    }
  }

  // Days list for activity strip (up to last 7 days from Day 0)
  const minDay = Math.max(0, currentDay - 6);
  const recentDays = currentDay < 0
    ? []
    : Array.from({ length: currentDay - minDay + 1 }, (_, i) => minDay + i);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span>Habits & Daily Streak Tracker</span>
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Real-Time Synced
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Check off daily commitments for each day since origin ({counter.startDate} = Day 0). Synced live across all devices.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all self-start sm:self-auto cursor-pointer shadow-xs active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Habit</span>
        </button>
      </div>

      {/* Add Habit Form */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center gap-3 animate-in fade-in shadow-xs"
        >
          <div className="w-full sm:flex-1">
            <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
              Habit Name
            </label>
            <input
              type="text"
              placeholder="e.g. 15 Mins Stretching"
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-stone-900 dark:focus:ring-white"
              required
            />
          </div>

          <div className="w-full sm:w-40">
            <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
              Category
            </label>
            <select
              value={newHabitCat}
              onChange={(e) => setNewHabitCat(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none"
            >
              <option value="health">Health & Body</option>
              <option value="focus">Focus & Work</option>
              <option value="mind">Mind & Learning</option>
              <option value="routine">Daily Routine</option>
            </select>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto sm:mt-5 w-full sm:w-auto">
            <button
              type="submit"
              className="min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all cursor-pointer flex-1 sm:flex-initial"
            >
              Add Habit
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="min-h-[44px] px-3 py-2 text-xs font-medium rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Overview Stat Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 shadow-xs">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block mb-1">
            Current Day Streak
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400">
              {overallStreak}
            </span>
            <span className="text-xs text-stone-500 font-medium">Days</span>
          </div>
          <span className="text-[11px] text-stone-400 dark:text-stone-500 block mt-1">
            Consistent activity
          </span>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 shadow-xs">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block mb-1">
            Selected Day Progress
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold font-mono text-stone-900 dark:text-white">
              {completedTodayCount}/{totalHabits}
            </span>
            <span className="text-xs font-mono text-stone-500">({completionPercent}%)</span>
          </div>
          <span className="text-[11px] text-stone-400 dark:text-stone-500 block mt-1">
            {completionPercent === 100 ? '★ All completed!' : `${totalHabits - completedTodayCount} left`}
          </span>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 shadow-xs">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block mb-1">
            Total Check-ins
          </span>
          <span className="text-2xl font-extrabold font-mono text-stone-900 dark:text-white">
            {checkIns.length}
          </span>
          <span className="text-[11px] text-stone-400 dark:text-stone-500 block mt-1">
            Across all journey days
          </span>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 shadow-xs">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block mb-1">
            Active Habits Tracked
          </span>
          <span className="text-2xl font-extrabold font-mono text-stone-900 dark:text-white">
            {totalHabits}
          </span>
          <span className="text-[11px] text-stone-400 dark:text-stone-500 block mt-1">
            Daily focus list
          </span>
        </div>
      </div>

      {/* Date Day Selector Strip */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              Viewing Day:
            </span>
            <span className="font-mono font-bold text-sm text-stone-900 dark:text-white">
              Day {selectedDayNumber}
            </span>
            <span className="text-xs text-stone-500 font-mono">
              ({formatReadableDate(selectedDate, true)} · {formatDDMMYYYY(selectedDate)})
            </span>
            {isSelectedToday && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                Today
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              onClick={() => {
                if (soundEnabled) playHapticSound('click');
                setSelectedDayNumber(Math.max(0, selectedDayNumber - 1));
              }}
              disabled={selectedDayNumber <= 0}
              className="p-2 rounded-lg border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (soundEnabled) playHapticSound('click');
                setSelectedDayNumber(currentDay);
              }}
              className="min-h-[36px] px-3 py-1 text-xs font-medium rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer"
            >
              Today (Day {currentDay})
            </button>
            <button
              onClick={() => {
                if (soundEnabled) playHapticSound('click');
                setSelectedDayNumber(selectedDayNumber + 1);
              }}
              className="p-2 rounded-lg border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days activity row buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {recentDays.map((dNum) => {
            const dDate = getDateForDayNumber(counter.startDate, dNum);
            const dDateStr = toLocalDateString(dDate);
            const isSelected = dNum === selectedDayNumber;
            const dayDoneCount = habits.filter((h) =>
              checkIns.some((c) => c.habitId === h.id && c.dateStr === dDateStr)
            ).length;
            const isAllDone = totalHabits > 0 && dayDoneCount === totalHabits;

            return (
              <button
                key={dNum}
                onClick={() => {
                  if (soundEnabled) playHapticSound('click');
                  setSelectedDayNumber(dNum);
                }}
                className={`flex-1 min-w-[70px] min-h-[44px] p-2 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-stone-900 dark:ring-stone-100 bg-stone-100 dark:bg-stone-800 border-transparent shadow-xs'
                    : 'bg-stone-50/60 dark:bg-stone-950/40 border-stone-200 dark:border-stone-800 hover:border-stone-300'
                }`}
              >
                <span className="block text-[10px] text-stone-400 uppercase font-medium">
                  {dDate.toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
                <span className="block font-mono text-xs font-bold text-stone-900 dark:text-white mt-0.5">
                  Day {dNum}
                </span>
                <div className="mt-1 flex justify-center">
                  {isAllDone ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  ) : dayDoneCount > 0 ? (
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-stone-300 dark:bg-stone-700" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Habit Checklist Rows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 px-1">
          <span>Click to mark completed for Day {selectedDayNumber} (syncs live)</span>
          <span className="font-mono">{completedTodayCount} of {totalHabits} completed</span>
        </div>

        {habits.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 text-stone-400 text-xs">
            No habits created yet. Click "+ New Habit" to create one.
          </div>
        ) : (
          habits.map((habit) => {
            const isCompleted = checkIns.some(
              (c) => c.habitId === habit.id && c.dateStr === selectedDateStr
            );
            const streak = getHabitStreak(habit.id);

            return (
              <div
                key={habit.id}
                onClick={() => handleToggle(habit.id)}
                className={`min-h-[56px] p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 cursor-pointer select-none ${
                  isCompleted
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/15 border-emerald-500/40 text-stone-900 dark:text-white'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                <div className="flex items-center gap-3.5 flex-1">
                  <button
                    type="button"
                    className="shrink-0 text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 fill-emerald-500/20" />
                    ) : (
                      <Circle className="w-6 h-6 text-stone-300 dark:text-stone-700" />
                    )}
                  </button>

                  <div className="flex-1">
                    <span
                      className={`text-sm font-semibold block transition-colors ${
                        isCompleted
                          ? 'line-through text-stone-500 dark:text-stone-400'
                          : 'text-stone-900 dark:text-stone-100'
                      }`}
                    >
                      {habit.name}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-400 font-mono">
                      <span className="capitalize">{habit.category || 'routine'}</span>
                      {streak > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-semibold">
                            <Flame className="w-3 h-3 fill-amber-500 text-amber-500" />
                            {streak}d streak
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteHabit(habit.id);
                  }}
                  aria-label="Delete habit"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-300 dark:text-stone-700 hover:text-rose-500 transition-colors rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
