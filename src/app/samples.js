/* ---------- Samples (owner, 17 Nov 2026 – item 7) ----------
   A sample is a small order of kind "Sample purchase" (already in MY TOOL: no stock, no China fee), so payment, shipment, Drive folder,
   documents and linked records all work as for any order. Added here:
   - "＋ New sample" in Create and in the Buying menu (the order form opens set to Sample).
   - On the sample: Approve / Reject (reason needed), 📷 photos, and once approved "Make the order from this sample"
     (same supplier and lines, kind China); the sample and the order are linked both ways.
   - Product page: how many samples and what they cost. Alert: a sample with no decision 7 days after it arrived. */
CREATE_REG.push({k:"sample",l:"Sample",menu:"New sample",hint:"Supplier · product · cost · approve / reject",mod:"purchases"});
(function(){const m=NAV_MODULES.find(x=>x.k==="purchases");if(m&&!m.items.some(i=>i[3]==="sample"))m.items.push(["+ New sample",null,null,"sample"])})();
const smOpenNew0=openNew;
openNew=function(k,ds={}){if(k!=="sample")return smOpenNew0.apply(this,arguments);if(!can("create")){toast("Your role cannot create records");return}openForm("purchase",{...(ds.party?{party:ds.party}:{}),force:true});setTimeout(()=>{try{setv("kind","sample");if(typeof syncPurchase==="function")syncPurchase()}catch(_){}},60)};
const smIs=p=>p&&p.kind==="sample";
function smBox(p){const d=p.sample||{};const may=can("approve")||S.role==="owner";const dec=d.res;const ph=(d.photos||[]);
 const head=dec==="approved"?`<b>Sample approved</b> ${d.by?"by "+esc(d.by):""} ${d.at?fmtD(d.at.slice(0,10)):""}${d.why?" — "+esc(d.why):""}`:dec==="rejected"?`<b>Sample rejected</b> ${d.by?"by "+esc(d.by):""} — ${esc(d.why||"")}`:`<b>Sample — waiting for your decision</b>`;
 const order=p.orderMade?` · order made: <button type="button" class="lnk" data-open="purchases" data-id="${esc(p.orderMade)}">${esc(p.orderMade)}</button>`:"";
 return`<div class="${dec==="approved"?"okbox":dec==="rejected"?"badbox":"warnbox"} smbox" style="margin:0 0 8px">${head}${order}
  ${ph.length?`<div class="smph">${ph.map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener">📷 photo ${i+1}</a>`).join(" · ")}</div>`:""}
  <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">${can("edit")?`<label class="btn sm" style="cursor:pointer">📷 Add photo<input type="file" accept="image/*" capture="environment" data-smph="${esc(p.no)}" hidden></label>`:""}
  ${may&&dec!=="approved"?`<button type="button" class="btn sm pri" data-sm="ok" data-id="${esc(p.no)}">Approve</button>`:""}${may&&!dec?`<input id="sm_why" placeholder="Why reject? (colour, quality…)" aria-label="Reason" style="min-width:200px;min-height:40px"><button type="button" class="btn sm" data-sm="no" data-id="${esc(p.no)}">Reject</button>`:""}
  ${dec==="approved"&&!p.orderMade&&can("create")?`<button type="button" class="btn sm pri" data-sm="order" data-id="${esc(p.no)}">Make the order from this sample</button>`:""}${dec&&may?`<button type="button" class="btn sm" data-sm="undo" data-id="${esc(p.no)}">Change decision</button>`:""}</div></div>`}
const smPO0=openPO;
openPO=function(x){const r=smPO0.apply(this,arguments);try{const p=x&&typeof x==="object"?x:docOf("purchases",x);if(r&&smIs(p))r.body=smBox(p)+r.body;else if(r&&p&&p.fromSample)r.body=`<div class="status" style="margin:0 0 8px">Made from sample <button type="button" class="lnk" data-open="purchases" data-id="${esc(p.fromSample)}">${esc(p.fromSample)}</button></div>`+r.body}catch(e){console.warn(e)}return r};
document.addEventListener("click",async e=>{const b=e.target.closest("[data-sm]");if(!b)return;e.preventDefault();e.stopImmediatePropagation();const p=docOf("purchases",b.dataset.id);if(!p)return;const by=(typeof uid!=="undefined"&&uid)||S.role;const a=b.dataset.sm;
 if(a==="ok"){await updateDoc("purchases",p.no,{sample:{...(p.sample||{}),res:"approved",by,at:nowIso(),why:String($("#sm_why")?.value||"").trim()||null}},`${p.no} sample approved`);render();return}
 if(a==="no"){const why=String($("#sm_why")?.value||"").trim();if(why.length<3){toast("Write why the sample is rejected");$("#sm_why")?.focus();return}await updateDoc("purchases",p.no,{sample:{...(p.sample||{}),res:"rejected",by,at:nowIso(),why}},`${p.no} sample rejected — ${why}`);render();return}
 if(a==="undo"){await updateDoc("purchases",p.no,{sample:{...(p.sample||{}),res:null,why:null}},`${p.no} sample decision cleared`);render();return}
 if(a==="order"){S._fromSample=p.no;openForm("purchase",{copy:p,force:true});setTimeout(()=>{try{setv("kind","china");setv("notes",(val("notes")?val("notes")+" | ":"")+"From sample "+p.no);if(typeof syncPurchase==="function")syncPurchase()}catch(_){}},80)}},true);
document.addEventListener("change",async e=>{const i=e.target.closest?.("[data-smph]");if(!i||!i.files?.length)return;const p=docOf("purchases",i.dataset.smph);if(!p)return;toast("Uploading photo…");
 try{const up=await uploadFile(i.files[0]);const id=String(up||"").replace(/^drive:/,"");const link=/^a[0-9a-z]+$/.test(id)?up:"https://drive.google.com/file/d/"+id+"/view";await updateDoc("purchases",p.no,{sample:{...(p.sample||{}),photos:[...((p.sample||{}).photos||[]),link]}},`${p.no} sample photo added`);render()}catch(err){toast("Photo not uploaded: "+err.message)}},true);
/* the new order made from a sample: link both ways */
const smWrite0=writeDoc;
writeDoc=function(col,id,data,labelTxt,opts){const from=S._fromSample;const isNew=col==="purchases"&&from&&data&&!docOf("purchases",id)&&data.kind!=="sample";if(isNew)data.fromSample=from;const r=smWrite0.apply(this,arguments);
 if(isNew){S._fromSample=null;Promise.resolve(r).then(ok=>{if(ok!==false)updateDoc("purchases",from,{orderMade:id},`${from} → order ${id}`,{quiet:true})}).catch(()=>{})}return r};
/* product page: samples and their cost */
const smProd0=openProduct;
openProduct=function(x){const r=smProd0.apply(this,arguments);try{const pr=x&&typeof x==="object"?x:docOf("products",x);const sm=live(D.purchases).filter(p=>smIs(p)&&(p.lines||[]).some(l=>l.sku===pr?.sku));if(r&&sm.length){const g=sm.reduce((a,p)=>a+(+poGbp(p)||0),0);r.body=`<div class="status" style="margin:0 0 8px">Samples: ${sm.map(p=>`<button type="button" class="lnk" data-open="purchases" data-id="${esc(p.no)}">${esc(p.no)}</button> ${p.sample?.res==="approved"?"✓":p.sample?.res==="rejected"?"✗":"…"}`).join(" · ")} · cost ${gbp(g)}</div>`+r.body}}catch(_){}return r};
if(typeof attention==="function"){const smAtt0=attention;attention=function(){const out=smAtt0.apply(this,arguments);try{const T=today();live(D.purchases).filter(p=>smIs(p)&&!p.sample?.res&&p.status!=="cancelled").forEach(p=>{const got=live(D.receipts).find(r=>(r.lines||[]).some(l=>l.po===p.no))?.date||(["received","closed"].includes(p.status)?p.date:null);if(got&&diffDays(got,T)>=7)out.push({sev:1,text:`Sample ${p.no} (${pname(p.party)}) arrived — approve or reject`,col:"purchases",id:p.no,d:T})})}catch(_){}return out}}
