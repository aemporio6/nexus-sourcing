/* ---------- Stock: say WHY it is empty and what fills it (owner, 21 Nov 2026) ----------
   "Our goods were received, why is nothing in Stock?" — the stock is built only from Goods received documents (and stock
   counts / moves), never from a shipment's status. Shipments imported as history say "delivered" but carry no products.
   The Stock page now shows, on top, exactly what is the case and one tap for each fix:
   - shipments that arrived / were delivered and are not received yet → Receive (their products come from the shipment or its orders)
   - old shipments without products → they cannot fill stock; enter today's stock once (Stock count) or import a stock list
   - a Goods received document that was removed → said, with its date */
function swFacts(){const rec=live(D.receipts||[]);const got=new Set(rec.map(r=>r.src));const moves=live(D.moves||[]).length;
 const done=["arrived","part_delivered","delivered"];const sh=live(D.shipments||[]).filter(s=>done.includes(s.status)&&!got.has(s.no));
 const linesOf=s=>{const own=(s.lines||[]).filter(l=>l.sku);if(own.length)return own;const nos=(s.purchases||[]).map(x=>typeof x==="string"?x:(x?.po||x?.no||x?.ref)).filter(Boolean);return live(D.purchases||[]).filter(p=>nos.includes(p.no)).flatMap(p=>(p.lines||[]).filter(l=>l.sku))};
 const ready=[],bare=[];sh.forEach(s=>{const ls=linesOf(s);if(ls.length)ready.push({s,n:new Set(ls.map(l=>l.sku)).size,q:ls.reduce((a,l)=>a+(+l.q||+l.qty||0),0)});else bare.push(s)});
 const gone=(D.receipts||[]).filter(r=>r.deletedAt);const onHand=stockProducts().reduce((a,p)=>a+(stockOf(p.sku).onHand||0),0);
 return{rec:rec.length,moves,ready,bare,gone,onHand}}
function swHtml(){const f=swFacts();if(f.onHand>0&&!f.ready.length)return"";const hist=f.bare.filter(s=>s.historic||s.legacy).length;
 const rows=f.ready.slice(0,8).map(x=>`<div class="row swrow"><span style="flex:1"><b>${esc(x.s.no)}</b> · ${esc(plabel(x.s.party)||"")} <span class="status">${esc(L("shipStatus",x.s.status)||x.s.status)} · ${x.n} product${x.n===1?"":"s"}${x.q?`, ${num(x.q)} packs`:""}</span></span>${can("create")?`<button type="button" class="btn sm pri" data-act="receive" data-sh="${esc(x.s.no)}">Receive into stock</button>`:""}</div>`).join("");
 return`<div class="card" id="swcard"><div class="card-h"><h2>${f.onHand>0?"Arrived, not in stock yet":"Why is the stock empty?"}</h2></div>
  <p class="note" style="padding:6px 14px">Stock is filled by <b>Goods received</b> (and stock counts) — not by a shipment's status. Goods received documents now: <b>${f.rec}</b>${f.moves?` · stock moves: ${f.moves}`:""}.</p>
  ${f.ready.length?`<div class="list">${rows}</div>${f.ready.length>8?`<p class="note" style="padding:4px 14px">…and ${f.ready.length-8} more</p>`:""}`:""}
  ${f.bare.length?`<p class="note" style="padding:6px 14px"><b>${f.bare.length}</b> shipment${f.bare.length===1?" is":"s are"} marked delivered / arrived but carr${f.bare.length===1?"ies":"y"} <b>no products</b>${hist?` (${hist} imported as old history)`:""} — nothing can be pulled from them. To start from what is really on the shelf today, enter it once:</p>
   <div class="ixbar" style="padding:4px 14px 10px">${can("create")?`<button type="button" class="btn sm pri" data-act="new" data-k="count">Stock count (today's stock)</button><button type="button" class="btn sm" data-gof='{"k":"import"}'>Import a stock list (file)</button>`:""}</div>`:""}
  ${f.gone.length?`<p class="note" style="padding:2px 14px 10px">Removed Goods received: ${f.gone.slice(0,4).map(r=>`${esc(r.no)} (${esc(r.src||"")}, removed ${esc(fmtD(String(r.deletedAt).slice(0,10)))})`).join(", ")} — their stock went away with them. They are in the Recycle Bin.</p>`:""}</div>`}
const swStock0=vStock;
vStock=function(v){const r=swStock0.apply(this,arguments);try{const h=swHtml();if(h&&!v.querySelector("#swcard")){const d=document.createElement("div");d.innerHTML=h;const c=d.firstElementChild;const first=v.querySelector(".card,.filters,table");if(first)first.parentNode.insertBefore(c,first);else v.prepend(c)}}catch(e){console.warn("stock why",e)}return r};
(function(){try{const st=document.createElement("style");st.textContent=`.swrow{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 14px;border-bottom:1px solid var(--line)}#swcard{margin-bottom:12px}`;document.head.appendChild(st)}catch(_){}})();
chRegister({k:"stockwhy",title:"Why is my stock empty? / Receive arrived goods",hint:"Shows what fills the stock and what is waiting to be received",page:"stock",words:"stock empty zero missing not showing received arrived delivered receive opening count why",run:q=>{go("stock")}});
