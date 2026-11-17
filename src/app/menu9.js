/* ---------- Menu: 9 buttons, each with › opening its own panel (like Seller Central) (owner, 17 Nov 2026) ----------
   Home · Buying · Shipments · Money · Stock · Products · Suppliers · Reports · Settings.
   › (or hovering with a mouse) opens the button's panel beside the menu: every page of it, and its "+ New …" lines;
   a page opens on the right as before; links still open in a new tab / window (Ctrl / ⌘ / middle click, ↗).
   Nothing is lost: any page a module added that is not placed below lands in Settings. */
(function(){const all=[];NAV_MODULES.forEach(m=>m.items.forEach(it=>all.push(it)));const used=new Set();
 const take=(page,f)=>{const i=all.findIndex((it,ix)=>!used.has(ix)&&it[1]===page&&(f===undefined||JSON.stringify(it[2]||{})===JSON.stringify(f)));if(i<0)return[];used.add(i);return[all[i]]};
 const takeAll=page=>{const out=[];all.forEach((it,ix)=>{if(!used.has(ix)&&it[1]===page){used.add(ix);out.push(it)}});return out};
 const takeNew=k=>{const i=all.findIndex((it,ix)=>!used.has(ix)&&it[3]===k);if(i<0)return[];used.add(i);return[all[i]]};
 const ren=(arr,l)=>arr.map(it=>[l,...it.slice(1)]);
 const G=[
  {k:"home",l:"Home",ic:"home",items:[...takeAll("home"),...takeAll("tasks"),...takeAll("attention"),...take("calendar")]},
  {k:"purchases",l:"Buying",ic:"purchases",items:[...takeAll("purchases"),...ren(take("planner"),"Reorder planner (ICC)"),...takeNew("purchase"),...takeNew("inspection")]},
  {k:"shipments",l:"Shipments",ic:"shipments",items:[...takeAll("shipments"),...takeNew("shipment")]},
  {k:"payments",l:"Money",ic:"payments",items:[...takeAll("payments"),...takeAll("mkt"),...takeNew("payment"),...takeNew("credit")]},
  {k:"stock",l:"Stock",ic:"stock",items:[...takeAll("stock"),...takeNew("receive"),...takeNew("count"),...takeNew("move")]},
  {k:"products",l:"Products",ic:"products",items:[...takeAll("products"),...takeNew("product")]},
  {k:"parties",l:"Suppliers",ic:"parties",items:[...takeAll("parties"),...takeNew("party")]},
  {k:"reports",l:"Reports",ic:"trend",items:[...takeAll("reports"),...takeAll("log")]},
  {k:"setup",l:"Settings",ic:"setup",items:[...takeAll("setup"),...takeAll("import"),...takeAll("health"),...takeAll("trash"),...takeAll("tools"),...takeAll("refs")]}];
 /* anything else (pages added by other parts) – Settings, never lost */
 const placed=new Set(G.flatMap(g=>g.items.map(i=>i[3]?"new:"+i[3]:i[1])));
 all.forEach((it,ix)=>{if(used.has(ix))return;if(!it[3]&&placed.has(it[1])&&!G.some(g=>g.items.some(i=>i[1]===it[1]&&JSON.stringify(i[2]||{})!==JSON.stringify(it[2]||{})&&false))){used.add(ix);return}if(it[3]){const g=G.find(g=>g.k===(CREATE_REG.find(c=>c.k===it[3])?.mod))||G[8];g.items.push(it)}else G[8].items.push(it);used.add(ix)});
 NAV_MODULES.splice(0,NAV_MODULES.length,...G);
 const seenP=new Set(G.flatMap(g=>g.items.filter(i=>i[1]&&!i[3]).map(i=>i[1]+JSON.stringify(i[2]||{}))));
 /* the eBay import line belongs with the eBay figures */const ebI=G[8].items.findIndex(i=>/transaction report/i.test(i[0]));if(ebI>=0)G[3].items.splice(G[3].items.findIndex(i=>i[3])<0?G[3].items.length:G[3].items.findIndex(i=>i[3]),0,...G[8].items.splice(ebI,1));
 const where={};G.forEach(g=>g.items.forEach(it=>{if(it[1]&&!where[it[1]])where[it[1]]=g.k}));Object.keys(NAV_OF_PAGE).forEach(p=>{if(where[p])NAV_OF_PAGE[p]=where[p];else if(!G.some(g=>g.k===NAV_OF_PAGE[p]))NAV_OF_PAGE[p]="setup"});Object.assign(NAV_OF_PAGE,where);
 /* new things land in their group too */CREATE_REG.forEach(c=>{if(c.mod==="planner")c.mod="purchases";if(c.mod==="import")c.mod="setup"})})();
