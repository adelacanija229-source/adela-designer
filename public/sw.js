const CACHE_NAME = 'adela-cache-v1.21'; // 버전 업데이트 시 캐시 이름도 변경
const ASSETS_TO_CACHE = [
  './',
  './index.html'
];

// 설치 시 즉시 활성화 준비 (기다리지 않음)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 활성화 시 오래된 캐시 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

// 네트워크 우선 전략 (Network-First) - 업데이트에 민감한 앱에 적합
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
