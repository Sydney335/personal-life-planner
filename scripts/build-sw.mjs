import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = (await readdir("dist", { recursive: true })).filter(
  (f) => /\.(html|js|css|png|webmanifest)$/.test(f) && f !== "sw.js",
);
const hash = createHash("sha256");
for (const f of files) hash.update(await readFile(`dist/${f}`));
const cache = `daylight-${hash.digest("hex").slice(0, 16)}`;
await writeFile(
  "dist/sw.js",
  `
const CACHE=${JSON.stringify(cache)};
const FILES=${JSON.stringify(files.map((f) => "/" + f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('daylight-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 // Never cache auth, Supabase, user records, or arbitrary same-origin requests.
 if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
 if(e.request.mode==='navigate'){e.respondWith(caches.match('/index.html').then(r=>r||fetch(e.request)));return;}
 if(FILES.includes(u.pathname))e.respondWith(caches.match(u.pathname).then(r=>r||fetch(e.request)));
});
`,
);
console.log(`Generated offline shell: ${files.length} files, ${cache}`);
