import { Counter, Milestone } from '../types';
import { playHapticSound, getCalendarDaysElapsed, STANDARD_MILESTONES } from './dateUtils';
import { getNotifiedMilestones, markMilestoneNotified } from './notificationUtils';

let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Register the Service Worker in the browser
 */
export async function initServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const appBase = import.meta.env.BASE_URL || '/';
    const reg = await navigator.serviceWorker.register(`${appBase}sw.js`, { scope: appBase });
    swRegistration = reg;

    // Listen for updates or state changes
    reg.addEventListener('updatefound', () => {
      const installingWorker = reg.installing;
      if (installingWorker) {
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New Service Worker version available.');
          }
        });
      }
    });

    return reg;
  } catch (error) {
    console.warn('Service worker registration failed or unsupported in current environment:', error);
    return null;
  }
}

/**
 * Check current browser notification permission
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      if (!swRegistration && 'serviceWorker' in navigator) {
        swRegistration = await navigator.serviceWorker.ready.catch(() => null);
      }
    }
    return permission;
  } catch (error) {
    console.warn('Error requesting notification permission:', error);
    return 'denied';
  }
}

/**
 * Retrieve all milestones (standard + custom) for a specific counter
 */
export function getAllMilestonesForCounter(counterId: string): Milestone[] {
  let custom: Milestone[] = [];
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(`milestones_${counterId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          custom = parsed;
        }
      } else {
        // Seed standard custom milestone (e.g. Day 15) if none exists yet
        custom = [{ day: 15, label: '15 Days Consistency' }];
      }
    } catch {}
  }

  const combined = [...STANDARD_MILESTONES, ...custom];
  // Deduplicate by day number and sort ascending
  const map = new Map<number, Milestone>();
  for (const m of combined) {
    map.set(m.day, m);
  }
  return Array.from(map.values()).sort((a, b) => a.day - b.day);
}

/**
 * Trigger a milestone notification via Service Worker or native Notification API
 */
export async function triggerMilestoneNotification(
  milestoneDay: number,
  milestoneLabel: string,
  startDate: string,
  customMessage?: string
): Promise<boolean> {
  playHapticSound('celebrate');

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const isYear = milestoneDay === 365;
  const title = isYear
    ? `🌟 1 Year Milestone Achieved! (Day 365)`
    : `🎉 Milestone Alert: Day ${milestoneDay}!`;

  const body =
    customMessage ||
    `Congratulations! You've officially reached Day ${milestoneDay} (${milestoneLabel}) from origin ${startDate}. Keep the streak alive!`;

  const icon = `${import.meta.env.BASE_URL}logo.jpg`;

  try {
    if ('serviceWorker' in navigator) {
      const reg = swRegistration || (await navigator.serviceWorker.ready.catch(() => null));
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon,
          badge: icon,
          vibrate: [200, 100, 200, 100, 200],
          tag: `milestone-${milestoneDay}`,
          renotify: true,
          data: {
            milestoneDay,
            url: new URL('?tab=milestones', reg.scope).toString(),
          },
        } as unknown as NotificationOptions);
        return true;
      }
    }

    new Notification(title, {
      body,
      icon,
      badge: icon,
      tag: `milestone-${milestoneDay}`,
    });
    return true;
  } catch (err) {
    console.warn('Failed to display native system notification:', err);
    return false;
  }
}

/**
 * Check active counter against all milestones and fire alerts for newly reached milestones
 */
export function checkAndTriggerMilestones(
  counter: Counter,
  onInAppCelebration?: (milestone: Milestone) => void
): Milestone[] {
  if (typeof window === 'undefined') return [];

  const currentDay = getCalendarDaysElapsed(counter.startDate, new Date());
  const notifiedDays = getNotifiedMilestones(counter.id);

  const milestones = getAllMilestonesForCounter(counter.id);
  const newlyHitMilestones: Milestone[] = [];

  for (const milestone of milestones) {
    // Only alert for milestones that are reached (day <= currentDay) and haven't notified yet
    if (currentDay >= milestone.day && !notifiedDays.includes(milestone.day)) {
      newlyHitMilestones.push(milestone);
      notifiedDays.push(milestone.day);
      markMilestoneNotified(counter.id, milestone.day);

      // Trigger browser/service-worker notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        triggerMilestoneNotification(
          milestone.day,
          milestone.label,
          counter.startDate
        );
      }

      // Trigger in-app visual celebration banner / modal callback
      if (onInAppCelebration) {
        onInAppCelebration(milestone);
      }
    }
  }

  return newlyHitMilestones;
}

