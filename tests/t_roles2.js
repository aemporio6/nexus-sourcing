/* Access ticks per person + version history (20 Nov 2026). Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(5500);
 ok(await p.evaluate(()=>!!SET().roles2&&!!SET().roles.partner&&!!SET().roles.viewer&&items("role").some(r=>r.id==="partner")&&DEF().trashDays>=90),"Partner and View-only roles exist; Recycle Bin keeps 90 days");
 ok(await p.evaluate(()=>{const r=SET().roles.partner;return r.bank&&r.edit&&r.create&&r.deleteAny&&r.restore&&r.approve&&r.export&&!r.setup}),"Partner: everything ticked except Settings / Users");
 /* a partner user */
 await p.evaluate(async()=>{const us=JSON.parse(JSON.stringify(SET().users||[]));us.push({name:"Omer Khan",uid:"omer@example.com",role:"partner",active:true});await setupPatch(["users"],us,"t")});
 await p.evaluate(()=>{go("setup");S.setupTab="users";render()});await p.waitForTimeout(600);await p.evaluate(()=>{const t=document.querySelector('[data-setup="users"]');t&&t.click()});await p.waitForTimeout(600);
 const i=await p.evaluate(()=>SET().users.findIndex(u=>u.uid==="omer@example.com"));
 ok(await p.evaluate(i=>!!document.querySelector(`[data-sp="users.${i}.perms.export"]`)&&document.querySelector(`[data-sp="users.${i}.perms.export"]`).checked&&!document.querySelector(`[data-sp="users.${i}.perms.setup"]`).checked,i),"user card shows a tick for each permission, filled from the role");
 ok(await p.evaluate(()=>/Omer can see everything.*approve payments.*Cannot change Settings/.test(document.querySelector(".r2wrap").innerText)),"plain-words line under the card");
 await p.click(`[data-sp="users.${i}.perms.export"]`);await p.waitForTimeout(1500);
 ok(await p.evaluate(i=>SET().users[i].perms.export===false&&!userPerm(SET().users[i],"export")&&userPerm(SET().users[i],"edit"),i),"untick Download for this one person → only that changes");
 {const t=await p.evaluate(()=>[...document.querySelectorAll(".r2say")].pop().innerText);ok(/Cannot download/.test(t),"the line updates: cannot download | "+t)}
 /* acting as that person */
 const asUser=async f=>p.evaluate(f=>{const o=S.isOwner,u=uid,r=S.role,rr=S.realRole;S.isOwner=false;uid="omer@example.com";S.role=S.realRole="partner";try{return eval(f)}finally{S.isOwner=o;uid=u;S.role=r;S.realRole=rr}},f);
 ok(await asUser(`can("edit")&&can("bank")&&can("approve")&&can("restore")&&!can("export")&&!can("setup")`),"as Omer: edit / bank / approve / bring back yes — download and settings no");
 await p.evaluate(async i=>{const us=JSON.parse(JSON.stringify(SET().users));us[i].approveLimit=500;us[i].until="2020-01-01";await setupPatch(["users"],us,"t")},i);
 ok(await asUser(`!can("edit")&&!can("approve")`),"after the 'until' date: can only look");
 await p.evaluate(async i=>{const us=JSON.parse(JSON.stringify(SET().users));us[i].until="";await setupPatch(["users"],us,"t")},i);
 /* role change resets own ticks */
 await p.evaluate(()=>render());await p.waitForTimeout(400);await p.selectOption(`[data-r2role="${i}"]`,"viewer");await p.waitForTimeout(800);
 ok(await p.evaluate(i=>SET().users[i].role==="viewer"&&!SET().users[i].perms&&!userPerm(SET().users[i],"edit"),i),"role → View only: every tick follows the role");
 /* version history */
 const h=await p.evaluate(async()=>{const po=live(D.purchases).find(x=>x.status!=="closed");const old=po.notes||"";await updateDoc("purchases",po.no,{notes:"CHANGED BY TEST"},"t");const n=hvList("purchases",po.no).length;return{no:po.no,old,n,before:hvList("purchases",po.no)[0]?.before?.notes||""}});
 ok(h.n===1&&h.before===h.old,"a saved change keeps the version from before it");
 await p.evaluate(no=>openDoc("purchases",no),h.no);await p.waitForTimeout(700);
 ok(await p.evaluate(()=>/History — 1 earlier version/.test(document.querySelector(".drawer .hvbox")?.innerText||"")),"the record shows 🕘 History");
 await p.evaluate(()=>{document.querySelector(".drawer .hvbox").open=true});await p.click(".drawer [data-hv]");await p.waitForTimeout(900);
 ok(await p.evaluate(h=>(docOf("purchases",h.no).notes||"")===h.old&&hvList("purchases",h.no).length===2,h),"Restore puts the old version back — and keeps the replaced one as a version too");
 ok(await p.evaluate(async()=>{const n=D.versions.length;await updateDoc("purchases",live(D.purchases)[0].no,{x_auto:1},null,{noUndo:true,derived:true});return D.versions.length===n}),"automatic re-calculations are not versions");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
