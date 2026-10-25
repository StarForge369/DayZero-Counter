import React, { useState } from 'react';
import { X, Copy, Check, Cloud, RefreshCw, Smartphone, Laptop, Bell, BellOff, Link2 } from 'lucide-react';
import { getShareableSyncUrl, setCustomSyncKey } from '../utils/syncService';
import { requestNotificationPermission, getNotificationPermissionStatus, sendNativeNotification } from '../utils/notificationUtils';
import { playHapticSound } from '../utils/dateUtils';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncKey: string;
  onSyncKeyChange: (newKey: string) => void;
  onTriggerSyncNow: () => Promise<void>;
  lastSyncedAt?: string;
  isSyncing: boolean;
  soundEnabled?: boolean;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  syncKey,
  onSyncKeyChange,
  onTriggerSyncNow,
  lastSyncedAt,
  isSyncing,
  soundEnabled = true,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(() => getNotificationPermissionStatus());
  const [connectMessage, setConnectMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const shareUrl = getShareableSyncUrl(syncKey);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      if (soundEnabled) playHapticSound('click');
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(syncKey);
      if (soundEnabled) playHapticSound('click');
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const handleConnectCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    const formatted = inputCode.trim().toUpperCase();
    setCustomSyncKey(formatted);
    onSyncKeyChange(formatted);
    if (soundEnabled) playHapticSound('celebrate');
    setConnectMessage(`Connected to ${formatted}! Fetching latest cloud data...`);
    setInputCode('');
    await onTriggerSyncNow();
    setTimeout(() => setConnectMessage(null), 3000);
  };

  const handleRequestNotifications = async () => {
    const granted = await requestNotificationPermission();
    setPermissionStatus(getNotificationPermissionStatus());
    if (granted) {
      if (soundEnabled) playHapticSound('celebrate');
      sendNativeNotification('🔔 Notifications Active!', 'Day Zero will alert you when you reach any milestone.');
    } else {
      if (soundEnabled) playHapticSound('click');
    }
  };

  const handleTestNotification = () => {
    if (soundEnabled) playHapticSound('celebrate');
    sendNativeNotification('🏆 Milestone Test Alert!', 'You have completed 100 days on Day Zero!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-stone-900 dark:text-stone-100" />
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Cloud Sync & Notifications
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

        <div className="py-4 space-y-5">
          {/* Active Device Sync Key Box */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 text-center">
            <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 block mb-1">
              Your Cross-Device Sync Key
            </span>
            <div className="flex items-center justify-center gap-2 my-1">
              <span className="text-2xl font-mono font-extrabold tracking-wider text-stone-950 dark:text-white">
                {syncKey}
              </span>
              <button
                onClick={handleCopyCode}
                title="Copy Sync Code"
                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 mt-2 text-xs text-stone-500 dark:text-stone-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{lastSyncedAt ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Cloud ready'}</span>
            </div>

            <div className="mt-3.5 flex gap-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all shadow-xs cursor-pointer active:scale-98"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Mobile Sync Link'}</span>
              </button>

              <button
                onClick={() => onTriggerSyncNow()}
                disabled={isSyncing}
                title="Sync now"
                className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-800 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            </div>
          </div>

          {/* Quick Explanation */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300">
            <Smartphone className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Open this link on your phone or tablet to automatically mirror and sync your counters, habits, notes, and milestones in real-time!
            </span>
          </div>

          {/* Connect Another Device's Code */}
          <form onSubmit={handleConnectCode} className="space-y-2">
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
              Connect to an Existing Device's Sync Key
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. DAY-1234"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                className="flex-1 px-3 py-2 text-xs font-mono uppercase rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all cursor-pointer whitespace-nowrap"
              >
                Connect Key
              </button>
            </div>
            {connectMessage && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                {connectMessage}
              </p>
            )}
          </form>

          {/* Milestone Notification Settings Box */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                <span className="text-xs font-semibold text-stone-900 dark:text-white">
                  Milestone Push Notifications
                </span>
              </div>
              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                permissionStatus === 'granted'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
              }`}>
                {permissionStatus}
              </span>
            </div>

            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
              Receive alerts on desktop and mobile notification trays when hitting major or custom milestones (15 days, 100 days, 1 year, etc.).
            </p>

            <div className="flex gap-2 pt-1">
              {permissionStatus !== 'granted' ? (
                <button
                  type="button"
                  onClick={handleRequestNotifications}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Enable Push Alerts</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  <span>Send Test Milestone Alert</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
