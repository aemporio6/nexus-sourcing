/* ---------- Lists: table view, choose columns, a filter on every column, saved with the view, export the same columns (owner, 17 Nov 2026 – item 5) ----------
   - "▦ Table" on Purchases, Shipments, Payments, Products, Suppliers switches the list to a table; "☰ Cards" back.
   - "Columns" ticks which columns show (the choice is part of the list's address, so a saved view keeps it, and so does a new tab).
   - Under each column title a small box filters that column (text contains; numbers also > 100, < 50, 10-20). Click a title to sort.
   - "Export this view" exports exactly these columns and rows (Excel / CSV).
   - Ready-made views for everyone (made once): Waiting for approval · Deposit still to pay · On the way · On hold (QC) · Still to pay.
   - 📌 on a saved view pins it to Today with its count; saved views also come up in Search. */
const LC={
 purchases:[["no","No.",p=>p.no,1],["oldRef","Old ref",p=>[].concat(p.oldRef||[]).join(", "),1],["date","Date",p=>p.date||"",1],["party","Supplier",p=>pname(p.party),1],["desc","Products",p=>poDesc(p)||"",1],["status","Status",p=>L("poStatus",p.status)||p.status||"",1],
  ["total","Total",p=>{try{return poState(p).total}catch(_){return""}},1,"cur"],["gbp","Total £",p=>r2(poGbp(p)||0),0,"gbp"],["paid","Paid",p=>{try{return poState(p).paidCur}catch(_){return""}},0,"cur"],["owing","Still to pay",p=>{try{return poState(p).outstandingCur}catch(_){return""}},1,"cur"],
  ["ctn","Cartons",p=>+p.ctn||"",0,"n"],["company","Company",p=>cname(p.account),0],["pi","PI no.",p=>p.yourRef||p.piNo||"",0],["hold","On hold",p=>p.hold?"yes":"",0],["tags","Tags",p=>(p.tags||[]).map(t=>L("tag",t)).join(", "),0]],
 shipments:[["no","No.",s=>s.no,1],["oldRef","Old ref",s=>[].concat(s.oldRef||[]).join(", "),0],["party","Forwarder",s=>pname(s.party),1],["mode","Service",s=>L("mode",s.mode)||s.mode||"",1],["status","Status",s=>L("shipStatus",s.status)||s.status||"",1],["dispatch","Dispatch",s=>s.dispatch||"",0],["eta","ETA",s=>s.eta||"",1],
  ["orders","Orders",s=>{try{return shipPos(s).join(", ")}catch(_){return""}},1],["ctn","Cartons",s=>+s.ctn||"",1,"n"],["kg","kg",s=>+s.kg||"",0,"n"],["cbm","CBM",s=>+s.cbm||"",0,"n"],["cost","Freight",s=>+s.cost||"",1,"n"],["costCur","Cur",s=>s.costCur||"",0],["tracking","Tracking",s=>s.tracking||"",0]],
 payments:[["no","No.",p=>p.no,1],["date","Date",p=>p.date||"",1],["party","Party",p=>pname(p.party),1],["amount","Amount",p=>+p.amount||0,1,"n"],["cur","Cur",p=>p.cur||"",1],["gbp","£",p=>r2(+p.gbp||0),1,"gbp"],["type","Type",p=>L("payType",p.type)||p.type||"",1],
  ["refs","For",p=>(p.allocations||[]).map(a=>a.ref).filter(Boolean).join(", "),1],["status","Status",p=>{try{return payCheck(p)[0]}catch(_){return p.status||""}},1],["approval","Approval",p=>p.needsApproval?(p.approved?"approved":p.status==="cancelled"?"rejected":"waiting"):"",0],["yourRef","Their invoice",p=>p.yourRef||"",0],["direction","In / out",p=>p.direction==="in"?"in":"out",0]],
 products:[["sku","SKU",p=>p.sku,1],["name","Name",p=>p.name||"",1],["brand","Brand",p=>L("brand",p.brand)||p.brand||"",1],["category","Category",p=>L("category",p.category)||p.category||"",1],["packOf","Pack of",p=>+p.packOf||"",0,"n"],["asin","ASIN",p=>p.asin||"",1],["hs","HS code",p=>p.hs||"",0],
  ["perCtn","Per carton",p=>+p.perCtn||"",0,"n"],["ctnSize","Carton cm",p=>p.ctn&&p.ctn.L?`${p.ctn.L}×${p.ctn.W}×${p.ctn.H}`:"",0],["sell","Sell £",p=>+p.sellGbp||"",0,"gbp"],["status","Status",p=>p.status||"",1]],
 parties:[["code","Code",p=>p.code,1],["name","Name",p=>p.name||"",1],["type","Type",p=>L("partyType",p.type)||p.type||"",1],["company","Company",p=>p.company||"",0],["country","Country",p=>L("country",p.country)||p.country||"",1],["cur","Currency",p=>p.cur||"",0],["status","Status",p=>p.status||"active",0]]};
