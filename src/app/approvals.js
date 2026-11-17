/* ---------- Approvals: a second person (owner, 17 Nov 2026 – item 2) ----------
   - A payment above the approval limit (Setup › Rates & defaults, default £2,000) made by anyone except the Owner waits for approval
     – also when the maker is a Manager / Finance who may approve others.
   - The person who asked can never approve it (also enforced by the gateway, so no browser trick gets round it).
   - "Reject" needs a reason; the payment is set to "Not counted" and the person who asked gets a task.
   - Today shows "Waiting for your approval" to everyone who may approve. */
const apLimit=()=>+(DEF().approvalGbp||2000);
const apIsOwner=()=>S.role==="owner";
const apRequester=p=>String(p?.requestedBy||p?.createdBy||"").toLowerCase();
const apMe=()=>String(uid||"").toLowerCase();
const apWaiting=()=>live(D.payments).filter(p=>p.status!=="cancelled"&&p.needsApproval&&!p.approved);
/* saving a payment: decide here (not only "can this role approve?") */
const apWrite0=writeDoc;
writeDoc=function(col,id,data,labelTxt,opts){if(col==="payments"&&S._apSave&&data){const old=docOf("payments",id);const moved=!old||+old.amount!==+data.amount||old.cur!==data.cur;
  if(moved&&data.direction!=="in"&&data.status!=="cancelled"&&+data.gbp>apLimit()&&!apIsOwner()){Object.assign(data,{status:"pending",needsApproval:true,approved:false,requestedBy:uid||null,requestedAt:nowIso()});delete data.approvedBy;delete data.approvedAt;S._apNeeded=id}}
 return apWrite0.apply(this,arguments)};
const apSavePay0=savePay;
savePay=async function(){S._apSave=true;S._apNeeded=null;try{return await apSavePay0.apply(this,arguments)}finally{S._apSave=false;if(S._apNeeded){toast(`${S._apNeeded} saved — waiting for approval by someone else (above £${num(apLimit())})`,{ms:6000});S._apNeeded=null}}};
/* Approve: never by the person who asked */
document.addEventListener("click",e=>{const b=e.target.closest('[data-act="approve"]');if(!b)return;const p=docOf("payments",b.dataset.id);if(!p)return;
 if(apRequester(p)&&apRequester(p)===apMe()&&!apIsOwner()){e.preventDefault();e.stopImmediatePropagation();toast("You asked for this payment — someone else must approve it");return}},true);
/* Reject with a reason */
document.addEventListener("click",async e=>{const b=e.target.closest("[data-ap]");if(!b)return;e.preventDefault();e.stopImmediatePropagation();const id=b.dataset.id;const p=docOf("payments",id);if(!p)return;
 if(b.dataset.ap==="ask"){S.apAsk=id;render();setTimeout(()=>$("#ap_why")?.focus(),50);return}
 if(b.dataset.ap==="cancel"){S.apAsk=null;render();return}
 if(b.dataset.ap==="reject"){if(!can("approve")){toast("Only someone who may approve can reject");return}const why=String($("#ap_why")?.value||"").trim();if(why.length<3){toast("Write why it is rejected");$("#ap_why")?.focus();return}
  beginBatch(`${id} rejected`);try{await updateDoc("payments",id,{status:"cancelled",cancelReason:"rejected",cancelNote:why,cancelledAt:nowIso(),cancelledBy:uid||S.role,rejected:{why,by:uid||S.role,at:nowIso()}},`${id} rejected — ${why}`);
   const who=p.requestedBy||p.createdBy;if(who){const no=nextNo("tasks",today());await writeDoc("tasks",no,{no,id:no,title:`Payment ${id} (${fmt(p.amount,p.cur)} to ${pname(p.party)}) was rejected: ${why}`,who,due:today(),ref:id,status:"todo",by:uid,at:nowIso(),kind:"approval"},"Task for the requester")}}finally{await endBatch()}
  S.apAsk=null;toast(`${id} rejected — the person who asked has a task`);render()}},true);
