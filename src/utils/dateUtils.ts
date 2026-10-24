/**
 * Utility functions for precise day calculations adhering to:
 * Start Date (e.g., 2026-10-13 / 13-10-2026) = Day 0
 * Following Day (e.g., 2026-10-14 / 14-10-2026) = Day 1
 */

export function parseDateString(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split('-').map(Number);
  return {
    year: parts[0],
    month: parts[1], // 1-indexed
    day: parts[2],
  };
}

/**
 * Returns formatted YYYY-MM-DD string from a Date in local time
 */
export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns formatted HH:mm:ss string from a Date in local time
 */
export function toLocalTimeString(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Returns integer calendar days elapsed between startDateStr (Day 0) and targetDate.
 * Target date on the exact start date returns 0 (Day 0).
 * Next calendar day returns 1 (Day 1).
 */
export function getCalendarDaysElapsed(startDateStr: string, targetDate: Date = new Date()): number {
  const { year, month, day } = parseDateString(startDateStr);
  const startUtc = Date.UTC(year, month - 1, day);
  const targetUtc = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

  const msDiff = targetUtc - startUtc;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round(msDiff / dayMs);
}

/**
 * Returns detailed live time breakdown (days, hours, minutes, seconds)
 * from start date & time to current moment.
 */
export function getLiveTimeElapsed(startDateStr: string, startTimeStr = '00:00:00', now: Date = new Date()) {
  const { year, month, day } = parseDateString(startDateStr);
  const [hours, minutes, seconds] = (startTimeStr || '00:00:00').split(':').map(Number);

  const startMoment = new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
  const diffMs = now.getTime() - startMoment.getTime();
  const isPast = diffMs >= 0;

  const absMs = Math.abs(diffMs);
  const totalSeconds = Math.floor(absMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  const remHours = totalHours % 24;
  const remMinutes = totalMinutes % 60;
  const remSeconds = totalSeconds % 60;

  // Calendar day index (Day 0 on start date)
  const calendarDay = getCalendarDaysElapsed(startDateStr, now);

  // Time remaining until the current calendar day ends (next midnight)
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const msToMidnight = Math.max(0, nextMidnight.getTime() - now.getTime());
  const hoursToNextDay = Math.floor(msToMidnight / (1000 * 60 * 60));
  const minsToNextDay = Math.floor((msToMidnight % (1000 * 60 * 60)) / (1000 * 60));
  const secsToNextDay = Math.floor((msToMidnight % (1000 * 60)) / 1000);

  // Day progress percentage (0 - 100%)
  const secondsSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const todayProgressPercent = Number(((secondsSinceMidnight / 86400) * 100).toFixed(1));

  return {
    calendarDay,
    isPast,
    totalDays,
    remHours,
    remMinutes,
    remSeconds,
    totalHours,
    totalMinutes,
    totalSeconds,
    totalWeeks: (totalDays / 7).toFixed(1),
    hoursToNextDay,
    minsToNextDay,
    secsToNextDay,
    todayProgressPercent,
  };
}

/**
 * Given a start date and a day number (where start date is Day 0),
 * returns the exact Date object for that day.
 */
export function getDateForDayNumber(startDateStr: string, dayNumber: number): Date {
  const { year, month, day } = parseDateString(startDateStr);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + dayNumber);
  return date;
}

/**
 * Formats a date into "DD-MM-YYYY" (e.g. 13-10-2026)
 */
export function formatDDMMYYYY(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

/**
 * Formats a date into readable form: "Oct 13, 2026" or "Tuesday, Oct 13, 2026"
 */
export function formatReadableDate(date: Date, includeDayName = false): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeDayName ? { weekday: 'short' } : {}),
  };
  return date.toLocaleDateString(undefined, options);
}

/**
 * Formats a 24-hour time string (e.g. "13:47:00") into 12-hour format ("1:47 PM")
 */
export function format12HourTime(timeStr?: string): string {
  if (!timeStr) return '12:00 AM';
  const [h = 0, m = 0] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hours12 = h % 12 || 12;
  return `${hours12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Formats a date into full readable form: "Tuesday, October 13, 2026"
 */
export function formatFullDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Subtle tactile web audio feedback synthesizer (no external audio required)
 */
export function playHapticSound(type: 'click' | 'celebrate' | 'reset' = 'click') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'celebrate') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.08); // E5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'reset') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }
  } catch {
    // Audio context may be restricted by browser before user gesture, safely ignore
  }
}

/**
 * Standard milestones list
 */
export const STANDARD_MILESTONES = [
  { day: 7, label: 'First Week (7 Days)' },
  { day: 14, label: 'Two Weeks (14 Days)' },
  { day: 30, label: 'One Month (30 Days)' },
  { day: 50, label: 'Half-Century (50 Days)' },
  { day: 100, label: '100 Days Club' },
  { day: 150, label: '150 Days' },
  { day: 200, label: '200 Days' },
  { day: 250, label: 'Quarter Thousand (250 Days)' },
  { day: 300, label: '300 Days' },
  { day: 365, label: 'One Full Year (365 Days)' },
  { day: 500, label: '500 Days Milestone' },
  { day: 1000, label: '1,000 Days Milestone' },
];
