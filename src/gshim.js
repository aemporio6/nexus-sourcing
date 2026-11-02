/* MY TOOL — runtime: Google sign-in + data in the owner's Google Drive (aemporio6), with an on-device cache.
   Provides window.claude.use("db"|"user"|"assets"|"downloads") with the same API the app modules expect.
   Demo mode (?demo): no Google, data only in this browser (used for tests and trying things safely). */
(function(){
"use strict";
const CFG = {
  clientId: "605045779540-pjncsnms1af0s9al9k0de2om67fg0hce.apps.googleusercontent.com",
  scopes: "openid email profile https://www.googleapis.com/auth/drive",
  admins: ["aemporio6@gmail.com", "maashiq123@gmail.com", "maashiq@gmail.com"], // can never be locked out
  dataOwner: "aemporio6@gmail.com",           // the account whose Drive holds the data
  folderName: "MY TOOL – DATA",
  fileName: "MYTOOL-DATA.json",
  filesFolder: "MY TOOL – FILES",
  pollMs: 45000
};
window.MYTOOL_CFG = CFG;
const DEMO = /[?&]demo\b/.test(location.search) || location.protocol === "file:";
const API = "https://www.googleapis.com";
const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
const nowIso = () => new Date().toISOString();
const lc = s => String(s || "").trim().toLowerCase();

/* ---------------- on-device cache (IndexedDB) ---------------- */
const DBN = "mytool", ST = "kv";
let _idb = null;
function idb(){ if(_idb) return _idb; _idb = new Promise((res, rej) => { const r = indexedDB.open(DBN, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); return _idb; }
async function kvGet(k){ try{ const d = await idb(); return await new Promise(res => { const t = d.transaction(ST).objectStore(ST).get(k); t.onsuccess = () => res(t.result); t.onerror = () => res(undefined); }); }catch(_){ return undefined; } }
async function kvSet(k, v){ try{ const d = await idb(); return await new Promise(res => { const t = d.transaction(ST, "readwrite"); t.objectStore(ST).put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); }); }catch(_){ return false; } }
async function kvDel(k){ try{ const d = await idb(); return await new Promise(res => { const t = d.transaction(ST, "readwrite"); t.objectStore(ST).delete(k); t.oncomplete = () => res(true); t.onerror = () => res(false); }); }catch(_){ return false; } }

/* ---------------- state ---------------- */
let me = null;            // {email, name, picture}
let token = null, tokenExp = 0, tokenClient = null;
let store = null;         // {col:{id:doc}}
let tomb = {};            // {"col/id": iso} deletions not yet seen by everyone
let dirty = {};           // {"col/id": true} local changes not yet in Drive
let remote = { fileId: null, folderId: null, filesFolderId: null, version: null, owner: null };
let readyRes; const ready = new Promise(r => readyRes = r);
const subs = {};
let pushT = null, pushing = false, pushAgain = false, pollT = null;
const cacheKey = () => "db:" + (DEMO ? "demo" : lc(me && me.email));

/* ---------------- small UI helpers (login / status) ---------------- */
const LOGO = '<img src="assets/icon-192.png" alt="" width="96" height="96" style="border-radius:50%">';
function gate(html){
  let g = document.getElementById("mt_gate");
  if(!g){ g = document.createElement("div"); g.id = "mt_gate"; document.body.appendChild(g); }
  g.innerHTML = '<div class="mt_card">' + LOGO + '<h1>MY TOOL</h1>' + html + '</div>';
  g.hidden = false;
  return g;
}
function ungate(){ const g = document.getElementById("mt_gate"); if(g) g.hidden = true; }
let lastSt = { t: "", k: "ok" };
function status(t, kind){
  lastSt = { t, k: kind || "ok" };
  const f = document.getElementById("mt_sync"); if(!f) return;
  f.textContent = t; f.dataset.kind = kind || "ok";
}
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }

/* ---------------- Google sign-in ---------------- */
function loadGis(){
  return new Promise((res, rej) => {
    if(window.google && google.accounts && google.accounts.oauth2) return res();
    const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.defer = true;
    s.onload = () => res(); s.onerror = () => rej(new Error("Google sign-in could not load. Check the internet connection."));
    document.head.appendChild(s);
  });
}
function requestToken(prompt){
  return new Promise((res, rej) => {
    tokenClient.callback = r => {
      if(r && r.access_token){ token = r.access_token; tokenExp = Date.now() + (Number(r.expires_in || 3500) - 120) * 1000; try{ sessionStorage.setItem("mt_tok", JSON.stringify({ token, tokenExp })); }catch(_){} res(token); }
      else rej(new Error((r && (r.error_description || r.error)) || "Sign-in was cancelled"));
    };
    tokenClient.error_callback = e => rej(new Error((e && (e.message || e.type)) || "Sign-in window closed"));
    try{ tokenClient.requestAccessToken({ prompt: prompt == null ? "" : prompt, hint: localStorage.getItem("mt_hint") || undefined }); }catch(e){ rej(e); }
  });
}
async function getToken(){
  if(token && Date.now() < tokenExp) return token;
  try{ await requestToken(""); return token; }
  catch(e){ status("Signed out — tap to sign in again", "bad"); throw e; }
}
async function gfetch(url, opt){
  opt = opt || {};
  for(let attempt = 0; attempt < 3; attempt++){
    const t = await getToken();
    const r = await fetch(url, { ...opt, headers: { ...(opt.headers || {}), Authorization: "Bearer " + t } });
    if(r.status === 401){ token = null; continue; }
    if(r.status === 429 || r.status >= 500){ await new Promise(z => setTimeout(z, 800 * (attempt + 1))); continue; }
    return r;
  }
  throw new Error("Google did not answer — try again in a minute");
}
async function gjson(url, opt){ const r = await gfetch(url, opt); const j = await r.json().catch(() => ({})); if(!r.ok) throw new Error((j.error && j.error.message) || ("Google error " + r.status)); return j; }

async function signIn(){
  await loadGis();
  tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CFG.clientId, scope: CFG.scopes, callback: () => {} });
  try{ const s = JSON.parse(sessionStorage.getItem("mt_tok") || "null"); if(s && s.token && Date.now() < s.tokenExp){ token = s.token; tokenExp = s.tokenExp; } }catch(_){}
  if(!token){
    await new Promise((res) => {
      const g = gate('<p>Sign in with your Google account to open your data.</p><button type="button" class="mt_btn" id="mt_signin">Sign in with Google</button><p class="mt_small" id="mt_err"></p>');
      g.querySelector("#mt_signin").onclick = async () => {
        try{ await requestToken(localStorage.getItem("mt_hint") ? "" : "select_account"); res(); }
        catch(e){ g.querySelector("#mt_err").textContent = e.message; }
      };
    });
  }
  const u = await gjson("https://www.googleapis.com/oauth2/v3/userinfo");
  me = { email: lc(u.email), name: u.name || u.email, picture: u.picture || "" };
  try{ localStorage.setItem("mt_hint", me.email); }catch(_){}
}
function signOut(){
  try{ if(token && google && google.accounts) google.accounts.oauth2.revoke(token, () => {}); }catch(_){}
  try{ sessionStorage.removeItem("mt_tok"); localStorage.removeItem("mt_hint"); }catch(_){}
  location.reload();
}

