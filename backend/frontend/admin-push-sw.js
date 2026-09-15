self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: "MyBets Admin", body: event.data?.text?.() || "Nova atualização no painel." };
  }

  const title = data.title || "MyBets Admin";
  const badgeCount = Math.max(0, Number(data.badge || 0));
  const options = {
    body: data.body || "Você tem uma nova atualização no painel administrativo.",
    icon: data.icon || "/assets/admin-icon.svg",
    badge: data.badgeIcon || "/assets/admin-icon.svg",
    tag: data.tag || "mybets-admin",
    renotify: true,
    data: { url: data.url || "/admin.html" }
  };

  const tasks = [self.registration.showNotification(title, options)];
  if (self.navigator && "setAppBadge" in self.navigator) {
    tasks.push(
      badgeCount > 0
        ? self.navigator.setAppBadge(badgeCount)
        : self.navigator.clearAppBadge()
    );
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/admin.html";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
