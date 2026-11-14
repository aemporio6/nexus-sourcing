/* Adding a new product (15 Nov 2026): name first → brand / category / pack / SKU fill themselves; a new kind of product
   gets "＋ New category" (no random "most used" category); no old names pop up; Quick and Full both save. Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:950}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(500);
 const open=async()=>{await p.evaluate(()=>{S.drawer=null;openNew("product")});await p.waitForTimeout(900)};
 const save=async()=>{await p.evaluate(()=>[...document.querySelectorAll(".drawer .df button,.drawer button")].find(b=>/^Save\b/.test(b.textContent.trim())&&!/add another|continue/i.test(b.textContent)).click());await p.waitForTimeout(1200)};
 /* 1. like an existing product */
 await open();ok(await p.evaluate(()=>document.querySelector(".drawer .form .f input, .drawer .form .f select")?.id==="f_name"),"Name is the first box");
 ok(await p.evaluate(()=>!document.querySelector("#f_name").getAttribute("list")),"no old names pop up under the name");
 await p.fill("#f_name","Toilet Brush Grey pack of 2");await p.waitForTimeout(700);
 const a=await p.evaluate(()=>({cat:val("category"),pk:val("packOf"),sku:val("sku"),brand:val("brand")}));console.log(a);
 ok(a.cat==="TB-GRY"&&+a.pk===2&&/^WAL-TB-GRY-/.test(a.sku),"category, pack and SKU filled from the name");
 const n0=await p.evaluate(()=>live(D.products).length);await save();ok(await p.evaluate(n=>live(D.products).length===n+1&&!S.drawer?.form,n0),"saved (Full form)");
 /* 2. a new kind of product */
 await open();await p.evaluate(()=>{const q=[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Quick");q&&q.click()});await p.waitForTimeout(300);
 await p.fill("#f_name","Silicone kitchen sponge pack of 3");await p.waitForTimeout(700);
 const b2=await p.evaluate(()=>({cat:val("category"),hint:document.querySelector("#fw_category .pahint")?.innerText||"",sug:document.querySelector(".drawer")?.innerText.match(/Use [^\n]*most used[^\n]*/)?.[0]||""}));console.log(b2);
 ok(!b2.cat&&/New category/.test(b2.hint)&&!b2.sug,"new kind: no random category, offers ＋ New category");
 await p.click('[data-act="panewcat"]');await p.waitForTimeout(300);ok(await p.evaluate(()=>$("#inl_in_category")?.value==="Silicone Kitchen"),"new category name ready");
 await p.fill("#inl_in_category","Kitchen Sponge");await p.click('[data-act="inladd"][data-k="category"]');await p.waitForTimeout(800);
 const c2=await p.evaluate(()=>({cat:val("category"),sku:val("sku"),pk:val("packOf")}));console.log(c2);ok(c2.cat&&c2.sku&&+c2.pk===3,"category added, SKU made: "+c2.sku);
 const n1=await p.evaluate(()=>live(D.products).length);await save();const last=await p.evaluate(()=>live(D.products).slice(-1)[0]);ok(await p.evaluate(n=>live(D.products).length===n+1,n1)&&last.name==="Silicone kitchen sponge pack of 3","saved (Quick form): "+last.sku);
 /* 3. the category dropdown has ＋ Add at the top */
 await open();ok(await p.evaluate(()=>$("#f_category").options[1].value==="__add"),"＋ Add new category is at the top of the dropdown");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
