/* ---------- Fine access: any area, any field — Edit · View only · Hidden (owner, 20 Nov 2026) ----------
   On top of the ticks, the Owner can set for each person:
   - every AREA (Buying, Shipments, Money, Stock, Products, Suppliers, QC, Credit notes): Edit · View only · Hidden
   - every FIELD of every form, also the columns inside lines (unit price, amount …): Edit · View only · Hidden
   The lists come from the forms themselves, so a new field or module appears here by itself.
   Enforced twice: here (hidden things are not drawn, view-only is greyed, a save never changes them) and at the data
   gateway (hidden areas / fields are not even sent to that person's device; changes to view-only ones are put back). */
const A3_AREAS=[["purchases","Buying (orders)"],["shipments","Shipments"],["payments","Money (payments)"],["receipts","Stock (goods received)"],["moves","Stock (movements / counts)"],["products","Products"],["parties","Suppliers / parties"],["inspections","Quality checks"],["credits","Credit notes"]];
const A3_PAGE={purchases:"purchases",shipments:"shipments",payments:"payments",products:"products",parties:"parties",stock:"receipts"};
function a3User(){return S.isOwner||S.role!==S.realRole?null:curUser()}
function a3Area(col,u){u=u===undefined?a3User():u;return u&&u.areas&&u.areas[col]||"edit"}
function a3Field(col,key,u){u=u===undefined?a3User():u;return u&&u.fields&&u.fields[col+"."+key]||"edit"}
/* forms: hidden fields are not drawn, view-only are greyed; values are kept on save */
const a3Field0=fieldHtml;
fieldHtml=function(f,v){try{const col=FORM_COL[S.drawer?.form];if(col&&f.t!=="rows"){const m=a3Field(col,f.k);if(m==="hide")return"";if(m==="view"){const h=a3Field0.apply(this,arguments);return h.replace(/<(input|select|textarea)(?![^>]*\bdisabled\b)/g,"<$1 disabled data-a3ro").replace(/<button[^>]*class="fadd"[\s\S]*?<\/button>/g,"").replace("</label>",' <span class="status">view only</span></label>')}}}catch(_){}return a3Field0.apply(this,arguments)};
const a3Row0=rowCell;
rowCell=function(k,c,r,i){try{const col=FORM_COL[S.drawer?.form];if(col){const m=a3Field(col,k+"."+c.k);if(m==="hide")return`<input disabled value="•••" aria-label="${esc(c.l)} (hidden)" title="${esc(c.l)} — hidden for you">`;if(m==="view")return a3Row0.apply(this,arguments).replace(/<(input|select|textarea)(?![^>]*\bdisabled\b)/g,"<$1 disabled data-a3ro")}}catch(_){}return a3Row0.apply(this,arguments)};
const a3Collect0=collect;
collect=function(form){const o=a3Collect0.apply(this,arguments);try{const u=a3User();const col=FORM_COL[form];if(!u||!u.fields||!col)return o;const old=S.drawer?.ctx?.edit||null;Object.entries(u.fields).forEach(([path,m])=>{if(!path.startsWith(col+".")||m==="edit")return;const ks=path.slice(col.length+1).split(".");
  if(ks.length===1){if(old)o[ks[0]]=old[ks[0]];else delete o[ks[0]]}else if(Array.isArray(o[ks[0]])){const was=old&&Array.isArray(old[ks[0]])?old[ks[0]]:[];o[ks[0]].forEach((row,i)=>{const w=was.find(x=>x&&row&&x.sku&&x.sku===row.sku)||was[i];if(w)row[ks[1]]=w[ks[1]];else delete row[ks[1]]})}})}catch(e){console.warn("a3 collect",e)}return o};
