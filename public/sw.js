// Day Zero Service Worker - Milestone Notifications & Offline Support
const CACHE_NAME = 'dayzero-v3';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/icon.svg',
  '/pwa-192x192.png',
  '/logo.jpg',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Precache non-critical note:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Cache-first for local static brand icons, network-first for other requests
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Bypass API routes from service worker cache
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (url.pathname === '/icon.svg' || url.pathname === '/pwa-192x192.png' || url.pathname === '/logo.jpg') {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});

// Handle milestone notification triggers from the web app
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_MILESTONE_NOTIFICATION') {
    const { milestoneDay, milestoneLabel, startDate, customMessage } = event.data;

    const isYear = milestoneDay === 365;
    const title = isYear
      ? `🌟 1 Year Milestone Achieved! (Day 365)`
      : `🎉 Milestone Alert: Day ${milestoneDay}!`;

    const body =
      customMessage ||
      `Congratulations! You've officially achieved Day ${milestoneDay} (${milestoneLabel}) starting from ${startDate}. Keep the momentum going!`;

    const options = {
      body,
      icon: '/pwa-192x192.png',
      badge: '/icon.svg',
      vibrate: [200, 100, 200, 100, 200],
      tag: `milestone-day-${milestoneDay}`,
      renotify: true,
      requireInteraction: true,
      data: {
        url: '/?tab=milestones',
        milestoneDay,
        milestoneLabel,
      },
      actions: [
        { action: 'view_milestones', title: '🎯 View Milestones' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    };

    self.registration.showNotification(title, options);
  }
});

// Focus or open app window when notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            tab: 'milestones',
            milestoneDay: event.notification.data?.milestoneDay,
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