/* the rail: no inline lists, › opens the panel */
nav=(function(orig){return function(){orig();try{const rail=$("#rail");if(!rail)return;rail.querySelectorAll(".nsubs").forEach(x=>x.remove());rail.querySelectorAll("[data-navexp]").forEach(b=>{b.dataset.navfly=b.dataset.navexp;b.removeAttribute("data-navexp");b.textContent="›";b.setAttribute("aria-haspopup","true");b.setAttribute("aria-expanded",String(S.navFly===b.dataset.navfly));b.setAttribute("aria-label","Open "+(NAV_MODULES.find(m=>m.k===b.dataset.navfly)?.l||"")+" menu")})}catch(e){console.warn(e)}if(S.navFly){if(S._m9At!==m9Where())m9Close();else m9Open(S.navFly,true)}}})(nav);
const m9Where=()=>{try{return S.view.k+JSON.stringify(fNow(S.view.k))+(S.drawer?S.drawer.col+S.drawer.id+(S.drawer.form||""):"")}catch(_){return""}};
function m9Html(m){const k=S.view.k;return`<div class="m9h">${IC(m.ic)} <b>${esc(m.l)}</b><button type="button" class="x" data-m9="close" aria-label="Close menu">×</button></div><div class="m9l">${m.items.map(([l,p,f,newK])=>newK?(can("create")?`<button type="button" class="m9i m9new" data-act="new" data-k="${newK}">${esc(l)}</button>`:""):`<div class="m9r"><a class="m9i ${p===k&&sameF(f||{},fNow(k))?"on":""}" href="${navHref(p,f)}" data-nav="${p}" data-navf='${esc(JSON.stringify(f||{}))}'>${esc(l)}</a><a class="m9w" href="${navHref(p,f)}" target="_blank" rel="opener" title="Open in a new window" aria-label="Open ${esc(l)} in a new window">↗</a></div>`).join("")}</div>`}
function m9Open(k,quiet){const m=NAV_MODULES.find(x=>x.k===k);const btn=document.querySelector(`[data-navfly="${k}"]`);if(!m||!btn){m9Close();return}let p=$("#m9fly");if(!p){p=document.createElement("div");p.id="m9fly";p.setAttribute("role","menu");document.body.appendChild(p);p.addEventListener("mouseenter",()=>clearTimeout(m9T));p.addEventListener("mouseleave",()=>{if(m9Hover){clearTimeout(m9T);m9T=setTimeout(m9Close,350)}})}
 S.navFly=k;S._m9At=m9Where();p.innerHTML=m9Html(m);p.setAttribute("aria-label",m.l+" menu");const rail=$("#rail")?.getBoundingClientRect();const r=btn.closest(".nmod")?.getBoundingClientRect()||btn.getBoundingClientRect();
 p.style.left=Math.round((rail?rail.right:r.right)+6)+"px";p.style.top=Math.max(8,Math.min(Math.round(r.top),window.innerHeight-p.offsetHeight-8))+"px";p.hidden=false;
 document.querySelectorAll("[data-navfly]").forEach(b=>b.setAttribute("aria-expanded",String(b.dataset.navfly===k)));document.querySelectorAll(".nmod").forEach(x=>x.classList.toggle("flyon",!!x.querySelector(`[data-navfly="${k}"]`)));if(!quiet)p.querySelector(".m9i")?.focus({preventScroll:true})}
