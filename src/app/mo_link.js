/* ---------- Link with MoreOrderz (12 Nov 2026) ----------
   Owner: "whatever goes to or comes from that tool — even a single word — only with permission; the permission can be Always, Ask every time, or Never."
   · One switch turns the whole link on or off. Off = nothing leaves and nothing comes in.
   · Permissions per kind of data and per direction (send / receive): Always · Ask every time · Never.
   · Ask: a review window lists every record and every field (old → new for incoming) with its own tick box; only ticked items move.
   · Bank details are never sent unless "Include bank details" is ticked.
   · Incoming never deletes anything; a deletion from MoreOrderz is only shown.
   · Transport: a link file today (download / load); the direct connection (address + link key) starts working as soon as MoreOrderz
     has the two endpoints in docs/moreorderz-link.md. The link key stays on this device only, never in the data file.
   · Every send / receive is written to the Activity log. */
const MO_KINDS=[["purchases","Orders (POs)"],["shipments","Shipments"],["payments","Payments"],["inspections","Inspections"],["receipts","Goods received"],["moves","Stock moves"],["credits","Credit notes"],["products","Products"],["parties","Suppliers & partners"],["tasks","Tasks"],["salesStats","Marketplace sales"]];
const MO_MODES=[["ask","Ask every time"],["always","Always"],["never","Never"]];
const MO_BANK=["bank","beneficiary","iban","swift","account","sortCode"];
if(!PAGES.includes("molink"))PAGES.push("molink");
function moCfg(){const c=(SET().moLink)||{};return{on:!!c.on,url:c.url||"",bank:!!c.bank,auto:!!c.auto,send:{...(c.send||{})},recv:{...(c.recv||{})},lastSent:{...(c.lastSent||{})},sent:{...(c.sent||{})},lastRecv:c.lastRecv||null,history:(c.history||[]).slice(-30)}}
function moMode(dir,kind){const c=moCfg();return(c[dir]||{})[kind]||"ask"}
async function moSave(patch){const c={...moCfg(),...patch};await setupPatchMany([[["moLink"],c]],"Link with MoreOrderz")}
function moKey(){try{return localStorage.getItem("mt_mo_key")||""}catch(_){return""}}
function moSetKey(k){try{k?localStorage.setItem("mt_mo_key",k):localStorage.removeItem("mt_mo_key")}catch(_){}}
function moStrip(x,bank){const o=JSON.parse(JSON.stringify(x));if(!bank)MO_BANK.forEach(k=>delete o[k]);delete o._arch;return o}
/* ---- what would be sent ---- */
function moPrepare(){const c=moCfg();const items=[],blocked={};MO_KINDS.forEach(([k])=>{const mode=moMode("send",k);/* per record: sent once at this version → not offered again; declined or unticked → offered next time */const recs=(D[k]||[]).filter(x=>{if(x._arch)return false;const id=String(x.no||x.sku||x.code||x.id);const v=String(x.updatedAt||x.createdAt||x.at||"0");return c.sent[k+"|"+id]!==v});if(!recs.length)return;
 if(mode==="never"){blocked[k]=recs.length;return}recs.forEach(x=>items.push({kind:k,id:String(x.no||x.sku||x.code||x.id),op:x.deletedAt?"delete":"upsert",data:moStrip(x,c.bank),mode}))});return{items,blocked}}
