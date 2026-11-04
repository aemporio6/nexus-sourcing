/* MY TOOL — DATA GATEWAY (Google Apps Script web app, runs as the data owner aemporio6)
   WHY: the app is a static page. Without this gateway every editor needs Drive "writer" on the data file and could change it
   outside the app. With the gateway, nobody but the owner has Drive access to the data: every read and write comes here,
   the caller is identified by their Google token, and the role rules from Setup › Users are enforced HERE, at the data boundary.
   It also gives real compare-and-swap saves (a save made from an old version is refused and the newer file returned).

   SET UP ONCE (as aemporio6):
   1. https://script.google.com → New project → paste this file → save as "MY TOOL gateway".
   2. Project settings → tick "Show appsscript.json"; in appsscript.json set
        "oauthScopes": ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/script.external_request", "https://www.googleapis.com/auth/script.scriptapp"]
   3. Run `selfTest` once (allow permissions). It must print "OK".
   4. Deploy → New deployment → type "Web app" → Execute as: Me · Who has access: Anyone → Deploy → copy the Web app URL.
   5. In MY TOOL (signed in as admin): Setup › Users › Data gateway → paste the URL → "Use gateway". Then "Lock data folder"
      (removes everyone else's Drive access to the data; attachments folder stays shared).
   Nothing is stored here except a version counter. No Client Secret anywhere.                                                      */

var CLIENT_ID = "605045779540-pjncsnms1af0s9al9k0de2om67fg0hce.apps.googleusercontent.com";
var ADMINS = ["aemporio6@gmail.com", "maashiq123@gmail.com", "maashiq@gmail.com"];
var OWNER = "aemporio6@gmail.com";   /* the account this script runs as */
var FOLDER = "MY TOOL – DATA", FILE = "MYTOOL-DATA.json", FILES_FOLDER = "MY TOOL – FILES";
var SENSITIVE = ["bank", "beneficiary", "account", "accountNo", "iban", "swift", "sortCode", "sort", "routing", "number"]; /* hidden from roles without "bank" */
var MAX_UPLOAD = 20 * 1024 * 1024;

