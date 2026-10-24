import React, { useState, useEffect } from 'react';
import { Counter } from '../types';
import {
  getDateForDayNumber,
  formatDDMMYYYY,
  formatReadableDate,
  toLocalDateString,
  toLocalTimeString,
  playHapticSound,
} from '../utils/dateUtils';
import { X, Calendar, Clock, RotateCcw } from 'lucide-react';

interface CounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  counterToEdit?: Counter | null;
  onSave: (counter: Counter) => void;
  soundEnabled?: boolean;
}

export const CounterModal: React.FC<CounterModalProps> = ({
  isOpen,
  onClose,
  counterToEdit,
  onSave,
  soundEnabled = true,
}) => {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(() => toLocalDateString(new Date()));
  const [startTime, setStartTime] = useState(() => toLocalTimeString(new Date()));
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (counterToEdit) {
      setTitle(counterToEdit.title);
      setStartDate(counterToEdit.startDate);
      setStartTime(counterToEdit.startTime || '00:00:00');
      setDescription(counterToEdit.description || '');
    } else {
      const now = new Date();
      setTitle(`Days from ${formatDDMMYYYY(now)}`);
      setStartDate(toLocalDateString(now));
      setStartTime(toLocalTimeString(now));
      setDescription(`${formatDDMMYYYY(now)} is Day 0. The next day is Day 1.`);
    }
  }, [counterToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate) return;

    if (soundEnabled) playHapticSound('click');

    const savedCounter: Counter = {
      id: counterToEdit ? counterToEdit.id : `counter-${Date.now()}`,
      title: title.trim(),
      startDate,
      startTime: startTime || '00:00:00',
      description: description.trim(),
      createdAt: counterToEdit?.createdAt || new Date().toISOString(),
    };

    onSave(savedCounter);
    onClose();
  };

  const handleSetTo13Oct147PM = () => {
    if (soundEnabled) playHapticSound('click');
    setStartDate('2026-10-13');
    setStartTime('13:47:00');
    setTitle('Days from 13-10-2026');
    setDescription('Origin date 13-10-2026 at 1:47 PM is Day 0. 14-10-2026 is Day 1.');
  };

  const handleSetToCurrentNow = () => {
    if (soundEnabled) playHapticSound('click');
    const now = new Date();
    const dateStr = toLocalDateString(now);
    const timeStr = toLocalTimeString(now);
    setStartDate(dateStr);
    setStartTime(timeStr);
    setTitle(`Days from ${formatDDMMYYYY(now)}`);
    setDescription(`${formatDDMMYYYY(now)} is Day 0. Following day is Day 1.`);
  };

  const day0Date = getDateForDayNumber(startDate, 0);
  const day1Date = getDateForDayNumber(startDate, 1);
  const day2Date = getDateForDayNumber(startDate, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <h3 className="text-base font-bold text-stone-900 dark:text-white">
            {counterToEdit ? 'Edit Counter Settings' : 'Create New Days Counter'}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Counter Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Days from 13-10-2026"
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-stone-900 dark:focus:ring-white"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Starting Date (Day 0)
                </label>
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-stone-900 dark:focus:ring-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Start Time
              </label>
              <input
                type="time"
                step="1"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-stone-900 dark:focus:ring-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-stone-500 dark:text-stone-400">
              Quick presets:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSetTo13Oct147PM}
                className="text-[11px] font-medium text-stone-700 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 underline cursor-pointer"
              >
                13-10-2026 1:47 PM
              </button>
              <span className="text-stone-300 dark:text-stone-700">·</span>
              <button
                type="button"
                onClick={handleSetToCurrentNow}
                className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Right Now</span>
              </button>
            </div>
          </div>

          {/* System preview rule */}
          <div className="p-3.5 bg-stone-50 dark:bg-stone-950/60 rounded-xl border border-stone-200 dark:border-stone-800 text-xs space-y-1.5">
            <span className="font-semibold text-stone-700 dark:text-stone-300 block">
              System Verification Rule:
            </span>
            <div className="font-mono text-[11px] space-y-1 text-stone-600 dark:text-stone-400">
              <div className="flex justify-between">
                <span>• {formatDDMMYYYY(day0Date)}</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">Day 0 (Start)</span>
              </div>
              <div className="flex justify-between">
                <span>• {formatDDMMYYYY(day1Date)}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Day 1 (Following Day)</span>
              </div>
              <div className="flex justify-between">
                <span>• {formatDDMMYYYY(day2Date)}</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">Day 2</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Description / Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes or context for this counter..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-stone-900 dark:focus:ring-white resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all cursor-pointer shadow-xs"
            >
              Save Counter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