function moPackage(items){return{format:"mytool-link-1",from:"MY TOOL",company:"Vartleaves Limited",sentAt:nowIso(),sentBy:uid,items:items.map(({kind,id,op,data})=>({kind,id,op,data}))}}
/* ---- review window: every record, every field, its own tick box ---- */
function moVal(v){if(v==null||v==="")return"—";if(typeof v==="object")return JSON.stringify(v).slice(0,300);return String(v).slice(0,300)}
function moReview({title,sub,groups,okLabel,onOk}){const o=document.createElement("div");o.id="moRev";o.className="ch-ov";
 o.innerHTML=`<div class="ch-box mo-box" role="dialog" aria-modal="true" aria-labelledby="mo_t"><div class="ch-h"><div><h2 id="mo_t">${esc(title)}</h2><div class="status">${sub}</div></div><button class="x" data-act="moclose" aria-label="Close">×</button></div>
 <div class="mo-tools"><button class="btn sm" data-act="moall" data-v="1">Tick all</button><button class="btn sm" data-act="moall" data-v="0">Untick all</button></div>
 <div class="mo-list">${groups.map((g,gi)=>`<details class="mo-it" ${groups.length<=8?"open":""}><summary><label class="chk"><input type="checkbox" class="mo-item" data-g="${gi}" ${g.pre?"checked":""}> <b>${esc(g.head)}</b></label> <span class="status">${esc(g.note||"")}</span></summary>
  <table class="mo-f">${g.fields.map((f,fi)=>`<tr><td><label class="chk"><input type="checkbox" class="mo-field" data-g="${gi}" data-f="${fi}" ${g.pre?"checked":""}> ${esc(f.k)}</label></td>${f.old!==undefined?`<td class="mo-old">${esc(moVal(f.old))}</td><td>→</td>`:""}<td class="mo-new">${esc(moVal(f.v))}</td></tr>`).join("")}</table></details>`).join("")||`<div class="empty">Nothing to review.</div>`}</div>
 <div class="mo-foot"><span class="status" id="mo_cnt"></span><button class="btn" data-act="moclose">Decline</button><button class="btn pri" data-act="mook">${esc(okLabel)}</button></div></div>`;
 document.body.appendChild(o);const cnt=()=>{const n=o.querySelectorAll(".mo-item:checked").length;$("#mo_cnt").textContent=`${n} of ${groups.length} ticked`};cnt();
 o.addEventListener("change",e=>{const t=e.target;if(t.classList.contains("mo-item"))o.querySelectorAll(`.mo-field[data-g="${t.dataset.g}"]`).forEach(x=>x.checked=t.checked);if(t.classList.contains("mo-field")){const g=t.dataset.g;const any=o.querySelectorAll(`.mo-field[data-g="${g}"]:checked`).length;o.querySelector(`.mo-item[data-g="${g}"]`).checked=any>0}cnt()});
 o.addEventListener("click",async e=>{const t=e.target.closest("[data-act]");if(!t)return;const a=t.dataset.act;if(a==="moclose"){o.remove();toast("Declined — nothing moved")}else if(a==="moall"){o.querySelectorAll(".mo-item,.mo-field").forEach(x=>x.checked=t.dataset.v==="1");cnt()}else if(a==="mook"){const pick=groups.map((g,gi)=>({g,fields:g.fields.filter((f,fi)=>o.querySelector(`.mo-field[data-g="${gi}"][data-f="${fi}"]`)?.checked)})).filter(p=>p.fields.length);o.remove();await onOk(pick)}})}
/* ---- send ---- */
async function moSend(){const c=moCfg();if(!c.on){toast("The link is off — turn it on first");return}const{items,blocked}=moPrepare();const nb=Object.values(blocked).reduce((a,b)=>a+b,0);
 if(!items.length){toast("Nothing new to send"+(nb?` (${nb} blocked by "Never")`:""));return}
 const auto=items.filter(i=>i.mode==="always"),ask=items.filter(i=>i.mode==="ask");
 const finish=async list=>{if(!list.length){toast("Nothing sent");return}await moDeliver(list,nb)};
 if(!ask.length)return finish(auto);
 moReview({title:"Send to MoreOrderz?",sub:`${ask.length} record(s) need your yes (Ask every time). ${auto.length?auto.length+" more go by themselves (Always). ":""}${nb?nb+" blocked (Never). ":""}Untick any record or field that should not go.`,okLabel:"Send ticked",
  groups:ask.map(i=>({head:(COL_LABEL[i.kind]||i.kind)+" · "+i.id+(i.op==="delete"?" (in Trash)":""),note:i.kind,pre:true,item:i,fields:Object.entries(i.data).map(([k,v])=>({k,v}))})),
  onOk:async pick=>finish(auto.concat(pick.map(p=>({...p.g.item,data:Object.fromEntries(p.fields.map(f=>[f.k,f.v]))}))))})}
