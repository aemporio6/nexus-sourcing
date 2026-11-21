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
      (removes everyone else's Drive access to the data and the attachments — both are served through the gateway).
   Nothing is stored here except a version counter. No Client Secret anywhere.                                                      */

var CLIENT_ID = "605045779540-pjncsnms1af0s9al9k0de2om67fg0hce.apps.googleusercontent.com";
var ADMINS = ["aemporio6@gmail.com", "vartleaves.data@gmail.com"];   /* the Owner accounts (owner, 20 Nov 2026) */
var OWNER = "aemporio6@gmail.com";   /* the account this script runs as */
var FOLDER = "MY TOOL – DATA", FILE = "MYTOOL-DATA.json", FILES_FOLDER = "MY TOOL – FILES";
var SENSITIVE = ["bank", "beneficiary", "account", "accountNo", "iban", "swift", "sortCode", "sort", "routing", "number"]; /* hidden from roles without "bank" */
var MAX_UPLOAD = 20 * 1024 * 1024;

/* ================= entry ================= */
function doPost(e){
  var t0 = Date.now(), req = {}, out;
  try{
    req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    /* the supplier upload page (upload.html) has no Google sign-in: these two calls are opened by the link's secret only */
    if(req.op === "supplierInfo"){ var sw = upFind(req.tok); out = sw && !sw.expired ? { ok: true, name: sw.name, orders: sw.orders || [] } : { ok: false, expired: !!(sw && sw.expired) }; }
    else if(req.op === "supplierUpload"){ try{ out = supplierUpload(req); }catch(ue){ out = { ok: false, error: String(ue && ue.message || ue), status: 400 }; } }
    else out = handle(req);
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
  /* someone who is not in Setup › Users can do exactly two things: ask for access, and see what became of the request (21 Nov 2026) */
  if(req.op === "accessState"){ if(who){ accessForget(email); return { ok: true, state: "member", email: email }; } var as = accessState(email); as.email = email; return as; }
  if(req.op === "accessAsk"){ if(who){ accessForget(email); return { ok: true, state: "member", email: email }; } var ak = accessAsk(email, req); ak.email = email; return ak; }
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
    case "file":    return fileOut(req.id, email);
    case "archives": return { ok: true, list: listArchivesGw(), email: email };
    case "archiveRead": { var af = DriveApp.getFileById(req.id); var okA = false, pit = af.getParents(); while(pit.hasNext()){ if(pit.next().getName() === FOLDER) okA = true; } if(!okA || af.getName().indexOf("MYTOOL-ARCHIVE-") !== 0) fail(403, "not an archive"); return { ok: true, file: JSON.parse(af.getBlob().getDataAsString()), email: email }; }
    case "archiveWrite": { needAdmin(who); var yr = String(req.year || ""); if(!/^\d{4}$/.test(yr)) fail(400, "year?"); var nm = "MYTOOL-ARCHIVE-" + yr + ".json"; var fo = dataFolder(), fit = fo.getFilesByName(nm), af2 = fit.hasNext() ? fit.next() : null; var txt = typeof req.body === "string" ? req.body : JSON.stringify(req.body); JSON.parse(txt); if(af2) af2.setContent(txt); else af2 = fo.createFile(nm, txt, "application/json"); return { ok: true, id: af2.getId(), version: String(af2.getLastUpdated().getTime()), email: email }; }
    /* ---- moving the data to another Google account (20 Nov 2026) ---- */
    case "adopt": { needAdmin(who); if(cur && !req.force) fail(409, "this account already has MY TOOL data — nothing was changed");
      var ab = typeof req.body === "string" ? JSON.parse(req.body) : req.body; if(!ab || !ab.data || !ab.data.setup) fail(400, "the file to take over is not complete");
      var am = ab.data.setup.main || ab.data.setup; if(am && am.movedTo) delete am.movedTo;
      ab.adoptedFrom = String(req.from || ""); ab.adoptedAt = new Date().toISOString(); ab.savedBy = email; ab.savedAt = ab.adoptedAt;
      var afo = findDataFolder() || DriveApp.createFolder(FOLDER), atx = JSON.stringify(vaultSeal(JSON.parse(JSON.stringify(ab))));
      if(cur) cur.file.setContent(atx); else afo.createFile(FILE, atx, "application/json");
      var chk = readCurrent(); if(!chk || chk.text.length !== atx.length) fail(500, "the copy did not land completely — nothing is switched");
      var cnt = {}; Object.keys(chk.json.data).forEach(function(c){ cnt[c] = Object.keys(chk.json.data[c] || {}).length; });
      return { ok: true, version: bump(), counts: cnt, account: selfEmail(), email: email }; }
    case "adoptFiles": { needAdmin(who); var ids = (req.ids || []).slice(0, 20), map = {}, miss = [], dest = filesFolder(), me2 = selfEmail();
      ids.forEach(function(id){ try{ var f = DriveApp.getFileById(String(id)); var okP = false, pit = f.getParents(); while(pit.hasNext()){ if(pit.next().getName() === FILES_FOLDER) okP = true; }
          if(!okP){ miss.push(id); return; } var own = ""; try{ own = f.getOwner().getEmail().toLowerCase(); }catch(_){}
          if(own === me2){ map[id] = id; return; } var c2 = f.makeCopy(f.getName(), dest); try{ c2.setDescription("copied from " + own + " when the data moved"); }catch(_){} map[id] = c2.getId(); }catch(e){ miss.push(id); } });
      return { ok: true, map: map, missing: miss, email: email }; }
    /* ---- access requests: only an Owner sees and decides them ---- */
    case "accessList": needAdmin(who); return { ok: true, list: accessList(), email: email };
    /* the Owner sends an email from MY TOOL (an upload link to a supplier, an invitation to a new person) — 21 Nov 2026 */
    case "mailOut": needAdmin(who); return mailOut(req, email);
    case "accessDecide": needAdmin(who); return { ok: true, list: accessDecide(req, email), email: email };
    case "whoami": return { ok: true, account: selfEmail(), exists: !!cur, admin: !!who.admin, you: email, email: email };
    /* ---- files suppliers sent through their upload link ---- */
    case "inboxList": if(!(who.admin || who.perms.create || who.perms.edit)) fail(403, "your role cannot see the supplier inbox"); return { ok: true, list: inboxList(), email: email };
    case "inboxFile": { if(!(who.admin || who.perms.create || who.perms.edit)) fail(403, "your role cannot open the supplier inbox"); var xf = inboxGet(req.id); var xb = xf.getBlob(); if(xb.getBytes().length > MAX_UPLOAD) fail(413, "file too big");
      return { ok: true, name: xf.getName(), mime: xb.getContentType(), b64: Utilities.base64Encode(xb.getBytes()), email: email }; }
    case "inboxDone": { if(!(who.admin || who.perms.create || who.perms.edit)) fail(403, "your role cannot change the supplier inbox"); var df = inboxGet(req.id);
      if(req.attach){ df.moveTo(filesFolder()); return { ok: true, id: df.getId(), url: df.getUrl(), email: email }; }
      var pf = df.getParents().next(), dn = pf.getFoldersByName("done"); df.moveTo(dn.hasNext() ? dn.next() : pf.createFolder("done")); return { ok: true, email: email }; }
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
  if(ADMINS.indexOf(email) >= 0) return { admin: true, email: email, perms: { setup: true, approve: true, bank: true, deleteAny: true, edit: true, create: true, export: true }, user: { role: "owner" } };
  var main = json && json.data && json.data.setup && (json.data.setup.main || json.data.setup) || {};
  var users = main.users || [], roles = main.roles || {};
  for(var i = 0; i < users.length; i++){ var u = users[i]; if(u && u.active !== false && String(u.uid || u.email || "").trim().toLowerCase() === email) return { admin: false, email: email, perms: userPerms(u, roles), user: u }; }
  return null;
}
/* a person's permissions (20 Nov 2026): the role's ticks, then their own ticks from Setup › Users › Access; nothing after the end date */
function userPerms(u, roles){
  /* several roles (21 Nov 2026): the ticks of all of them add up */
  var rs = (u.roles && u.roles.length) ? u.roles : [u.role], p = {}, k;
  rs.forEach(function(role){ var base = roles[role] || (role === "owner" ? { setup: true, approve: true, bank: true, deleteAny: true, edit: true, create: true, export: true, restore: true } : {});
    for(k in base) p[k] = p[k] || !!base[k]; if(base.restore === undefined && (base.deleteAny || base.edit)) p.restore = true; });
  if(p.restore === undefined) p.restore = !!(p.deleteAny || p.edit);
  if(u.perms) for(k in u.perms) if(u.perms[k] !== undefined && u.perms[k] !== null) p[k] = !!u.perms[k];
  var td = Utilities.formatDate(new Date(), "Europe/London", "yyyy-MM-dd");
  if(u.until && String(u.until) < td) return {};
  if(u.from && String(u.from) > td) return {};
  return p;
}
function needAdmin(who){ if(!who || !who.admin) fail(403, "only an admin can do this"); }

/* ================= data file ================= */
/* the account this script runs as (so the SAME file works in aemporio6's account and in the company account) */
var SELF_ = null;
function selfEmail(){ if(SELF_) return SELF_; try{ SELF_ = String(DriveApp.getRootFolder().getOwner().getEmail() || OWNER).toLowerCase(); }catch(_){ SELF_ = OWNER; } return SELF_; }
function findDataFolder(){ var it = DriveApp.getFoldersByName(FOLDER), first = null, me = selfEmail(); while(it.hasNext()){ var f = it.next(); if(!first) first = f; try{ if(f.getOwner() && f.getOwner().getEmail().toLowerCase() === me) return f; }catch(_){} } return first; }
function dataFolder(){ var f = findDataFolder(); if(!f) fail(500, "folder not found: " + FOLDER); return f; }
function dataFile(){ var fo = findDataFolder(); if(!fo) return null; var it = fo.getFilesByName(FILE); return it.hasNext() ? it.next() : null; }
function readCurrent(){ var f = dataFile(); if(!f) return null; var text = f.getBlob().getDataAsString(); return { file: f, text: text, json: vaultOpen(JSON.parse(text)) }; }
function version(){ return Number(PropertiesService.getScriptProperties().getProperty("v") || 0); }
function bump(){ var v = version() + 1; PropertiesService.getScriptProperties().setProperty("v", String(v)); return v; }
function stamp(){ return Utilities.formatDate(new Date(), "Europe/London", "yyyy-MM-dd HH-mm"); }
function backupsFolder(){ var f = dataFolder(); var it = f.getFoldersByName("backups"); return it.hasNext() ? it.next() : f.createFolder("backups"); }
function snapshot(cur, name, folder){ if(!cur) fail(404, "no data file"); return (folder || dataFolder()).createFile(name, cur.text, "application/json"); }
function listArchivesGw(){ var out = [], it = dataFolder().getFiles(); while(it.hasNext()){ var f = it.next(); if(/^MYTOOL-ARCHIVE-\d{4}\.json$/.test(f.getName())) out.push({ id: f.getId(), name: f.getName(), version: String(f.getLastUpdated().getTime()) }); } return out; }
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
    var cm0 = cur.json.data && cur.json.data.setup && (cur.json.data.setup.main || cur.json.data.setup), nm0 = next.data.setup.main || next.data.setup;
    if(cm0 && cm0.movedTo && nm0 && nm0.movedTo) return { ok: false, status: 410, moved: cm0.movedTo, error: "the data has moved to the company account — reload MY TOOL", email: email };
    if(!who.admin && canon(cm0 && cm0.movedTo || null) !== canon(nm0 && nm0.movedTo || null)) fail(403, "only an Owner can move the data");
    enforce(cur.json, next, who);
    next.savedBy = email; next.savedAt = new Date().toISOString(); next.gatewayVersion = v + 1;
    var text = JSON.stringify(vaultSeal(JSON.parse(JSON.stringify(next))));
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
  if(!who.perms.bank) reattach(cd, nd);
  var co = coOf(who); if(co) coReattach(cd, nd, co);
  actsCheck(cd, nd, who);
  if(!who.admin) upReattach(cd, nd);
  var fine = fineOf(who); if(fine) fineReattach(cd, nd, fine);                                           // hidden bank details come back untouched, before anything is compared
  if(canon(curMain.users || []) !== canon(nextMain.users || []) || canon(curMain.roles || {}) !== canon(nextMain.roles || {})) fail(403, "only an admin can change users or roles");
  if(!who.perms.setup && canon(cd.setup || {}) !== canon(nd.setup || {})) fail(403, "your role cannot change Setup");
  approvalRules(cd, nd, nextMain, who);
  var cols = Object.keys(cd);
  for(var i = 0; i < cols.length; i++){
    var c = cols[i]; if(c === "setup" || c === "log" || c === "errors" || c === "views" || c === "counters") continue;
    var a = cd[c] || {}, b = nd[c] || {}, ids = Object.keys(a);
    if(fine && fine.areas[c] === "view" && canon(a) !== canon(b)) fail(403, "this area is view-only for you (" + c + ")");
    for(var k = 0; k < ids.length; k++){
      var id = ids[k];
      if(!b[id]){ if(c === "versions") fail(403, "the history cannot be removed"); if(!who.perms.deleteAny) fail(403, "your role cannot delete " + c + "/" + id); continue; }
      if(c === "versions"){ if(canon(a[id]) !== canon(b[id])) fail(403, "the history cannot be changed"); continue; }
      var wasDel = !!a[id].deletedAt, isDel = !!b[id].deletedAt;
      if(wasDel && !isDel && !who.perms.restore && !who.perms.deleteAny) fail(403, "your role cannot bring back " + id);
      if(!wasDel && isDel && !who.perms.deleteAny) fail(403, "your role cannot trash " + id);
      if(!who.perms.edit && canon(a[id]) !== canon(b[id]) && !ownTaskStep(c, a[id], b[id], who)) fail(403, "your role cannot change " + id);
    }
    if(c === "versions") continue;   /* anyone who may save adds to the history */
    if(!who.perms.create){ var nids = Object.keys(b); for(var m = 0; m < nids.length; m++) if(!a[nids[m]]) fail(403, "your role cannot create " + c + "/" + nids[m]); }
  }
}
/* approvals (17 Nov 2026): the person who asked never approves; nothing above the limit is counted without approval */
function approvalRules(cd, nd, main, who){
  bankChangeRules(cd, nd, who);
  var a = cd.payments || {}, b = nd.payments || {}, limit = +((main.defaults || {}).approvalGbp || 2000), me = String(who.email || "").toLowerCase();
  Object.keys(b).forEach(function(id){
    var o = a[id], n = b[id]; if(!n || n.deletedAt) return;
    var asked = String(n.requestedBy || (o && o.requestedBy) || (o && o.createdBy) || "").toLowerCase();
    if(o && !o.approved && n.approved && o.needsApproval){
      if(!who.perms.approve) fail(403, "your role cannot approve " + id);
      var lim = who.user && who.user.approveLimit; if(lim !== undefined && lim !== null && lim !== "" && +n.gbp > +lim) fail(403, id + " is above your approval limit (£" + lim + ")");
      if(asked && asked === me) fail(403, "you asked for " + id + " — someone else must approve it");
    }
    if(n.needsApproval && !n.approved && n.status === "paid") fail(403, id + " is waiting for approval — it cannot be marked paid");
    var moved = !o || +o.amount !== +n.amount || o.cur !== n.cur;
    /* above the limit and not approved by someone else: never refused (a save must not get stuck) – it is put to "waiting for approval" */
    if(moved && n.direction !== "in" && n.status !== "cancelled" && +n.gbp > limit && !(n.needsApproval && !n.approved)){ n.status = "pending"; n.needsApproval = true; n.approved = false; n.requestedBy = n.requestedBy || me; delete n.approvedBy; delete n.approvedAt; who.changed = (who.changed || 0) + 1; }
  });
}
/* supplier bank details (17 Nov 2026): a non-admin's change never replaces them – it waits as beneficiaryPending until someone
   else who may approve accepts it (never refused, so a save cannot get stuck) */
function bankChangeRules(cd, nd, who){
  var a = cd.parties || {}, b = nd.parties || {}, me = String(who.email || "").toLowerCase(), now = new Date().toISOString();
  Object.keys(b).forEach(function(id){
    var o = a[id], n = b[id]; if(!o || !n) return;
    var was = String(o.beneficiary || ""), is = String(n.beneficiary || ""); if(was === is || !("beneficiary" in n)) return;
    var pend = o.beneficiaryPending, asked = pend ? String(pend.by || "").toLowerCase() : "";
    if(pend && is === String(pend.text || "") && who.perms.approve && asked !== me){ n.beneficiaryPending = null; n.beneficiaryChangedAt = now; n.beneficiaryApprovedBy = me; return; }
    if(!was){ n.beneficiaryChangedAt = now; return; }                                        /* first details: no approval */
    n.beneficiaryPending = { text: is, by: me, at: now }; n.beneficiary = was; who.changed = (who.changed || 0) + 1;
  });
}
/* ================= vault: bank details encrypted inside the data file (opt-in: run vaultInit once) =================
   Deterministic stream cipher from HMAC-SHA256 (key never leaves Script Properties; a copy is kept in the owner's Drive). */
var VAULT_TAG = "enc:v1:";
function vaultKey(){ try{ return PropertiesService.getScriptProperties().getProperty("VAULT_KEY") || ""; }catch(_){ return ""; } }
function vB(s){ var b = unescape(encodeURIComponent(String(s))), out = []; for(var i = 0; i < b.length; i++) out.push(b.charCodeAt(i) << 24 >> 24); return out; }
function vS(bytes){ var s = ""; for(var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 255); return decodeURIComponent(escape(s)); }
function vH(key, msg){ return Utilities.computeHmacSha256Signature(msg, key); }
function vKeys(){ var k = vB(vaultKey()); return { e: vH(k, vB("enc")), m: vH(k, vB("mac")) }; }
function vStream(kE, iv, n){ var out = []; for(var i = 0; out.length < n; i++){ var blk = vH(kE, iv.concat([i & 127, (i >> 7) & 127])); for(var j = 0; j < blk.length && out.length < n; j++) out.push(blk[j]); } return out; }
function vEnc(pt){ var K = vKeys(), p = vB(pt), iv = vH(K.m, p).slice(0, 16), ks = vStream(K.e, iv, p.length), ct = p.map(function(x, i){ return (x ^ ks[i]) << 24 >> 24; }), tag = vH(K.m, iv.concat(ct)).slice(0, 16);
  return VAULT_TAG + Utilities.base64Encode(iv) + ":" + Utilities.base64Encode(ct) + ":" + Utilities.base64Encode(tag); }
function vDec(s){ var parts = String(s).slice(VAULT_TAG.length).split(":"); var K = vKeys(), iv = Utilities.base64Decode(parts[0]).map(function(x){ return x << 24 >> 24; }), ct = Utilities.base64Decode(parts[1]).map(function(x){ return x << 24 >> 24; }), tag = Utilities.base64Encode(Utilities.base64Decode(parts[2]));
  if(Utilities.base64Encode(vH(K.m, iv.concat(ct)).slice(0, 16)) !== tag) throw new Error("vault: a value does not match its key");
  var ks = vStream(K.e, iv, ct.length); return vS(ct.map(function(x, i){ return (x ^ ks[i]) << 24 >> 24; })); }
function vaultWalk(json, fn){ var d = (json && json.data) || {}; var main = d.setup && (d.setup.main || d.setup);
  if(d.parties) Object.keys(d.parties).forEach(function(id){ var p = d.parties[id]; if(!p) return; ["beneficiary", "iban", "swift", "account", "sortCode"].forEach(function(k){ if(typeof p[k] === "string" && p[k]) p[k] = fn(p[k]); }); if(p.beneficiaryPending && typeof p.beneficiaryPending.text === "string") p.beneficiaryPending.text = fn(p.beneficiaryPending.text); });
  if(main && main.banks) main.banks.forEach(function(b){ SENSITIVE.forEach(function(k){ if(typeof b[k] === "string" && b[k]) b[k] = fn(b[k]); }); });
  return json; }
function vaultSeal(json){ if(!vaultKey()) return json; return vaultWalk(json, function(v){ return v.indexOf(VAULT_TAG) === 0 ? v : vEnc(v); }); }
function vaultOpen(json){ if(!vaultKey()) return json; return vaultWalk(json, function(v){ return v.indexOf(VAULT_TAG) === 0 ? vDec(v) : v; }); }
/* run ONCE from the editor (as aemporio6): makes the key, keeps a copy in your Drive, and encrypts the bank details already in the file */
function vaultInit(){
  var props = PropertiesService.getScriptProperties();
  if(props.getProperty("VAULT_KEY")){ Logger.log("Vault already on."); return "already on"; }
  var key = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now()));
  props.setProperty("VAULT_KEY", key);
  DriveApp.getRootFolder().createFile("MY TOOL – VAULT KEY (secret, never share).txt", "MY TOOL vault key — needed to read the bank details in MYTOOL-DATA.json.\nIf the gateway script is ever lost: paste this as Script property VAULT_KEY in the new script.\n\n" + key, "text/plain");
  var cur = readCurrent(); if(cur){ var text = JSON.stringify(vaultSeal(cur.json)); cur.file.setContent(text); bump(); }
  Logger.log("Vault ON. Key copy saved in My Drive."); return "on";
}
/* tasks: anyone may move a task given to them (or made by them) along To do → Doing → Done; nothing else in it may change */
function ownTaskStep(c, before, after, who){
  if(c !== "tasks" || !who || !who.email) return false;
  var me = who.email, mine = !before.who || String(before.who).toLowerCase() === me || String(before.by || "").toLowerCase() === me;
  if(!mine) return false;
  var allowed = { status: 1, doneAt: 1, updatedAt: 1, updatedBy: 1 }, keys = {}, k;
  for(k in before) keys[k] = 1; for(k in after) keys[k] = 1;
  for(k in keys){ if(allowed[k]) continue; if(canon(before[k] === undefined ? null : before[k]) !== canon(after[k] === undefined ? null : after[k])) return false; }
  return ["todo", "doing", "done"].indexOf(after.status) >= 0;
}
/* roles without "bank" never receive bank details; on their saves the current values are put back */
function redact(json, who){
  var fine = fineOf(who), co = coOf(who);
  if(who.admin) return json;
  if(who.perms.bank && !fine && !co){ var jb = JSON.parse(JSON.stringify(json)); upStrip(jb.data || {}); return jb; }
  var j = JSON.parse(JSON.stringify(json)), d = j.data || {};
  if(co){ var hid = coHidden(d, co), hc; for(hc in hid) Object.keys(hid[hc]).forEach(function(id){ delete d[hc][id]; }); }
  upStrip(d);
  if(fine) fineRedact(d, fine);
  if(who.perms.bank){ j.redacted = true; return j; }
  var main = d.setup && (d.setup.main || d.setup);
  if(main && main.banks) main.banks.forEach(function(b){ SENSITIVE.forEach(function(k){ if(k in b && k !== "number") delete b[k]; }); });
  if(d.payments) Object.keys(d.payments).forEach(function(id){ var p = d.payments[id]; ["bank", "beneficiary"].forEach(function(k){ if(k in p) delete p[k]; }); });
  if(d.parties) Object.keys(d.parties).forEach(function(id){ var p = d.parties[id]; ["bank", "iban", "swift", "account", "beneficiary", "sortCode", "beneficiaryPending"].forEach(function(k){ if(k in p) delete p[k]; }); });
  j.redacted = true; return j;
}
/* companies (21 Nov 2026): Setup › Users › "Companies this person sees". A list = only those companies' orders, shipments and
   payments (and what hangs on them: inspections, receipts, credits) are ever sent to that person. Whatever they save, the
   records of the other companies stay exactly as they are, and they cannot make or move a record into another company. */
