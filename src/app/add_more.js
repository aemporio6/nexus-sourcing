/* ---------- "＋ Add" you can SEE on every field that can take a new value (owner, 18 Nov 2026) ----------
   Before: the "＋ Add to Brands…" option was hidden inside the dropdown, order / payment / shipment pickers and Tags had no way
   to add at all, and text fields like Material only suggested values after they had been typed once.
   Now:
   - every field that can take a new entry shows a small "＋ Add" (or "＋ New") next to its name — it does exactly what the
     dropdown's own Add option does (list item, company / bank / place, person, product, supplier / forwarder)
   - order / payment / shipment pickers (also inside lines) get "＋ New order… / payment… / shipment…": the new record
     opens, and after saving you come back to this form with it picked
   - Tags: "＋ Add tag" adds a new tag and ticks it
   - text fields with suggestions show "▾" to open them; Material starts with a standard list; a typed new value is
     remembered for next time */
const AM_DOC={poref:["purchase","order"],ownref:["purchase","order"],payref:["payment","payment"],recvref:["shipment","shipment"],rcref:["receive","goods received"]};
const AM_MAT=["Cotton","Polyester","Linen","Wool","Silk","Plastic","PP","PET","ABS","Silicone","Rubber","Wood","Bamboo","MDF","Paper","Cardboard","Glass","Ceramic","Porcelain","Stainless steel","Iron","Aluminium","Brass","Soy wax","Paraffin wax","Beeswax","Resin","Stone","Leather","PU leather"];
/* 1) pickers of other records get "＋ New …" inside the dropdown too (fields and lines) */
const amInput0=inputFor;
inputFor=function(f,id,v,attrs=""){let h=amInput0.apply(this,arguments);try{const d=AM_DOC[f?.t];if(d&&h.startsWith("<select")){const opt=`<option value="__newdoc">＋ New ${d[1]}…</option>`;h=/<option value="">[^<]*<\/option>/.test(h)?h.replace(/(<option value="">[^<]*<\/option>)/,"$1"+opt):h.replace(/^(<select[^>]*>)/,"$1"+opt)}}catch(e){console.warn(e)}return h};
/* the receiving form fills its "from" list later — add the option after it */
const amInitRc0=initReceive;
initReceive=function(){const r=amInitRc0.apply(this,arguments);try{const sel=$("#f_src");if(sel&&!sel.querySelector('option[value="__newdoc"]'))sel.querySelector('option[value=""]')?.insertAdjacentHTML("afterend",`<option value="__newdoc">＋ New shipment…</option>`)}catch(_){}return r};
function amOpenNewDoc(t,ret){const d=AM_DOC[t];if(!d)return;const st=stashForm();openForm(d[0],{force:true,returnTo:{stash:st,...ret}})}
document.addEventListener("change",e=>{const t=e.target;if(t?.value!=="__newdoc"||!S.drawer?.form)return;e.stopImmediatePropagation();
 if(t.dataset.row!==undefined){const k=t.dataset.row,i=+t.dataset.i,c=t.dataset.k;const r=rowsOf(k)[i];t.value=r?.[c]??"";const col=(ROWS[fields(S.drawer.form).find(x=>x.k===k)?.rows]?.cols||[]).concat(ROWS[fields(S.drawer.form).find(x=>x.k===k)?.rows]?.more||[]).find(x=>x.k===c);amOpenNewDoc(col?.t||"poref",{rows:k,i,c});return}
 if(t.id?.startsWith("f_")){const k=t.id.slice(2);const fdef=fields(S.drawer.form).find(x=>x.k===k);t.value=S.drawer.lastVal?.[k]??"";amOpenNewDoc(fdef?.t,{field:k})}},true);
/* 2) a visible "＋ Add" next to the field name */
function amHow(f){if(!f)return null;const set=["company","bank","email","loc"];
 if(f.t==="list")return can("setup")&&!/Status$|^inspResult$|^role$/.test(f.list||"")?["__add","＋ Add"]:null;if(set.includes(f.t))return can("setup")?["__add","＋ Add"]:null;
 if(f.t==="person")return can("setup")?["__addperson","＋ Add"]:null;if(f.t==="party"||f.t==="sku")return["__new","＋ New"];
 if(AM_DOC[f.t])return["__newdoc","＋ New "+AM_DOC[f.t][1]];if(f.t==="tags")return can("setup")?["__tag","＋ Add tag"]:null;
 if(f.t==="text"&&S.drawer?.form&&typeof fnSuggest==="function"&&fnSuggest(S.drawer.form,f.k).length)return["__pick","▾"];return null}
