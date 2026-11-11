/* FC 평풋 서비스 워커: 접속할 때마다 최신 파일을 먼저 받고, 인터넷이 없을 때만 저장본을 보여줘요. */
var CACHE = "fcpp-v1";
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  var ok = url.origin === location.origin || url.hostname === "www.gstatic.com" || url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com";
  if (!ok) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && (res.ok || res.type === "opaque")) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return caches.match(req).then(function (m) { return m || caches.match("./index.html"); }); })
  );
});
/* 투표 마감 푸시 알림 (관리자 기기용) */
self.addEventListener("push", function (e) {
  var d = {};
  try { var p = e.data ? e.data.json() : {}; d = p.data || p.notification || p || {}; } catch (err) { d = { title: "스코어보드", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "스코어보드", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: "poll-closed", renotify: true
  }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ("focus" in list[i]) return list[i].focus(); }
    return self.clients.openWindow("./");
  }));
});