/* ---------------- Drive data file ---------------- */
async function findOrCreateFolder(name, parent, create){
  const q = "mimeType='application/vnd.google-apps.folder' and trashed=false and name='" + name.replace(/'/g, "\\'") + "'" + (parent ? " and '" + parent + "' in parents" : "");
  const j = await gjson(API + "/drive/v3/files?q=" + encodeURIComponent(q) + "&fields=files(id,name,owners(emailAddress))&pageSize=10");
  const own = (j.files || []).find(f => (f.owners || []).some(o => lc(o.emailAddress) === CFG.dataOwner)) || (j.files || [])[0];
  if(own) return own.id;
  if(!create) return null;
  const f = await gjson(API + "/drive/v3/files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: parent ? [parent] : undefined }) });
  return f.id;
}
async function findDataFile(){
  const q = "name='" + CFG.fileName + "' and trashed=false";
  const j = await gjson(API + "/drive/v3/files?q=" + encodeURIComponent(q) + "&fields=files(id,version,modifiedTime,owners(emailAddress),parents)&pageSize=20&orderBy=modifiedTime desc");
  const files = j.files || [];
  return files.find(f => (f.owners || []).some(o => lc(o.emailAddress) === CFG.dataOwner)) || null;
}
async function readRemote(){
  const r = await gfetch(API + "/drive/v3/files/" + remote.fileId + "?alt=media");
  if(!r.ok) throw new Error("Could not read the data file (" + r.status + ")");
  const j = await r.json();
  return j;
}
async function metaVersion(){
  const j = await gjson(API + "/drive/v3/files/" + remote.fileId + "?fields=version,modifiedTime,lastModifyingUser(emailAddress,displayName)");
  return j;
}
function packFile(){ return JSON.stringify({ format: "mytool-1", savedAt: nowIso(), savedBy: me ? me.email : "", data: store, tomb }); }
async function writeRemote(){
  const r = await gfetch("https://www.googleapis.com/upload/drive/v3/files/" + remote.fileId + "?uploadType=media&fields=version", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: packFile() });
  const j = await r.json().catch(() => ({}));
  if(!r.ok) throw new Error((j.error && j.error.message) || ("Save failed " + r.status));
  remote.version = j.version;
}
async function createRemote(initial){
  remote.folderId = await findOrCreateFolder(CFG.folderName, null, true);
  const boundary = "mt" + Math.random().toString(36).slice(2);
  const meta = { name: CFG.fileName, mimeType: "application/json", parents: [remote.folderId], description: "MY TOOL data — do not edit by hand" };
  store = initial || {};
  const body = "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(meta) + "\r\n--" + boundary + "\r\nContent-Type: application/json\r\n\r\n" + packFile() + "\r\n--" + boundary + "--";
  const j = await gjson("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,version", { method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + boundary }, body });
  remote.fileId = j.id; remote.version = j.version;
}

