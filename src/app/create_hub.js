/* ---------- + Create hub, search-everything actions, Fill from last, Quick / Full (taken from the MoreOrderz design, 12 Nov 2026) ----------
   + Create (top bar or key N): one window with a search box and everything that can be created or started, grouped by department.
   Opening a form from it shows "‹ Back to Create" (keeps what you typed).
   Top search: besides records it now offers matching pages ("Go to") and things to create ("Create").
   Forms: "Fill from last" copies the last saved form of the same kind into the empty fields; Quick shows only the key fields. */
const CH_DEPT={purchases:"Buying",shipments:"Shipping",payments:"Money",stock:"Stock",products:"Products",parties:"Partners"};
function chItems(){const forms=CREATE_REG.map(c=>({key:"f:"+c.k,title:c.menu||c.l,hint:c.hint,dept:CH_DEPT[c.mod]||"Other",form:c.k,words:(c.l+" "+(c.menu||"")+" "+(c.hint||"")).toLowerCase()}));
 const more=[
  {key:"v:import",title:"Import a file",hint:"Bank statement, eBay / Amazon report, PI, packing list…",dept:"Data",page:"import",words:"import upload file csv excel statement report"},
  {key:"v:drive",title:"Import from a Drive link",hint:"Paste a Drive folder or file link",dept:"Data",page:"import",drive:1,words:"drive link google folder"},
  {key:"v:planner",title:"Reorder plan (ICC)",hint:"How much to order and when",dept:"Planning",page:"planner",words:"plan reorder icc forecast"},
  {key:"v:tools",title:"Calculator (CBM, landed cost)",hint:"Carton CBM, chargeable weight, landed cost",dept:"Planning",page:"tools",words:"calculator cbm weight landed cost tools"},
  {key:"v:reports",title:"Report / Payment Summary",hint:"PDF or Excel for a party or month",dept:"Reports",page:"reports",words:"report payment summary pdf excel export statement"},
  {key:"v:calendar",title:"Something on a date",hint:"Open the calendar and pick a day",dept:"Planning",page:"calendar",words:"calendar date day schedule"}];
 return forms.concat(more.filter(m=>m.page!=="import"||can("create")))}
function chMatch(it,t){if(!t)return true;return t.split(/\s+/).every(w=>it.title.toLowerCase().includes(w)||it.words.includes(w)||it.dept.toLowerCase().includes(w))}
function chRun(key,q){const it=chItems().find(x=>x.key===key);if(!it)return;chClose();
 if(it.form){S._chFrom=q||"";try{openNew(it.form)}finally{S._chFrom=null}return}
 go(it.page);if(it.drive)setTimeout(()=>{try{ixDrv().open=true;ixDriveRender();$("#ix_drive_link")?.focus()}catch(_){}},300)}
