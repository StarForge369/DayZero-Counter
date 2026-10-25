// Imported by the Workbox-generated service worker. Keep offline caching and
// lifecycle management in Workbox; this file handles only app notifications.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SHOW_MILESTONE_NOTIFICATION') return;

  const { milestoneDay, milestoneLabel, startDate, customMessage } = event.data;
  const title = milestoneDay === 365
    ? '🌟 1 Year Milestone Achieved! (Day 365)'
    : `🎉 Milestone Alert: Day ${milestoneDay}!`;
  const body = customMessage ||
    `Congratulations! You've officially achieved Day ${milestoneDay} (${milestoneLabel}) starting from ${startDate}. Keep the momentum going!`;

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: new URL('pwa-192x192.png', self.registration.scope).toString(),
    badge: new URL('icon.svg', self.registration.scope).toString(),
    tag: `milestone-day-${milestoneDay}`,
    renotify: true,
    data: {
      url: new URL('?tab=milestones', self.registration.scope).toString(),
      milestoneDay,
      milestoneLabel,
    },
    actions: [
      { action: 'view_milestones', title: '🎯 View Milestones' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url ||
    new URL('?tab=milestones', self.registration.scope).toString();

  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
    const sameOriginClient = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (sameOriginClient) {
      await sameOriginClient.navigate(targetUrl);
      return sameOriginClient.focus();
    }
    return self.clients.openWindow(targetUrl);
  }));
});

