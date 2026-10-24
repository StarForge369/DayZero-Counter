import React, { useState } from 'react';
import { X, Download, Upload, Check, AlertCircle, FileCheck, History } from 'lucide-react';
import { playHapticSound, toLocalDateString } from '../utils/dateUtils';
import { Counter } from '../types';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored: (restoredData: {
    counters: Counter[];
    activeCounterId: string;
    rawStorage?: Record<string, any>;
  }) => void;
  soundEnabled?: boolean;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
  soundEnabled = true,
}) => {
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = () => {
    if (soundEnabled) playHapticSound('click');

    const activeId =
      localStorage.getItem('dayzero_active_id_v5') || 'primary-origin-13-10-2026-1347';

    // Comprehensive snapshot supporting all past and modern versions
    const backup: Record<string, any> = {
      appName: 'Day Zero',
      version: 2,
      exportedAt: new Date().toISOString(),
      activeCounterId: activeId,
      counters: [],
      storage: {},
    };

    // 1. Gather all Day Zero keys from localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (
        key.startsWith('dayzero_') ||
        key.startsWith('habits_') ||
        key.startsWith('habit_checkins_') ||
        key.startsWith('notes_') ||
        key.startsWith('milestones_') ||
        key.startsWith('target_events_') ||
        key === 'theme_mode' ||
        key === 'dayzero_cloud_synckey'
      ) {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          try {
            backup.storage[key] = JSON.parse(raw);
          } catch {
            backup.storage[key] = raw;
          }
        }
      }
    }

    // 2. Populate top-level counters for instant portability
    if (backup.storage['dayzero_counters_v5']) {
      backup.counters = backup.storage['dayzero_counters_v5'];
    }

    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dayzero_backup_${toLocalDateString(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text || !text.trim()) {
          throw new Error('Backup file is empty.');
        }

        const parsed = JSON.parse(text);
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('Invalid JSON format.');
        }

        let parsedCounters: Counter[] = [];
        let parsedActiveId = 'primary-origin-13-10-2026-1347';
        const storageToWrite: Record<string, string> = {};

        // Case A: File is a bare array of counters (Format 1)
        if (Array.isArray(parsed)) {
          parsedCounters = parsed;
          parsedActiveId = parsed[0]?.id || parsedActiveId;
          storageToWrite['dayzero_counters_v5'] = JSON.stringify(parsedCounters);
          storageToWrite['dayzero_active_id_v5'] = parsedActiveId;
        } else {
          // Case B: File is an object (Format 2, 3, or legacy key-value dictionary)
          const source = (parsed.storage && typeof parsed.storage === 'object')
            ? { ...parsed, ...parsed.storage }
            : (parsed.data && typeof parsed.data === 'object')
            ? { ...parsed, ...parsed.data }
            : parsed;

          // 1. Extract counters
          if (Array.isArray(source.dayzero_counters_v5)) {
            parsedCounters = source.dayzero_counters_v5;
          } else if (typeof source.dayzero_counters_v5 === 'string') {
            try {
              parsedCounters = JSON.parse(source.dayzero_counters_v5);
            } catch {}
          } else if (Array.isArray(source.counters)) {
            parsedCounters = source.counters;
          }

          // 2. Extract active counter ID
          if (typeof source.dayzero_active_id_v5 === 'string') {
            parsedActiveId = source.dayzero_active_id_v5;
          } else if (typeof source.activeCounterId === 'string') {
            parsedActiveId = source.activeCounterId;
          } else if (parsedCounters.length > 0) {
            parsedActiveId = parsedCounters[0].id;
          }

          // 3. Extract habits & check-ins if structured as maps
          if (source.habits && typeof source.habits === 'object' && !Array.isArray(source.habits)) {
            Object.keys(source.habits).forEach((cid) => {
              storageToWrite[`habits_${cid}`] = JSON.stringify(source.habits[cid]);
            });
          }
          if (source.checkIns && typeof source.checkIns === 'object' && !Array.isArray(source.checkIns)) {
            Object.keys(source.checkIns).forEach((cid) => {
              storageToWrite[`habit_checkins_${cid}`] = JSON.stringify(source.checkIns[cid]);
            });
          }
          if (source.notes && typeof source.notes === 'object' && !Array.isArray(source.notes)) {
            Object.keys(source.notes).forEach((cid) => {
              storageToWrite[`notes_${cid}`] = JSON.stringify(source.notes[cid]);
            });
          }
          if (source.milestones && typeof source.milestones === 'object' && !Array.isArray(source.milestones)) {
            Object.keys(source.milestones).forEach((cid) => {
              storageToWrite[`milestones_${cid}`] = JSON.stringify(source.milestones[cid]);
            });
          }
          if (source.targetEvents && typeof source.targetEvents === 'object' && !Array.isArray(source.targetEvents)) {
            Object.keys(source.targetEvents).forEach((cid) => {
              storageToWrite[`target_events_${cid}`] = JSON.stringify(source.targetEvents[cid]);
            });
          }

          // 4. Extract any flat keys from legacy formats
          Object.keys(source).forEach((k) => {
            if (
              k.startsWith('dayzero_') ||
              k.startsWith('habits_') ||
              k.startsWith('habit_checkins_') ||
              k.startsWith('notes_') ||
              k.startsWith('milestones_') ||
              k.startsWith('target_events_') ||
              k === 'theme_mode'
            ) {
              const rawVal = source[k];
              if (rawVal !== undefined && rawVal !== null) {
                if (typeof rawVal === 'string') {
                  // If string is already JSON, preserve it; otherwise check if it needs stringification
                  storageToWrite[k] = rawVal;
                } else {
                  storageToWrite[k] = JSON.stringify(rawVal);
                }
              }
            }
          });

          // Ensure counters and active ID are always written
          if (parsedCounters.length > 0) {
            storageToWrite['dayzero_counters_v5'] = JSON.stringify(parsedCounters);
          }
          storageToWrite['dayzero_active_id_v5'] = parsedActiveId;
        }

        // DEEP RESTORE: Clean old dayzero keys to prevent stale orphan records
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.startsWith('dayzero_') ||
              key.startsWith('habits_') ||
              key.startsWith('habit_checkins_') ||
              key.startsWith('notes_') ||
              key.startsWith('milestones_') ||
              key.startsWith('target_events_'))
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));

        // Write all normalized backup entries into localStorage
        Object.keys(storageToWrite).forEach((k) => {
          localStorage.setItem(k, storageToWrite[k]);
        });

        if (soundEnabled) playHapticSound('celebrate');
        setImportStatus('Backup verified and restored cleanly!');
        setErrorMessage(null);

        // Notify parent with the exact restored state
        setTimeout(() => {
          onDataRestored({
            counters: parsedCounters,
            activeCounterId: parsedActiveId,
            rawStorage: storageToWrite,
          });
          onClose();
        }, 800);
      } catch (err: any) {
        console.error('Backup restore failure:', err);
        setErrorMessage(
          err?.message
            ? `Failed to restore: ${err.message}`
            : 'Unable to parse backup file. Please select a valid Day Zero backup JSON.'
        );
        setImportStatus(null);
      }
    };

    reader.onerror = () => {
      setErrorMessage('Could not read the selected file. Please try again.');
    };

    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-stone-900 dark:text-stone-100" />
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Data Backup & Deep Restore
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

        <div className="py-4 space-y-4">
          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            Download your full Day Zero dataset as a JSON backup, or restore previous backups from any past or current version across all devices.
          </p>

          {/* Export Box */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-950/50 border border-stone-200 dark:border-stone-800">
            <span className="text-xs font-semibold text-stone-900 dark:text-white block mb-1">
              Export Backup
            </span>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mb-3">
              Download your complete journey, habits, notes, and milestones as a portable JSON file.
            </p>
            <button
              onClick={handleExport}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all shadow-xs cursor-pointer active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>Download JSON Backup</span>
            </button>
          </div>

          {/* Import Box */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-950/50 border border-stone-200 dark:border-stone-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-stone-900 dark:text-white">
                Restore from Backup
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <History className="w-3 h-3" />
                All Versions Supported
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mb-3">
              Upload any previous .json backup file (current or legacy formats) to deeply restore all counters and streaks.
            </p>
            <label className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Choose Backup File</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {importStatus && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{importStatus}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
