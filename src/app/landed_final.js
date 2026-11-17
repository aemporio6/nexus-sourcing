/* ---------- Landed cost: how freight is shared + FINAL (owner, 17 Nov 2026 – item 6) ----------
   - Shipment › "Share freight by": Auto (= how the forwarder charges: "Rate is per" CBM / kg, else the service) or by CBM / kg /
     goods value / pack count. The receipt, product Landing cost and stock value all follow it (one calculation: freightSplit).
   - Receipt › Landed cost: Estimate → FINAL. The tool says when it is ready (freight paid, duty / C79 in, every line has a landed £).
     After FINAL the figures never change by themselves: a later change (late bill, rate) waits as "Change after FINAL" with
     Accept as adjustment (reason kept) / Keep FINAL.
   - Alerts: ready to FINAL · changed after FINAL · landed per pack up more than the batch alert % on the last batch ·
     margin below target (sell price − marketplace fee − fulfilment − landed). */
/* ---- 1. share freight by ---- */
(function(){const f=FORM_DEFAULTS.shipment;if(!f||f.some(x=>x.k==="freightBasis"))return;const i=f.findIndex(x=>x.k==="rateBasis");f.splice(i<0?f.length:i+1,0,{k:"freightBasis",l:"Share freight over the products by",t:"opts",opts:[["","Auto — the way the forwarder charges"],["cbm","Volume (CBM)"],["kg","Weight (kg, chargeable)"],["value","Goods value (£)"],["qty","Pack count"]]})})();
const lfSplit0=freightSplit;
freightSplit=function(sh){const r=lfSplit0.apply(this,arguments);try{let want=sh&&sh.freightBasis;if(!want&&sh&&sh.rateBasis)want=sh.rateBasis;if(!want||want===r.basis)return r;
  const key={cbm:x=>x.cbm,kg:x=>Math.max(x.kg,x.vol||0),value:x=>x.g,qty:x=>x.q}[want];if(!key)return r;const tot=r.rows.reduce((s,x)=>s+(+key(x)||0),0);
  if(!(tot>0)||r.rows.some(x=>!(+key(x)>0))&&want!=="qty"){r.warn=(r.warn?r.warn+" · ":"")+`"${want}" chosen but some lines have no ${want==="value"?"price":want==="cbm"||want==="kg"?"carton size / weight":"packs"} — shared by ${r.label}`;return r}
  r.rows.forEach(x=>{x.basisVal=+key(x)||0;x.share=x.basisVal/tot});r.basis=want;r.total=tot;r.label={kg:"chargeable weight (kg)",cbm:"volume (cbm)",value:"goods value (£)",qty:"pack count"}[want]+(sh.freightBasis?" (chosen on the shipment)":" (how the forwarder charges)");r.warn="";return r}catch(e){console.warn(e);return r}};
/* ---- 2. FINAL ---- */
function lfReady(r){const out=[];const sh=D.shipments.find(s=>s.no===r.src&&!s.deletedAt);
 if(sh){const ci=shipCostInfo(sh);out.push([ci.gbp>0,"Freight cost on "+sh.no]);out.push([paysFor(sh.no).some(p=>p.status==="paid"),"Freight bill paid"])}
 out.push([r.dutyGbp!=null&&r.dutyGbp!==""||!!r.c79Link||!!r.customsEntryNo,"Duty / C79 entered"]);
 const lps=receiptLanded(r);out.push([lps.length&&lps.every(l=>l.total>0),"Every line has a landed £"]);return out}
