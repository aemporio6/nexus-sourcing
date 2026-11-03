/* MY TOOL — extra: links between parts of one PI, "next step" guidance, Drive folder names (cartons first), Setup lists needed by v4.
   Loaded after drawers/setup/importer/icc; wraps a few globals instead of editing them. */

/* ---------- parts of one big order (e.g. 546 ctn → 99 + 78 + rest) ---------- */
function partsOf(no){return live(D.purchases).filter(p=>p.partOf===no)}
function partsBlock(p){
 const kids=partsOf(p.no);const parent=p.partOf?D.purchases.find(x=>x.no===p.partOf):null;
 if(!kids.length&&!parent)return"";
 const chip=x=>{const s=poState(x);return`<button type="button" class="chipb" data-open="purchases" data-id="${esc(x.no)}">${esc(x.no)}${x.oldRef?" · "+esc(x.oldRef):""} · ${num(poCtn(x))} ctn · ${esc(fmt(s.total,x.cur))}</button>`};
 if(parent)return`<div class="note" style="margin:0 0 10px"><b>Part of ${esc(parent.no)}${parent.oldRef?" ("+esc(parent.oldRef)+")":""}</b> — same PI ${esc(p.piNo||"")}. The deposit was paid on the big order and shared to each part. ${chip(parent)}${partsOf(parent.no).filter(x=>x.no!==p.no).length?` · other parts: ${partsOf(parent.no).filter(x=>x.no!==p.no).map(chip).join(" ")}`:""}</div>`;
 const totK=kids.reduce((s,x)=>s+poState(x).total,0);
 return`<div class="note" style="margin:0 0 10px"><b>Split into parts</b> (same PI ${esc(p.piNo||"")}): ${kids.map(chip).join(" ")}<br><small class="status">This order now holds only what is not in a part. Parts total ${esc(fmt(totK,p.cur))} + this ${esc(fmt(poState(p).total,p.cur))} = original PI ${esc(fmt(totK+poState(p).total,p.cur))}.</small></div>`}
function poCtn(p){if(+p.ctn)return +p.ctn;const c=(p.lines||[]).reduce((s,l)=>{const pr=typeof product==="function"?product(l.sku):null;const per=+(pr?.ctn?.units||pr?.perCtn||0);return s+(per?Math.ceil((+l.q||0)/per):0)},0);if(c)return c;const m=String(p.desc||p.notes||"").match(/(\d+)\s*(?:ctn|cartons?|crtn|box(?:es)?)/i);return m?+m[1]:0}

/* ---------- next step: one clear suggestion with a button ---------- */
function nextStep(p){const st=poState(p);if(p.status==="cancelled")return null;if(p.historic&&st.outstandingCur<=0.5)return null;
 if(p.status==="closed"){return st.outstandingCur>0.5?{t:`Order is closed but ${fmt(st.outstandingCur,p.cur)} is still unpaid — pay it, add a credit note, or correct the order`,b:`<button class="btn sm" data-act="pay" data-po="${esc(p.no)}">Pay</button>`}:null}
 const sch=(p.schedule||[]);const due=sch.find(m=>!m.paid&&!(m.covered));const shs=(D.shipments||[]).filter(s=>!s.deletedAt&&shipPos(s).includes(p.no));
 if(!p.yourRef&&!p.piNo&&!p.piLink&&!p.docs?.pi)return{t:"Add the supplier PI number or link so payments and duplicates can be matched",b:`<button class="btn sm" data-act="edit" data-col="purchases" data-id="${esc(p.no)}">Add PI</button>`};
 if(st.outstandingCur>0.5&&st.paidCur<0.5)return{t:`Pay the deposit — ${fmt(Math.min(st.outstandingCur,due?.amount||st.outstandingCur),p.cur)}`,b:`<button class="btn sm pri" data-act="pay" data-po="${esc(p.no)}">Pay</button>`};
 if(["production","ordered","confirmed","deposit"].includes(p.status)&&!shs.length)return{t:"When the goods leave the factory, record the shipment (cartons, kg, forwarder)",b:`<button class="btn sm" data-act="ship" data-po="${esc(p.no)}">Record shipment</button>`};
 if(st.outstandingCur>0.5)return{t:`Still to pay ${fmt(st.outstandingCur,p.cur)}${due?.label?" — next: "+due.label:""}`,b:`<button class="btn sm" data-act="pay" data-po="${esc(p.no)}">Pay</button>`};
 const sh=shs.find(s=>["arrived","part_delivered"].includes(s.status));
 if(sh)return{t:`${sh.no} has arrived — receive the stock so it counts`,b:`<button class="btn sm pri" data-act="receive" data-sh="${esc(sh.no)}">Receive</button>`};
 return null}
