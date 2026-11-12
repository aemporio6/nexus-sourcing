/* Tasks page (own + rule tasks), Linked records both ways, Link with MoreOrderz (permissions Always / Ask / Never, review window, link files).
   Demo build on :8093.   node tests/t_tasks_link.js */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:900},acceptDownloads:true});const p=await ctx.newPage();const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(600);
 /* tasks */
 await p.evaluate(()=>go("tasks"));await p.waitForTimeout(300);
 const po=await p.evaluate(()=>live(D.purchases)[0].no);
 await p.fill("#tk_title","Ask supplier for statement");await p.fill("#tk_ref",po);await p.click('[data-act="tkadd"]');await p.waitForTimeout(600);
 const t1=await p.evaluate(()=>({n:live(D.tasks).length,row:document.body.innerText.includes("Ask supplier for statement"),rules:document.querySelectorAll('.card:last-of-type tr').length}));
 ok(t1.n===1&&t1.row,"task added and listed");ok(t1.rules>1,"rule tasks from the alerts listed ("+(t1.rules-1)+")");
 await p.click('[data-act="tkst"][data-s="doing"]');await p.waitForTimeout(400);await p.click('[data-act="tkst"][data-s="done"]');await p.waitForTimeout(400);
 ok(await p.evaluate(()=>live(D.tasks)[0].status==="done"&&!document.body.innerText.includes("Ask supplier for statement")),"Start → Done; done tasks hidden unless 'Show done'");
 /* linked records */
 await p.evaluate(no=>openDoc("purchases",no),po);await p.waitForTimeout(400);
 const lk=await p.evaluate(()=>({has:!!document.querySelector(".drawer .lk"),items:[...document.querySelectorAll(".drawer .lk-i b")].map(x=>x.textContent),dirs:[...document.querySelectorAll(".drawer .lk-d")].map(x=>x.textContent)}));
 ok(lk.has&&lk.items.some(i=>/^TA-/.test(i)),"order shows Linked records incl. the task that points to it: "+lk.items.slice(0,6).join(", "));
 ok(lk.dirs.includes("←")&&(lk.dirs.includes("→")||lk.dirs.includes("⇄")),"both directions shown ("+[...new Set(lk.dirs)].join(" ")+")");
 /* MoreOrderz link */
 await p.evaluate(()=>{S.drawer=null;go("molink")});await p.waitForTimeout(300);
 ok(await p.evaluate(()=>!!document.querySelector('[data-act="momode"]')&&document.querySelectorAll('[data-act="momode"]').length===22),"permissions table: 11 kinds × send / receive");
 ok(await p.evaluate(()=>document.querySelector('[data-act="mosend"]').disabled),"link OFF: send disabled");
 await p.click('[data-act="moon"]');await p.waitForTimeout(500);ok(await p.evaluate(()=>moCfg().on),"link turned ON");
 /* Never blocks everything */
 await p.click('[data-act="moallmode"][data-m="never"]');await p.waitForTimeout(400);await p.click('[data-act="mosend"]');await p.waitForTimeout(400);
 ok(await p.evaluate(()=>!document.querySelector("#moRev")&&moCfg().history.length===0),"all Never → nothing sent, no window");
 /* Ask: review window, untick all but one record, send as file */
 await p.click('[data-act="moallmode"][data-m="ask"]');await p.waitForTimeout(400);await p.click('[data-act="mosend"]');await p.waitForTimeout(400);
 const rv=await p.evaluate(()=>({open:!!document.querySelector("#moRev"),items:document.querySelectorAll("#moRev .mo-item").length,fields:document.querySelectorAll("#moRev .mo-field").length}));ok(rv.open&&rv.items>5&&rv.fields>rv.items,"Ask → review window lists "+rv.items+" records and "+rv.fields+" fields");
 await p.click('#moRev [data-act="moall"][data-v="0"]');await p.evaluate(()=>{const it=document.querySelector("#moRev .mo-item");it.checked=true;it.dispatchEvent(new Event("change",{bubbles:true}))});
 const [dl]=await Promise.all([p.waitForEvent("download",{timeout:8000}).catch(()=>null),p.click('#moRev [data-act="mook"]')]);await p.waitForTimeout(800);
 let pkg=null;if(dl){const fs=require("fs");pkg=JSON.parse(fs.readFileSync(await dl.path(),"utf8"))}
 ok(pkg&&pkg.format==="mytool-link-1"&&pkg.items.length===1,"only the one ticked record left, as a link file ("+(pkg?pkg.items.length:0)+" item)");
 ok(pkg&&!JSON.stringify(pkg).match(/"(iban|swift|beneficiary)"/),"no bank details in the file");
 ok(await p.evaluate(()=>moCfg().history.length===1&&D.log.some(l=>/Sent to MoreOrderz/.test(l.text||""))),"send written to history + Activity log");
 ok(await p.evaluate(n=>moPrepare().items.length===n-1,rv.items),"the unticked records are offered again next time; the sent one is not");
 /* receive: Ask with per-field ticks; Never kind blocked; delete only shown; unknown kind left out */
 const party=await p.evaluate(()=>live(D.parties)[0]);
 await p.evaluate(async()=>{const c=moCfg();await moSave({recv:{...c.recv,products:"never"}})});
 const inc={format:"moreorderz-link-1",items:[{kind:"parties",id:party.code,op:"upsert",data:{...party,note:"from MO",phone:"+92 300 0000000"}},{kind:"products",id:"MO-SKU-1",op:"upsert",data:{sku:"MO-SKU-1",name:"Blocked"}},{kind:"listings",id:"L1",op:"upsert",data:{x:1}},{kind:"parties",id:"GONE-1",op:"delete",data:{}}]};
 await p.evaluate(pk=>moReceive(pk,"test"),inc);await p.waitForTimeout(400);
 const rr=await p.evaluate(()=>({open:!!document.querySelector("#moRev"),fields:[...document.querySelectorAll("#moRev .mo-field")].map(x=>x.closest("tr").innerText.trim().slice(0,40)),pre:document.querySelectorAll("#moRev .mo-item:checked").length}));
 ok(rr.open&&rr.fields.length===2&&rr.pre===0,"incoming: review shows the 2 changed fields, nothing pre-ticked: "+rr.fields.join(" | "));
 await p.evaluate(()=>{const f=document.querySelector('#moRev .mo-field[data-f="0"]');f.checked=true;f.dispatchEvent(new Event("change",{bubbles:true}))});await p.click('#moRev [data-act="mook"]');await p.waitForTimeout(800);
 const after=await p.evaluate(code=>{const x=docOf("parties",code);return{note:x.note,phone:x.phone,prod:!!docOf("products","MO-SKU-1")}},party.code);
 ok(after.note==="from MO"&&after.phone!=="+92 300 0000000","only the ticked field came in (note yes, phone no)");ok(!after.prod,"products set to Never → blocked");
 ok(await p.evaluate(()=>D.log.some(l=>/Received from MoreOrderz.*1 record.*blocked by Never.*does not keep.*only shown/.test(l.text||""))),"receive logged with blocked / left out / deletion counts");
 ok(!errs.length,"no page errors "+JSON.stringify(errs.slice(0,2)));console.log(fails?fails+" FAILED":"ALL PASS");await b.close();process.exit(fails?1:0)})();
