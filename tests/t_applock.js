/* App lock (17 Nov 2026): set up with a password, lock now, wrong / right password, idle lock, forgot → off. Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:900}});const p=await ctx.newPage();const errs=[];p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(600);
 ok(await p.evaluate(()=>!!document.getElementById("alb")),"🔒 in the top bar");
 await p.click("#alb");await p.click('[data-al="setup"]');await p.waitForTimeout(300);
 await p.fill("#als_pw","abc");await p.fill("#als_pw2","abc");await p.click('[data-als="save"]');ok(/6 or more/.test(await p.textContent("#als_msg")),"short password refused");
 await p.fill("#als_pw","secret123");await p.fill("#als_pw2","secret124");await p.click('[data-als="save"]');ok(/not the same/.test(await p.textContent("#als_msg")),"mismatch refused");
 await p.fill("#als_pw2","secret123");await p.click('[data-als="save"]');await p.waitForTimeout(800);
 const cfg=await p.evaluate(()=>JSON.parse(localStorage.getItem("mt_lock")));ok(cfg.on&&cfg.pw.hash&&!JSON.stringify(cfg).includes("secret123"),"lock on, password stored only as a hash");
 await p.click("#alb");await p.click('[data-al="lock"]');await p.waitForTimeout(300);ok(await p.evaluate(()=>!document.getElementById("alov").hidden&&document.documentElement.classList.contains("al-on")),"Lock now covers the app");
 ok(await p.evaluate(()=>getComputedStyle(document.querySelector("#view")).visibility==="hidden"),"data hidden behind the lock");
 await p.fill("#al_pw","wrong");await p.press("#al_pw","Enter");await p.waitForTimeout(500);ok(/Wrong password/.test(await p.textContent("#al_msg")),"wrong password refused");
 await p.fill("#al_pw","secret123");await p.press("#al_pw","Enter");await p.waitForTimeout(600);ok(await p.evaluate(()=>document.getElementById("alov").hidden),"right password unlocks");
 /* reload: locked at start */
 await p.reload();await p.waitForTimeout(1500);ok(await p.evaluate(()=>!!document.getElementById("alov")&&!document.getElementById("alov").hidden),"opening the app starts locked");
 await p.fill("#al_pw","secret123");await p.press("#al_pw","Enter");await p.waitForTimeout(600);
 /* idle */
 await p.evaluate(()=>{alLast=Date.now()-11*60000});await p.waitForTimeout(16000);ok(await p.evaluate(()=>!document.getElementById("alov").hidden),"locks itself after 10 min without use");
 /* forgot → lock removed, signed out (demo: reload) */
 await p.click('[data-al="forgot"]');await p.waitForTimeout(2000);ok(await p.evaluate(()=>!localStorage.getItem("mt_lock")),"Forgot removes the lock (sign in with Google again)");
 /* fingerprint / face with a virtual authenticator */
 {const c2=await b.newContext({viewport:{width:1280,height:900}});const q=await c2.newPage();await q.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());const cdp=await c2.newCDPSession(q);await cdp.send("WebAuthn.enable");await cdp.send("WebAuthn.addVirtualAuthenticator",{options:{protocol:"ctap2",transport:"internal",hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
  await q.goto("http://localhost:8093/index.html?demo");await q.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await q.waitForTimeout(600);await q.click("#alb");await q.click('[data-al="setup"]');await q.waitForTimeout(400);
  await q.check("#als_bio");await q.fill("#als_pw","secret123");await q.fill("#als_pw2","secret123");await q.click('[data-als="save"]');await q.waitForTimeout(1500);ok(await q.evaluate(()=>!!JSON.parse(localStorage.getItem("mt_lock")).bio),"fingerprint / face set up");
  await q.click("#alb");await q.click('[data-al="lock"]');await q.waitForTimeout(1500);ok(await q.evaluate(()=>document.getElementById("alov").hidden),"fingerprint / face unlocks");await c2.close()}
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
