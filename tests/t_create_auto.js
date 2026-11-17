/* Create builds itself (18 Nov 2026): every form, every + New and every menu page reach Create without Create code; a new module's form/page appears by itself in its menu group. Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1366,height:900}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(500);
 const r=await p.evaluate(()=>{const it=chItems();const forms=Object.keys(SAVE).filter(k=>!it.some(i=>i.form===k));const pages=[];NAV_MODULES.forEach(m=>m.items.forEach(([l,pg,f,nk])=>{if(nk&&!it.some(i=>i.form===nk))pages.push("+"+nk);if(pg&&!nk&&!it.some(i=>i.page===pg))pages.push(pg)}));return{n:it.length,forms,pages,depts:[...new Set(it.map(i=>i.dept))]}});
 console.log(r.n,"entries ·",r.depts.join(", "));ok(!r.forms.length,"every form is in Create "+r.forms);ok(!r.pages.length,"every menu page and + New is in Create "+r.pages);
 ok(!r.depts.includes("Other"),"each entry sits under its menu button");
 await p.evaluate(()=>openCreateHub());await p.waitForTimeout(300);const n0=await p.evaluate(()=>document.querySelectorAll("#chub .ch-item").length);
 await p.fill("#ch_q","still to pay");await p.waitForTimeout(300);const hit=await p.evaluate(()=>[...document.querySelectorAll("#chub .ch-item")].map(b=>b.innerText.split("\n")[0]));console.log(hit);
 ok(hit.some(h=>/Still to pay/.test(h)),"typing finds pages too (Still to pay)");
 await p.evaluate(()=>[...document.querySelectorAll("#chub .ch-item")].find(b=>/Still to pay/.test(b.innerText)).click());await p.waitForTimeout(500);ok(await p.evaluate(()=>S.view.k==="purchases"&&!!F("purchases").owing),"a page entry opens the page with its filter");
 /* a brand-new module: a form + a page, nothing else */
 const nw=await p.evaluate(()=>{FORM_DEFAULTS.widget=[{k:"name",l:"Name",t:"text",req:1}];FORM_TITLE.widget="Widget";FORM_COL.widget="widgets";SAVE.widget=async()=>{};NAV_MODULES.find(m=>m.k==="stock").items.push(["Widgets","stock",{w:1}]);const it=chItems();return{f:it.find(i=>i.form==="widget")?.dept,pg:it.find(i=>i.title==="Widgets")?.dept}});
 ok(nw.f&&nw.pg==="Stock","a new module's form and page appear in Create by themselves ("+JSON.stringify(nw)+")");
 ok(n0>=20,"default Create list still complete ("+n0+")");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