/* ================= entry ================= */
function doPost(e){
  var t0 = Date.now(), req = {}, out;
  try{
    req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    out = handle(req);
  }catch(err){
    out = { error: String(err && err.message || err), status: err && err.status || 500 };
  }
  try{ if(req.op === "write" || out.status >= 400) logLine((out.status >= 400 ? "REFUSED " : "ok ") + (req.op || "?") + " " + (out.email || "-") + " " + (out.error || "") + " " + (Date.now() - t0) + "ms"); }catch(_){}
  delete out.email;
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function doGet(){ return ContentService.createTextOutput(JSON.stringify({ app: "MY TOOL gateway", ok: true })).setMimeType(ContentService.MimeType.JSON); }

/* key-order-independent comparison: a redacted-then-reattached record must compare equal */
function canon(x){ if(x === null || typeof x !== "object") return JSON.stringify(x); if(Array.isArray(x)) return "[" + x.map(canon).join(",") + "]"; return "{" + Object.keys(x).sort().map(function(k){ return JSON.stringify(k) + ":" + canon(x[k]); }).join(",") + "}"; }
function fail(status, msg){ var e = new Error(msg); e.status = status; throw e; }

function handle(req){
  var email = verifyToken(req.token);
  var cur = readCurrent();                                   // { json, text, file } or null
  var who = whoIs(email, cur && cur.json);                   // { admin, perms, user } or null
  if(!who && req.op !== "meta") fail(403, "This account is not allowed to use MY TOOL. Ask the admin to add you in Setup › Users.");
  var v = version();
  switch(req.op){
    case "meta":    if(!who) fail(403, "not allowed"); return { ok: true, exists: !!cur, version: v, savedBy: cur && cur.json.savedBy || "", savedAt: cur && cur.json.savedAt || "", role: who.admin ? "owner" : who.user.role, email: email };
    case "read":    if(!cur) fail(404, "no data file yet"); return { ok: true, version: v, file: redact(cur.json, who), email: email };
    case "write":   return doWrite(req, cur, who, email, v);
    case "backups": return { ok: true, list: listBackups(), email: email };
    case "backupRead": needAdmin(who); return { ok: true, file: JSON.parse(DriveApp.getFileById(req.id).getBlob().getDataAsString()), email: email };
    case "snapshot": needAdmin(who); var c = snapshot(cur, req.name || ("MYTOOL-DATA before-restore " + stamp() + ".json")); return { ok: true, id: c.getId(), email: email };
    case "backupNow": needAdmin(who); var d = "MYTOOL-DATA backup " + Utilities.formatDate(new Date(), "Europe/London", "yyyy-MM-dd") + ".json"; var bk = backupsFolder(); if(!bk.getFilesByName(d).hasNext()) snapshot(cur, d, bk); return { ok: true, email: email };
    case "share":   needAdmin(who); return { ok: true, shared: shareFiles(req.email, req.role), email: email };
    case "revoke":  needAdmin(who); return { ok: true, removed: lockDataFolder(), email: email };
    case "upload":  if(!(who.admin || who.perms.create || who.perms.edit)) fail(403, "your role cannot add files"); return upload(req, email);
    default: fail(400, "unknown op " + req.op);
  }
}

/* ================= identity ================= */
function verifyToken(token){
  if(!token) fail(401, "sign in again");
  var key = "tok:" + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  var cache = CacheService.getScriptCache(), hit = cache.get(key);
  if(hit) return hit;
  var r = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(token), { muteHttpExceptions: true });
  if(r.getResponseCode() !== 200) fail(401, "sign in again (token not valid)");
  var j = JSON.parse(r.getContentText());
  if(j.aud !== CLIENT_ID) fail(401, "token is not for MY TOOL");
  if(String(j.email_verified) !== "true" || !j.email) fail(401, "email not verified");
  var email = String(j.email).trim().toLowerCase();
  cache.put(key, email, Math.min(Number(j.expires_in || 300), 1500));
  return email;
}
function whoIs(email, json){
  if(ADMINS.indexOf(email) >= 0) return { admin: true, perms: { setup: true, approve: true, bank: true, deleteAny: true, edit: true, create: true, export: true }, user: { role: "owner" } };
  var main = json && json.data && json.data.setup && (json.data.setup.main || json.data.setup) || {};
  var users = main.users || [], roles = main.roles || {};
  for(var i = 0; i < users.length; i++){ var u = users[i]; if(u && u.active !== false && String(u.uid || u.email || "").trim().toLowerCase() === email) return { admin: false, perms: roles[u.role] || (u.role === "owner" ? { setup: true, approve: true, bank: true, deleteAny: true, edit: true, create: true, export: true } : {}), user: u }; }
  return null;
}
function needAdmin(who){ if(!who || !who.admin) fail(403, "only an admin can do this"); }

/* ================= data file ================= */
function dataFolder(){ var it = DriveApp.getFoldersByName(FOLDER); if(!it.hasNext()) fail(500, "folder not found: " + FOLDER); return it.next(); }
function dataFile(){ var it = dataFolder().getFilesByName(FILE); return it.hasNext() ? it.next() : null; }
function readCurrent(){ var f = dataFile(); if(!f) return null; var text = f.getBlob().getDataAsString(); return { file: f, text: text, json: JSON.parse(text) }; }
function version(){ return Number(PropertiesService.getScriptProperties().getProperty("v") || 0); }
function bump(){ var v = version() + 1; PropertiesService.getScriptProperties().setProperty("v", String(v)); return v; }
function stamp(){ return Utilities.formatDate(new Date(), "Europe/London", "yyyy-MM-dd HH-mm"); }
function backupsFolder(){ var f = dataFolder(); var it = f.getFoldersByName("backups"); return it.hasNext() ? it.next() : f.createFolder("backups"); }
function snapshot(cur, name, folder){ if(!cur) fail(404, "no data file"); return (folder || dataFolder()).createFile(name, cur.text, "application/json"); }
function listBackups(){
  var out = [], seen = {}, folders = [dataFolder(), backupsFolder()];
  folders.forEach(function(fo, i){ var it = fo.getFiles(); while(it.hasNext()){ var f = it.next(); var n = f.getName(); if(n.indexOf("MYTOOL-DATA backup") !== 0 && n.indexOf("MYTOOL-DATA before-restore") !== 0) continue; if(seen[n]) continue; seen[n] = 1; out.push({ id: f.getId(), name: n, modifiedTime: f.getLastUpdated().toISOString(), size: String(f.getSize()), nightly: i === 1 }); } });
  out.sort(function(a, b){ return a.name < b.name ? 1 : -1; }); return out;
}

