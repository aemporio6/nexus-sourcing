/* The REAL app against the real gateway code (21 Nov 2026): a stranger sees only "Send request"; the team signs in with name +
   email only (no Drive permission, no direct Drive call); the Owner approves on Home and the stranger's page opens by itself;
   a person limited to one company sees only that company. Repo on :8098 */
const { chromium } = require("playwright"); const fs = require("fs"); const { makeGateway } = require("./stub");
const seedData = JSON.parse(fs.readFileSync(process.env.SEED_FILE, "utf8")).data; const main = seedData.setup.main || seedData.setup;
main.roles.partner = { bank: true, create: true, edit: true, deleteAny: true, restore: true, approve: true, export: true, setup: false }; main.roles.viewer = { bank: false, create: false, edit: false, deleteAny: false, restore: false, approve: false, export: false, setup: false }; main.roles2 = true;
main.lists.role.items.push({ id: "partner", label: "Partner" }, { id: "viewer", label: "View only" });
const byCo = {}; Object.values(seedData.purchases).forEach(p => { if(p.account) byCo[p.account] = (byCo[p.account] || 0) + 1; }); const coA = Object.keys(byCo).sort((a, b) => byCo[b] - byCo[a])[0];
main.users.push({ name: "Omer", uid: "partner@x.com", role: "partner", active: true }, { name: "OneCo", uid: "oneco@x.com", role: "partner", active: true, companies: [coA] });
const tokens = {}; ["aemporio6@gmail.com", "partner@x.com", "oneco@x.com", "stranger@x.com"].forEach(e => tokens["tok-" + e] = { email: e });
const GID = "GWgwGWgwGWgwGWgwGW_1234567", U = "https://script.google.com/macros/s/" + GID + "/exec";
const G = makeGateway({ format: "mytool-1", schema: 1, savedBy: "aemporio6@gmail.com", data: seedData, tomb: {}, revs: {} }, tokens, null, "vartleaves.data@gmail.com");
const fakeGis = `window.__scopes=window.__scopes||[];window.google={accounts:{oauth2:{initTokenClient(o){const c={callback:o.callback,requestAccessToken(x){window.__scopes.push((x&&x.scope)||o.scope);try{sessionStorage.setItem("t_scopes",JSON.stringify(window.__scopes))}catch(_){}setTimeout(()=>c.callback({access_token:"tok-"+(window.__who||"aemporio6@gmail.com"),expires_in:3600,scope:(x&&x.scope)||o.scope}),10)}};return c},revoke(t,cb){cb&&cb()}}}};`;
(async () => {
  const b = await chromium.launch(); let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if(!c) fails++; };
  const open = async (who) => { const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const st = { ops: [], drive: [] };
    await ctx.addInitScript(([w, g]) => { window.__who = w; try{ window.__scopes = JSON.parse(sessionStorage.getItem("t_scopes") || "[]"); if(!sessionStorage.getItem("t_init")){ sessionStorage.setItem("t_init", "1"); localStorage.setItem("mt_gw", g); } }catch(_){} }, [who, U]);
    await ctx.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
    await ctx.route(/accounts\.google\.com|googleapis\.com|script\.google\.com/, async route => { const req = route.request(); const url = new URL(req.url());
      if(url.hostname === "accounts.google.com") return route.fulfill({ status: 200, contentType: "text/javascript", body: fakeGis });
      if(url.pathname === "/oauth2/v3/userinfo"){ const w = (req.headers()["authorization"] || "").replace("Bearer tok-", ""); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ email: w, name: w.split("@")[0] }) }); }
      if(url.hostname === "script.google.com"){ const body = JSON.parse(req.postData()); st.ops.push(body.op); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(G.call(body)) }); }
      if(/^fonts\./.test(url.hostname)) return route.abort();
      st.drive.push(url.pathname); return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "direct Drive call: " + url.pathname } }) }); });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept()); await p.goto("http://localhost:8098/index.html"); return { ctx, p, errs, st }; };
  const ready = p => p.waitForFunction(() => { try{ return S.ready }catch(e){ return false } }, null, { timeout: 30000 });
  const gateText = p => p.evaluate(() => (document.getElementById("mt_gate") || document.body).innerText);
  const allErrs = [];
  /* 1. a stranger */
  const X = await open("stranger@x.com"); await X.p.waitForSelector("#mt_signin");
  ok(await X.p.evaluate(() => !document.getElementById("mt_signin_own") && /Sign in with Google/.test(document.getElementById("mt_signin").innerText)), "sign-in screen for a new device: one button, no “my own Drive”");
  await X.p.click("#mt_signin"); await X.p.waitForSelector("#mt_asksend", { timeout: 20000 });
  ok(await X.p.evaluate(() => window.__scopes.length >= 1 && window.__scopes.every(s => !/drive/.test(s))), "Google is asked for name + email only (no Drive permission)");
  ok(/do not have access to MY TOOL yet/.test(await gateText(X.p)) && await X.p.evaluate(() => { try{ return !S.ready }catch(e){ return true } }) && await X.p.evaluate(() => !/own Drive/i.test(document.body.innerText)), "the stranger sees only the request screen — nothing of MY TOOL, no “own Drive” way in");
  ok(await X.p.evaluate(() => { try{ return !D.purchases || !D.purchases.length }catch(e){ return true } }), "not one record reached the stranger's device");
  await X.p.fill("#mt_asknote", "Ali — new VA for eBay orders"); await X.p.click("#mt_asksend"); await X.p.waitForFunction(() => /Your request was sent/.test(document.body.innerText), null, { timeout: 15000 });
  ok(G.call({ op: "accessList", token: "tok-aemporio6@gmail.com" }).list.some(x => x.email === "stranger@x.com" && x.state === "pending" && /Ali/.test(x.note)), "Send request → the request is waiting at the gateway; the stranger is told to wait");
  ok(X.st.drive.length === 0, "the stranger's device made no direct Google Drive call" + (X.st.drive.length ? ": " + [...new Set(X.st.drive)].join(", ") : ""));
  /* 2. the Owner on a new device */
  const A = await open("aemporio6@gmail.com"); await A.p.waitForSelector("#mt_signin"); await A.p.click("#mt_signin"); await A.p.waitForSelector("#mt_full", { timeout: 20000 });
  ok(/Owner/.test(await gateText(A.p)), "an Owner on a new device is recognised and asked once for the Drive permission");
  await A.p.click("#mt_full"); await ready(A.p); await A.p.waitForTimeout(3500);
  ok(await A.p.evaluate(() => localStorage.getItem("mt_owner") === "1" && window.__scopes.some(s => /drive/.test(s)) && S.isOwner), "after that the device is remembered as an Owner device (Drive allowed, “my own Drive” offered next time)");
  await A.p.evaluate(async () => { await arLoad(true); go("home"); render(); }); await A.p.waitForTimeout(800);
  ok(await A.p.evaluate(() => { const c = document.getElementById("arcard"); return !!c && /Access requests \(1\)/.test(c.innerText) && /stranger@x\.com/.test(c.innerText) && /Ali — new VA/.test(c.innerText) && /^\(1\) /.test(document.title); }), "Owner's Home: “Access requests (1)” with who and what they wrote; the tab title shows (1)"); if(process.env.DBG) console.log(await A.p.evaluate(() => [document.title, (document.getElementById("arcard") || {}).innerText]));
  await A.p.click('[data-ar="open"]'); await A.p.waitForTimeout(500);
  ok(await A.p.evaluate(() => { const r = document.querySelector("[data-ar-role]"); return !!r && r.value === "viewer" && !!document.querySelector(".arform .pkm") && /All companies/.test(document.querySelector(".arform .pkm").innerText); }), "Approve…: role is View only by default, companies All, until date");
  await A.p.fill("[data-ar-name]", "Ali VA"); await A.p.click('[data-ar="give"]'); await A.p.waitForTimeout(1500);
  await A.p.waitForFunction(() => (SET().users || []).some(u => u.uid === "stranger@x.com" && u.role === "viewer" && u.active), null, { timeout: 15000 });
  await A.p.waitForFunction(() => { try{ return MYTOOL.pending ? !MYTOOL.pending() : true }catch(e){ return true } }, null, { timeout: 5000 }).catch(() => {});
  let saved = false; for(let i = 0; i < 40 && !saved; i++){ await A.p.waitForTimeout(500); saved = G.call({ op: "accessState", token: "tok-stranger@x.com" }).state === "member"; }
  ok(saved, "Give access → the person is in Setup › Users at the gateway (View only)");
  ok(await A.p.evaluate(() => !document.getElementById("arcard") || !/stranger@x\.com/.test(document.getElementById("arcard").innerText)), "the request left the Owner's card");
  /* 3. the stranger's page opens by itself */
  await ready(X.p).catch(() => {}); let opened = false; try{ await X.p.waitForFunction(() => { try{ return S.ready }catch(e){ return false } }, null, { timeout: 45000 }); opened = true; }catch(_){}
  ok(opened, "the stranger's waiting page opened MY TOOL by itself after the approval");
  if(opened){ await X.p.waitForTimeout(3000);
    ok(await X.p.evaluate(() => !S.isOwner && S.role === "viewer" && !can("edit") && !can("create") && !can("export") && !can("setup") && D.purchases.length > 10), "…as View only: can look, cannot create / edit / download / settings");
    ok(X.st.drive.length === 0 && await X.p.evaluate(() => (JSON.parse(sessionStorage.getItem("t_scopes") || "[]")).every(s => !/drive/.test(s))), "a team member never needed the Drive permission and made no direct Drive call"); }
  allErrs.push(...X.errs, ...A.errs); await X.ctx.close();
  /* 4. a person limited to one company */
  const O = await open("oneco@x.com"); await O.p.waitForSelector("#mt_signin"); await O.p.click("#mt_signin"); await ready(O.p); await O.p.waitForTimeout(3000);
  const nA = Object.values(seedData.purchases).filter(p => !p.account || p.account === coA).length, nAll = Object.keys(seedData.purchases).length;
  ok(await O.p.evaluate(([co, n]) => D.purchases.length === n && D.purchases.every(p => !p.account || p.account === co) && a3Partial(), [coA, nA]) && nA < nAll, `a person limited to one company sees only its orders in the app (${nA} of ${nAll}) and does no automatic re-calculation`);
  ok(O.st.drive.length === 0, "…without any direct Drive call" + (O.st.drive.length ? ": " + [...new Set(O.st.drive)].join(", ") : ""));
  allErrs.push(...O.errs); await O.ctx.close(); await A.ctx.close();
  ok(allErrs.length === 0, "no page errors" + (allErrs.length ? ": " + allErrs.slice(0, 3).join(" | ") : ""));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : "\nALL PASS"); process.exit(fails ? 1 : 0);
})();