function m9Close(){const p=$("#m9fly");if(p)p.hidden=true;S.navFly=null;document.querySelectorAll("[data-navfly]").forEach(b=>b.setAttribute("aria-expanded","false"));document.querySelectorAll(".nmod.flyon").forEach(x=>x.classList.remove("flyon"))}
let m9T=null,m9Hover=false;
/* going anywhere / opening a form closes the panel */
const m9Go0=goHref;goHref=function(){m9Close();return m9Go0.apply(this,arguments)};
const m9Form0=openForm;openForm=function(){m9Close();return m9Form0.apply(this,arguments)};
document.addEventListener("click",e=>{const b=e.target.closest("[data-navfly]");if(b){e.preventDefault();e.stopImmediatePropagation();m9Hover=false;if(S.navFly===b.dataset.navfly)m9Close();else m9Open(b.dataset.navfly);return}
 if(e.target.closest('[data-m9="close"]')){e.preventDefault();m9Close();return}
 const inP=e.target.closest("#m9fly");if(inP&&e.target.closest("a[data-nav],[data-act]")){setTimeout(m9Close,0);return}
 if(S.navFly&&!inP&&!e.target.closest("#rail"))m9Close()},true);
/* mouse: hovering a button opens its panel (after a short pause, so passing over does nothing) */
document.addEventListener("mouseover",e=>{if(!matchMedia("(hover:hover) and (pointer:fine)").matches)return;const h=e.target.closest(".nmod");if(!h||!h.closest("#rail"))return;const b=h.querySelector("[data-navfly]");if(!b)return;clearTimeout(m9T);m9T=setTimeout(()=>{m9Hover=true;m9Open(b.dataset.navfly,true)},220)});
document.addEventListener("mouseout",e=>{if(!m9Hover)return;const to=e.relatedTarget;if(to&&(to.closest?.("#m9fly")||to.closest?.(".nmod")))return;clearTimeout(m9T);m9T=setTimeout(m9Close,350)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&S.navFly){m9Close();document.querySelector(".nmod .nav.on")?.focus()}});
window.addEventListener("resize",()=>{if(S.navFly)m9Open(S.navFly,true)});
(function(){try{const st=document.createElement("style");st.textContent=`#m9fly{position:fixed;z-index:60;min-width:250px;max-width:min(340px,90vw);max-height:calc(100vh - 16px);overflow:auto;background:var(--card,#fff);border:1px solid var(--line,#dde3ea);border-radius:12px;box-shadow:0 12px 32px rgba(20,40,60,.18);padding:6px}#m9fly[hidden]{display:none}
.m9h{display:flex;align-items:center;gap:8px;padding:8px 8px 6px;border-bottom:1px solid var(--line,#e6ebf0);margin-bottom:4px}.m9h b{flex:1}.m9h svg{width:18px;height:18px}
.m9l{display:flex;flex-direction:column}.m9r{display:flex;align-items:center}.m9i{flex:1;display:block;padding:10px 10px;border-radius:8px;color:inherit;text-decoration:none;text-align:left;background:none;border:0;font:inherit;cursor:pointer;min-height:40px}.m9i:hover,.m9i:focus{background:var(--soft,#e6eef6);outline:none}.m9i.on{font-weight:600;color:var(--accent,#2f5f8f)}
.m9new{color:var(--accent,#2f5f8f)}.m9w{padding:8px;border-radius:8px;color:var(--muted,#6b7785);text-decoration:none;min-width:36px;text-align:center}.m9w:hover{background:var(--soft,#e6eef6)}
.nmod.flyon>.nhead{background:var(--soft,#e6eef6);border-radius:10px}.nexp[data-navfly]{font-size:18px}`;document.head.appendChild(st)}catch(_){}})();
