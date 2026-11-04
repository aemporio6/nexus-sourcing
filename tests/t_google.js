// Live-mode test with a fake Google (sign-in + Drive) — checks gshim: first run, load, save, merge from a 2nd user, access rules, share.
// Run: NODE_PATH=/opt/npm-tools/node_modules node tests/t_google.js  (needs http server on :8098 serving the repo root)
const { chromium } = require("playwright");
const fs = require("fs");
const SEED = process.env.SEED_FILE;
let drive = { files: {}, n: 0, perms: [] };
const fakeGis = `window.google={accounts:{oauth2:{initTokenClient(o){const c={callback:o.callback,requestAccessToken(){setTimeout(()=>c.callback({access_token:"tok-"+(window.__who||"aemporio6@gmail.com"),expires_in:3600}),10)}};return c},revoke(t,cb){cb&&cb()}}}};`;
function mkRoute(ctx){
  return async route => {
    const req = route.request(); const url = new URL(req.url()); const auth = req.headers()["authorization"] || ""; const who = auth.replace("Bearer tok-", "");
    const json = (o, s) => route.fulfill({ status: s || 200, contentType: "application/json", body: JSON.stringify(o) });
    if (url.hostname === "accounts.google.com") return route.fulfill({ status: 200, contentType: "text/javascript", body: fakeGis });
    if (url.pathname === "/oauth2/v3/userinfo") return json({ email: who, name: who.split("@")[0] });
    const files = drive.files;
    const visible = f => f.owner === who || drive.perms.some(p => p.file === f.parent && p.email === who) || drive.perms.some(p => p.file === f.id && p.email === who);
    if (url.pathname === "/drive/v3/files" && req.method() === "GET") {
      const q = url.searchParams.get("q") || ""; drive.lastQ = q; const name = (q.match(/name\s*=\s*'([^']+)'/) || [])[1]; const contains = (q.match(/name contains '([^']+)'/) || [])[1]; const folder = q.includes("folder");
      const list = Object.values(files).filter(f => (contains ? String(f.name).includes(contains) : f.name === name) && (folder ? f.folder : !f.folder) && visible(f));
      return json({ files: list.map(f => ({ id: f.id, name: f.name, version: String(f.version), modifiedTime: new Date().toISOString(), size: String((f.content || "").length), owners: [{ emailAddress: f.owner }], parents: [f.parent] })) });
    }
    if (url.pathname === "/drive/v3/files" && req.method() === "POST") { const b = JSON.parse(req.postData()); const id = "F" + (++drive.n); files[id] = { id, name: b.name, folder: true, owner: who, parent: (b.parents || [])[0], version: 1 }; return json({ id }); }
    let m;
    if ((m = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)\/permissions$/))) { const b = JSON.parse(req.postData()); drive.perms.push({ file: m[1], email: b.emailAddress, role: b.role }); return json({ id: "p" + drive.perms.length }); }
    if ((m = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)\/copy$/))) { const f = files[m[1]]; if (!f || !visible(f)) return json({ error: { message: "not found" } }, 404); const b = JSON.parse(req.postData()); const id = "F" + (++drive.n); files[id] = { id, name: b.name, owner: f.owner, parent: (b.parents || [f.parent])[0], version: 1, content: f.content, by: who }; return json({ id }); }
    if ((m = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/))) {
      const f = files[m[1]]; if (!f || !visible(f)) return json({ error: { message: "not found" } }, 404);
      if (url.searchParams.get("alt") === "media") return route.fulfill({ status: 200, contentType: "application/json", body: f.content });
      return json({ version: String(f.version), modifiedTime: new Date().toISOString(), lastModifyingUser: { emailAddress: f.by || f.owner } });
    }
    if (url.pathname === "/upload/drive/v3/files" && req.method() === "POST") {
      const body = req.postData(); const parts = body.split(/--mt[a-z0-9]+/).filter(x => x.includes("Content-Type"));
      const meta = JSON.parse(parts[0].split("\r\n\r\n")[1]); const content = parts[1].split("\r\n\r\n").slice(1).join("\r\n\r\n").replace(/\r\n$/, "");
      const id = "F" + (++drive.n); files[id] = { id, name: meta.name, owner: who, parent: (meta.parents || [])[0], version: 1, content, by: who }; return json({ id, version: "1", webViewLink: "https://drive.google.com/file/d/" + id + "/view" });
    }
    if ((m = url.pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/))) { const f = files[m[1]]; if (!visible(f)) return json({ error: { message: "forbidden" } }, 403); f.content = req.postData(); f.version++; f.by = who; return json({ version: String(f.version) }); }
    return json({ error: { message: "unhandled " + url.pathname } }, 500);
  };
}
(async () => {
  const b = await chromium.launch(); let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
  const open = async (who) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(w => { window.__who = w; try{ localStorage.setItem("mt_gw", "off"); }catch(_){} }, who);
    await ctx.route(/fonts\.(googleapis|gstatic)/, r => r.abort()); await ctx.route(/accounts\.google\.com|googleapis\.com/, mkRoute());
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto("http://localhost:8098/index.html"); return { ctx, p, errs };
  };
  // 1. owner first run → sign in → start with starting file
  let A = await open("aemporio6@gmail.com");
  await A.p.waitForSelector("#mt_signin"); await A.p.click("#mt_signin");
  await A.p.waitForSelector("#mt_file", { state: "attached", timeout: 10000 });
  await A.p.setInputFiles("#mt_file", SEED);
  await A.p.waitForFunction(() => { try { return S.ready } catch (e) { return false } }, null, { timeout: 20000 });
  const nPo = await A.p.evaluate(() => D.purchases.length); ok(nPo > 10, "owner first run loads starting file (" + nPo + " orders)");
  const dataFile = Object.values(drive.files).find(f => f.name === "MYTOOL-DATA.json"); ok(!!dataFile && Object.values(drive.files).some(f => f.folder && f.name === "MY TOOL – DATA"), "data file + folder created in owner's Drive");
  ok(await A.p.evaluate(() => S.realRole) === "owner", "aemporio6 is Owner");
  // 2. owner edits → saved to Drive
  await A.p.evaluate(() => updateDoc("parties", D.parties[0].code, { note: "edit-by-A" }, "t"));
  await A.p.waitForTimeout(2500);
  ok(JSON.parse(drive.files[dataFile.id].content).data.parties[Object.keys(JSON.parse(drive.files[dataFile.id].content).data.parties)[0]] !== undefined && drive.files[dataFile.id].content.includes("edit-by-A"), "edit saved to Drive file");
  // 3. stranger (not shared) → blocked
  let C = await open("stranger@gmail.com"); await C.p.waitForSelector("#mt_signin"); await C.p.click("#mt_signin");
  await C.p.waitForSelector("#mt_gate p", { timeout: 10000 }); await C.p.waitForTimeout(800);
  ok((await C.p.textContent("#mt_gate")).includes("not been shared"), "unshared account sees 'not shared' and no data");
  await C.ctx.close();
  // 4. owner adds a team user + shares folder → team user opens, edits; owner sees it after poll
  await A.p.evaluate(() => setupPatch(["users"], [{ id: "u_t", name: "Team", uid: "team1@gmail.com", role: "va", active: true }], "add user"));
  await A.p.evaluate(() => MYTOOL.shareWith("team1@gmail.com", "writer")); await A.p.waitForTimeout(2500);
  ok(drive.perms.some(p => p.email === "team1@gmail.com"), "Share data creates Drive permission");
  let T = await open("team1@gmail.com"); await T.p.waitForSelector("#mt_signin"); await T.p.click("#mt_signin");
  await T.p.waitForFunction(() => { try { return S.ready } catch (e) { return false } }, null, { timeout: 20000 });
  ok(await T.p.evaluate(() => S.realRole) === "va", "team user opens with role from Setup (va)");
  await T.p.evaluate(() => updateDoc("parties", D.parties[1].code, { note: "edit-by-T" }, "t")); await T.p.waitForTimeout(2500);
  await A.p.evaluate(() => MYTOOL.syncNow()); await A.p.waitForTimeout(800);
  ok(await A.p.evaluate(() => D.parties[1].note) === "edit-by-T", "owner sees team user's change after sync");
  ok(await A.p.evaluate(() => D.parties[0].note) === "edit-by-A", "owner's own change kept after merge");
  // 5. user removed (inactive) → blocked on next open
  await A.p.evaluate(() => setupPatch(["users", 0, "active"], false, "deactivate")); await A.p.waitForTimeout(2500);
  let T2 = await open("team1@gmail.com"); await T2.p.waitForSelector("#mt_signin"); await T2.p.click("#mt_signin"); await T2.p.waitForTimeout(3000);
  ok((await T2.p.textContent("#mt_gate").catch(() => "")).includes("not allowed"), "inactive user is blocked");
  // 6. admin maashiq123 without being listed → owner
  drive.perms.push({ file: dataFile.parent, email: "maashiq123@gmail.com", role: "writer" });
  let M = await open("maashiq123@gmail.com"); await M.p.waitForSelector("#mt_signin"); await M.p.click("#mt_signin");
  await M.p.waitForFunction(() => { try { return S.ready } catch (e) { return false } }, null, { timeout: 20000 });
  ok(await M.p.evaluate(() => S.realRole) === "owner", "maashiq123 always Owner (never locked out)");
  // backup + restore, proven on the (fake) Drive: a daily copy exists, restoring it brings the old data back and makes a before-restore copy first
  await A.p.evaluate(() => { localStorage.removeItem("mt_bk"); return MYTOOL.syncNow(); }); await A.p.waitForTimeout(1500);
  const bk = Object.values(drive.files).filter(f => /MYTOOL-DATA backup/.test(f.name)); ok(bk.length === 1, "exactly one daily backup copy made in Drive, by whichever admin came first (" + bk.map(f => f.name).join(", ") + ")");
  const snapNote = JSON.parse(bk[0].content).data.parties[Object.keys(JSON.parse(bk[0].content).data.parties)[0]].note;
  await A.p.evaluate(() => updateDoc("parties", D.parties[0].code, { note: "after-backup-edit" }, "t")); await A.p.waitForTimeout(2500);
  ok(drive.files[dataFile.id].content.includes("after-backup-edit"), "a later edit is in the live file");
  const list = await A.p.evaluate(() => MYTOOL.listBackups()); ok(list.length >= 1 && list[0].name === bk[0].name, "Version history lists the backup");
  await A.p.evaluate(id => MYTOOL.restoreFromDrive(id).catch(e => e.message), list[0].id); await A.p.waitForTimeout(3000);
  const live2 = JSON.parse(drive.files[dataFile.id].content);
  ok(live2.data.parties[Object.keys(live2.data.parties)[0]].note === snapNote && !drive.files[dataFile.id].content.includes("after-backup-edit"), "restore put the backup's data back into the live file");
  ok(Object.values(drive.files).some(f => /before-restore/.test(f.name) && f.content.includes("after-backup-edit")), "a before-restore copy holds the pre-restore data (restore itself can be undone)");
  // yearly archive: closed 2024 records move to MYTOOL-ARCHIVE-2024.json, still visible read-only, live file smaller; bring back restores
  const can24 = await A.p.evaluate(() => MYTOOL.archivable(2024)); const n24 = Object.values(can24).reduce((t, v) => t + v, 0);
  ok(n24 > 0, "2024 has closed records to archive: " + JSON.stringify(can24));
  const liveBefore = drive.files[dataFile.id].content.length; const poBefore = await A.p.evaluate(() => D.purchases.length);
  const ar = await A.p.evaluate(() => MYTOOL.archiveYear(2024).catch(e => ({ err: e.message }))); await A.p.waitForTimeout(3000);
  ok(ar.moved === n24 && !ar.err, "archiveYear moved " + ar.moved + " records " + (ar.err || ""));
  const af = Object.values(drive.files).find(f => f.name === "MYTOOL-ARCHIVE-2024.json"); ok(!!af && Object.keys(JSON.parse(af.content).data.purchases || {}).length === can24.purchases, "archive file written with the orders");
  ok(drive.files[dataFile.id].content.length < liveBefore, "live file is smaller (" + liveBefore + " → " + drive.files[dataFile.id].content.length + ")");
  ok(await A.p.evaluate(() => D.purchases.length) === poBefore && await A.p.evaluate(() => D.purchases.filter(p => p._arch === "2024").length) === can24.purchases, "archived orders still visible in the app, marked _arch");
  const arId = await A.p.evaluate(() => D.purchases.find(p => p._arch === "2024").no);
  const g = await A.p.evaluate(no => updateDoc("purchases", no, { note: "x" }, "t").then(r => "ok:" + r).catch(e => "err:" + e.message), arId);
  ok(!/ok:true/.test(g), "editing an archived record is refused (" + String(g).slice(0, 60) + ")");
  // a second device sees the archive too
  const M2 = await open("maashiq123@gmail.com"); await M2.p.waitForSelector("#mt_signin"); await M2.p.click("#mt_signin"); await M2.p.waitForFunction(() => { try { return S.ready } catch (e) { return false } }, null, { timeout: 20000 }); await M2.p.waitForTimeout(2500);
  ok(await M2.p.evaluate(() => D.purchases.filter(p => p._arch === "2024").length) === can24.purchases && await M2.p.evaluate(() => D.purchases.length) === poBefore, "another device loads live + archive, nothing missing");
  const back = await A.p.evaluate(() => MYTOOL.unarchiveYear(2024).catch(e => ({ err: e.message }))); await A.p.waitForTimeout(3000);
  ok(back === n24 && await A.p.evaluate(() => D.purchases.filter(p => p._arch).length) === 0 && JSON.parse(drive.files[dataFile.id].content).data.purchases[arId], "bring back: records editable again and in the live file");
  ok(A.errs.length === 0 && T.errs.length === 0 && M.errs.length === 0, "no page errors " + JSON.stringify([...A.errs, ...T.errs, ...M.errs]).slice(0, 300));
  await b.close(); console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(fails ? 1 : 0);
})();
