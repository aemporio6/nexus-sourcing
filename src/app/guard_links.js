/* ---------- Records that other records depend on cannot be trashed by accident ----------
   Before a record goes to Trash, MY TOOL lists everything that still hangs on it (payments allocated to an order, shipments carrying it,
   receipts / stock moves made from it, orders of a product or party). The user sees the list and decides; the record itself is never
   changed. The check runs at the write boundary (trashDoc), so every path — drawer menu, bulk bar, keyboard — goes through it. */
function dependantsOf(col,id){const dep=[];const add=(c,x,why)=>{if(x&&!x.deletedAt)dep.push({col:c,id:x.no||x.id,why})};
 const pays=ref=>live(D.payments).filter(p=>(p.allocations||[]).some(a=>a.ref===ref)).forEach(p=>add("payments",p,"money allocated"));
 if(col==="purchases"){pays(id);live(D.shipments).filter(s=>(s.lines||[]).some(l=>l.po===id)||(s.purchases||[]).includes(id)).forEach(s=>add("shipments",s,"carries this order"));live(D.receipts).filter(r=>(r.pos||[]).includes(id)||(r.lines||[]).some(l=>l.po===id)).forEach(r=>add("receipts",r,"received from it"));live(D.inspections).filter(i=>i.po===id).forEach(i=>add("inspections",i,"inspection"));live(D.credits).filter(c=>c.po===id).forEach(c=>add("credits",c,"credit note"));live(D.purchases).filter(p=>p.partOf===id||p.samePiAs===id).forEach(p=>add("purchases",p,"part of this PI"))}
 if(col==="shipments"){pays(id);live(D.receipts).filter(r=>r.src===id).forEach(r=>add("receipts",r,"received from it"))}
 if(col==="receipts"){live(D.moves).filter(m=>m.receipt===id&&!m.auto).forEach(m=>add("moves",m,"stock move"));live(D.credits).filter(c=>c.receipt===id).forEach(c=>add("credits",c,"credit note"))}
 if(col==="inspections"){pays(id);live(D.inspections).filter(i=>i.reInspectionOf===id).forEach(i=>add("inspections",i,"re-inspection"))}
 if(col==="credits")pays(id);
 if(col==="products"){live(D.purchases).filter(p=>(p.lines||[]).some(l=>l.sku===id)).forEach(p=>add("purchases",p,"ordered"));live(D.moves).filter(m=>m.sku===id||(m.lines||[]).some(l=>l.sku===id)).slice(0,5).forEach(m=>add("moves",m,"stock"))}
 if(col==="parties"){live(D.purchases).filter(p=>p.party===id).forEach(p=>add("purchases",p,"order"));live(D.shipments).filter(s=>s.party===id).forEach(s=>add("shipments",s,"shipment"));live(D.payments).filter(p=>p.party===id).forEach(p=>add("payments",p,"payment"));live(D.inspections).filter(i=>i.party===id).forEach(i=>add("inspections",i,"inspection"))}
 return dep}
trashDoc=(function(orig){return async function(col,id,labelTxt){
 if(!S.batch||!S.batch.force){const dep=dependantsOf(col,id);
  if(dep.length){const list=dep.slice(0,8).map(d=>`${d.id} (${d.why})`).join(", ")+(dep.length>8?` … and ${dep.length-8} more`:"");
   const ok=typeof confirm==="function"&&!S.quietGuard?confirm(`${id} is still used by ${dep.length} record${dep.length>1?"s":""}:\n${list}\n\nThey will keep pointing at a trashed record. Move ${id} to Trash anyway?`):false;
   if(!ok){toast(`${id} not trashed — ${dep.length} record${dep.length>1?"s":""} depend on it (${dep.slice(0,3).map(d=>d.id).join(", ")}${dep.length>3?"…":""})`,{ms:7000});try{recordAppError&&recordAppError(`guard: trash refused ${col}/${id} — ${dep.length} dependants`)}catch(_){}return false}}}
 return orig.call(this,col,id,labelTxt)}})(trashDoc);
