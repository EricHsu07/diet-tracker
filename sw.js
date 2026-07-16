// 16:8 减脂打卡 — Service Worker（离线缓存 v2）
// 策略：安装时预缓存核心文件；请求时缓存优先，网络回退；后台更新通知
const CACHE = 'diet-v2';
const FILES = [
  './',
  './diet.html',
  './manifest.json',
  './pwa-icons/icon-192.png',
  './pwa-icons/icon-512.png'
];

// ===== 安装：预缓存核心文件 =====
self.addEventListener('install', e => {
  console.log('[SW] 安装中...');
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FILES).catch(err => {
      console.warn('[SW] 预缓存部分失败:', err);
    }))
  );
  self.skipWaiting();
});

// ===== 激活：清理旧版本缓存 =====
self.addEventListener('activate', e => {
  console.log('[SW] 激活');
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log('[SW] 清理旧缓存:', k);
        return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

// ===== 请求拦截：缓存优先 + 网络回退 =====
self.addEventListener('fetch', e => {
  // 只处理 GET 请求
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // 有缓存直接返回，同时后台更新缓存
        const fetchPromise = fetch(e.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return networkResponse;
        }).catch(() => null);
        return cached;
      }
      // 无缓存则走网络
      return fetch(e.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return networkResponse;
      }).catch(() => {
        // 网络失败且无缓存：返回一个友好的离线页面
        if (e.request.mode === 'navigate') {
          return caches.match('./diet.html');
        }
        return new Response('离线状态，请连接网络后重试', { status: 503 });
      });
    })
  );
});
