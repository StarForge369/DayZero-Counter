import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, Check, Share } from 'lucide-react';
import { playHapticSound } from '../utils/dateUtils';

interface PWAInstallButtonProps {
  soundEnabled?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ soundEnabled = true }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // If already running as an installed standalone app, NEVER render
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (soundEnabled) playHapticSound('click');

    if (isInstallable) {
      const installed = await install();
      if (installed && soundEnabled) {
        playHapticSound('celebrate');
      }
    } else {
      // Show iOS / generic browser guide modal
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        title="Install Day Zero on Desktop or Mobile"
        aria-label="Install Day Zero App"
        className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
      >
        <Download className="w-3.5 h-3.5 text-stone-700 dark:text-stone-300" />
        <span className="hidden sm:inline">Install App</span>
        <span className="sm:hidden">Install</span>
      </button>

      {/* Guide Modal for iOS Safari and other browsers */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-stone-900 dark:text-white" />
                <h3 className="text-base font-bold text-stone-900 dark:text-white">
                  Install Day Zero
                </h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                aria-label="Close"
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                Install Day Zero to your home screen or desktop dock for instant access and standalone fullscreen experience.
              </p>

              {isIOS ? (
                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 space-y-2 text-xs text-stone-700 dark:text-stone-300">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-[11px] font-mono font-bold shrink-0">
                      1
                    </span>
                    <span className="pt-0.5">
                      Tap the <strong className="text-stone-900 dark:text-white inline-flex items-center gap-1"><Share className="w-3.5 h-3.5 inline" /> Share</strong> button in Safari's bottom toolbar.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-[11px] font-mono font-bold shrink-0">
                      2
                    </span>
                    <span className="pt-0.5">
                      Scroll down and tap <strong className="text-stone-900 dark:text-white">Add to Home Screen</strong>.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 space-y-2 text-xs text-stone-700 dark:text-stone-300">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-[11px] font-mono font-bold shrink-0">
                      1
                    </span>
                    <span className="pt-0.5">
                      Look for the <strong className="text-stone-900 dark:text-white">Install</strong> icon in your browser address bar (top right).
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-[11px] font-mono font-bold shrink-0">
                      2
                    </span>
                    <span className="pt-0.5">
                      Or click your browser's menu (three dots) and select <strong className="text-stone-900 dark:text-white">Install Day Zero</strong>.
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowGuideModal(false)}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all cursor-pointer"
              >
                <span>Got It</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