function chClose(){const o=$("#chub");if(o)o.remove()}
function openCreateHub(q=""){if(!can("create")&&!chItems().some(i=>!i.form)){toast("Your role cannot create records");return}chClose();
 const o=document.createElement("div");o.id="chub";o.className="ch-ov";o.innerHTML=`<div class="ch-box" role="dialog" aria-modal="true" aria-labelledby="ch_t"><div class="ch-h"><div><h2 id="ch_t">Create</h2><div class="status">Everything you can create or start, from anywhere. Press <kbd>N</kbd> on any screen.</div></div><button class="x" data-act="chclose" aria-label="Close">×</button></div>
  <input id="ch_q" class="ch-q" placeholder="Type what you want to create… (payment, shipment, product, import)" autocomplete="off" value="${esc(q)}"><div class="ch-grid" id="ch_grid" role="listbox"></div></div>`;
 document.body.appendChild(o);const inp=$("#ch_q");
 const draw=()=>{const t=inp.value.trim().toLowerCase();const items=chItems().filter(i=>(!i.form||can("create"))&&chMatch(i,t));const depts=[...new Set(items.map(i=>i.dept))];
  $("#ch_grid").innerHTML=depts.map(d=>{const its=items.filter(i=>i.dept===d);return`<div class="ch-dept"><h4>${esc(d)} <span class="status">${its.length}</span></h4>${its.map(i=>`<button type="button" class="ch-item" role="option" data-act="chrun" data-key="${esc(i.key)}"><b>${i.form?"+ ":"→ "}${esc(i.title)}</b><small>${esc(i.hint||"")}</small></button>`).join("")}</div>`}).join("")||`<div class="empty">Nothing matches “${esc(t)}”.</div>`};
 draw();inp.addEventListener("input",draw);inp.addEventListener("keydown",e=>{if(e.key==="Enter"){const b=$("#ch_grid .ch-item");if(b){e.preventDefault();chRun(b.dataset.key,inp.value)}}else if(e.key==="ArrowDown"){e.preventDefault();$("#ch_grid .ch-item")?.focus()}});
 o.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();chClose()}if((e.key==="ArrowDown"||e.key==="ArrowUp")&&e.target.classList.contains("ch-item")){e.preventDefault();const all=[...o.querySelectorAll(".ch-item")];const i=all.indexOf(e.target)+(e.key==="ArrowDown"?1:-1);(all[i]||inp).focus()}});
 o.addEventListener("click",e=>{if(e.target===o)chClose()});setTimeout(()=>inp.focus(),20)}
/* the top-bar + Create and key N open the hub (the old small menu stays for the calendar's "create on this day") */
document.addEventListener("click",e=>{const t=e.target.closest("[data-act]");if(!t)return;const a=t.dataset.act;
 if(a==="newmenu"){e.preventDefault();e.stopPropagation();openCreateHub();return}
 if(a==="chclose"){e.preventDefault();chClose();return}
 if(a==="chrun"){e.preventDefault();e.stopPropagation();chRun(t.dataset.key,$("#ch_q")?.value||"");return}
 if(a==="chback"){e.preventDefault();e.stopPropagation();const q=S.drawer?.ctx?._fromCreate||"";if(closeDrawer())openCreateHub(q);return}
 if(a==="sgo"){e.preventDefault();e.stopPropagation();hideSugg();$("#q").value="";let f={};try{f=JSON.parse(t.dataset.f||"{}")}catch(_){}go(t.dataset.page,Object.keys(f).length?{f}:{});return}
 if(a==="snew"){e.preventDefault();e.stopPropagation();hideSugg();$("#q").value="";chRun(t.dataset.key,"");return}},true);
document.addEventListener("keydown",e=>{if(e.key.toLowerCase()!=="n"||e.ctrlKey||e.metaKey||e.altKey||S.drawer||$("#chub"))return;const el=e.target;if(/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)||el.isContentEditable)return;e.preventDefault();e.stopImmediatePropagation();openCreateHub()},true);
/* ---- search everything: pages and "create" actions on top of the records ---- */
function chNavHits(q){const t=norm(q);if(t.length<2)return[];const out=[];NAV_MODULES.forEach(m=>m.items.forEach(([l,page,f,ck])=>{if(ck)return;const s=norm(m.l+" "+l);if(t.split(/\s+/).every(w=>s.includes(w)))out.push({l:(m.l===l?l:m.l+" › "+l),page,f:f||{}})}));return out.slice(0,5)}
const chShowSugg0=showSugg;
showSugg=function(q){chShowSugg0(q);const s=$("#sugg");if(!s||s.hidden)return;const t=(q||"").trim();if(t.length<2)return;
 const nav=chNavHits(t);const cr=chItems().filter(i=>(!i.form||can("create"))&&chMatch(i,t.toLowerCase())).slice(0,4);if(!nav.length&&!cr.length)return;
 const html=(cr.length?`<h6>Create</h6>${cr.map(i=>`<button role="option" data-act="snew" data-key="${esc(i.key)}"><span class="ref">${i.form?"+":"→"}</span><span class="lab">${esc(i.title)}<small>${esc(i.hint||"")}</small></span></button>`).join("")}`:"")+(nav.length?`<h6>Go to</h6>${nav.map(n=>`<button role="option" data-act="sgo" data-page="${esc(n.page)}" data-f='${esc(JSON.stringify(n.f))}'><span class="ref">→</span><span class="lab">${esc(n.l)}</span></button>`).join("")}`:"");
 const empty=s.querySelector(":scope > .empty");if(empty&&!s.querySelector('[data-open]'))empty.remove();s.insertAdjacentHTML("beforeend",html)};
