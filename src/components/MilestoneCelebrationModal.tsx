import React from 'react';
import { Milestone, Counter } from '../types';
import { Logo } from './Logo';
import {
  formatDDMMYYYY,
  formatFullDate,
  getDateForDayNumber,
  playHapticSound,
  parseLocalDateString,
} from '../utils/dateUtils';
import { Award, Sparkles, X, Share2, Check } from 'lucide-react';

interface MilestoneCelebrationModalProps {
  milestone: Milestone | null;
  counter: Counter;
  onClose: () => void;
  onShare: () => void;
  soundEnabled?: boolean;
}

export const MilestoneCelebrationModal: React.FC<MilestoneCelebrationModalProps> = ({
  milestone,
  counter,
  onClose,
  onShare,
  soundEnabled = true,
}) => {
  if (!milestone) return null;

  const milestoneDate = getDateForDayNumber(counter.startDate, milestone.day);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-sm w-full p-6 text-center animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Badge Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 relative z-10">
          <Award className="w-8 h-8 text-amber-500" />
        </div>

        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Milestone Achieved!</span>
          </div>

          <h3 className="text-3xl font-extrabold font-mono text-stone-900 dark:text-white pt-2 tabular-nums">
            Day {milestone.day}
          </h3>

          <p className="text-base font-bold text-stone-800 dark:text-stone-200">
            {milestone.label}
          </p>

          <p className="text-xs text-stone-500 dark:text-stone-400 pt-1 font-mono">
            Origin: {formatDDMMYYYY(parseLocalDateString(counter.startDate))} · Reached on {formatDDMMYYYY(milestoneDate)}
          </p>
        </div>

        {/* Motivational Card */}
        <div className="my-5 p-3.5 rounded-xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-300">
          Congratulations on reaching this milestone! Keep counting and building consistency every single day.
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 relative z-10">
          <button
            onClick={() => {
              if (soundEnabled) playHapticSound('click');
              onShare();
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all shadow-xs cursor-pointer active:scale-98"
          >
            <Share2 className="w-4 h-4" />
            <span>Share Achievement</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-medium rounded-xl border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
