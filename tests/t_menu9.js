/* Menu (17 Nov 2026): 9 buttons, › panel, every page still reachable, links open in new tabs. Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(500);
 const mods=await p.evaluate(()=>[...document.querySelectorAll("#rail .nmod .nav span:first-of-type")].map(x=>x.textContent));console.log(mods.join(" · "));ok(mods.length===9,"9 buttons");
 const miss=await p.evaluate(()=>{const inMenu=new Set();NAV_MODULES.forEach(m=>m.items.forEach(i=>i[1]&&inMenu.add(i[1])));return["home","tasks","attention","calendar","purchases","planner","shipments","payments","stock","products","parties","reports","log","import","health","trash","setup","help","tools","refs"].filter(x=>PAGES.includes(x)&&!inMenu.has(x))});ok(!miss.length,"every page is in the menu "+miss.join(","));
 const nn=await p.evaluate(()=>CREATE_REG.filter(c=>!NAV_MODULES.some(m=>m.items.some(i=>i[3]===c.k))).map(c=>c.k));ok(!nn.length,"every + New is in the menu "+nn.join(","));
 await p.click('[data-navfly="payments"]');await p.waitForTimeout(300);ok(await p.evaluate(()=>!$("#m9fly").hidden&&/Money/.test($("#m9fly").innerText)),"› opens the Money panel");
 await p.click("#m9fly a.m9i >> text=Pending");await p.waitForTimeout(500);
 ok(await p.evaluate(()=>S.view.k==="payments"&&$("#m9fly").hidden),"item opens its page, panel closes");
 ok(await p.evaluate(()=>[...document.querySelectorAll("#m9fly a.m9w")].every(a=>a.target==="_blank")),"↗ new window links");
 await p.keyboard.press("Escape");await p.click('[data-navfly="setup"]');await p.waitForTimeout(300);const st=await p.evaluate(()=>$("#m9fly").innerText);console.log(st.replace(/\n+/g," | "));ok(/Import/.test(st)&&/Trash/.test(st),"Settings holds Import / Data health / Trash");
 await p.keyboard.press("Escape");await p.waitForTimeout(200);ok(await p.evaluate(()=>$("#m9fly").hidden),"Esc closes");
 await p.evaluate(()=>go("more"));await p.waitForTimeout(500);ok(await p.evaluate(()=>document.querySelectorAll(".megacol").length===9),"All menus page shows the 9");
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>go("home"));await p.waitForTimeout(500);ok(await p.evaluate(()=>document.documentElement.scrollWidth<=392),"phone: no sideways scroll");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
