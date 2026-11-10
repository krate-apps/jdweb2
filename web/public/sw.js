/* Navigate-only shell cache — never intercept hashed assets or API. */
const CACHE = 'jdweb-shell-v2'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  // Only handle top-level document navigations. Let the browser load JS/CSS/fonts
  // and API calls normally — intercepting assets under a path prefix breaks the SPA.
  if (event.request.mode !== 'navigate') return

  const url = new URL(event.request.url)
  if (url.pathname.includes('/api/')) return

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone()
        void caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => undefined)
        return res
      })
      .catch(async () => {
        const cached = await caches.match(event.request)
        if (cached) return cached
        return caches.match('./index.html')
      })
      .then((res) => res || fetch(event.request)),
  )
})