/* merge: remote is the base; our unsent local changes win for the docs we touched */
function mergeRemote(rj){
  const base = (rj && rj.data) || {};
  const rtomb = (rj && rj.tomb) || {};
  const mine = store || {};
  const next = clone(base);
  for(const key of Object.keys(dirty)){
    const [c, id] = key.split("/");
    const d = mine[c] && mine[c][id];
    next[c] = next[c] || {};
    if(d) next[c][id] = clone(d); else delete next[c][id];
  }
  for(const [key, at] of Object.entries(rtomb)){
    if(dirty[key]) continue;
    const [c, id] = key.split("/");
    if(next[c]) delete next[c][id];
  }
  const t = { ...rtomb };
  for(const [k, v] of Object.entries(tomb)) if(dirty[k]) t[k] = v;
  const cutoff = Date.now() - 30 * 864e5;           // keep deletion notes for 30 days
  for(const [k, v] of Object.entries(t)) if(Date.parse(v) < cutoff) delete t[k];
  store = next; tomb = t;
}
async function saveCache(){ await kvSet(cacheKey(), { store, tomb, dirty, version: remote.version, fileId: remote.fileId, at: nowIso() }); }

function schedulePush(){
  clearTimeout(pushT);
  saveCache();
  if(DEMO){ status("Saved on this device (demo)", "ok"); return; }
  status("Saving…", "busy");
  pushT = setTimeout(push, 1200);
}
async function push(){
  if(DEMO) return;
  if(pushing){ pushAgain = true; return; }
  if(!Object.keys(dirty).length){ status("All saved", "ok"); return; }
  if(!navigator.onLine){ status("Offline — changes kept on this device, will save when online", "warn"); return; }
  pushing = true;
  const sending = { ...dirty };
  try{
    const m = await metaVersion();
    if(String(m.version) !== String(remote.version)){
      const rj = await readRemote(); mergeRemote(rj); notifyAll();
    }
    await writeRemote();
    for(const k of Object.keys(sending)) delete dirty[k];
    await saveCache();
    status("All saved · " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), "ok");
  }catch(e){
    console.warn(e); status("Not saved yet — will retry (" + e.message + ")", "warn");
    setTimeout(push, 15000);
  }finally{
    pushing = false;
    if(pushAgain){ pushAgain = false; setTimeout(push, 300); }
  }
}
async function poll(){
  clearTimeout(pollT);
  pollT = setTimeout(poll, CFG.pollMs);
  if(DEMO || document.hidden || pushing || !remote.fileId || !navigator.onLine) return;
  try{
    const m = await metaVersion();
    if(String(m.version) !== String(remote.version)){
      const rj = await readRemote(); mergeRemote(rj); remote.version = m.version; await saveCache(); notifyAll();
      const who = m.lastModifyingUser && (m.lastModifyingUser.displayName || m.lastModifyingUser.emailAddress);
      if(who && lc(m.lastModifyingUser.emailAddress) !== (me && me.email)) status("Updated by " + who, "ok");
    }
  }catch(e){ /* quiet; next poll */ }
}