/* areas: no form, no save, no page for what is view-only / hidden */
const a3Open0=openForm;
openForm=function(form,ctx){try{const col=FORM_COL[form];const m=col?a3Area(col):"edit";if(m!=="edit"){toast(m==="hide"?"This area is not available for you":"This area is view-only for you — the Owner can allow editing");if(typeof r2AskBar==="function")r2AskBar("area:"+col,"edit "+(A3_AREAS.find(a=>a[0]===col)?.[1]||col));return}}catch(_){}return a3Open0.apply(this,arguments)};
const a3Write0=writeDoc,a3Upd0=updateDoc;
writeDoc=function(col,id,data,labelTxt,opts){if(!(opts&&(opts.derived||opts.noUndo))&&a3Area(col)!=="edit"){toast("Not saved — this area is view-only for you");return Promise.resolve(false)}return a3Write0.apply(this,arguments)};
updateDoc=function(col,id,patch,labelTxt,opts){if(!(opts&&(opts.derived||opts.noUndo))&&a3Area(col)!=="edit"){toast("Not saved — this area is view-only for you");return Promise.resolve(false)}return a3Upd0.apply(this,arguments)};
VIEWS=(o=>()=>{const m=o();const u=a3User();if(!u||!u.areas)return m;const out={...m};Object.entries(A3_PAGE).forEach(([page,col])=>{if(u.areas[col]==="hide"&&out[page])out[page]=v=>{v.innerHTML=`<div class="card empty">This area is not available for you. <button type="button" class="btn sm" data-r2ask="area:${col}" data-what="see ${esc(A3_AREAS.find(a=>a[0]===col)?.[1]||col)}">Ask the Owner</button></div>`}});return out})(VIEWS);
nav=(function(orig){return function(){orig.apply(this,arguments);try{const u=a3User();if(!u||!u.areas)return;Object.entries(A3_PAGE).forEach(([page,col])=>{if(u.areas[col]==="hide")document.querySelectorAll(`[data-nav="${page}"]`).forEach(el=>{el.hidden=true;el.style.display="none"})})}catch(_){}}})(nav);
/* ---- the Owner's screen: under each person's ticks ---- */
function a3FieldList(){const out=[];Object.entries(FORM_COL).forEach(([form,col])=>{if(form==="count")return;let fs=[];try{fs=fields(form)}catch(_){}fs.forEach(f=>{if(f.t==="ro"||f.t==="calc"||!f.l)return;if(f.t==="rows"){const R=ROWS[f.rows]||{};(R.cols||[]).concat(R.more||[]).forEach(c=>{if(c.l)out.push({col,form,key:f.k+"."+c.k,label:`${f.l||f.k} › ${c.l}`})})}else out.push({col,form,key:f.k,label:f.l})})});return out}
function a3Sel(path,cur,lab){return`<select data-a3="${esc(path)}" aria-label="${esc(lab)}" class="a3s a3-${cur}"><option value="edit" ${cur==="edit"?"selected":""}>Edit</option><option value="view" ${cur==="view"?"selected":""}>View only</option><option value="hide" ${cur==="hide"?"selected":""}>Hidden</option></select>`}
function a3CardHtml(u,i){const areas=A3_AREAS.map(([c,l])=>`<label class="a3r"><span>${esc(l)}</span>${a3Sel(`${i}|areas|${c}`,a3Area(c,u),l)}</label>`).join("");const nA=Object.values(u.areas||{}).filter(x=>x!=="edit").length,nF=Object.values(u.fields||{}).filter(x=>x!=="edit").length;
 const open=S.a3Open&&S.a3Open.i===i?S.a3Open:null;const fl=open?a3FieldList().filter(f=>f.col===open.col):[];const q=norm(open?.q||"");
 return`<details class="a3box" ${open||S.a3Det===i?"open":""} data-a3det="${i}"><summary>Areas and fields ${nA||nF?`<span class="pill">${nA+nF} limit${nA+nF===1?"":"s"}</span>`:`<span class="status">— everything as the ticks say</span>`}</summary>
  <div class="a3grid">${areas}</div>
  <div class="a3r" style="margin-top:8px"><span><b>Fields of</b></span><select data-a3form="${i}" aria-label="Fields of which area"><option value="">— pick an area to set single fields —</option>${A3_AREAS.map(([c,l])=>`<option value="${c}" ${open?.col===c?"selected":""}>${esc(l)}</option>`).join("")}</select></div>
  ${open?`<input data-a3q="${i}" placeholder="Find a field…" value="${esc(open.q||"")}" aria-label="Find a field" style="margin:6px 0"><div class="a3grid a3f">${fl.filter(f=>!q||norm(f.label).includes(q)).map(f=>`<label class="a3r"><span>${esc(f.label)}</span>${a3Sel(`${i}|fields|${f.col}.${f.key}`,a3Field(f.col,f.key,u),f.label)}</label>`).join("")||'<div class="status">No such field</div>'}</div>`:""}</details>`}
