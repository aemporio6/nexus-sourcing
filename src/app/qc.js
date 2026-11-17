/* ---------- QC checklist inside the Inspection (owner, 17 Nov 2026 – item 3) ----------
   - The checklist fills itself: the last checklist used for any product of this order (so each product keeps "its" checks),
     else the standard list. Each check: Pass / Fail / N/A, note, photo (📷 uploads to Drive).
   - A Fail needs a note and a photo. Any Fail → result suggests "Fail" (which already puts the order on hold);
     all pass with a note → "Pass with remarks"; all pass → "Pass".
   - On a Fail: a task "QC failed" for whoever books inspections, a "Claim from supplier" button (Credit note with the order
     and the failed checks), and "Book re-inspection". A re-inspection that passes closes the task by itself. */
const QC_STD=["Colour / design matches the approved sample","Size and dimensions","Material and finish","Works / assembles correctly","Inner pack / polybag / suffocation warning","Barcode / FNSKU label scans (right SKU)","Carton marks and shipping labels","Carton count and packs per carton","Carton weight / drop test","Accessories and manual complete"];
ROWS.qcChecks={cls:"c3 qcrow",add:"+ Check",cols:[{k:"item",t:"text",l:"Check"},{k:"res",t:"opts",opts:[["","—"],["pass","Pass"],["fail","Fail"],["na","N/A"]],l:"Result"},{k:"note",t:"text",l:"Note (what is wrong)"}]};
(function(){const f=FORM_DEFAULTS.inspection;if(!f||f.some(x=>x.k==="checks"))return;const i=f.findIndex(x=>x.k==="result");f.splice(i<0?f.length:i,0,{k:"checks",l:"QC checklist",t:"rows",w:1,rows:"qcChecks"})})();
function qcTemplate(poNo){const po=D.purchases.find(p=>p.no===poNo);const skus=new Set((po?.lines||[]).map(l=>l.sku).filter(Boolean));
 const prev=live(D.inspections).filter(i=>(i.checks||[]).length&&i.po!==undefined).map(i=>({i,po:D.purchases.find(p=>p.no===i.po)})).filter(x=>x.po&&(x.po.lines||[]).some(l=>skus.has(l.sku))).sort((a,b)=>((a.i.date||a.i.plannedDate||"")<(b.i.date||b.i.plannedDate||""))?1:-1)[0];
 if(prev)return{from:prev.i.no,rows:prev.i.checks.map(c=>({item:c.item,res:"",note:"",photo:""}))};return{from:null,rows:QC_STD.map(item=>({item,res:"",note:"",photo:""}))}}
const qcInit0=initInsp;
initInsp=function(ctx){const r=qcInit0.apply(this,arguments);try{const d=S.drawer;if(!ctx.edit&&d&&!(d.rows.checks||[]).length){const po=val("po")||ctx.po||(ctx.reOf&&D.inspections.find(i=>i.no===ctx.reOf)?.po);const t=qcTemplate(po);
  /* a re-inspection starts from the failed checks of the first one */const first=ctx.reOf&&D.inspections.find(i=>i.no===ctx.reOf);d.rows.checks=first&&(first.checks||[]).length?first.checks.map(c=>({item:c.item,res:"",note:c.res==="fail"?"was: "+(c.note||"fail"):"",photo:""})):t.rows;d.qcFrom=first?first.no:t.from;redrawRows("checks")}}catch(e){console.warn(e)}return r};
/* picking the order later refills an untouched checklist */
document.addEventListener("change",e=>{const d=S.drawer;if(!d||d.form!=="inspection")return;if(e.target.id==="f_po"){const rows=d.rows.checks||[];if(!rows.some(r=>r.res||r.note||r.photo)){const t=qcTemplate(val("po"));d.rows.checks=t.rows;d.qcFrom=t.from;redrawRows("checks")}}
 if(e.target.matches?.('[data-row="checks"]'))setTimeout(qcSuggest,50)});
function qcSuggest(){const d=S.drawer;if(!d||d.form!=="inspection"||touched("result"))return;const rows=(d.rows.checks||[]).filter(r=>r.item);if(!rows.length||rows.some(r=>!r.res))return;const fail=rows.some(r=>r.res==="fail");const rem=rows.some(r=>r.res==="pass"&&String(r.note||"").trim());setv("result",fail?"fail":rem?"pass_remarks":"pass",true);if(!val("date"))setv("date",today(),true);if(!touched("defects")&&fail)setv("defects",rows.filter(r=>r.res==="fail").length,true)}
/* 📷 per check: upload a photo to Drive and put its link on the row */
const qcRowHtml0=rowHtml;
rowHtml=function(k,spec,r,i){let h=qcRowHtml0.apply(this,arguments);if(k!=="checks")return h;
 return h.replace('<span class="rx">',`<span class="rx"><label class="x qcph" title="Add photo" aria-label="Add photo for check ${i+1}">${r.photo?"✅":"📷"}<input type="file" accept="image/*" capture="environment" data-qcph="${i}" hidden></label>`)+(i===0&&S.drawer?.qcFrom?`<div class="status qcfrom">Checks copied from ${esc(S.drawer.qcFrom)} (last inspection of these products) — add or remove as needed.</div>`:"")};
