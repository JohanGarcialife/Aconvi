// Aconvi Service Worker — Web Push Notifications
// Registered automatically when the user enables notifications in the dashboard

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Aconvi", body: event.data.text() };
  }

  const title = payload.title ?? "Aconvi";
  const options = {
    body: payload.body ?? "",
    icon: "/icon-192x192.png",
    badge: "/badge-72x72.png",
    data: payload.data ?? {},
    vibrate: [100, 50, 100],
    actions: payload.data?.incidentId
      ? [
          { action: "open", title: "Ver incidencia" },
          { action: "dismiss", title: "Descartar" },
        ]
      : [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const data = event.notification.data ?? {};
  let url = "/incidents";

  if (data.incidentId) {
    url = `/incidents/${data.incidentId}`;
  } else if (data.noticeId) {
    url = "/communication";
  }

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});