function coOf(who){ var u = who && who.user; if(!u || who.admin || (!Array.isArray(u.companies) && !Array.isArray(u.departments))) return null;
  var mk = function(a){ if(!Array.isArray(a)) return null; var m = {}; a.forEach(function(c){ m[String(c)] = true; }); return m; }; var sc = mk(u.companies) || {}; sc.__co = Array.isArray(u.companies); sc.__dept = mk(u.departments); return sc; }
/* the department of a payment, as the app works it out: the party's type decides, else the payment's own department */
function payDeptOf(d, r){ var main = d.setup && (d.setup.main || d.setup) || {}, pa = null, ps = d.parties || {}, k; if(r.party){ pa = ps[r.party]; if(!pa) for(k in ps) if(ps[k] && ps[k].code === r.party){ pa = ps[k]; break; } }
  if(pa){ var its = main.lists && main.lists.partyType && main.lists.partyType.items || [], t = null, i; for(i = 0; i < its.length; i++) if(its[i].id === pa.type){ t = its[i]; break; } return (t && t.dept) || "other"; } return r.dept || "other"; }
function coHidden(d, co){
  var out = { purchases: {}, shipments: {}, payments: {}, inspections: {}, receipts: {}, credits: {} }, nos = {};
  var main = d.setup && (d.setup.main || d.setup) || {}, bankCo = {}; (main.banks || []).forEach(function(b){ if(b && b.id) bankCo[b.id] = b.company || ""; });
  var each = function(c, fn){ var col = d[c] || {}; Object.keys(col).forEach(function(id){ var r = col[id]; if(r && fn(r)){ out[c][id] = true; nos[String(r.no || id)] = true; } }); };
  if(co.__co !== false){ each("purchases", function(r){ return r.account && !co[r.account]; });
    each("shipments", function(r){ return r.company && !co[r.company]; });
    each("payments", function(r){ var c = r.company || bankCo[r.bank] || ""; return c && !co[c]; }); }
  /* departments (21 Nov 2026): a person limited to some departments gets only those departments' payments */
  if(co.__dept){ var pc = d.payments || {}; Object.keys(pc).forEach(function(id){ var r = pc[id]; if(r && !out.payments[id] && !co.__dept[payDeptOf(d, r)]) out.payments[id] = true; }); }
  each("inspections", function(r){ return r.po && nos[String(r.po)]; });
  each("receipts", function(r){ return (r.src && nos[String(r.src)]) || (r.po && nos[String(r.po)]); });
  each("credits", function(r){ return (r.po && nos[String(r.po)]) || (r.receipt && nos[String(r.receipt)]); });
  return out;
}
function coReattach(cd, nd, co){
  var hid = coHidden(cd, co), c;
  for(c in hid){ nd[c] = nd[c] || {}; Object.keys(hid[c]).forEach(function(id){ nd[c][id] = cd[c][id]; }); }
  var main = nd.setup && (nd.setup.main || nd.setup) || {}, bankCo = {}; (main.banks || []).forEach(function(b){ if(b && b.id) bankCo[b.id] = b.company || ""; });
  var chk = function(col, coOfRec){ var n = nd[col] || {}, o = cd[col] || {}; Object.keys(n).forEach(function(id){ if(hid[col][id]) return; var r = n[id]; if(!r || canon(r) === canon(o[id])) return; var x = coOfRec(r); if(x && !co[x]) fail(403, "this record belongs to a company you do not work for — not saved"); }); };
  if(co.__co !== false){ chk("purchases", function(r){ return r.account; }); chk("shipments", function(r){ return r.company; }); chk("payments", function(r){ return r.company || bankCo[r.bank] || ""; }); }
  if(co.__dept){ var np = nd.payments || {}, op = cd.payments || {}; Object.keys(np).forEach(function(id){ if(hid.payments[id]) return; var r = np[id]; if(!r || canon(r) === canon(op[id])) return; if(!co.__dept[payDeptOf(nd, r)]) fail(403, "this payment belongs to a department you do not work for — not saved"); }); }
}
/* what a person may do in each module (21 Nov 2026): Setup › People › "What they can do". The ticks of the role say what is
   possible at all; here single modules are switched off: making new records, changing them, deleting them. */
