/* Fine access: any area / any field → Edit · View only · Hidden (20 Nov 2026). Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(5500);
 await p.evaluate(async()=>{const us=JSON.parse(JSON.stringify(SET().users||[]));us.push({name:"Omer Khan",uid:"omer@example.com",role:"partner",active:true});await setupPatch(["users"],us,"t");go("setup")});await p.waitForTimeout(500);await p.evaluate(()=>document.querySelector('[data-setup="users"]')?.click());await p.waitForTimeout(700);
 const i=await p.evaluate(()=>SET().users.findIndex(u=>u.uid==="omer@example.com"));await p.evaluate(i=>ppOpen(i),i);await p.waitForTimeout(500);
 ok(await p.evaluate(()=>document.querySelectorAll('#ppwin [data-ppcell$="|see"]').length>=9),"each person's window has every module with See / Create / Change / Delete");
 await p.click('#ppwin [data-pprow="shipments|0"]');await p.waitForTimeout(1300);await p.click('#ppwin [data-ppcell="payments|see"]');await p.waitForTimeout(1300);
 await p.click('#ppwin [data-ppf="purchases"]');await p.waitForTimeout(600);
 const nf=await p.evaluate(()=>document.querySelectorAll('#ppwin [data-ppfv^="purchases."][data-v="hide"]').length);ok(nf>15,"fields of a module come from the form itself ("+nf+" fields, lines included)");
 ok(await p.evaluate(()=>!!document.querySelector('#ppwin [data-ppfv="purchases.lines.u"]')),"a column inside the lines (unit price) can be limited too");
 await p.click('#ppwin [data-ppfv="purchases.lines.u"][data-v="hide"]');await p.waitForTimeout(1300);await p.click('#ppwin [data-ppfv="purchases.notes"][data-v="view"]');await p.waitForTimeout(1300);
 ok(await p.evaluate(i=>{const u=SET().users[i];return u.areas.payments==="hide"&&u.areas.shipments==="view"&&u.fields["purchases.lines.u"]==="hide"&&u.fields["purchases.notes"]==="view"},i),"saved on the person");
 ok(await p.evaluate(()=>/Does not see: Money.*View only: Shipments.*1 field hidden, 1 view-only/.test(document.querySelector("#ppwin .ppsays").innerText)),"the plain-words line says it");
 await p.evaluate(()=>ppClose());
 /* as that person */
 await p.evaluate(()=>{window.__o={o:S.isOwner,u:uid,r:S.role,rr:S.realRole};S.isOwner=false;uid="omer@example.com";S.role=S.realRole="partner"});
 const po=await p.evaluate(()=>{const x=live(D.purchases).find(p=>(p.lines||[]).length&&p.status!=="closed");return{no:x.no,u:x.lines[0].u,notes:x.notes||""}});
 await p.evaluate(no=>{S.drawer=null;openForm("purchase",{edit:docOf("purchases",no),force:true})},po.no);await p.waitForTimeout(900);
 ok(await p.evaluate(()=>{const u=document.querySelector('[data-row="lines"][data-k="u"],#r_lines_0_u');const cells=[...document.querySelectorAll('.drawer input[disabled][value="•••"]')];return cells.length>0&&!document.querySelector('.drawer input[data-row="lines"][data-k="u"]:not([disabled])')}),"order form: unit price is hidden (•••)");
 ok(await p.evaluate(()=>$("#f_notes")?.disabled===true),"order form: Notes is view-only (greyed)");
 const o=await p.evaluate(()=>collect("purchase"));ok(o.lines[0].u===po.u&&(o.notes||"")===po.notes,"saving keeps the hidden / view-only values exactly");
 await p.evaluate(()=>{S.drawer.dirty=false;S.drawer=null;openForm("shipment",{force:true})});await p.waitForTimeout(500);ok(await p.evaluate(()=>!S.drawer?.form),"view-only area: its form does not open");
 ok(await p.evaluate(async()=>{const s=live(D.shipments)[0];return(await updateDoc("shipments",s.no,{notes:"x"},"t"))===false&&docOf("shipments",s.no).notes!=="x"}),"view-only area: nothing saves");
 await p.evaluate(()=>go("payments"));await p.waitForTimeout(600);ok(await p.evaluate(()=>/not available for you/.test($("#view").innerText)),"hidden area: the page is not available");
 ok(await p.evaluate(()=>[...document.querySelectorAll('[data-nav="payments"]')].every(e=>e.hidden||getComputedStyle(e).display==="none")),"…and it is not in the menu");
 ok(await p.evaluate(()=>a3Partial()),"this device skips automatic re-calculations (it does not have every number)");
 await p.evaluate(()=>{const o=window.__o;S.isOwner=o.o;uid=o.u;S.role=o.r;S.realRole=o.rr;go("payments")});await p.waitForTimeout(500);ok(await p.evaluate(()=>!/not available for you/.test($("#view").innerText)),"the Owner sees everything");
 /* catch-up: a change by the limited person is re-calculated on a full-access device */
 const cu=await p.evaluate(async()=>{const sh=live(D.shipments)[0];await rawSet("shipments",sh.no,{...sh,updatedBy:"omer@example.com",updatedAt:nowIso()});localStorage.removeItem("mt_a3swept");let called=0;const r0=recomputeShipment;recomputeShipment=async function(no){if(no===sh.no)called++;return r0.apply(this,arguments)};await a3CatchUp();const first=called;await a3CatchUp();recomputeShipment=r0;return{first,second:called,mark:!!localStorage.getItem("mt_a3swept")}});
 ok(cu.first===1&&cu.second===1&&cu.mark,"totals changed by a limited person are re-calculated once on a full-access device");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