function lfBox(r){if(!r)return"";const fin=r.landedFinal;const pend=r.landedPending;const ready=lfReady(r);const allOk=ready.every(x=>x[0]);const may=can("approve")||S.role==="owner";
 let h=`<div class="${fin?"okbox":"warnbox"} lfbox"><b>Landed cost: ${fin?"FINAL":"estimate"}</b>${fin?` — ${fmtD(fin.at.slice(0,10))} by ${esc(fin.by||"")}`:""}`;
 if(!fin)h+=`<div class="lfchk">${ready.map(([ok,t])=>`<span class="pill ${ok?"p-ok":"p-warn"}">${ok?"✓":"…"} ${esc(t)}</span>`).join(" ")}</div>${may?`<div style="margin-top:6px"><button type="button" class="btn sm ${allOk?"pri":""}" data-lf="final" data-id="${esc(r.no)}">${allOk?"Make FINAL":"Make FINAL anyway"}</button>${allOk?"":` <span class="status">not everything is in yet</span>`}</div>`:""}`;
 if(pend)h+=`<div class="lfpend"><b>Changed after FINAL</b> (${esc(pend.why||"")}): ${pend.lines.map(x=>`${esc(product(x.sku)?.name||x.sku)} ${gbp2(x.from)} → <b>${gbp2(x.to)}</b>`).join(" · ")}${may?`<div class="inl" style="flex-wrap:wrap;gap:6px;margin-top:6px"><input id="lf_why" placeholder="Reason (e.g. late AGL bill)" aria-label="Reason for the adjustment" style="min-width:220px;min-height:40px"><button type="button" class="btn sm pri" data-lf="accept" data-id="${esc(r.no)}">Accept as adjustment</button><button type="button" class="btn sm" data-lf="keep" data-id="${esc(r.no)}">Keep FINAL</button></div>`:""}</div>`;
 if((r.landedAdj||[]).length)h+=`<details style="margin-top:6px"><summary>${r.landedAdj.length} adjustment(s) after FINAL</summary>${r.landedAdj.map(a=>`<div class="status">${fmtD(a.at.slice(0,10))} · ${esc(a.by||"")} · ${esc(a.why)} — ${a.lines.map(x=>`${esc(x.sku)} ${gbp2(x.from)} → ${gbp2(x.to)}`).join(", ")}</div>`).join("")}</details>`;
 return h+`</div>`}
const lfOpenRc0=openReceipt;
openReceipt=function(x){const r=lfOpenRc0.apply(this,arguments);try{const rc=x&&typeof x==="object"?x:docOf("receipts",x);if(r&&rc&&!rc.deletedAt)r.body=lfBox(rc)+r.body}catch(e){console.warn(e)}return r};
const lfRecompute0=recomputeLanded;
recomputeLanded=async function(no,why,costNote){const r=D.receipts.find(x=>x.no===no);if(!r||r.deletedAt||!r.landedFinal)return lfRecompute0.apply(this,arguments);
 const lps=receiptLanded(r);let i=0;const diff=[];(r.lines||[]).forEach(l=>{if(!l.sku)return;const lp=lps[i++];if(lp&&Math.abs((+l.landed||0)-lp.total)>0.004)diff.push({sku:l.sku,po:l.po,from:+l.landed||0,to:lp.total})});
 const same=JSON.stringify(r.landedPending?.lines||[])===JSON.stringify(diff);if(same)return;
 await derivedUpdate("receipts",no,{landedPending:diff.length?{at:nowIso(),why:costNote||why||"a cost changed",lines:diff}:null},diff.length?`landed cost would change after FINAL — waiting for a decision`:`change after FINAL no longer needed`,why)};
document.addEventListener("click",async e=>{const b=e.target.closest("[data-lf]");if(!b)return;e.preventDefault();e.stopImmediatePropagation();const no=b.dataset.id;const r=docOf("receipts",no);if(!r)return;if(!(can("approve")||S.role==="owner")){toast("Finance / Owner only");return}
 const by=(typeof uid!=="undefined"&&uid)||S.role;
 if(b.dataset.lf==="final"){/* bring the lines up to date first, then freeze */await lfRecompute0(no,"before FINAL");await updateDoc("receipts",no,{landedFinal:{at:nowIso(),by},landedPending:null},`${no} landed cost FINAL`);toast(no+" landed cost is FINAL");render();return}
 if(b.dataset.lf==="accept"){const why=String($("#lf_why")?.value||"").trim();if(why.length<3){toast("Write the reason");$("#lf_why")?.focus();return}const pend=r.landedPending;if(!pend)return;
  const lines=(r.lines||[]).map(l=>{const x=pend.lines.find(y=>y.sku===l.sku&&y.po===l.po);return x?{...l,landed:x.to}:l});
  await updateDoc("receipts",no,{lines,landedPending:null,landedAdj:[...(r.landedAdj||[]),{at:nowIso(),by,why,lines:pend.lines}]},`${no} landed cost adjusted after FINAL — ${why}`);toast("Adjustment saved");render();return}
 if(b.dataset.lf==="keep"){await updateDoc("receipts",no,{landedPending:null},`${no} kept the FINAL landed cost`);render()}},true);
