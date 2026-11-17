/* MY TOOL — independent daily backup (Google Apps Script, runs in aemporio6's Google account, no app needs to be open)
   SET UP ONCE (5 minutes):
   1. Sign in as aemporio6 → https://script.google.com → New project → paste this file → save as "MY TOOL backup".
   2. Run `setup` once (menu ▶ Run → setup). Allow the Drive permission when asked.
   3. Done: every day at ~03:00 a copy "MYTOOL-DATA backup YYYY-MM-DD.json" is made in "MY TOOL – DATA/backups",
      the copy is read back and checked (valid JSON, same size), old copies are thinned (30 daily, 12 weekly, all monthly),
      and if anything fails an email goes to the owner. Every Monday a short Data health summary email is sent too.
   Nothing else is changed. The app's own same-day copy (made while an admin uses the app) stays as a second line.
   MORNING EMAIL (17 Nov 2026): right after the backup, everyone in Setup › Users gets ONE short email with only their own things
   (their late / due tasks; for those who approve: payments and bank-detail changes waiting; for Owner / Finance: today's alerts,
   shipments arriving, landed cost changed after FINAL). Nothing to say = no email. A user with "digest: off" gets none. */
var FOLDER = "MY TOOL – DATA", FILE = "MYTOOL-DATA.json", ALERT_TO = "aemporio6@gmail.com";
var ADMINS = ["aemporio6@gmail.com", "maashiq123@gmail.com", "maashiq@gmail.com"], APP = "https://aemporio6.github.io/nexus-sourcing/";
var OWNER_MAIL = "maashiq@gmail.com";   /* the owner's morning email goes here (one email, not one per admin account) */