function shipNext(s){if(s.historic||s.status==="cancelled")return null;const cur=s.costCur||"USD";const T=today();
 if(!(+s.ctn>0))return{t:"Add the number of cartons (and kg / cbm) so freight per unit can be worked out",b:`<button class="btn sm" data-act="edit" data-col="shipments" data-id="${esc(s.no)}">Add cartons</button>`};
 if(!shipPos(s).length)return{t:"Link the order(s) in this shipment so stock and cost go to the right products",b:`<button class="btn sm" data-act="edit" data-col="shipments" data-id="${esc(s.no)}">Add orders</button>`};
 let paid=0;try{paid=paysFor(s.no).reduce((a,x)=>a+paidIn(x,s.no,cur),0)}catch(_){}const tot=(+s.cost||0)*(1+(+s.platformFeePct||0)/100)+(+s.insurance||0);
 if(tot-paid>0.5&&s.status!=="delivered")return{t:`Pay the forwarder — ${fmt(tot-paid,cur)} still to pay`,b:`<button class="btn sm" data-act="pay" data-sh="${esc(s.no)}">Pay</button>`};
 if(["booked","in_transit","customs"].includes(s.status)&&s.eta&&s.eta<T)return{t:`ETA ${fmtD(s.eta)} has passed — update the status (arrived?) or the ETA`,b:`<button class="btn sm" data-act="edit" data-col="shipments" data-id="${esc(s.no)}">Update</button>`};
 if(["arrived","part_delivered"].includes(s.status)&&!live(D.receipts).some(r=>r.src===s.no))return{t:"Goods have arrived — receive them so the stock counts",b:`<button class="btn sm pri" data-act="receive" data-sh="${esc(s.no)}">Receive</button>`};
 if(tot-paid>0.5)return{t:`Delivered but ${fmt(tot-paid,cur)} freight still unpaid`,b:`<button class="btn sm" data-act="pay" data-sh="${esc(s.no)}">Pay</button>`};
 return null}
function payNext(x){if(x.status==="pending")return{t:"Payment is pending — when the money is sent, mark it paid and attach the receipt",b:`<button class="btn sm pri" data-act="edit" data-col="payments" data-id="${esc(x.no)}">Mark paid</button>`};
 if(x.status==="paid"&&x.direction!=="in"&&!x.receipt&&!x.docs?.receipt)return{t:"Attach the bank / platform receipt (proof of payment)",b:`<button class="btn sm" data-act="edit" data-col="payments" data-id="${esc(x.no)}">Add receipt</button>`};
 if(x.status==="paid"&&!(x.allocations||[]).length&&!x.ref)return{t:"Link this payment to the order / shipment it pays for",b:`<button class="btn sm" data-act="edit" data-col="payments" data-id="${esc(x.no)}">Link</button>`};
 return null}
function prodNext(p){if(p.status&&p.status!=="active")return null;let r={};try{r=reorderInfo(p.sku)}catch(_){}
 if(r.out)return{t:"Out of stock — reorder now",b:`<button class="btn sm pri" data-act="reorder" data-sku="${esc(p.sku)}">Reorder</button>`};
 if(r.reorderIn!=null&&r.reorderIn<=(DEF().reorderWarnDays||30))return{t:r.reorderIn<=0?"Reorder date has passed — order now":`Reorder within ${r.reorderIn} days`,b:`<button class="btn sm" data-act="reorder" data-sku="${esc(p.sku)}">Reorder</button>`};
 if(!(p.suppliers||[]).length)return{t:"Add the supplier and price so reorders and costing work",b:`<button class="btn sm" data-act="edit" data-col="products" data-id="${esc(p.sku)}">Add supplier</button>`};
 if(!p.asin&&!(p.listings||[]).length&&!p.fnsku)return{t:"Add the ASIN / marketplace listing so sales can be matched",b:`<button class="btn sm" data-act="edit" data-col="products" data-id="${esc(p.sku)}">Add ASIN</button>`};
 return null}