var ACT_COLS = ["purchases", "shipments", "payments", "receipts", "moves", "products", "parties", "inspections", "credits"];
function actsCheck(cd, nd, who){
  var u = who && who.user, acts = u && u.acts; if(!acts || who.admin) return;
  ACT_COLS.forEach(function(col){ var a = acts[col]; if(!a) return; var n = nd[col] || {}, o = cd[col] || {};
    Object.keys(n).forEach(function(id){ var r = n[id], w = o[id]; if(!w){ if(a.create === false) fail(403, "making new records here is switched off for you (" + col + ")"); return; }
      if(canon(r) === canon(w)) return;
      if(r && r.deletedAt && !w.deletedAt){ if(a.del === false) fail(403, "deleting here is switched off for you (" + col + ")"); return; }
      if(a.edit === false) fail(403, "changing records here is switched off for you (" + col + ")"); });
    Object.keys(o).forEach(function(id){ if(!n[id] && a.del === false) fail(403, "deleting here is switched off for you (" + col + ")"); }); });
}
/* fine access (20 Nov 2026): areas and single fields the Owner set to Hidden / View only for one person.
   Hidden: never sent to their device. Hidden or view-only: whatever they save, the stored value stays. */
function fineOf(who){ var u = who && who.user; if(!u || who.admin) return null; var a = u.areas || {}, f = u.fields || {}; var has = false, k; for(k in a) if(a[k] === "hide" || a[k] === "view") has = true; for(k in f) if(f[k] === "hide" || f[k] === "view") has = true; return has ? { areas: a, fields: f } : null; }
function finePath(path){ var p = String(path).split("."); return { col: p[0], k1: p[1], k2: p[2] }; }
function fineRedact(d, fine){
  var c, k; for(c in fine.areas) if(fine.areas[c] === "hide" && d[c]) d[c] = {};
  for(k in fine.fields){ if(fine.fields[k] !== "hide") continue; var q = finePath(k), col = d[q.col]; if(!col) continue;
    Object.keys(col).forEach(function(id){ var r = col[id]; if(!r) return; if(!q.k2){ if(q.k1 in r) delete r[q.k1]; } else if(Array.isArray(r[q.k1])) r[q.k1].forEach(function(row){ if(row && q.k2 in row) delete row[q.k2]; }); }); }
}
function fineReattach(cd, nd, fine){
  var c, k; for(c in fine.areas) if(fine.areas[c] === "hide") nd[c] = cd[c] || {};
  for(k in fine.fields){ var mode = fine.fields[k]; if(mode !== "hide" && mode !== "view") continue; var q = finePath(k), oc = cd[q.col] || {}, nc = nd[q.col]; if(!nc) continue;
    Object.keys(nc).forEach(function(id){ var o = oc[id], n = nc[id]; if(!n) return;
      if(!q.k2){ if(o){ if(q.k1 in o) n[q.k1] = o[q.k1]; else delete n[q.k1]; } else if(mode === "hide") delete n[q.k1]; return; }
      if(!Array.isArray(n[q.k1])) return; var was = o && Array.isArray(o[q.k1]) ? o[q.k1] : [];
      n[q.k1].forEach(function(row, i){ if(!row) return; var w = null; if(row.sku) for(var x = 0; x < was.length; x++) if(was[x] && was[x].sku === row.sku){ w = was[x]; break; } if(!w) w = was[i]; if(w){ if(q.k2 in w) row[q.k2] = w[q.k2]; else delete row[q.k2]; } else if(mode === "hide") delete row[q.k2]; }); }); }
}
function reattach(cd, nd){
  var cm = cd.setup && (cd.setup.main || cd.setup), nm = nd.setup && (nd.setup.main || nd.setup);
  if(cm && nm && cm.banks && nm.banks) nm.banks.forEach(function(b){ var o = cm.banks.filter(function(x){ return x.id === b.id; })[0]; if(o) SENSITIVE.forEach(function(k){ if(k in o && !(k in b)) b[k] = o[k]; }); });
  ["payments", "parties"].forEach(function(c){ if(!cd[c] || !nd[c]) return; Object.keys(nd[c]).forEach(function(id){ var o = cd[c][id], n = nd[c][id]; if(o && n) ["bank", "beneficiary", "iban", "swift", "account", "sortCode", "beneficiaryPending"].forEach(function(k){ if(k in o && !(k in n)) n[k] = o[k]; }); }); });
}

