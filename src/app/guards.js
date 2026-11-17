/* ---------- Over-payment / over-shipment guard (owner, 17 Nov 2026 – item 1) ----------
   Payment: every order line of the payment shows what is still owed; putting MORE on an order than it still owes is stopped,
   with two ways out: "Set to what is owed" or "It is an advance" (reason kept on the line; the extra shows as money the
   supplier holds for us and is offered on the next payment to that supplier).
   Shipment: more packs than ordered (minus what other shipments carry) is stopped the same way: "Set to what is left" or
   "Extra goods sent" (reason kept on the line).
   Data health: orders paid more than their total without an advance reason are listed. */
const OV_TOL=0.5;
function ovRemainingPay(po,old){let st;try{st=poState(po)}catch(_){return null}const cur=po.cur||"RMB";let oldIn=0;
 if(old&&old.no){try{oldIn=poPayRows(po).filter(r=>r.no===old.no).reduce((a,r)=>a+(+r.inCur||0),0)}catch(_){}}
 return{cur,remaining:r2(st.balance+oldIn),st}}
function ovInCur(amt,from,to,date){if(from===to)return+amt||0;const a=toGbp(+amt||0,from,date),b=toGbp(1,to,date);return a==null||!b?null:r2(a/b)}
function ovPayList(o){const out=[];if(!o||o.direction==="in")return out;const old=S.drawer?.ctx?.edit||{};const kept=(o.allocations||[]).filter(allocKept);
 (o.allocations||[]).forEach((a,i)=>{if(!a.ref||isOtherAlloc(a)||+a.amount<0)return;const po=D.purchases.find(p=>p.no===a.ref&&!p.deletedAt);if(!po||!(poTotal(po)>0))return;
  const rm=ovRemainingPay(po,old);if(!rm)return;const amt=kept.length===1?+o.amount:(a.amount!=null&&a.amount!==""?+a.amount:+o.amount);const inCur=ovInCur(amt,o.cur||"RMB",rm.cur,o.date||today());if(inCur==null)return;
  const tol=(o.cur||"RMB")===rm.cur?OV_TOL:Math.max(OV_TOL,inCur*0.01);const extra=r2(inCur-Math.max(0,rm.remaining));
  out.push({i,ref:a.ref,cur:rm.cur,remaining:r2(Math.max(0,rm.remaining)),inCur,extra,over:extra>tol,adv:a.adv&&a.adv.why?a.adv:null,payCur:o.cur||"RMB",amt})});return out}
function ovShipList(o){const out=[];(o.lines||[]).forEach((l,i)=>{if(!l.po||!l.sku||!(+l.q>0))return;const p=D.purchases.find(x=>x.no===l.po&&!x.deletedAt);if(!p)return;
  const ordered=(p.lines||[]).filter(x=>x.sku===l.sku).reduce((s,x)=>s+(+x.q||0),0);if(!ordered)return;const other=shippedQty(l.po,l.sku,S.drawer?.id);
  /* the same order + product on several lines of THIS shipment counts together */const before=(o.lines||[]).slice(0,i).filter(x=>x.po===l.po&&x.sku===l.sku).reduce((s,x)=>s+(+x.q||0),0);
  const left=Math.max(0,ordered-other-before);const extra=+l.q-left;out.push({i,po:l.po,sku:l.sku,ordered,left,q:+l.q,extra,over:extra>0,adv:l.over&&l.over.why?l.over:null})});return out}
/* ---- payment ---- */
const ovValPay0=validatePay;
validatePay=function(o){const r=ovValPay0.apply(this,arguments);const L_=ovPayList(o);S.drawer._ov={kind:"pay",list:L_};
 L_.filter(x=>x.over&&!x.adv).forEach(x=>{r.errors.allocations=`${x.ref}: only ${fmt(x.remaining,x.cur)} is still owed, this payment puts ${fmt(x.inCur,x.cur)} on it (${fmt(x.extra,x.cur)} too much). Use "Set to what is owed" or "It is an advance" below.`});
 L_.filter(x=>x.over&&x.adv).forEach(x=>r.warnings.push(`${x.ref}: ${fmt(x.extra,x.cur)} more than owed — kept as an advance (${x.adv.why})`));
 /* the 150% "extra zero?" stop stays; it is clearer than ours, so ours does not repeat it */return r};
