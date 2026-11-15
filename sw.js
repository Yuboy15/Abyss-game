'use strict';
const CACHE='abyss-rebuilt-alpha1-20261115';
const ASSETS=['./','./index.html','./engine.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./assets/titanic.png','./assets/britannic.png','./assets/lusitania.png','./assets/cargo.png','./assets/queenmary.png','./assets/normandie.png','./assets/majestic.png','./assets/lusitania_black.png','./assets/cruise.png','./assets/container.png','./assets/amatola.png','./assets/edmund.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('abyss-rebuilt-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return res}).catch(()=>caches.match(event.request)))});