/* ================= emails from MY TOOL (21 Nov 2026) =================
   notifyOwner: a short email to the Owner when a supplier sends a file or someone asks for access — at most one per key and time.
   mailOut: the Owner sends an upload link or an invitation from MY TOOL; only to a real address, at most 40 a day. */
var OWNER_MAIL = "aemporio6@gmail.com", APP_URL = "https://mytool.vartleaves.com/";
function notifyOwner(key, minutes, subject, body){ try{ var c = CacheService.getScriptCache(), k = "nt:" + String(key).slice(0, 200); if(c.get(k)) return; c.put(k, "1", Math.min(21600, minutes * 60)); MailApp.sendEmail(OWNER_MAIL, subject, body, { name: "MY TOOL" }); }catch(e){ try{ logLine("notify failed " + e); }catch(_){} } }
function mailOut(req, by){ var to = String(req.to || "").trim().toLowerCase(), subj = String(req.subject || "").replace(/[\r\n]/g, " ").slice(0, 150), body = String(req.body || "").slice(0, 4000);
  if(!/^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(to)) fail(400, "not an email address"); if(!subj || !body) fail(400, "subject and text needed");
  var c = CacheService.getScriptCache(), day = Utilities.formatDate(new Date(), "Europe/London", "yyyy-MM-dd"), k = "mo:" + day, n = +(c.get(k) || 0); if(n >= 40) fail(429, "40 emails a day from MY TOOL — try tomorrow");
  MailApp.sendEmail(to, subj, body, { name: "MY TOOL — Vartleaves", replyTo: by }); c.put(k, String(n + 1), 21600); try{ logLine("ok mailOut " + to + " by " + by); }catch(_){}
  return { ok: true, to: to, left: 40 - n - 1 }; }
