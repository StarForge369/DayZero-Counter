import React, { useState } from 'react';
import { X, Download, Upload, Check, AlertCircle, FileCheck } from 'lucide-react';
import { playHapticSound, toLocalDateString } from '../utils/dateUtils';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored: (restoredData?: Record<string, any>) => void;
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

    const activeId = localStorage.getItem('dayzero_active_id_v5') || 'primary-origin-13-10-2026-1347';
    const backup: Record<string, any> = {
      appName: 'Day Zero',
      version: 2,
      exportedAt: new Date().toISOString(),
      activeCounterId: activeId,
      storage: {},
    };

    // Collect all Day Zero related items from localStorage
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
        key === 'theme_mode'
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
          throw new Error('Backup file is empty');
        }

        const parsed = JSON.parse(text);
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('Invalid backup JSON structure');
        }

        // Determine if backup has nested storage or is a flat key-value dictionary
        const sourceMap = parsed.storage && typeof parsed.storage === 'object'
          ? parsed.storage
          : parsed;

        const restoredData: Record<string, any> = {};

        Object.keys(sourceMap).forEach((key) => {
          // Ignore top-level metadata keys if flat
          if (['version', 'appName', 'exportedAt', 'storage'].includes(key)) return;

          const val = sourceMap[key];
          if (val === undefined || val === null) return;

          // Safely serialize objects to JSON strings for localStorage
          const strValue = typeof val === 'string' ? val : JSON.stringify(val);
          localStorage.setItem(key, strValue);

          // Keep in restoredData
          try {
            restoredData[key] = typeof val === 'string' ? JSON.parse(val) : val;
          } catch {
            restoredData[key] = val;
          }
        });

        // Ensure active counter is tracked
        if (parsed.activeCounterId) {
          localStorage.setItem('dayzero_active_id_v5', parsed.activeCounterId);
          restoredData['dayzero_active_id_v5'] = parsed.activeCounterId;
        }

        if (soundEnabled) playHapticSound('celebrate');
        setImportStatus('Backup verified and restored successfully!');
        setErrorMessage(null);

        setTimeout(() => {
          onDataRestored(restoredData);
          onClose();
        }, 1000);
      } catch (err: any) {
        console.error('Backup restore failure:', err);
        setErrorMessage(
          err?.message ? `Restore error: ${err.message}` : 'Failed to parse backup file. Please select a valid Day Zero JSON backup.'
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
              Data Backup & Restore
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
            Download your full Day Zero dataset (counters, daily habit check-ins, journal notes, target countdowns) as a JSON backup file, or restore a previous backup on any device.
          </p>

          {/* Export Box */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-950/50 border border-stone-200 dark:border-stone-800">
            <span className="text-xs font-semibold text-stone-900 dark:text-white block mb-1">
              Export Backup
            </span>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mb-3">
              Download your entire history into a clean JSON file.
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
            <span className="text-xs font-semibold text-stone-900 dark:text-white block mb-1">
              Restore from Backup
            </span>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mb-3">
              Upload a previously exported .json file to restore all counters, habits, notes, and milestones.
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
