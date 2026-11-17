/* ---------- Look & feel: open, calm, easy to read (owner, 18 Nov 2026) ----------
   No bigger fonts — more air, one rhythm of spacing, quieter lines, and fewer things on screen at once:
   - menu: solid ▸ triangles (turn ▾ when that menu's panel is open)
   - list pages: search + the 2 main filters + the quick chips stay; the rest sits under "More filters" (an active one always shows)
   - the left menu's footer (device / backup / view as) folds into one line
   - cards, headers, rows, forms and the record panel get the same calm spacing */
(function(){try{const st=document.createElement("style");st.id="uipolish";st.textContent=`
:root{--gap:18px}
.content{gap:var(--gap);padding-block:20px 120px;max-width:1240px}
.hdr{margin:2px 0 2px;align-items:flex-end;gap:16px}.hdr h1{letter-spacing:-.01em;margin:0 0 4px}.hdr .sub{margin:0;color:var(--muted)}
.card{border-radius:14px;border-color:color-mix(in srgb,var(--line) 85%,transparent);box-shadow:0 1px 2px rgba(20,40,60,.04)}
.card-h{padding:14px 18px;gap:10px}.card-h h2{font-size:15.5px;letter-spacing:-.005em}
.filters{gap:8px;row-gap:8px}.filters>select,.filters>input{min-height:38px;border-radius:10px}
.list .row{padding:12px 18px}.list .row:hover{background:color-mix(in srgb,var(--soft,#e6eef6) 55%,transparent)}
.lhead{padding:10px 18px}
.crumb,.crumbs{margin-bottom:-6px}
/* menu */
.nmods{gap:2px;display:flex;flex-direction:column}.nmod>.nhead{border-radius:10px}.nav{padding:9px 10px}
.nexp[data-navfly]{font-size:11px;width:28px;height:28px;color:var(--muted);transition:transform .15s}.nexp[data-navfly][aria-expanded="true"]{color:var(--accent);transform:rotate(90deg)}
#m9fly{border-radius:14px;padding:8px}.m9i{border-radius:10px}
/* the left menu footer folds */
.rail-foot-sum{list-style:none;cursor:pointer;color:var(--muted);font-size:12.5px;padding:8px 10px;border-radius:10px;display:flex;gap:6px;align-items:center}.rail-foot-sum::-webkit-details-marker{display:none}.rail-foot[open] .rail-foot-sum{color:var(--fg)}
/* record panel + forms */
.drawer .dtop{padding-bottom:8px;border-bottom:1px solid var(--line);margin-bottom:6px}.fn-bar{gap:6px}.fn-bar .btn.sm{border-radius:10px}
.drawer .form{row-gap:14px}.drawer .f>label{margin-bottom:4px}
.warnbox,.badbox,.okbox{border-radius:12px;padding:12px 14px;line-height:1.5}
.pill{border-radius:999px}
.more-f{display:inline-flex;align-items:center;gap:6px}
.fmore-hide{display:none!important}
@media (max-width:760px){.content{padding-block:14px 120px;gap:14px}.card-h{padding:12px 14px}.list .row{padding:12px 14px}}
`;document.head.appendChild(st)}catch(_){}})();
/* menu triangles: ▸ (and ▾ on the open one — by rotating ▸) */
nav=(function(orig){return function(){orig();try{document.querySelectorAll("#rail [data-navfly]").forEach(b=>{b.textContent="▸"});uiRailFoot()}catch(e){console.warn(e)}}})(nav);
/* list filters: only the main ones until "More filters" */
function uiFilters(v,page){const bar=v.querySelector(".filters");if(!bar||bar.dataset.ui)return;bar.dataset.ui="1";const kids=[...bar.children];let shown=0;const extra=[];
 kids.forEach(el=>{const isQ=el.matches?.("input[data-f='q'],input[type=search]")||el.querySelector?.("input[data-f='q']");const isChip=el.classList?.contains("chipb")||el.matches?.("button");const sel=el.matches?.("select");const active=sel?el.value!==""&&!/^(date_desc|newest|)$/i.test(el.value)&&el.selectedIndex>0:(el.matches?.("input")?String(el.value||"").trim()!=="":false);
  if(isQ||isChip)return;if(sel&&shown<2&&!/sort/i.test(el.getAttribute("data-f")||"")){shown++;return}if(active)return;extra.push(el)});
 if(extra.length<2)return;const open=!!(S.fMore||{})[page];extra.forEach(el=>el.classList.toggle("fmore-hide",!open));
 const btn=document.createElement("button");btn.type="button";btn.className="chipb more-f";btn.dataset.fmore=page;btn.setAttribute("aria-expanded",String(open));btn.textContent=open?"Fewer filters ▴":`More filters (${extra.length}) ▾`;bar.appendChild(btn)}
document.addEventListener("click",e=>{const b=e.target.closest("[data-fmore]");if(!b)return;e.preventDefault();e.stopImmediatePropagation();S.fMore=S.fMore||{};S.fMore[b.dataset.fmore]=!S.fMore[b.dataset.fmore];render()},true);
const uiList0=listPage;
listPage=function(v,page,o){const r=uiList0.apply(this,arguments);try{uiFilters(v,page)}catch(e){console.warn(e)}return r};
/* the left menu footer (Saved on this device · Backup · Load data file · View as) folds into one line */
function uiRailFoot(){const rail=$("#rail");const foot=rail&&rail.querySelector(":scope>.status");if(!foot||foot.closest(".rail-foot"))return;const d=document.createElement("details");d.className="rail-foot";let open=false;try{open=localStorage.getItem("mt_railfoot")==="1"}catch(_){}d.open=open;
 const first=(foot.innerText||"").split("\n").find(Boolean)||"This device";d.innerHTML=`<summary class="rail-foot-sum">⚙ ${esc(first.slice(0,40))}</summary>`;foot.parentNode.insertBefore(d,foot);d.appendChild(foot);d.addEventListener("toggle",()=>{try{localStorage.setItem("mt_railfoot",d.open?"1":"0")}catch(_){}})}
