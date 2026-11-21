/* People & Access: list of people, each person in their own window (21 Nov 2026). Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:950}});const errs=[];p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:"+(process.env.PORT||8093)+"/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(5000);
 await p.evaluate(async()=>{const us=JSON.parse(JSON.stringify(SET().users||[]));us.push({name:"Ali VA",uid:"ali@example.com",role:"va",active:true});await setupPatch(["users"],us,"t");go("setup");S.setupTab="users";render()});await p.waitForTimeout(900);
 const i=await p.evaluate(()=>SET().users.findIndex(u=>u.uid==="ali@example.com"));
 ok(await p.evaluate(()=>document.querySelectorAll(".pprow").length===SET().users.length&&!document.querySelector(".r2wrap,[data-r2role]")),"Settings › People & Access: one line per person, no long page of forms");
 await p.fill("#pp_q","ali");await p.waitForTimeout(300);ok(await p.evaluate(()=>document.querySelectorAll(".pprow").length===1),"find a person");
 await p.click(`[data-pp="${i}"]`);await p.waitForSelector("#ppwin");await p.waitForTimeout(400);
 ok(await p.evaluate(()=>{const w=document.getElementById("ppwin");return!!w&&["1 · Profile","2 · Roles","3 · Where and when","4 · What they can do","5 · History"].every(h=>w.innerText.includes(h))}),"tap → the person's own window with Profile, Roles, Where/when, What they can do, History");
 /* several roles */
 await p.click('#ppwin [data-pprole="finance"]');await p.waitForTimeout(1300);
 ok(await p.evaluate(i=>{const u=SET().users[i];return JSON.stringify(u.roles)==='["va","finance"]'&&u.role==="va"},i),"a second role (VA + Finance) is added, not swapped");
 const both=await p.evaluate(i=>{const u=SET().users[i];return{bank:userPerm(u,"bank"),va:rolePerm("va","bank"),fin:rolePerm("finance","bank")}},i);
 ok(both.bank===(both.va||both.fin),"the ticks of both roles add up "+JSON.stringify(both));
 await p.click('#ppwin [data-pprole="va"]');await p.waitForTimeout(1300);await p.click('#ppwin [data-pprole="finance"]');await p.waitForTimeout(1300);
 ok(await p.evaluate(i=>JSON.stringify(SET().users[i].roles)==='["finance"]',i),"the last role cannot be taken away (a person always has one)");
 /* the module matrix */
 await p.click('#ppwin [data-ppall="1"]');await p.waitForTimeout(1300);
 ok(await p.evaluate(i=>{const u=SET().users[i];return ["edit","create","deleteAny"].every(k=>userPerm(u,k))},i),"Everything on → create / change / delete on for every module");
 await p.click('#ppwin [data-ppcell="payments|create"]');await p.waitForTimeout(1300);await p.click('#ppwin [data-ppcell="payments|del"]');await p.waitForTimeout(1300);
 ok(await p.evaluate(i=>{const a=SET().users[i].acts||{};return a.payments?.create===false&&a.payments?.del===false&&!a.purchases},i),"switch off Create and Delete in Money only → only Money is limited");
 await p.click('#ppwin [data-ppcell="shipments|see"]');await p.waitForTimeout(1300);
 ok(await p.evaluate(i=>SET().users[i].areas?.shipments==="hide",i),"switch off See on Shipments → the whole module is hidden for them");
 /* fields, grouped */
 await p.click('#ppwin [data-ppf="purchases"]');await p.waitForTimeout(500);
 ok(await p.evaluate(()=>{const g=[...document.querySelectorAll("#ppwin .ppfg b")].map(x=>x.innerText);return g.includes("Prices & money")&&g.includes("Products & quantities")&&g.includes("Who, refs & dates")}),"Fields of Buying open in groups (Prices & money, Products & quantities, Who/refs/dates …)");
 await p.click('#ppwin [data-ppfg="purchases|prices"][data-v="hide"]');await p.waitForTimeout(1500);
 ok(await p.evaluate(i=>{const f=SET().users[i].fields||{};return f["purchases.lines.u"]==="hide"&&f["purchases.cur"]==="hide"&&!f["purchases.lines.sku"]},i),"Prices & money → Hide: unit price, currency … hidden; products still shown");
 await p.click('#ppwin [data-ppfv="purchases.lines.q"][data-v="view"]');await p.waitForTimeout(1300);
 ok(await p.evaluate(i=>(SET().users[i].fields||{})["purchases.lines.q"]==="view",i),"one single field (Qty) → View only");
 /* where & when */
 await p.fill('#ppwin [data-sp$=".from"]',"2030-01-01");await p.press('#ppwin [data-sp$=".from"]',"Tab");await p.waitForTimeout(1300);
 ok(await p.evaluate(i=>SET().users[i].from==="2030-01-01"&&!userPerm(SET().users[i],"edit"),i),"a start date in the future → no rights before it");
 await p.evaluate(async i=>{const us=JSON.parse(JSON.stringify(SET().users));us[i].from="";await setupPatch(["users"],us,"t")},i);
 /* as that person */
 const as=await p.evaluate(i=>{const o={o:S.isOwner,u:uid,r:S.role,rr:S.realRole};S.isOwner=false;uid="ali@example.com";S.role=S.realRole="finance";S.drawer=null;
  openForm("payment",{force:true});const noPay=!S.drawer?.form;S.drawer=null;openForm("purchase",{force:true});const po=S.drawer?.form==="purchase";S.drawer=null;const ex=live(D.purchases).find(x=>(x.lines||[]).length&&x.status!=="closed");openForm("purchase",{edit:docOf("purchases",ex.no),force:true});const hidU=!!document.querySelector('input[disabled][value="•••"]');S.drawer=null;
  Object.assign(S,{isOwner:o.o,role:o.r,realRole:o.rr});uid=o.u;return{noPay,po,hidU}},i);
 ok(as.noPay&&as.po,"as that person: a new payment does not open (Create off in Money), a new order does");
 ok(as.hidU,"…and in the order the unit price shows as ••• (hidden)");
 /* templates, copy from another person, save as template */
 await p.evaluate(async()=>{const us=JSON.parse(JSON.stringify(SET().users));us.push({name:"Bilal",uid:"bilal@example.com",role:"va",active:true});await setupPatch(["users"],us,"t")});const k=await p.evaluate(()=>SET().users.findIndex(u=>u.uid==="bilal@example.com"));
 await p.evaluate(k=>ppOpen(k),k);await p.waitForTimeout(500);
 ok(await p.evaluate(()=>[...document.querySelectorAll("#ppwin [data-pptpl] option")].length>=5&&!!document.querySelector("#ppwin [data-ppcopy]")),"Quick start: ready-made templates and “Copy access from” another person");
 await p.selectOption("#ppwin [data-pptpl]","tpl_viewer");await p.waitForTimeout(1500);
 ok(await p.evaluate(k=>{const u=SET().users[k];return JSON.stringify(u.roles)==='["viewer"]'&&u.fields["purchases.lines.u"]==="hide"&&u.fields["payments.amount"]==="hide"&&!userPerm(u,"edit")},k),"template “Look only — no prices anywhere”: View only, every price field hidden");
 await p.selectOption("#ppwin [data-ppcopy]",String(i));await p.waitForTimeout(1500);
 ok(await p.evaluate(([k,i])=>{const a=SET().users[k],b=SET().users[i];return JSON.stringify(a.roles)===JSON.stringify(b.roles)&&JSON.stringify(a.acts||{})===JSON.stringify(b.acts||{})&&JSON.stringify(a.fields||{})===JSON.stringify(b.fields||{})&&a.uid==="bilal@example.com"&&a.name==="Bilal"},[k,i]),"Copy access from Ali: roles, switches and fields copied — name and email stay");
 await p.evaluate(()=>{window.prompt=()=>"Ali-like VA"});await p.click("#ppwin [data-ppsavetpl]");await p.waitForTimeout(1500);
 ok(await p.evaluate(()=>(SET().accessTemplates||[]).some(t=>t.name==="Ali-like VA")&&[...document.querySelectorAll("#ppwin [data-pptpl] option")].some(o=>/Ali-like VA/.test(o.textContent))),"Save this person's access as a template → offered in the list");
 ok(await p.evaluate(()=>{const d=pickDef("paydept");return!!d&&d.ids().includes("freight")&&d.ids().includes("supplier")}),"Departments are the payment departments (supplier, freight …)");
 await p.evaluate(()=>ppClose());
 /* Create: clear sections */
 await p.keyboard.press("n");await p.waitForTimeout(700);const secs=await p.evaluate(()=>[...document.querySelectorAll(".ch-dept h4")].map(h=>h.childNodes[0].textContent.trim()));
 ok(JSON.stringify(secs.filter(x=>["Buying","Shipments","Money","Stock","Products","Suppliers","Import & files","People & access","Home & planning","Reports","Settings"].includes(x)))===JSON.stringify(secs)&&secs.indexOf("Buying")===0&&secs.indexOf("Settings")===secs.length-1&&secs.includes("People & access")&&secs.includes("Import & files"),"Create: fixed sections in order, Buying first, Settings last "+JSON.stringify(secs));
 ok(await p.evaluate(()=>!/New user \(give someone access\)|Access — who can do what|Hide or lock an area/.test(document.body.innerText)),"Create: the three old access entries are gone (People & access replaces them)");
 await p.keyboard.press("Escape");await p.waitForTimeout(300);
 /* history */
 await p.evaluate(i=>ppOpen(i),i);await p.waitForTimeout(500);
 ok(await p.evaluate(()=>/Changes to their access[\s\S]*Ali VA/.test(document.querySelector("#ppwin").innerText)),"History in the window lists what was changed about their access");
 await p.keyboard.press("Escape");await p.waitForTimeout(300);ok(await p.evaluate(()=>!document.getElementById("ppwin")),"Esc closes the window");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();console.log(fails?`\n${fails} FAILED`:"\nALL PASS");process.exit(fails?1:0)})();
