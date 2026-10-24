import React from 'react';
import { Logo } from './Logo';
import {
  Plus,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  HardDrive,
  Cloud,
  Clock,
  Flame,
  Timer,
  Flag,
  Calendar,
  Calculator,
  BookOpen,
} from 'lucide-react';
import { playHapticSound } from '../utils/dateUtils';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenNewCounter: () => void;
  onOpenBackupModal: () => void;
  onOpenCloudSyncModal: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenNewCounter,
  onOpenBackupModal,
  onOpenCloudSyncModal,
  isDarkMode,
  onToggleTheme,
  soundEnabled,
  onToggleSound,
}) => {
  const navItems = [
    { id: 'counter', label: 'Counter', icon: Clock },
    { id: 'habits', label: 'Habits', icon: Flame },
    { id: 'countdowns', label: 'Countdowns', icon: Timer },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'milestones', label: 'Milestones', icon: Flag },
    { id: 'calculator', label: 'Calculator', icon: Calculator },
    { id: 'notes', label: 'Day Notes', icon: BookOpen },
  ];

  const handleTabClick = (tabId: string) => {
    if (soundEnabled) playHapticSound('click');
    onSelectTab(tabId);
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-stone-950/95 backdrop-blur-md transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Single element brand wordmark with app logo */}
          <div className="flex items-center gap-3 shrink-0">
            <Logo size="md" showText={false} />
            <span className="text-base sm:text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100 whitespace-nowrap">
              Day Zero
            </span>
          </div>

          {/* Zone 2: Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-stone-600 dark:text-stone-400">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`transition-colors whitespace-nowrap py-1 relative cursor-pointer ${
                    isActive
                      ? 'text-stone-900 dark:text-white font-semibold'
                      : 'hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-900 dark:bg-stone-100 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action & Tools */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={() => {
                if (soundEnabled) playHapticSound('click');
                onOpenCloudSyncModal();
              }}
              aria-label="Cloud sync across devices"
              title="Sync progress across desktop and mobile"
              className="p-2 rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors cursor-pointer relative"
            >
              <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            </button>

            <button
              onClick={() => {
                if (soundEnabled) playHapticSound('click');
                onOpenBackupModal();
              }}
              aria-label="Backup and restore data"
              title="Backup and restore data"
              className="p-2 rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors cursor-pointer"
            >
              <HardDrive className="w-4 h-4" />
            </button>

            <button
              onClick={onToggleSound}
              aria-label={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
              title={soundEnabled ? 'Mute feedback audio' : 'Enable tactile audio'}
              className="p-2 rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 opacity-50" />}
            </button>

            <button
              onClick={onToggleTheme}
              aria-label="Toggle dark/light mode"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors cursor-pointer"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-700" />}
            </button>

            {/* PWA Install Button (hidden once running in standalone/installed mode) */}
            <PWAInstallButton soundEnabled={soundEnabled} />

            <button
              onClick={onOpenNewCounter}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-white bg-stone-900 dark:bg-stone-100 dark:text-stone-900 rounded-lg hover:bg-stone-800 dark:hover:bg-white transition-all shadow-xs whitespace-nowrap cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Counter</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        </div>

        {/* Mobile Horizontal Sub-Tab Bar (under header on small screens) */}
        <div className="lg:hidden flex items-center overflow-x-auto px-4 py-2 border-t border-stone-100 dark:border-stone-900 gap-1.5 bg-stone-50/70 dark:bg-stone-900/60 no-scrollbar">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-semibold shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>
    </>
  );
};