const amField0=fieldHtml;
fieldHtml=function(f,v){let h=amField0.apply(this,arguments);try{if(f.t==="rows"||f.t==="ro")return h;const how=amHow(f);if(how)h=h.replace("</label>",`<button type="button" class="fadd" data-fadd="${esc(f.k)}" data-how="${how[0]}" title="${how[0]==="__pick"?"Show suggestions — or type a new one, it is remembered":"Add a new one here"}">${esc(how[1])}</button></label>`)}catch(e){console.warn(e)}return h};
document.addEventListener("click",e=>{const b=e.target.closest(".fadd[data-fadd]");if(!b||!S.drawer?.form)return;e.preventDefault();e.stopImmediatePropagation();const k=b.dataset.fadd,how=b.dataset.how;const el=$("#f_"+k);const fdef=fields(S.drawer.form).find(x=>x.k===k);
 if(how==="__pick"){if(!el)return;el.focus();try{el.showPicker()}catch(_){el.value="";el.dispatchEvent(new Event("input",{bubbles:true}))}return}
 if(how==="__tag"){amTagBox(k);return}
 if(how==="__newdoc"){amOpenNewDoc(fdef?.t,{field:k});return}
 if(!el)return;if(!el.querySelector(`option[value="${how}"]`))el.insertAdjacentHTML("beforeend",`<option value="${how}"></option>`);el.value=how;el.dispatchEvent(new Event("change",{bubbles:true}))},true);
/* Tags: add a new tag and tick it (keeps the tags already ticked) */
function amTagBox(k){const box=$("#inl_"+k);if(!box)return;box.hidden=false;box.innerHTML=`<input id="amtag_in" placeholder="New tag name" aria-label="New tag"><button type="button" class="btn sm pri" data-amtag="${esc(k)}">Add</button><button type="button" class="btn sm" data-act="inlcancel" data-k="${esc(k)}">✕</button>`;$("#amtag_in")?.focus()}
async function amTagCommit(k){const name=($("#amtag_in")?.value||"").trim();if(!name)return;const def=listDef("tag");const ex=(def.items||[]).find(i=>norm(i.label)===norm(name));let id=ex?.id;
 if(!id){id=slugId(name,def.items||[]);await setupPatch(["lists","tag","items"],(def.items||[]).concat([{id,label:name}]),`${name} added to Tags`)}
 const sel=$("#f_"+k);if(sel){const keep=[...sel.selectedOptions].map(o=>o.value);if(!sel.querySelector(`option[value="${CSS.escape(id)}"]`))sel.insertAdjacentHTML("beforeend",`<option value="${esc(id)}">${esc(name)}</option>`);[...sel.options].forEach(o=>{o.selected=keep.includes(o.value)||o.value===id})}
 const box=$("#inl_"+k);if(box)box.hidden=true;markDirty();S.drawer.touched[k]=true;S.drawer.changed[k]=true;sel?.dispatchEvent(new Event("change",{bubbles:true}))}
document.addEventListener("click",e=>{const b=e.target.closest("[data-amtag]");if(!b)return;e.preventDefault();amTagCommit(b.dataset.amtag)},true);
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target?.id==="amtag_in"){e.preventDefault();amTagCommit($("[data-amtag]")?.dataset.amtag)}},true);
/* 3) Material: standard suggestions from the first day, plus everything typed before */
const amSug0=fnSuggest;
fnSuggest=function(form,k){if(k==="material"||k==="x_material"){const seen=new Map();(D.products||[]).filter(x=>!x.deletedAt).forEach(x=>{const t=String(x.material||"").trim();if(t&&t.length<=80)seen.set(t.toLowerCase(),t)});AM_MAT.forEach(t=>{if(!seen.has(t.toLowerCase()))seen.set(t.toLowerCase(),t)});return[...seen.values()].slice(0,60)}return amSug0.apply(this,arguments)};
(function(){try{const st=document.createElement("style");st.textContent=`.fadd{margin-left:auto;float:right;border:0;background:none;color:var(--accent);font:inherit;font-size:12px;font-weight:600;padding:0 2px;cursor:pointer;line-height:1.4}.fadd:hover{text-decoration:underline}.fadd[data-how="__pick"]{font-size:11px;color:var(--muted)}`;document.head.appendChild(st)}catch(_){}})();
/* "For (order / company / client)" inside extra lines / allocations: ＋ New order… too */
const amOwnRef0=ownerRefOptsHtml;
ownerRefOptsHtml=function(v,bt){let h=amOwnRef0.apply(this,arguments);try{if(!/__newdoc/.test(h)){const opt=`<option value="__newdoc">＋ New order…</option>`;h=/<option value="">[^<]*<\/option>/.test(h)?h.replace(/(<option value="">[^<]*<\/option>)/,"$1"+opt):opt+h}}catch(_){}return h};
