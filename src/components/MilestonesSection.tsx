import React, { useState, useEffect } from 'react';
import { Counter, Milestone } from '../types';
import {
  getCalendarDaysElapsed,
  getDateForDayNumber,
  formatReadableDate,
  formatDDMMYYYY,
  STANDARD_MILESTONES,
  playHapticSound,
} from '../utils/dateUtils';
import {
  Flag,
  CheckCircle2,
  Clock,
  Plus,
  Target,
  Trash2,
  Bell,
  BellRing,
  BellOff,
  Sparkles,
  RotateCcw,
  Cpu,
  Calendar,
} from 'lucide-react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  triggerMilestoneNotification,
  getAllMilestonesForCounter,
} from '../utils/notificationService';
import { notifyLocalStateChanged } from '../utils/syncService';

interface MilestonesSectionProps {
  counter: Counter;
  onTriggerInAppAlert?: (milestone: Milestone) => void;
}

export const MilestonesSection: React.FC<MilestonesSectionProps> = ({
  counter,
  onTriggerInAppAlert,
}) => {
  const currentDay = getCalendarDaysElapsed(counter.startDate, new Date());

  const [customMilestones, setCustomMilestones] = useState<Milestone[]>(() => {
    try {
      const saved = localStorage.getItem(`milestones_${counter.id}`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    // Seed requested custom milestone (Day 15) if none exists
    return [{ day: 15, label: '15 Days Consistency' }];
  });

  const [newDayInput, setNewDayInput] = useState('');
  const [newLabelInput, setNewLabelInput] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Notification and SW state
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationPermission()
  );
  const [swActive, setSwActive] = useState<boolean>(false);
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => setSwActive(true))
        .catch(() => setSwActive(false));
    }
  }, []);

  useEffect(() => {
    const reload = () => {
      try {
        const saved = localStorage.getItem(`milestones_${counter.id}`);
        if (saved) setCustomMilestones(JSON.parse(saved));
      } catch {}
    };
    reload();
    window.addEventListener('dayzero_data_synced', reload);
    return () => window.removeEventListener('dayzero_data_synced', reload);
  }, [counter.id]);

  const allMilestones: Milestone[] = [
    ...STANDARD_MILESTONES,
    ...customMilestones,
  ]
    // Deduplicate by day number
    .filter((m, idx, self) => self.findIndex((x) => x.day === m.day) === idx)
    .sort((a, b) => a.day - b.day);

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    const day = parseInt(newDayInput, 10);
    if (isNaN(day) || day <= 0 || !newLabelInput.trim()) return;

    playHapticSound('celebrate');
    const newMilestone: Milestone = { day, label: newLabelInput.trim() };
    const updated = [...customMilestones.filter((m) => m.day !== day), newMilestone];
    setCustomMilestones(updated);
    localStorage.setItem(`milestones_${counter.id}`, JSON.stringify(updated));
    notifyLocalStateChanged();
    setNewDayInput('');
    setNewLabelInput('');
    setShowAddForm(false);

    // If day is already reached, trigger immediate alert
    if (currentDay >= day) {
      triggerMilestoneNotification(day, newMilestone.label, counter.startDate);
      if (onTriggerInAppAlert) onTriggerInAppAlert(newMilestone);
    }
    setAlertFeedback(`Custom milestone "Day ${day} (${newMilestone.label})" armed for notification alerts!`);
    setTimeout(() => setAlertFeedback(null), 4000);
  };

  const handleDeleteCustom = (day: number) => {
    playHapticSound('click');
    const updated = customMilestones.filter((m) => m.day !== day);
    setCustomMilestones(updated);
    localStorage.setItem(`milestones_${counter.id}`, JSON.stringify(updated));
    notifyLocalStateChanged();
  };

  const handleRequestPermission = async () => {
    playHapticSound('click');
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      setAlertFeedback('Milestone alerts enabled! You will be alerted via Browser Notification & Service Worker.');
    } else if (result === 'denied') {
      setAlertFeedback('Notification permission was blocked in browser settings.');
    }
    setTimeout(() => setAlertFeedback(null), 4500);
  };

  const handleTestAlert = async (milestone: Milestone) => {
    playHapticSound('celebrate');
    const isYear = milestone.day === 365;
    const customMessage = isYear
      ? `🌟 1 Year Complete (Day 365)! Service worker and notification trigger verified successfully.`
      : `Test Alert Trigger: Day ${milestone.day} (${milestone.label}) reached from origin ${counter.startDate}!`;

    const sent = await triggerMilestoneNotification(
      milestone.day,
      milestone.label,
      counter.startDate,
      customMessage
    );

    if (onTriggerInAppAlert) {
      onTriggerInAppAlert(milestone);
    }

    if (sent) {
      setAlertFeedback(`Service Worker & Browser Notification triggered for Day ${milestone.day}!`);
    } else {
      setAlertFeedback(`In-app celebration modal launched! (Enable browser notification permission for system popups).`);
    }
    setTimeout(() => setAlertFeedback(null), 4500);
  };

  const handleResetNotifiedHistory = () => {
    playHapticSound('click');
    localStorage.removeItem(`notified_milestones_${counter.id}`);
    setAlertFeedback('Milestone alert history reset. Milestones will trigger alert anew.');
    setTimeout(() => setAlertFeedback(null), 3000);
  };

  const achievedCount = allMilestones.filter((m) => m.day <= currentDay).length;

  // Preset milestones requested by user: 15 Days (Custom), 100 Days (Major), 1 Year (Major)
  const milestone15 = allMilestones.find((m) => m.day === 15) || { day: 15, label: '15 Days Consistency' };
  const milestone100 = allMilestones.find((m) => m.day === 100) || { day: 100, label: '100 Days Club' };
  const milestone1Year = allMilestones.find((m) => m.day === 365) || { day: 365, label: 'One Full Year (365 Days)' };

  return (
    <div className="space-y-6">
      {/* Header and Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-stone-700 dark:text-stone-300" />
            <span>Journey Milestones & Notification Triggers</span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mt-1">
            <span>Current: Day {currentDay}</span>
            <span aria-hidden="true">·</span>
            <span>
              {achievedCount} of {allMilestones.length} milestones reached
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[11px] text-stone-400">
              Active Counter: {counter.title}
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all self-start sm:self-auto cursor-pointer shadow-xs active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Custom Milestone</span>
        </button>
      </div>

      {/* Service Worker / Browser Notification Control Panel */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                permission === 'granted'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
              }`}
            >
              {permission === 'granted' ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-stone-900 dark:text-white">
                  Milestone Notification Service Worker
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                    permission === 'granted'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : permission === 'denied'
                      ? 'bg-rose-500/10 text-rose-600'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  {permission === 'granted'
                    ? 'Alerts Active (Browser + Service Worker)'
                    : permission === 'denied'
                    ? 'Blocked by Browser'
                    : 'Permission Not Granted'}
                </span>
                {swActive && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Cpu className="w-3 h-3" />
                    SW Registered
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-xl">
                Background service worker and native browser notifications trigger automatically when your active counter hits major milestones (100 days, 1 year) or custom targets (like 15 days).
              </p>
            </div>
          </div>

          {/* Action triggers */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {permission !== 'granted' && permission !== 'unsupported' && (
              <button
                onClick={handleRequestPermission}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Enable Alerts</span>
              </button>
            )}

            <button
              onClick={handleResetNotifiedHistory}
              title="Reset alert history for this counter so milestones can re-trigger"
              className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Test Trigger Row */}
        <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Test Trigger Quick Actions:</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleTestAlert(milestone15)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors font-medium cursor-pointer"
            >
              <Bell className="w-3 h-3 text-amber-500" />
              <span>Test 15 Days (Custom)</span>
            </button>
            <button
              onClick={() => handleTestAlert(milestone100)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors font-medium cursor-pointer"
            >
              <Bell className="w-3 h-3 text-amber-500" />
              <span>Test 100 Days (Major)</span>
            </button>
            <button
              onClick={() => handleTestAlert(milestone1Year)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors font-medium cursor-pointer"
            >
              <Bell className="w-3 h-3 text-amber-500" />
              <span>Test 1 Year (365d)</span>
            </button>
          </div>
        </div>

        {alertFeedback && (
          <div className="mt-3 p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-mono animate-in fade-in flex items-center justify-between">
            <span>{alertFeedback}</span>
            <button
              onClick={() => setAlertFeedback(null)}
              className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xs ml-2 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Add Custom Milestone Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddMilestone}
          className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center gap-3 animate-in fade-in shadow-xs"
        >
          <div className="w-full sm:w-32">
            <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
              Target Day #
            </label>
            <input
              type="number"
              min={1}
              placeholder="e.g. 15"
              value={newDayInput}
              onChange={(e) => setNewDayInput(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-stone-900 dark:focus:ring-white"
              required
            />
          </div>

          <div className="w-full sm:flex-1">
            <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
              Milestone Name / Goal
            </label>
            <input
              type="text"
              placeholder="e.g. 15 Days Consistency"
              value={newLabelInput}
              onChange={(e) => setNewLabelInput(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-stone-900 dark:focus:ring-white"
              required
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto sm:mt-5 w-full sm:w-auto">
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all cursor-pointer flex-1 sm:flex-initial"
            >
              Save & Arm Alert
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Milestones Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allMilestones.map((m) => {
          const isAchieved = currentDay >= m.day;
          const isNext =
            !isAchieved &&
            allMilestones.filter((x) => x.day > currentDay)[0]?.day === m.day;
          const targetDate = getDateForDayNumber(counter.startDate, m.day);
          const daysRemaining = m.day - currentDay;
          const progressPercent = Math.min(100, Math.max(0, (currentDay / m.day) * 100));
          const isCustom = customMilestones.some((c) => c.day === m.day);

          return (
            <div
              key={m.day}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                isAchieved
                  ? 'bg-stone-50/50 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800'
                  : isNext
                  ? 'bg-white dark:bg-stone-900 border-stone-900 dark:border-stone-100 shadow-xs ring-1 ring-stone-900/10 dark:ring-stone-100/10'
                  : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-stone-900 dark:text-white">
                        Day {m.day}
                      </span>
                      {isCustom && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                          Custom
                        </span>
                      )}
                      {isAchieved ? (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Achieved</span>
                        </span>
                      ) : isNext ? (
                        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          Next Target ({daysRemaining}d to go)
                        </span>
                      ) : (
                        <span className="text-[11px] text-stone-400 dark:text-stone-500">
                          {daysRemaining} days left
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200 mt-1">
                      {m.label}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTestAlert(m)}
                      title={`Trigger alert test for Day ${m.day}`}
                      className="text-stone-400 hover:text-amber-500 p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5" />
                    </button>
                    {isCustom && (
                      <button
                        onClick={() => handleDeleteCustom(m.day)}
                        aria-label="Delete custom milestone"
                        className="text-stone-400 hover:text-rose-500 transition-colors p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Date details */}
                <div className="mt-3 text-xs text-stone-500 dark:text-stone-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Target Date:</span>
                    <span className="font-medium text-stone-800 dark:text-stone-200 font-mono">
                      {formatReadableDate(targetDate, true)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>DD-MM-YYYY:</span>
                    <span className="font-mono">{formatDDMMYYYY(targetDate)}</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800/80">
                <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      isAchieved
                        ? 'bg-emerald-500'
                        : isNext
                        ? 'bg-stone-900 dark:bg-stone-100'
                        : 'bg-stone-400 dark:bg-stone-600'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-stone-400 mt-1">
                  <span>{Math.round(progressPercent)}%</span>
                  <span>{isAchieved ? 'Completed' : `${daysRemaining} days remaining`}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
