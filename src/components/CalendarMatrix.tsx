import React, { useState } from 'react';
import { Counter } from '../types';
import {
  getCalendarDaysElapsed,
  formatDDMMYYYY,
  formatReadableDate,
  formatFullDate,
  STANDARD_MILESTONES,
  toLocalDateString,
  playHapticSound,
} from '../utils/dateUtils';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sparkles } from 'lucide-react';

interface CalendarMatrixProps {
  counter: Counter;
  onSelectDayForNote: (dayNumber: number, dateStr: string) => void;
  soundEnabled?: boolean;
}

export const CalendarMatrix: React.FC<CalendarMatrixProps> = ({
  counter,
  onSelectDayForNote,
  soundEnabled = true,
}) => {
  // Start month at the counter's start date (October 2026)
  const [displayedYear, setDisplayedYear] = useState(() => {
    const parts = counter.startDate.split('-').map(Number);
    return parts[0] || 2026;
  });
  const [displayedMonth, setDisplayedMonth] = useState(() => {
    const parts = counter.startDate.split('-').map(Number);
    return (parts[1] || 10) - 1; // 0-indexed
  });

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const handlePrevMonth = () => {
    if (soundEnabled) playHapticSound('click');
    if (displayedMonth === 0) {
      setDisplayedMonth(11);
      setDisplayedYear((y) => y - 1);
    } else {
      setDisplayedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (soundEnabled) playHapticSound('click');
    if (displayedMonth === 11) {
      setDisplayedMonth(0);
      setDisplayedYear((y) => y + 1);
    } else {
      setDisplayedMonth((m) => m + 1);
    }
  };

  const handleGoToStartMonth = () => {
    if (soundEnabled) playHapticSound('click');
    const parts = counter.startDate.split('-').map(Number);
    setDisplayedYear(parts[0]);
    setDisplayedMonth(parts[1] - 1);
  };

  const handleGoToCurrentMonth = () => {
    if (soundEnabled) playHapticSound('click');
    const now = new Date();
    setDisplayedYear(now.getFullYear());
    setDisplayedMonth(now.getMonth());
  };

  // Generate calendar days for displayed month
  const firstDayOfMonth = new Date(displayedYear, displayedMonth, 1);
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
  const daysInMonth = new Date(displayedYear, displayedMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(displayedYear, displayedMonth, 0).getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const now = new Date();
  const todayStr = toLocalDateString(now);

  const selectedDayElapsed = getCalendarDaysElapsed(counter.startDate, selectedDate);
  const selectedDateStr = toLocalDateString(selectedDate);
  const isSelectedStartDate = selectedDateStr === counter.startDate;
  const isSelectedToday = selectedDateStr === todayStr;

  const selectedMilestone = STANDARD_MILESTONES.find((m) => m.day === selectedDayElapsed);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-stone-700 dark:text-stone-300" />
            <span>Interactive Day Calendar</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Every calendar day mapped to its precise Day index from origin ({counter.startDate} = Day 0).
          </p>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleGoToStartMonth}
            className="px-2.5 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 bg-stone-100 dark:bg-stone-800 rounded-lg transition-colors cursor-pointer"
          >
            Origin Month
          </button>
          <button
            onClick={handleGoToCurrentMonth}
            className="px-2.5 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 bg-stone-100 dark:bg-stone-800 rounded-lg transition-colors cursor-pointer"
          >
            Today
          </button>

          <div className="flex items-center gap-1 border border-stone-200 dark:border-stone-800 rounded-lg p-0.5 bg-white dark:bg-stone-900">
            <button
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="p-1 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white rounded hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-semibold text-stone-900 dark:text-stone-100 whitespace-nowrap min-w-[110px] text-center font-mono">
              {monthNames[displayedMonth]} {displayedYear}
            </span>
            <button
              onClick={handleNextMonth}
              aria-label="Next month"
              className="p-1 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white rounded hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <span key={d} className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider py-1">
                {d}
              </span>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Prev month fill */}
            {Array.from({ length: startingDayOfWeek }).map((_, i) => {
              const dayNum = daysInPrevMonth - startingDayOfWeek + i + 1;
              const prevMonthDate = new Date(
                displayedMonth === 0 ? displayedYear - 1 : displayedYear,
                displayedMonth === 0 ? 11 : displayedMonth - 1,
                dayNum
              );
              const dayElapsed = getCalendarDaysElapsed(counter.startDate, prevMonthDate);
              return (
                <div
                  key={`prev-${i}`}
                  onClick={() => {
                    if (soundEnabled) playHapticSound('click');
                    setSelectedDate(prevMonthDate);
                  }}
                  className="min-h-[64px] sm:min-h-[72px] p-1.5 rounded-xl border border-transparent text-stone-300 dark:text-stone-700 bg-stone-50/50 dark:bg-stone-950/20 text-xs flex flex-col justify-between cursor-pointer hover:border-stone-200 dark:hover:border-stone-800 transition-all opacity-40"
                >
                  <span className="font-mono text-[11px]">{dayNum}</span>
                  <span className="text-[10px] font-mono">
                    {dayElapsed >= 0 ? `D${dayElapsed}` : `${dayElapsed}d`}
                  </span>
                </div>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const cellDate = new Date(displayedYear, displayedMonth, dayNum);
              const dayElapsed = getCalendarDaysElapsed(counter.startDate, cellDate);
              const cellDateStr = toLocalDateString(cellDate);

              const isStart = cellDateStr === counter.startDate;
              const isToday = cellDateStr === todayStr;
              const isSelected = cellDateStr === selectedDateStr;
              const isDayOne = dayElapsed === 1;

              return (
                <button
                  key={`day-${dayNum}`}
                  onClick={() => {
                    if (soundEnabled) playHapticSound('click');
                    setSelectedDate(cellDate);
                  }}
                  className={`min-h-[64px] sm:min-h-[72px] p-1.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-stone-900 dark:ring-stone-100 z-10'
                      : ''
                  } ${
                    isStart && isToday
                      ? 'bg-amber-500/15 border-amber-500 text-stone-900 dark:text-white shadow-xs'
                      : isStart
                      ? 'bg-amber-500/10 border-amber-500/50 text-stone-900 dark:text-white'
                      : isToday
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 border-transparent shadow-xs'
                      : isDayOne
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-stone-900 dark:text-stone-100'
                      : 'bg-stone-50/60 dark:bg-stone-950/40 border-stone-200/70 dark:border-stone-800/80 hover:border-stone-300 dark:hover:border-stone-700 text-stone-900 dark:text-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`font-mono text-xs font-semibold ${
                        isToday && !isStart
                          ? 'text-white dark:text-stone-900'
                          : isStart
                          ? 'text-amber-700 dark:text-amber-400 font-bold'
                          : ''
                      }`}
                    >
                      {dayNum}
                    </span>
                    {isToday && (
                      <span className="text-[9px] uppercase tracking-wider font-bold bg-amber-500 text-white dark:bg-amber-400 dark:text-stone-900 px-1 rounded">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="mt-1">
                    {isStart ? (
                      <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-400 block leading-tight">
                        Day 0 ★
                      </span>
                    ) : isDayOne ? (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 block leading-tight">
                        Day 1
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] font-mono block leading-tight ${
                          isToday && !isStart
                            ? 'text-white/90 dark:text-stone-900 font-bold'
                            : dayElapsed >= 0
                            ? 'text-stone-600 dark:text-stone-400 font-medium'
                            : 'text-stone-400 dark:text-stone-600'
                        }`}
                      >
                        {dayElapsed >= 0 ? `Day ${dayElapsed}` : `${dayElapsed}d`}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800/80 flex flex-wrap items-center gap-4 text-xs text-stone-500 dark:text-stone-400">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/50" />
              <span>Day 0 (Origin Date)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" />
              <span>Day 1 (Following Day)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-stone-900 dark:bg-stone-100" />
              <span>Today</span>
            </div>
          </div>
        </div>

        {/* Selected Day Inspector (1 col) */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                Day Inspector
              </span>
              <span className="font-mono text-xs text-stone-500 dark:text-stone-400">
                {formatDDMMYYYY(selectedDate)}
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono text-stone-900 dark:text-white">
                  {selectedDayElapsed >= 0 ? `Day ${selectedDayElapsed}` : `${selectedDayElapsed} Days`}
                </span>
              </div>
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-200 mt-1">
                {formatFullDate(selectedDate)}
              </p>

              <div className="mt-4 space-y-2.5 text-xs text-stone-600 dark:text-stone-400">
                <div className="flex justify-between py-1.5 border-b border-stone-100 dark:border-stone-800/60">
                  <span>Relative to Day 0</span>
                  <span className="font-mono font-medium text-stone-900 dark:text-stone-100">
                    {isSelectedStartDate && 'Origin (Day 0)'}
                    {selectedDayElapsed === 1 && 'First Elapsed Day (Day 1)'}
                    {selectedDayElapsed > 1 && `+${selectedDayElapsed} days after start`}
                    {selectedDayElapsed < 0 && `${selectedDayElapsed} days before start`}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-stone-100 dark:border-stone-800/60">
                  <span>Format DD-MM-YYYY</span>
                  <span className="font-mono font-medium text-stone-900 dark:text-stone-100">
                    {formatDDMMYYYY(selectedDate)}
                  </span>
                </div>

                {selectedMilestone && (
                  <div className="p-2.5 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200">
                    <span className="font-semibold block text-stone-900 dark:text-white">
                      ★ Milestone: {selectedMilestone.label}
                    </span>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400">
                      Falls on Day {selectedMilestone.day}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-stone-100 dark:border-stone-800">
            <button
              onClick={() => {
                if (soundEnabled) playHapticSound('click');
                onSelectDayForNote(selectedDayElapsed, selectedDateStr);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Attach Journal Note for Day {selectedDayElapsed}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
