/* + Create hub (search, departments, key N, Back to Create), search-everything "Create" / "Go to" hits, Fill from last, Quick / Full.
   Demo build on :8093.   node tests/t_create.js */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(600);
 await p.click('[data-act="newmenu"]');await p.waitForTimeout(200);
 const h=await p.evaluate(()=>({open:!!document.querySelector("#chub"),items:document.querySelectorAll("#chub .ch-item").length,depts:[...document.querySelectorAll("#chub .ch-dept h4")].map(x=>x.firstChild.textContent.trim())}));
 ok(h.open&&h.items>=14&&h.depts.includes("Money")&&h.depts.includes("Data"),"+ Create opens the hub: "+h.items+" entries in "+h.depts.join(", "));
 await p.fill("#ch_q","pay");await p.waitForTimeout(100);const f=await p.evaluate(()=>[...document.querySelectorAll("#chub .ch-item b")].map(x=>x.textContent));ok(f.some(t=>/payment/i.test(t))&&f.length<6,"typing 'pay' narrows it: "+f.join(" | "));
 await p.press("#ch_q","Enter");await p.waitForTimeout(900);
 ok(await p.evaluate(()=>S.drawer?.form==="payment"&&!document.querySelector("#chub")&&!!document.querySelector('.drawer [data-act="chback"]')),"Enter opens the first match (payment form) with ‹ Create back button");
 await p.click('.drawer [data-act="chback"]');await p.waitForTimeout(300);ok(await p.evaluate(()=>!!document.querySelector("#chub")&&$("#ch_q").value==="pay"&&!S.drawer),"‹ Create returns to the hub and keeps 'pay'");
 await p.keyboard.press("Escape");await p.waitForTimeout(100);ok(await p.evaluate(()=>!document.querySelector("#chub")),"Esc closes the hub");
 await p.keyboard.press("n");await p.waitForTimeout(200);ok(await p.evaluate(()=>!!document.querySelector("#chub")),"key N opens the hub");await p.keyboard.press("Escape");
 /* search everything */
 await p.fill("#q","shipment");await p.waitForTimeout(400);const s=await p.evaluate(()=>({cr:[...document.querySelectorAll('#sugg [data-act="snew"]')].length,go:[...document.querySelectorAll('#sugg [data-act="sgo"]')].map(b=>b.textContent),rec:document.querySelectorAll('#sugg [data-open]').length}));
 ok(s.cr>0&&s.go.length>0,"search 'shipment' shows Create + Go to (+"+s.rec+" records): "+s.go.slice(0,3).join(" | "));
 await p.click('#sugg [data-act="sgo"]');await p.waitForTimeout(300);ok(await p.evaluate(()=>S.view.k==="shipments"),"Go to hit opens the Shipments page");
 /* Fill from last */
 await p.evaluate(()=>openForm("party",{}));await p.waitForTimeout(900);
 await p.evaluate(()=>{setv("name","Test Forwarder A");setv("type","forwarder");setv("company","Test Forwarding Co");});await p.evaluate(()=>{const c=$("#f_cur");if(c){c.value=[...c.options].find(o=>o.value==="USD")?"USD":c.value}});
 await p.click('.df [data-act="save"]');await p.waitForTimeout(2200);
 const saved=await p.evaluate(()=>({ok:!!live(D.parties).find(x=>x.name==="Test Forwarder A"),err:JSON.stringify(S.drawer?.errors||{}),last:!!ls.get("lastform.party")}));ok(saved.last&&saved.ok,"Save remembers the form for Fill from last (saved: "+saved.ok+" "+saved.err+")");
 await p.evaluate(()=>{S.drawer=null;openForm("party",{})});await p.waitForTimeout(900);
 await p.click('.drawer [data-act="chfill"]');await p.waitForTimeout(300);const fl=await p.evaluate(()=>({type:val("type"),name:val("name")}));
 ok(fl.type==="forwarder"&&!fl.name,"Fill from last copies type (forwarder) but not the name: "+JSON.stringify(fl));
 /* Quick / Full */
 const all=await p.evaluate(()=>document.querySelectorAll(".drawer .form > .f:not(.ch-qhide)").length);await p.click('.drawer [data-act="chmode"][data-m="quick"]');await p.waitForTimeout(150);
 const q=await p.evaluate(()=>document.querySelectorAll(".drawer .form > .f:not(.ch-qhide)").length);ok(q<all&&q>=2,"Quick shows "+q+" of "+all+" fields");
 await p.click('.drawer [data-act="chmode"][data-m="full"]');await p.waitForTimeout(150);ok(await p.evaluate(()=>document.querySelectorAll(".drawer .ch-qhide").length)===0,"Full shows them all again");
 ok(!errs.length,"no page errors "+JSON.stringify(errs.slice(0,2)));console.log(fails?fails+" FAILED":"ALL PASS");await b.close();process.exit(fails?1:0)})();