/* ---- Fill from last + Quick / Full in forms ---- */
const CH_NOCOPY=new Set(["no","id","oldRef","yourRef","piNo","tracking","trackingNo","date","dispatch","eta","plannedDate","files","docs","notes","barcode","sku","code","name","amount","total","lines","receipt","report"]);
const CH_QUICK={purchase:["party","date","cur","lines","total","piNo","account"],payment:["party","date","amount","cur","forRef","bank","type"],shipment:["party","mode","lines","dispatch","cost","costCur","rateBasis","rate","kg","cbm","ctn"],inspection:["po","party","plannedDate","fee","result"],product:["name","brand","category","sku"],party:["name","type","cur","company"],receive:["sh","po","date","lines","loc"],move:["type","sku","qty","from","to","date"],count:["loc","date","lines"],credit:["party","amount","cur","po","reason"]};
function chLastKey(form){return"lastform."+form}
function chSaveLast(){const d=S.drawer;if(!d?.form||d.ctx.edit)return;try{const v=fnSnap();if(!v)return;const o={};Object.entries(v).forEach(([k,x])=>{if(CH_NOCOPY.has(k))return;if(x==null||x===""||(Array.isArray(x)&&!x.length))return;if(typeof x==="object"&&!Array.isArray(x))return;o[k]=x});const form=d.form;
 /* kept only when the save went through (the form closed, or it stayed open with no errors) */
 setTimeout(()=>{const n=S.drawer;if(n&&n.form===form&&Object.keys(n.errors||{}).length)return;ls.set(chLastKey(form),{at:nowIso(),v:o})},1500)}catch(_){}}
function chFillLast(){const d=S.drawer;if(!d?.form)return;const l=ls.get(chLastKey(d.form));if(!l||!l.v){toast("Nothing saved yet in this kind of form");return}let n=0;const set={};
 fields(d.form).forEach(f=>{if(!(f.k in l.v)||f.t==="rows"||f.t==="dims"||f.t==="file")return;if(d.touched&&d.touched[f.k]&&d.changed&&d.changed[f.k])return;/* what you typed in this form stays; defaults and auto values give way */if(JSON.stringify(val(f.k))===JSON.stringify(l.v[f.k]))return;set[f.k]=l.v[f.k];n++});
 if(!n){toast("Nothing to fill: the form already matches the last one, or you typed these fields");return}fnApply({...fnSnap(),...set});toast(`Filled ${n} field${n>1?"s":""} from the last ${FORM_TITLE[d.form]||"form"} (${fmtD(l.at.slice(0,10))})`)}
function chQuick(on){const d=S.drawer;if(!d?.form)return;const keep=new Set(CH_QUICK[d.form]||[]);fields(d.form).forEach(f=>{const w=$("#fw_"+f.k);if(!w)return;const v=f.t==="rows"?(d.rows[f.k]||[]).length:f.t==="dims"?0:val(f.k);const has=v!=null&&v!==""&&v!==0&&!(Array.isArray(v)&&!v.length);w.classList.toggle("ch-qhide",!!on&&!f.req&&!keep.has(f.k)&&!has&&!(d.errors||{})[f.k])});
 d.quick=!!on;try{ls.set("quickform."+d.form,!!on)}catch(_){}$$(".ch-seg button").forEach(b=>b.classList.toggle("on",(b.dataset.m==="quick")===!!on))}
