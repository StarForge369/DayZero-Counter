import React, { useState, useEffect } from 'react';
import { Counter } from '../types';
import { Logo } from './Logo';
import {
  getLiveTimeElapsed,
  formatDDMMYYYY,
  formatFullDate,
  formatReadableDate,
  format12HourTime,
  STANDARD_MILESTONES,
  getDateForDayNumber,
  toLocalDateString,
  toLocalTimeString,
  parseLocalDateString,
  playHapticSound,
} from '../utils/dateUtils';
import {
  Clock,
  Calendar,
  Share2,
  Edit3,
  Check,
  RotateCcw,
  Flag,
  Sparkles,
  Zap,
} from 'lucide-react';

interface PrimaryHeroCounterProps {
  counter: Counter;
  onEdit: () => void;
  onResetToToday: () => void;
  onViewMilestones: () => void;
  onViewCalendar: () => void;
  onAddNoteForToday: () => void;
  onOpenShareModal: () => void;
  soundEnabled: boolean;
}

export const PrimaryHeroCounter: React.FC<PrimaryHeroCounterProps> = ({
  counter,
  onEdit,
  onResetToToday,
  onViewMilestones,
  onViewCalendar,
  onAddNoteForToday,
  onOpenShareModal,
  soundEnabled,
}) => {
  const [timeState, setTimeState] = useState(() =>
    getLiveTimeElapsed(counter.startDate, counter.startTime)
  );

  // Live timer tick every 1000ms
  useEffect(() => {
    const update = () => {
      setTimeState(getLiveTimeElapsed(counter.startDate, counter.startTime));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [counter.startDate, counter.startTime]);

  const {
    calendarDay,
    isPast,
    totalDays,
    remHours,
    remMinutes,
    remSeconds,
    totalHours,
    totalMinutes,
    totalSeconds,
    totalWeeks,
    hoursToNextDay,
    minsToNextDay,
    secsToNextDay,
    todayProgressPercent,
  } = timeState;

  // Next milestone calculation
  const nextMilestone = STANDARD_MILESTONES.find((m) => m.day > calendarDay) || {
    day: calendarDay + 10,
    label: `Day ${calendarDay + 10}`,
  };

  const prevMilestoneDay =
    [...STANDARD_MILESTONES].reverse().find((m) => m.day <= calendarDay)?.day || 0;
  const progressToNext =
    nextMilestone.day > prevMilestoneDay
      ? Math.min(
          100,
          Math.max(
            0,
            ((calendarDay - prevMilestoneDay) / (nextMilestone.day - prevMilestoneDay)) * 100
          )
        )
      : 100;

  const nextMilestoneDate = getDateForDayNumber(counter.startDate, nextMilestone.day);
  const daysUntilNext = nextMilestone.day - calendarDay;

  const todayStr = toLocalDateString(new Date());
  const isStartedToday = counter.startDate === todayStr;
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (confirmReset) {
      const timer = setTimeout(() => setConfirmReset(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [confirmReset]);

  const handleShareClick = () => {
    if (soundEnabled) playHapticSound('click');
    onOpenShareModal();
  };

  const handleEditClick = () => {
    if (soundEnabled) playHapticSound('click');
    onEdit();
  };

  const handleNoteClick = () => {
    if (soundEnabled) playHapticSound('click');
    onAddNoteForToday();
  };

  const handleResetClick = () => {
    if (!confirmReset) {
      if (soundEnabled) playHapticSound('click');
      setConfirmReset(true);
      return;
    }
    if (soundEnabled) playHapticSound('reset');
    setConfirmReset(false);
    onResetToToday();
  };

  return (
    <div className="space-y-8">
      {/* Primary Hero Showcase */}
      <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 sm:p-10 shadow-xs transition-colors">
        {/* Subtle decorative grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-stone-100/70 via-transparent to-transparent dark:from-stone-800/40 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto">
          {/* Logo Insignia at the top of Hero */}
          <div className="mb-4 flex items-center justify-center">
            <Logo size="lg" />
          </div>

          {/* Metadata system badge */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-mono font-medium text-stone-500 dark:text-stone-400 mb-3 bg-stone-100 dark:bg-stone-800/80 px-3.5 py-1.5 rounded-full border border-stone-200 dark:border-stone-700/60">
            <span>Origin: {formatDDMMYYYY(parseLocalDateString(counter.startDate))} ({format12HourTime(counter.startTime)}) = Day 0</span>
            <span aria-hidden="true">·</span>
            <span>
              {formatDDMMYYYY(getDateForDayNumber(counter.startDate, 1))} = Day 1
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              Current: Day {calendarDay}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight">
            {counter.title}
          </h1>
          {counter.description && (
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400 max-w-lg">
              {counter.description}
            </p>
          )}

          {/* Big Day Number Display */}
          <div className="my-6 sm:my-8 flex flex-col items-center">
            <div className="flex items-baseline justify-center gap-2 sm:gap-3">
              <span className="text-2xl sm:text-4xl font-semibold tracking-tight text-stone-400 dark:text-stone-500 font-mono">
                Day
              </span>
              <span className="text-7xl sm:text-9xl font-extrabold tracking-tighter text-stone-950 dark:text-white font-mono tabular-nums leading-none">
                {calendarDay >= 0 ? calendarDay : `-${Math.abs(calendarDay)}`}
              </span>
            </div>

            <p className="mt-3 text-sm font-medium text-stone-600 dark:text-stone-300">
              {calendarDay === 0 && 'Origin Day 0 — The journey begins today!'}
              {calendarDay === 1 && 'First full day completed (Day 1).'}
              {calendarDay > 1 && `${calendarDay} calendar days elapsed since start date.`}
              {calendarDay < 0 && `${Math.abs(calendarDay)} days until start date.`}
            </p>
          </div>

          {/* Day 0 Midnight Rollover Ticker */}
          <div className="w-full max-w-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 rounded-xl px-4 py-2.5 mb-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                {calendarDay === 0
                  ? `Day 0 is in progress (${todayProgressPercent}% done)`
                  : `Current Day ${calendarDay} (${todayProgressPercent}% done)`}
              </span>
            </div>
            <div className="font-mono text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
              Next rollover (Day {calendarDay + 1}) in{' '}
              <span className="tabular-nums">
                {hoursToNextDay}h {minsToNextDay}m {secsToNextDay}s
              </span>
            </div>
          </div>

          {/* Live Continuous Ticker Bar */}
          <div className="w-full max-w-xl bg-stone-50 dark:bg-stone-950/60 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 mb-6">
            <div className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 font-semibold mb-2.5 flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Live Time Elapsed ({counter.startTime || '00:00:00'})</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-white dark:bg-stone-900 p-2.5 rounded-xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
                <span className="block text-2xl sm:text-3xl font-bold font-mono text-stone-900 dark:text-white tabular-nums">
                  {totalDays}
                </span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 uppercase tracking-wider font-medium">
                  Days
                </span>
              </div>
              <div className="bg-white dark:bg-stone-900 p-2.5 rounded-xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
                <span className="block text-2xl sm:text-3xl font-bold font-mono text-stone-900 dark:text-white tabular-nums">
                  {String(remHours).padStart(2, '0')}
                </span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 uppercase tracking-wider font-medium">
                  Hours
                </span>
              </div>
              <div className="bg-white dark:bg-stone-900 p-2.5 rounded-xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
                <span className="block text-2xl sm:text-3xl font-bold font-mono text-stone-900 dark:text-white tabular-nums">
                  {String(remMinutes).padStart(2, '0')}
                </span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 uppercase tracking-wider font-medium">
                  Mins
                </span>
              </div>
              <div className="bg-white dark:bg-stone-900 p-2.5 rounded-xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
                <span className="block text-2xl sm:text-3xl font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
                  {String(remSeconds).padStart(2, '0')}
                </span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 uppercase tracking-wider font-medium">
                  Secs
                </span>
              </div>
            </div>
          </div>

          {/* Action Row - Mobile 2-col grid, desktop flex */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-center justify-center gap-2 sm:gap-3 w-full max-w-xl">
            <button
              onClick={handleShareClick}
              className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Day Card</span>
            </button>

            <button
              onClick={handleEditClick}
              className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-xl border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Date / Settings</span>
            </button>

            <button
              onClick={handleNoteClick}
              className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-xl border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Add Day Note</span>
            </button>

            <button
              onClick={handleResetClick}
              title={confirmReset ? 'Click to confirm reset origin to 13-10-2026 1:47 PM' : 'Reset origin date and time to 13-10-2026 1:47 PM'}
              className={`min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer ${
                confirmReset
                  ? 'bg-rose-500 text-white hover:bg-rose-600 animate-pulse'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              <RotateCcw className={`w-3.5 h-3.5 ${confirmReset ? 'animate-spin' : ''}`} />
              <span>{confirmReset ? 'Confirm reset?' : 'Reset to 13-10-2026'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Next Milestone Quick Glance Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-700 dark:text-stone-300">
              <Flag className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                <span>Next Milestone Target</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-stone-900 dark:text-stone-100">
                  {nextMilestone.label} (Day {nextMilestone.day})
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                Target date: <strong className="text-stone-900 dark:text-stone-200">{formatReadableDate(nextMilestoneDate, true)}</strong> ({daysUntilNext > 0 ? `${daysUntilNext} days away` : 'Reached!'})
              </p>
            </div>
          </div>

          <button
            onClick={onViewMilestones}
            className="text-xs font-semibold text-stone-900 dark:text-stone-100 hover:underline self-start sm:self-auto cursor-pointer"
          >
            View All Milestones →
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-stone-900 dark:bg-stone-100 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressToNext}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[11px] font-mono text-stone-400 dark:text-stone-500 mt-1.5">
          <span>Day {prevMilestoneDay}</span>
          <span>{Math.round(progressToNext)}%</span>
          <span>Day {nextMilestone.day}</span>
        </div>
      </div>

      {/* Auxiliary Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block mb-1">
            Total Hours Elapsed
          </span>
          <span className="text-xl font-bold font-mono tabular-nums text-stone-900 dark:text-white">
            {totalHours.toLocaleString()}h
          </span>
          <span className="text-[11px] text-stone-400 dark:text-stone-500 block mt-1">
            ~{totalMinutes.toLocaleString()} mins
          </span>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block mb-1">
            Weeks Elapsed
          </span>
          <span className="text-xl font-bold font-mono tabular-nums text-stone-900 dark:text-white">
            {totalWeeks}w
          </span>
          <span className="text-[11px] text-stone-400 dark:text-stone-500 block mt-1">
            {Math.floor(totalDays / 7)}w {totalDays % 7}d
          </span>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block mb-1">
            Day 0 Origin Date & Time
          </span>
          <span className="text-sm font-bold font-mono text-stone-900 dark:text-white block truncate">
            {formatDDMMYYYY(getDateForDayNumber(counter.startDate, 0))} · {format12HourTime(counter.startTime)}
          </span>
          <span className="text-[11px] text-stone-400 dark:text-stone-500 block mt-1">
            {formatReadableDate(getDateForDayNumber(counter.startDate, 0), true)}
          </span>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block mb-1">
            Current Date & Time
          </span>
          <span className="text-sm font-bold font-mono text-stone-900 dark:text-white block truncate">
            {formatDDMMYYYY(new Date())}
          </span>
          <span className="text-[11px] text-stone-400 dark:text-stone-500 block mt-1">
            {toLocalTimeString(new Date())} · {formatReadableDate(new Date(), true)}
          </span>
        </div>
      </div>
    </div>
  );
};
