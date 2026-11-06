import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = new URL('../dist/', import.meta.url);
const paths = (await readdir(root, {recursive: true, withFileTypes: true})).filter(file => file.isFile() && file.name !== 'sw.js' && !file.name.startsWith('.'))
  .map(file => relative(fileURLToPath(root), join(file.parentPath, file.name)).replaceAll('\\', '/')).sort();
const hash = createHash('sha256');
for (const path of paths) hash.update(path).update(await readFile(new URL(path, root)));
const stamp = hash.digest('hex').slice(0, 16);
await writeFile(new URL('sw.js', root), `
const PREFIX = 'hollow-oath-' + new URL(self.registration.scope).pathname + '-';
const CACHE = PREFIX + '${stamp}';
const entries = ${JSON.stringify(paths)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(entries.map(path => new Request(path, {cache: 'reload'})))));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'APPLY_UPDATE') event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.registration.scope)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match('index.html')).then(cached => cached ?? fetch(event.request)));
    return;
  }
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request, {ignoreVary: true})).then(cached => cached ?? fetch(event.request)));
});
`);