/* ================= write with role rules + compare-and-swap ================= */
function doWrite(req, cur, who, email, v){
  if(!(who.admin || who.perms.edit || who.perms.create || who.perms.setup)) fail(403, "your role (" + who.user.role + ") cannot save changes");
  if(!cur) fail(404, "no data file yet — the owner must open MY TOOL once first");
  var lock = LockService.getScriptLock(); if(!lock.tryLock(20000)) fail(503, "the data file is busy — try again");
  try{
    v = version();
    if(String(req.base) !== String(v)) return { ok: false, status: 409, conflict: true, version: v, file: redact(cur.json, who), email: email };
    var next = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if(!next || !next.data || !next.data.setup) fail(400, "the file to save is not complete");
    if(next.schema && cur.json.schema && next.schema < cur.json.schema) fail(409, "your app is older than the data file — reload");
    enforce(cur.json, next, who);
    next.savedBy = email; next.savedAt = new Date().toISOString(); next.gatewayVersion = v + 1;
    var text = JSON.stringify(next);
    cur.file.setContent(text);
    var check = cur.file.getBlob().getDataAsString();
    if(check.length !== text.length) fail(500, "the save did not land completely — nothing was changed on your device, it will retry");
    var nv = bump();
    return { ok: true, version: nv, email: email };
  }finally{ lock.releaseLock(); }
}
/* the rules that frontend buttons only pretend to enforce */
function enforce(curJ, next, who){
  if(who.admin) return;
  var cd = curJ.data || {}, nd = next.data || {};
  var curMain = (cd.setup && (cd.setup.main || cd.setup)) || {}, nextMain = (nd.setup && (nd.setup.main || nd.setup)) || {};
  if(!who.perms.bank) reattach(cd, nd);                                           // hidden bank details come back untouched, before anything is compared
  if(canon(curMain.users || []) !== canon(nextMain.users || []) || canon(curMain.roles || {}) !== canon(nextMain.roles || {})) fail(403, "only an admin can change users or roles");
  if(!who.perms.setup && canon(cd.setup || {}) !== canon(nd.setup || {})) fail(403, "your role cannot change Setup");
  var cols = Object.keys(cd);
  for(var i = 0; i < cols.length; i++){
    var c = cols[i]; if(c === "setup" || c === "log" || c === "errors" || c === "views" || c === "counters") continue;
    var a = cd[c] || {}, b = nd[c] || {}, ids = Object.keys(a);
    for(var k = 0; k < ids.length; k++){
      var id = ids[k];
      if(!b[id]){ if(!who.perms.deleteAny) fail(403, "your role cannot delete " + c + "/" + id); continue; }
      var wasDel = !!a[id].deletedAt, isDel = !!b[id].deletedAt;
      if(!wasDel && isDel && !who.perms.deleteAny) fail(403, "your role cannot trash " + id);
      if(!who.perms.edit && canon(a[id]) !== canon(b[id])) fail(403, "your role cannot change " + id);
    }
    if(!who.perms.create){ var nids = Object.keys(b); for(var m = 0; m < nids.length; m++) if(!a[nids[m]]) fail(403, "your role cannot create " + c + "/" + nids[m]); }
  }
}
/* roles without "bank" never receive bank details; on their saves the current values are put back */
function redact(json, who){
  if(who.admin || who.perms.bank) return json;
  var j = JSON.parse(JSON.stringify(json)), d = j.data || {};
  var main = d.setup && (d.setup.main || d.setup);
  if(main && main.banks) main.banks.forEach(function(b){ SENSITIVE.forEach(function(k){ if(k in b && k !== "number") delete b[k]; }); });
  if(d.payments) Object.keys(d.payments).forEach(function(id){ var p = d.payments[id]; ["bank", "beneficiary"].forEach(function(k){ if(k in p) delete p[k]; }); });
  if(d.parties) Object.keys(d.parties).forEach(function(id){ var p = d.parties[id]; ["bank", "iban", "swift", "account"].forEach(function(k){ if(k in p) delete p[k]; }); });
  j.redacted = true; return j;
}
function reattach(cd, nd){
  var cm = cd.setup && (cd.setup.main || cd.setup), nm = nd.setup && (nd.setup.main || nd.setup);
  if(cm && nm && cm.banks && nm.banks) nm.banks.forEach(function(b){ var o = cm.banks.filter(function(x){ return x.id === b.id; })[0]; if(o) SENSITIVE.forEach(function(k){ if(k in o && !(k in b)) b[k] = o[k]; }); });
  ["payments", "parties"].forEach(function(c){ if(!cd[c] || !nd[c]) return; Object.keys(nd[c]).forEach(function(id){ var o = cd[c][id], n = nd[c][id]; if(o && n) ["bank", "beneficiary", "iban", "swift", "account"].forEach(function(k){ if(k in o && !(k in n)) n[k] = o[k]; }); }); });
}