/* Save in a form = remember it for "Fill from last" */
document.addEventListener("click",e=>{const t=e.target.closest('[data-act="save"],[data-act="save-current"],[data-act="saveadd"],[data-act="savecont"]');if(t)chSaveLast()},true);
document.addEventListener("click",e=>{const t=e.target.closest("[data-act]");if(!t)return;const a=t.dataset.act;if(a==="chfill"){e.preventDefault();e.stopPropagation();chFillLast()}else if(a==="chmode"){e.preventDefault();e.stopPropagation();chQuick(t.dataset.m==="quick")}},true);
/* add the buttons to the form bar */
const chFormShell0=formShell;
formShell=function(form){let h=chFormShell0(form);const d=S.drawer;const isNew=!d?.ctx?.edit;const back=d?.ctx?._fromCreate!=null?`<button type="button" class="btn sm" data-act="chback" title="Back to the Create list">‹ Create</button>`:"";
 const extra=(isNew?`<button type="button" class="btn sm" data-act="chfill" title="Copy the last saved ${esc(FORM_TITLE[form]||"form")} into the empty fields">⟲ Fill from last</button>`:"")+(isNew&&CH_QUICK[form]?`<span class="ch-seg" role="group" aria-label="Form size"><button type="button" data-act="chmode" data-m="quick">Quick</button><button type="button" data-act="chmode" data-m="full" class="on">Full</button></span>`:"");
 return h.replace('<span class="fn-bar" role="toolbar" aria-label="Form navigation">','<span class="fn-bar" role="toolbar" aria-label="Form navigation">'+back).replace(/(<details class="fn-rec">)/,extra+"$1")};
const chOpenForm0=openForm;
openForm=function(form,ctx={}){if(S._chFrom!=null&&ctx._fromCreate==null)ctx={...ctx,_fromCreate:S._chFrom};const r=chOpenForm0(form,ctx);setTimeout(()=>{const d=S.drawer;if(d?.form===form&&!d.ctx.edit&&CH_QUICK[form]){let q=false;try{q=!!ls.get("quickform."+form)}catch(_){}if(q)chQuick(true)}},760);return r};
(function(){try{const st=document.createElement("style");st.textContent=`.ch-ov{position:fixed;inset:0;z-index:70;background:rgba(31,43,55,.32);display:flex;align-items:flex-start;justify-content:center;padding:max(5vh,16px) 16px 16px}
.ch-box{background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:16px;box-shadow:0 24px 60px rgba(31,43,55,.22);width:min(860px,100%);max-height:88vh;display:flex;flex-direction:column;gap:12px;padding:18px}
.ch-h{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.ch-h h2{margin:0;font-size:20px}.ch-h .x{border:0;background:none;font-size:24px;cursor:pointer;color:var(--muted);min-width:40px;min-height:40px}
.ch-q{width:100%;font-size:16px;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--fg)}.ch-q:focus{outline:2px solid var(--accent);outline-offset:1px}
.ch-grid{overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;align-content:start}.ch-dept h4{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.ch-item{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;text-align:left;border:1px solid var(--line);background:var(--panel);color:var(--fg);border-radius:10px;padding:9px 11px;margin:0 0 6px;cursor:pointer;min-height:44px;font:inherit}.ch-item:hover,.ch-item:focus{border-color:var(--accent);background:var(--accent-soft);outline:none}.ch-item b{font-size:14px}.ch-item small{color:var(--muted);font-size:12px}
.ch-seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}.ch-seg button{border:0;background:var(--panel);color:var(--fg);padding:0 12px;min-height:40px;cursor:pointer;font:inherit;font-size:13px}.ch-seg button.on{background:var(--accent);color:var(--accent-fg)}
.ch-qhide{display:none!important}`;document.head.appendChild(st)}catch(_){}})();
