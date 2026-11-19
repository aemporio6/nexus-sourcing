/* ---------- Version history of every record — like Google Sheets (owner, 20 Nov 2026) ----------
   Undo used to live only on the device that made the change (last 20 steps). Now every change a person saves keeps the
   version from before it in the shared data ("versions"): who, when, what changed. Any record shows "🕘 History" with each
   version and "Restore this version" (needs the "Bring back" tick). Deleted records stay 90 days in the Recycle Bin.
   - automatic re-calculations are not versions (only what a person saved)
   - several saves of the same record by the same person within 2 minutes are one version (the oldest "before" is kept)
   - the last 15 versions of a record are kept, for 180 days; the Owner's app tidies older ones
   - the gateway lets nobody change or remove a version (see tools/gateway.gs) */
const HV_COLS=new Set(["parties","products","purchases","shipments","payments","inspections","receipts","credits","moves"]);
const HV_SKIP=new Set(["updatedAt","updatedBy","rev","_rev","search","id"]);
D.versions=D.versions||[];
function hvList(col,id){return(D.versions||[]).filter(v=>v.col===col&&v.ref===id).sort((a,b)=>a.at<b.at?1:-1)}
function hvSave(entry){if(!entry||!HV_COLS.has(entry.col)||!entry.before||!db)return;const col=entry.col,id=entry.id;const now=nowIso();const last=hvList(col,id)[0];
 if(!hvForce&&last&&last.by===(uid||"local")&&Date.parse(now)-Date.parse(last.at)<120000)return;
 const v={id:`${col}:${id}:${Date.now().toString(36)}`,col,ref:id,at:now,by:uid||"local",byName:SET().users?.find(u=>u.uid===uid)?.name||S.role,label:entry.label||"",before:JSON.parse(JSON.stringify(entry.before))};
 hvForce=false;D.versions.push(v);db.collection("versions").doc(v.id).set(v).catch(()=>{})}
let hvForce=false;
const hvPush0=pushUndo;
pushUndo=function(entry){try{hvSave(entry)}catch(e){console.warn("history",e)}return hvPush0.apply(this,arguments)};
/* load + tidy */
let hvOn=false;
setInterval(()=>{try{if(hvOn||!S.ready||!db)return;hvOn=true;db.collection("versions").onSnapshot(s=>{D.versions=s.docs.map(d=>({...d.data(),id:d.id}));if(S.isOwner)hvTidy()})}catch(_){hvOn=false}},2500);
let hvTidied=false;
async function hvTidy(){if(hvTidied)return;hvTidied=true;try{const cut=new Date(Date.now()-180*864e5).toISOString();const by={};(D.versions||[]).forEach(v=>{(by[v.col+"|"+v.ref]=by[v.col+"|"+v.ref]||[]).push(v)});const drop=[];Object.values(by).forEach(a=>{a.sort((x,y)=>x.at<y.at?1:-1);a.forEach((v,i)=>{if(i>=15||v.at<cut)drop.push(v.id)})});
 for(const id of drop.slice(0,400)){try{await db.collection("versions").doc(id).delete()}catch(_){}}}catch(e){console.warn(e)}}
/* what changed between two states, in plain words */
function hvDiff(a,b){const out=[];const ks=new Set([...Object.keys(a||{}),...Object.keys(b||{})]);ks.forEach(k=>{if(HV_SKIP.has(k)||k.startsWith("_"))return;const x=a?.[k],y=b?.[k];if(JSON.stringify(x??null)===JSON.stringify(y??null))return;
  const show=v=>v==null||v===""?"empty":Array.isArray(v)?`${v.length} line${v.length===1?"":"s"}`:typeof v==="object"?"…":String(v).slice(0,40);out.push(k==="deletedAt"?(y?"deleted":"brought back"):`${k}: ${show(x)} → ${show(y)}`)});return out}
function hvHtml(col,doc){const vs=hvList(col,doc.id||doc.no||doc.code||doc.sku);if(!vs.length)return`<details class="hvbox"><summary>🕘 History</summary><div class="status" style="padding:8px 2px">No earlier versions yet — from now on every saved change is kept here (who, when, what) and can be brought back.</div></details>`;
 const rows=vs.map((v,i)=>{const next=i===0?doc:vs[i-1].before;const ch=hvDiff(v.before,next);return`<div class="hvrow"><div><b>${esc(fmtD(v.at.slice(0,10)))} ${esc(v.at.slice(11,16))}</b> · ${esc(v.byName||v.by)}<div class="status">${esc(ch.slice(0,6).join(" · ")||v.label||"saved")}${ch.length>6?` · +${ch.length-6} more`:""}</div></div>${can("restore")?`<button type="button" class="btn sm" data-hv="${esc(v.id)}">Restore to before this</button>`:""}</div>`}).join("");
 return`<details class="hvbox"><summary>🕘 History — ${vs.length} earlier version${vs.length===1?"":"s"}</summary>${rows}<div class="status" style="padding:6px 2px">Restoring is itself a new version, so nothing is ever lost.</div></details>`}
/* the record panel: every kind of record gets the History box */
const HV_OPEN={openPO:"purchases",openPay:"payments",openShip:"shipments",openReceipt:"receipts",openParty:"parties",openProduct:"products",openInsp:"inspections"};
function hvWrap(fn,col){return function(x){const r=fn.apply(this,arguments);try{if(!r||typeof r.body!=="string")return r;const key=x&&typeof x==="object"?(x.id||x.no||x.code||x.sku):x;const doc=(D[col]||[]).find(d=>d.id===key||d.no===key||d.code===key||d.sku===key);if(doc)r.body+=hvHtml(col,doc)}catch(e){console.warn("history box",e)}return r}}
openPO=hvWrap(openPO,"purchases");openPay=hvWrap(openPay,"payments");openShip=hvWrap(openShip,"shipments");openReceipt=hvWrap(openReceipt,"receipts");openParty=hvWrap(openParty,"parties");openProduct=hvWrap(openProduct,"products");openInsp=hvWrap(openInsp,"inspections");
document.addEventListener("click",async e=>{const b=e.target.closest("[data-hv]");if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(!can("restore")){toast("Bringing back a version is not allowed for you");return}const v=(D.versions||[]).find(x=>x.id===b.dataset.hv);if(!v)return;
 if(typeof alVerify==="function"&&!(await alVerify("Restore an earlier version")))return;if(!confirm(`Put ${v.ref} back to how it was on ${fmtD(v.at.slice(0,10))} ${v.at.slice(11,16)}?\nThe way it is now is kept as a version too.`))return;
 hvForce=true;let ok;try{ok=await writeDoc(v.col,v.ref,{...v.before,id:v.ref},`${v.ref} restored to the version of ${fmtD(v.at.slice(0,10))} ${v.at.slice(11,16)}`)}finally{hvForce=false}if(ok!==false){toast(`${v.ref} restored`);render()}},true);
(function(){try{const st=document.createElement("style");st.textContent=`.hvbox{margin-top:14px;border-top:1px solid var(--line);padding-top:10px}.hvbox>summary{cursor:pointer;font-weight:600}.hvrow{display:flex;gap:10px;justify-content:space-between;align-items:flex-start;padding:8px 2px;border-bottom:1px solid var(--line)}.hvrow .status{margin-top:2px;word-break:break-word}`;document.head.appendChild(st)}catch(_){}})();
