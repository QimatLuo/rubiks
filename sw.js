const CACHE_VERSION = 'rubiks-v1'
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.webmanifest',
]

const getSameOriginAssetUrls = (html) => {
  const urls = new Set(APP_SHELL_URLS)
  const assetPattern = /\b(?:href|src)="([^"]+)"/g

  for (const match of html.matchAll(assetPattern)) {
    const assetUrl = new URL(match[1], self.location.origin)

    if (assetUrl.origin === self.location.origin) {
      urls.add(assetUrl.pathname + assetUrl.search)
    }
  }

  return Array.from(urls)
}

const precacheAppShell = async () => {
  const cache = await caches.open(CACHE_VERSION)
  const indexResponse = await fetch('/index.html', { cache: 'no-cache' })
  const indexHtml = await indexResponse.clone().text()
  await cache.put('/index.html', indexResponse)
  await cache.addAll(getSameOriginAssetUrls(indexHtml).filter((url) => url !== '/index.html'))
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((cacheName) => cacheName !== CACHE_VERSION)
        .map((cacheName) => caches.delete(cacheName)),
    )),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') {
    return
  }

  const requestUrl = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html')),
    )
    return
  }

  if (requestUrl.origin !== self.location.origin) {
    return
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
          const responseCopy = networkResponse.clone()
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(request, responseCopy)
          })
        }

        return networkResponse
      })
    }),
  )
})
