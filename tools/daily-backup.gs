/* MY TOOL — independent daily backup (Google Apps Script, runs in aemporio6's Google account, no app needs to be open)
   SET UP ONCE (5 minutes):
   1. Sign in as aemporio6 → https://script.google.com → New project → paste this file → save as "MY TOOL backup".
   2. Run `setup` once (menu ▶ Run → setup). Allow the Drive permission when asked.
   3. Done: every day at ~03:00 a copy "MYTOOL-DATA backup YYYY-MM-DD.json" is made in "MY TOOL – DATA/backups",
      the copy is read back and checked (valid JSON, same size), old copies are thinned (30 daily, 12 weekly, all monthly),
      and if anything fails an email goes to the owner.
   Nothing else is changed. The app's own same-day copy (made while an admin uses the app) stays as a second line. */
var FOLDER = "MY TOOL – DATA", FILE = "MYTOOL-DATA.json", ALERT_TO = "aemporio6@gmail.com";

function setup(){
  ScriptApp.getProjectTriggers().forEach(function(t){ ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("dailyBackup").timeBased().everyDays(1).atHour(3).create();
  dailyBackup();
}

function dailyBackup(){
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
