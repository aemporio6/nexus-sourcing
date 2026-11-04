/* ---------- Calculations you can trace ----------
   1. Override log: when a value MY TOOL filled in by itself (AUTO) is changed by hand, the record keeps what the automatic value was,
      who changed it and when (`overrides`). Shown on the record page. Historical records are never recalculated.
   2. Reconciliation on every order: PI total vs lines + fee + extras, paid vs total, shipped vs ordered, received vs shipped —
      each number next to the one it must agree with, so a difference is visible on the record itself (Data health lists them too).
   3. Money rounding lives in core.js r2 (float-safe, half away from zero). */
setv=(function(orig){return function(k,v,auto){if(auto&&S.drawer){S.drawer.autoVal=S.drawer.autoVal||{};S.drawer.autoVal[k]=v==null?"":(Array.isArray(v)?v.join(", "):String(v))}return orig(k,v,auto)}})(setv);
writeDoc=(function(orig){return async function(col,id,data,labelTxt,opts){
 try{const d=S.drawer;if(d&&d.form&&FORM_COL[d.form]===col&&d.autoVal&&data&&typeof data==="object"){const ov={...(data.overrides||{})};let n=0;
  for(const k of Object.keys(d.autoVal)){if(!d.changed[k])continue;const now=data[k];const cur=now==null?"":(Array.isArray(now)?now.join(", "):String(now));if(cur===d.autoVal[k])continue;ov[k]={auto:d.autoVal[k],value:cur,by:uid||"local",at:nowIso()};n++}
  if(n)data.overrides=ov}}catch(e){console.warn(e)}
 return orig.call(this,col,id,data,labelTxt,opts)}})(writeDoc);
function overridesBlock(x){const ov=x&&x.overrides;if(!ov||!Object.keys(ov).length)return"";
 return`<div class="kv" style="margin-top:8px"><div class="kvh" style="grid-column:1/-1"><b>Changed by hand</b> <small class="status">the automatic value was replaced — kept here so the difference stays traceable</small></div>${Object.entries(ov).map(([k,o])=>`<div><small class="status">${esc(k)}</small><b>${esc(o.value===""?"(empty)":o.value)}</b><br><small class="status">auto was ${esc(o.auto===""?"(empty)":o.auto)} · ${esc(o.by||"")} · ${esc(fmtD(o.at))}</small></div>`).join("")}</div>`}
function reconBlock(p){let sp,st;try{sp=poSplit(p);st=poState(p)}catch(e){return""}const cur=p.cur||"RMB";const tol=0.5;const row=(l,a,b,why)=>{const ok=Math.abs(a-b)<=tol;return`<tr class="${ok?"":"bad"}"><td>${esc(l)}</td><td class="num">${esc(fmt(a,cur))}</td><td class="num">${esc(fmt(b,cur))}</td><td class="num">${ok?"✓":"<b>"+esc(fmt(a-b,cur))+"</b>"}</td><td><small class="status">${esc(ok?"":why)}</small></td></tr>`};
 const q=(l,a,b,why)=>{const ok=b<=a+0.001;return`<tr class="${ok?"":"bad"}"><td>${esc(l)}</td><td class="num">${esc(num(a))}</td><td class="num">${esc(num(b))}</td><td class="num">${ok?(b<a?num(a-b)+" open":"✓"):"<b>"+esc(num(b-a))+" over</b>"}</td><td><small class="status">${esc(ok?"":why)}</small></td></tr>`};
 const stored=p.total!=null&&p.total!=="";
 return`<div class="card" style="margin-top:8px"><div class="card-h"><h3 style="margin:0">Does it add up?</h3><span class="status">each number beside the one it must match</span></div><div class="tbl"><table class="recon"><tr><th>Check</th><th class="num">Is</th><th class="num">Should be</th><th class="num">Diff</th><th></th></tr>
 ${stored?row("PI total vs lines + fee + extras",+p.total,sp.computed,"PI total typed on the order differs from the lines — fix the lines, or use ‘Use lines total’ in Data health"):""}
 ${row("Paid + credits + written off + balance vs total",r2(st.paidCur+st.credits+st.writtenOff+st.viaUsed+st.balance),st.total,"money does not add up — a payment may be allocated twice or missing")}
 ${q("Ordered vs shipped (units)",st.ordered||0,st.shipped||0,"more shipped than ordered")}
 ${q("Shipped vs received (units)",st.shipped||0,st.received||0,"more received than shipped")}
 </table></div></div>`}
openPO=(function(orig){return function(p){const r=orig(p);try{const x=docOf("purchases",p);if(r&&x){const h=reconBlock(x)+overridesBlock(x);const i=r.body.indexOf('<div class="kv');r.body=i>0?r.body.slice(0,i)+h+r.body.slice(i):r.body+h}}catch(e){console.warn(e)}return r}})(openPO);
["openShip","openPay","openInsp","openReceipt","openProduct","openParty","openCredit","openMove"].forEach(fn=>{if(typeof window[fn]!=="function")return;const col={openShip:"shipments",openPay:"payments",openInsp:"inspections",openReceipt:"receipts",openProduct:"products",openParty:"parties",openCredit:"credits",openMove:"moves"}[fn];
 window[fn]=(function(orig){return function(x){const r=orig(x);try{const d=docOf(col,x);if(r&&d){const h=overridesBlock(d);if(h){const i=r.body.indexOf('<div class="kv');r.body=i>0?r.body.slice(0,i)+h+r.body.slice(i):r.body+h}}}catch(e){console.warn(e)}return r}})(window[fn])});
