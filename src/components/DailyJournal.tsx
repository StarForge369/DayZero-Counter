import React, { useState, useEffect } from 'react';
import { Counter, DayNote } from '../types';
import {
  getCalendarDaysElapsed,
  getDateForDayNumber,
  formatReadableDate,
  formatDDMMYYYY,
  format12HourTime,
  toLocalDateString,
  playHapticSound,
  parseLocalDateString,
} from '../utils/dateUtils';
import { BookOpen, Plus, Trash2, Calendar, Sparkles, Tag } from 'lucide-react';
import { notifyLocalStateChanged } from '../utils/syncService';

interface DailyJournalProps {
  counter: Counter;
  initialDay?: number;
  initialDateStr?: string;
  soundEnabled?: boolean;
}

export const DailyJournal: React.FC<DailyJournalProps> = ({
  counter,
  initialDay,
  initialDateStr,
  soundEnabled = true,
}) => {
  const currentDay = getCalendarDaysElapsed(counter.startDate, new Date());
  const todayStr = toLocalDateString(new Date());

  const [notes, setNotes] = useState<DayNote[]>(() => {
    const saved = localStorage.getItem(`notes_${counter.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    // Default initial seed note for Day 0 on start date
    return [
      {
        id: `seed-0-${counter.id}`,
        counterId: counter.id,
        dayNumber: 0,
        dateStr: counter.startDate,
        text: `Origin Day 0 established on ${formatDDMMYYYY(parseLocalDateString(counter.startDate))} at ${format12HourTime(counter.startTime)}. The journey begins here.`,
        createdAt: new Date().toISOString(),
      },
    ];
  });

  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(() => {
    if (typeof initialDay === 'number') return initialDay;
    return currentDay;
  });

  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (typeof initialDay === 'number') {
      setSelectedDayNumber(initialDay);
    }
  }, [initialDay]);

  useEffect(() => {
    const reload = () => {
      try {
        const saved = localStorage.getItem(`notes_${counter.id}`);
        if (saved) setNotes(JSON.parse(saved));
      } catch {}
    };
    reload();
    window.addEventListener('dayzero_data_synced', reload);
    return () => window.removeEventListener('dayzero_data_synced', reload);
  }, [counter.id]);

  const saveNotes = (updated: DayNote[]) => {
    setNotes(updated);
    localStorage.setItem(`notes_${counter.id}`, JSON.stringify(updated));
    notifyLocalStateChanged();
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    if (soundEnabled) playHapticSound('click');

    const targetDate = getDateForDayNumber(counter.startDate, selectedDayNumber);
    const dateStr = toLocalDateString(targetDate);

    const newNote: DayNote = {
      id: `note-${Date.now()}`,
      counterId: counter.id,
      dayNumber: selectedDayNumber,
      dateStr,
      text: noteText.trim(),
      createdAt: new Date().toISOString(),
    };

    saveNotes([newNote, ...notes]);
    setNoteText('');
  };

  const handleDeleteNote = (id: string) => {
    if (soundEnabled) playHapticSound('click');
    saveNotes(notes.filter((n) => n.id !== id));
  };

  const dayTargetDate = getDateForDayNumber(counter.startDate, selectedDayNumber);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-stone-700 dark:text-stone-300" />
          <span>Daily Journal & Milestone Notes</span>
        </h2>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          Record reflections, logs, or milestones for specific days since origin date ({counter.startDate} = Day 0).
        </p>
      </div>

      {/* New Note Input Form */}
      <form
        onSubmit={handleAddNote}
        className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              Note for Day:
            </span>
            <input
              type="number"
              value={selectedDayNumber}
              onChange={(e) => setSelectedDayNumber(parseInt(e.target.value, 10) || 0)}
              className="w-20 px-2 py-1 text-xs font-mono font-bold rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none"
            />
            <span className="text-xs text-stone-500 dark:text-stone-400 font-mono">
              ({formatReadableDate(dayTargetDate, true)} · {formatDDMMYYYY(dayTargetDate)})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) playHapticSound('click');
                setSelectedDayNumber(0);
              }}
              className="px-2 py-1 text-[11px] font-mono text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white rounded bg-stone-100 dark:bg-stone-800 cursor-pointer"
            >
              Day 0
            </button>
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) playHapticSound('click');
                setSelectedDayNumber(1);
              }}
              className="px-2 py-1 text-[11px] font-mono text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white rounded bg-stone-100 dark:bg-stone-800 cursor-pointer"
            >
              Day 1
            </button>
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) playHapticSound('click');
                setSelectedDayNumber(currentDay);
              }}
              className="px-2 py-1 text-[11px] font-mono text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white rounded bg-stone-100 dark:bg-stone-800 cursor-pointer"
            >
              Today (Day {currentDay})
            </button>
          </div>
        </div>

        <div>
          <textarea
            rows={3}
            placeholder={`What happened on Day ${selectedDayNumber}? Any milestone or reflection...`}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-stone-900 dark:focus:ring-white resize-none"
            required
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save Day Note</span>
          </button>
        </div>
      </form>

      {/* Notes List */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
          Saved Day Logs ({notes.length})
        </h3>

        {notes.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 text-stone-400 text-xs">
            No notes logged yet.
          </div>
        ) : (
          [...notes]
            .sort((a, b) => b.dayNumber - a.dayNumber)
            .map((note) => {
              const noteDate = getDateForDayNumber(counter.startDate, note.dayNumber);
              return (
                <div
                  key={note.id}
                  className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 shadow-xs flex items-start justify-between gap-4 transition-colors"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-stone-900 dark:text-white bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 rounded-md">
                        Day {note.dayNumber}
                      </span>
                      <span className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                        {formatDDMMYYYY(noteDate)} · {formatReadableDate(noteDate, true)}
                      </span>
                    </div>
                    <p className="text-xs text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed">
                      {note.text}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    aria-label="Delete note"
                    className="text-stone-400 hover:text-rose-500 transition-colors p-1.5 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
};