const lcOn=page=>!!LC[page]&&!!F(page).tbl;
function lcCols(page){const f=F(page);const all=LC[page];const want=f.cols?String(f.cols).split(","):all.filter(c=>c[3]).map(c=>c[0]);return all.filter(c=>want.includes(c[0]))}
function lcVal(c,x){try{const v=c[2](x);return v==null?"":v}catch(_){return""}}
function lcMatch(v,q){q=String(q).trim();if(!q)return true;const n=typeof v==="number"?v:parseFloat(String(v).replace(/[^\d.-]/g,""));let m;
 if((m=q.match(/^([<>]=?)\s*(-?[\d.]+)$/))&&!isNaN(n)){const t=+m[2];return m[1]===">"?n>t:m[1]===">="?n>=t:m[1]==="<"?n<t:n<=t}
 if((m=q.match(/^(-?[\d.]+)\s*-\s*(-?[\d.]+)$/))&&!isNaN(n))return n>=+m[1]&&n<=+m[2];return String(v).toLowerCase().includes(q.toLowerCase())}
/* the column filters and the table sort apply to the rows of the list (cards and table) */
Object.keys(LC).forEach(page=>{const spec=LIST[page];if(!spec)return;const rows0=spec.rows;spec.rows=function(){let r=rows0.apply(this,arguments);const f=F(page);
 const fs=Object.keys(f).filter(k=>k.startsWith("c_")&&String(f[k]).trim());fs.forEach(k=>{const c=LC[page].find(x=>x[0]===k.slice(2));if(c)r=r.filter(x=>lcMatch(lcVal(c,x),f[k]))});
 if(f.tsort){const[k,dir]=String(f.tsort).split("_");const c=LC[page].find(x=>x[0]===k);if(c)r=r.slice().sort((a,b)=>{const va=lcVal(c,a),vb=lcVal(c,b);const d=typeof va==="number"&&typeof vb==="number"?va-vb:String(va).localeCompare(String(vb),undefined,{numeric:true});return dir==="asc"?d:-d})}
 return r}});
