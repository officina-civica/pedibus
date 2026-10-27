/* Service worker del Pedibus: riceve le push e le mostra; al tocco apre l'app sugli avvisi.
   Niente cache offline per ora: il database è la fonte di verità e le schermate sono leggere. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let dati = { title: "Pedibus", body: "", data: {} };
  try { dati = { ...dati, ...event.data.json() }; } catch { dati.body = event.data ? event.data.text() : ""; }
  event.waitUntil(
    self.registration.showNotification(dati.title, {
      body: dati.body,
      tag: dati.tag,
      data: dati.data,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      lang: "it",
      renotify: !!dati.tag,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/avvisi";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((finestre) => {
      for (const w of finestre) {
        if ("focus" in w) { w.navigate(url); return w.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