function setup(){
  ScriptApp.getProjectTriggers().forEach(function(t){ ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("dailyBackup").timeBased().everyDays(1).atHour(3).create();
  dailyBackup();
}

/* Monday morning: a short Data health email (score, serious issues, top problems) from the summary MY TOOL saves each day */
function weeklyHealthMail(force){
  try{
    var d = new Date(); if(!force && d.getDay() !== 1) return;          // 1 = Monday
    var folder = DriveApp.getFoldersByName(FOLDER); if(!folder.hasNext()) return; folder = folder.next();
    var src = folder.getFilesByName(FILE); if(!src.hasNext()) return;
    var j = JSON.parse(src.next().getBlob().getDataAsString()); var main = j.data && j.data.setup && (j.data.setup.main || j.data.setup) || {}; var h = main.healthSummary;
    if(!h){ MailApp.sendEmail(ALERT_TO, "MY TOOL weekly: no health summary yet", "Open MY TOOL as an admin once so Data health can run; the summary is then saved daily."); return; }
    var lines = ["MY TOOL — weekly Data health (" + h.day + ")", "", "Score: " + h.score + "%", "Issues: " + h.issues + " (serious: " + h.serious + ") · Alerts: " + h.alerts, "", "Top problems:"];
    (h.top || []).forEach(function(t){ lines.push(" - " + t.l + ": " + t.n); });
    lines.push("", "Records: " + Object.keys(h.records || {}).map(function(k){ return k + " " + h.records[k]; }).join(" · "), "", "Open: https://aemporio6.github.io/nexus-sourcing/#/health");
    MailApp.sendEmail(ALERT_TO, "MY TOOL weekly health: " + h.score + "% · " + h.serious + " serious", lines.join("\n"));
  }catch(e){ MailApp.sendEmail(ALERT_TO, "MY TOOL weekly health mail FAILED", String(e && e.message || e)); }
}
function dailyBackup(){
  weeklyHealthMail(false);
  try{
    var folder = DriveApp.getFoldersByName(FOLDER); if(!folder.hasNext()) throw new Error("folder not found: " + FOLDER);
    folder = folder.next();
    var src = folder.getFilesByName(FILE); if(!src.hasNext()) throw new Error("data file not found: " + FILE);
    src = src.next();
    var bk = folder.getFoldersByName("backups"); bk = bk.hasNext() ? bk.next() : folder.createFolder("backups");
    var day = Utilities.formatDate(new Date(), "Europe/London", "yyyy-MM-dd");
    var name = "MYTOOL-DATA backup " + day + ".json";
    if(bk.getFilesByName(name).hasNext()) return;                      // already made today
    var copy = src.makeCopy(name, bk);
    /* verify: read the copy back, it must parse and hold the data block with the same byte size */
    var txt = copy.getBlob().getDataAsString(); var j = JSON.parse(txt);
    if(!j || !j.data || txt.length !== src.getBlob().getDataAsString().length) throw new Error("backup copy does not match the source");
    thin(bk);
    try{ morningDigest(j, day); }catch(de){ MailApp.sendEmail(ALERT_TO, "MY TOOL morning email FAILED", String(de && de.message || de)); }
  }catch(e){
    MailApp.sendEmail(ALERT_TO, "MY TOOL backup FAILED " + new Date().toDateString(), String(e && e.message || e));
    throw e;
  }
}

/* keep: every copy from the last 30 days, Mondays for 12 weeks, the 1st of every month for ever */
function thin(bk){
  var it = bk.getFiles(), now = new Date();
  while(it.hasNext()){
    var f = it.next(), m = /backup (\d{4})-(\d{2})-(\d{2})\.json$/.exec(f.getName()); if(!m) continue;
    var d = new Date(+m[1], +m[2] - 1, +m[3]), age = (now - d) / 864e5;
    if(age <= 30) continue;
    if(d.getDate() === 1) continue;
    if(age <= 90 && d.getDay() === 1) continue;
    f.setTrashed(true);
  }
}

/* ---------- morning email: one per person, only their own things ---------- */
function morningDigest(j, day, dry){
  var d = (j && j.data) || {}, main = (d.setup && (d.setup.main || d.setup)) || {}, roles = main.roles || {}, out = [];
  var vals = function(c){ var o = d[c] || {}; return Object.keys(o).map(function(k){ return o[k]; }).filter(function(x){ return x && !x.deletedAt; }); };
  var lc = function(s){ return String(s || "").trim().toLowerCase(); };
  var link = function(col, id){ return col && id ? APP + "#/doc/" + col + "/" + encodeURIComponent(id) : APP; };
  var people = {}; people[OWNER_MAIL] = { email: OWNER_MAIL, admin: true, name: "", perms: {} };
  (main.users || []).forEach(function(u){ var e = lc(u.uid || u.email); if(!e || u.active === false) return; if(ADMINS.indexOf(e) >= 0 && e !== OWNER_MAIL) return; /* the owner gets one email */ var p = people[e] || { email: e, admin: ADMINS.indexOf(e) >= 0 };
    p.name = u.name || e; p.perms = roles[u.role] || {}; p.off = u.digest === false; people[e] = p; });
  var addD = function(n){ var x = new Date(day + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  var soon = addD(2), in3 = addD(3);
  var tasks = vals("tasks"), pays = vals("payments"), parts = vals("parties"), ships = vals("shipments"), recs = vals("receipts");
  var feed = main.digestFeed && main.digestFeed.items && main.digestFeed.day >= addD(-2) ? main.digestFeed : null;
  Object.keys(people).forEach(function(e){
    var p = people[e]; if(p.off) return; var mayApprove = p.admin || p.perms.approve, money = p.admin || p.perms.approve || p.perms.bank, sec = [];
    var mine = tasks.filter(function(t){ return lc(t.who) === e && t.status !== "done" && t.due && t.due <= soon; }).sort(function(a, b){ return a.due < b.due ? -1 : 1; });
    if(mine.length) sec.push(["Your tasks", mine.slice(0, 15).map(function(t){ return (t.due < day ? "LATE " : t.due === day ? "TODAY " : "") + t.title + " (" + t.due + ")\n  " + link(t.ref ? colOf(t.ref) : null, t.ref) ; })]);
    if(mayApprove){
      var wait = pays.filter(function(x){ return x.needsApproval && !x.approved && x.status !== "cancelled" && lc(x.requestedBy || x.createdBy) !== e; });
      if(wait.length) sec.push(["Waiting for your approval", wait.map(function(x){ return x.no + " · " + x.amount + " " + x.cur + " (£" + Math.round(+x.gbp || 0) + ")\n  " + link("payments", x.no); })]);
      var bank = parts.filter(function(x){ return x.beneficiaryPending && lc(x.beneficiaryPending.by) !== e; });
      if(bank.length) sec.push(["New supplier bank details waiting for approval", bank.map(function(x){ return (x.name || x.code) + " — call the supplier before approving\n  " + link("parties", x.code); })]);
    }
    if(money){
      var arr = ships.filter(function(s){ return s.eta && s.eta >= day && s.eta <= in3 && ["delivered", "cancelled", "received"].indexOf(s.status) < 0; });
      if(arr.length) sec.push(["Shipments arriving in the next 3 days", arr.map(function(s){ return s.no + " · ETA " + s.eta + (s.ctn ? " · " + s.ctn + " ctn" : "") + "\n  " + link("shipments", s.no); })]);
      var lp = recs.filter(function(r){ return r.landedPending; });
      if(lp.length) sec.push(["Landed cost changed after FINAL — accept or keep", lp.map(function(r){ return r.no + "\n  " + link("receipts", r.no); })]);
      if(feed){ var it = feed.items.filter(function(a){ return a.sev >= 2; }).slice(0, 15); if(it.length) sec.push(["Alerts in MY TOOL (as of " + feed.day + ")", it.map(function(a){ return a.t + (a.col ? "\n  " + link(a.col, a.id) : ""); })]); }
    }
    if(!sec.length) return;
    var n = sec.reduce(function(s, x){ return s + x[1].length; }, 0);
    var body = ["Good morning " + (p.name || "") + ",", "", "Your MY TOOL list for " + day + ":", ""];
    sec.forEach(function(x){ body.push("■ " + x[0] + " (" + x[1].length + ")"); x[1].forEach(function(l){ body.push("• " + l); }); body.push(""); });
    body.push("Open MY TOOL: " + APP, "", "(You get this email only on days when something is waiting for you. To stop it, ask the admin: Setup › Users › morning email off.)");
    var mail = { to: e, subject: "MY TOOL · " + n + " thing" + (n === 1 ? "" : "s") + " for you today", body: body.join("\n") };
    out.push(mail); if(!dry) MailApp.sendEmail(mail.to, mail.subject, mail.body);
  });
  return out;
}
function colOf(ref){ var m = /^(PO|SH|PAY|IN|RC|CR|MV)-/.exec(String(ref || "")); return m ? { PO: "purchases", SH: "shipments", PAY: "payments", IN: "inspections", RC: "receipts", CR: "credits", MV: "moves" }[m[1]] : null; }
/* run by hand to see today's emails without sending them (View › Logs) */
function previewDigest(){ var f = DriveApp.getFoldersByName(FOLDER).next().getFilesByName(FILE).next(); var j = JSON.parse(f.getBlob().getDataAsString()); var day = Utilities.formatDate(new Date(), "Europe/London", "yyyy-MM-dd"); morningDigest(j, day, true).forEach(function(m){ Logger.log(m.to + " — " + m.subject + "\n" + m.body); }); }
