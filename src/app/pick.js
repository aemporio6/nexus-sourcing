/* ---------- THE CENTRE of everything that can be chosen (owner, 21 Nov 2026) ----------
   Before: a dropdown was built in 61 places. The forms had one shared builder (so ＋ Add / default / suggestion came by itself
   there), but Setup, Users, the importer, filters… each built their own, so those had none of it.
   Now there is ONE registry (PICK) of every kind of thing that can be chosen — company, bank, place, person, role, any Setup
   list, product, supplier… Each kind says once: where its options come from, how a new one is added, whether its list is fixed.
   - EVERY dropdown on EVERY page is upgraded by this file the moment it appears (also dropdowns written in the future):
     it finds which kind the dropdown is choosing (told by data-src="company", or recognised from its options) and gives it
     "＋ Add …" — the new one is saved in the centre (Setup) and is at once in every other dropdown of that kind.
   - pickMulti() is the one "several at once" chooser, with All (used for a person's companies; All also covers future ones).
   - Fixed kinds (statuses that drive the logic) can be chosen but never added to from a dropdown.
   - build.py refuses a new module that writes a dropdown without data-src / data-fixed, and tests/t_pick.js walks every page. */
const PICK={};
function pickReg(src,def){PICK[src]=def}
const PICK_FIXED=/Status$|^inspResult$|^refType$/;
function pickDef(src){if(!src)return null;if(PICK[src])return PICK[src];
 if(src.startsWith("list:")){const k=src.slice(5);const d=listDef(k);if(!d||!Array.isArray(d.items))return null;
  return{label:d.label||k,word:(d.label||k),fixed:PICK_FIXED.test(k),ids:()=>(d.items||[]).map(i=>i.id),opts:()=>items(k).map(i=>[i.id,i.label]),
   add:async name=>{const def=listDef(k);const ex=(def.items||[]).find(i=>norm(i.label)===norm(name));if(ex)return ex.id;const id=slugId(name,def.items||[]);const it={id,label:name};if(def.coded)it.code=name.replace(/[^A-Za-z0-9]/g,"").slice(0,4).toUpperCase();
    const ok=await setupPatch(["lists",k,"items"],(def.items||[]).concat([it]),`${name} added to ${def.label||k}`);return ok===false?null:id}}}
 return null}
function pickSetAdd(path,pre,make,labOf){return async name=>{const arr=(SET()[path]||[]).slice();const ex=arr.find(x=>norm(labOf(x)||"")===norm(name));if(ex)return ex.id;let n=arr.length+1,id=pre+n;while(arr.some(x=>x.id===id))id=pre+(++n);arr.push(make(id,name));const ok=await setupPatch(path,arr,`${name} added`);return ok===false?null:id}}
pickReg("company",{label:"Companies",word:"company",ids:()=>(SET().companies||[]).map(c=>c.id),opts:()=>(SET().companies||[]).filter(c=>!c.archived).map(c=>[c.id,c.name]),add:pickSetAdd("companies","c",(id,name)=>({id,name,tag:name.replace(/[^A-Za-z]/g,"").slice(0,4).toUpperCase(),vatRegistered:false}),x=>x.name)});
pickReg("bank",{label:"Bank accounts",word:"bank account",ids:()=>(SET().banks||[]).map(c=>c.id),opts:()=>(SET().banks||[]).filter(c=>!c.archived).map(c=>[c.id,c.name]),add:pickSetAdd("banks","b",(id,name)=>({id,name,cur:"GBP",company:DEF().company}),x=>x.name)});
pickReg("email",{label:"Email addresses",word:"email address",ids:()=>(SET().emails||[]).map(c=>c.id),opts:()=>(SET().emails||[]).filter(c=>!c.archived).map(c=>[c.id,c.address]),add:pickSetAdd("emails","e",(id,name)=>({id,address:name,usedFor:""}),x=>x.address)});
pickReg("loc",{label:"Places",word:"place",ids:()=>(SET().locations||[]).map(c=>c.id),opts:()=>(SET().locations||[]).filter(c=>!c.archived).map(c=>[c.id,c.name]),add:pickSetAdd("locations","L",(id,name)=>({id,name,kind:"own"}),x=>x.name)});
pickReg("person",{label:"People",word:"person",ids:()=>(SET().people||[]).map(c=>c.id),opts:()=>(SET().people||[]).filter(c=>!c.archived).map(c=>[c.id,c.name]),
 add:async name=>{const people=(SET().people||[]).slice();const ex=people.find(p=>norm(p.name)===norm(name));if(ex)return ex.id;const id=slugId(name,people);people.push({id,name,role:""});const ok=await setupPatch("people",people,`${name} added`);return ok===false?null:id}});
