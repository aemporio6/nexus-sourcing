/* End-to-end: the real app (gshim in gateway mode) against the real gateway.gs rules running in Node (tests/gw/stub.js).
   Run: NODE_PATH=/opt/npm-tools/node_modules SEED_FILE=… node tests/gw/t_gw_client.js   (repo served on :8098) */
const { chromium } = require("playwright");
const fs = require("fs");
const { makeGateway } = require("./stub");
const SEED = process.env.SEED_FILE;
const seedData = JSON.parse(fs.readFileSync(SEED, "utf8")).data;
const main = seedData.setup.main || seedData.setup;
main.users.push({ id: "u_fin", name: "Fin", uid: "finance@x.com", role: "finance", active: true }, { id: "u_va", name: "VA", uid: "va@x.com", role: "va", active: true });
const tokens = {}; ["aemporio6@gmail.com", "finance@x.com", "va@x.com", "nobody@x.com"].forEach(e => tokens["tok-" + e] = { email: e });
const G = makeGateway({ format: "mytool-1", schema: 1, savedBy: "aemporio6@gmail.com", data: seedData, tomb: {}, revs: {} }, tokens);
G.drive.props.v = "7";
const fakeGis = `window.google={accounts:{oauth2:{initTokenClient(o){const c={callback:o.callback,requestAccessToken(){setTimeout(()=>c.callback({access_token:"tok-"+(window.__who||"aemporio6@gmail.com"),expires_in:3600}),10)}};return c},revoke(t,cb){cb&&cb()}}}};`;
let calls = [];
(async () => {
  const b = await chromium.launch(); let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if(!c) fails++; };
  const open = async who => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(w => { window.__who = w; try{ localStorage.setItem("mt_gw", "https://script.google.com/macros/s/TEST/exec"); }catch(_){} }, who);
    await ctx.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
    await ctx.route(/accounts\.google\.com|googleapis\.com|script\.google\.com/, async route => {
      const req = route.request(); const url = new URL(req.url());
      if(url.hostname === "accounts.google.com") return route.fulfill({ status: 200, contentType: "text/javascript", body: fakeGis });
      if(url.pathname === "/oauth2/v3/userinfo"){ const w = (req.headers()["authorization"] || "").replace("Bearer tok-", ""); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ email: w, name: w }) }); }
      if(url.hostname === "script.google.com"){ const body = JSON.parse(req.postData()); calls.push(body.op + ":" + (tokens[body.token] || {}).email); const out = G.call(body); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(out) }); }
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "direct Drive call in gateway mode: " + url.pathname } }) });
    });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto("http://localhost:8098/index.html"); return { ctx, p, errs };
  };
  const ready = p => p.waitForFunction(() => { try{ return S.ready }catch(e){ return false } }, null, { timeout: 20000 });
  const dataFile = () => JSON.parse(Object.values(G.drive.files).find(f => f.name === "MYTOOL-DATA.json").content);

  /* 1. admin opens through the gateway */
  let A = await open("aemporio6@gmail.com"); await A.p.waitForSelector("#mt_signin"); await A.p.click("#mt_signin"); await ready(A.p);
  ok(await A.p.evaluate(() => D.purchases.length) > 10, "admin loads data via gateway (no direct Drive call)");
  ok(calls.some(c => c === "meta:aemporio6@gmail.com") && calls.some(c => c === "read:aemporio6@gmail.com"), "meta + read went through the gateway");
  ok(await A.p.evaluate(() => MYTOOL.gateway.includes("script.google.com")), "MYTOOL.gateway set");
  await A.p.evaluate(() => updateDoc("parties", D.parties[0].code, { note: "gw-edit-A" }, "t")); await A.p.waitForTimeout(2500);
  ok(JSON.stringify(dataFile()).includes("gw-edit-A") && G.drive.props.v === "8", "admin edit saved through gateway, version 7 → 8");

  /* 2. VA: read is redacted; creating works; editing an existing record is refused at the gateway */
  let V = await open("va@x.com"); await V.p.waitForSelector("#mt_signin"); await V.p.click("#mt_signin"); await ready(V.p);
  ok(await V.p.evaluate(() => S.realRole) === "va", "VA signed in as va");
  ok(await V.p.evaluate(() => !D.payments.some(p => "bank" in p)), "VA never receives bank fields");
  await V.p.evaluate(async () => { await writeDoc("parties", "SUP-777", { code: "SUP-777", type: "supplier", name: "VA made", cur: "RMB" }, "t"); }); await V.p.waitForTimeout(2500);
  ok(dataFile().data.parties["SUP-777"] && dataFile().data.parties["SUP-777"].name === "VA made", "VA created a party → saved");
  ok("bank" in dataFile().data.payments[Object.keys(dataFile().data.payments)[0]], "bank fields still in the file after VA's save");
  await V.p.evaluate(() => { S.role = "owner"; return updateDoc("purchases", D.purchases[0].no, { note: "va-hack" }, "t"); });   /* pretend the UI check was bypassed */
  await V.p.waitForTimeout(6000);
  ok(!JSON.stringify(dataFile()).includes("va-hack"), "VA edit of an existing order refused by the gateway (file unchanged)");
  const st = await V.p.evaluate(() => MYTOOL.st.t); ok(/Not allowed/.test(st), "VA sees 'Not allowed' status: " + st);

  /* 3. compare-and-swap: admin and finance edit different records at the same time → both land */
  let F = await open("finance@x.com"); await F.p.waitForSelector("#mt_signin"); await F.p.click("#mt_signin"); await ready(F.p);
  const vBefore = +G.drive.props.v;
  await Promise.all([
    A.p.evaluate(() => updateDoc("parties", D.parties[1].code, { note: "cas-A" }, "t")),
    F.p.evaluate(() => updateDoc("parties", D.parties[2].code, { note: "cas-F" }, "t"))]);
  await A.p.waitForTimeout(6000);
  const df = JSON.stringify(dataFile());
  ok(df.includes("cas-A") && df.includes("cas-F"), "both edits in the file after crossing saves (version " + vBefore + " → " + G.drive.props.v + ")");

  /* 4. stranger */
  let N = await open("nobody@x.com"); await N.p.waitForSelector("#mt_signin"); await N.p.click("#mt_signin"); await N.p.waitForTimeout(2500);
  ok(await N.p.evaluate(() => /not allowed|Setup › Users/.test(document.body.textContent)), "stranger blocked by the gateway");
  ok(!A.errs.length && !V.errs.length && !F.errs.length, "no page errors " + JSON.stringify([A.errs, V.errs, F.errs]));
  console.log(fails ? fails + " FAILED" : "ALL PASS"); await b.close(); process.exit(fails ? 1 : 0);
})();
