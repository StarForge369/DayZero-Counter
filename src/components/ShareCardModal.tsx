import React, { useState } from 'react';
import { Counter } from '../types';
import { Logo } from './Logo';
import {
  formatDDMMYYYY,
  formatReadableDate,
  formatFullDate,
  format12HourTime,
  getCalendarDaysElapsed,
  playHapticSound,
  parseLocalDateString,
} from '../utils/dateUtils';
import { X, Copy, Check, Sparkles, Download } from 'lucide-react';

interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  counter: Counter;
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  isOpen,
  onClose,
  counter,
}) => {
  const [copied, setCopied] = useState(false);
  if (!isOpen) return null;

  const currentDay = getCalendarDaysElapsed(counter.startDate, new Date());
  const today = new Date();

  const shareText = `🌟 Day ${currentDay} on Day Zero\n\n` +
    `• Origin Date: ${formatDDMMYYYY(parseLocalDateString(counter.startDate))} at ${format12HourTime(counter.startTime)} (Day 0)\n` +
    `• Today: ${formatFullDate(today)} (Day ${currentDay})\n` +
    `• Status: ${currentDay === 0 ? 'Origin Day Kickoff' : `${currentDay} full calendar days elapsed`}\n\n` +
    `Keep counting forward on Day Zero.`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      playHapticSound('click');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">
              Share Day Card
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Styled Card Graphic Preview */}
        <div className="my-5 p-6 rounded-2xl bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950 text-white border border-stone-800 shadow-xl relative overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Card Header with Logo */}
          <div className="flex items-center justify-between mb-6 relative z-10">
            <Logo size="sm" showText={true} />
            <span className="text-[11px] font-mono text-stone-400 border border-stone-800 px-2 py-0.5 rounded-full bg-stone-900/80">
              {formatDDMMYYYY(today)}
            </span>
          </div>

          {/* Big Number */}
          <div className="text-center py-4 relative z-10">
            <span className="text-xs uppercase tracking-widest text-stone-400 font-mono block">
              Elapsed Time Status
            </span>
            <div className="text-6xl font-extrabold font-mono tracking-tight text-white mt-1 tabular-nums">
              Day {currentDay}
            </div>
            <p className="text-xs text-stone-300 font-medium mt-2 max-w-xs mx-auto">
              {currentDay === 0
                ? 'Origin Day: Journey begins today!'
                : `${currentDay} full calendar days since origin.`}
            </p>
          </div>

          {/* Card Footer */}
          <div className="pt-4 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono text-stone-400 relative z-10">
            <span>Origin: {formatDDMMYYYY(parseLocalDateString(counter.startDate))} at {format12HourTime(counter.startTime)} (Day 0)</span>
            <span>Day 1: Next Day</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all shadow-xs cursor-pointer active:scale-98"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied Summary!' : 'Copy Summary Text'}</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-medium rounded-xl border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