/* ---- 3. alerts ---- */
function lfMargin(sku,landed){const p=product(sku);if(!p||!(+p.sellGbp>0)||!(landed>0))return null;const ch=items("marketplace").find(m=>m.id===p.channel)||items("marketplace")[0]||{};const fee=+p.sellGbp*(+ch.feePct||0)/100;const ful=+ch.fulfilGbp||0;const m=+p.sellGbp-fee-ful-landed;return{pct:m/+p.sellGbp*100,m,ch:ch.label||""}}
if(typeof attention==="function"){const lfAtt0=attention;attention=function(){const out=lfAtt0.apply(this,arguments);try{const T=today();
 live(D.receipts).forEach(r=>{if(r.landedPending)out.push({sev:2,text:`${r.no} landed cost changed after FINAL — accept or keep`,col:"receipts",id:r.no,d:T});
  else if(!r.landedFinal&&r.date&&diffDays(r.date,T)>=14&&lfReady(r).every(x=>x[0]))out.push({sev:1,text:`${r.no} landed cost is ready to make FINAL`,col:"receipts",id:r.no,d:T})});
 /* landed up on the last batch, and margin below target – per product, from its two latest receipts */
 const per={};live(D.receipts).slice().sort((a,b)=>(a.date||"")<(b.date||"")?-1:1).forEach(r=>(r.lines||[]).forEach(l=>{if(l.sku&&+l.landed>0)(per[l.sku]=per[l.sku]||[]).push({r,l})}));
 const lim=+(FEES().batchAlertPct||10),tgt=+(DEF().targetMarginPct||30);
 Object.entries(per).forEach(([sku,L_])=>{const last=L_[L_.length-1],prev=L_.length>1?L_[L_.length-2]:null;if(!last.r.date||diffDays(last.r.date,T)>180)return;/* only recent batches – old ones are history, not alerts */
  if(prev&&prev.r.no!==last.r.no){const up=(+last.l.landed-+prev.l.landed)/+prev.l.landed*100;if(up>lim)out.push({sev:1,text:`${product(sku)?.name||sku}: landed ${gbp2(last.l.landed)} per pack, ${up.toFixed(0)}% above the batch before (${gbp2(prev.l.landed)})`,col:"products",id:sku,d:T})}
  const mg=lfMargin(sku,+last.l.landed);if(mg&&mg.pct<tgt&&product(sku)?.status!=="archived")out.push({sev:mg.pct<0?2:1,text:`${product(sku)?.name||sku}: margin ${mg.pct.toFixed(0)}% (target ${tgt}%) — sell ${gbp2(product(sku).sellGbp)}, landed ${gbp2(last.l.landed)}${mg.ch?", "+mg.ch+" fees":""}`,col:"products",id:sku,d:T})})}catch(e){console.warn(e)}return out}}
(function(){try{const st=document.createElement("style");st.textContent=`.lfbox{margin-bottom:8px}.lfchk{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.lfpend{margin-top:8px;padding-top:6px;border-top:1px dashed var(--line,#ddd)}.okbox{background:var(--okbg,#eef8f0);border:1px solid var(--ok,#2e7d32);border-radius:10px;padding:10px 12px}`;document.head.appendChild(st)}catch(_){}})();
/* editing a FINAL receipt (Receive form) never moves its landed £ silently: the old figures stay, the new ones wait as a change after FINAL */
const lfWrite0=writeDoc;
writeDoc=function(col,id,data,labelTxt,opts){try{if(col==="receipts"&&data&&Array.isArray(data.lines)){const old=docOf("receipts",id);if(old&&old.landedFinal&&!old.deletedAt){const diff=[];
  data.lines=data.lines.map(l=>{const o=(old.lines||[]).find(x=>x.sku===l.sku&&x.po===l.po);if(o&&l.sku&&Math.abs((+l.landed||0)-(+o.landed||0))>0.004){diff.push({sku:l.sku,po:l.po,from:+o.landed||0,to:+l.landed||0});return{...l,landed:o.landed}}return l});
  data.landedFinal=old.landedFinal;data.landedAdj=old.landedAdj||[];if(diff.length)data.landedPending={at:nowIso(),why:"receipt edited",lines:diff}}}}catch(e){console.warn(e)}return lfWrite0.apply(this,arguments)};
