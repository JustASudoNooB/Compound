const CACHE_NAME = 'compound-v4';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './caveat.woff2',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];
const VOICE = [
  "./voice/f/big1.mp3",
  "./voice/f/big2.mp3",
  "./voice/f/closeE.mp3",
  "./voice/f/closeG.mp3",
  "./voice/f/closeL.mp3",
  "./voice/f/closeP.mp3",
  "./voice/f/closeZ.mp3",
  "./voice/f/done1.mp3",
  "./voice/f/done2.mp3",
  "./voice/f/gDelay.mp3",
  "./voice/f/gFinal.mp3",
  "./voice/f/gLand.mp3",
  "./voice/f/gOn.mp3",
  "./voice/f/grDown.mp3",
  "./voice/f/grFlat.mp3",
  "./voice/f/grUp.mp3",
  "./voice/f/level1.mp3",
  "./voice/f/level2.mp3",
  "./voice/f/logSaved.mp3",
  "./voice/f/near1.mp3",
  "./voice/f/near2.mp3",
  "./voice/f/peel1.mp3",
  "./voice/f/peel2.mp3",
  "./voice/f/pin1.mp3",
  "./voice/f/plan1.mp3",
  "./voice/f/plan2.mp3",
  "./voice/f/prog1.mp3",
  "./voice/f/prog2.mp3",
  "./voice/f/prog3.mp3",
  "./voice/f/s100.mp3",
  "./voice/f/s14.mp3",
  "./voice/f/s21.mp3",
  "./voice/f/s3.mp3",
  "./voice/f/s30.mp3",
  "./voice/f/s50.mp3",
  "./voice/f/s7.mp3",
  "./voice/f/start1.mp3",
  "./voice/f/start2.mp3",
  "./voice/f/start3.mp3",
  "./voice/f/test1.mp3",
  "./voice/f/tick1.mp3",
  "./voice/f/tick2.mp3",
  "./voice/f/tick3.mp3",
  "./voice/m/big1.mp3",
  "./voice/m/big2.mp3",
  "./voice/m/closeE.mp3",
  "./voice/m/closeG.mp3",
  "./voice/m/closeL.mp3",
  "./voice/m/closeP.mp3",
  "./voice/m/closeZ.mp3",
  "./voice/m/done1.mp3",
  "./voice/m/done2.mp3",
  "./voice/m/gDelay.mp3",
  "./voice/m/gFinal.mp3",
  "./voice/m/gLand.mp3",
  "./voice/m/gOn.mp3",
  "./voice/m/grDown.mp3",
  "./voice/m/grFlat.mp3",
  "./voice/m/grUp.mp3",
  "./voice/m/level1.mp3",
  "./voice/m/level2.mp3",
  "./voice/m/logSaved.mp3",
  "./voice/m/near1.mp3",
  "./voice/m/near2.mp3",
  "./voice/m/peel1.mp3",
  "./voice/m/peel2.mp3",
  "./voice/m/pin1.mp3",
  "./voice/m/plan1.mp3",
  "./voice/m/plan2.mp3",
  "./voice/m/prog1.mp3",
  "./voice/m/prog2.mp3",
  "./voice/m/prog3.mp3",
  "./voice/m/s100.mp3",
  "./voice/m/s14.mp3",
  "./voice/m/s21.mp3",
  "./voice/m/s3.mp3",
  "./voice/m/s30.mp3",
  "./voice/m/s50.mp3",
  "./voice/m/s7.mp3",
  "./voice/m/start1.mp3",
  "./voice/m/start2.mp3",
  "./voice/m/start3.mp3",
  "./voice/m/test1.mp3",
  "./voice/m/tick1.mp3",
  "./voice/m/tick2.mp3",
  "./voice/m/tick3.mp3"
  ];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL).then(function () {
        // voice clips are cached one by one so a single failure never blocks the app shell
        return Promise.all(VOICE.map(function (u) { return cache.add(u).catch(function () {}); }));
      });
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n !== CACHE_NAME; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// iOS asks for audio in byte ranges; answer those from the cached file so clips play offline
function rangeResponse(request, rangeHeader) {
  var url = request.url.split('#')[0];
  return caches.match(url, { ignoreSearch: true }).then(function (cached) {
    if (cached) return cached;
    return fetch(url).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE_NAME).then(function (c) { c.put(url, copy); }); }
      return res;
    });
  }).then(function (res) { return res.arrayBuffer(); }).then(function (buf) {
    var size = buf.byteLength;
    var m = /bytes=(\d*)-(\d*)/.exec(rangeHeader || '');
    var start = 0, end = size - 1;
    if (m) {
      if (m[1] === '' && m[2] !== '') { start = Math.max(0, size - parseInt(m[2], 10)); }
      else { start = m[1] ? parseInt(m[1], 10) : 0; end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1; }
    }
    var slice = buf.slice(start, end + 1);
    return new Response(slice, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
        'Content-Length': String(slice.byteLength),
        'Accept-Ranges': 'bytes'
      }
    });
  });
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var range = event.request.headers.get('range');
  if (range && /\.mp3$/.test(new URL(event.request.url).pathname)) {
    event.respondWith(rangeResponse(event.request, range));
    return;
  }
  // pages: try the network first so a new version shows on the first open; fall back to the cache offline
  if (event.request.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(event.request.url).pathname)) {
    event.respondWith(
      fetch(event.request).then(function (response) {
        if (response && response.ok) { var copy = response.clone(); caches.open(CACHE_NAME).then(function (c) { c.put('./index.html', copy); }); }
        return response;
      }).catch(function () {
        return caches.match(event.request).then(function (r) { return r || caches.match('./index.html'); });
      })
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var networkFetch = fetch(event.request)
        .then(function (response) {
          if (response && response.ok && response.status === 200) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
          }
          return response;
        })
        .catch(function () {
          return cached || caches.match('./index.html');
        });
      return cached || networkFetch;
    })
  );
});