/* ---------------- access check ---------------- */
function allowedUser(){
  if(DEMO) return { role: "owner" };
  if(CFG.admins.includes(me.email)) return { role: "owner" };
  const users = (store && store.setup && store.setup.main && store.setup.main.users) || [];
  const u = users.find(x => lc(x.email || x.uid) === me.email && x.active !== false);
  return u ? { role: u.role || "va" } : null;
}

/* ---------------- start ---------------- */
async function start(){
  try{
    if(DEMO){
      me = { email: "demo@local", name: "Demo" };
      const c = await kvGet(cacheKey());
      store = (c && c.store) || clone(window.__SEED || {}) || {};
      tomb = (c && c.tomb) || {};
      if(!c) await saveCache();
      ungate(); readyRes(); return;
    }
    gate('<p>Connecting…</p>');
    await signIn();
    gate('<p>Opening your data…</p>');
    const c = await kvGet(cacheKey());
    if(c){ store = c.store || {}; tomb = c.tomb || {}; dirty = c.dirty || {}; remote.version = c.version; remote.fileId = c.fileId; }
    let f = null;
    try{ f = await findDataFile(); }
    catch(e){ if(!c) throw e; }
    if(f){
      remote.fileId = f.id; remote.folderId = (f.parents || [])[0] || null;
      const rj = await readRemote(); mergeRemote(rj); remote.version = f.version;
      if(Object.keys(dirty).length) schedulePush();
    }else if(!c){
      if(me.email !== CFG.dataOwner){
        gate('<p>Signed in as <b>' + esc(me.email) + '</b>.</p><p>The data has not been shared with this account yet. Ask the admin (' + esc(CFG.dataOwner) + ') to add you in <b>Setup › Users</b> and share the Drive folder <b>' + esc(CFG.folderName) + '</b> with you.</p><button type="button" class="mt_btn ghost" id="mt_out">Use another account</button>');
        document.getElementById("mt_out").onclick = signOut; return;
      }
      await firstRun(); return;
    }
    const ok = allowedUser();
    if(!ok){
      gate('<p>Signed in as <b>' + esc(me.email) + '</b>.</p><p>This account is not allowed to use MY TOOL. Ask the admin to add you in <b>Setup › Users</b>.</p><button type="button" class="mt_btn ghost" id="mt_out">Use another account</button>');
      document.getElementById("mt_out").onclick = signOut; return;
    }
    await saveCache();
    ungate(); readyRes(); poll();
    status("All saved", "ok");
  }catch(e){
    console.error(e);
    gate('<p class="mt_bad">' + esc(e.message || e) + '</p><button type="button" class="mt_btn" id="mt_retry">Try again</button> <button type="button" class="mt_btn ghost" id="mt_out">Use another account</button>');
    document.getElementById("mt_retry").onclick = () => location.reload();
    document.getElementById("mt_out").onclick = signOut;
  }
}
async function firstRun(){
  const g = gate('<p>Welcome, <b>' + esc(me.name) + '</b>. This is the first time MY TOOL opens on ' + esc(CFG.dataOwner) + '.</p>' +
    '<p>Choose how to start. Your data will be kept in your Google Drive, folder <b>' + esc(CFG.folderName) + '</b>.</p>' +
    '<label class="mt_btn">⬆ Load my starting file / old NEXUS backup<input type="file" id="mt_file" accept=".json,application/json" hidden></label>' +
    '<button type="button" class="mt_btn ghost" id="mt_empty">Start empty</button><p class="mt_small" id="mt_err"></p>');
  const go = async (data) => {
    try{ gate('<p>Creating your data file in Google Drive…</p>'); dirty = {}; tomb = {}; await createRemote(data); await saveCache(); ungate(); readyRes(); poll(); status("All saved", "ok"); }
    catch(e){ g.querySelector && (gate('<p class="mt_bad">' + esc(e.message) + '</p><button class="mt_btn" onclick="location.reload()">Try again</button>')); }
  };
  g.querySelector("#mt_file").onchange = async ev => {
    const file = ev.target.files[0]; if(!file) return;
    try{ const j = JSON.parse(await file.text()); const data = j.data || (j.setup ? j : null); if(!data || !data.setup) throw new Error("This file is not a MY TOOL / NEXUS backup."); await go(data); }
    catch(e){ g.querySelector("#mt_err").textContent = e.message; }
  };
  g.querySelector("#mt_empty").onclick = () => go({});
}

