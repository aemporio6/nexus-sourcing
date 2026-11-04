/* ---------- Conflicts: show both versions, let the person choose — never a silent winner ----------
   A "field" conflict (two people changed the same field at the same moment) gets a chooser: each field shows the value kept
   (this device's) and the other person's value, with "Keep" / "Use theirs". A choice is a normal, logged edit. */
function conflictBox(x){const[c,id]=String(x.key||"").split("/");if(x.kind!=="field")return"";
 return`<div class="cfbox" data-cfkey="${esc(x.key)}" data-cfat="${esc(x.at)}"><table class="cft"><tr><th>Field</th><th>Kept (${esc(x.by||"this device")})</th><th>${esc(x.other||"other person")}</th><th></th></tr>${x.fields.map(f=>`<tr><td><b>${esc(f)}</b></td><td class="num">${esc(short(x.mine&&x.mine[f]))}</td><td class="num">${esc(short(x.theirs&&x.theirs[f]))}</td><td><button type="button" class="btn sm" data-act="syncuse" data-col="${esc(c)}" data-id="${esc(id)}" data-field="${esc(f)}" data-at="${esc(x.at)}" data-key="${esc(x.key)}" title="Replace the kept value with ${esc(x.other||"the other")}'s">Use theirs</button></td></tr>`).join("")}</table></div>`}
attAct=(function(orig){return function(a){if(a.act&&a.act.k==="sync"){const x=(window.MYTOOL&&MYTOOL.conflicts?MYTOOL.conflicts():[]).find(y=>y.at===a.act.at&&y.key===a.act.key);const base=orig(a);return x&&x.kind==="field"?base.replace('title="I checked it','title="Keep the values shown as kept').replace("Checked ✓","Keep all ✓")+conflictBox(x):base}return orig(a)}})(attAct);
document.addEventListener("click",async e=>{const b=e.target.closest('[data-act="syncuse"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const ds=b.dataset;
 const x=(MYTOOL.conflicts()||[]).find(y=>y.at===ds.at&&y.key===ds.key);if(!x){toast("This conflict is already closed");return}
 const v=x.theirs?x.theirs[ds.field]:undefined;if(!can("edit")){toast("Your role cannot edit records");return}
 const ok=await updateDoc(ds.col,ds.id,{[ds.field]:v},`${ds.id}: took ${x.other||"the other person"}'s ${ds.field} (${short(v)}) after a sync clash`);
 if(ok){const row=b.closest("tr");if(row)row.querySelector("td:nth-child(2)").textContent=short(v);b.textContent="Used ✓";b.disabled=true;
  if(![...b.closest(".cfbox").querySelectorAll('[data-act="syncuse"]')].some(z=>!z.disabled)){MYTOOL.dismissConflict(ds.at,ds.key);toast("Conflict resolved — all fields chosen");render()}}},true);