async function moDeliver(list,blocked){const c=moCfg();const pkg=moPackage(list);let how="file";
 if(c.url&&moKey()){try{const r=await fetch(c.url.replace(/\/+$/,"")+"/api/mytool/receive",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+moKey()},body:JSON.stringify(pkg)});if(!r.ok)throw new Error("MoreOrderz answered "+r.status);how="direct"}catch(e){toast("Direct send failed ("+e.message+") — saved as a link file instead");how="file"}}
 if(how==="file"){const b=new Blob([JSON.stringify(pkg,null,1)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="MYTOOL-to-MoreOrderz-"+nowIso().slice(0,16).replace(/[:T]/g,"")+".json";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
 const ls_={...c.lastSent};const kinds=[...new Set(list.map(i=>i.kind))];kinds.forEach(k=>ls_[k]=nowIso());const sent={...c.sent};list.forEach(i=>{const x=docOf(i.kind,i.id);sent[i.kind+"|"+i.id]=String(x&&(x.updatedAt||x.createdAt||x.at)||"0")});
 await moSave({lastSent:ls_,sent,history:[...c.history,{at:nowIso(),by:uid,dir:"send",n:list.length,blocked:blocked||0,how,ids:list.slice(0,40).map(i=>i.id)}]});
 logEv("link","setup","main",`Sent to MoreOrderz (${how==="direct"?"direct":"link file"}): ${list.length} record(s) — ${list.slice(0,20).map(i=>i.id).join(", ")}${list.length>20?"…":""}`);toast(`Sent ${list.length} record(s) to MoreOrderz${how==="file"?" as a link file":""}`);if(S.view.k==="molink")render()}
/* ---- receive ---- */
function moDiff(cur,inc){const out=[];Object.entries(inc||{}).forEach(([k,v])=>{if(["id","no","createdAt","createdBy","updatedAt","updatedBy","_arch"].includes(k))return;const a=cur?cur[k]:undefined;if(JSON.stringify(a)!==JSON.stringify(v))out.push({k,v,old:cur?(a===undefined?null:a):undefined})});return out}
async function moReceive(pkg,src){const c=moCfg();if(!c.on){toast("The link is off — turn it on first");return}
 if(!pkg||!/^(moreorderz|mytool)-link-1$/.test(pkg.format||"")||!Array.isArray(pkg.items)){toast("This is not a MoreOrderz link file");return}
 const known=new Set(MO_KINDS.map(k=>k[0]));const skip=[],blocked=[],auto=[],ask=[],dels=[];
 pkg.items.forEach(it=>{if(!known.has(it.kind)){skip.push(it);return}if(it.op==="delete"){dels.push(it);return}const mode=moMode("recv",it.kind);const cur=docOf(it.kind,it.id);const diff=moDiff(cur,it.data);if(!diff.length)return;const row={...it,cur,diff,mode};if(mode==="never")blocked.push(row);else if(mode==="always")auto.push(row);else ask.push(row)});
 const apply=async rows=>{let n=0;for(const r of rows){const ch=Object.fromEntries(r.diff.map(f=>[f.k,f.v]));if(!Object.keys(ch).length)continue;if(r.cur)await updateDoc(r.kind,r.id,{...ch,linkFrom:"MoreOrderz",linkAt:nowIso()},"From MoreOrderz");else{if(!can("create"))continue;const nd={...ch,id:r.id,linkFrom:"MoreOrderz",linkAt:nowIso()};if(r.kind==="products")nd.sku=nd.sku||r.id;else if(r.kind==="parties")nd.code=nd.code||r.id;else nd.no=r.id;await writeDoc(r.kind,r.id,nd,"From MoreOrderz")}n++}
  await moSave({lastRecv:nowIso(),history:[...moCfg().history,{at:nowIso(),by:uid,dir:"receive",n,blocked:blocked.length,skipped:skip.length,deletes:dels.length,how:src}]});
  logEv("link","setup","main",`Received from MoreOrderz (${src}): ${n} record(s) applied${blocked.length?`, ${blocked.length} blocked by Never`:""}${skip.length?`, ${skip.length} of kinds MY TOOL does not keep`:""}${dels.length?`, ${dels.length} deletion(s) only shown`:""} — ${rows.slice(0,20).map(r=>r.id).join(", ")}`);
  toast(`From MoreOrderz: ${n} record(s) applied`);if(S.view.k==="molink")render()};
 const info=`${blocked.length?blocked.length+" blocked (Never). ":""}${skip.length?skip.length+" of kinds MY TOOL does not keep (left out). ":""}${dels.length?dels.length+" deletion(s) from MoreOrderz are only listed, nothing is removed here. ":""}`;
 if(!ask.length){await apply(auto);if(info)toast(info);return}
 moReview({title:"Accept from MoreOrderz?",sub:`${ask.length} record(s) need your yes. ${auto.length?auto.length+" more come in by themselves (Always). ":""}${info}Each field shows what MY TOOL has now → what MoreOrderz sends.`,okLabel:"Accept ticked",
  groups:ask.map(r=>({head:(COL_LABEL[r.kind]||r.kind)+" · "+r.id+(r.cur?"":" (new)"),note:r.diff.length+" field(s)",pre:false,row:r,fields:r.diff})),
  onOk:async pick=>apply(auto.concat(pick.map(p=>({...p.g.row,diff:p.fields})))) })}
async function moPull(){const c=moCfg();if(!c.url||!moKey()){toast("Add the MoreOrderz address and link key first, or load a link file");return}
 try{const r=await fetch(c.url.replace(/\/+$/,"")+"/api/mytool/send?since="+encodeURIComponent(c.lastRecv||""),{headers:{"Authorization":"Bearer "+moKey()}});if(!r.ok)throw new Error("MoreOrderz answered "+r.status);await moReceive(await r.json(),"direct")}catch(e){toast("Could not reach MoreOrderz: "+e.message)}}
async function moTest(){const c=moCfg();if(!c.url){toast("Write the MoreOrderz address first");return}try{const r=await fetch(c.url.replace(/\/+$/,"")+"/api/mytool/hello",{headers:{"Authorization":"Bearer "+moKey()}});const j=await r.json().catch(()=>({}));toast(r.ok?"Connected to MoreOrderz"+(j.company?" · "+j.company:""):"MoreOrderz answered "+r.status)}catch(e){toast("No answer from "+c.url+" — MoreOrderz needs the link endpoints first (see the guide on this page)")}}
/* ---- the page ---- */
function vMoLink(v){const c=moCfg();const adm=can("setup");const pend=moPrepare();const nPend=pend.items.length;
 const sel=(dir,k)=>`<select data-act="momode" data-dir="${dir}" data-k="${k}" ${adm?"":"disabled"} aria-label="${dir==="send"?"Send":"Receive"} ${k}">${MO_MODES.map(([m,l])=>`<option value="${m}" ${moMode(dir,k)===m?"selected":""}>${l}</option>`).join("")}</select>`;
 v.innerHTML=`<div class="hdr"><div><h1>Link with MoreOrderz</h1><p class="sub">Nothing moves between MY TOOL and MoreOrderz without permission — not even one word. You choose, for each kind of data and each direction: <b>Always</b>, <b>Ask every time</b> or <b>Never</b>.</p></div></div>
 <div class="card"><div class="card-h"><h2>Link</h2><span class="pill ${c.on?"p-ok":"p-mute"}">${c.on?"ON":"OFF"}</span></div><div class="form">
  <div class="f"><label class="chk"><input type="checkbox" data-act="moon" ${c.on?"checked":""} ${adm?"":"disabled"}> Link is on</label><small class="status">Off = nothing goes out and nothing comes in.</small></div>
  <div class="f"><label class="chk"><input type="checkbox" data-act="mobank" ${c.bank?"checked":""} ${adm?"":"disabled"}> Include bank details when sending</label><small class="status">Off by default.</small></div>
  <div class="f w"><label for="mo_url">MoreOrderz address</label><input id="mo_url" type="url" placeholder="https://your-moreorderz-address" value="${esc(c.url)}" ${adm?"":"disabled"}></div>
  <div class="f"><label for="mo_key">Link key (kept on this device only)</label><input id="mo_key" type="password" autocomplete="off" placeholder="${moKey()?"•••••• saved":"from MoreOrderz › Settings"}"></div>
  <div class="f" style="align-self:end;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="mosavecon" ${adm?"":"disabled"}>Save</button><button class="btn" data-act="motest">Test connection</button></div></div></div>
 <div class="card"><div class="card-h"><h2>Permissions</h2><span class="status">per kind of data · per direction</span></div><div class="tbl"><table><tr><th>Data</th><th>Send to MoreOrderz</th><th>Receive from MoreOrderz</th></tr>${MO_KINDS.map(([k,l])=>`<tr><td><b>${esc(l)}</b></td><td>${sel("send",k)}</td><td>${sel("recv",k)}</td></tr>`).join("")}</table></div>
  <div style="padding:8px 14px;display:flex;gap:8px;flex-wrap:wrap">${adm?`<button class="btn sm" data-act="moallmode" data-m="ask">All: Ask every time</button><button class="btn sm" data-act="moallmode" data-m="never">All: Never</button>`:""}</div></div>
 <div class="card"><div class="card-h"><h2>Exchange</h2><span class="status">${nPend} record(s) changed since the last send${Object.keys(pend.blocked).length?" · some blocked by Never":""}</span></div><div style="padding:12px 14px;display:flex;gap:8px;flex-wrap:wrap">
  <button class="btn pri" data-act="mosend" ${c.on?"":"disabled"}>⬆ Send to MoreOrderz…</button><button class="btn" data-act="mopull" ${c.on?"":"disabled"}>⬇ Get from MoreOrderz</button><label class="btn ${c.on?"":"disabled"}">⬇ Load a link file<input type="file" accept=".json,application/json" data-act="mofile" hidden ${c.on?"":"disabled"}></label></div>
  <p class="note" style="padding:0 14px 12px">Today the exchange works with link files (send = a file to load in MoreOrderz; receive = a file from MoreOrderz). The direct connection starts once MoreOrderz has its two link endpoints — the guide for its developer is in the MY TOOL code (docs/moreorderz-link.md).</p></div>
 <div class="card"><div class="card-h"><h2>History</h2><span class="status">also in the Activity log</span></div>${c.history.length?`<div class="tbl"><table><tr><th>When</th><th>Direction</th><th>Records</th><th>Blocked</th><th>How</th><th>By</th></tr>${c.history.slice().reverse().map(h=>`<tr><td>${fmtD(h.at.slice(0,10))} ${h.at.slice(11,16)}</td><td>${h.dir==="send"?"⬆ Sent":"⬇ Received"}</td><td>${h.n}${h.ids?`<br><small class="status">${esc(h.ids.slice(0,8).join(", "))}${h.ids.length>8?"…":""}</small>`:""}</td><td>${h.blocked||0}</td><td>${esc(h.how||"")}</td><td>${esc(typeof tkName==="function"?tkName(h.by):h.by)}</td></tr>`).join("")}</table></div>`:`<div class="empty">Nothing exchanged yet.</div>`}</div>`}
VIEWS=(function(o){return function(){return{...o(),molink:vMoLink}}})(VIEWS);
try{const s=NAV_MODULES.find(m=>m.k==="setup");if(s&&!s.items.some(i=>i[1]==="molink"))s.items.splice(1,0,["Link with MoreOrderz","molink"]);NAV_OF_PAGE.molink="setup";PAGE_TITLE.molink="Link with MoreOrderz"}catch(_){}
document.addEventListener("change",async e=>{const t=e.target;const a=t.dataset?.act;if(!a)return;
 if(a==="momode"){const c=moCfg();const d=t.dataset.dir;await moSave({[d]:{...c[d],[t.dataset.k]:t.value}});toast(`${t.dataset.dir==="send"?"Send":"Receive"} · ${t.dataset.k}: ${MO_MODES.find(m=>m[0]===t.value)[1]}`)}
 else if(a==="moon"){await moSave({on:t.checked});toast(t.checked?"Link ON":"Link OFF — nothing goes or comes");render()}
 else if(a==="mobank"){await moSave({bank:t.checked})}
 else if(a==="mofile"){const f=t.files?.[0];if(!f)return;try{await moReceive(JSON.parse(await f.text()),"file "+f.name)}catch(err){toast("Could not read "+f.name+": "+err.message)}t.value=""}});
document.addEventListener("click",async e=>{const t=e.target.closest("[data-act]");if(!t)return;const a=t.dataset.act;
 if(a==="mosend"){e.preventDefault();await moSend()}else if(a==="mopull"){e.preventDefault();await moPull()}else if(a==="motest"){e.preventDefault();await moTest()}
 else if(a==="mosavecon"){e.preventDefault();const url=($("#mo_url")?.value||"").trim();if(url&&!/^https:\/\//i.test(url)){toast("The address must start with https://");return}const k=($("#mo_key")?.value||"").trim();if(k)moSetKey(k);await moSave({url});toast("Saved"+(k?" (key kept on this device)":""));render()}
 else if(a==="moallmode"){e.preventDefault();const m=t.dataset.m;const o=Object.fromEntries(MO_KINDS.map(k=>[k[0],m]));await moSave({send:o,recv:{...o}});render()}});
/* MoreOrderz waiting for a yes shows in Alerts */
attention=(function(o){return function(){const a=o();try{const c=moCfg();if(c.on){const n=moPrepare().items.filter(i=>i.mode==="ask").length;if(n)a.push({sev:1,text:`${n} change(s) wait for your yes before going to MoreOrderz`,view:"molink",d:today()})}}catch(_){}return a}})(attention);
(function(){try{const st=document.createElement("style");st.textContent=`.mo-box{width:min(920px,100%)}.mo-tools{display:flex;gap:6px}.mo-list{overflow:auto;display:flex;flex-direction:column;gap:6px}.mo-it{border:1px solid var(--line);border-radius:10px;padding:6px 10px}.mo-it summary{cursor:pointer;display:flex;gap:8px;align-items:center;min-height:36px}
.mo-f{width:100%;border-collapse:collapse;font-size:13px}.mo-f td{padding:3px 6px;border-top:1px solid var(--line);vertical-align:top;word-break:break-word}.mo-old{color:var(--muted);text-decoration:line-through}.mo-new{font-weight:600}.mo-foot{display:flex;gap:8px;align-items:center;justify-content:flex-end}.mo-foot .status{margin-right:auto}`;document.head.appendChild(st)}catch(_){}})();
