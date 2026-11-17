/* Item 4 (17 Nov 2026): bank details masked, Show is logged, non-owner change waits for approval, payment warns. Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:950}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(500);
 const code=await p.evaluate(async()=>{const x=live(D.parties).find(x=>x.type==="supplier");await updateDoc("parties",x.code,{beneficiary:"ICBC Yiwu\nAccount 6222 0000 1111 2222\nSWIFT ICBKCNBJ"},"test bank");return x.code});
 await p.evaluate(c=>openDoc("parties",c),code);await p.waitForTimeout(700);
 const t1=await p.evaluate(()=>document.querySelector(".drawer").innerText);ok(/•••• 2222/.test(t1)&&!/6222 0000 1111 2222/.test(t1),"masked as •••• 2222");
 await p.click('[data-bs="show"]');await p.waitForTimeout(400);ok(await p.evaluate(()=>/6222 0000 1111 2222/.test(document.querySelector(".drawer").innerText)),"Show opens them");
 ok(await p.evaluate(c=>D.log.some(l=>l.kind==="security"&&l.ref===c),code),"opening is in the Activity log");
 /* finance changes → waits */
 await p.evaluate(()=>{S.role="finance"});await p.evaluate(async c=>{const x=party(c);await writeDoc("parties",c,{...x,beneficiary:"BOC Account 6216 9999 8888 7777"},"edit")},code);await p.waitForTimeout(500);
 const x1=await p.evaluate(c=>{const x=party(c);return{b:x.beneficiary,p:x.beneficiaryPending}},code);ok(/2222/.test(x1.b)&&x1.p&&/7777/.test(x1.p.text),"non-owner change waits; old details stay");
 await p.evaluate(c=>{S.drawer=null;openDoc("parties",c)},code);await p.waitForTimeout(600);
 ok(await p.evaluate(()=>/someone else approves/.test(document.querySelector(".drawer").innerText)),"asker sees: someone else approves");
 ok(await p.evaluate(()=>attention().some(a=>/waiting for approval \(•••• 7777\)/.test(a.text))),"alert for approvers");
 /* paying while a change waits */
 const w=await p.evaluate(c=>{S.drawer=null;openForm("payment",{});return new Promise(r=>setTimeout(()=>{setv("party",c);const v=validatePay({...collect("payment"),party:c,amount:10,cur:"RMB",allocations:[]});r(v.warnings.join(" | "))},900))},code);ok(/waiting for approval/.test(w),"payment warns: change waiting");
 /* owner approves (not the asker) */
 await p.evaluate(()=>{S.role="owner";S.drawer=null});await p.evaluate(c=>openDoc("parties",c),code);await p.waitForTimeout(600);await p.click('[data-bs="approve"]');await p.waitForTimeout(700);
 const x2=await p.evaluate(c=>{const x=party(c);return{b:x.beneficiary,p:x.beneficiaryPending,ch:x.beneficiaryChangedAt}},code);ok(/7777/.test(x2.b)&&!x2.p&&x2.ch,"approved → new details active, date kept");
 const w2=await p.evaluate(c=>{S.drawer=null;openForm("payment",{});return new Promise(r=>setTimeout(()=>{const v=validatePay({...collect("payment"),party:c,amount:10,cur:"RMB",allocations:[]});r(v.warnings.join(" | "))},900))},code);
 const hasPaid=await p.evaluate(c=>live(D.payments).some(p=>p.party===c&&p.status==="paid"),code);ok(!hasPaid||/changed on/.test(w2),"payment warns: details changed since the last payment");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
