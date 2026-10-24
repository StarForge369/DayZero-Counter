export interface Counter {
  id: string;
  title: string;
  description?: string;
  startDate: string; // YYYY-MM-DD format (e.g. '2026-10-13')
  startTime?: string; // HH:mm:ss format, defaults to '13:47:00'
  createdAt: string;
  accentColor?: string;
}

export interface DayNote {
  id: string;
  counterId: string;
  dayNumber: number;
  dateStr: string; // YYYY-MM-DD
  text: string;
  createdAt: string;
}

export interface Milestone {
  day: number;
  label: string;
  iconName?: string;
}

export interface Habit {
  id: string;
  counterId: string;
  name: string;
  category?: 'health' | 'focus' | 'mind' | 'routine';
  createdAt: string;
}

export interface HabitCheckIn {
  habitId: string;
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
}

export interface TargetEvent {
  id: string;
  counterId: string;
  title: string;
  targetDate: string; // YYYY-MM-DD
  category?: string;
  createdAt: string;
}