function partyNext(x){if(x.status==="archived")return null;
 if(x.type==="supplier"){const owe=live(D.purchases).filter(p=>p.party===x.code&&p.status!=="cancelled").map(p=>[p,poState(p)]).filter(([p,st])=>st.outstandingCur>0.5);if(owe.length){const[p,st]=owe.sort((a,b)=>(a[0].date||"")<(b[0].date||"")?-1:1)[0];return{t:`${owe.length} order${owe.length>1?"s":""} still owing — oldest ${p.no}: ${fmt(st.outstandingCur,p.cur)}`,b:`<button class="btn sm" data-act="pay" data-po="${esc(p.no)}">Pay ${esc(p.no)}</button>`}}}
 if(!x.contact&&!x.wechat&&!x.email&&!x.phone)return{t:"Add a contact (WeChat / email / phone)",b:`<button class="btn sm" data-act="edit" data-col="parties" data-id="${esc(x.code)}">Add contact</button>`};
 return null}
const nbHtml=n=>n?`<div class="note" style="margin:0 0 10px;display:flex;gap:10px;align-items:center;justify-content:space-between;border-left:3px solid var(--accent)"><span>👉 <b>Next step:</b> ${esc(n.t)}</span>${n.b}</div>`:"";
{const wrapNext=(orig,col,nx)=>function(x){const r=orig(x);try{const d=docOf(col,x);if(r&&d){const h=nbHtml(nx(d));if(h)r.body=h+r.body}}catch(e){console.warn(e)}return r};
 openShip=wrapNext(openShip,"shipments",shipNext);openPay=wrapNext(openPay,"payments",payNext);openProduct=wrapNext(openProduct,"products",prodNext);openParty=wrapNext(openParty,"parties",partyNext)}
function nextBlock(p){const n=nextStep(p);return n?`<div class="note" style="margin:0 0 10px;display:flex;gap:10px;align-items:center;justify-content:space-between;border-left:3px solid var(--accent)"><span>👉 <b>Next step:</b> ${esc(n.t)}</span>${n.b}</div>`:""}

/* wrap the order drawer: parts + next step on top */
if(typeof openPO==="function"){const _openPO=openPO;openPO=function(p){const r=_openPO(p);try{const x=docOf("purchases",p);if(r&&x)r.body=nextBlock(x)+partsBlock(x)+r.body}catch(e){console.warn(e)}return r}}

/* ---------- Drive folder names: cartons first ---------- */
if(typeof folderName==="function"){const _fn=folderName;folderName=function(d,col){try{if(col==="purchases"){const st=poState(d);const ctn=poCtn(d);const mode=(D.shipments||[]).find(s=>!s.deletedAt&&(s.purchases||[]).includes(d.no));const parts=[(d.oldRef||d.no).replace(/^VAL-/,""),ctn?ctn+" CTN":"",fmtD(d.date||today()),pname(d.party),poDesc(d).slice(0,28),mode?L("mode",mode.mode):"",fmt(st.total,d.cur),((SET().companies||[]).find(c=>c.id===d.account)?.code||"VAL")].filter(Boolean);return parts.join(" | ").replace(/[\/\\:*?"<>]/g,"-")}if(col==="shipments"){return[d.no,d.ctn?d.ctn+" CTN":"",fmtD(d.date||today()),pname(d.party),L("mode",d.mode),d.cost?fmt(d.cost,d.costCur||"USD"):""].filter(Boolean).join(" | ").replace(/[\/\\:*?"<>]/g,"-")}}catch(e){}return _fn(d,col)}}

