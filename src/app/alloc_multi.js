/* ---------- Payment: pay several orders / shipments at once, with an amount per item ----------
   "+ Several orders / shipments…" lists everything still owed to this party; tick several → one line each,
   pre-filled with what is still owed (in the payment currency when it is the same), then the total goes into Amount. */
function owedRefsFor(partyCode,cur){const out=[];if(!partyCode)return out;
 live(D.purchases).filter(p=>p.party===partyCode&&p.status!=="cancelled").forEach(p=>{let st;try{st=poState(p)}catch(_){return}if(st.outstandingCur>0.5)out.push({ref:p.no,what:(p.oldRef?p.oldRef+" · ":"")+String((p.lines||[]).map(l=>l.p||l.sku).filter(Boolean)[0]||"order").slice(0,48),owed:st.outstandingCur,cur:p.cur||"RMB"})});
 live(D.shipments).filter(s=>s.party===partyCode&&s.status!=="cancelled").forEach(s=>{const c=s.costCur||"USD";const tot=(+s.cost||0)*(1+(+s.platformFeePct||0)/100)+(+s.insurance||0);let paid=0;try{paid=paysFor(s.no).reduce((a,x)=>a+paidIn(x,s.no,c),0)}catch(_){}if(tot-paid>0.5)out.push({ref:s.no,what:(s.oldRef?s.oldRef+" · ":"")+(s.ctn?s.ctn+" ctn · ":"")+(L("mode",s.mode)||""),owed:r2(tot-paid),cur:c})});
 return out}
rowsHtml=(function(orig){return function(f){let h=orig(f);if(f.k==="allocations"&&S.drawer&&S.drawer.form==="payment")h=h.replace(`<button type="button" class="btn sm" data-act="addrow" data-rows="allocations">`,`<button type="button" class="btn sm" data-act="allocmulti">+ Several orders / shipments…</button> <button type="button" class="btn sm" data-act="addrow" data-rows="allocations">`);return h}})(rowsHtml);
document.addEventListener("click",e=>{const b=e.target.closest('[data-act="allocmulti"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();
 const party=val("party");const pcur=val("cur")||"RMB";if(!party){toast("Choose the party first");return}
 const have=new Set(rowsOf("allocations").map(r=>r.ref).filter(Boolean));const list=owedRefsFor(party,pcur).filter(x=>!have.has(x.ref));
 document.getElementById("mpick")?.remove();const box=document.createElement("div");box.id="mpick";box.className="mpick";box.setAttribute("role","dialog");box.setAttribute("aria-label","Pay several");
 box.innerHTML=`<div class="mp-h"><b>Still owed to ${esc(pname(party))}</b> — tick what this payment covers</div>${list.length?`<div class="mp-l">${list.map((x,i)=>`<label><input type="checkbox" value="${i}"> <span style="flex:1"><b>${esc(x.ref)}</b> <small class="status">${esc(x.what)}</small></span><b class="num">${esc(fmt(x.owed,x.cur))}</b></label>`).join("")}</div>`:`<div class="status">Nothing open for this party.</div>`}<div class="mp-f"><span class="status" id="mp_tot" style="margin-right:auto"></span><button type="button" class="btn sm" data-mp="cancel">Cancel</button><button type="button" class="btn sm pri" data-mp="ok" ${list.length?"":"disabled"}>Add lines</button></div>`;
 document.body.appendChild(box);const r=b.getBoundingClientRect();box.style.width="min(420px,94vw)";box.style.top=Math.max(8,Math.min(r.bottom+4,innerHeight-box.offsetHeight-8))+"px";box.style.left=Math.max(8,Math.min(r.left,innerWidth-box.offsetWidth-8))+"px";
 const sel=()=>[...box.querySelectorAll(".mp-l input:checked")].map(i=>list[+i.value]);
 const upd=()=>{const s=sel();const same=s.filter(x=>x.cur===pcur);box.querySelector("#mp_tot").textContent=s.length?`${s.length} ticked${same.length?" · "+fmt(same.reduce((a,x)=>a+x.owed,0),pcur):""}${same.length<s.length?" (+ other currency)":""}`:""};
 box.addEventListener("change",upd);
 const close=()=>{box.remove();document.removeEventListener("mousedown",out,true)};const out=ev=>{if(!box.contains(ev.target))close()};setTimeout(()=>document.addEventListener("mousedown",out,true),0);
 box.addEventListener("click",ev=>{const x=ev.target.closest("[data-mp]");if(!x)return;if(x.dataset.mp==="cancel")return close();const s=sel();if(!s.length)return close();
  const rows=rowsOf("allocations");if(rows.length===1&&!rows[0].ref&&!rows[0].amount)rows.length=0;
  s.forEach(it=>rows.push({ref:it.ref,amount:it.cur===pcur?r2(it.owed):""}));redrawRows("allocations");
  const sum=r2(rows.reduce((a,r)=>a+(+r.amount||0),0));if(!(+val("amount")>0)&&sum>0)setv("amount",sum);
  try{markDirty();if(S.drawer)S.drawer.changed["rows:allocations"]=true;syncCurrent()}catch(_){}close();
  const other=s.filter(it=>it.cur!==pcur);toast(`${s.length} line${s.length>1?"s":""} added${other.length?` — type the ${pcur} amount for ${other.map(o=>o.ref).join(", ")} (billed in ${other[0].cur})`:""}`,{ms:6000})})},true);