pickReg("party",{label:"Suppliers, forwarders, clients",word:"supplier / party",ids:()=>(D.parties||[]).map(p=>p.code),opts:()=>live(D.parties||[]).filter(p=>p.status!=="archived").map(p=>[p.code,plabel(p.code)]),open:()=>openForm("party",{force:true})});
pickReg("sku",{label:"Products",word:"product",ids:()=>(D.products||[]).map(p=>p.sku),opts:()=>live(D.products||[]).filter(p=>p.status!=="archived"&&!p.mergedInto).map(p=>[p.sku,`${p.name} · ${p.sku}`]),open:()=>openForm("product",{force:true})});
/* every kind there is right now (the Setup lists are found by themselves — a new list is a new kind without any code) */
function pickAll(){const out=Object.keys(PICK);try{Object.keys(SET().lists||{}).forEach(k=>out.push("list:"+k))}catch(_){}return out}
function pickCanAdd(def){return!!def&&!def.fixed&&(def.add||def.open)&&(typeof can!=="function"||can("setup")||!!def.open)}
/* which kind is this dropdown choosing? told (data-src) or recognised from its options */
let pickIdc=null;
function pickIds(src){if(pickIdc&&pickIdc.has(src))return pickIdc.get(src);let ids=null;try{const def=pickDef(src);ids=def?new Set(def.ids()):null}catch(_){ids=null}if(pickIdc)pickIdc.set(src,ids);return ids}
function pickInfer(sel){const vals=[...sel.options].map(o=>o.value).filter(v=>v&&!v.startsWith("__"));if(vals.length<1)return"";const sig="§"+vals.join("|");if(pickIdc&&pickIdc.has(sig))return pickIdc.get(sig);let best="",bs=0,tie=false;
 for(const src of pickAll()){const ids=pickIds(src);if(!ids||!ids.size)continue;if(!vals.every(v=>ids.has(v)))continue;const score=vals.length/ids.size;if(score>bs+1e-9){best=src;bs=score;tie=false}else if(Math.abs(score-bs)<1e-9)tie=true}
 const r=bs>=0.5&&!tie?best:"";if(pickIdc)pickIdc.set(sig,r);return r}
function pickEnhance(root){try{const todo=(root||document).querySelectorAll("select:not([data-pk])");if(!todo.length)return;pickIdc=new Map();todo.forEach(sel=>{
  if(sel.dataset.fixed!==undefined){sel.dataset.pk="fixed";return}
  if([...sel.options].some(o=>o.value.startsWith("__"))){const seen=new Set();[...sel.options].forEach(o=>{if(!o.value.startsWith("__"))return;if(seen.has(o.value))o.remove();else seen.add(o.value)});sel.dataset.pk="own";return}
  const src=sel.dataset.src||pickInfer(sel);const def=pickDef(src);if(!def){sel.dataset.pk="static";return}
  sel.dataset.pk=src;if(sel.dataset.pkPrev===undefined)sel.dataset.pkPrev=sel.value;if(!sel.multiple&&!sel.disabled&&pickCanAdd(def)&&!sel.querySelector('option[value="__pickadd"]'))sel.insertAdjacentHTML("beforeend",`<option value="__pickadd">＋ ${def.add?"Add":"New"} ${esc(def.word||def.label||"one")}…</option>`)});pickIdc=null}catch(e){pickIdc=null;console.warn("pick",e)}}
let pickT=null;
try{new MutationObserver(()=>{if(pickT)return;pickT=setTimeout(()=>{pickT=null;pickEnhance()},60)}).observe(document.documentElement,{childList:true,subtree:true})}catch(_){}
setInterval(()=>pickEnhance(),3000);
/* remember what was chosen before, so "＋ Add" can be cancelled */
window.addEventListener("focusin",e=>{const t=e.target;if(t&&t.tagName==="SELECT"&&t.value!=="__pickadd")t.dataset.pkPrev=t.value},true);
window.addEventListener("change",e=>{const t=e.target;if(t&&t.tagName==="SELECT"&&t.value!=="__pickadd")t.dataset.pkPrev=t.value},true);
function pickKey(sel){if(sel.id)return"#"+CSS.escape(sel.id);for(const a of sel.attributes){if(a.name.startsWith("data-")&&!/^data-(pk|pk-prev|src)$/.test(a.name)&&a.value!=="")return`select[${a.name}="${CSS.escape(a.value)}"]`}return""}
function pickBoxClose(){document.querySelectorAll(".pkadd").forEach(x=>x.remove())}
window.addEventListener("change",e=>{const t=e.target;if(!t||t.tagName!=="SELECT"||t.value!=="__pickadd")return;e.stopImmediatePropagation();e.preventDefault();
 const src=t.dataset.pk;const def=pickDef(src);t.value=t.dataset.pkPrev||"";if(!def)return;
 if(!def.add&&def.open){def.open();toast(`Save the new ${def.word}, then pick it here`,{ms:6000});return}
 pickBoxClose();const key=pickKey(t);t.insertAdjacentHTML("afterend",`<span class="pkadd" data-pkfor="${esc(key)}" data-pksrc="${esc(src)}"><input class="pkadd-in" placeholder="New ${esc(def.word||"name")}" aria-label="New ${esc(def.word||"name")}"><button type="button" class="btn sm pri" data-pkok>Add</button><button type="button" class="btn sm" data-pkx aria-label="Cancel">✕</button></span>`);
 t.parentElement.querySelector(".pkadd-in")?.focus()},true);
