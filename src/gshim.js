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
let shadow = {};          // last version of the data known to be in Drive (the common base for 3-way merges)
let revs = {};            // {"col/id": {r, h:[older revs]}} revision of every document (kept in the Drive file)
let sent = {};            // {"col/id": {r, at, del}} what this device wrote recently — to spot a write that someone else's save rolled back
let conflicts = [];       // same field changed by two people at once / renumbered records — shown in Alerts until dismissed
let metaDirty = false;
let lastPacked = null;
let retryT = null, polling = false;
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
  g.innerHTML = '<div class="mt_card">' + LOGO + '<h1><span style="color:#c4161c">MY</span> TOOL</h1>' + html + '</div>';
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
function packFile(){ return JSON.stringify({ format: "mytool-1", savedAt: nowIso(), savedBy: me ? me.email : "", data: store, tomb, revs, conflicts: conflicts.slice(-300) }); }
async function writeRemote(){
  const body = packFile(); lastPacked = body;
  const r = await gfetch("https://www.googleapis.com/upload/drive/v3/files/" + remote.fileId + "?uploadType=media&fields=version", { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
  const j = await r.json().catch(() => ({}));
  if(!r.ok) throw new Error((j.error && j.error.message) || ("Save failed " + r.status));
  remote.version = j.version;
}
async function createRemote(initial){
  remote.folderId = await findOrCreateFolder(CFG.folderName, null, true);
  const boundary = "mt" + Math.random().toString(36).slice(2);
  const meta = { name: CFG.fileName, mimeType: "application/json", parents: [remote.folderId], description: "MY TOOL data — do not edit by hand" };
  store = initial || {}; shadow = clone(store); revs = {};
  const body = "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(meta) + "\r\n--" + boundary + "\r\nContent-Type: application/json\r\n\r\n" + packFile() + "\r\n--" + boundary + "--";
  const j = await gjson("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,version", { method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + boundary }, body });
  remote.fileId = j.id; remote.version = j.version;
}

/* ---------------- merge (remote file + this device's changes) ----------------
   Per document, 3-way: base = the common version both sides started from, theirs = Drive now, mine = this device.
   - only I changed it → mine;  only they changed it → theirs;  both → merged field by field
     (objects go deeper; lists of records such as Setup users / companies are merged record by record by their id;
      a field changed by both differently → my value, and the clash is listed in Alerts so nobody's change is lost unseen)
   - two people created the same number (PO-26-0070) at the same moment → mine is renumbered; only MY records that point to it follow
   - Drive has no "save only if unchanged", so two saves can cross: every document this device wrote in the last hour is remembered
     (what it wrote + the base it wrote from). If a later save did not include it, it is merged back in, never silently dropped. */
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const newRev = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function bumpRev(k, extra){ const o = revs[k] || {}; revs[k] = { r: newRev(), h: [o.r || "0", ...(extra || []), ...(o.h || [])].filter(Boolean).slice(0, 16) }; }
let editSeq = 0;
let inflight = new Set();       // documents being written right now — an edit to one of them gets a fresh revision
let forceMine = new Set();      // restored copy / older-app cache: these win as they are
let shadowRevs = {};            // revisions of the shadow copy — to know whether Drive's copy grew from it
let held = {};                  // my edits to a record whose number was taken over by another record — waiting for it to reappear under its new number
const ident = d => d && d.createdAt ? d.createdAt + "|" + (d.createdBy || "") : null;   // who made a record, when: its identity, whatever its number
const QUIET = new Set(["updatedAt", "updatedBy", "createdAt", "createdBy", "refText", "folderName", "statusWhy", "landedAt", "_k", "fa"]); /* bookkeeping fields: later value kept, not reported */
const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const rkey = x => isObj(x) ? (x.id != null ? "id:" + x.id : x.uid != null ? "uid:" + x.uid : x.email != null ? "em:" + x.email : x.code != null ? "code:" + x.code : x.no != null ? "no:" + x.no : null) : null;
function keyedArr(a){ if(!Array.isArray(a)) return null; const m = new Map(); for(const x of a){ const k = rkey(x); if(k == null || m.has(k)) return null; m.set(k, x); } return m; }
function mergeArr(s0, t0, m0, path, clash){
  const S0 = keyedArr(s0 || []), T0 = keyedArr(t0), M0 = keyedArr(m0);
  if(!S0 || !T0 || !M0) return undefined;                         // not a list of records → caller treats as one value
  const out = [];
  const keys = [...T0.keys()]; for(const k of M0.keys()) if(!T0.has(k)) keys.push(k);
  for(const k of keys){
    const s = S0.get(k), t = T0.get(k), m = M0.get(k);
    if(t === undefined){ if(s === undefined) out.push(clone(m)); else if(!eq(m, s)){ out.push(clone(m)); clash.push({ field: path.concat(k).join("."), theirs: undefined, mine: m }); } continue; } // they removed it
    if(m === undefined){ if(s === undefined || eq(t, s)) { if(s === undefined) out.push(clone(t)); continue; } out.push(clone(t)); continue; } // I removed it (theirs changed → keep theirs)
    if(eq(m, s) || eq(m, t)){ out.push(clone(t)); continue; }
    if(eq(t, s)){ out.push(clone(m)); continue; }
    out.push(merge3(s || {}, t, m, path.concat(k), clash));
  }
  return out;
}
function merge3(sh, th, mi, path, clash){
  const out = clone(th) || {};
  const keys = new Set([...Object.keys(sh || {}), ...Object.keys(mi || {}), ...Object.keys(th || {})]);
  for(const f of keys){
    const s0 = (sh || {})[f], t0 = (th || {})[f], m0 = (mi || {})[f];
    if(eq(m0, s0)) continue;                                      // I did not touch this field → keep theirs
    if(eq(t0, s0) || eq(t0, m0)){ if(m0 === undefined) delete out[f]; else out[f] = clone(m0); continue; }
    if(isObj(s0) && isObj(t0) && isObj(m0)){ out[f] = merge3(s0, t0, m0, path.concat(f), clash); continue; }
    if(Array.isArray(t0) && Array.isArray(m0)){ const a = mergeArr(s0, t0, m0, path.concat(f), clash); if(a !== undefined){ out[f] = a; continue; } }
    if(!(path.length === 0 && QUIET.has(f))) clash.push({ field: path.concat(f).join("."), theirs: t0, mine: m0 });
    if(m0 === undefined) delete out[f]; else out[f] = clone(m0);
  }
  return out;
}
function noteConflict(o){ conflicts.push({ at: nowIso(), by: me ? me.email : "", ...o }); conflicts = conflicts.slice(-300); metaDirty = true; }
function mergeDoc(k, sh, th, mi, theirsBy){
  const clash = []; const out = merge3(sh, th, mi, [], clash);
  if(clash.length) noteConflict({ kind: "field", key: k, fields: clash.map(x => x.field), theirs: Object.fromEntries(clash.map(x => [x.field, x.theirs])), mine: Object.fromEntries(clash.map(x => [x.field, x.mine])), other: theirsBy || "" });
  return out;
}
const NUMBERED = /^(.*?)(\d{3,})$/;
const renumberable = (c, id) => c !== "setup" && /-\d{3,}$/.test(String(id));
function freeNumber(id, taken){
  const m = String(id).match(NUMBERED); if(!m) return null;
  let max = 0; for(const k of taken){ const mm = String(k).match(NUMBERED); if(mm && mm[1] === m[1]) max = Math.max(max, +mm[2]); }
  return m[1] + String(max + 1).padStart(m[2].length, "0");
}
/* did Drive's copy of document k include what this device wrote (sv.r)? */
function sawMine(k, sv, base, rrevs, rtomb){
  const [c, id] = k.split("/"); const has = !!(base[c] && base[c][id]); const rv = rrevs[k];
  if(rv && (rv.r === sv.r || (rv.h || []).includes(sv.r))) return true;
  if(!has && rtomb[k] && sv.del) return true;                     // still deleted
  if(!has && rtomb[k] && !sv.del) return !!rtomb[k] && Date.parse(rtomb[k]) > sv.at;  // deleted by someone after my write
  return false;
}
function mergeRemote(rj){
  const base = (rj && rj.data) || {};
  const rtomb = (rj && rj.tomb) || {};
  const rrevs = (rj && rj.revs) || {};
  const theirsBy = (rj && rj.savedBy) || "";
  const mine = store || {};
  const T = Date.now();
  /* 1. what base to merge each of my documents against */
  const baseOf = {};                                              // k → base doc (undefined = I created it)
  for(const [k, sv] of Object.entries(sent)){
    if(T - sv.at > 3600e3){ delete sent[k]; continue; }
    if(sawMine(k, sv, base, rrevs, rtomb)) continue;           // kept for the hour: a slower device may still save over it
    /* a later save did not include my write → merge my write back in, against the base it was made from */
    baseOf[k] = { b: sv.base, br: sv.baseR };
    if(!dirty[k]) dirty[k] = ++editSeq;
  }
  for(const k of Object.keys(dirty)) if(!baseOf[k]){ const [c, id] = k.split("/"); baseOf[k] = { b: shadow[c] && shadow[c][id], br: shadowRevs[k] && shadowRevs[k].r }; }
  /* if Drive's copy of a document did NOT grow from my base (a save that crossed), my base is not a common ancestor:
     merge as a union (nothing either side has is dropped; same field different → clash, mine kept, reported) */
  for(const [k, o] of Object.entries(baseOf)){ const rv = rrevs[k]; if(o.b !== undefined && o.br && (!rv || (rv.r !== o.br && !(rv.h || []).includes(o.br)))){ o.orig = o.b; o.b = {}; } }
  const next = clone(base); const nrevs = clone(rrevs);
  const renamed = {};
  const t = { ...rtomb };
  for(const k of Object.keys(dirty)){
    const [c, id] = k.split("/");
    const mi = mine[c] && mine[c][id];
    const sh = baseOf[k].b;
    const th = base[c] && base[c][id];
    next[c] = next[c] || {};
    const keepMine = () => { if(mi){ next[c][id] = clone(mi); delete t[k]; } else { delete next[c][id]; t[k] = tomb[k] || nowIso(); } bumpRev(k, [rrevs[k] && rrevs[k].r]); nrevs[k] = revs[k]; };
    const sh0 = baseOf[k].orig !== undefined ? baseOf[k].orig : sh;   // the real base (not the union stand-in) decides which record this is
    const shId = ident(sh0); const sameRecordStamps = sh0 !== undefined && !shId;   /* an old record that got its maker/time stamp on two devices at once is still one record */
    if(!forceMine.has(k) && !sameRecordStamps && mi && th && ident(mi) && ident(th) && ident(mi) !== ident(th) && (sh0 === undefined || shId === ident(mi) || shId === ident(th))){
      /* the number now belongs to a DIFFERENT record (two records were created with the same number) */
      const im = ident(mi); const k2id = Object.keys(next[c]).find(x => x !== id && ident(next[c][x]) === im);
      if(k2id){ const b2 = ident(sh0) === im && baseOf[k].orig === undefined ? sh : {}; next[c][k2id] = mergeDoc(c + "/" + k2id, b2, next[c][k2id], { ...mi, id: next[c][k2id].id, no: next[c][k2id].no }, theirsBy); dirty[c + "/" + k2id] = ++editSeq; bumpRev(c + "/" + k2id, [rrevs[c + "/" + k2id] && rrevs[c + "/" + k2id].r]); nrevs[c + "/" + k2id] = revs[c + "/" + k2id]; delete dirty[k]; delete held[k]; continue; }
      const mineToRenumber = mi.createdBy === (me && me.email) || (held[k] && Date.now() - held[k].since > 10 * 60000);
      if(renumberable(c, id) && mineToRenumber){
        const taken = [...Object.keys(next[c]), ...Object.keys(mine[c] || {}), ...Object.values(renamed).map(x => x.nid), ...Object.keys(rtomb).filter(x => x.startsWith(c + "/")).map(x => x.slice(c.length + 1))];
        const nid = freeNumber(id, taken); if(nid){ renamed[k] = { c, id, nid }; delete held[k]; continue; }
      }
      if(renumberable(c, id)){ held[k] = { doc: clone(mi), base: clone(ident(sh0) === ident(mi) && baseOf[k].orig === undefined ? sh : {}), since: (held[k] && held[k].since) || Date.now() }; delete dirty[k]; continue; }   // the maker's device will renumber it; my edit follows it there
    }
    if(forceMine.has(k) || eq(th, sh) || eq(th, mi)){ keepMine(); continue; }
    if(!mi){                                                      // I deleted it, someone else changed it → keep theirs
      if(th){ noteConflict({ kind: "delete", key: k, other: theirsBy, note: "Deleted on one device but changed by " + (theirsBy || "someone") + " at the same time — their version was kept" }); delete tomb[k]; delete t[k]; }
      delete dirty[k]; delete sent[k]; continue;
    }
    if(th === undefined){                                         // gone from Drive, I have it
      if(rtomb[k] && sh !== undefined) noteConflict({ kind: "undelete", key: k, other: theirsBy, note: "Someone deleted this while you were changing it — your version was kept" });
      keepMine(); continue;
    }
    if(sh === undefined){                                         // both created the same id (records without a maker/time stamp)
      if(renumberable(c, id) && !(ident(mi) && ident(mi) === ident(th))){
        const taken = [...Object.keys(next[c]), ...Object.keys(mine[c] || {}), ...Object.values(renamed).map(x => x.nid), ...Object.keys(rtomb).filter(x => x.startsWith(c + "/")).map(x => x.slice(c.length + 1))];
        const nid = freeNumber(id, taken);
        if(nid){ renamed[k] = { c, id, nid }; continue; }
      }
      next[c][id] = mergeDoc(k, {}, th, mi, theirsBy); bumpRev(k, [rrevs[k] && rrevs[k].r]); nrevs[k] = revs[k]; delete t[k]; continue;
    }
    next[c][id] = mergeDoc(k, sh, th, mi, theirsBy); bumpRev(k, [rrevs[k] && rrevs[k].r]); nrevs[k] = revs[k]; delete t[k];
  }
  /* renumber my new records that clashed with someone else's new record of the same number.
     Only MY records (and only the fields I changed) are rewritten to point to the new number. */
  const rn = Object.values(renamed);
  if(rn.length){
    const fix = o => { let s = JSON.stringify(o); for(const r of rn) s = s.split('"' + r.id + '"').join('"' + r.nid + '"'); return JSON.parse(s); };
    for(const r of rn){ const k = r.c + "/" + r.id; const nd = fix(mine[r.c][r.id]); nd.id = r.nid; if(nd.no === r.id || nd.no === r.nid) nd.no = r.nid; next[r.c][r.nid] = nd; }
    for(const k2 of Object.keys(dirty)){
      if(renamed[k2]) continue; const [c2, id2] = k2.split("/"); const m2 = mine[c2] && mine[c2][id2]; const d2 = next[c2] && next[c2][id2]; if(!m2 || !d2) continue;
      const b2 = (baseOf[k2] && baseOf[k2].b) || {};
      for(const f of Object.keys(m2)) if(!eq(m2[f], b2[f])) d2[f] = fix(d2[f]);   // only fields I changed
    }
    for(const r of rn){
      const ok = r.c + "/" + r.id, nk = r.c + "/" + r.nid;
      delete dirty[ok]; delete sent[ok]; dirty[nk] = ++editSeq; revs[nk] = { r: newRev(), h: ["0"] }; nrevs[nk] = revs[nk]; delete t[nk];
      noteConflict({ kind: "renumber", key: nk, from: r.id, to: r.nid, other: theirsBy, note: (theirsBy || "Someone") + " saved " + r.id + " at the same moment — yours is now " + r.nid });
    }
  }
  /* held edits: apply them to their record wherever it now lives (found by who made it and when) */
  for(const [k, h] of Object.entries(held)){
    const [c] = k.split("/"); const im = ident(h.doc); next[c] = next[c] || {};
    const k2id = Object.keys(next[c]).find(x => ident(next[c][x]) === im);
    if(k2id){ const k2 = c + "/" + k2id; next[c][k2id] = mergeDoc(k2, h.base || {}, next[c][k2id], { ...h.doc, id: next[c][k2id].id, no: next[c][k2id].no }, theirsBy); dirty[k2] = ++editSeq; bumpRev(k2, [rrevs[k2] && rrevs[k2].r]); nrevs[k2] = revs[k2]; delete held[k]; continue; }
    if(Date.now() - h.since > 10 * 60000){                        // its maker never renumbered it → give it a new number here
      const nid = freeNumber(k.split("/")[1], [...Object.keys(next[c]), ...Object.keys(rtomb).filter(x => x.startsWith(c + "/")).map(x => x.slice(c.length + 1))]);
      if(nid){ next[c][nid] = { ...clone(h.doc), id: nid, no: nid }; const nk = c + "/" + nid; dirty[nk] = ++editSeq; revs[nk] = { r: newRev(), h: ["0"] }; nrevs[nk] = revs[nk]; delete held[k]; noteConflict({ kind: "renumber", key: nk, from: k.split("/")[1], to: nid, note: "Two records had the same number — this one is now " + nid }); }
    }
  }
  /* one record must live under one number: if the same record (same maker + time) ended up under two numbers, keep the later number */
  for(const [c, docs] of Object.entries(next)){
    if(c === "setup" || !docs) continue; const by = {};
    for(const id of Object.keys(docs)){ if(!renumberable(c, id)) continue; const im = ident(docs[id]); if(im) (by[im] = by[im] || []).push(id); }
    for(const ids of Object.values(by)){ if(ids.length < 2) continue; ids.sort(); const keep = ids[ids.length - 1];
      for(const o of ids.slice(0, -1)){ const kk = c + "/" + keep; docs[keep] = mergeDoc(kk, {}, docs[keep], { ...docs[o], id: docs[keep].id, no: docs[keep].no }, theirsBy); delete docs[o]; t[c + "/" + o] = nowIso(); delete dirty[c + "/" + o]; dirty[kk] = ++editSeq; bumpRev(kk, [rrevs[kk] && rrevs[kk].r]); nrevs[kk] = revs[kk]; } }
  }
  for(const key of Object.keys(t)){ if(dirty[key] && !(next[key.split("/")[0]] || {})[key.split("/")[1]]) continue; const [c, id] = key.split("/"); if(!dirty[key] && next[c]) delete next[c][id]; }
  for(const [c, docs] of Object.entries(next)) for(const id of Object.keys(docs || {})) delete t[c + "/" + id];   // a document that exists is never also marked deleted
  const cutoff = Date.now() - 30 * 864e5;           // keep deletion notes for 30 days
  for(const [k, v] of Object.entries(t)) if(Date.parse(v) < cutoff) delete t[k];
  /* conflicts list: union of theirs + mine (a "checked" mark on either side wins) */
  const seen = new Map(conflicts.map(x => [x.at + x.key + x.kind, x]));
  for(const x of (rj && rj.conflicts) || []){ const y = seen.get(x.at + x.key + x.kind); if(!y) conflicts.push(x); else if(x.done && !y.done) y.done = x.done; }
  conflicts.sort((a, b) => a.at < b.at ? -1 : 1); conflicts = conflicts.slice(-300);
  store = next; tomb = t; revs = nrevs; shadow = clone(base); shadowRevs = clone(rrevs); forceMine = new Set();
}
async function saveCache(){ await kvSet(cacheKey(), { store, tomb, dirty, shadow, revs, sent, conflicts, forceMine: [...forceMine], held, shadowRevs, version: remote.version, fileId: remote.fileId, at: nowIso() }); }

function schedulePush(){
  clearTimeout(pushT);
  saveCache();
  if(DEMO){ status("Saved on this device (demo)", "ok"); return; }
  status("Saving…", "busy");
  pushT = setTimeout(push, 1200);
}
async function push(){
  if(DEMO) return false;
  if(pushing || polling){ pushAgain = true; return false; }
  if(!Object.keys(dirty).length && !metaDirty){ status("All saved", "ok"); return true; }
  if(!navigator.onLine){ status("Offline — changes kept on this device, will save when online", "warn"); return false; }
  pushing = true; clearTimeout(retryT); let ok = false;
  try{
    const m = await metaVersion();
    if(String(m.version) !== String(remote.version)){
      const rj = await readRemote(); mergeRemote(rj); remote.version = m.version; await saveCache(); notifyAll();
    }
    const wrote = { ...dirty }; metaDirty = false;
    const before = shadow, beforeRevs = shadowRevs;               // the base each written document was made from
    inflight = new Set(Object.keys(wrote));
    try{ await writeRemote(); } finally { inflight = new Set(); }
    const packed = JSON.parse(lastPacked);
    shadow = packed.data; shadowRevs = packed.revs || {};        // exactly what is in Drive now
    for(const [k, v] of Object.entries(wrote)){
      const [c, id] = k.split("/");
      const prev = sent[k] && Date.now() - sent[k].at < 3600e3 ? sent[k] : null;   /* keep the OLDEST base still within the hour, so every one of my writes since then counts as mine */
      sent[k] = { r: packed.revs && packed.revs[k] && packed.revs[k].r, at: prev ? prev.at : Date.now(), del: !(packed.data[c] && packed.data[c][id]), base: prev ? prev.base : (before[c] && before[c][id] !== undefined ? clone(before[c][id]) : undefined), baseR: prev ? prev.baseR : (beforeRevs[k] && beforeRevs[k].r) };
      if(dirty[k] === v) delete dirty[k];
    }
    if(Object.keys(dirty).length === 0) forceMine = new Set();
    dailyBackup().catch(() => {});
    await saveCache();
    status("All saved · " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), "ok");
    ok = true;
    try{ window.__mtBC && window.__mtBC.postMessage("saved"); }catch(_){}   // other MY TOOL tabs on this computer: look now
    clearTimeout(pollT); pollT = setTimeout(poll, 6000);           // look again soon: catches a save that crossed with ours
  }catch(e){
    console.warn(e); status("Not saved yet — will retry (" + e.message + ")", "warn");
    clearTimeout(retryT); retryT = setTimeout(push, 15000);
  }finally{
    pushing = false;
    if(pushAgain){ pushAgain = false; setTimeout(push, 300); }
  }
  return ok;
}
async function poll(){
  clearTimeout(pollT);
  pollT = setTimeout(poll, CFG.pollMs);
  if(DEMO || document.hidden || pushing || polling || !remote.fileId || !navigator.onLine) return;
  polling = true;
  try{
    const m = await metaVersion();
    if(String(m.version) !== String(remote.version) && !pushing){
      const rj = await readRemote(); mergeRemote(rj); remote.version = m.version; await saveCache(); notifyAll();
      if(!allowedUser()){ status("Your access was removed", "bad"); setTimeout(() => location.reload(), 1500); return; }
      const who = m.lastModifyingUser && (m.lastModifyingUser.displayName || m.lastModifyingUser.emailAddress);
      if(who && lc(m.lastModifyingUser.emailAddress) !== (me && me.email)) status("Updated by " + who, "ok");
    }
    dailyBackup().catch(() => {}); /* once a day, even on days nothing is edited */
  }catch(e){ /* quiet; next poll */ }
  finally{
    polling = false;
    if(Object.keys(dirty).length || metaDirty || pushAgain){ pushAgain = false; schedulePush(); }   // merged-back or renumbered records go out now
  }
}