/* the secret of an upload link is kept on the supplier only for the Owners (so they can copy it again); nobody else ever gets it or can change a link */
function upStrip(d){ var ps = d.parties || {}; Object.keys(ps).forEach(function(k){ var u = ps[k] && ps[k].upload; if(u && u.t){ ps[k] = JSON.parse(JSON.stringify(ps[k])); delete ps[k].upload.t; } }); }
function upReattach(cd, nd){ var o = cd.parties || {}, n = nd.parties || {}; Object.keys(n).forEach(function(k){ if(!n[k]) return; if(o[k] && o[k].upload) n[k].upload = o[k].upload; else delete n[k].upload; }); }

/* ================= access requests (21 Nov 2026) =================
   A Google account that is not in Setup › Users can only ask. The request is kept in its own small file beside the data
   (never inside the data), one per account, at most 20 waiting. Only an Owner sees them, approves (by adding the person in
   Setup › Users), rejects or blocks. Nothing of the data is ever sent to an account that is only asking. */
var REQ_FILE = "MYTOOL-ACCESS-REQUESTS.json", REQ_MAX = 20;
function reqLoad(){ var fo = findDataFolder(); if(!fo) fail(500, "the data folder is not set up yet"); var it = fo.getFilesByName(REQ_FILE), f = it.hasNext() ? it.next() : null, j = {};
  if(f){ try{ j = JSON.parse(f.getBlob().getDataAsString()) || {}; }catch(_){ j = {}; } } return { file: f, folder: fo, list: j }; }