/* ---------------- db API used by the app ---------------- */
function notify(c){ (subs[c] || []).forEach(fn => { try{ fn(); }catch(e){ console.error(e); } }); }
function notifyAll(){ Object.keys(subs).forEach(notify); }
function touch(c, id, del){ const k = c + "/" + id; dirty[k] = true; if(del) tomb[k] = nowIso(); else delete tomb[k]; schedulePush(); }
function docRef(c, id){
  return {
    id,
    async get(){ await ready; const d = store[c] && store[c][id]; return { id, exists: !!d, data: () => d && clone(d) }; },
    async set(d){ await ready; store[c] = store[c] || {}; store[c][id] = clone(d); touch(c, id); notify(c); },
    async update(p){ await ready; store[c] = store[c] || {}; store[c][id] = { ...(store[c][id] || {}), ...clone(p) }; touch(c, id); notify(c); },
    async delete(){ await ready; if(store[c]) delete store[c][id]; touch(c, id, true); notify(c); },
    onSnapshot(fn){ const run = () => { const d = store && store[c] && store[c][id]; fn({ id, exists: !!d, data: () => d && clone(d) }); }; (subs[c] = subs[c] || []).push(run); ready.then(() => setTimeout(run, 0)); return () => { subs[c] = (subs[c] || []).filter(x => x !== run); }; }
  };
}
function colRef(c){
  const snap = () => { const docs = Object.values((store && store[c]) || {}).map(d => ({ id: d.id, exists: true, data: () => clone(d) })); return { docs, size: docs.length, empty: !docs.length }; };
  return {
    doc(id){ return docRef(c, id || Math.random().toString(36).slice(2)); },
    async add(d){ await ready; const id = Math.random().toString(36).slice(2); store[c] = store[c] || {}; store[c][id] = { ...clone(d), id }; touch(c, id); notify(c); return docRef(c, id); },
    onSnapshot(fn){ const run = () => fn(snap()); (subs[c] = subs[c] || []).push(run); ready.then(() => setTimeout(run, 0)); return () => { subs[c] = (subs[c] || []).filter(x => x !== run); }; },
    where(){ return this; }, orderBy(){ return this; }, limit(){ return this; },
    async get(){ await ready; return snap(); }
  };
}
const db = { doc(p){ const [c, id] = p.split("/"); return docRef(c, id); }, collection(c){ return colRef(c); } };

