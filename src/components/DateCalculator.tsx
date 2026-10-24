import React, { useState } from 'react';
import { Counter } from '../types';
import {
  getCalendarDaysElapsed,
  getDateForDayNumber,
  formatDDMMYYYY,
  formatFullDate,
  formatReadableDate,
  toLocalDateString,
  playHapticSound,
} from '../utils/dateUtils';
import { Calculator, CalendarDays } from 'lucide-react';

interface DateCalculatorProps {
  counter: Counter;
  soundEnabled?: boolean;
}

export const DateCalculator: React.FC<DateCalculatorProps> = ({
  counter,
  soundEnabled = true,
}) => {
  const [activeMode, setActiveMode] = useState<'dateToDay' | 'dayToDate'>('dateToDay');

  // Mode 1: Date to Day #
  const [inputDateStr, setInputDateStr] = useState<string>(() => {
    return toLocalDateString(new Date());
  });

  // Mode 2: Day # to Date
  const [inputDayNum, setInputDayNum] = useState<number>(30);

  // Calculations for Mode 1
  const calculatedDate = new Date(`${inputDateStr}T00:00:00`);
  const calculatedDayNumber = getCalendarDaysElapsed(counter.startDate, calculatedDate);
  const currentTodayDay = getCalendarDaysElapsed(counter.startDate, new Date());

  // Calculations for Mode 2
  const calculatedTargetDate = getDateForDayNumber(counter.startDate, inputDayNum);
  const diffFromToday = inputDayNum - currentTodayDay;

  const handleSelectPresetDate = (dateStr: string) => {
    if (soundEnabled) playHapticSound('click');
    setInputDateStr(dateStr);
  };

  const handleSelectPresetDay = (dayNum: number) => {
    if (soundEnabled) playHapticSound('click');
    setInputDayNum(dayNum);
  };

  // Preset dates derived dynamically from counter.startDate
  const day0Str = toLocalDateString(getDateForDayNumber(counter.startDate, 0));
  const day1Str = toLocalDateString(getDateForDayNumber(counter.startDate, 1));
  const day2Str = toLocalDateString(getDateForDayNumber(counter.startDate, 2));
  const day7Str = toLocalDateString(getDateForDayNumber(counter.startDate, 7));
  const day30Str = toLocalDateString(getDateForDayNumber(counter.startDate, 30));
  const day100Str = toLocalDateString(getDateForDayNumber(counter.startDate, 100));
  const day365Str = toLocalDateString(getDateForDayNumber(counter.startDate, 365));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
          <Calculator className="w-5 h-5 text-stone-700 dark:text-stone-300" />
          <span>Precise Day & Date Calculator</span>
        </h2>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          Two-way calculator based on origin date <strong>{counter.startDate}</strong> (Day 0) and <strong>{day1Str}</strong> (Day 1).
        </p>
      </div>

      {/* Mode switcher tabs */}
      <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-lg w-fit">
        <button
          onClick={() => {
            if (soundEnabled) playHapticSound('click');
            setActiveMode('dateToDay');
          }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            activeMode === 'dateToDay'
              ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          Date → Day Number
        </button>
        <button
          onClick={() => {
            if (soundEnabled) playHapticSound('click');
            setActiveMode('dayToDate');
          }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            activeMode === 'dayToDate'
              ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          Day Number → Date
        </button>
      </div>

      {/* Mode 1: Date to Day */}
      {activeMode === 'dateToDay' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-xs">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
              Select or Enter Any Calendar Date
            </h3>

            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">
                Target Date
              </label>
              <input
                type="date"
                value={inputDateStr}
                onChange={(e) => setInputDateStr(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-white"
              />
            </div>

            {/* Quick Test Presets */}
            <div>
              <span className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">
                Quick Origin & Future Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectPresetDate(day0Str)}
                  className="px-2.5 py-1 text-xs font-mono rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                >
                  {formatDDMMYYYY(getDateForDayNumber(counter.startDate, 0))} (Day 0)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPresetDate(day1Str)}
                  className="px-2.5 py-1 text-xs font-mono rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                >
                  {formatDDMMYYYY(getDateForDayNumber(counter.startDate, 1))} (Day 1)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPresetDate(day7Str)}
                  className="px-2.5 py-1 text-xs font-mono rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                >
                  Day 7 (1 Week)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPresetDate(day30Str)}
                  className="px-2.5 py-1 text-xs font-mono rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                >
                  Day 30 (1 Month)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPresetDate(day100Str)}
                  className="px-2.5 py-1 text-xs font-mono rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                >
                  Day 100
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPresetDate(day365Str)}
                  className="px-2.5 py-1 text-xs font-mono rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                >
                  Day 365 (1 Year)
                </button>
              </div>
            </div>
          </div>

          {/* Result card */}
          <div className="bg-stone-50 dark:bg-stone-950/60 rounded-xl border border-stone-200 dark:border-stone-800 p-5 flex flex-col justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-stone-400 dark:text-stone-500">
                Calculated Day Result
              </span>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold font-mono text-stone-950 dark:text-white">
                  Day {calculatedDayNumber}
                </span>
              </div>

              <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mt-1">
                {formatFullDate(calculatedDate)}
              </p>

              <div className="mt-4 pt-3 border-t border-stone-200 dark:border-stone-800 space-y-2 text-xs text-stone-600 dark:text-stone-400">
                <div className="flex justify-between">
                  <span>DD-MM-YYYY:</span>
                  <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                    {formatDDMMYYYY(calculatedDate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-medium text-stone-900 dark:text-stone-100">
                    {calculatedDayNumber === 0 && 'Exact Origin Date (Day 0)'}
                    {calculatedDayNumber === 1 && `Day One (${formatDDMMYYYY(new Date(day1Str))})`}
                    {calculatedDayNumber > 1 && `${calculatedDayNumber} days after Day 0`}
                    {calculatedDayNumber < 0 && `${Math.abs(calculatedDayNumber)} days before Day 0`}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-2.5 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 text-[11px] text-stone-500 dark:text-stone-400 font-mono">
              Formula: CalendarDays({inputDateStr}) - CalendarDays({counter.startDate}) = {calculatedDayNumber}
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Day to Date */}
      {activeMode === 'dayToDate' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-xs">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
              Enter Any Day Number
            </h3>

            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">
                Day Number (where 0 = {counter.startDate}, 1 = {day1Str})
              </label>
              <input
                type="number"
                value={inputDayNum}
                onChange={(e) => setInputDayNum(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3.5 py-2 text-lg font-mono font-bold rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-white"
              />
            </div>

            {/* Quick Test Presets */}
            <div>
              <span className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">
                Quick Milestone Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                {[0, 1, 7, 14, 30, 50, 100, 365, 500, 1000].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleSelectPresetDay(num)}
                    className="px-2.5 py-1 text-xs font-mono rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                  >
                    Day {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Result card */}
          <div className="bg-stone-50 dark:bg-stone-950/60 rounded-xl border border-stone-200 dark:border-stone-800 p-5 flex flex-col justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-stone-400 dark:text-stone-500">
                Projected Calendar Date
              </span>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold font-mono text-stone-950 dark:text-white">
                  {formatDDMMYYYY(calculatedTargetDate)}
                </span>
              </div>

              <p className="text-sm font-semibold text-stone-800 dark:text-stone-200 mt-1">
                {formatFullDate(calculatedTargetDate)}
              </p>

              <div className="mt-4 pt-3 border-t border-stone-200 dark:border-stone-800 space-y-2 text-xs text-stone-600 dark:text-stone-400">
                <div className="flex justify-between">
                  <span>Relative to Today (Day {currentTodayDay}):</span>
                  <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                    {diffFromToday === 0
                      ? 'Today!'
                      : diffFromToday > 0
                      ? `In ${diffFromToday} days`
                      : `${Math.abs(diffFromToday)} days ago`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Start Date:</span>
                  <span className="font-mono text-stone-900 dark:text-stone-100">
                    {counter.startDate} (Day 0)
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-2.5 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 text-[11px] text-stone-500 dark:text-stone-400 font-mono">
              Result: {counter.startDate} + {inputDayNum} days = {formatDDMMYYYY(calculatedTargetDate)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