async function pickCommit(box){const inp=box.querySelector(".pkadd-in");const name=(inp?.value||"").trim();if(!name){inp?.focus();return}const src=box.dataset.pksrc,key=box.dataset.pkfor;const def=pickDef(src);if(!def?.add)return;
 const prevSib=box.previousElementSibling;box.querySelector("[data-pkok]").disabled=true;let id=null;try{id=await def.add(name)}catch(e){console.warn(e)}
 if(!id){toast("Not added");box.remove();return}box.remove();
 /* the page may have been drawn again while saving: find the same dropdown again */
 await new Promise(r=>setTimeout(r,80));const sel=(key&&document.querySelector(key))||(prevSib&&prevSib.isConnected?prevSib:null);if(!sel){toast(`${name} added`);return}
 if(![...sel.options].some(o=>o.value===id)){const add=sel.querySelector('option[value="__pickadd"]');const o=document.createElement("option");o.value=id;o.textContent=name;sel.insertBefore(o,add||null)}
 sel.value=id;sel.dataset.pkPrev=id;sel.dispatchEvent(new Event("change",{bubbles:true}));toast(`${name} added and chosen`)}
window.addEventListener("click",e=>{const ok=e.target.closest?.("[data-pkok]");if(ok){e.preventDefault();e.stopImmediatePropagation();pickCommit(ok.closest(".pkadd"));return}const x=e.target.closest?.("[data-pkx]");if(x){e.preventDefault();e.stopImmediatePropagation();x.closest(".pkadd")?.remove()}},true);
window.addEventListener("keydown",e=>{const t=e.target;if(!t?.classList?.contains("pkadd-in"))return;if(e.key==="Enter"){e.preventDefault();e.stopImmediatePropagation();pickCommit(t.closest(".pkadd"))}else if(e.key==="Escape"){e.stopImmediatePropagation();t.closest(".pkadd")?.remove()}},true);
/* ----- several at once, with All ----- */
function pickMulti(o){const def=pickDef(o.src);const opts=o.opts||(def?def.opts():[]);const all=o.value==null||o.value==="all"||!Array.isArray(o.value);const set=new Set(all?[]:o.value);
 const names=all?`All ${o.allWord||(def?.label||"").toLowerCase()||"of them"}`:(opts.filter(([id])=>set.has(id)).map(x=>x[1]).join(", ")||"None");
 return`<span class="pkm" data-pkm="${esc(o.sp)}" data-pksrc="${esc(o.src||"")}"><input type="hidden" data-sp="${esc(o.sp)}" data-json="1" value="${esc(JSON.stringify(all?null:[...set]))}"><button type="button" class="btn sm pkm-b" data-pkm-open aria-label="${esc(o.lab||"Choose")}" title="${esc(o.lab||"Choose")}">${esc(names)} ▾</button><span class="pkm-pop" hidden>
  <label class="pkm-r"><input type="checkbox" data-pkm-all ${all?"checked":""}> <b>All</b> <span class="status">(also the ones added later)</span></label>
  ${opts.map(([id,l])=>`<label class="pkm-r"><input type="checkbox" data-pkm-v="${esc(id)}" ${all||set.has(id)?"checked":""}> ${esc(l)}</label>`).join("")}
  <span class="pkm-foot">${def&&pickCanAdd(def)&&def.add?`<button type="button" class="btn sm" data-pkm-add>＋ Add ${esc(def.word)}…</button>`:""}<button type="button" class="btn sm pri" data-pkm-ok>Done</button></span></span></span>`}
