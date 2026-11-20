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
 /* v2: not asked while at work — reload, other tab and back, a new tab soon after; asked after being away longer than 30 min */
 ok(await p.evaluate(()=>{const c=JSON.parse(localStorage.getItem("mt_lock"));return c.v===2&&c.bgMin===30&&c.idleMin===60}),"default: away 30 min · untouched 1 hour");
 await p.mouse.click(5,5);await p.reload();await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(800);ok(await p.evaluate(()=>!document.getElementById("alov")||document.getElementById("alov").hidden),"reload while working: not asked again");
 {const p2=await ctx.newPage();await p2.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p2.goto("http://localhost:8093/index.html?demo");await p2.waitForTimeout(1500);ok(await p2.evaluate(()=>!document.getElementById("alov")||document.getElementById("alov").hidden),"a new tab a moment later: not asked again");await p2.close()}
 await p.evaluate(()=>{localStorage.setItem("mt_lock_seen",String(Date.now()-10*60000));document.dispatchEvent(new Event("visibilitychange"))});await p.waitForTimeout(300);ok(await p.evaluate(()=>!document.getElementById("alov")||document.getElementById("alov").hidden),"back after 10 minutes in another tab / app: not asked");
 await p.evaluate(()=>{localStorage.setItem("mt_lock_seen",String(Date.now()-31*60000));document.dispatchEvent(new Event("visibilitychange"))});await p.waitForTimeout(300);ok(await p.evaluate(()=>!document.getElementById("alov").hidden),"back after 31 minutes away: asked");
 await p.fill("#al_pw","secret123");await p.press("#al_pw","Enter");await p.waitForTimeout(600);
 await p.addInitScript(()=>{try{if(sessionStorage.getItem("t_old")){sessionStorage.removeItem("t_old");localStorage.setItem("mt_lock_seen",String(Date.now()-31*60000))}}catch(_){}});await p.evaluate(()=>sessionStorage.setItem("t_old","1"));await p.reload();await p.waitForTimeout(1500);ok(await p.evaluate(()=>!document.getElementById("alov").hidden),"opening MY TOOL after 31 minutes away: asked");
 await p.fill("#al_pw","secret123");await p.press("#al_pw","Enter");await p.waitForTimeout(600);
 await p.evaluate(()=>{const c=JSON.parse(localStorage.getItem("mt_lock"));c.v=1;c.idleMin=5;c.bgMin=5;localStorage.setItem("mt_lock",JSON.stringify(c));return alCfg()});ok(await p.evaluate(()=>{const c=alCfg();return c.v===2&&c.bgMin===30&&c.idleMin===60}),"an older lock setting (5 min) is moved to the new timing by itself");
 /* PIN */
 await p.click("#alb");await p.click('[data-al="setup"]');await p.waitForTimeout(300);await p.fill("#als_pin","123456");await p.fill("#als_pin2","123456");await p.click('[data-als="save"]');ok(/harder to guess/.test(await p.textContent("#als_msg")),"easy PIN refused");
 await p.fill("#als_pin","482915");await p.fill("#als_pin2","482915");await p.click('[data-als="save"]');await p.waitForTimeout(1500);ok(await p.evaluate(()=>{const c=JSON.parse(localStorage.getItem("mt_lock"));return!!c.pin?.hash&&!JSON.stringify(c).includes("482915")}),"PIN set, stored only as a hash");
 await p.click("#alb");await p.click('[data-al="lock"]');await p.waitForTimeout(300);await p.fill("#al_pin","111111");await p.waitForTimeout(1200);ok(/Wrong PIN — 4 tries left/.test(await p.textContent("#al_msg")),"wrong PIN counted");
 await p.fill("#al_pin","482915");await p.waitForTimeout(1200);ok(await p.evaluate(()=>document.getElementById("alov").hidden),"6 digits unlock by themselves (no Enter)");
 /* step-up on a sensitive action */
 ok(await p.evaluate(async()=>{alVerAt=Date.now()-6*60000;const pr=alVerify("Approve a payment");await new Promise(r=>setTimeout(r,300));const shown=!document.getElementById("alov").hidden&&/Confirm it is you/.test(document.getElementById("alov").innerText);document.querySelector('[data-al="stepcancel"]').click();return shown&&(await pr)===false}),"sensitive action asks again after 5 min; Cancel stops it");
 ok(await p.evaluate(async()=>{alVerAt=Date.now();return(await alVerify("x"))===true}),"…and does not ask within 5 min of the last check");
 await p.evaluate(()=>{alVerAt=0;const b=document.createElement("button");b.dataset.act="trash";b.id="t_sens";b.onclick=()=>{window.__sens=(window.__sens||0)+1};document.body.appendChild(b);b.click()});await p.waitForTimeout(400);
 ok(await p.evaluate(()=>!window.__sens&&!document.getElementById("alov").hidden),"a Delete button is held until confirmed");await p.fill("#al_pin","482915");await p.waitForTimeout(1500);ok(await p.evaluate(()=>window.__sens===1),"after the PIN the same button goes through once");
 /* 5 wrong PINs → PIN off, password still works */
 await p.click("#alb");await p.click('[data-al="lock"]');await p.waitForTimeout(300);for(let i=0;i<5;i++){if(await p.$("#al_pin")){await p.fill("#al_pin","000000");await p.waitForTimeout(1100)}}
 ok(await p.evaluate(()=>!document.getElementById("al_pin")&&/PIN is off/.test(document.getElementById("alov").innerText)),"5 wrong PINs → PIN is off");await p.fill("#al_pw","secret123");await p.press("#al_pw","Enter");await p.waitForTimeout(800);ok(await p.evaluate(()=>document.getElementById("alov").hidden&&JSON.parse(localStorage.getItem("mt_lock")).pinFails===0),"password still unlocks and the PIN works again");
 /* background / idle */
 await p.evaluate(()=>{alLast=Date.now()-61*60000});await p.waitForTimeout(16000);ok(await p.evaluate(()=>!document.getElementById("alov").hidden),"locks itself after 1 hour open but untouched");
 /* forgot → lock removed, signed out (demo: reload) */
 await p.click('[data-al="forgot"]');await p.waitForTimeout(2000);ok(await p.evaluate(()=>!localStorage.getItem("mt_lock")),"Forgot removes the lock (sign in with Google again)");
 /* fingerprint / face with a virtual authenticator */
 {const c2=await b.newContext({viewport:{width:1280,height:900}});const q=await c2.newPage();await q.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());const cdp=await c2.newCDPSession(q);await cdp.send("WebAuthn.enable");await cdp.send("WebAuthn.addVirtualAuthenticator",{options:{protocol:"ctap2",transport:"internal",hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
  await q.goto("http://localhost:8093/index.html?demo");await q.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await q.waitForTimeout(600);await q.click("#alb");await q.click('[data-al="setup"]');await q.waitForTimeout(400);
  await q.check("#als_bio");await q.fill("#als_pw","secret123");await q.fill("#als_pw2","secret123");await q.click('[data-als="save"]');await q.waitForTimeout(1500);ok(await q.evaluate(()=>!!JSON.parse(localStorage.getItem("mt_lock")).bio),"fingerprint / face set up");
  await q.click("#alb");await q.click('[data-al="lock"]');await q.waitForTimeout(1500);ok(await q.evaluate(()=>document.getElementById("alov").hidden),"fingerprint / face unlocks");await c2.close()}
 /* real (non-demo) app: the device lock MUST be set up before anything opens */
 {const{drive,mkRoute}=require("./fakedrive");const fs=require("fs");const who="aemporio6@gmail.com";const mk=(name,parent,extra)=>{const id="F"+(++drive.n);drive.files[id]={id,name,owner:who,parent,version:1,...extra};return id};const df=mk("MY TOOL – DATA","root",{folder:true});mk("MYTOOL-DATA.json",df,{content:fs.readFileSync(process.env.SEED_FILE,"utf8")});
  const c3=await b.newContext({viewport:{width:1280,height:900}});await c3.addInitScript(w=>{window.__who=w;try{localStorage.setItem("mt_gw","off");localStorage.setItem("mt_lock_force","1")}catch(_){}},who);await c3.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await c3.route(/accounts\.google\.com|googleapis\.com/,mkRoute(c3));
  const q=await c3.newPage();await q.goto("http://localhost:8098/index.html");await q.waitForTimeout(1500);
  ok(await q.evaluate(()=>!!document.querySelector("#alov #alset")&&/Protect MY TOOL/.test(document.body.innerText)&&!document.querySelector('[data-als="close"]')),"real app: device-lock setup comes first and cannot be closed");
  await q.fill("#als_pw","secret123");await q.fill("#als_pw2","secret123");await q.click('[data-als="save"]');await q.waitForTimeout(800);
  ok(await q.evaluate(()=>!!document.getElementById("mt_signin")&&!!document.getElementById("mt_signin_own")),"then it asks which data: company or own Drive");
  await q.evaluate(()=>localStorage.setItem("mt_lock_seen",String(Date.now()-31*60000)));const q2=await c3.newPage();await q2.goto("http://localhost:8098/index.html");await q2.waitForTimeout(1500);ok(await q2.evaluate(()=>!document.getElementById("alov").hidden&&/locked/.test(document.body.innerText)),"next open: locked until the device lock / PIN / password");await c3.close()}
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
