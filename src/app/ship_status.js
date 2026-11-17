/* ---------- Shipment status vs goods received (owner, 18 Nov 2026) ----------
   Bug seen: SH-26-0056 was set back to "In transit", but a receipt (RC-26-0001, all 2,742 packs) existed, so the automatic rule put it
   straight back to "Delivered" — without saying why. Now:
   - Saving a shipment as Booked / In transit / Arrived while goods are booked as received on it is stopped with the reason and a button
     "Undo RC-…" (the receipt goes to Trash, stock goes back, the status can then be set). Nothing changes silently.
   - The shipment record says why it is Delivered and offers the same undo.
   - Receiving goods on a shipment that is still on its way (ETA in the future / booked / in transit) asks "are they really here?". */
const SS_EARLY=["booked","in_transit","shipped","customs","arrived","open","ready"];
function ssReceipts(no){return live(D.receipts).filter(r=>r.src===no)}
const ssVal0=validateShip;
validateShip=function(o){const r=ssVal0.apply(this,arguments);try{const no=S.drawer?.ctx?.edit?.no;if(!no)return r;const rcs=ssReceipts(no);if(rcs.length&&o.status&&SS_EARLY.includes(o.status)){
  r.errors.status=`Goods are booked as received on this shipment (${rcs.map(x=>`${x.no} on ${fmtD(x.date)}`).join(", ")}), so it cannot be "${L("shipStatus",o.status)||o.status}". If they have not really arrived, undo the receipt first (button below).`;S.drawer._ssUndo=rcs.map(x=>x.no)}else S.drawer._ssUndo=null}catch(e){console.warn(e)}return r};
const ssShow0=showErrors;
showErrors=function(){ssShow0.apply(this,arguments);try{const d=S.drawer;const w=$("#fw_status");if(!d||!w)return;w.querySelector(".ssbox")?.remove();if(!d._ssUndo?.length)return;
 w.insertAdjacentHTML("beforeend",`<div class="ssbox warnbox" style="margin-top:6px">${d._ssUndo.map(no=>`<button type="button" class="btn sm" data-ss-undo="${esc(no)}">Undo ${esc(no)} (goods not here yet)</button>`).join(" ")}<div class="status">The receipt goes to Trash (you can bring it back), its stock comes off, then save the shipment again.</div></div>`)}catch(_){}};
document.addEventListener("click",async e=>{const b=e.target.closest("[data-ss-undo]");if(!b)return;e.preventDefault();e.stopImmediatePropagation();const no=b.dataset.ssUndo;const rc=docOf("receipts",no);if(!rc)return;
 if(!(can("deleteAny")||S.role==="owner")){toast("Only the Owner / Finance can undo a receipt");return}
 const ok=await trashDoc("receipts",no,`${no} undone — the goods had not arrived (shipment ${rc.src})`);if(ok===false)return;try{await recomputeShipment(rc.src,"receipt undone")}catch(_){}
 if(S.drawer)S.drawer._ssUndo=null;$(".ssbox")?.remove();toast(`${no} moved to Trash — now save the shipment with the right status`)},true);
/* the shipment record: why Delivered */
const ssOpen0=openShip;
openShip=function(x){const r=ssOpen0.apply(this,arguments);try{const s=x&&typeof x==="object"?x:docOf("shipments",x);if(!r||!s)return r;const rcs=ssReceipts(s.no);
 if(rcs.length&&["delivered","part_delivered"].includes(s.status)){const future=s.eta&&s.eta>today();r.body=`<div class="${future?"warnbox":"status"}" style="margin:0 0 8px">${L("shipStatus",s.status)} because goods were received: ${rcs.map(x=>`<button type="button" class="lnk" data-open="receipts" data-id="${esc(x.no)}">${esc(x.no)}</button> (${fmtD(x.date)})`).join(", ")}.${future?` But the ETA is ${fmtD(s.eta)} — if the goods are not here yet:`:""} ${can("deleteAny")||S.role==="owner"?rcs.map(x=>`<button type="button" class="btn sm" data-ss-undo="${esc(x.no)}">Undo ${esc(x.no)}</button>`).join(" "):""}</div>`+r.body}}catch(e){console.warn(e)}return r};
/* receiving goods that are still on the way */
const ssValRc0=validateReceive;
validateReceive=function(o){const r=ssValRc0.apply(this,arguments);try{const s=o.src&&docOf("shipments",o.src);if(s&&!S.drawer?.ctx?.edit?.no){const onWay=["booked","in_transit","shipped","open","ready"].includes(s.status)||(s.eta&&s.eta>addDays(today(),2));
  if(onWay)r.warnings.push(`${s.no} is ${L("shipStatus",s.status)||s.status}${s.eta?`, ETA ${fmtD(s.eta)}`:""} — are these goods really here? Receiving them puts them in stock and marks the shipment Delivered.`)}}catch(_){}return r};