/* the payment record: Reject next to Approve, and who asked */
function apBox(p){if(!p||p.status==="cancelled"||!p.needsApproval||p.approved)return"";const mine=apRequester(p)===apMe();
 const who=SET().users?.find(u=>String(u.uid||u.email||"").toLowerCase()===apRequester(p))?.name||p.requestedBy||p.createdBy||"—";
 return`<div class="warnbox apbox"><b>Waiting for approval</b> — asked by ${esc(who)}${p.requestedAt?" on "+fmtD(p.requestedAt.slice(0,10)):""} · above £${num(apLimit())}.${mine&&!apIsOwner()?` <span class="status">You asked for it, so someone else approves.</span>`:""}
  ${can("approve")&&!(mine&&!apIsOwner())?(S.apAsk===p.no?`<div class="inl" style="flex-wrap:wrap;gap:6px;margin-top:6px"><input id="ap_why" placeholder="Why is it rejected?" aria-label="Reason for rejecting" style="min-width:240px;min-height:40px"><button type="button" class="btn sm" data-ap="reject" data-id="${esc(p.no)}">Reject</button><button type="button" class="btn sm" data-ap="cancel" data-id="${esc(p.no)}">Back</button></div>`:`<div style="margin-top:6px"><button type="button" class="btn sm pri" data-act="approve" data-id="${esc(p.no)}">Approve</button> <button type="button" class="btn sm" data-ap="ask" data-id="${esc(p.no)}">Reject…</button></div>`):""}</div>`}
const apOpenPay0=typeof openPay==="function"?openPay:null;
if(apOpenPay0){openPay=function(x){const r=apOpenPay0.apply(this,arguments);try{const p=x&&typeof x==="object"?x:docOf("payments",x);const h=apBox(p);if(r&&h){r.body=h+r.body}if(r&&p?.rejected)r.body=`<div class="badbox">Rejected by ${esc(p.rejected.by)} on ${fmtD(p.rejected.at.slice(0,10))}: ${esc(p.rejected.why)}</div>`+r.body}catch(_){}return r}}
/* Today: what waits for me */
const apHome0=vHome;
vHome=function(v){const r=apHome0.apply(this,arguments);try{if(!can("approve")||!v||!v.insertAdjacentHTML)return r;const L_=apWaiting().filter(p=>apIsOwner()||apRequester(p)!==apMe());if(!L_.length)return r;
 const tot=L_.reduce((a,p)=>a+(+p.gbp||0),0);v.querySelector(".apcard")?.remove();
 const html=`<div class="card apcard"><div class="card-h"><h2>Waiting for your approval</h2><span class="status">${L_.length} · ${gbp(tot)}</span></div><div style="padding:6px 14px 12px">${L_.slice(0,8).map(p=>`<div class="aprow"><button type="button" class="lnk" data-open="payments" data-id="${esc(p.no)}">${esc(p.no)}</button> ${esc(fmt(p.amount,p.cur))} to <b>${esc(pname(p.party))}</b> <span class="status">${esc((p.allocations||[]).map(a=>a.ref).filter(Boolean).join(", "))}</span> <button type="button" class="btn sm pri" data-act="approve" data-id="${esc(p.no)}">Approve</button></div>`).join("")}${L_.length>8?`<div class="status">+${L_.length-8} more in Payments › Pending</div>`:""}</div></div>`;
 const hdr=v.querySelector(".hdr");if(hdr)hdr.insertAdjacentHTML("afterend",html);else v.insertAdjacentHTML("afterbegin",html)}catch(e){console.warn(e)}return r};
(function(){try{const st=document.createElement("style");st.textContent=`.aprow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--line,#eee)}.aprow:first-child{border-top:0}.aprow .btn{margin-left:auto}`;document.head.appendChild(st)}catch(_){}})();