/* daily safety copy of the data file (one per day, never deleted by the app) — admin only */
async function dailyBackup(){
  if(DEMO || !CFG.admins.includes(me.email) || !remote.fileId) return;
  const day = new Date().toISOString().slice(0, 10);
  if(localStorage.getItem("mt_bk") === day) return;
  const folder = remote.folderId || null; if(!folder) return;
  const bkName = "MYTOOL-DATA backup " + day + ".json";
  const ex = await gjson(API + "/drive/v3/files?q=" + encodeURIComponent("name contains 'MYTOOL-DATA backup' and trashed=false and '" + folder + "' in parents") + "&fields=files(id,name)&orderBy=name desc&pageSize=50");
  const files = ex.files || [];
  if(!files.some(f => f.name === bkName)) await gjson(API + "/drive/v3/files/" + remote.fileId + "/copy?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: bkName, parents: [folder] }) });
  localStorage.setItem("mt_bk", day);
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
    if(c){ store = c.store || {}; tomb = c.tomb || {}; dirty = c.dirty || {}; shadow = c.shadow || clone(store); forceMine = new Set(c.forceMine || (c.shadow ? [] : Object.keys(dirty))); held = c.held || {}; shadowRevs = c.shadowRevs || {}; revs = c.revs || {}; sent = c.sent || {}; conflicts = c.conflicts || []; remote.version = c.version; remote.fileId = c.fileId; }
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
function touch(c, id, del){ const k = c + "/" + id; if(!dirty[k] || !revs[k] || inflight.has(k) || (sent[k] && sent[k].r === revs[k].r)) bumpRev(k); dirty[k] = ++editSeq; if(del) tomb[k] = nowIso(); else delete tomb[k]; schedulePush(); }
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
  /* two people changed the same thing at the same time — listed in Alerts until someone checks and dismisses it */
  conflicts(){ return conflicts.filter(x => !x.done).map(x => clone(x)); },
  dismissConflict(at, key){ const x = conflicts.find(y => y.at === at && y.key === key); if(x){ x.done = { by: me ? me.email : "", at: nowIso() }; metaDirty = true; schedulePush(); } },
  /* version history: the daily backup copies in the data folder (newest first) */
  async listBackups(){
    if(DEMO) return [];
    const folder = remote.folderId; if(!folder) return [];
    const j = await gjson(API + "/drive/v3/files?q=" + encodeURIComponent("name contains 'MYTOOL-DATA backup' and trashed=false and '" + folder + "' in parents") + "&fields=files(id,name,modifiedTime,size)&orderBy=name desc&pageSize=200");
    return j.files || [];
  },
  async readBackup(id){ const r = await gfetch(API + "/drive/v3/files/" + id + "?alt=media"); if(!r.ok) throw new Error("Could not read the backup (" + r.status + ")"); const j = await r.json(); return j.data || j; },
  async restoreFromDrive(id){
    if(DEMO) throw new Error("demo mode");
    if(!CFG.admins.includes(me.email)) throw new Error("only an admin can restore");
    const data = await this.readBackup(id); if(!data || !data.setup) throw new Error("This backup file is not complete");
    /* safety copy of today's data first, so the restore itself can be undone */
    await gjson(API + "/drive/v3/files/" + remote.fileId + "/copy?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "MYTOOL-DATA before-restore " + nowIso().slice(0, 16).replace(":", "") + ".json", parents: [remote.folderId] }) });
    for(const c of Object.keys(store)) for(const id2 of Object.keys(store[c])) if(!(data[c] && data[c][id2])){ dirty[c + "/" + id2] = ++editSeq; tomb[c + "/" + id2] = nowIso(); bumpRev(c + "/" + id2); }
    store = clone(data);
    for(const c of Object.keys(store)) for(const id2 of Object.keys(store[c])){ dirty[c + "/" + id2] = ++editSeq; bumpRev(c + "/" + id2); }
    forceMine = new Set(Object.keys(dirty));                      // the restored copy wins over everything (kept in the cache until saved)
    await saveCache();
    for(let i = 0; i < 4 && Object.keys(dirty).length; i++){ if(await push()) break; await new Promise(z => setTimeout(z, 2500)); }
    if(Object.keys(dirty).length) throw new Error("Restored on this device but not yet saved to Drive — it will keep trying; do not close the app");
    location.reload();
  },
  /* activity older than N days → yearly archive file in Drive ("MYTOOL-LOG archive 2026.json"); keeps the main file small and fast */
  async archiveLog(days){
    if(DEMO || !CFG.admins.includes(me.email) || !remote.folderId) return 0;
    const cut = new Date(Date.now() - (days || 180) * 864e5).toISOString();
    const old = Object.values(store.log || {}).filter(e => e && e.at && e.at < cut); if(!old.length) return 0;
    const byYear = {}; old.forEach(e => (byYear[e.at.slice(0, 4)] = byYear[e.at.slice(0, 4)] || []).push(e));
    for(const [y, list] of Object.entries(byYear)){
      const name = "MYTOOL-LOG archive " + y + ".json";
      const ex = await gjson(API + "/drive/v3/files?q=" + encodeURIComponent("name='" + name + "' and trashed=false and '" + remote.folderId + "' in parents") + "&fields=files(id)");
      let prev = []; const fid = ex.files && ex.files[0] && ex.files[0].id;
      if(fid){ const r = await gfetch(API + "/drive/v3/files/" + fid + "?alt=media"); if(r.ok){ const j = await r.json(); prev = j.log || []; } }
      const ids = new Set(prev.map(e => e.id)); const all = prev.concat(list.filter(e => !ids.has(e.id))).sort((a, b) => a.at < b.at ? -1 : 1);
      const content = JSON.stringify({ format: "mytool-log-1", year: y, log: all });
      if(fid){ const r = await gfetch("https://www.googleapis.com/upload/drive/v3/files/" + fid + "?uploadType=media", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: content }); if(!r.ok) throw new Error("archive write failed"); }
      else{ const boundary = "mt" + Math.random().toString(36).slice(2); const body = "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify({ name, mimeType: "application/json", parents: [remote.folderId] }) + "\r\n--" + boundary + "\r\nContent-Type: application/json\r\n\r\n" + content + "\r\n--" + boundary + "--"; await gjson("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + boundary }, body }); }
    }
    for(const e of old){ delete store.log[e.id]; const k = "log/" + e.id; dirty[k] = ++editSeq; tomb[k] = nowIso(); }
    schedulePush(); return old.length;
  },
  _debug(){ return { dirty: clone(dirty), revs: clone(revs), sent: clone(sent), conflicts: clone(conflicts) }; },
  /* Drive browsing for the importer: folders/files the signed-in person can see */
  drive: {
    async list(parentId, opts){
      opts = opts || {};
      if(DEMO) return (window.__DEMO_DRIVE && window.__DEMO_DRIVE.list(parentId, opts)) || [];
      const q = [];
      if(parentId === "shared") q.push("sharedWithMe=true"); else q.push("'" + (parentId || "root") + "' in parents");
      q.push("trashed=false");
      if(opts.foldersOnly) q.push("mimeType='application/vnd.google-apps.folder'");
      if(opts.since) q.push("modifiedTime > '" + opts.since + "'");
      let out = [], pt = "";
      do{
        const j = await gjson(API + "/drive/v3/files?q=" + encodeURIComponent(q.join(" and ")) + "&fields=nextPageToken,files(id,name,mimeType,modifiedTime,size,parents)&pageSize=200&orderBy=folder,name" + (pt ? "&pageToken=" + pt : "") + "&supportsAllDrives=true&includeItemsFromAllDrives=true");
        out = out.concat(j.files || []); pt = j.nextPageToken || "";
      }while(pt && out.length < 2000);
      return out;
    },
    async download(id, mime){
      if(DEMO) return window.__DEMO_DRIVE ? window.__DEMO_DRIVE.download(id) : null;
      const exp = { "application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.google-apps.document": "text/plain" }[mime];
      const r = await gfetch(API + "/drive/v3/files/" + id + (exp ? "/export?mimeType=" + encodeURIComponent(exp) : "?alt=media&supportsAllDrives=true"));
      if(!r.ok) throw new Error("Could not download (" + r.status + ")");
      return await r.blob();
    }
  },
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
    for(const c of Object.keys(store)) for(const id of Object.keys(store[c])) if(!(data[c] && data[c][id])){ dirty[c + "/" + id] = ++editSeq; tomb[c + "/" + id] = nowIso(); }
    store = clone(data);
    for(const c of Object.keys(store)) for(const id of Object.keys(store[c])){ dirty[c + "/" + id] = ++editSeq; bumpRev(c + "/" + id); }
    for(const k of Object.keys(dirty)) forceMine.add(k);           // the loaded file wins (deletions included), kept in the cache until saved
    await saveCache();
    if(!DEMO){ for(let i = 0; i < 4 && Object.keys(dirty).length; i++){ if(await push()) break; await new Promise(z => setTimeout(z, 2500)); }
      if(Object.keys(dirty).length) throw new Error("Loaded on this device but not yet saved to Drive — it will keep trying; do not close the app"); }
    location.reload();
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