/* drop the table settings from "how many filters" (they are a way of looking, not a filter) */
const lcNorm0=normFObj;normFObj=function(f){const o=lcNorm0.apply(this,arguments);delete o.tbl;delete o.cols;delete o.tsort;return o};
function lcFmt(c,v,x){if(v===""||v==null)return"";if(c[4]==="gbp")return gbp(v);if(c[4]==="cur"){const cur=x.cur||"RMB";return fmt(v,cur)}if(c[4]==="n")return num(v);if(/^\d{4}-\d{2}-\d{2}$/.test(String(v)))return fmtD(v);return String(v)}
function lcTable(page,shown,col){const f=F(page);const cols=lcCols(page);const[sk,sd]=String(f.tsort||"").split("_");const idk=LC[page][0];
 return`<div class="lctw"><table class="lct"><thead><tr>${cols.map(c=>`<th class="${c[4]?"r":""}"><button type="button" data-lcsort="${c[0]}" class="${sk===c[0]?"on":""}">${esc(c[1])}${sk===c[0]?(sd==="asc"?" ↑":" ↓"):""}</button></th>`).join("")}</tr><tr class="lcf">${cols.map(c=>`<th><input data-lc="${c[0]}" id="lc_${page}_${c[0]}" value="${esc(f["c_"+c[0]]||"")}" placeholder="filter" aria-label="Filter ${esc(c[1])}"></th>`).join("")}</tr></thead>
 <tbody>${shown.map(x=>`<tr data-open="${col}" data-id="${esc(lcVal(idk,x))}" tabindex="0">${cols.map(c=>{const v=lcVal(c,x);const t=lcFmt(c,v,x);return`<td class="${c[4]?"r num":""}"${String(t).length>34?` title="${esc(t)}"`:""}>${esc(t)}</td>`}).join("")}</tr>`).join("")||`<tr><td colspan="${cols.length}" class="empty">Nothing matches.</td></tr>`}</tbody></table></div>`}
const LC_COL={purchases:"purchases",shipments:"shipments",payments:"payments",products:"products",parties:"parties"};
const lcBody0=listBody;
listBody=function(page){const r=lcBody0.apply(this,arguments);if(!lcOn(page))return r;const lim=S.limit[page]||60;return{rows:r.rows,html:lcTable(page,r.rows.slice(0,lim),LC_COL[page])}};
/* header buttons */
const lcPage0=listPage;
listPage=function(v,page,o){if(LC[page]){const on=lcOn(page);o={...o,acts:(o.acts||"")+`<button type="button" class="btn" data-lctog="${page}" aria-pressed="${on}">${on?"☰ Cards":"▦ Table"}</button>${on?`<span style="position:relative"><button type="button" class="btn" data-lcpick="${page}" aria-haspopup="true">Columns</button><div id="lcpick" hidden></div></span>`:""}`}}
 const r=lcPage0.call(this,v,page,o);if(lcOn(page)){const h=v.querySelector(".lhead");if(h)h.style.display="none"}return r};
