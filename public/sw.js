self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response("Sin conexión. Abre LavaYa cuando vuelvas a tener internet.", {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
    ),
  );
});
