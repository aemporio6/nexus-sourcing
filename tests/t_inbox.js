/* Drive link + inbox (fake Google, repo served on :8098, SEED_FILE=…):  node tests/t_inbox.js
   Needs /tmp/TOUQEER_tx.csv (owner's real eBay report, kept outside the repo). */
const { chromium } = require("playwright"); const fs = require("fs");
const { drive, mkRoute } = require("./fakedrive");
const SEED = process.env.SEED_FILE;
(async () => {
  const b = await chromium.launch(); let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if(!c) fails++; };
  /* owner's Drive: data folder + file, an INBOX with TOUQEER/<report>, a stray unknown spreadsheet, a photo */
  const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
  const who = "aemporio6@gmail.com";
  const mk = (name, parent, extra) => { const id = "F" + (++drive.n); drive.files[id] = { id, name, owner: who, parent, version: 1, ...extra }; return id; };
  const dataFolder = mk("MY TOOL – DATA", "root", { folder: true });
  mk("MYTOOL-DATA.json", dataFolder, { content: JSON.stringify({ format: "mytool-1", schema: 1, data: seed.data, tomb: {}, revs: {} }) });
  const inbox = mk("INBOX", "root", { folder: true }); const tq = mk("TOUQEER", inbox, { folder: true });
  const rep = mk("TOUQEER_tx.csv", tq, { mime: "text/csv", content: fs.readFileSync("/tmp/TOUQEER_tx.csv", "utf8") });
  const odd = mk("random notes.csv", inbox, { mime: "text/csv", content: "a,b,c\n1,2,3\n4,5,6\n" });
  mk("photo.jpg", inbox, { mime: "image/jpeg", content: "xx" });
  const ctx = await b.newContext(); await ctx.addInitScript(w => { window.__who = w; try{ localStorage.setItem("mt_gw", "off"); }catch(_){} }, who);
  await ctx.route(/fonts\.(googleapis|gstatic)/, r => r.abort()); await ctx.route(/accounts\.google\.com|googleapis\.com/, mkRoute(ctx));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("http://localhost:8098/index.html"); await p.waitForSelector("#mt_signin"); await p.click("#mt_signin"); await p.waitForFunction(() => { try{ return S.ready }catch(e){ return false } }, null, { timeout: 20000 }); await p.waitForTimeout(800);
  /* 1. link parsing */
  const parsed = await p.evaluate(() => ["https://drive.google.com/drive/folders/1AbC_def-GHI?usp=sharing", "https://drive.google.com/file/d/1XyZ-9/view?usp=drive_link", "https://docs.google.com/spreadsheets/d/1Sheet_ID/edit#gid=0", "https://drive.google.com/open?id=1OpenId", "https://drive.google.com/drive/u/1/folders/1UserFolder", "not a link"].map(u => driveIdFromLink(u)));
  ok(parsed[0].id === "1AbC_def-GHI" && parsed[0].kind === "folder" && parsed[1].id === "1XyZ-9" && parsed[2].id === "1Sheet_ID" && parsed[3].id === "1OpenId" && parsed[4].id === "1UserFolder" && parsed[5] === null, "every Drive link form is understood; junk is refused");
  /* 2. paste a folder link → opens that folder in the Drive panel */
  await p.evaluate(() => { S.view = { k: "import", params: {} }; render(); ixDrv().open = true; ixDriveRender(); });
  const o1 = await p.evaluate(async id => { const r = await driveOpenLink("https://drive.google.com/drive/folders/" + id + "?usp=sharing"); return { r: !!r && !!r.folder, path: ixDrv().path.map(x => x.name), items: ixDrv().items.map(x => x.name) }; }, inbox);
  ok(o1.r && o1.path[0] === "INBOX" && o1.items.includes("TOUQEER") && o1.items.includes("random notes.csv"), "folder link opened: " + JSON.stringify(o1.path) + " → " + o1.items.join(", "));
  /* 3. a link that is not shared → clear message, nothing breaks */
  const o2 = await p.evaluate(async () => { let msg = ""; const t = toast; window.toast = (m) => { msg = m; }; const r = await driveOpenLink("https://drive.google.com/drive/folders/1NotSharedWithMe"); window.toast = t; return { r, msg }; });
  ok(o2.r === null && /not shared|does not exist/.test(o2.msg), "unshared link → " + o2.msg.slice(0, 80));
  /* 4. inbox: set the folder, scan, run */
  await p.evaluate(async id => { await setupPatchMany([[["inbox"], { id, name: "INBOX", at: nowIso(), by: uid }]], "t"); }, inbox);
  const found = await p.evaluate(() => inboxScan().then(f => f.map(x => [x.name, x.account])));
  ok(found.length === 2 && found.some(f => f[0] === "TOUQEER_tx.csv" && f[1] === "TOUQEER") && found.some(f => f[0] === "random notes.csv"), "scan finds the report (account from sub-folder) and the unknown file, skips the photo: " + JSON.stringify(found));
  const before = await p.evaluate(() => live(D.salesStats).filter(x => x.type === "ebay").length);
  const run = await p.evaluate(() => inboxRun(S.inboxNew));
  await p.waitForTimeout(1500);
  const after = await p.evaluate(() => ({ n: live(D.salesStats).filter(x => x.type === "ebay" && x.account === "TOUQEER").length, done: D.setup.inboxDone, q: S.impQ && S.impQ.items.map(i => [i.name, i.st]), view: S.view.k }));
  ok(run.auto === 1 && after.n > 100 && after.done[rep] && after.done[rep].st === "imported", "eBay report imported by itself (" + after.n + " summaries), remembered as done");
  ok(run.review === 1 && after.q && after.q[0][0] === "random notes.csv" && after.view === "import", "unknown file waits in the import queue for a human: " + JSON.stringify(after.q));
  /* 5. second scan: nothing new (the report is remembered, the odd file is still pending so it shows again) */
  const again = await p.evaluate(() => inboxScan().then(f => f.map(x => x.name)));
  ok(!again.includes("TOUQEER_tx.csv"), "processed report is not offered again: " + JSON.stringify(again));
  ok(await p.evaluate(() => attention().some(a => /Drive inbox/.test(a.t))) === again.length > 0, "inbox shows in Alerts only while something is new");
  ok(!errs.length, "no page errors " + JSON.stringify(errs.slice(0, 2)));
  console.log(fails ? fails + " FAILED" : "ALL PASS"); await b.close(); process.exit(fails ? 1 : 0);
})();
