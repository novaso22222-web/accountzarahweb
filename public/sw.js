// Network-first service worker: үргэлж шинэ хувилбарыг татаж, сүлжээ тасарвал cache-ээс үзүүлнэ.
// Supabase, CDN, гадны зураг зэрэг өөр домэйний хүсэлтийг огт хөндөхгүй.
const CACHE = 'gameaccount-v2';
const CORE = [
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/account-hudaldaa-logo.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll(CORE))
            .then(() => self.skipWaiting())
            .catch(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/')) return;

    event.respondWith(
        fetch(req)
            .then((res) => {
                if (res && res.ok && res.type === 'basic') {
                    const copy = res.clone();
                    caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
                }
                return res;
            })
            .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html')))
    );
});