window.addEventListener("click",async e=>{const t=e.target;if(!t.closest)return;
 const op=t.closest("[data-pkm-open]");if(op){e.preventDefault();const pop=op.parentElement.querySelector(".pkm-pop");const was=pop.hidden;document.querySelectorAll(".pkm-pop").forEach(p=>p.hidden=true);pop.hidden=!was;return}
 const ad=t.closest("[data-pkm-add]");if(ad){e.preventDefault();const w=ad.closest(".pkm");const def=pickDef(w.dataset.pksrc);const name=(prompt(`New ${def.word} — name`)||"").trim();if(!name)return;const sp=w.dataset.pkm;const cur=[...w.querySelectorAll("[data-pkm-v]:checked")].map(x=>x.dataset.pkmV);const wasAll=w.querySelector("[data-pkm-all]").checked;const id=await def.add(name);if(!id)return;
  await new Promise(r=>setTimeout(r,80));const w2=document.querySelector(`.pkm[data-pkm="${CSS.escape(sp)}"]`);if(!w2)return;if(!wasAll){const h=w2.querySelector("input[type=hidden]");h.value=JSON.stringify([...new Set(cur.concat([id]))]);h.dispatchEvent(new Event("change",{bubbles:true}))}toast(`${name} added${wasAll?"":" and ticked"}`);return}
 const ok=t.closest("[data-pkm-ok]");if(ok){e.preventDefault();const w=ok.closest(".pkm");const all=w.querySelector("[data-pkm-all]").checked;const ids=[...w.querySelectorAll("[data-pkm-v]:checked")].map(x=>x.dataset.pkmV);const h=w.querySelector("input[type=hidden]");const nv=JSON.stringify(all?null:ids);w.querySelector(".pkm-pop").hidden=true;if(nv!==h.value){h.value=nv;h.dispatchEvent(new Event("change",{bubbles:true}))}return}
 if(!t.closest(".pkm"))document.querySelectorAll(".pkm-pop").forEach(p=>p.hidden=true)},true);
window.addEventListener("change",e=>{const t=e.target;if(!t?.closest)return;const w=t.closest(".pkm");if(!w||t.type!=="checkbox")return;e.stopImmediatePropagation();
 if(t.dataset.pkmAll!==undefined){w.querySelectorAll("[data-pkm-v]").forEach(x=>x.checked=t.checked)}else{const boxes=[...w.querySelectorAll("[data-pkm-v]")];if(!t.checked)w.querySelector("[data-pkm-all]").checked=false}},true);
(function(){try{const st=document.createElement("style");st.textContent=`.pkadd{display:inline-flex;gap:4px;align-items:center;margin:2px 0 2px 6px;vertical-align:middle}.pkadd-in{min-width:140px;max-width:200px}.pkm{position:relative;display:inline-block}.pkm-b{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pkm-pop{position:absolute;z-index:60;left:0;top:calc(100% + 4px);background:var(--card,#fff);border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:8px;min-width:230px;max-height:300px;overflow:auto;display:flex;flex-direction:column;gap:2px}.pkm-pop[hidden]{display:none}.pkm-r{display:flex;gap:8px;align-items:center;padding:6px 4px;white-space:nowrap;cursor:pointer}.pkm-foot{display:flex;gap:6px;justify-content:flex-end;padding-top:6px;border-top:1px solid var(--line);margin-top:4px}`;document.head.appendChild(st)}catch(_){}})();
/* a new person in Setup › Users starts filled in: View only (least access), the department most people have, the default company */
const pkAdd0=setupAdd;
setupAdd=async function(what,ds){const n=(SET().users||[]).length;const r=await pkAdd0.apply(this,arguments);
 try{if(what==="user"){const us=JSON.parse(JSON.stringify(SET().users||[]));const u=us[us.length-1];if(us.length===n+1&&u){const c={};us.slice(0,-1).forEach(x=>{if(x.department)c[x.department]=(c[x.department]||0)+1});const dep=Object.keys(c).sort((a,b)=>c[b]-c[a])[0]||"";
   if(items("role").some(x=>x.id==="viewer"))u.role="viewer";if(dep)u.department=dep;const co=DEF().company;if(co)u.defaults={...(u.defaults||{}),company:co};await setupPatch(["users"],us,"New user: View only, usual department and default company filled in")}}}catch(e){console.warn("defaults",e)}return r};
/* Create: the centre itself */
chRegister({k:"centre",title:"Add to any dropdown, anywhere",hint:"Every dropdown has “＋ Add …” at its end — what you add is saved in Settings and is in every dropdown of that kind",page:"setup",words:"dropdown add new option list centre central company bank role department place person",run:q=>{go("setup");toast("Open any dropdown and choose “＋ Add …” — or change the lists here in Settings",{ms:7000})}});
