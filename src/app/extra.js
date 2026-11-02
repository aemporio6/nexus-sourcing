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
function nextStep(p){const st=poState(p);if(["cancelled","closed"].includes(p.status))return null;
 const sch=(p.schedule||[]);const due=sch.find(m=>!m.paid&&!(m.covered));
 if(!p.piNo&&!p.docs?.pi)return{t:"Add the PI (invoice) number or link so payments and duplicates can be matched",b:`<button class="btn sm" data-act="edit" data-col="purchases" data-id="${esc(p.no)}">Add PI</button>`};
 if(st.outstandingCur>0.5&&st.paidCur<0.5)return{t:`Pay the deposit — ${fmt(Math.min(st.outstandingCur,due?.amount||st.outstandingCur),p.cur)}`,b:`<button class="btn sm pri" data-act="pay" data-po="${esc(p.no)}">Pay</button>`};
 if(["production","ordered","confirmed","part_shipped"].includes(p.status)&&!(D.shipments||[]).some(s=>!s.deletedAt&&(s.purchases||[]).includes(p.no)))return{t:"When the goods leave the factory, record the shipment (cartons, kg, forwarder)",b:`<button class="btn sm" data-act="ship" data-po="${esc(p.no)}">Record shipment</button>`};
 if(st.outstandingCur>0.5)return{t:`Still to pay ${fmt(st.outstandingCur,p.cur)}${due?.label?" — next: "+due.label:""}`,b:`<button class="btn sm" data-act="pay" data-po="${esc(p.no)}">Pay</button>`};
 const sh=(D.shipments||[]).find(s=>!s.deletedAt&&(s.purchases||[]).includes(p.no)&&s.status==="arrived");
 if(sh)return{t:`${sh.no} has arrived — receive the stock so it counts`,b:`<button class="btn sm pri" data-act="receive" data-sh="${esc(sh.no)}">Receive</button>`};
 return null}
function nextBlock(p){const n=nextStep(p);return n?`<div class="note" style="margin:0 0 10px;display:flex;gap:10px;align-items:center;justify-content:space-between;border-left:3px solid var(--accent)"><span>👉 <b>Next step:</b> ${esc(n.t)}</span>${n.b}</div>`:""}

/* wrap the order drawer: parts + next step on top */
if(typeof openPO==="function"){const _openPO=openPO;openPO=function(p){const r=_openPO(p);try{const x=docOf("purchases",p);if(r&&x)r.body=nextBlock(x)+partsBlock(x)+r.body}catch(e){console.warn(e)}return r}}

/* ---------- Drive folder names: cartons first ---------- */
if(typeof folderName==="function"){const _fn=folderName;folderName=function(d,col){try{if(col==="purchases"){const st=poState(d);const ctn=poCtn(d);const mode=(D.shipments||[]).find(s=>!s.deletedAt&&(s.purchases||[]).includes(d.no));const parts=[(d.oldRef||d.no).replace(/^VAL-/,""),ctn?ctn+" CTN":"",fmtD(d.date||today()),poDesc(d).slice(0,28),mode?L("mode",mode.mode):"",fmt(st.total,d.cur),((SET().companies||[]).find(c=>c.id===d.account)?.code||"VAL")].filter(Boolean);return parts.join(" | ").replace(/[\/\\:*?"<>]/g,"-")}if(col==="shipments"){return[d.no,d.ctn?d.ctn+" CTN":"",fmtD(d.date||today()),pname(d.party),L("mode",d.mode),d.cost?fmt(d.cost,d.costCur||"USD"):""].filter(Boolean).join(" | ").replace(/[\/\\:*?"<>]/g,"-")}}catch(e){}return _fn(d,col)}}

/* ---------- Setup lists v4 needs (added once, quietly, by the Owner) ---------- */
async function ensureSetupV4(){try{if(!D.setup||!can("setup"))return;const L0=D.setup.lists||{};const pairs=[];
 const add=(key,label,group,its,fields)=>{if(!L0[key])pairs.push([["lists",key],{label,group,items:its,...(fields?{fields}:{})}])};
 add("department","Departments","General",[["sourcing","Sourcing / China"],["warehouse","Warehouse"],["accounts","Accounts / Finance"],["marketing","Marketing / Listings"],["admin","Admin"],["logistics","Logistics"]].map(([id,label])=>({id,label})));
 add("fbaCentre","Amazon FBA centres","Logistics",[["BHX4","BHX4 Coventry"],["LBA4","LBA4 Doncaster"],["LTN4","LTN4 Dunstable"],["EMA1","EMA1 Castle Donington"],["MAN1","MAN1 Manchester"],["BRS1","BRS1 Bristol"]].map(([id,label])=>({id,label})));
 add("packType","Packaging type","Products",[["giftbox","Gift box"],["colourbox","Colour box"],["brownbox","Brown box"],["polybag","Polybag"],["blister","Blister"]].map(([id,label])=>({id,label})));
 add("leadStage","Lead-time stages (days)","Planning",[["mould","Mould",30],["packaging","Packaging",10],["production","Production",25],["toForwarder","To forwarder",4],["sea","Sea",60],["air","Air",15],["road","Road (truck)",30],["agl","AGL",35],["fbaCheckin","FBA check-in",10],["safety","Safety stock",14]].map(([id,label,days])=>({id,label,days})),[["days","Days","num"]]);
 if(pairs.length){await setupPatchMany(pairs,null,{noUndo:true});logEv("setup","setup","main","Setup lists added for MY TOOL v4: "+pairs.map(p=>p[0][1]).join(", "))}}catch(e){console.warn(e)}}
setTimeout(function tick(){try{if(S.ready){ensureSetupV4();return}}catch(_){}setTimeout(tick,800)},800);