/* ---- shipment ---- */
const ovValShip0=validateShip;
validateShip=function(o){const r=ovValShip0.apply(this,arguments);r.warnings=r.warnings.filter(w=>!/ shipped vs \d+ ordered$/.test(w));const L_=ovShipList(o);S.drawer._ov={kind:"ship",list:L_};
 L_.filter(x=>x.over&&!x.adv).forEach(x=>{r.errors.lines=`${x.po} · ${product(x.sku)?.name||x.sku}: ${num(x.left)} packs left to ship (${num(x.ordered)} ordered), this line has ${num(x.q)}. Use "Set to what is left" or "Extra goods sent" below.`});
 L_.filter(x=>x.over&&x.adv).forEach(x=>r.warnings.push(`${x.po} ${x.sku}: ${num(x.extra)} packs more than ordered — ${x.adv.why}`));return r};
/* ---- the box with the two ways out, under the form's error list ---- */
const ovShow0=showErrors;
showErrors=function(errors,warnings){ovShow0.apply(this,arguments);try{ovPaint()}catch(e){console.warn(e)}};
function ovPaint(){const d=S.drawer;const w=$("#formwarn");if(!d||!w||!d._ov)return;w.querySelector(".ovbox")?.remove();const bad=d._ov.list.filter(x=>x.over&&!x.adv);if(!bad.length)return;
 const pay=d._ov.kind==="pay";
 w.insertAdjacentHTML("beforeend",`<div class="ovbox warnbox" role="group" aria-label="Too much">${bad.map(x=>pay?
  `<div class="ovrow"><b>${esc(x.ref)}</b> — still owed <b>${esc(fmt(x.remaining,x.cur))}</b>, this payment <b>${esc(fmt(x.inCur,x.cur))}</b>.<div class="ovact"><button type="button" class="btn sm pri" data-ov="fix" data-i="${x.i}">Set to what is owed</button> <input id="ov_why_${x.i}" placeholder="Why is it more? e.g. advance for the next order" aria-label="Reason for the extra" style="min-width:220px"> <button type="button" class="btn sm" data-ov="adv" data-i="${x.i}">It is an advance</button></div></div>`:
  `<div class="ovrow"><b>${esc(x.po)}</b> · ${esc(product(x.sku)?.name||x.sku)} — ${num(x.left)} packs left to ship, this line <b>${num(x.q)}</b>.<div class="ovact"><button type="button" class="btn sm pri" data-ov="fix" data-i="${x.i}">Set to what is left</button> <input id="ov_why_${x.i}" placeholder="Why more? e.g. free spares sent" aria-label="Reason for the extra" style="min-width:220px"> <button type="button" class="btn sm" data-ov="adv" data-i="${x.i}">Extra goods sent</button></div></div>`).join("")}</div>`)}
document.addEventListener("click",e=>{const b=e.target.closest("[data-ov]");if(!b||!S.drawer?._ov)return;e.preventDefault();e.stopPropagation();const d=S.drawer;const i=+b.dataset.i;const x=d._ov.list.find(y=>y.i===i);if(!x)return;const pay=d._ov.kind==="pay";const rk=pay?"allocations":"lines";const row=d.rows[rk]?.[i];if(!row)return;
 if(b.dataset.ov==="fix"){if(pay){const back=x.payCur===x.cur?x.remaining:r2(x.remaining*(x.amt/(x.inCur||1)));const kept=d.rows.allocations.filter(allocKept);row.amount=back;if(kept.length===1){setv("amount",back);d.changed.amount=true}}else row.q=x.left;delete row.adv;delete row.over;redrawRows(rk);try{pay?syncPay():syncShip()}catch(_){}d.dirty=true;toast(pay?`Set to ${fmt(x.remaining,x.cur)} — press Save again`:`Set to ${num(x.left)} packs — press Save again`)}
 else{const why=String($("#ov_why_"+i)?.value||"").trim();if(why.length<3){toast("Write the reason first (who agreed, what it is for)");$("#ov_why_"+i)?.focus();return}const v={why,by:(typeof uid!=="undefined"&&uid)||"local",at:nowIso()};if(pay)row.adv=v;else row.over=v;d.dirty=true;toast("Kept — press Save");}
 $(".ovbox")?.remove()},true);