document.addEventListener("change",async e=>{const inp=e.target.closest?.("[data-qcph]");if(!inp||!inp.files?.length)return;const i=+inp.dataset.qcph;const d=S.drawer;if(!d)return;toast("Uploading photo…");
 try{const up=await uploadFile(inp.files[0]);const id=String(up||"").replace(/^drive:/,"");const link=/^a[0-9a-z]+$/.test(id)?up:"https://drive.google.com/file/d/"+id+"/view";d.rows.checks[i].photo=link;redrawRows("checks");d.dirty=true;toast("Photo added")}catch(err){toast("Photo not uploaded: "+err.message)}},true);
/* a Fail needs a note and a photo */
const qcVal0=validateInsp;
validateInsp=function(o){const r=qcVal0.apply(this,arguments);try{const rows=(o.checks||[]).filter(c=>c.item);rows.forEach(c=>{if(c.res==="fail"&&(!String(c.note||"").trim()||!String(c.photo||"").trim()))r.errors.checks=`"${c.item}" failed — add a note and a photo (📷)`});
 if(rows.some(c=>c.res==="fail")&&o.result&&!item("inspResult",o.result)?.blocks&&o.result!=="pending")r.warnings.push("A check failed but the result is not Fail — sure?")}catch(_){}return r};
/* after saving: task on Fail, closed by a passing re-inspection */
const qcSave0=saveInsp;
saveInsp=async function(){const no0=S.drawer?.ctx?.edit?.no||val("no");const r=await qcSave0.apply(this,arguments);try{const i=D.inspections.find(x=>x.no===no0);if(!i||i.deletedAt)return r;const fail=!!item("inspResult",i.result)?.blocks;
  const open=live(D.tasks||[]).filter(t=>t.kind==="qc"&&t.status!=="done");
  if(fail&&!open.some(t=>t.ref===i.no)){const tn=nextNo("tasks",today());const failed=(i.checks||[]).filter(c=>c.res==="fail").map(c=>c.item);await writeDoc("tasks",tn,{no:tn,id:tn,title:`QC failed on ${i.po}: ${failed.join(", ")||"see "+i.no} — claim / re-inspect`,who:uid,due:addDays(today(),3),ref:i.no,status:"todo",by:uid,at:nowIso(),kind:"qc"},"QC task")}
  if(!fail&&i.result&&i.result!=="pending"&&i.reInspectionOf){for(const t of open.filter(t=>t.ref===i.reInspectionOf))await updateDoc("tasks",t.no,{status:"done",doneAt:nowIso(),doneNote:`re-inspection ${i.no} ${L("inspResult",i.result)}`},`${t.no} closed by ${i.no}`,{quiet:true})}}catch(e){console.warn(e)}return r};
/* the inspection record: checklist, Claim and Re-inspect */
const qcOpen0=openInsp;
openInsp=function(x){const r=qcOpen0.apply(this,arguments);try{const i=x&&typeof x==="object"?x:docOf("inspections",x);if(!r||!i)return r;const rows=(i.checks||[]).filter(c=>c.item);const fail=!!item("inspResult",i.result)?.blocks;
  const tbl_=rows.length?`<div class="card" style="margin:8px 0;padding:8px 12px"><b>QC checklist</b> <span class="status">${rows.filter(c=>c.res==="pass").length} pass · ${rows.filter(c=>c.res==="fail").length} fail · ${rows.filter(c=>c.res==="na").length} n/a</span>${rows.map(c=>`<div class="qcline"><span class="pill ${c.res==="fail"?"p-bad":c.res==="pass"?"p-ok":"p-info"}">${esc(c.res?c.res.toUpperCase():"—")}</span> ${esc(c.item)}${c.note?` <span class="status">— ${esc(c.note)}</span>`:""}${c.photo?` ${/^https?:/.test(c.photo)?`<a href="${esc(c.photo)}" target="_blank" rel="noopener">📷 photo</a>`:"📷"}`:""}</div>`).join("")}</div>`:"";
  const acts=fail?`<div class="warnbox" style="margin:8px 0">QC failed — the order is on hold.<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">${can("create")?`<button type="button" class="btn sm pri" data-qc="claim" data-id="${esc(i.no)}">Claim from supplier</button><button type="button" class="btn sm" data-qc="re" data-id="${esc(i.no)}">Book re-inspection</button>`:""}</div></div>`:"";
  r.body=acts+tbl_+r.body}catch(e){console.warn(e)}return r};
document.addEventListener("click",e=>{const b=e.target.closest("[data-qc]");if(!b)return;e.preventDefault();e.stopImmediatePropagation();const i=docOf("inspections",b.dataset.id);if(!i)return;
 if(b.dataset.qc==="re"){openForm("inspection",{reOf:i.no,po:i.po});return}
 if(b.dataset.qc==="claim"){const failed=(i.checks||[]).filter(c=>c.res==="fail");openForm("credit",{po:i.po});setTimeout(()=>{try{const rs=items("creditReason");const q=rs.find(x=>/qual|defect|damag/i.test(x.id+" "+x.label));if(q)setv("reason",q.id);setv("notes",`QC ${i.no}: `+failed.map(c=>`${c.item}${c.note?" ("+c.note+")":""}`).join("; "))}catch(_){}},500)}},true);
(function(){try{const st=document.createElement("style");st.textContent=`.qcline{padding:3px 0}.ln.qcrow{grid-template-columns:minmax(0,2.2fr) minmax(90px,.8fr) minmax(0,1.6fr) auto!important}.ln.qcrow .rx{display:flex;gap:2px;align-items:center}.qcph{cursor:pointer;display:inline-flex;align-items:center;justify-content:center}`;document.head.appendChild(st)}catch(_){}})();
