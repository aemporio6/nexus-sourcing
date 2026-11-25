/* ---------- Two devices saved at the same moment — said in plain words, and nothing lost (owner's screenshot, 25 Nov 2026) ----------
   The clash list showed raw data ({"partyType":{"label":…) and offered only "keep mine" or "use theirs" — either way one side's
   additions were lost (a role added on the other device, product names the importer had learned there).
   - what the tool writes for itself (health summary, morning digest, inbox marks) is never shown as a clash
   - what the tool LEARNS (importer memory, product-name aliases, "not a problem" marks) is merged from both sides by itself
   - lists and other grouped settings get "Merge both ✓": everything from both sides is kept; only a value changed on BOTH sides
     keeps this device's version
   - every field is named in plain words (Person … — role: Owner / Partner) and says what exactly differs */
/* create: no entry of its own — it tidies the "two people changed this" lines on Home */
const CF_DROP=["healthSummary","digestFeed","inboxDone","filesMoved","lastDigest","rateFetch"];
const CF_MEMORY=["importMemory","skuAliases","fixSeen"];
function cfEq(a,b){return JSON.stringify(cfSort(a))===JSON.stringify(cfSort(b))}
function cfSort(v){if(Array.isArray(v))return v.map(cfSort);if(v&&typeof v==="object")return Object.keys(v).sort().reduce((o,k)=>{o[k]=cfSort(v[k]);return o},{});return v}
/* everything from both sides; where both changed the same value, "mine" stays */
function cfMerge(mine,theirs){if(mine==null)return theirs;if(theirs==null)return mine;
 if(Array.isArray(mine)&&Array.isArray(theirs)){const idOf=x=>x&&typeof x==="object"?(x.id??x.k??x.uid??x.code??x.sku??null):x;const out=mine.slice();const have=new Map(out.map((x,i)=>[JSON.stringify(idOf(x)),i]));theirs.forEach(x=>{const k=JSON.stringify(idOf(x));if(idOf(x)==null){if(!out.some(y=>cfEq(y,x)))out.push(x)}else if(!have.has(k)){have.set(k,out.length);out.push(x)}else{const i=have.get(k);if(out[i]&&typeof out[i]==="object")out[i]=cfMerge(out[i],x)}});return out}
 if(typeof mine==="object"&&typeof theirs==="object"){const out={...mine};Object.keys(theirs).forEach(k=>{out[k]=k in mine?cfMerge(mine[k],theirs[k]):theirs[k]});return out}
 return mine}
function cfCur(path){let v=SET();for(const p of String(path).split(".")){if(v==null)return undefined;if(/^uid:/.test(p)&&Array.isArray(v))v=v.find(u=>String(u.uid)===p.slice(4));else v=v[p]}return v}
function cfLabel(col,f){if(col!=="setup")return f;let m;if((m=String(f).match(/^users\.uid:(.+)\.(\w+)$/))){const u=(SET().users||[]).find(x=>String(x.uid)===m[1]);return`Person “${u?u.name:m[1]}” (${m[1]}) — ${({role:"role",roles:"roles",active:"active",perms:"switches",companies:"companies"})[m[2]]||m[2]}`}
 return({lists:"Dropdown lists",companies:"Companies",banks:"Banks",users:"People",people:"People (staff)",locations:"Locations",emails:"Emails / logins",defaults:"Defaults",numbering:"Numbering",forms:"Form fields",skuAliases:"Product names the importer learned",importMemory:"Importer memory",accessTemplates:"Access templates"})[f]||f}
function cfVal(col,f,v){if(v==null||v==="")return"—";if(/\.role$/.test(f))return L("role",v)||String(v);if(typeof v==="boolean")return v?"Yes":"No";if(Array.isArray(v))return v.length+" item"+(v.length===1?"":"s");if(typeof v==="object")return Object.keys(v).length+" entr"+(Object.keys(v).length===1?"y":"ies");return String(v).slice(0,80)}
/* what exactly differs, for grouped values */
function cfDiff(f,mine,theirs){if(!mine||!theirs||typeof mine!=="object"||typeof theirs!=="object")return"";const names=k=>f==="lists"?((mine[k]||theirs[k]||{}).label||k):k;const parts=[];const keys=[...new Set(Object.keys(mine).concat(Object.keys(theirs)))].filter(k=>!cfEq(mine[k],theirs[k]));
 keys.slice(0,6).forEach(k=>{const a=mine[k],b=theirs[k];const items=x=>x&&Array.isArray(x.items)?x.items:Array.isArray(x)?x:null;const ia=items(a),ib=items(b);
  if(ia&&ib){const id=x=>x&&typeof x==="object"?(x.id??x.k??JSON.stringify(x)):x;const lab=x=>x&&typeof x==="object"?(x.label||x.name||x.id):x;const sa=new Set(ia.map(id)),sb=new Set(ib.map(id));const onlyB=ib.filter(x=>!sa.has(id(x))).map(lab),onlyA=ia.filter(x=>!sb.has(id(x))).map(lab);parts.push(`${names(k)}: ${onlyB.length?"the other device has “"+onlyB.slice(0,4).join("”, “")+"”":""}${onlyA.length?(onlyB.length?"; ":"")+"this device has “"+onlyA.slice(0,4).join("”, “")+"”":""}${!onlyA.length&&!onlyB.length?"an item was changed":""}`)}
  else parts.push(a===undefined?`“${names(k)}” only on the other device`:b===undefined?`“${names(k)}” only on this device`:`“${names(k)}” differs`)});
 return parts.join(" · ")+(keys.length>6?` · and ${keys.length-6} more`:"")}