/* keep the cursor in a column filter while the list redraws */
const lcRender0=renderList;
renderList=function(){const a=document.activeElement;const id=a&&a.id&&a.id.startsWith("lc_")?a.id:null;const pos=id?a.selectionStart:null;const r=lcRender0.apply(this,arguments);if(id){const n=document.getElementById(id);if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(_){}}}return r};
let lcT=null;
document.addEventListener("input",e=>{const i=e.target.closest?.("[data-lc]");if(!i)return;const page=S.view.k;const f=F(page);const k="c_"+i.dataset.lc;if(i.value.trim())f[k]=i.value;else delete f[k];clearTimeout(lcT);lcT=setTimeout(()=>{S.limit[page]=60;renderList();try{mirrorHash()}catch(_){}},250)});
document.addEventListener("click",e=>{const t=e.target.closest("[data-lctog],[data-lcsort],[data-lcpick]");if(!t)return;e.preventDefault();e.stopImmediatePropagation();const page=S.view.k;const f=F(page);
 if(t.dataset.lctog){if(f.tbl){delete f.tbl}else f.tbl=1;render();try{mirrorHash()}catch(_){}return}
 if(t.dataset.lcsort){const k=t.dataset.lcsort;const[sk,sd]=String(f.tsort||"").split("_");f.tsort=sk===k&&sd==="desc"?k+"_asc":k+"_desc";renderList();try{mirrorHash()}catch(_){}return}
 if(t.dataset.lcpick){const box=$("#lcpick");if(!box)return;const cur=lcCols(page).map(c=>c[0]);box.innerHTML=`<div class="status" style="padding:4px 6px">Show these columns</div>${LC[page].map(c=>`<label class="lcck"><input type="checkbox" data-lccol="${c[0]}" ${cur.includes(c[0])?"checked":""}> ${esc(c[1])}</label>`).join("")}`;box.hidden=!box.hidden;return}
},true);
document.addEventListener("change",e=>{const t=e.target.closest?.("[data-lccol]");if(!t)return;const page=S.view.k;const f=F(page);const box=$("#lcpick");const on=[...box.querySelectorAll("[data-lccol]")].filter(x=>x.checked).map(x=>x.dataset.lccol);if(!on.length){toast("Keep at least one column");t.checked=true;return}f.cols=LC[page].filter(c=>on.includes(c[0])).map(c=>c[0]).join(",");renderList();try{mirrorHash()}catch(_){}});
document.addEventListener("click",e=>{const b=$("#lcpick");if(b&&!b.hidden&&!e.target.closest("#lcpick,[data-lcpick]"))b.hidden=true});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.matches?.(".lct tbody tr[data-open]")){e.preventDefault();openDoc(e.target.dataset.open,e.target.dataset.id)}});
/* Export this view = these columns */
function lcExportRows(page){const cols=lcCols(page);const rows=LIST[page].rows();const safe=v=>typeof v==="string"&&/^[=+\-@]/.test(v)?"'"+v:v;return[cols.map(c=>c[1]),...rows.map(x=>cols.map(c=>safe(lcVal(c,x))))]}
document.addEventListener("click",e=>{const b=e.target.closest('[data-act="exportview"],[data-act="exportviewcsv"]');if(!b)return;const page=b.dataset.page||S.view.k;if(!lcOn(page))return;e.preventDefault();e.stopImmediatePropagation();if(!can("export")){toast("Export is not allowed for your role");return}
 const aoa=lcExportRows(page);const name=`MYTOOL_${page}_${today()}`;try{logEv("export",page,"view",`Exported ${aoa.length-1} rows × ${aoa[0].length} columns`)}catch(_){}
 if(b.dataset.act==="exportviewcsv"||typeof XLSX==="undefined"){const csv=aoa.map(r=>r.map(v=>{const s=String(v??"");return/[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}).join(",")).join("\r\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["﻿"+csv],{type:"text/csv"}));a.download=name+".csv";document.body.appendChild(a);a.click();a.remove();return}
 const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet(aoa);ws["!cols"]=aoa[0].map((h,i)=>({wch:Math.min(40,Math.max(String(h).length,...aoa.slice(1,200).map(r=>String(r[i]??"").length))+2)}));XLSX.utils.book_append_sheet(wb,ws,page.slice(0,30));XLSX.writeFile(wb,name+".xlsx")},true);
/* ready-made views (made once, by the owner's app) */
function lcSeedViews(){try{if(!S.ready||!can("setup")||SET().viewsSeeded||(window.MYTOOL&&MYTOOL.demo&&S._lcSeeded))return;S._lcSeeded=true;
 const V=[["payments","Waiting for approval",{status:"pending"}],["purchases","Deposit still to pay",{needdep:1}],["purchases","Still to pay",{owing:1}],["purchases","On hold (QC)",{hold:1}],["shipments","On the way",{open:1}]];
 const have=live(D.views||[]);(async()=>{for(const[page,name,f]of V){if(have.some(v=>v.page===page&&v.name===name))continue;const id="v_"+nid();await writeDoc("views",id,{id,page,name,f,by:uid||"local",ready:true},null,{quiet:true})}await setupPatch("viewsSeeded",true)})().catch(()=>{})}catch(_){}}
setInterval(lcSeedViews,5000);
/* 📌 pin a saved view to Today */
const lcSv0=savedViewsBar;
savedViewsBar=function(page){let h=lcSv0.apply(this,arguments);try{const cur=normF(F(page));const v=live(D.views).find(v=>v.page===page&&normF(v.f||{})===cur);if(v&&can("edit"))h=h.replace(/<\/div>$/,`<button type="button" class="chipb" data-lcpin="${esc(v.id)}" aria-pressed="${!!v.pin}" title="${v.pin?"Remove from Today":"Show on Today with its count"}">${v.pin?"📌 On Today":"📌 Pin to Today"}</button></div>`)}catch(_){}return h};
document.addEventListener("click",async e=>{const b=e.target.closest("[data-lcpin]");if(!b)return;e.preventDefault();e.stopImmediatePropagation();const v=docOf("views",b.dataset.lcpin);if(!v)return;await updateDoc("views",v.id,{pin:!v.pin},v.pin?`"${v.name}" removed from Today`:`"${v.name}" pinned to Today`);render()},true);
function lcCount(v){try{const keep=S.f[v.page];S.f[v.page]={...v.f};const n=LIST[v.page]?LIST[v.page].rows().length:0;S.f[v.page]=keep;return n}catch(_){return"?"}}
const lcHome0=vHome;
vHome=function(v){const r=lcHome0.apply(this,arguments);try{const pins=live(D.views||[]).filter(x=>x.pin&&LIST[x.page]);if(pins.length&&v&&v.insertAdjacentHTML){v.querySelector(".lcpins")?.remove();const html=`<div class="card lcpins"><div class="card-h"><h2>Pinned views</h2></div><div class="chips" style="padding:10px 14px;display:flex;flex-wrap:wrap;gap:8px">${pins.map(p=>`<a class="chipb" href="${navHref(p.page,p.f)}" data-nav="${esc(p.page)}" data-navf='${esc(JSON.stringify(p.f||{}))}'>${esc(p.name)} <b>${lcCount(p)}</b></a>`).join("")}</div></div>`;const hdr=v.querySelector(".hdr");if(hdr)hdr.insertAdjacentHTML("afterend",html);else v.insertAdjacentHTML("afterbegin",html)}}catch(e){console.warn(e)}return r};
/* saved views come up in Search */
const lcSugg0=typeof showSugg==="function"?showSugg:null;
if(lcSugg0){showSugg=function(){const r=lcSugg0.apply(this,arguments);try{const q=String($("#q")?.value||"").trim().toLowerCase();const box=$("#sugg");if(q.length>=2&&box&&!box.hidden){const hits=live(D.views||[]).filter(v=>String(v.name||"").toLowerCase().includes(q)).slice(0,5);if(hits.length&&!box.querySelector(".lcsv"))box.insertAdjacentHTML("afterbegin",hits.map(v=>`<a class="lcsv sg" role="option" href="${navHref(v.page,v.f)}" data-nav="${esc(v.page)}" data-navf='${esc(JSON.stringify(v.f||{}))}'>👁 View: <b>${esc(v.name)}</b> <span class="status">${esc(PAGE_TITLE[v.page]||v.page)} · ${lcCount(v)}</span></a>`).join(""))}}catch(_){}return r}}
(function(){try{const st=document.createElement("style");st.textContent=`.lctw{overflow:auto;max-width:100%}.lct{width:100%;border-collapse:collapse;font-size:14px}.lct th,.lct td{padding:8px 10px;border-bottom:1px solid var(--line,#e6ebf0);text-align:left;white-space:nowrap}.lct th.r,.lct td.r{text-align:right}.lct td{max-width:260px;overflow:hidden;text-overflow:ellipsis}
.lct thead th{position:sticky;top:0;background:var(--card,#fff);z-index:1}.lct thead th button{background:none;border:0;font:inherit;font-weight:600;cursor:pointer;padding:4px 0;min-height:32px}.lct thead th button.on{color:var(--accent,#2f5f8f)}.lct .lcf th{top:41px}.lct .lcf input{width:100%;min-width:70px;min-height:32px;padding:4px 6px;font-size:13px}
.lct tbody tr{cursor:pointer}.lct tbody tr:hover{background:var(--soft,#e6eef6)}#lcpick{position:absolute;right:0;top:44px;z-index:40;background:var(--card,#fff);border:1px solid var(--line,#dde3ea);border-radius:10px;box-shadow:0 10px 28px rgba(20,40,60,.16);padding:6px;min-width:200px;max-height:60vh;overflow:auto}#lcpick[hidden]{display:none}.lcck{display:flex;gap:8px;align-items:center;padding:6px;min-height:36px}`;document.head.appendChild(st)}catch(_){}})();