function reqSave(st){ var txt = JSON.stringify(st.list); if(st.file) st.file.setContent(txt); else st.folder.createFile(REQ_FILE, txt, "application/json"); }
function reqClean(s, n){ return String(s || "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n); }
function accessState(email){ var r = reqLoad().list[email]; return { ok: true, state: r ? r.state : "none", at: r && r.at || "" }; }
function accessAsk(email, req){
  var lock = LockService.getScriptLock(); if(!lock.tryLock(10000)) fail(503, "busy — try again");
  try{ var st = reqLoad(), r = st.list[email], now = new Date().toISOString();
    if(r && r.state === "blocked") return { ok: false, state: "blocked" };
    if(r && (r.state === "pending" || r.state === "approved")) return { ok: true, state: r.state, at: r.at };
    if(r && r.state === "rejected" && Date.now() - Date.parse(r.decidedAt || r.at) < 24 * 3600e3) return { ok: false, state: "rejected", at: r.at };
    var waiting = Object.keys(st.list).filter(function(k){ return st.list[k].state === "pending"; }).length;
    if(waiting >= REQ_MAX) fail(429, "Too many requests are waiting. Please contact the Owner directly.");
    st.list[email] = { email: email, name: reqClean(req.name, 80), note: reqClean(req.note, 300), at: now, state: "pending" }; reqSave(st);
    notifyOwner("ask:" + email, 1440, "MY TOOL · " + (reqClean(req.name, 80) || email) + " asks for access", (reqClean(req.name, 80) || "") + " <" + email + "> asks to use MY TOOL." + (req.note ? "\nThey wrote: " + reqClean(req.note, 300) : "") + "\n\nApprove, reject or block: " + APP_URL + " (Home › Access requests)");
    return { ok: true, state: "pending", at: now };
  }finally{ lock.releaseLock(); }
}
function accessForget(email){ try{ var st = reqLoad(); if(!st.list[email]) return; var lock = LockService.getScriptLock(); if(!lock.tryLock(5000)) return; try{ st = reqLoad(); if(st.list[email]){ delete st.list[email]; reqSave(st); } }finally{ lock.releaseLock(); } }catch(_){} }
function accessList(){ var l = reqLoad().list; return Object.keys(l).map(function(k){ return l[k]; }).sort(function(a, b){ return a.at < b.at ? 1 : -1; }); }
function accessDecide(req, by){
  var em = String(req.email || "").trim().toLowerCase(), d = String(req.decision || ""); if(!em || ["approved", "rejected", "blocked", "clear"].indexOf(d) < 0) fail(400, "decision?");
  var lock = LockService.getScriptLock(); if(!lock.tryLock(10000)) fail(503, "busy — try again");
  try{ var st = reqLoad();
    if(d === "clear") delete st.list[em];   /* "approved" stays (so the person sees "approved, opening…") until they are in Setup › Users and open MY TOOL */
    else { var r = st.list[em] || { email: em, name: "", note: "", at: new Date().toISOString() }; r.state = d; r.decidedBy = by; r.decidedAt = new Date().toISOString(); st.list[em] = r; }
    reqSave(st); return Object.keys(st.list).map(function(k){ return st.list[k]; }).sort(function(a, b){ return a.at < b.at ? 1 : -1; });
  }finally{ lock.releaseLock(); }
}

/* ================= attachments: the FILES folder is shared, the data is not ================= */
function filesFolder(){
  var it = DriveApp.getFoldersByName(FILES_FOLDER), f = null;
  while(it.hasNext()){ var x = it.next(); if(x.getOwner() && x.getOwner().getEmail().toLowerCase() === selfEmail()){ f = x; break; } }
  if(!f) f = DriveApp.createFolder(FILES_FOLDER);
  var parents = f.getParents(); if(parents.hasNext() && parents.next().getName() === FOLDER) f.moveTo(DriveApp.getRootFolder());   // never inside the data folder
  return f;
}
function shareFiles(email, role){
  if(!/^[^@\s]+@[^@\s]+\.[a-z]+$/i.test(email || "")) fail(400, "valid email needed");
  var f = filesFolder(); if(role === "reader") f.addViewer(email); else f.addEditor(email); return f.getId();
}
function lockDataFolder(){
  var removed = [], targets = [dataFolder(), dataFile(), filesFolder()].filter(Boolean);   /* data AND attachments: the gateway serves both */
  targets.forEach(function(t){
    t.getEditors().forEach(function(u){ var e = u.getEmail().toLowerCase(); if(ADMINS.indexOf(e) < 0){ t.removeEditor(u); removed.push(e); } });
    t.getViewers().forEach(function(u){ var e = u.getEmail().toLowerCase(); if(ADMINS.indexOf(e) < 0){ t.removeViewer(u); removed.push(e); } });
    try{ t.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); }catch(_){}
  });
  return removed;
}
/* an attachment, for someone allowed to use MY TOOL: only files inside the FILES folder are served */
function fileOut(id, email){
  var f; try{ f = DriveApp.getFileById(String(id || "")); }catch(e){ fail(404, "file not found"); }
  var ok = false, it = f.getParents(); while(it.hasNext()){ if(it.next().getName() === FILES_FOLDER) ok = true; }
  if(!ok) fail(403, "not a MY TOOL attachment");
  var blob = f.getBlob(); if(blob.getBytes().length > MAX_UPLOAD) fail(413, "file too big to open here — ask the admin for the Drive link");
  return { ok: true, name: f.getName(), mime: blob.getContentType(), b64: Utilities.base64Encode(blob.getBytes()), email: email };
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

/* ================= supplier upload link (20 Nov 2026) =================
   The Owner makes a link on a supplier's record and sends it (WeChat / email). The supplier opens it — no Google sign-in —
   sees ONE page (upload.html of the app, a static page) with "choose files"; that page sends each file here with the link's
   secret, and it lands in the folder "MY TOOL – INBOX / <supplier>" of this account. No HTML is served by this script (so
   nothing in it can be called from a page).
   The link can do nothing else: it reads nothing, lists nothing, opens nothing. Only the hash of the link's secret is kept on the
   supplier's record; the Owner can switch the link off or make a new one any time. Limits: file types, 20 MB each, files per day. */
var INBOX_FOLDER = "MY TOOL – INBOX", UP_TYPES = /\.(pdf|xlsx?|csv|docx?|jpe?g|png|webp|heic|txt)$/i, UP_DAY_ALL = 300;
function upHash(tok){ return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, "mytool-upload:" + tok)); }
function upFind(tok){ if(!/^[A-Za-z0-9_-]{24,80}$/.test(String(tok || ""))) return null; var h = upHash(tok), cache = CacheService.getScriptCache(), ck = "upf:" + h.slice(0, 60), hit = cache.get(ck);
  if(hit){ try{ return JSON.parse(hit); }catch(_){} }                        /* 2 minutes: a switched-off link stops within 2 minutes at the latest */
  var r = upLook(h); cache.put(ck, JSON.stringify(r), 120); return r; }