/* ---------- Setup lists v4 needs (added once, quietly, by the Owner) ---------- */
async function ensureSetupV4(){try{if(!D.setup||!can("setup"))return;const L0=D.setup.lists||{};const pairs=[];
 const add=(key,label,group,its,fields)=>{if(!L0[key])pairs.push([["lists",key],{label,group,items:its,...(fields?{fields}:{})}])};
 add("department","Departments","General",[["sourcing","Sourcing / China"],["warehouse","Warehouse"],["accounts","Accounts / Finance"],["marketing","Marketing / Listings"],["admin","Admin"],["logistics","Logistics"]].map(([id,label])=>({id,label})));
 add("fbaCentre","Amazon FBA centres","Logistics",[["BHX4","BHX4 Coventry"],["LBA4","LBA4 Doncaster"],["LTN4","LTN4 Dunstable"],["EMA1","EMA1 Castle Donington"],["MAN1","MAN1 Manchester"],["BRS1","BRS1 Bristol"]].map(([id,label])=>({id,label})));
 add("packType","Packaging type","Products",[["giftbox","Gift box"],["colourbox","Colour box"],["brownbox","Brown box"],["polybag","Polybag"],["blister","Blister"]].map(([id,label])=>({id,label})));
 add("ukPort","UK arrival ports","Logistics",[["felixstowe","Felixstowe"],["southampton","Southampton"],["london_gateway","London Gateway"],["tilbury","Tilbury"],["immingham","Immingham"],["liverpool","Liverpool"],["lhr","Heathrow (air)"],["man_air","Manchester (air)"],["ema_air","East Midlands (air)"],["dover","Dover (road)"]].map(([id,label],i)=>({id,label,...(i===0?{default:true}:{})})));
 if(!D.setup.v4defaults){const want={currency:"RMB",purchaseKind:"china",payStatus:"paid",uom:"pack",brand:"WAL",country:"china",productStatus:"active",dutyBy:"us",originPort:"shenzhen",payTerms:"30_50_20_port",goodsType:"gen"};
  Object.entries(want).forEach(([k,id])=>{const its=(L0[k]&&L0[k].items)||[];if(its.some(i=>i.default))return;const ix=its.findIndex(i=>i.id===id);if(ix>=0)pairs.push([["lists",k,"items",ix,"default"],true])});pairs.push([["v4defaults"],true])}
 if(pairs.length){await setupPatchMany(pairs,null,{noUndo:true});const nl=pairs.filter(p=>p[0].length===2&&p[0][0]==="lists").map(p=>p[0][1]);logEv("setup","setup","main","MY TOOL v4 setup: "+(nl.length?"lists added "+nl.join(", ")+"; ":"")+"defaults set (change any in Setup › Lists)")}}catch(e){console.warn(e)}}
setTimeout(function tick(){try{if(S.ready){ensureSetupV4();return}}catch(_){}setTimeout(tick,800)},800);

/* ---------- Data: download backup / load a data file (Owner) ---------- */
document.addEventListener("click",e=>{const b=e.target.closest('[data-act="mtbackup"]');if(!b||!window.MYTOOL)return;e.stopPropagation();MYTOOL.backup()},true);
document.addEventListener("change",async e=>{const inp=e.target.closest&&e.target.closest("input.mt_restore");if(!inp||!window.MYTOOL)return;const f=inp.files&&inp.files[0];inp.value="";if(!f)return;
 if(!confirm("Replace ALL data in MY TOOL with \""+f.name+"\"?\n\nEveryone will see the new data. A backup of the current data is downloaded first."))return;
 try{await MYTOOL.backup();toast("Loading "+f.name+"…");await MYTOOL.restore(f)}catch(err){alert("Could not load the file: "+(err.message||err))}},true);

