/* ---------- Navigation bar inside every form and every record (owner, 12 Nov 2026) ----------
   Forms:   ‹ Back · › Forward · ↶ Undo · ↷ Redo (this form's typing) · ↻ Reset · 🕘 Recent
   Records: ‹ Back · › Forward · ↶ Undo · ↷ Redo (last saved change) · ↻ Refresh (sync now) · 🕘 Recent
   Closing / Back from a form opened on a record returns to that record (not to the whole list).
   Text fields suggest what was typed before in the same field (browser list). */
const FN_COL={purchase:"purchases",shipment:"shipments",payment:"payments",inspection:"inspections",receive:"receipts",move:"moves",count:"moves",credit:"credits",product:"products",party:"parties"};
/* ---- form snapshot (same shape as a draft) ---- */
function fnSnap(){const d=S.drawer;if(!d?.form)return null;const o={};fields(d.form).forEach(f=>{if(f.role&&!can(f.role))return;if(f.t==="rows")o[f.k]=JSON.parse(JSON.stringify(d.rows[f.k]||[]));else if(f.t==="dims")o[f.k]=dims(f.k);else if(f.t!=="file"&&f.t!=="reftext"&&f.t!=="ro")o[f.k]=val(f.k)});return o}
function fnSame(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function fnApply(v){const d=S.drawer;if(!d?.form||!v)return;d._fnApplying=true;try{fields(d.form).forEach(f=>{if(!(f.k in v))return;if(f.t==="rows"){d.rows[f.k]=JSON.parse(JSON.stringify(v[f.k]||[]));redrawRows(f.k)}else if(f.t==="dims")setDims(f.k,v[f.k]);else{setv(f.k,v[f.k]??"");d.touched[f.k]=true}});d.dirty=true;
  const sync={purchase:()=>syncPurchase(),shipment:()=>syncShip(),payment:()=>syncPay(),receive:()=>syncReceive(true),move:()=>syncMove(),product:()=>syncProduct(),party:()=>syncParty()}[d.form];try{sync&&sync()}catch(_){}
  try{saveDraft()}catch(_){}}finally{d._fnApplying=false}fnPaint()}
/* record a step: called (debounced) after every change in the form */
let fnT=null;
function fnRecord(){const d=S.drawer;if(!d?.form||d._fnApplying)return;const now=fnSnap();if(!now)return;if(!d.fcur){d.fcur=now;return}if(fnSame(now,d.fcur))return;d.fu=d.fu||[];d.fu.push(d.fcur);if(d.fu.length>60)d.fu.shift();d.fr=[];d.fcur=now;fnPaint()}
function fnFlush(){if(fnT){clearTimeout(fnT);fnT=null;fnRecord()}}
function fnUndo(){const d=S.drawer;if(!d?.form)return undo();fnFlush();if(!d.fu?.length)return toast("Nothing to undo in this form");d.fr=d.fr||[];d.fr.push(fnSnap());const v=d.fu.pop();d.fcur=v;fnApply(v);toast("Undone (form)")}
function fnRedo(){const d=S.drawer;if(!d?.form)return redo();fnFlush();if(!d.fr?.length)return toast("Nothing to redo in this form");d.fu=d.fu||[];d.fu.push(fnSnap());const v=d.fr.pop();d.fcur=v;fnApply(v);toast("Redone (form)")}
function fnReset(){const d=S.drawer;if(!d?.form)return;if(d.dirty&&!d._resetAsk){d._resetAsk=true;toast("Press ↻ Reset again to throw away what you typed and start this form fresh");setTimeout(()=>{if(S.drawer)S.drawer._resetAsk=false},5000);return}
 const form=d.form,ctx={...d.ctx};try{clearDraft(form,ctx)}catch(_){}d.dirty=false;openForm(form,{...ctx,force:true});toast("Form reset")}
/* ---- where the form came from (so Back / Close return there) ---- */
const fnOpenForm0=openForm;
openForm=function(form,ctx={}){const prev=S.drawer;let from=ctx._from||null;if(!from&&prev&&!prev.form&&prev.col)from={col:prev.col,id:prev.id};if(!from&&prev?.form&&prev.ctx?._from&&ctx.force)from=prev.ctx._from;
 const r=fnOpenForm0(form,from?{...ctx,_from:from}:ctx);setTimeout(()=>{const d=S.drawer;if(d?.form===form){d.fu=d.fu||[];d.fr=d.fr||[];d.fcur=fnSnap();fnPaint()}},700);return r};
const fnClose0=closeDrawer;
closeDrawer=function(force){const d=S.drawer;const from=d?.form&&!d.ctx?.returnTo?.stash?d.ctx?._from:null;const ok=fnClose0(force);if(ok&&from&&docOf(from.col,from.id)&&!S.drawer){S.drawer={col:from.col,id:from.id};render();mirrorHash()}return ok};
/* Back: a form goes back to where it was opened from; a record steps back in history; with no history, close */
function fnBack(){const d=S.drawer;if(d?.form){closeDrawer();return}if(S.hi>0)return back();if(d)closeDrawer()}
function fnFwd(){if(S.drawer?.form){if(!confirmDirty())return;S.drawer.dirty=false;closeDrawer(true)}fwd()}
async function fnRefresh(){try{if(window.MYTOOL&&MYTOOL.syncNow){toast("Refreshing…");await MYTOOL.syncNow()}}catch(_){}render();toast("Up to date")}
/* ---- the bar ---- */
function fnRecentHtml(){let r=[];try{r=recentList().filter(x=>!(S.drawer&&x.col===S.drawer.col&&x.id===S.drawer.id)).slice(0,10)}catch(_){}
 return`<details class="fn-rec"><summary class="btn sm" title="Recently opened records">🕘 Recent</summary><div class="fn-recl">${r.length?r.map(x=>`<button type="button" class="btn sm" data-act="fnrecent" data-col="${esc(x.col)}" data-id="${esc(x.id)}">${esc(x.id)} <span class="status">${esc(COL_LABEL[x.col]||x.col)}</span></button>`).join(""):`<span class="status">Nothing yet</span>`}</div></details>`}
function fnBar(isForm){const d=S.drawer||{};const u=isForm?(d.fu||[]).length:S.undo.length,rd=isForm?(d.fr||[]).length:S.redo.length;
 return`<span class="fn-bar" role="toolbar" aria-label="${isForm?"Form":"Record"} navigation"><button type="button" class="btn sm" data-act="fnback" title="Back (Alt+←)" aria-label="Back">‹ Back</button><button type="button" class="btn sm" data-act="fnfwd" title="Forward (Alt+→)" aria-label="Forward" ${S.hi<S.hist.length-1?"":"disabled"}>›</button><button type="button" class="btn sm" data-act="fnundo" id="fn_u" title="${isForm?"Undo typing in this form":"Undo the last saved change"} (Ctrl+Z)" ${u?"":"disabled"}>↶ Undo</button><button type="button" class="btn sm" data-act="fnredo" id="fn_r" title="${isForm?"Redo in this form":"Redo"} (Ctrl+Y)" ${rd?"":"disabled"}>↷ Redo</button>${isForm?`<button type="button" class="btn sm" data-act="fnreset" title="Start this form fresh">↻ Reset</button>`:`<button type="button" class="btn sm" data-act="fnrefresh" title="Get the latest data now">↻ Refresh</button>`}${fnRecentHtml()}</span>`}
function fnPaint(){const d=S.drawer;if(!d)return;const u=$("#fn_u"),r=$("#fn_r");if(d.form){if(u)u.disabled=!(d.fu||[]).length;if(r)r.disabled=!(d.fr||[]).length}else{if(u)u.disabled=!S.undo.length;if(r)r.disabled=!S.redo.length}}
const fnFormShell0=formShell;
formShell=function(form){const h=fnFormShell0(form);return h.replace('<div class="dtop">','<div class="dtop">'+fnBar(true))};
const fnDrawerNav0=drawerNav;
drawerNav=function(d){const h=fnDrawerNav0(d);return h.replace('<div class="dtop">','<div class="dtop">'+fnBar(false))};
/* ---- suggestions: what was typed before in the same field ---- */
const FN_NOSUG=new Set(["notes","note","desc","yourRef","piNo","no","id","oldRef","email","url","password","account","iban","sortCode"]);
function fnSuggest(form,k){const col=FN_COL[form];if(!col||FN_NOSUG.has(k))return[];const seen=new Map();(D[col]||[]).filter(x=>!x.deletedAt).slice(-400).reverse().forEach(x=>{const v=x[k]??x.custom?.[k];if(typeof v==="string"){const t=v.trim();if(t&&t.length<=80&&!seen.has(t.toLowerCase()))seen.set(t.toLowerCase(),t)}});return[...seen.values()].slice(0,30)}
const fnInputFor0=inputFor;
inputFor=function(f,id,v,attrs=""){if(f.t==="text"&&S.drawer?.form&&id==="f_"+f.k){const s=fnSuggest(S.drawer.form,f.k);if(s.length){const dl="dl_"+f.k;return fnInputFor0(f,id,v,attrs+` list="${dl}" autocomplete="off"`)+`<datalist id="${dl}">${s.map(x=>`<option value="${esc(x)}">`).join("")}</datalist>`}}return fnInputFor0(f,id,v,attrs)};
/* ---- events ---- */
document.addEventListener("input",e=>{if(!S.drawer?.form||!e.target.closest?.(".drawer"))return;clearTimeout(fnT);fnT=setTimeout(()=>{fnT=null;fnRecord()},450)},true);
document.addEventListener("change",e=>{if(!S.drawer?.form||!e.target.closest?.(".drawer"))return;clearTimeout(fnT);fnT=setTimeout(()=>{fnT=null;fnRecord()},150)},true);
document.addEventListener("click",e=>{const t=e.target.closest("[data-act]");if(!t)return;const a=t.dataset.act;
 if(a==="addrow"||a==="rmrow"){setTimeout(fnRecord,200);return}
 const m={fnback:fnBack,fnfwd:fnFwd,fnundo:fnUndo,fnredo:fnRedo,fnreset:fnReset,fnrefresh:fnRefresh};
 if(m[a]){e.preventDefault();e.stopPropagation();m[a]();return}
 if(a==="fnrecent"){e.preventDefault();e.stopPropagation();const col=t.dataset.col,id=t.dataset.id;if(S.drawer?.form){if(!confirmDirty())return;S.drawer.dirty=false;S.drawer=null}openDoc(col,id)}},true);
/* Ctrl+Z / Ctrl+Y inside a form (outside a text box) = form undo / redo; Alt+← / Alt+→ = Back / Forward */
document.addEventListener("keydown",e=>{if(!S.drawer)return;const inText=/^(INPUT|TEXTAREA)$/.test(e.target.tagName)&&!/^(checkbox|radio|button)$/.test(e.target.type||"");
 if(e.altKey&&e.key==="ArrowLeft"){e.preventDefault();fnBack();return}if(e.altKey&&e.key==="ArrowRight"){e.preventDefault();fnFwd();return}
 if(S.drawer.form&&!inText&&(e.ctrlKey||e.metaKey)&&!e.altKey){const k=e.key.toLowerCase();if(k==="z"&&!e.shiftKey){e.preventDefault();fnUndo()}else if(k==="y"||(k==="z"&&e.shiftKey)){e.preventDefault();fnRedo()}}},true);
(function(){try{const st=document.createElement("style");st.textContent=`.fn-bar{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:0 0 6px;width:100%}.fn-bar .btn.sm{min-height:40px;min-width:40px}.fn-rec{position:relative}.fn-rec>summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:4px}.fn-rec>summary::-webkit-details-marker{display:none}.fn-recl{position:absolute;z-index:30;top:38px;left:0;min-width:220px;max-width:80vw;background:var(--card,#fff);border:1px solid var(--line,#ddd);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:6px;display:flex;flex-direction:column;gap:4px}.fn-recl .btn{justify-content:space-between;text-align:left}.dtop{flex-wrap:wrap}`;document.head.appendChild(st)}catch(_){}})();