function upLook(h){ var cur = readCurrent(); if(!cur) return null; var ps = cur.json.data.parties || {}, ids = Object.keys(ps);
  for(var i = 0; i < ids.length; i++){ var p = ps[ids[i]], u = p && p.upload; if(!p || p.deletedAt || !u || u.on === false || String(u.h || "").replace(/=+$/, "") !== h.replace(/=+$/, "")) continue; if(u.exp && String(u.exp) < Utilities.formatDate(new Date(), "Europe/London", "yyyy-MM-dd")) return { expired: true }; var pos = cur.json.data.purchases || {}, ord = []; if(u.orders !== false) Object.keys(pos).forEach(function(k){ var o = pos[k]; if(o && !o.deletedAt && o.party === (p.code || ids[i]) && ["closed", "cancelled", "draft"].indexOf(o.status) < 0 && ord.length < 40) ord.push({ k: o.no || k, ref: String(o.yourRef || o.no || k).slice(0, 40) }); });
    return { code: p.code || ids[i], name: p.name || ids[i], max: +u.max || 30, orders: ord }; }
  return null; }
function inboxRoot(){ var it = DriveApp.getFoldersByName(INBOX_FOLDER), me = selfEmail(); while(it.hasNext()){ var f = it.next(); try{ if(f.getOwner().getEmail().toLowerCase() === me) return f; }catch(_){ return f; } } return DriveApp.createFolder(INBOX_FOLDER); }
function upSafe(s, n){ return String(s || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/^\.+/, "").slice(0, n || 120); }
/* called by upload.html through doPost — the only thing an upload link can do */
function supplierUpload(p){ p = p || {}; var who = upFind(p.tok); if(!who || who.expired) throw new Error("This upload link is not active. Please ask for a new one.");
  var name = upSafe(String(p.name || "").split(/[\\/]/).pop(), 120); if(!UP_TYPES.test(name)) throw new Error("This type of file cannot be sent here (PDF, Excel, CSV, Word, pictures only).");
  var bytes = Utilities.base64Decode(String(p.b64 || "")); if(!bytes.length) throw new Error("The file is empty."); if(bytes.length > MAX_UPLOAD) throw new Error("The file is bigger than 20 MB.");
  var cache = CacheService.getScriptCache(), day = Utilities.formatDate(new Date(), "Europe/London", "yyyy-MM-dd"), k1 = "up:" + day + ":" + who.code, k2 = "up:" + day + ":all", n1 = +(cache.get(k1) || 0), n2 = +(cache.get(k2) || 0);
  if(n1 >= who.max || n2 >= UP_DAY_ALL) throw new Error("Today's limit for this link is reached. Please try again tomorrow.");
  var root = inboxRoot(), fn = upSafe(who.code + " " + who.name, 80), it = root.getFoldersByName(fn), fo = it.hasNext() ? it.next() : root.createFolder(fn);
  var f = fo.createFile(Utilities.newBlob(bytes, String(p.mime || "application/octet-stream"), name));
  var po = String(p.po || ""), poOk = (who.orders || []).some(function(o){ return o.k === po; }); if(!poOk) po = "";
  f.setDescription(JSON.stringify({ via: "upload link", party: who.code, po: po, kind: String(p.kind || "").replace(/[\u0000-\u001f<>]/g, " ").slice(0, 30), note: String(p.note || "").replace(/[\u0000-\u001f<>]/g, " ").slice(0, 300), at: new Date().toISOString() }));
  cache.put(k1, String(n1 + 1), 21600); cache.put(k2, String(n2 + 1), 21600);
  try{ logLine("ok supplierUpload " + who.code + " " + name + " " + bytes.length + "b"); }catch(_){}
  notifyOwner("file:" + who.code, 60, "MY TOOL · " + who.name + " sent a file", who.name + " (" + who.code + ") sent “" + name + "”" + (p.kind ? " — " + String(p.kind).slice(0, 30) : "") + (po ? " for order " + po : "") + (p.note ? "\nNote: " + String(p.note).slice(0, 300) : "") + "\n\nOpen MY TOOL › Home › From suppliers: " + APP_URL + "\n(At most one email an hour per supplier.)");
  return { ok: true, name: name, left: who.max - n1 - 1 }; }
