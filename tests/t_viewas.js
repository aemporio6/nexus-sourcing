/* View as never traps the Owner (18 Nov 2026). Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 const go=async()=>{await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(600)};
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await go();
 ok(await p.evaluate(()=>S.role==="owner"&&S.realRole==="owner"),"starts as Owner");
 await p.evaluate(()=>{const b=document.createElement("button");b.dataset.role="va";document.body.appendChild(b);b.click()});await p.waitForTimeout(400);
 ok(await p.evaluate(()=>S.role==="va"&&!!document.getElementById("vabar")),"View as VA → bar on top");
 ok(await p.evaluate(()=>/data-role="owner"/.test(roleSwitch())),"View-as switch still offers Owner");
 await p.evaluate(()=>{D.imports=D.imports||[];D.imports.push({id:"IMP-T",no:"IMP-T",docIds:[]});undoImport("IMP-T")});await p.waitForTimeout(200);
 ok(await p.evaluate(()=>/viewing as/.test($("#toast")?.innerText||"")),"blocked action explains: viewing as VA");
 await p.click("[data-va-back]");await p.waitForTimeout(300);ok(await p.evaluate(()=>S.role==="owner"&&!document.getElementById("vabar")),"Back to Owner works");
 await p.evaluate(()=>{S.role="finance";ls.set("role","finance")});await go();ok(await p.evaluate(()=>S.role==="owner"),"reopening the app starts as the real role again");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
