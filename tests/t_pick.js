/* The centre of every dropdown (21 Nov 2026): ＋ Add on Setup / Users dropdowns, several-at-once with All, every dropdown on
   every page is known to the centre, forms are not doubled. Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept("Dialog Co"));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:"+(process.env.PORT||8093)+"/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(5500);
 await p.evaluate(async()=>{const us=JSON.parse(JSON.stringify(SET().users||[]));us.push({name:"Pick Tester",uid:"pick@example.com",role:"viewer",active:true});await setupPatch(["users"],us,"t")});
 const openUsers=async()=>{await p.evaluate(()=>{go("setup");S.setupTab="users";render()});await p.waitForTimeout(500);await p.evaluate(()=>{const t=document.querySelector('[data-setup="users"]');t&&t.click()});await p.waitForTimeout(700)};
 await openUsers();const i=await p.evaluate(()=>SET().users.findIndex(u=>u.uid==="pick@example.com"));
 ok(await p.evaluate(i=>{const s=document.querySelector(`[data-sp="users.${i}.role"]`);return!!s&&s.dataset.pk==="list:role"&&!!s.querySelector('option[value="__pickadd"]')},i),"Users: the Role dropdown knows it chooses a role and ends with ＋ Add");
 /* add a role from the dropdown */
 await p.selectOption(`[data-sp="users.${i}.role"]`,"__pickadd");await p.waitForTimeout(300);
 ok(await p.evaluate(i=>!!document.querySelector(".pkadd-in")&&document.querySelector(`[data-sp="users.${i}.role"]`).value==="viewer"&&SET().users[i].role==="viewer",i),"choosing ＋ Add opens a small box; nothing is saved yet and the old choice stays");
 await p.fill(".pkadd-in","Auditor");await p.click("[data-pkok]");await p.waitForTimeout(2500);
 ok(await p.evaluate(i=>items("role").some(r=>r.label==="Auditor")&&SET().users[i].role===items("role").find(r=>r.label==="Auditor").id,i),"the new role is saved in the centre (Setup list) and chosen for this person");
 ok(await p.evaluate(()=>[...document.querySelectorAll("[data-r2role]")].every(s=>[...s.options].some(o=>o.textContent==="Auditor"))),"…and is at once in every other role dropdown");
 /* add a company from the default-company dropdown */
 await openUsers();await p.selectOption(`[data-sp="users.${i}.defaults.company"]`,"__pickadd");await p.waitForTimeout(300);await p.fill(".pkadd-in","Pick Trading Ltd");await p.keyboard.press("Enter");await p.waitForTimeout(2500);
 const cid=await p.evaluate(()=>(SET().companies||[]).find(c=>c.name==="Pick Trading Ltd")?.id);
 ok(!!cid&&await p.evaluate(([i,cid])=>SET().users[i].defaults?.company===cid,[i,cid]),"a new company from a dropdown: saved in Setup › companies and chosen");
 /* cancel */
 await openUsers();await p.selectOption(`[data-sp="users.${i}.defaults.bank"]`,"__pickadd");await p.waitForTimeout(300);const nb=await p.evaluate(()=>(SET().banks||[]).length);await p.click("[data-pkx]");await p.waitForTimeout(300);
 ok(await p.evaluate(nb=>!document.querySelector(".pkadd")&&(SET().banks||[]).length===nb,nb),"✕ cancels: nothing added");
 /* several at once + All */
 ok(await p.evaluate(i=>{const w=document.querySelector(`.pkm[data-pkm="users.${i}.companies"]`);return!!w&&/All companies/.test(w.innerText)},i),"Access card: “Companies this person sees” — default All");
 await p.click(`.pkm[data-pkm="users.${i}.companies"] [data-pkm-open]`);await p.waitForTimeout(200);await p.click(`.pkm[data-pkm="users.${i}.companies"] [data-pkm-all]`);await p.waitForTimeout(100);
 await p.click(`.pkm[data-pkm="users.${i}.companies"] [data-pkm-v="${cid}"]`);await p.click(`.pkm[data-pkm="users.${i}.companies"] [data-pkm-ok]`);await p.waitForTimeout(2500);
 ok(await p.evaluate(([i,cid])=>JSON.stringify(SET().users[i].companies)===JSON.stringify([cid]),[i,cid]),"untick All, tick one company, Done → saved for that person only");
 ok(await p.evaluate(()=>/Pick can see only Pick Trading Ltd/.test(document.querySelector(".r2wrap").innerText)),"plain-words line says which companies");
 await p.click(`.pkm[data-pkm="users.${i}.companies"] [data-pkm-open]`);await p.waitForTimeout(200);await p.click(`.pkm[data-pkm="users.${i}.companies"] [data-pkm-all]`);await p.click(`.pkm[data-pkm="users.${i}.companies"] [data-pkm-ok]`);await p.waitForTimeout(2500);
 ok(await p.evaluate(i=>SET().users[i].companies==null,i),"tick All again → back to everything (also companies added later)");
 /* every dropdown on every page is known to the centre */
 const walk=await p.evaluate(async()=>{const out={n:0,unknown:[],kinds:{},addable:0,noadd:[]};const see=where=>{pickEnhance();document.querySelectorAll("select").forEach(s=>{out.n++;const k=s.dataset.pk;if(!k){out.unknown.push(where);return}const g=k.startsWith("list:")?"list":k;out.kinds[g]=(out.kinds[g]||0)+1;const def=pickDef(k);if(def&&pickCanAdd(def)&&!s.disabled&&!s.multiple){if(s.querySelector('option[value="__pickadd"]'))out.addable++;else out.noadd.push(where+":"+k)}})};
  const pages=Object.keys(VIEWS());for(const pg of pages){try{go(pg);await new Promise(r=>setTimeout(r,350));see(pg)}catch(e){out.unknown.push("ERR "+pg)}}
  go("setup");await new Promise(r=>setTimeout(r,300));for(const t of [...document.querySelectorAll("[data-setup]")].map(x=>x.dataset.setup)){try{S.setupTab=t;render();await new Promise(r=>setTimeout(r,350));see("setup/"+t)}catch(e){out.unknown.push("ERR setup/"+t)}}
  return out});
 console.log("   dropdowns seen:",walk.n,JSON.stringify(walk.kinds),"with ＋ Add from the centre:",walk.addable);
 ok(walk.n>40&&!walk.unknown.length,"every dropdown on every page and every Settings tab is known to the centre ("+walk.n+")"+(walk.unknown.length?" — unknown on: "+[...new Set(walk.unknown)].join(", "):""));
 ok(!walk.noadd.length,"every dropdown of an addable kind has ＋ Add"+(walk.noadd.length?" — missing: "+walk.noadd.slice(0,6).join(", "):""));
 /* fixed kinds never get Add; forms are not doubled */
 ok(await p.evaluate(()=>{const d=pickDef("list:poStatus");return!d||d.fixed}),"status lists are fixed (chosen, never added to from a dropdown)");
 await p.evaluate(()=>openForm("purchase",{force:true}));await p.waitForTimeout(900);
 ok(await p.evaluate(()=>{pickEnhance();const ss=[...document.querySelectorAll("select")].filter(s=>s.id.startsWith("f_")||s.id.startsWith("r_"));return ss.length>3&&ss.every(s=>[...s.options].filter(o=>o.value.startsWith("__")).length<=1)}),"a form dropdown has exactly one Add (not doubled)");
 ok(errs.length===0,"no page errors"+(errs.length?": "+errs.slice(0,3).join(" | "):""));
 await b.close();console.log(fails?`\n${fails} FAILED`:"\nALL PASS");process.exit(fails?1:0)})();