function inboxList(){ var out = [], it = DriveApp.getFoldersByName(INBOX_FOLDER), me = selfEmail(), root = null; while(it.hasNext()){ var r = it.next(); try{ if(r.getOwner().getEmail().toLowerCase() !== me) continue; }catch(_){} root = r; break; } if(!root) return out;
  var subs = root.getFolders(); while(subs.hasNext()){ var fo = subs.next(), nm = fo.getName(); if(nm === "done") continue; var fs = fo.getFiles(); while(fs.hasNext() && out.length < 200){ var f = fs.next(), d = {}; try{ d = JSON.parse(f.getDescription() || "{}"); }catch(_){}
      out.push({ id: f.getId(), name: f.getName(), size: f.getSize(), at: d.at || f.getDateCreated().toISOString(), party: d.party || nm.split(" ")[0], kind: d.kind || "", note: d.note || "", po: d.po || "", folder: nm }); } }
  out.sort(function(a, b){ return a.at < b.at ? 1 : -1; }); return out; }
function inboxGet(id){ var f; try{ f = DriveApp.getFileById(String(id || "")); }catch(e){ fail(404, "file not found"); } var ok = false, p = f.getParents(); while(p.hasNext()){ var fo = p.next(), g = fo.getParents(); while(g.hasNext()){ if(g.next().getName() === INBOX_FOLDER) ok = true; } } if(!ok) fail(403, "not a supplier upload"); return f; }
