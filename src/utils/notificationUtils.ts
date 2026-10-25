/**
 * Cross-Platform Notification & Milestone Alert Engine
 * Handles Web Notifications API for Desktop & Mobile, along with in-app celebration triggers.
 */

import { Milestone } from '../types';
import { playHapticSound } from './dateUtils';

const NOTIFIED_STORAGE_PREFIX = 'dayzero_notified_milestones_';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermissionStatus(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  } catch {
    return false;
  }
}

export function sendNativeNotification(title: string, body: string) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;

  try {
    const icon = `${import.meta.env.BASE_URL}logo.jpg`;
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        return reg.showNotification(title, {
          body,
          icon,
          badge: icon,
          data: { url: new URL('?tab=milestones', reg.scope).toString() },
        });
      }).catch((err) => {
        console.warn('Service worker notification failed:', err);
      });
    } else {
      new Notification(title, {
        body,
        icon,
      });
    }
  } catch (err) {
    console.warn('Native notification trigger failed:', err);
  }
}

export function getNotifiedMilestones(counterId: string): number[] {
  try {
    const saved = localStorage.getItem(`${NOTIFIED_STORAGE_PREFIX}${counterId}`);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

export function markMilestoneNotified(counterId: string, dayNumber: number) {
  try {
    const current = getNotifiedMilestones(counterId);
    if (!current.includes(dayNumber)) {
      const updated = [...current, dayNumber];
      localStorage.setItem(`${NOTIFIED_STORAGE_PREFIX}${counterId}`, JSON.stringify(updated));
    }
  } catch {}
}

export function resetNotifiedMilestones(counterId: string) {
  try {
    localStorage.setItem(`${NOTIFIED_STORAGE_PREFIX}${counterId}`, JSON.stringify([]));
    window.dispatchEvent(new Event('dayzero_local_mutated'));
  } catch {}
}

/**
 * Checks if any milestone (standard or custom) has just been reached and not yet celebrated.
 * Returns the milestone to celebrate, or null if none.
 */
export function checkUncelebratedMilestone(
  counterId: string,
  currentDay: number,
  allMilestones: Milestone[]
): Milestone | null {
  const notified = getNotifiedMilestones(counterId);

  // Find milestones that have been reached (day <= currentDay) but not notified
  const uncelebrated = allMilestones.filter(
    (m) => currentDay >= m.day && !notified.includes(m.day)
  );

  if (uncelebrated.length === 0) return null;

  // Return the closest milestone
  return uncelebrated.sort((a, b) => b.day - a.day)[0];
}