/* ---------- proof & VAT alerts: PI not in our company's name, paid payments without a receipt ---------- */
function ourCoName(p){return((SET().companies||[]).find(c=>c.id===p.account)?.name||"").trim()}
function piNotOurs(p){const b=String(p.piBilledTo||"").trim();if(!b)return false;const n=ourCoName(p);return n&&b.toLowerCase().replace(/\s+(ltd|limited)\.?$/,"")!==n.toLowerCase().replace(/\s+(ltd|limited)\.?$/,"")}
if(typeof attention==="function"){const _att=attention;attention=function(){const out=_att();try{const T=today();
 live(D.purchases).filter(p=>!["cancelled","closed"].includes(p.status)&&piNotOurs(p)).forEach(p=>out.push({sev:1,text:`${p.no}${p.oldRef?" ("+p.oldRef+")":""} · PI is in the name of ${p.piBilledTo}, not ${ourCoName(p)} — ask the supplier to reissue it (needed for import VAT)`,col:"purchases",id:p.no,d:T}));
 live(D.payments).filter(x=>x.status==="paid"&&x.direction!=="in"&&(x.date||"")>="2026-01-01"&&!x.receipt&&!x.docs?.receipt?.url&&!x.docs?.receipt).forEach(x=>out.push({sev:0,text:`${x.no} · ${fmt(x.amount,x.cur)} paid ${fmtD(x.date)} — no receipt attached`,col:"payments",id:x.no,d:x.date}));
}catch(e){console.warn(e)}return out}}
/* order drawer: who the PI is billed to + extra columns that came with an import */
if(typeof openPO==="function"){const _o2=openPO;openPO=function(p){const r=_o2(p);try{const x=docOf("purchases",p);if(r&&x){let add="";
 if(x.piBilledTo)add+=`<div class="${piNotOurs(x)?"warnbox":"note"}" style="margin:0 0 10px">PI billed to <b>${esc(x.piBilledTo)}</b>${piNotOurs(x)?` — not ${esc(ourCoName(x))}. Ask for a reissued PI/CI in ${esc(ourCoName(x))}'s name (import VAT can only be claimed by the importer of record).`:" ✓"}</div>`;
 const xs=(x.lines||[]).filter(l=>l.x&&Object.keys(l.x).length);if(xs.length){const keys=[...new Set(xs.flatMap(l=>Object.keys(l.x)))];add+=`<div class="card" style="margin:0 0 10px"><div class="card-h"><h2>Extra columns from the import</h2><span class="status">${keys.length} field${keys.length===1?"":"s"}</span></div><div class="tbl" style="overflow:auto"><table><tr><th>Line</th>${keys.map(k=>`<th>${esc(k)}</th>`).join("")}</tr>${xs.map(l=>`<tr><td class="num">${esc(l.sku||"")}</td>${keys.map(k=>`<td>${esc(l.x[k]??"")}</td>`).join("")}</tr>`).join("")}</table></div></div>`}
 r.body=add+r.body}}catch(e){console.warn(e)}return r}}

/* ---------- Drive inbox: files dropped in "MY TOOL – INBOX" (any Drive folder with that name) show as a task ---------- */
S.inbox=S.inbox||{n:0,files:[]};
async function checkInbox(){try{if(!window.MYTOOL||MYTOOL.demo||!MYTOOL.drive||!can("create"))return;
 let folders=[];for(const root of ["root","shared"]){try{folders=folders.concat((await MYTOOL.drive.list(root,{foldersOnly:true})).filter(f=>/^MY TOOL\s*[–-]\s*INBOX$/i.test(f.name)))}catch(_){}}
 if(!folders.length)return;const since=ls.get("inboxSeen","2000-01-01T00:00:00Z");let files=[];
 for(const f of folders){const fs=await MYTOOL.drive.list(f.id,{since});files=files.concat(fs.filter(x=>x.mimeType!=="application/vnd.google-apps.folder"))}
 S.inbox={n:files.length,files,folder:folders[0].id};S._att=null;if(files.length){toast(`${files.length} new file${files.length===1?"":"s"} in MY TOOL – INBOX — open Import to bring ${files.length===1?"it":"them"} in`);render()}}catch(e){console.warn("inbox",e)}}
if(typeof attention==="function"){const _att2=attention;attention=function(){const out=_att2();try{if(S.inbox?.n)out.push({sev:1,text:`${S.inbox.n} new file${S.inbox.n===1?"":"s"} in Drive folder MY TOOL – INBOX: ${S.inbox.files.slice(0,3).map(f=>f.name).join(", ")}${S.inbox.n>3?"…":""} — open Import → From Google Drive`,col:"imports",id:"inbox",d:today()})}catch(_){}return out}}
document.addEventListener("click",e=>{const r=e.target.closest('[data-open="imports"][data-id="inbox"]');if(!r)return;e.stopPropagation();e.preventDefault();ls.set("inboxSeen",new Date().toISOString());S.inbox={n:0,files:[]};S._att=null;go("import")},true);
setTimeout(function tick2(){try{if(S.ready){checkInbox();setInterval(checkInbox,15*60*1000);return}}catch(_){}setTimeout(tick2,1500)},3000);

/* record drawer: Alt+↑ / Alt+↓ = previous / next record in the list it was opened from */
window.addEventListener("keydown",e=>{try{if(!S.drawer||S.drawer.form||!e.altKey||e.ctrlKey||e.metaKey)return;if(e.key!=="ArrowDown"&&e.key!=="ArrowUp")return;const ids=drawerSiblings(S.drawer);const i=ids.indexOf(S.drawer.id);const nx=ids[i+(e.key==="ArrowDown"?1:-1)];if(i<0||!nx)return;e.preventDefault();openDoc(S.drawer.col,nx)}catch(_){}});
