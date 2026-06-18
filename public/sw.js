const CACHE='rzbal-hub-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/'])).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(n=>Promise.all(n.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.pathname.startsWith('/api/')||u.pathname.startsWith('/mail/')||u.pathname.startsWith('/9router/')||u.pathname.startsWith('/socket.io/'))return;
  if(u.pathname.startsWith('/assets/')||u.pathname.startsWith('/fonts/')){
    e.respondWith(caches.open(CACHE).then(c=>c.match(e.request).then(h=>{const f=fetch(e.request).then(r=>{if(r.ok)c.put(e.request,r.clone());return r}).catch(()=>h);return h||f})));
    return;
  }
  if(e.request.headers.get('accept')?.includes('text/html')){
    e.respondWith(fetch(e.request).then(r=>{if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>caches.match(e.request).then(c=>c||caches.match('/'))));
  }
});