/* files people attach → Drive folder "MY TOOL – FILES" (demo: kept in this browser) */
const assetMem = {};
const assets = {
  async upload(file){
    if(DEMO){
      const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
      const id = "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); assetMem[id] = url; await kvSet("asset:" + id, url); return { id, url };
    }
    if(!remote.filesFolderId){
      const parent = remote.folderId || (await findOrCreateFolder(CFG.folderName, null, me.email === CFG.dataOwner));
      remote.filesFolderId = await findOrCreateFolder(CFG.filesFolder, parent, true);
    }
    const boundary = "mt" + Math.random().toString(36).slice(2);
    const meta = { name: file.name || "file", parents: [remote.filesFolderId] };
    const buf = new Uint8Array(await file.arrayBuffer());
    const head = new TextEncoder().encode("--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(meta) + "\r\n--" + boundary + "\r\nContent-Type: " + (file.type || "application/octet-stream") + "\r\n\r\n");
    const tail = new TextEncoder().encode("\r\n--" + boundary + "--");
    const body = new Blob([head, buf, tail]);
    const j = await gjson("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", { method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + boundary }, body });
    return { id: "drive:" + j.id, url: j.webViewLink || ("https://drive.google.com/file/d/" + j.id + "/view") };
  }
};
window.__blobUrl = id => { id = String(id || ""); if(id.startsWith("drive:")) return "https://drive.google.com/file/d/" + id.slice(6) + "/view"; if(/^https?:/.test(id)) return id; return assetMem[id] || ""; };
(async () => { try{ const d = await idb(); const keys = await new Promise(res => { const t = d.transaction(ST).objectStore(ST).getAllKeys(); t.onsuccess = () => res(t.result || []); t.onerror = () => res([]); }); for(const k of keys) if(String(k).startsWith("asset:")) assetMem[k.slice(6)] = await kvGet(k); }catch(_){} })();

function saveFile(blob, name){ const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); return { ok: true }; }
const downloads = { async save(blob, name){ return saveFile(blob, name); } };

const userApi = {
  get name(){ return me ? me.name : ""; },
  get email(){ return me ? me.email : ""; },
  async id(){ await ready; return me ? me.email : null; },
  async isOwner(){ await ready; return DEMO || !!(me && CFG.admins.includes(me.email)); }
};
window.MYTOOL = {
  get me(){ return me; }, get st(){ return lastSt; },
  async reauth(){ await requestToken(""); await push(); }, demo: DEMO, signOut, cfg: CFG,
  async syncNow(){ await push(); await poll(); },
  pending(){ return Object.keys(dirty).length; },
  async shareWith(email, role){
    if(DEMO) throw new Error("demo mode");
    if(me.email !== CFG.dataOwner && !CFG.admins.includes(me.email)) throw new Error("only an admin can share");
    const folder = remote.folderId || (await findOrCreateFolder(CFG.folderName, null, false));
    if(!folder) throw new Error("data folder not found");
    await gjson(API + "/drive/v3/files/" + folder + "/permissions?sendNotificationEmail=false", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: role || "writer", type: "user", emailAddress: email }) });
    return true;
  },
  async backup(){ await ready; saveFile(new Blob([JSON.stringify({ app: "MY TOOL", version: 4, exportedAt: nowIso(), data: store })], { type: "application/json" }), "MYTOOL-backup-" + nowIso().slice(0, 16).replace(/[:T]/g, "-") + ".json"); },
  async restore(file){
    const j = JSON.parse(await file.text()); const data = j.data || (j.setup ? j : null);
    if(!data || !data.setup) throw new Error("This is not a MY TOOL / NEXUS backup file.");
    for(const c of Object.keys(store)) for(const id of Object.keys(store[c])) if(!(data[c] && data[c][id])){ dirty[c + "/" + id] = true; tomb[c + "/" + id] = nowIso(); }
    store = clone(data);
    for(const c of Object.keys(store)) for(const id of Object.keys(store[c])) dirty[c + "/" + id] = true;
    await saveCache(); if(!DEMO) await push(); location.reload();
  }
};
window.claude = { use: async n => { await ready; return n === "db" ? db : n === "user" ? userApi : n === "assets" ? assets : n === "downloads" ? downloads : null; } };

window.addEventListener("online", () => schedulePush());
document.addEventListener("pointerdown", () => { if(!DEMO && tokenClient && me && (!token || Date.now() > tokenExp - 10 * 60000)) requestToken("").catch(() => {}); }, true);
document.addEventListener("visibilitychange", () => { if(!document.hidden) poll(); });
window.addEventListener("beforeunload", e => { if(!DEMO && Object.keys(dirty).length){ push(); e.preventDefault(); e.returnValue = ""; } });
if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
