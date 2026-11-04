// Multi-user sync test (3-way merge, same-number clash, rolled-back save) with a fake Google (sign-in + Drive) — checks gshim: first run, load, save, merge from a 2nd user, access rules, share.
// Run: NODE_PATH=/opt/npm-tools/node_modules node tests/t_sync.js  (needs http server on :8098 serving the repo root)
const { chromium } = require("playwright");
const fs = require("fs");
const SEED = process.env.SEED_FILE;
let drive = { files: {}, n: 0, perms: [] }; const stale = {};
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
      const q = url.searchParams.get("q") || ""; const name = (q.match(/name='([^']+)'/) || [])[1]; const folder = q.includes("folder");
      const list = Object.values(files).filter(f => f.name === name && (folder ? f.folder : !f.folder) && visible(f));
      return json({ files: list.map(f => ({ id: f.id, version: String(f.version), owners: [{ emailAddress: f.owner }], parents: [f.parent] })) });
    }
    if (url.pathname === "/drive/v3/files" && req.method() === "POST") { const b = JSON.parse(req.postData()); const id = "F" + (++drive.n); files[id] = { id, name: b.name, folder: true, owner: who, parent: (b.parents || [])[0], version: 1 }; return json({ id }); }
    let m;
    if ((m = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)\/permissions$/))) { const b = JSON.parse(req.postData()); drive.perms.push({ file: m[1], email: b.emailAddress, role: b.role }); return json({ id: "p" + drive.perms.length }); }
    if ((m = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/))) {
      const f = files[m[1]]; if (!f || !visible(f)) return json({ error: { message: "not found" } }, 404);
      if (url.searchParams.get("alt") === "media") return route.fulfill({ status: 200, contentType: "application/json", body: f.content });
      if(stale[who]){ const v = stale[who]; delete stale[who]; return json({ version: String(v), modifiedTime: new Date().toISOString() }); }
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
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(w => { window.__who = w; }, who);
    await ctx.route(/fonts\.(googleapis|gstatic)|frankfurter|er-api/, r => r.abort()); await ctx.route(/accounts\.google\.com|googleapis\.com/, mkRoute());
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto("http://localhost:8098/index.html"); return { ctx, p, errs };
  };
  const ready = P => P.waitForFunction(() => { try { return S.ready } catch (e) { return false } }, null, { timeout: 20000 });
  const sync = async P => { await P.evaluate(() => MYTOOL.syncNow()); await P.waitForTimeout(400); };
  const fileData = () => JSON.parse(Object.values(drive.files).find(f => f.name === "MYTOOL-DATA.json").content);
  let A = await open("aemporio6@gmail.com");
  await A.p.waitForSelector("#mt_signin"); await A.p.click("#mt_signin");
  await A.p.waitForSelector("#mt_file", { state: "attached", timeout: 10000 }); await A.p.setInputFiles("#mt_file", SEED); await ready(A.p);
  await A.p.evaluate(() => setupPatch(["users"], [{ id: "u_t", name: "Team", uid: "team1@gmail.com", role: "owner", active: true }], "add user"));
  await A.p.evaluate(() => MYTOOL.shareWith("team1@gmail.com", "writer")); await A.p.waitForTimeout(2500);
  let B = await open("team1@gmail.com"); await B.p.waitForSelector("#mt_signin"); await B.p.click("#mt_signin"); await ready(B.p); await B.p.waitForTimeout(500);
  const po = await A.p.evaluate(() => D.purchases.find(p => p.status === "closed").no);
  // 1. same record, different fields, at the same time → both kept
  await A.p.evaluate(no => updateDoc("purchases", no, { notes: "note-from-A" }, "t"), po);
  await B.p.evaluate(no => updateDoc("purchases", no, { tracking: "TRK-B" }, "t"), po);
  await A.p.waitForTimeout(3000); await sync(A.p); await sync(B.p); await sync(A.p);
  let fd = fileData().data.purchases[Object.keys(fileData().data.purchases).find(k => fileData().data.purchases[k].no === po)];
  ok(fd.notes === "note-from-A" && fd.tracking === "TRK-B", "same order, different fields by two people → both changes kept (" + fd.notes + " / " + fd.tracking + ")");
  ok(await A.p.evaluate(no => { const p = D.purchases.find(x => x.no === no); return p.notes === "note-from-A" && p.tracking === "TRK-B" }, po), "A's screen shows both changes");
  // 2. same field by both → later value kept + listed as a clash
  await A.p.evaluate(no => updateDoc("purchases", no, { notes: "A2" }, "t"), po);
  await B.p.evaluate(no => updateDoc("purchases", no, { notes: "B2" }, "t"), po);
  await A.p.waitForTimeout(3000); await sync(A.p); await sync(B.p); await sync(A.p);
  const c = await A.p.evaluate(() => MYTOOL.conflicts());
  ok(c.length === 1 && c.some(x => x.kind === "field" && x.fields.join() === "notes"), "same field changed by both → clash listed (" + JSON.stringify(c.map(x => x.kind + ":" + (x.fields || []).join())) + ")");
  ok(await A.p.evaluate(() => healthRun(true).issues.some(i => i.rule === "sync")), "clash shows in Data health / Alerts");
  // 2b. the chooser: both versions shown, "Use theirs" takes the other value as a logged edit and closes the conflict
  ok(/conflict/.test(await A.p.evaluate(() => MYTOOL.st.t)), "status pill says a conflict is waiting: " + await A.p.evaluate(() => MYTOOL.st.t));
  await A.p.evaluate(() => { S.view = { k: "alerts", params: {} }; render(); });
  await A.p.waitForSelector('.cfbox [data-act="syncuse"]', { timeout: 5000 });
  const shown = await A.p.evaluate(() => [...document.querySelectorAll(".cft td")].map(t => t.textContent));
  ok(shown.includes("A2") && shown.includes("B2"), "chooser shows both values (" + shown.filter(x => /^[AB]2$/.test(x)).join("/") + ")");
  await A.p.click('.cfbox [data-act="syncuse"]'); await A.p.waitForTimeout(2800); await sync(B.p);
  ok(await A.p.evaluate(no => D.purchases.find(x => x.no === no).notes, po) === await A.p.evaluate(() => { const c = MYTOOL._debug().conflicts.find(x => x.kind === "field"); return c.theirs.notes; }), "'Use theirs' put the other person's value on the record");
  ok(await A.p.evaluate(() => D.log.some(l => /after a sync clash/.test(l.text || l.label || JSON.stringify(l)))), "the choice is in the activity log");
  ok((await B.p.evaluate(() => MYTOOL.conflicts().length)) === 0, "choosing on one device clears it for everyone");
  // 3. both create the same new number at the same moment → one is renumbered, its payment follows
  const nid = await A.p.evaluate(() => nextNo("purchases"));
  const mk = (P, who) => P.evaluate(([nid, who]) => { const base = D.purchases.find(p => p.status === "closed"); const doc = { ...JSON.parse(JSON.stringify(base)), id: nid, no: nid, notes: "made by " + who, oldRef: null, createdAt: nowIso(), createdBy: MYTOOL.me.email }; return claude.use("db").then(db => Promise.all([db.collection("purchases").doc(nid).set(doc), db.collection("payments").doc("PAYX-" + who).set({ id: "PAYX-" + who, no: "PAYX-" + who, party: base.party, cur: base.cur, amount: 1, status: "pending", date: today(), allocations: [{ ref: nid, amount: 1 }] })])) }, [nid, who]);
  await mk(A.p, "A"); await mk(B.p, "B");
  await A.p.waitForTimeout(3000); await sync(A.p); await sync(B.p); await sync(A.p); await A.p.waitForTimeout(500);
  const all = Object.values(fileData().data.purchases).filter(p => /made by/.test(p.notes || ""));
  ok(all.length === 2 && new Set(all.map(p => p.no)).size === 2, "same new number by two people → both kept, one renumbered (" + all.map(p => p.no + "=" + p.notes).join(", ") + ")");
  const pays = Object.values(fileData().data.payments).filter(x => /^PAYX-/.test(x.no));
  ok(pays.length === 2 && pays.every(x => all.some(p => p.no === x.allocations[0].ref && p.notes === "made by " + x.no.slice(5))), "each payment still points to its own order after renumbering");
  ok(await A.p.evaluate(() => MYTOOL.conflicts().some(x => x.kind === "renumber")) || await B.p.evaluate(() => MYTOOL.conflicts().some(x => x.kind === "renumber")), "renumbering is reported");
  // 4. B saves from an old copy (stale) and rolls back A's saved change → A puts it back
  const pk = await A.p.evaluate(() => D.parties[3].code);
  await A.p.evaluate(k => updateDoc("parties", k, { note: "A-saved" }, "t"), pk); await A.p.waitForTimeout(3000); await sync(A.p);
  ok(JSON.stringify(fileData().data.parties).includes("A-saved"), "A's change is in Drive");
  // B has not seen it; force B's next save to think nothing changed
  const curV = Object.values(drive.files).find(f => f.name === "MYTOOL-DATA.json").version;
  await B.p.evaluate(() => { window.__noPoll = true }); stale["team1@gmail.com"] = curV - 1;
  await B.p.evaluate(k => updateDoc("parties", D.parties[5].code, { note: "B-other" }, "t")); await B.p.waitForTimeout(3000);
  ok(!JSON.stringify(fileData().data.parties).includes("A-saved"), "(setup) B's stale save rolled A's change back");
  await sync(A.p); await A.p.waitForTimeout(3000); await sync(A.p);
  const s2 = JSON.stringify(fileData().data.parties);
  ok(s2.includes("A-saved") && s2.includes("B-other"), "A noticed the roll-back and put its change back; B's change kept");
  // 5. Setup: two people change different lists at the same time → both kept (merged inside the Setup document)
  await sync(B.p); await B.p.evaluate(() => { window.__noPoll = false });
  await A.p.evaluate(() => setupPatch(["lists", "ukPort", "label"], "UK ports (A)", "t"));
  await B.p.evaluate(() => setupPatch(["lists", "fbaCentre", "label"], "FBA (B)", "t"));
  await A.p.waitForTimeout(3000); await sync(A.p); await sync(B.p); await sync(A.p);
  const L = fileData().data.setup.main.lists;
  ok(L.ukPort.label === "UK ports (A)" && L.fbaCentre.label === "FBA (B)", "Setup lists changed by two people at once → both kept");
  // 6. one moves a record to Trash while the other edits it → the edit is not lost
  const pk2 = await A.p.evaluate(() => D.parties[7].code);
  await A.p.evaluate(k => trashDoc ? trashDoc("parties", k) : updateDoc("parties", k, { deletedAt: nowIso() }, "t"), pk2).catch(() => A.p.evaluate(k => updateDoc("parties", k, { deletedAt: nowIso() }, "t"), pk2));
  await B.p.evaluate(k => updateDoc("parties", k, { phone: "0300-B" }, "t"), pk2);
  await A.p.waitForTimeout(3000); await sync(A.p); await sync(B.p); await sync(A.p);
  const pd = Object.values(fileData().data.parties).find(x => x.code === pk2);
  ok(pd && pd.phone === "0300-B", "edit made while someone trashed the record is kept (" + (pd ? "deletedAt=" + (pd.deletedAt || "none") : "gone") + ")");
  // 6. offline: create while offline → kept on this device with a clear state → saved when back online
  await A.ctx.setOffline(true); await A.p.waitForTimeout(300);
  await A.p.evaluate(() => writeDoc("parties", "SUP-OFF1", { code: "SUP-OFF1", type: "supplier", name: "Made offline", cur: "RMB" }, "t"));
  await A.p.waitForTimeout(2500);
  const stOff = await A.p.evaluate(() => MYTOOL.st.t); ok(/waiting for internet/.test(stOff) && (await A.p.evaluate(() => MYTOOL.pending())) > 0, "offline: 'Saved on this device — waiting for internet' (" + stOff + ")");
  ok(!JSON.stringify(fileData().data.parties).includes("Made offline"), "nothing reached Drive while offline");
  await A.ctx.setOffline(false); await A.p.waitForTimeout(4000);
  ok(JSON.stringify(fileData().data.parties).includes("Made offline") && (await A.p.evaluate(() => MYTOOL.pending())) === 0, "back online → saved by itself, nothing pending");
  // 7. attachment upload fails → clear error, input kept, no silent null
  await A.ctx.route(/upload\/drive\/v3\/files\?uploadType=multipart/, r => r.fulfill({ status: 500, contentType: "application/json", body: '{"error":{"message":"boom"}}' }));
  const upErr = await A.p.evaluate(async () => { try{ await uploadFile(new File(["x"], "proof.pdf", { type: "application/pdf" })); return "no error"; }catch(e){ return e.message; } });
  ok(/Upload failed/.test(upErr) && /boom|answer/.test(upErr), "upload failure throws a clear reason: " + upErr);
  const badType = await A.p.evaluate(async () => { try{ await uploadFile(new File(["x"], "virus.exe", { type: "application/x-msdownload" })); return "no error"; }catch(e){ return e.message; } });
  ok(/cannot be attached/.test(badType), "unsupported file type refused before upload");
  // 5. nothing lost overall, no errors
  ok(A.errs.length === 0 && B.errs.length === 0, "no page errors " + JSON.stringify([...A.errs, ...B.errs]).slice(0, 300));
  await b.close(); console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(fails ? 1 : 0);
})();
