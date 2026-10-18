// activeASSET Service Worker — PWA + offline cache
const CACHE_VERSION = 'activeasset-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const API_CACHE = `${CACHE_VERSION}-api`
const IMAGE_CACHE = `${CACHE_VERSION}-images`

// Resources ที่ cache ทันทีตอน install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/logo.svg',
]

// Install — precache static
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  )
  self.skipWaiting()
})

// Activate — ลบ cache เก่า
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Fetch — strategy ตามประเภท resource
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // ข้าม cross-origin
  if (url.origin !== location.origin) return

  // GET เท่านั้น
  if (request.method !== 'GET') return

  // 1. Auth API — ไม่ cache
  if (url.pathname.startsWith('/api/auth')) return

  // 2. Mutation APIs (POST/PATCH/DELETE ไม่ cache อยู่แล้ว) — แต่ GET /api/* cache แบบ network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE, 5000))
    return
  }

  // 3. รูปภาพ — cache-first
  if (request.destination === 'image' || url.pathname.startsWith('/uploads/')) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE))
    return
  }

  // 4. Static assets — stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
})

// Cache strategies
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function networkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(request, { signal: controller.signal })
    clearTimeout(timeout)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone())
    return response
  }).catch(() => cached)
  return cached || fetchPromise
}

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return
  try {
    const data = event.data.json()
    const options = {
      body: data.message || data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'activeasset',
      data: { url: data.url || '/' },
    }
    event.waitUntil(self.registration.showNotification(data.title || 'activeASSET', options))
  } catch {
    event.waitUntil(self.registration.showNotification('activeASSET', { body: event.data.text() }))
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((clients) => {
    for (const client of clients) {
      if (client.url.includes(url) && 'focus' in client) return client.focus()
    }
    if (self.clients.openWindow) return self.clients.openWindow(url)
  }))
})
