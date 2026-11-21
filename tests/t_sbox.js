/* Supplier inbox: check → approve → put in its place; reject (21 Nov 2026). Demo :8093 with a fake gateway. */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:950}});const errs=[];p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.addInitScript(()=>{window.__calls=[];window.__DEMO_GW=async(op,x)=>{window.__calls.push([op,x]);if(op==="inboxList")return{ok:true,list:window.__inbox||[]};if(op==="inboxDone"){const it=(window.__inbox||[]).find(f=>f.id===x.id);window.__inbox=(window.__inbox||[]).filter(f=>f.id!==x.id);return x.reject?{ok:true,rejected:true}:it&&it.link?{ok:true,url:it.link,link:true}:{ok:true,url:"https://drive.google.com/file/d/"+x.id+"/view"}}if(op==="inboxFile")return{ok:true,name:"pi.xlsx",mime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",b64:""};if(op==="accessList")return{ok:true,list:[]};return{ok:true}}});
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:"+(process.env.PORT||8093)+"/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(4000);
 const ctx=await p.evaluate(()=>{const po=live(D.purchases).find(x=>x.party&&x.status!=="closed")||live(D.purchases)[0];const now=new Date().toISOString();
  window.__inbox=[{id:"F1",name:"PI-777.pdf",party:po.party,kind:"Invoice (PI / CI)",po:po.no,size:120000,at:now,note:"new PI"},{id:"F2",name:"LINK Inspection report.txt",party:po.party,kind:"Inspection / photos",link:"https://we.tl/t-abc123",po:po.no,at:now},{id:"F3",name:"random.jpg",party:po.party,kind:"Other",size:3000,at:now}];return{po:po.no,party:po.party}});
 await p.evaluate(()=>slLoad(true));await p.waitForTimeout(500);await p.evaluate(()=>{go("home");render()});await p.waitForTimeout(600);
 ok(await p.evaluate(()=>/From suppliers — to check \(3\)/.test(document.getElementById("sbcard")?.innerText||"")&&!document.getElementById("slin")),"Home: “From suppliers — to check (3)” (no long list, nothing imported by itself)");
 await p.click('#sbcard [data-sbopen=""]');await p.waitForSelector("#sbwin");await p.waitForTimeout(400);
 ok(await p.evaluate(()=>document.querySelectorAll("#sbwin .sbitem").length===3&&/download link — big file/.test(document.querySelector("#sbwin").innerText)),"the inbox window lists every file; the big one came as a download link");
 /* filter by kind */
 await p.click('#sbwin .pkm[data-sbf="kind"] [data-pkm-open]');await p.click('#sbwin .pkm[data-sbf="kind"] [data-pkm-all]');await p.click('#sbwin .pkm[data-sbf="kind"] [data-pkm-v="Other"]');await p.click('#sbwin .pkm[data-sbf="kind"] [data-pkm-ok]');await p.waitForTimeout(400);
 ok(await p.evaluate(()=>document.querySelectorAll("#sbwin .sbitem").length===1),"filter Kind (several / All) → only “Other”");
 await p.evaluate(()=>{S.sb.kind=null;sbDraw()});
 /* approve the PI onto its order */
 await p.click('#sbwin [data-sb="check"][data-id="F1"]');await p.waitForTimeout(300);
 const s1=await p.evaluate(()=>({col:S.sb.d.col,rec:S.sb.d.rec}));ok(s1.col==="purchases"&&s1.rec===ctx.po,"Check & approve: suggested — Order, the order the supplier picked "+JSON.stringify(s1));
 await p.click('#sbwin [data-sb="approve"]');await p.waitForTimeout(1500);
 ok(await p.evaluate(po=>{const l=(docOf("purchases",po).links||[]).find(x=>/PI-777/.test(x.label));return!!l&&/drive\.google\.com/.test(l.url)&&l.from==="supplier inbox"},ctx.po)&&await p.evaluate(()=>window.__calls.some(([o,x])=>o==="inboxDone"&&x.id==="F1"&&x.attach)),"approved: attached to that order (Docs / links, who and when) and taken out of the inbox");
 /* the inspection link: suggested Inspection; none exists → New, or put it on the order */
 await p.click('#sbwin [data-sb="check"][data-id="F2"]');await p.waitForTimeout(300);
 ok(await p.evaluate(()=>S.sb.d.col==="inspections"&&[...document.querySelectorAll('#sbwin [data-sbd="rec"] option')].some(o=>o.value==="__new")),"the inspection report: suggested Inspection, with “＋ New inspection…”");
 await p.selectOption('#sbwin [data-sbd="col"]',"purchases");await p.waitForTimeout(300);await p.click('#sbwin [data-sb="approve"]');await p.waitForTimeout(1500);
 ok(await p.evaluate(po=>(docOf("purchases",po).links||[]).some(x=>x.url==="https://we.tl/t-abc123"),ctx.po),"…put on the order instead: the download link itself is attached (no 400 MB in the Drive)");
 /* reject */
 await p.click('#sbwin [data-sb="check"][data-id="F3"]');await p.waitForTimeout(300);await p.selectOption('#sbwin [data-sbd="why"]',"Wrong file");await p.waitForTimeout(200);await p.click('#sbwin [data-sb="reject"]');await p.waitForTimeout(1000);
 ok(await p.evaluate(()=>window.__calls.some(([o,x])=>o==="inboxDone"&&x.id==="F3"&&x.reject==="Wrong file")&&!document.querySelector("#sbwin .sbitem")),"Reject with a reason: nothing enters MY TOOL, the inbox is empty");
 /* rights */
 const r=await p.evaluate(()=>{const o={o:S.isOwner,r:S.role,rr:S.realRole,u:uid};S.isOwner=false;uid="va@x.com";S.role=S.realRole="va";const c=sbCanDecide();Object.assign(S,{isOwner:o.o,role:o.r,realRole:o.rr});uid=o.u;return c});
 ok(r===false||r===undefined||(await p.evaluate(()=>rolePerm("va","approve"))),"only the Owner or someone with “approve” can decide");
 await p.evaluate(()=>sbClose());await p.keyboard.press("n");await p.waitForTimeout(500);await p.fill("#ch_q","inbox");await p.waitForTimeout(200);ok(await p.evaluate(()=>/Supplier inbox/.test(document.querySelector("#chub").innerText)),"Create: “Supplier inbox”");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();console.log(fails?`\n${fails} FAILED`:"\nALL PASS");process.exit(fails?1:0)})();