function cfHuman(x){const[c]=String(x.key||"").split("/");if(x.kind!=="field"||c!=="setup")return x.fields||[];return(x.fields||[]).filter(f=>!CF_DROP.includes(f)&&!CF_MEMORY.includes(f)&&!cfEq(x.mine&&x.mine[f],x.theirs&&x.theirs[f]))}
/* the list everybody reads: machine fields are gone */
(function(){try{if(!window.MYTOOL||!MYTOOL.conflicts)return;const orig=MYTOOL.conflicts.bind(MYTOOL);MYTOOL.conflictsRaw=orig;MYTOOL.conflicts=function(){return MYTOOL.conflictsRaw().map(x=>{const[c]=String(x.key||"").split("/");if(x.kind!=="field"||c!=="setup")return x;return{...x,fields:cfHuman(x)}}).filter(x=>x.kind!=="field"||x.fields.length)}}catch(e){console.warn("sync_plain",e)}})();
/* learned things are merged by themselves; a clash with nothing left for a person is closed */
const cfDone=new Set();
async function cfTidy(){try{if(!S.ready||!window.MYTOOL||!MYTOOL.conflictsRaw||MYTOOL.demo&&!window.__CF_TEST)return;for(const x of MYTOOL.conflictsRaw()){const[c]=String(x.key||"").split("/");if(x.kind!=="field"||c!=="setup")continue;const id=x.at+"|"+x.key;if(cfDone.has(id))continue;
   if(can("setup")){for(const f of(x.fields||[]).filter(f=>CF_MEMORY.includes(f))){const cur=cfCur(f);const merged=cfMerge(cur,x.theirs&&x.theirs[f]);if(!cfEq(cur,merged))await setupPatchMany([[[f],merged]],null,{noUndo:true,quiet:true,derived:true})}}
   cfDone.add(id);if(!cfHuman(x).length&&can("setup"))MYTOOL.dismissConflict(x.at,x.key)}}catch(e){console.warn("sync_plain tidy",e)}}
setInterval(cfTidy,45000);setTimeout(cfTidy,6000);
/* the chooser, in plain words */
conflictBox=function(x){const[c,id]=String(x.key||"").split("/");if(x.kind!=="field")return"";
 return`<div class="cfbox" data-cfkey="${esc(x.key)}" data-cfat="${esc(x.at)}"><div class="status" style="color:var(--fg);margin:4px 0 8px">Two devices saved at the same moment (${esc(fmtD(String(x.at).slice(0,10)))} ${esc(String(x.at).slice(11,16))}). This device's version was kept. For each line choose — <b>Merge both</b> keeps everything from both.</div>
 <table class="cft"><tr><th>What</th><th>Kept (this device)</th><th>The other device${x.other&&x.other!==x.by?" ("+esc(x.other)+")":""}</th><th></th></tr>${x.fields.map(f=>{const a=x.mine&&x.mine[f],b=x.theirs&&x.theirs[f];const grp=a&&b&&typeof a==="object"&&typeof b==="object";const diff=grp?cfDiff(f,a,b):"";const canMerge=grp&&!cfEq(cfMerge(a,b),a);
  return`<tr><td><b>${esc(cfLabel(c,f))}</b>${diff?`<div class="status">${esc(diff)}</div>`:""}</td><td>${esc(cfVal(c,f,a))}</td><td>${esc(cfVal(c,f,b))}</td><td style="white-space:nowrap">${canMerge?`<button type="button" class="btn sm pri" data-act="cfmerge" data-field="${esc(f)}" data-at="${esc(x.at)}" data-key="${esc(x.key)}" title="Keep everything from both devices">Merge both ✓</button> `:""}<button type="button" class="btn sm" data-act="syncuse" data-col="${esc(c)}" data-id="${esc(id)}" data-field="${esc(f)}" data-at="${esc(x.at)}" data-key="${esc(x.key)}" title="Replace the kept value with the other device's">Use theirs</button></td></tr>`}).join("")}</table></div>`};
function cfPlainText(x){const[c,id]=String(x.key||"").split("/");const what=c==="setup"?"Settings":id;return`${what} · two devices saved at the same moment — check ${x.fields.length} thing${x.fields.length===1?"":"s"}: ${x.fields.map(f=>{const a=x.mine&&x.mine[f],b=x.theirs&&x.theirs[f];const grp=a&&b&&typeof a==="object"&&typeof b==="object";return cfLabel(c,f)+(grp?"":` (kept ${cfVal(c,f,a)}, other ${cfVal(c,f,b)})`)}).join("; ")}`}
document.addEventListener("click",async e=>{const b=e.target.closest?.('[data-act="cfmerge"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const ds=b.dataset;const x=(MYTOOL.conflicts()||[]).find(y=>y.at===ds.at&&y.key===ds.key);if(!x){toast("This is already closed");return}if(!can("setup")){toast("Your role cannot change Settings");return}
 const merged=cfMerge(cfCur(ds.field),x.theirs[ds.field]);b.disabled=true;try{await setupPatch(String(ds.field).split("."),merged,`Settings: ${cfLabel("setup",ds.field)} — both devices' changes kept after a sync clash`);b.textContent="Merged ✓";const row=b.closest("tr");row.querySelectorAll('[data-act="syncuse"]').forEach(z=>z.disabled=true);
  if(![...b.closest(".cfbox").querySelectorAll('[data-act="syncuse"]')].some(z=>!z.disabled)){MYTOOL.dismissConflict(ds.at,ds.key);toast("Done — nothing was lost");render()}}catch(err){b.disabled=false;toast("Not done: "+(err.message||err),{ms:8000})}},true);