/* ================= attachments: the FILES folder is shared, the data is not ================= */
function filesFolder(){
  var it = DriveApp.getFoldersByName(FILES_FOLDER), f = null;
  while(it.hasNext()){ var x = it.next(); if(x.getOwner() && x.getOwner().getEmail().toLowerCase() === OWNER){ f = x; break; } }
  if(!f) f = DriveApp.createFolder(FILES_FOLDER);
  var parents = f.getParents(); if(parents.hasNext() && parents.next().getName() === FOLDER) f.moveTo(DriveApp.getRootFolder());   // never inside the data folder
  return f;
}
function shareFiles(email, role){
  if(!/^[^@\s]+@[^@\s]+\.[a-z]+$/i.test(email || "")) fail(400, "valid email needed");
  var f = filesFolder(); if(role === "reader") f.addViewer(email); else f.addEditor(email); return f.getId();
}
function lockDataFolder(){
  var removed = [], targets = [dataFolder(), dataFile()].filter(Boolean);
  targets.forEach(function(t){
    t.getEditors().forEach(function(u){ var e = u.getEmail().toLowerCase(); if(ADMINS.indexOf(e) < 0){ t.removeEditor(u); removed.push(e); } });
    t.getViewers().forEach(function(u){ var e = u.getEmail().toLowerCase(); if(ADMINS.indexOf(e) < 0){ t.removeViewer(u); removed.push(e); } });
    try{ t.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); }catch(_){}
  });
  return removed;
}
function upload(req, email){
  var bytes = Utilities.base64Decode(req.b64 || "");
  if(!bytes.length) fail(400, "empty file"); if(bytes.length > MAX_UPLOAD) fail(413, "file is bigger than 20 MB");
  var name = String(req.name || "file").replace(/[\\/:*?"<>|]/g, "_").slice(0, 120);
  var f = filesFolder().createFile(Utilities.newBlob(bytes, req.mime || "application/octet-stream", name));
  f.setDescription("uploaded via MY TOOL by " + email);
  return { ok: true, id: f.getId(), url: f.getUrl(), email: email };
}

/* ================= log (one small text file per month in the data folder) ================= */
function logLine(line){
  var name = "MYTOOL-GATEWAY-LOG " + Utilities.formatDate(new Date(), "Europe/London", "yyyy-MM") + ".txt";
  var fo = dataFolder(), it = fo.getFilesByName(name), f = it.hasNext() ? it.next() : fo.createFile(name, "", "text/plain");
  var txt = f.getBlob().getDataAsString(); if(txt.length > 400000) txt = txt.slice(-300000);
  f.setContent(txt + new Date().toISOString() + " " + line + "\n");
}

/* ================= run once after pasting: checks folder, file, version counter ================= */
function selfTest(){
  var cur = readCurrent(); if(!cur) throw new Error("data file not found — open MY TOOL as the owner once first");
  if(!version()) PropertiesService.getScriptProperties().setProperty("v", "1");
  filesFolder();
  Logger.log("OK — data file " + cur.text.length + " bytes, version " + version() + ", " + Object.keys(cur.json.data || {}).length + " collections");
  return "OK";
}
