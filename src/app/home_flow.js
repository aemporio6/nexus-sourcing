/* ---------- Home: the work in the order it happens (order → deposit → production → inspection → balance → ship → receive → reorder) ----------
   Each step shows how many are waiting there and opens exactly that list. Read left to right: what comes after what. */
function flowSteps(){const T=today();const pos=live(D.purchases).filter(p=>p.status!=="cancelled"&&p.status!=="closed"&&!p.historic);const st=pos.map(p=>[p,poState(p)]);
 const shs=live(D.shipments).filter(s=>s.status!=="cancelled");const rcvd=new Set(live(D.receipts).map(r=>r.src));
 const n=f=>st.filter(([p,s])=>f(p,s));
 const noPI=n(p=>!p.yourRef&&!p.piNo&&!p.piLink&&!(p.docs&&p.docs.pi));
 const dep=n((p,s)=>s.outstandingCur>0.5&&s.paidCur<0.5);
 const prod=n(p=>["ordered","deposit","production","confirmed"].includes(p.status));
 const insp=n(p=>p.kind!=="uk"&&["production"].includes(p.status)&&!live(D.inspections).some(i=>i.po===p.no));
 const bal=n((p,s)=>s.outstandingCur>0.5&&s.paidCur>=0.5);
 const ready=n(p=>["inspected"].includes(p.status));
 const onway=shs.filter(s=>["booked","in_transit","customs"].includes(s.status));
 const arrived=shs.filter(s=>["arrived","part_delivered"].includes(s.status)&&!rcvd.has(s.no));
 let reo=0;try{reo=live(D.products).filter(p=>{const r=reorderInfo(p.sku);return r.out||(r.reorderIn!=null&&r.reorderIn<=(DEF().reorderWarnDays||30))}).length}catch(_){}
 return[
  {n:1,l:"Order placed — add PI",c:noPI.length,href:navHref("purchases",{nodocs:1}),hint:"PI number / link missing"},
  {n:2,l:"Pay deposit",c:dep.length,href:navHref("purchases",{owing:1}),hint:"nothing paid yet"},
  {n:3,l:"In production",c:prod.length,href:navHref("purchases",{status:"ordered|deposit|production"}),hint:"waiting for the factory"},
  {n:4,l:"Book inspection",c:insp.length,href:navHref("purchases",{status:"production"}),hint:"in production, no inspection yet"},
  {n:5,l:"Pay balance",c:bal.length,href:navHref("purchases",{owing:1}),hint:"part paid, rest due"},
  {n:6,l:"Ready → ship",c:ready.length,href:navHref("purchases",{status:"inspected"}),hint:"inspected, not shipped"},
  {n:7,l:"On the way",c:onway.length,href:navHref("shipments",{open:1}),hint:"booked / in transit / customs"},
  {n:8,l:"Arrived → receive",c:arrived.length,href:navHref("shipments",{status:"arrived|part_delivered"}),hint:"count it into stock"},
  {n:9,l:"Reorder",c:reo,href:navHref("stock",{reorder:1}),hint:"running low"}]}
function flowCard(){let steps=[];try{steps=flowSteps()}catch(e){console.warn(e);return""}
 return`<section class="card flow" aria-label="Work in order"><div class="card-h"><h2>Work in order</h2><span class="status">left to right — each step comes after the one before</span></div><ol class="flowrow">${steps.map(s=>`<li class="fstep ${s.c?"has":""}"><a href="${s.href}" data-nav="${esc(s.href.slice(2).split("?")[0])}" data-navf='${esc(JSON.stringify(parseHash(s.href).f||{}))}' title="${esc(s.hint)}"><span class="fn">${s.n}</span><b class="fc">${s.c}</b><span class="fl">${esc(s.l)}</span><small>${esc(s.hint)}</small></a></li>`).join("")}</ol></section>`}
vHome=(function(orig){return function(v){orig(v);try{const h=v.querySelector(".hdr");const html=flowCard();if(h)h.insertAdjacentHTML("afterend",html);else v.insertAdjacentHTML("afterbegin",html)}catch(e){console.warn(e)}}})(vHome);