const a3Users0=sUsers;
sUsers=function(){let h=a3Users0.apply(this,arguments);try{if(!S.isOwner)return h;const us=SET().users||[];const admins=(window.MYTOOL?.cfg?.admins)||[];let n=-1;h=h.replace(/<div class="r2say">/g,m=>{n++;return m});
 /* put each person's box before their plain-words line */let idx=0;const order=us.map((u,i)=>i).filter(i=>!admins.includes(String(us[i].uid||"").toLowerCase()));h=h.replace(/<div class="r2say">/g,m=>{const i=order[idx++];return(i==null?"":a3CardHtml(us[i],i))+m})}catch(e){console.warn("a3 users",e)}return h};
const a3Says0=r2Says;
r2Says=function(u){let s=a3Says0.apply(this,arguments);try{const hid=[],ro=[];A3_AREAS.forEach(([c,l])=>{const m=a3Area(c,u);if(m==="hide")hid.push(l);else if(m==="view")ro.push(l)});const fh=Object.values(u.fields||{}).filter(x=>x==="hide").length,fv=Object.values(u.fields||{}).filter(x=>x==="view").length;
 if(hid.length)s+=` Does not see: ${hid.join(", ")}.`;if(ro.length)s+=` View only: ${ro.join(", ")}.`;if(fh||fv)s+=` ${fh?fh+" field"+(fh===1?"":"s")+" hidden":""}${fh&&fv?", ":""}${fv?fv+" view-only":""}.`}catch(_){}return s};
function a3Redraw(){const y=window.scrollY;const v=$("#view");if(v&&typeof vSetup==="function")vSetup(v);window.scrollTo(0,y)}
document.addEventListener("change",async e=>{const t=e.target;if(t.matches?.("[data-a3form]")){const i=+t.dataset.a3form;S.a3Open=t.value?{i,col:t.value,q:""}:null;S.a3Det=i;a3Redraw();return}
 if(!t.matches?.("[data-a3]"))return;e.stopImmediatePropagation();const[i,kind,key]=t.dataset.a3.split("|");const us=JSON.parse(JSON.stringify(SET().users||[]));const u=us[+i];if(!u)return;u[kind]=u[kind]||{};if(t.value==="edit")delete u[kind][key];else u[kind][key]=t.value;if(!Object.keys(u[kind]).length)delete u[kind];S.a3Det=+i;
 const ok=await setupPatch(["users"],us,`${u.name||u.uid}: ${key} → ${t.value==="edit"?"Edit":t.value==="view"?"View only":"Hidden"}`);a3Redraw();if(ok===false)return},true);
document.addEventListener("input",e=>{const t=e.target;if(!t.matches?.("[data-a3q]")||!S.a3Open)return;S.a3Open.q=t.value;const q=norm(t.value);t.parentElement.querySelectorAll(".a3f .a3r").forEach(r=>{r.style.display=!q||norm(r.firstElementChild.textContent).includes(q)?"":"none"})});
(function(){try{const st=document.createElement("style");st.textContent=`.a3box{border-top:1px dashed var(--line);padding-top:8px}.a3box>summary{cursor:pointer;font-weight:600;display:flex;gap:8px;align-items:center}.a3grid{display:grid;grid-template-columns:1fr;gap:4px;margin-top:8px}.a3f{max-height:300px;overflow:auto;padding-right:4px}.a3r{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:13px;font-weight:500}.a3r select{min-height:32px;width:128px;flex:none}.a3s.a3-view{border-color:#d9a400;background:#fff8dc}.a3s.a3-hide{border-color:#c0392b;background:#fdecea}`;document.head.appendChild(st)}catch(_){}})();
/* someone who does not receive every number (a hidden area / field) must never re-calculate totals from what they have:
   their device skips the automatic re-calculations — the next full user's app (or the Owner's) does them */
function a3Partial(){const u=a3User();if(!u)return false;return Object.values(u.areas||{}).includes("hide")||Object.values(u.fields||{}).includes("hide")}
const a3Rec0=reconcile;reconcile=async function(){if(a3Partial())return;return a3Rec0.apply(this,arguments)};
if(typeof derivedUpdate==="function"){const a3Der0=derivedUpdate;derivedUpdate=async function(){if(a3Partial())return false;return a3Der0.apply(this,arguments)}}
