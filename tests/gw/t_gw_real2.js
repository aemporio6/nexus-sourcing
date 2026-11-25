/* The REAL app (not the demo) against the real gateway code, for the 20 Nov features: follow the "moved" pointer, a Partner,
   version history through the gateway, fine access (hidden / view-only), supplier inbox, members never get an own Drive. Repo on :8098 */
const { chromium } = require("playwright"); const fs = require("fs"); const { makeGateway } = require("./stub");
const seedData = JSON.parse(fs.readFileSync(process.env.SEED_FILE, "utf8")).data; const main = seedData.setup.main || seedData.setup;
main.roles.partner = { bank: true, create: true, edit: true, deleteAny: true, restore: true, approve: true, export: true, setup: false }; main.roles2 = true;
main.lists.role.items.push({ id: "partner", label: "Partner" });
main.users.push({ name: "Omer", uid: "partner@x.com", role: "partner", active: true }, { name: "Lim", uid: "limited@x.com", role: "partner", active: true, perms: { export: false }, areas: { payments: "hide", shipments: "view" }, fields: { "purchases.lines.u": "hide", "purchases.notes": "view" } });
const tokens = {}; ["aemporio6@gmail.com", "partner@x.com", "limited@x.com", "nobody@x.com"].forEach(e => tokens["tok-" + e] = { email: e });
const OLDID = "OLDoldOLDoldOLDold_1234567", NEWID = "NEWnewNEWnewNEWnew_1234567", U = id => "https://script.google.com/macros/s/" + id + "/exec";
const oldSeed = JSON.parse(JSON.stringify({ format: "mytool-1", schema: 1, savedBy: "aemporio6@gmail.com", data: seedData, tomb: {}, revs: {} })); (oldSeed.data.setup.main || oldSeed.data.setup).movedTo = { gateway: U(NEWID), account: "vartleaves.data@gmail.com", at: "2026-11-20T00:00:00Z" };
const OLD = makeGateway(oldSeed, tokens), NEW = makeGateway({ format: "mytool-1", schema: 1, savedBy: "aemporio6@gmail.com", data: seedData, tomb: {}, revs: {} }, tokens, null, "vartleaves.data@gmail.com");
const fakeGis = `window.google={accounts:{oauth2:{initTokenClient(o){const c={callback:o.callback,requestAccessToken(){setTimeout(()=>c.callback({access_token:"tok-"+(window.__who||"aemporio6@gmail.com"),expires_in:3600}),10)}};return c},revoke(t,cb){cb&&cb()}}}};`;
const calls = [];
(async () => {
  const b = await chromium.launch(); let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if(!c) fails++; };
  const open = async (who, gwId, ls) => { const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(([w, g, extra]) => { window.__who = w; try{ if(/^(aemporio6|vartleaves\.data)@gmail\.com$/.test(w))localStorage.setItem("mt_owner","1"); if(!sessionStorage.getItem("t_init")){ sessionStorage.setItem("t_init", "1"); if(g) localStorage.setItem("mt_gw", g); Object.entries(extra || {}).forEach(([k, v]) => localStorage.setItem(k, v)); } }catch(_){} }, [who, gwId ? U(gwId) : "", ls || {}]);
    await ctx.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
    await ctx.route(/accounts\.google\.com|googleapis\.com|script\.google\.com/, async route => { const req = route.request(); const url = new URL(req.url());
      if(url.hostname === "accounts.google.com") return route.fulfill({ status: 200, contentType: "text/javascript", body: fakeGis });
      if(url.pathname === "/oauth2/v3/userinfo"){ const w = (req.headers()["authorization"] || "").replace("Bearer tok-", ""); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ email: w, name: w }) }); }
      if(url.hostname === "script.google.com"){ const body = JSON.parse(req.postData()); const G = url.pathname.includes(OLDID) ? OLD : NEW; calls.push((G === OLD ? "old:" : "new:") + body.op); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(G.call(body)) }); }
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "direct Drive call: " + url.pathname } }) }); });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept()); await p.goto("http://localhost:8098/index.html"); return { ctx, p, errs }; };
  const ready = p => p.waitForFunction(() => { try{ return S.ready }catch(e){ return false } }, null, { timeout: 30000 });
  const newFile = () => JSON.parse(Object.values(NEW.drive.files).find(f => f.name === "MYTOOL-DATA.json").content);
  const allErrs = [];
  /* 1. a device that still points at the OLD gateway follows the pointer by itself */
  let A = await open("partner@x.com", OLDID); await A.p.waitForSelector("#mt_signin"); await A.p.click("#mt_signin"); await ready(A.p);
  ok(await A.p.evaluate(u => localStorage.getItem("mt_gw") === u && MYTOOL.gateway === u, U(NEWID)), "a device on the old gateway switches to the company account by itself");
  ok(calls.includes("old:read") && calls.includes("new:read"), "it read the pointer from the old copy, then the data from the new one");
  /* 2. Partner */
  ok(await A.p.evaluate(() => S.realRole === "partner" && !S.isOwner && can("edit") && can("bank") && can("approve") && can("restore") && !can("setup")), "Partner: edit / bank / approve / bring back — not Settings");
  await A.p.evaluate(() => go("setup")); await A.p.waitForTimeout(500); ok(await A.p.evaluate(() => /Owner only/.test(document.querySelector("#view").innerText) && !document.querySelector(".r2card")), "Partner cannot open Setup (Users / Access)");
  const po = await A.p.evaluate(() => { const x = live(D.purchases).find(p => (p.lines || []).length && p.status !== "closed"); return { no: x.no, notes: x.notes || "", u: x.lines[0].u }; });
  await A.p.evaluate(no => updateDoc("purchases", no, { notes: "partner fixed a mistake" }, "t"), po.no); await A.p.waitForTimeout(3500);
  let nf = newFile(); ok(nf.data.purchases[po.no].notes === "partner fixed a mistake" && nf.savedBy === "partner@x.com", "Partner's correction is saved through the gateway");
  const vs = Object.values(nf.data.versions || {}); ok(vs.length === 1 && vs[0].ref === po.no && (vs[0].before.notes || "") === po.notes && vs[0].by === "partner@x.com", "the version from before it is in the shared history (who + what)");
  /* 3. the Owner sees that history on another device and restores */
  let O = await open("aemporio6@gmail.com", NEWID); await O.p.waitForSelector("#mt_signin"); await O.p.click("#mt_signin"); await ready(O.p); await O.p.waitForTimeout(3500);
  await O.p.evaluate(no => openDoc("purchases", no), po.no); await O.p.waitForTimeout(800); await O.p.evaluate(() => { document.querySelector(".drawer .hvbox").open = true; }); await O.p.waitForTimeout(500); await O.p.evaluate(() => { const d = document.querySelector(".drawer .hvbox"); if(!d.open) d.open = true; }); await O.p.waitForTimeout(300);
  ok(await O.p.evaluate(() => /History — 1 earlier version/.test(document.querySelector(".drawer .hvbox")?.innerText || "") && /Omer/.test(document.querySelector(".drawer .hvbox").innerText)), "Owner (other device) sees the change in 🕘 History, with the Partner's name");
  await O.p.evaluate(() => { document.querySelector(".drawer .hvbox").open = true; document.querySelector(".drawer [data-hv]").click(); }); await O.p.waitForTimeout(4000);
  nf = newFile(); ok((nf.data.purchases[po.no].notes || "") === po.notes && Object.keys(nf.data.versions).length === 2, "Restore brings the old text back in the shared data; both versions are kept");
  ok(await O.p.evaluate(() => !!document.querySelector) && await O.p.evaluate(() => { go("setup"); return true; }), "(owner opens Setup)"); await O.p.waitForTimeout(400); await O.p.evaluate(() => document.querySelector('[data-setup="users"]')?.click()); await O.p.waitForTimeout(600);
  ok(await O.p.evaluate(() => document.querySelectorAll(".pprow").length >= 2 && !!document.querySelector("[data-mv]") && (() => { const i = SET().users.findIndex(u => u.areas && u.areas.payments === "hide"); if(i < 0) return false; ppOpen(i); const ok = /Does not see: Money/.test(document.querySelector("#ppwin .ppsays").innerText); ppClose(); return ok; })()), "Owner sees the list of people (the limited person's window says what they cannot see) and the Move card");
  /* 4. the limited person */
  let L = await open("limited@x.com", NEWID); await L.p.waitForSelector("#mt_signin"); await L.p.click("#mt_signin"); await ready(L.p); await L.p.waitForTimeout(1500);
  ok(await L.p.evaluate(no => { const x = docOf("purchases", no); return live(D.payments).length === 0 && x && x.lines.every(l => !("u" in l)); }, po.no), "limited person's device never receives payments or unit prices");
  await L.p.evaluate(no => openForm("purchase", { edit: docOf("purchases", no), force: true }), po.no); await L.p.waitForTimeout(900);
  ok(await L.p.evaluate(() => document.querySelectorAll('.drawer input[disabled][value="•••"]').length > 0 && document.querySelector("#f_notes").disabled), "their order form: unit price •••, notes greyed");
  await L.p.evaluate(() => { S.drawer.dirty = false; S.drawer = null; }); const fk = "x_checkedBy"; await L.p.evaluate(([no, k]) => updateDoc("purchases", no, { [k]: "lim-ref-1", notes: "tried to change the view-only notes", lines: docOf("purchases", no).lines.map(l => ({ ...l, u: 0.01 })) }, "t"), [po.no, fk]); await L.p.waitForTimeout(4000);
  nf = newFile(); ok(nf.data.purchases[po.no][fk] === "lim-ref-1", "they can still save what they may (field: " + fk + ")");
  ok(nf.data.purchases[po.no].lines[0].u === po.u && Object.keys(nf.data.payments).length === Object.keys(seedData.payments).length && (nf.data.purchases[po.no].notes || "") === po.notes, "…and the hidden prices, the payments and the view-only notes are untouched in the data");
  ok(await L.p.evaluate(() => !can("export")), "their Download / Export is off");
  await L.p.evaluate(() => go("payments")); await L.p.waitForTimeout(500); ok(await L.p.evaluate(() => /not available for you/.test(document.querySelector("#view").innerText)), "the Money page is not available to them");
  /* 5. supplier inbox on Home */
  const tok = "s".repeat(10) + "T0kenT0kenT0kenT0ken12"; { const c = NEW.call({ op: "read", token: "tok-aemporio6@gmail.com" }); const bb = JSON.parse(JSON.stringify(c.file)); const k = Object.keys(bb.data.parties)[0]; bb.data.parties[k].upload = { h: NEW.run("upHash", tok), on: true, exp: "2099-01-01", max: 5 }; NEW.call({ op: "write", token: "tok-aemporio6@gmail.com", base: c.version, body: bb }); }
  ok(NEW.call({ op: "supplierUpload", tok, name: "CI-1.pdf", mime: "application/pdf", b64: Buffer.from("%PDF x").toString("base64"), kind: "Invoice (PI / CI)", note: "n1" }).ok, "(a supplier sends a file)");
  await A.p.evaluate(() => { go("home"); return slLoad(true); }); await A.p.waitForTimeout(800); await A.p.evaluate(() => render()); await A.p.waitForTimeout(500);
  ok(await A.p.evaluate(() => /From suppliers — to check \(1\)/.test(document.querySelector("#sbcard")?.innerText || "") && S.slIn.list.some(f => f.name === "CI-1.pdf")), "the Partner sees it on Home (real app, through the gateway)");
  /* 6. (21 Nov 2026) a member is never offered "My own Drive": one button, company data */
  let M = await open("partner@x.com", NEWID); await M.p.waitForSelector("#mt_signin"); const noOwn = await M.p.evaluate(() => !document.getElementById("mt_signin_own")); await M.p.click("#mt_signin"); await ready(M.p);
  ok(noOwn && await M.p.evaluate(() => MYTOOL.workspace === "" && live(D.purchases).length > 10), "a member is not offered “My own Drive” and gets the company data (no separate empty copy)");
  [A, O, L, M].forEach(x => allErrs.push(...x.errs)); ok(!allErrs.length, "no page errors " + allErrs.join(" | "));
  await b.close(); console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(fails ? 1 : 0);
})();