/* ---- live: what is still owed / left, under the rows while typing ---- */
let ovT=null;
function ovLive(){const d=S.drawer;if(!d||!["payment","shipment"].includes(d.form))return;const host=$(d.form==="payment"?"#fw_allocations":"#fw_lines");if(!host)return;let box=host.querySelector(".ovlive");if(!box){host.insertAdjacentHTML("beforeend",`<div class="ovlive status" aria-live="polite"></div>`);box=host.querySelector(".ovlive")}
 let html="";try{if(d.form==="payment"){const o=collect("payment");const L_=ovPayList(o);html=L_.map(x=>`<div>${esc(x.ref)}: owed <b>${esc(fmt(x.remaining,x.cur))}</b> · this payment ${esc(fmt(x.inCur,x.cur))} ${x.over?(x.adv?`· <span class="pill p-warn">advance ${esc(fmt(x.extra,x.cur))}</span>`:`· <span class="pill p-bad">${esc(fmt(x.extra,x.cur))} too much</span>`):x.inCur<x.remaining-OV_TOL?`· after it <b>${esc(fmt(r2(x.remaining-x.inCur),x.cur))}</b> left`:"· ✓ settles it"}</div>`).join("");
   const pc=o.party;if(pc){const held=live(D.purchases).filter(p=>p.party===pc&&p.status!=="cancelled").map(p=>{try{return{p,v:poState(p).owedToUs}}catch(_){return null}}).filter(x=>x&&x.v>OV_TOL);if(held.length)html+=`<div class="ovheld">💡 ${esc(pname(pc))} holds money of ours: ${held.map(h=>`<b>${esc(fmt(h.v,h.p.cur||"RMB"))}</b> on ${esc(h.p.no)}${h.p.oldRef?" ("+esc([].concat(h.p.oldRef).join(", "))+")":""}`).join(" · ")} — take it off before paying more.</div>`}}
  else{const o=collect("shipment");html=ovShipList(o).map(x=>`<div>${esc(x.po)} · ${esc(product(x.sku)?.name||x.sku)}: ${num(x.left)} left to ship · this line ${num(x.q)} ${x.over?(x.adv?`<span class="pill p-warn">+${num(x.extra)} extra</span>`:`<span class="pill p-bad">${num(x.extra)} too many</span>`):x.q===x.left?"· ✓ all of it":""}</div>`).join("")}}catch(_){html=""}
 box.innerHTML=html}
document.addEventListener("input",e=>{if(!e.target.closest?.(".drawer"))return;clearTimeout(ovT);ovT=setTimeout(ovLive,300)},true);
document.addEventListener("change",e=>{if(!e.target.closest?.(".drawer"))return;clearTimeout(ovT);ovT=setTimeout(ovLive,150)},true);
document.addEventListener("click",e=>{if(e.target.closest?.('.drawer [data-act="addrow"],.drawer [data-act="rmrow"],.drawer [data-mp]')){clearTimeout(ovT);ovT=setTimeout(ovLive,250)}},true);
const ovOpen0=openForm;openForm=function(form){const r=ovOpen0.apply(this,arguments);if(form==="payment"||form==="shipment")setTimeout(ovLive,800);return r};
/* ---- Data health: paid more than the order without an advance reason ---- */
if(!HEALTH_RULES.some(r=>r[0]==="overpay"))HEALTH_RULES.push(["overpay","No order paid more than its total without a reason (advance)"]);
const ovHealth0=healthRun;
healthRun=function(force){const h=ovHealth0.apply(this,arguments);if(!h||h._ovDone)return h;h._ovDone=true;try{live(D.purchases).filter(p=>p.status!=="cancelled").forEach(p=>{let st;try{st=poState(p)}catch(_){return}if(!(st.owedToUs>OV_TOL))return;
  const why=paysFor(p.no).some(x=>(x.allocations||[]).some(a=>a.ref===p.no&&a.adv&&a.adv.why))||(p.notes&&/advance|owed to us|held by|refund due/i.test(p.notes));if(why)return;
  h.issues.push({rule:"overpay",sev:1,text:`${p.no}${p.oldRef?" ("+[].concat(p.oldRef).join(", ")+")":""} · paid ${fmt(st.owedToUs,p.cur||"RMB")} more than the order — mark the payment as an advance, or ask for it back`,col:"purchases",id:p.no})});
  const r=h.rules.find(r=>r.k==="overpay");const n=h.issues.filter(i=>i.rule==="overpay").length;if(r){r.n=n;r.ok=!n}else h.rules.push({k:"overpay",l:HEALTH_RULES.find(r=>r[0]==="overpay")[1],ok:!n,n})}catch(e){console.warn(e)}return h};
(function(){try{const st=document.createElement("style");st.textContent=`.ovbox .ovrow{padding:6px 0;border-top:1px dashed var(--line,#ddd)}.ovbox .ovrow:first-child{border-top:0}.ovact{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}.ovact input{min-height:40px}.ovlive{margin-top:6px;line-height:1.6}.ovheld{margin-top:4px}`;document.head.appendChild(st)}catch(_){}})();
