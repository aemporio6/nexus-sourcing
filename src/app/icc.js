/* ===================== ICC — Inventory Cycle Calculator (page "planner") =====================
   Rules + maths only. State in S.icc (kept while switching pages). Own events (data-icc / data-icc-act), guarded by S.view.k==="planner".
   Typing updates the result areas only; structural changes (picking products, stages, modes) re-render this page. */

/* ---------- defaults (also written to Setup › Lists as "leadStage" and "packType" when missing; Owner only) ---------- */
const ICC_STAGES=[["mould","Mould / tooling"],["pack","Packaging"],["prod","Production"],["fwd","Factory → forwarder"],["ship","Shipping"],["fba","FBA check-in"],["safety","Safety stock"]];
const ICC_STAGE_DEF={label:"Lead-time stages (Planner)",group:"Planner",coded:false,fields:[["stage","Stage (mould, pack, prod, fwd, ship, fba, safety)"],["days","Days","num"],["basis","Charge basis kg / cbm (shipping)"],["rate","Freight rate per kg or CBM (shipping)","num"],["cur","Rate currency (shipping)"],["divisor","Volumetric divisor (shipping)","num"]],items:[
 {id:"mould_none",label:"No new mould (repeat product)",stage:"mould",days:0,default:true},{id:"mould_new",label:"New mould / tooling",stage:"mould",days:30},{id:"mould_long",label:"Complex mould",stage:"mould",days:45},
 {id:"pack_std",label:"Printed packaging",stage:"pack",days:10,default:true},{id:"pack_stock",label:"Packaging already in stock",stage:"pack",days:0},{id:"pack_new",label:"New packaging design + print",stage:"pack",days:20},
 {id:"prod_30",label:"Standard production",stage:"prod",days:30,default:true},{id:"prod_15",label:"Repeat order, fast production",stage:"prod",days:15},{id:"prod_45",label:"Large / new production",stage:"prod",days:45},
 {id:"fwd_5",label:"Factory → forwarder (standard)",stage:"fwd",days:5,default:true},{id:"fwd_2",label:"Factory near forwarder",stage:"fwd",days:2},
 {id:"ship_sea",label:"Sea",stage:"ship",days:60,basis:"cbm",rate:"",cur:"USD",divisor:0,default:true},{id:"ship_air",label:"Air",stage:"ship",days:15,basis:"kg",rate:"",cur:"USD",divisor:6000},
 {id:"ship_road",label:"Road (e.g. Shunqi)",stage:"ship",days:30,basis:"kg",rate:2.1,cur:"USD",divisor:6000},{id:"ship_agl",label:"AGL (Amazon Global Logistics)",stage:"ship",days:45,basis:"kg",rate:"",cur:"USD",divisor:6000},
 {id:"ship_exp",label:"Express courier",stage:"ship",days:7,basis:"kg",rate:"",cur:"USD",divisor:5000},
 {id:"fba_10",label:"FBA check-in",stage:"fba",days:10,default:true},{id:"fba_peak",label:"FBA check-in (peak season)",stage:"fba",days:21},{id:"fba_0",label:"Own warehouse (no FBA wait)",stage:"fba",days:0},
 {id:"safety_14",label:"Safety stock 2 weeks",stage:"safety",days:14,default:true},{id:"safety_7",label:"Safety stock 1 week",stage:"safety",days:7},{id:"safety_30",label:"Safety stock 1 month",stage:"safety",days:30}]};
const ICC_PACK_DEF={label:"Packaging types",group:"Products",coded:false,fields:[],items:[{id:"giftbox",label:"Gift box",default:true},{id:"colourbox",label:"Colour box"},{id:"polybag",label:"Polybag"},{id:"brownbox",label:"Brown box"},{id:"blister",label:"Blister / clamshell"},{id:"none",label:"No packaging"}]};
const ICC_CYCLES=[["30","30 days (1 month)"],["45","45 days"],["60","60 days (2 months)"],["90","90 days (3 months)"],["120","120 days (4 months)"],["180","180 days (6 months)"],["custom","Custom…"]];
const ICC_DIV=[["6000","÷ 6000 (air / road / AGL)"],["5000","÷ 5000 (express courier)"],["4000","÷ 4000"],["3000","÷ 3000 (rail 1:333)"]];
const ICC_AMZ={maxKg:23,maxCm:63.5};/* Amazon UK carton limits */

const iccList=k=>{const l=SET().lists?.[k];const d=k==="leadStage"?ICC_STAGE_DEF:ICC_PACK_DEF;const ok=l&&(l.items||[]).length&&(k!=="leadStage"||(l.items||[]).some(i=>i.stage));return ok?l:d};
const iccStageItems=st=>iccList("leadStage").items.filter(i=>!i.archived&&i.stage===st);
const iccStageItem=id=>iccList("leadStage").items.find(i=>i.id===id);
const iccPackItems=()=>iccList("packType").items.filter(i=>!i.archived);
async function iccSeedSetup(){if(S._iccSeeded||!D.setup||!can("setup"))return;S._iccSeeded=true;const pairs=[];if(!SET().lists?.leadStage||!(SET().lists.leadStage.items||[]).some(i=>i.stage))pairs.push(["lists.leadStage",JSON.parse(JSON.stringify(ICC_STAGE_DEF))]);if(!SET().lists?.packType)pairs.push(["lists.packType",JSON.parse(JSON.stringify(ICC_PACK_DEF))]);if(pairs.length){S.holdRender=true;try{await setupPatchMany(pairs,null,{noUndo:true})}finally{S.holdRender=false}}}

/* ---------- state ---------- */
function iccInit(){if(S.icc)return S.icc;const st={src:"app",skus:[],q:"",newp:{name:"",price:"",cur:DEF().cur||"RMB",moq:"",party:""},sales:{mode:"data",day:"",month:""},per:{},dimKey:"",dims:{},divisor:"6000",ov:{ctn:"",kg:"",cbm:""},stages:{},packWhen:"along",cycle:String(DEF().cycleDays||90),cycN:"",cycU:"d",nCyc:"4",terms:"",rate:{},moqRule:"sku",moqOrder:"",planName:""};
 ICC_STAGES.forEach(([k])=>{const its=iccStageItems(k);const d=its.find(i=>i.default)||its[0];st.stages[k]={id:d?.id||"",days:d?.days??0}});
 const tm=items("payTerms");st.terms=(tm.find(t=>t.id==="30_50_20_port")||tm.find(t=>/30.*50.*20/.test(t.label||""))||defaultItem("payTerms")||{}).id||"";
 iccShipRate(st);S.icc=st;return st}
function iccShipRate(st){const it=iccStageItem(st.stages.ship?.id);st.rate={v:it?.rate??"",basis:it?.basis||"kg",cur:it?.cur||"USD"};if(+it?.divisor)st.divisor=String(it.divisor)}
const iccN=v=>{if(v==null||v==="")return null;const x=parseFloat(String(v).replace(/,/g,""));return isNaN(x)?null:x};
const iccKey=()=>S.icc.src==="new"?"__new":(S.icc.dimKey&&S.icc.skus.includes(S.icc.dimKey)?S.icc.dimKey:S.icc.skus[0]||"");

/* ---------- parsing pasted text: "21*11.5*4.5cm", "200g", "1.2kg", "48pcs" ---------- */
function iccParse(text){const s=String(text||"").toLowerCase().replace(/(\d),(\d{3})(?!\d)/g,"$1$2").replace(/,/g,".").replace(/×/g,"x");const o={};
 const m=s.match(/(\d+(?:\.\d+)?)\s*(?:cm|mm)?\s*[x*]\s*(\d+(?:\.\d+)?)\s*(?:cm|mm)?\s*[x*]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m\b)?/);
 if(m){let f=m[4]==="mm"||/\dmm/.test(s)&&!/cm/.test(s)?0.1:m[4]==="m"?100:1;o.L=+(m[1]*f).toFixed(2);o.W=+(m[2]*f).toFixed(2);o.H=+(m[3]*f).toFixed(2)}
 const kg=s.match(/(\d+(?:\.\d+)?)\s*kgs?\b/);const g=s.match(/(\d+(?:\.\d+)?)\s*(?:g|gr|gram|grams)\b/);if(kg)o.kg=+kg[1];else if(g)o.kg=+g[1]/1000;
 const pc=s.match(/(\d+)\s*(?:pcs|pc|units|unit|sets|set|packs|pack)\b/);if(pc)o.pcs=+pc[1];
 const ct=s.match(/(\d+)\s*(?:ctns?|cartons?|cases?)\b/);if(ct)o.ctn=+ct[1];const cb=s.match(/(\d+(?:\.\d+)?)\s*(?:cbm|m3|m³)/);if(cb)o.cbm=+cb[1];return o}

/* ---------- per-product working data ---------- */
function iccSalesData(sku){const T=today();const sold=d=>live(D.moves).filter(m=>m.sku===sku&&m.type==="sold"&&(m.date||"")>addDays(T,-d)&&(m.date||"")<=T).reduce((a,m)=>a+(+m.qty||0),0);
 const s30=sold(30),s60=sold(60),s90=sold(90);if(s90>0){const v30=s30/30,v60=s60/60,v90=s90/90;const v=(3*v30+2*v60+v90)/6;return{v,how:`Sold last 30 d ${num(s30)} (${num(v30,2)}/d) ×3 + last 60 d ${num(s60)} (${num(v60,2)}/d) ×2 + last 90 d ${num(s90)} (${num(v90,2)}/d) ×1, ÷ 6 = <b>${num(v,2)}/day</b> (recent sales count more)`}}
 const vi=velocityInfo(sku,0);return{v:vi.v||0,how:esc(vi.text)}}
function iccAmazonLoc(id){const l=loc(id);if(!l)return false;if(l.kind==="amazon")return true;return l.parent?iccAmazonLoc(l.parent):false}
function iccDimsFor(key){const st=S.icc;if(st.dims[key])return st.dims[key];const p=key==="__new"?null:product(key);const g=d=>({L:d?.L??"",W:d?.W??"",H:d?.H??"",g:d?.kg!=null&&d.kg!==""?r2(+d.kg*1000):""});
 const d={item:g(p?.item),pkType:p?.pkType||(iccPackItems().find(i=>i.default)||iccPackItems()[0]||{}).id||"",pk:g(p?.pk),perCtn:p?.perCtn??"",ctn:{L:p?.ctn?.L??"",W:p?.ctn?.W??"",H:p?.ctn?.H??"",kg:p?.ctn?.kg??""},perPallet:p?.ctnPerPallet??""};st.dims[key]=d;return d}
function iccRows(){const st=S.icc;if(st.src==="new"){const n=st.newp;return[{key:"__new",sku:"",name:n.name||"New product",vData:0,vHow:"new product — no sales yet; type the expected sales",amazon:0,wh:0,transit:0,prod:0,price:iccN(n.price)||0,cur:n.cur||"RMB",moq:iccN(n.moq)||0,party:n.party||"",feePct:n.party?feePctFor({isNew:true},n.party):0}]}
 return st.skus.map(sku=>{const p=product(sku);if(!p)return null;const s=stockOf(sku);let amazon=0,wh=0;Object.entries(s.byLoc||{}).forEach(([l,q])=>{if(isQuarLoc(l))return;if(iccAmazonLoc(l))amazon+=q;else wh+=q});const sd=iccSalesData(sku);const sup=supOf(p);
  return{key:sku,sku,name:p.name||sku,vData:sd.v,vHow:sd.how,amazon,wh,transit:s.transit||0,prod:s.onOrder||0,price:+sup?.price||0,cur:sup?.cur||DEF().cur||"RMB",moq:+sup?.moq||0,party:sup?.party||"",feePct:feePctFor(p,sup?.party)}}).filter(Boolean)}

/* ---------- the maths ---------- */
function iccCycleDays(){const st=S.icc;if(st.cycle!=="custom")return +st.cycle||90;const n=iccN(st.cycN)||0;return Math.round(n*({d:1,w:7,m:30}[st.cycU]||1))}
function iccLead(st,shipDays){const g=k=>Math.max(0,iccN(st.stages[k]?.days)||0);const mould=g("mould"),pack=g("pack"),prod=g("prod"),fwd=g("fwd"),fba=g("fba"),safety=g("safety");const ship=shipDays==null?g("ship"):shipDays;
 const block=st.packWhen==="before"?pack+prod:Math.max(pack,prod);const pre=mould+block+fwd;return{mould,pack,prod,fwd,ship,fba,safety,block,pre,lead:pre+ship+fba}}
function iccFreight(t,basis,rate,cur,divisor){const vol=t.cbm*1e6/(divisor||6000);let chg,unit;if(basis==="cbm"){chg=Math.max(t.cbm,t.cbm>0?(+FEES().seaCbmMin||0):0);unit="CBM"}else{chg=Math.max(t.kg,vol);unit="kg"}const r=iccN(rate);const cost=r!=null&&t.cbm+t.kg>0?chg*r:null;return{vol,chg,unit,cost,gbp:cost==null?null:toGbp(cost,cur,today())}}
function iccModel(){const st=S.icc;const T=today();const rows=iccRows();const L_=iccLead(st);const cyc=iccCycleDays();
 /* daily sales split */
 const per=r=>st.per[r.key]||{};const fixed=r=>iccN(per(r).day);const typed=st.sales.mode==="day"?iccN(st.sales.day):st.sales.mode==="month"?(iccN(st.sales.month)==null?null:iccN(st.sales.month)/30):null;
 let total=null;let splitHow="";
 if(st.sales.mode==="data"||typed==null){rows.forEach(r=>{r.d=fixed(r)??r.vData;r.share=null});total=rows.reduce((a,r)=>a+r.d,0)}
 else{total=typed;const fx=rows.filter(r=>fixed(r)!=null);const rest=Math.max(0,typed-fx.reduce((a,r)=>a+fixed(r),0));const free=rows.filter(r=>fixed(r)==null);const sumV=free.reduce((a,r)=>a+r.vData,0);
  free.forEach(r=>{r.share=sumV>0?r.vData/sumV:1/free.length;r.d=rest*r.share});fx.forEach(r=>{r.d=fixed(r);r.share=null});splitHow=free.length>1?(sumV>0?"split by each product's share of recent sales":"no sales data — split equally"):""}
 const tot=rows.reduce((a,r)=>a+r.d,0);rows.forEach(r=>{r.pct=tot>0?r.d/tot:0});
 /* per product */
 rows.forEach(r=>{const p=per(r);["amazon","wh","transit","prod","price","moq"].forEach(k=>{const v=iccN(p[k]);if(v!=null)r[k]=v});const dm=iccDimsFor(r.key);r.dims=dm;r.perCtn=iccN(dm.perCtn)||0;
  r.pos=r.amazon+r.wh+r.transit+r.prod;r.rop=r.d*(L_.lead+L_.safety);r.cycQ=r.d*cyc;let q=Math.ceil(r.cycQ-1e-9);r.moqUp=st.moqRule==="sku"&&r.moq>q&&q>0;if(r.moqUp)q=r.moq;r.qRaw=q;r.ctnN=r.perCtn?Math.ceil(q/r.perCtn):null;r.q=r.perCtn?r.ctnN*r.perCtn:q;
  r.days=r.d>0?r.pos/r.d:null;r.orderBy=r.d>0?addDays(T,Math.floor((r.pos-r.rop)/r.d)):null;r.low=r.d>0?addDays(T,Math.floor((r.pos-r.d*L_.safety)/r.d)):null;r.oos=r.d>0?addDays(T,Math.floor(r.pos/r.d)):null});
 /* MOQ for the whole order */
 const moqO=iccN(st.moqOrder);let qSum=rows.reduce((a,r)=>a+r.q,0);let moqScaled=false;if(st.moqRule==="order"&&moqO&&qSum>0&&qSum<moqO){const f=moqO/qSum;rows.forEach(r=>{let q=Math.ceil(r.qRaw*f);r.ctnN=r.perCtn?Math.ceil(q/r.perCtn):null;r.q=r.perCtn?r.ctnN*r.perCtn:q});qSum=rows.reduce((a,r)=>a+r.q,0);moqScaled=true}
 const act=rows.filter(r=>r.d>0);const minD=k=>act.map(r=>r[k]).filter(Boolean).sort()[0]||null;
 const g={d:total||0,rop:rows.reduce((a,r)=>a+r.rop,0),pos:rows.reduce((a,r)=>a+r.pos,0),q:qSum,cycQ:rows.reduce((a,r)=>a+r.cycQ,0),orderBy:minD("orderBy"),low:minD("low"),oos:minD("oos"),moqScaled};
 g.orderDate=g.orderBy?(g.orderBy<T?T:g.orderBy):T;g.dispatch=addDays(g.orderDate,L_.pre);g.ukArr=addDays(g.dispatch,L_.ship);g.avail=addDays(g.ukArr,L_.fba);g.gap=g.oos&&g.avail>g.oos?diffDays(g.oos,g.avail):0;
 /* cartons / weight / CBM per order */
 const missing=[];let ctn=0,kg=0,cbm=0;rows.forEach(r=>{const c=r.dims.ctn;const L1=iccN(c.L),W1=iccN(c.W),H1=iccN(c.H),k1=iccN(c.kg);if(!r.perCtn||!L1||!W1||!H1){missing.push(r.sku||r.name);return}r.cbmCtn=L1*W1*H1/1e6;ctn+=r.ctnN;cbm+=r.ctnN*r.cbmCtn;kg+=r.ctnN*(k1||0)});
 const ov={ctn:iccN(st.ov.ctn),kg:iccN(st.ov.kg),cbm:iccN(st.ov.cbm)};const useOv=ov.ctn!=null||ov.kg!=null||ov.cbm!=null;const ship={ctn:ov.ctn??ctn,kg:ov.kg??kg,cbm:ov.cbm??cbm,useOv,missing};
 const div=+st.divisor||6000;const fr=iccFreight(ship,st.rate.basis,st.rate.v,st.rate.cur,div);
 /* money: goods in the main currency */
 const curs={};rows.forEach(r=>{curs[r.cur]=(curs[r.cur]||0)+1});const cur=Object.keys(curs).sort((a,b)=>curs[b]-curs[a])[0]||DEF().cur||"RMB";
 rows.forEach(r=>{r.goods=r.q*r.price;r.goodsC=r.cur===cur?r.goods:convCur(r.goods,r.cur,cur,T)});const goods=rows.reduce((a,r)=>a+(r.goodsC||0),0);const fee=rows.reduce((a,r)=>a+(r.goodsC||0)*(r.feePct||0)/100,0);
 const terms=item("payTerms",st.terms);const tpl=terms?.template||[{pct:30,label:"Deposit",dueEvent:"order"},{pct:50,label:"Before shipping",dueEvent:"ship"},{pct:20,label:"On arrival at UK port",dueEvent:"arrive"}];
 const evDate=(e,o)=>({order:o.orderDate,deposit:o.orderDate,ready:o.dispatch,ship:o.dispatch,dispatch:o.dispatch,arrive:o.ukArr,port:o.ukArr,receipt:o.avail,delivered:o.avail,invoice30:addDays(o.orderDate,30)}[e]||o.orderDate);
 const cash=tpl.map(m=>{const a=(goods+fee)*(+m.pct||0)/100;return{label:m.label||"",pct:+m.pct||0,date:evDate(m.dueEvent,g),amt:a,gbp:toGbp(a,cur,T)}});if(fr.cost!=null)cash.push({label:`Freight (${iccStageItem(st.stages.ship.id)?.label||"shipping"}, estimate)`,pct:null,date:g.dispatch,amt:fr.cost,cur:st.rate.cur,gbp:fr.gbp});
 /* repeating cycles */
 const n=Math.max(1,Math.min(12,+st.nCyc||4));const cycles=[];for(let k=0;k<n;k++){const od=addDays(g.orderDate,k*cyc);const dp=addDays(od,L_.pre),uk=addDays(dp,L_.ship),av=addDays(uk,L_.fba);cycles.push({k:k+1,order:od,dispatch:dp,uk,avail:av,q:g.q,goods:goods+fee,gbp:toGbp(goods+fee,cur,T),dep:cash[0]?cash[0].amt:0})}
 /* all shipping options side by side */
 const modes=iccStageItems("ship").map(it=>{const l=iccLead(st,+it.days||0);const rop=g.d*(l.lead+l.safety);const ob=g.d>0?addDays(T,Math.floor((g.pos-rop)/g.d)):null;const f=iccFreight(ship,it.basis||"kg",it.id===st.stages.ship.id?st.rate.v:it.rate,it.id===st.stages.ship.id?st.rate.cur:(it.cur||"USD"),+it.divisor||div);return{id:it.id,label:it.label,days:+it.days||0,lead:l.lead,rop,orderBy:ob,avail:addDays(T,l.lead),f,cur:it.id===st.stages.ship.id?st.rate.cur:(it.cur||"USD"),on:it.id===st.stages.ship.id}});
 return{rows,L:L_,cyc,g,ship,fr,div,cur,goods,fee,cash,cycles,modes,terms,splitHow,typed,rate:latestRate()}}

/* ---------- colours: 🟢 > warn days, 🟡 ≤ warn days, 🟠 ≤ 14 d, 🔴 past ---------- */
function iccTone(iso){if(!iso)return{e:"⚪",c:"p-mute",t:"no date"};const d=diffDays(today(),iso);const w=+DEF().reorderWarnDays||30;if(d<0)return{e:"🔴",c:"p-bad",t:`${-d} d overdue`};if(d<=14)return{e:"🟠",c:"p-warn",t:d===0?"today":`in ${d} d`};if(d<=w)return{e:"🟡",c:"p-warn",t:`in ${d} d`};return{e:"🟢",c:"p-ok",t:`in ${d} d`}}
const iccDate=(iso,key)=>{const t=iccTone(iso);return`<span class="icc-dt"><b data-r="${key}">${fmtD(iso)}</b> <span class="pill ${t.c}" data-tone="${key}">${t.e} ${esc(t.t)}</span></span>`};

/* ---------- checks with one-click fixes ---------- */
function iccChecks(M){const st=S.icc;const out=[];const fx=(text,sev,label,fn)=>out.push({text,sev,label,fn});
 if(st.src==="app"&&!st.skus.length)fx("Pick at least one product above, or switch to “New product not in the app”.",2);
 if(st.src==="new"&&!st.newp.name)fx("Give the new product a name (it goes on the purchase order line).",1);
 if(M.rows.length&&!(M.g.d>0)){const hasData=M.rows.some(r=>r.vData>0);fx(hasData?"Sales per day is 0 — type the expected sales.":"No sales found for "+(st.src==="new"?"a new product":"these products in the last 90 days")+" — type the expected sales per month (e.g. 2,000/month ≈ 67/day).",2,st.sales.mode==="month"?null:"Type a monthly figure",st.sales.mode==="month"?null:()=>{st.sales.mode="month";iccRender(true,"icc_month")})}
 if(st.sales.mode==="day"&&M.typed>0){const dataV=M.rows.reduce((a,r)=>a+r.vData,0);if(M.typed>=300&&(dataV===0||M.typed>dataV*10))fx(`${num(M.typed)} a day is ${num(M.typed*30)} a month — did you mean ${num(M.typed)} a month (${num(M.typed/30,1)}/day)?`,1,`Use ${num(M.typed)} per month`,()=>{st.sales.mode="month";st.sales.month=String(M.typed);st.sales.day="";iccRender()})}
 if(st.sales.mode==="month"&&M.typed>0&&M.typed<1)fx(`${num(M.typed*30,2)} a month is under 1 a day — did you mean ${num(M.typed*30)} a day?`,1);
 if(M.cyc<=0)fx("Cycle length must be at least 1 day.",2,"Use 90 days",()=>{st.cycle="90";iccRender()});
 ICC_STAGES.forEach(([k,l])=>{const v=iccN(st.stages[k]?.days);if(v!=null&&v<0)fx(`${l}: days cannot be negative.`,2,"Set to 0",()=>{st.stages[k].days=0;iccRender()})});
 if(M.ship.missing.length&&M.rows.length)fx(`No carton size / units per carton for ${M.ship.missing.join(", ")} — cartons, CBM and freight leave ${M.ship.missing.length===1?"it":"them"} out. Fill block 2 (sizes are saved on the product).`,1);
 M.rows.forEach(r=>{const dm=r.dims;const nm=r.sku||r.name;const pcs=iccN(dm.perCtn);const pk=dm.pk,c=dm.ctn,it=dm.item;const pkG=iccN(pk.g)||iccN(it.g);const ckg=iccN(c.kg);
  [["item","product"],["pk","packaging"]].forEach(([k,lab])=>{const gv=iccN(dm[k].g);if(gv!=null&&gv>0&&gv<5)fx(`${nm}: ${lab} weight ${gv} g looks like kilograms — did you mean ${num(gv*1000)} g?`,1,`Use ${num(gv*1000)} g`,()=>{dm[k].g=String(gv*1000);iccSaveDims(r.key);iccRender()})});
  if(ckg!=null&&ckg>200)fx(`${nm}: carton gross weight ${num(ckg)} kg — is that grams? ${num(ckg/1000,2)} kg?`,1,`Use ${num(ckg/1000,2)} kg`,()=>{dm.ctn.kg=String(r2(ckg/1000));iccSaveDims(r.key);iccRender()});
  if(pcs&&pkG&&ckg!=null&&ckg>0&&ckg<pcs*pkG/1000){const need=Math.ceil(pcs*pkG/1000*1.05*10)/10;fx(`${nm}: carton ${num(ckg,2)} kg is lighter than ${pcs} × ${num(pkG)} g = ${num(pcs*pkG/1000,2)} kg of goods.`,2,`Set carton to ${num(need,1)} kg (+5% carton)`,()=>{dm.ctn.kg=String(need);iccSaveDims(r.key);iccRender()})}
  if(ckg>ICC_AMZ.maxKg){const fit=pkG?Math.floor((ICC_AMZ.maxKg-1)/(pkG/1000)):null;fx(`${nm}: carton ${num(ckg,1)} kg — Amazon UK refuses cartons over ${ICC_AMZ.maxKg} kg (over 15 kg needs a “Team lift” label).`,2,fit&&pcs&&fit<pcs?`Set ${fit} units per carton`:null,fit&&pcs&&fit<pcs?()=>{dm.perCtn=String(fit);dm.ctn.kg=String(r2(ckg*fit/pcs));iccSaveDims(r.key);iccRender()}:null)}
  const cl=[iccN(c.L),iccN(c.W),iccN(c.H)];if(cl.some(x=>x>ICC_AMZ.maxCm))fx(`${nm}: a carton side is over ${ICC_AMZ.maxCm} cm — Amazon UK treats it as oversize.`,1);
  const pv=iccN(pk.L)*iccN(pk.W)*iccN(pk.H)||iccN(it.L)*iccN(it.W)*iccN(it.H);const cv=cl[0]*cl[1]*cl[2];if(pcs&&pv&&cv&&pcs*pv>cv){const fit=Math.floor(cv/pv);fx(`${nm}: ${pcs} boxes of ${num(pv)} cm³ do not fit in a ${num(cv)} cm³ carton (max ${fit}).`,2,fit>0?`Set ${fit} units per carton`:null,fit>0?()=>{dm.perCtn=String(fit);iccSaveDims(r.key);iccRender()}:null)}

  if(!r.price&&M.rows.length)fx(`${nm}: no unit price — the cash plan leaves it out. ${r.sku?"Add the supplier price on the product, or type it in the table.":"Type the unit price."}`,1)});
 {const up=M.rows.filter(r=>r.moqUp);if(up.length)fx(up.length===1?`${up[0].sku||up[0].name}: cycle needs ${num(up[0].cycQ)} but the supplier minimum is ${num(up[0].moq)} — order raised to the MOQ.`:`${up.length} products raised to the supplier minimum (MOQ): ${up.map(r=>`${r.sku} ${num(Math.ceil(r.cycQ))}→${num(r.moq)}`).join(", ")}.`,0)}
 {const np=M.rows.filter(r=>!r.price);if(np.length>1){for(let i=out.length-1;i>=0;i--)if(/no unit price/.test(out[i].text))out.splice(i,1);fx(`No unit price for ${np.map(r=>r.sku||r.name).join(", ")} — the cash plan leaves them out. Add the supplier price on the product, or type it in the table.`,1)}}
 if(M.fr.cost==null&&M.ship.cbm+M.ship.kg>0)fx(`No freight rate for ${iccStageItem(st.stages.ship.id)?.label||"this shipping"} — type the rate your forwarder quoted (per ${st.rate.basis==="cbm"?"CBM":"kg chargeable"}).`,1);
 if(M.fr.cost!=null&&M.fr.gbp==null)fx(noRateMsg(st.rate.cur),2);
 if(M.cur!=="GBP"&&rateOn(today(),M.cur)==null)fx(noRateMsg(M.cur),2);
 if(M.g.gap>0)fx(`Out of stock for about ${M.g.gap} days: stock runs out ${fmtD(M.g.oos)} but this order is available ${fmtD(M.g.avail)}.`,2,(()=>{const f=M.modes.filter(m=>!m.on&&m.days<M.L.ship).sort((a,b)=>a.days-b.days)[0];return f?`Compare: ship by ${f.label}`:null})(),(()=>{const f=M.modes.filter(m=>!m.on&&m.days<M.L.ship).sort((a,b)=>a.days-b.days)[0];return f?()=>{st.stages.ship={id:f.id,days:f.days};iccShipRate(st);iccRender()}:null})());
 return out}

/* ---------- size block helpers ---------- */
let iccSaveT=null;
function iccSaveDims(key){if(!key||key==="__new")return;const p=product(key);if(!p||!can("edit")&&S.role!=="owner")return;const dm=iccDimsFor(key);const kgOf=g=>iccN(g)==null?null:r2(iccN(g)/1000*1000)/1000;const nn=v=>iccN(v);
 const patch={item:{L:nn(dm.item.L),W:nn(dm.item.W),H:nn(dm.item.H),kg:kgOf(dm.item.g)},pkType:dm.pkType||"",pk:{L:nn(dm.pk.L),W:nn(dm.pk.W),H:nn(dm.pk.H),kg:kgOf(dm.pk.g)},perCtn:nn(dm.perCtn),ctn:{L:nn(dm.ctn.L),W:nn(dm.ctn.W),H:nn(dm.ctn.H),kg:nn(dm.ctn.kg)},ctnPerPallet:nn(dm.perPallet)};
 const same=JSON.stringify([p.item||{},p.pkType||"",p.pk||{},p.perCtn??null,p.ctn||{},p.ctnPerPallet??null])===JSON.stringify([patch.item,patch.pkType,patch.pk,patch.perCtn,patch.ctn,patch.ctnPerPallet]);if(same)return;
 clearTimeout(iccSaveT);iccSaveT=setTimeout(()=>{S.holdRender=true;Promise.resolve(updateDoc("products",key,patch,`Sizes saved on ${key}`)).finally(()=>{S.holdRender=false})},400)}

/* ---------- render ---------- */
const ICC_CSS=`.icc .grid2{align-items:start}.icc .card{margin-bottom:12px}.icc .tool{gap:12px}.icc h3{margin:4px 0 0;font-size:13px}.icc-dims{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.icc-dims input{min-width:0;width:100%}
.icc-pick{max-height:240px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:4px 8px}.icc-pick label{display:flex;gap:8px;align-items:center;padding:5px 0;font-size:13px;border-bottom:1px solid var(--line)}.icc-pick label:last-child{border-bottom:0}.icc-pick small{color:var(--muted)}
.icc-chips{display:flex;flex-wrap:wrap;gap:6px}.icc-chips .chipb.on{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}
.icc-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}.icc-tile{border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-width:0}.icc-tile>span{display:block;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}.icc-tile>b{display:block;font:600 20px var(--f-data);margin:2px 0}.icc-tile small{color:var(--muted);font-size:11.5px}
.icc-dt{display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center}.icc-dt b{font:600 16px var(--f-data)}
.icc table input{width:78px;min-width:0}.icc td,.icc th{padding:6px 8px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}.icc td.r,.icc th.r{text-align:right}.icc tr.on td{background:var(--accent-soft)}
.icc-chk{display:flex;flex-direction:column;gap:6px}.icc-chk .match{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:space-between}
.icc-tl{display:flex;flex-direction:column;gap:6px;padding:4px 0}.icc-tl .ln{position:relative;height:22px;background:var(--soft);border-radius:6px}.icc-tl .ln i{position:absolute;top:0;bottom:0;border-radius:6px}.icc-tl .ln i.p{background:var(--warn-bg);border:1px solid var(--warn)}.icc-tl .ln i.s{background:var(--info-bg);border:1px solid var(--info)}.icc-tl .ln i.f{background:var(--ok-bg);border:1px solid var(--ok)}.icc-tl .ln em{position:absolute;left:6px;top:3px;font-size:11px;font-style:normal;color:var(--fg)}
.icc-leg{display:flex;gap:10px;flex-wrap:wrap;font-size:11.5px;color:var(--muted)}.icc-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:middle}
.icc-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.icc .grid2>div{min-width:0}@media (max-width:860px){.icc .grid2{grid-template-columns:minmax(0,1fr)}.icc-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.icc-acts .btn{flex:1 1 auto}}`;
function iccCss(){if($("#icccss"))return;const s=document.createElement("style");s.id="icccss";s.textContent=ICC_CSS;document.head.appendChild(s)}
const iccIn=(path,val,o={})=>`<input data-icc="${esc(path)}" ${o.id?`id="${o.id}"`:""} type="${o.type||"number"}" ${o.type==="text"||o.type==="date"?"":'step="any" inputmode="decimal"'} value="${esc(val??"")}" ${o.ph!=null?`placeholder="${esc(o.ph)}"`:""} aria-label="${esc(o.aria||path)}" ${o.rebuild?'data-icc-rebuild="1"':""}>`;
const iccSel=(path,opts,val,o={})=>`<select data-icc="${esc(path)}" ${o.id?`id="${o.id}"`:""} aria-label="${esc(o.aria||path)}" ${o.rebuild===false?"":'data-icc-rebuild="1"'}>${optsHtml(opts,val??"")}</select>`;
const iccF=(label,inner,hint)=>`<div class="f"><label>${label}</label>${inner}${hint?`<span class="hint">${hint}</span>`:""}</div>`;

function vPlanner(v){iccCss();iccInit();iccSeedSetup();const st=S.icc;
 const prods=D.products.filter(p=>!p.mergedInto&&!p.deletedAt&&p.status!=="archived");const q=norm(st.q||"");const shown=prods.filter(p=>!q||norm(p.sku+" "+p.name).includes(q));
 const top=p=>{const c=item("category",p.category);return c?.parent||p.category||"other"};const groups={};prods.forEach(p=>{const t=top(p);(groups[t]=groups[t]||[]).push(p.sku)});
 const plans=(SET().plans||[]).filter(p=>!p.archived);
 const pickHtml=st.src==="app"?`<div class="f"><label for="icc_q">Find products</label><input id="icc_q" data-icc="q" type="text" value="${esc(st.q)}" placeholder="Type SKU or name" aria-label="Find products"></div>
  <div class="icc-chips" aria-label="Select a whole group">${Object.entries(groups).filter(([,a])=>a.length>1).map(([t,a])=>{const all=a.every(s=>st.skus.includes(s));return`<button type="button" class="chipb ${all?"on":""}" data-icc-act="group" data-g="${esc(t)}" aria-pressed="${all}">${all?"✓ ":""}All ${esc(L("category",t)||t)} (${a.length})</button>`}).join("")}${st.skus.length?`<button type="button" class="chipb" data-icc-act="clear">Clear (${st.skus.length})</button>`:""}</div>
  <div class="icc-pick" id="icc_pick">${shown.map(p=>`<label><input type="checkbox" data-icc-sku="${esc(p.sku)}" ${st.skus.includes(p.sku)?"checked":""}><span>${esc(p.name)} <small>${esc(p.sku)}</small></span></label>`).join("")||'<div class="empty">No product matches.</div>'}</div>`
 :`<div class="form">${iccF("Product name",iccIn("newp.name",st.newp.name,{type:"text",id:"icc_nname",aria:"New product name",ph:"e.g. Silicone toilet brush white"}))}${iccF("Supplier",`<select data-icc="newp.party" aria-label="Supplier" data-icc-rebuild="1"><option value="">— not decided —</option>${optsHtml(live(D.parties).filter(p=>/sup/i.test(p.type||"")||String(p.code||"").startsWith("SUP")).map(p=>[p.code,p.name+" · "+p.code]),st.newp.party)}</select>`)}${iccF("Unit price",iccIn("newp.price",st.newp.price,{aria:"Unit price"}))}${iccF("Currency",iccSel("newp.cur",items("currency").map(c=>[c.id,c.id+" · "+c.label]),st.newp.cur,{aria:"Currency"}))}${iccF("MOQ (minimum order)",iccIn("newp.moq",st.newp.moq,{aria:"MOQ"}))}</div>`;
 const rows=iccRows();const dimKey=iccKey();const dm=dimKey?iccDimsFor(dimKey):null;
 const dimRow=(base,obj,wLab)=>`<div class="icc-dims">${iccIn(base+".L",obj.L,{ph:"L cm",aria:base+" length cm"})}${iccIn(base+".W",obj.W,{ph:"W cm",aria:base+" width cm"})}${iccIn(base+".H",obj.H,{ph:"H cm",aria:base+" height cm"})}${iccIn(base+(wLab==="kg"?".kg":".g"),wLab==="kg"?obj.kg:obj.g,{ph:wLab,aria:base+" weight "+wLab})}</div><input type="text" data-icc-paste="${esc(base)}" placeholder="or paste e.g. 21*11.5*4.5cm ${wLab==="kg"?"12.5kg":"200g"}" aria-label="Paste ${esc(base)} size">`;
 const sizes=dm?`${st.src==="app"&&st.skus.length>1?iccF("Sizes for",`<select id="icc_dimkey" data-icc="dimKey" aria-label="Sizes for product" data-icc-rebuild="1">${optsHtml(st.skus.map(s=>[s,(product(s)?.name||s)+" · "+s]),dimKey)}</select>`,`<button type="button" class="lnk" data-icc-act="copydims">Copy these sizes to all ${st.skus.length} selected</button>`):""}
  <h3>Product itself (L × W × H cm, weight g)</h3>${dimRow("dims."+dimKey+".item",dm.item,"g")}
  <h3>Packaging</h3>${iccF("Packaging type",iccSel("dims."+dimKey+".pkType",iccPackItems().map(i=>[i.id,i.label]),dm.pkType,{aria:"Packaging type",rebuild:false}))}${dimRow("dims."+dimKey+".pk",dm.pk,"g")}
  <h3>Carton</h3><div class="form">${iccF("Units per carton",iccIn("dims."+dimKey+".perCtn",dm.perCtn,{aria:"Units per carton",id:"icc_perctn"}))}${iccF("Cartons per pallet (optional)",iccIn("dims."+dimKey+".perPallet",dm.perPallet,{aria:"Cartons per pallet"}))}</div>
  <div class="f"><label>Carton L × W × H cm, gross weight kg</label>${dimRow("dims."+dimKey+".ctn",dm.ctn,"kg")}</div>
  ${iccF("Volumetric divisor",iccSel("divisor",ICC_DIV.concat(ICC_DIV.some(d=>d[0]===st.divisor)?[]:[[st.divisor,"÷ "+st.divisor]]),st.divisor,{aria:"Volumetric divisor",rebuild:false}),"air, road and AGL usually ÷6000; express couriers ÷5000")}
  <div class="match p-info" id="icc_sizeout" aria-live="polite"></div>
  <details class="how" ${st.ov.ctn!==""||st.ov.kg!==""||st.ov.cbm!==""||st._ovOpen?"open":""} data-icc-ov><summary>ⓘ Actual packing list (optional)</summary><div class="howb">When the supplier sends the packing list, type its totals here — freight then uses them instead of the cartons worked out above.<div class="form" style="margin-top:8px">${iccF("Cartons",iccIn("ov.ctn",st.ov.ctn,{aria:"Packing list cartons",id:"icc_ovctn"}))}${iccF("Total gross kg",iccIn("ov.kg",st.ov.kg,{aria:"Packing list total kg",id:"icc_ovkg"}))}${iccF("Total CBM",iccIn("ov.cbm",st.ov.cbm,{aria:"Packing list total CBM",id:"icc_ovcbm"}))}</div><input type="text" data-icc-paste="ov" placeholder="or paste e.g. 99 ctns 1,920.5 kg 6.772608 cbm" aria-label="Paste packing list totals"> <button type="button" class="btn sm" data-icc-act="clearov">Clear</button></div></details>`
  :'<div class="empty">Pick a product first.</div>';
 const stageRow=([k,l])=>{const its=iccStageItems(k);const s=st.stages[k]||{};return`<div class="f"><label>${esc(l)}</label><div class="icc-dims" style="grid-template-columns:minmax(0,3fr) minmax(0,1fr)">${iccSel("stages."+k+".id",its.map(i=>[i.id,`${i.label} (${num(i.days)} d)`]).concat(its.some(i=>i.id===s.id)?[]:[[s.id||"",s.id?"(saved plan) "+s.id:"—"]]),s.id,{aria:l+" option",id:"icc_st_"+k})}${iccIn("stages."+k+".days",s.days,{aria:l+" days",id:"icc_sd_"+k})}</div></div>`};
 v.innerHTML=`${crumb([["Home","home"],["Planner (ICC)"]])}<div class="icc" data-tool data-icc-root>
 <div class="hdr"><div><h1>Inventory Cycle Calculator</h1><p class="sub">When to order, how much, when it arrives and what it costs — worked out from your sales, stock, sizes and lead times. Rules and maths only; every number has an ⓘ.</p></div>
  <div class="acts">${plans.length?`<select data-icc-plan aria-label="Open a saved plan"><option value="">Saved plans (${plans.length})…</option>${plans.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${fmtD((p.at||"").slice(0,10))}</option>`).join("")}</select>`:""}${S.icc?.planName&&(SET().plans||[]).some(p=>p.name===S.icc.planName)?`<button type="button" class="btn sm danger" data-icc-act="delplan" title="Delete this saved plan">Delete plan</button>`:""}<button type="button" class="btn sm" data-icc-act="reset">Start again</button></div></div>
 <div class="grid2"><div>
 <div class="card"><div class="card-h"><h2>1 · Products</h2></div><div class="tool">
  <div class="icc-chips" role="radiogroup" aria-label="Product source"><button type="button" class="chipb ${st.src==="app"?"on":""}" data-icc-act="src" data-v="app" role="radio" aria-checked="${st.src==="app"}">Products in the app</button><button type="button" class="chipb ${st.src==="new"?"on":""}" data-icc-act="src" data-v="new" role="radio" aria-checked="${st.src==="new"}">New product not in the app</button></div>
  ${pickHtml}</div></div>
 <div class="card"><div class="card-h"><h2>2 · Size, weight & cartons</h2>${dimKey&&dimKey!=="__new"?'<span class="status">saved on the product</span>':""}</div><div class="tool">${sizes}</div></div>
 </div><div>
 <div class="card"><div class="card-h"><h2>3 · Sales & stock</h2></div><div class="tool">
  <div class="form">${iccF("Sales speed from",iccSel("sales.mode",[["data","Your sales data (30/60/90-day weighted)"],["month","I'll type per month"],["day","I'll type per day"]],st.sales.mode,{aria:"Sales speed source",id:"icc_smode"}))}
  ${st.sales.mode==="month"?iccF("Units per month (all selected)",iccIn("sales.month",st.sales.month,{id:"icc_month",aria:"Units per month"}),"÷ 30 = per day"):st.sales.mode==="day"?iccF("Units per day (all selected)",iccIn("sales.day",st.sales.day,{id:"icc_day",aria:"Units per day"})):""}</div>
  <div class="tbl"><table id="icc_skutab"><thead><tr><th>Product</th><th class="r">Share</th><th class="r">Per day</th><th class="r">At Amazon</th><th class="r">Warehouse</th><th class="r">In transit</th><th class="r">In production</th><th class="r">Unit price</th><th class="r">MOQ</th></tr></thead><tbody>${rows.map(r=>{const p=st.per[r.key]||{};const c=(k,val)=>`<td class="r">${iccIn("per."+r.key+"."+k,p[k],{ph:num(val,k==="price"?2:0),aria:`${r.sku||r.name} ${k}`})}</td>`;return`<tr data-icc-row="${esc(r.key)}"><td><b>${esc(r.sku||"New")}</b><br><small>${esc(r.name)}</small> ${how(r.vHow,"sales")}</td><td class="r" data-c="share">—</td><td class="r">${iccIn("per."+r.key+".day",p.day,{ph:"",aria:`${r.sku||r.name} per day`})}</td>${c("amazon",r.amazon)}${c("wh",r.wh)}${c("transit",r.transit)}${c("prod",r.prod)}<td class="r">${iccIn("per."+r.key+".price",p.price,{ph:num(r.price,2),aria:`${r.sku||r.name} price`})} <small>${esc(r.cur)}</small></td>${c("moq",r.moq)}</tr>`}).join("")||'<tr><td colspan="9" class="empty">No product picked.</td></tr>'}</tbody><tfoot><tr><td><b>Total</b></td><td></td><td class="r" data-c="totd">—</td><td class="r" data-c="tota">—</td><td class="r" data-c="totw">—</td><td class="r" data-c="tott">—</td><td class="r" data-c="totp">—</td><td></td><td></td></tr></tfoot></table></div>
  <p class="note">Grey figures come from the app (stock moves, shipments, open orders, supplier prices); type over any of them for this plan only. Per-day typed on a row is kept; the rest share the total.</p>
  <div class="form">${iccF("MOQ applies",iccSel("moqRule",[["sku","per product"],["order","to the whole order"]],st.moqRule,{aria:"MOQ rule"}))}${st.moqRule==="order"?iccF("Order minimum (units)",iccIn("moqOrder",st.moqOrder,{aria:"Order minimum"})):""}</div>
 </div></div>
 <div class="card"><div class="card-h"><h2>4 · Lead time & cycle</h2></div><div class="tool">
  ${ICC_STAGES.map(stageRow).join("")}
  <div class="form">${iccF("Packaging is made",iccSel("packWhen",[["along","alongside production (adds only if longer)"],["before","before production starts"]],st.packWhen,{aria:"Packaging timing",rebuild:false}))}
  ${iccF("Order cycle (how long each order should last)",iccSel("cycle",ICC_CYCLES,st.cycle,{aria:"Order cycle",id:"icc_cycle"}))}
  ${st.cycle==="custom"?iccF("Custom cycle",`<div class="icc-dims" style="grid-template-columns:1fr 1fr">${iccIn("cycN",st.cycN,{aria:"Custom cycle length",id:"icc_cycn"})}${iccSel("cycU",[["d","days"],["w","weeks"],["m","months (30 d)"]],st.cycU,{aria:"Custom cycle unit",rebuild:false})}</div>`):""}
  ${iccF("Show cycles",iccSel("nCyc",[["3","3 cycles"],["4","4 cycles"],["5","5 cycles"],["6","6 cycles"]],st.nCyc,{aria:"Number of cycles",rebuild:false}))}
  ${iccF("Payment terms",iccSel("terms",items("payTerms").map(t=>[t.id,t.label]),st.terms,{aria:"Payment terms",rebuild:false}))}
  </div>${iccF(`Freight rate per ${st.rate.basis==="cbm"?"CBM":"kg chargeable"}`,`<div class="icc-dims" style="grid-template-columns:repeat(3,minmax(0,1fr))">${iccIn("rate.v",st.rate.v,{aria:"Freight rate",id:"icc_rate",ph:"type quote"})}${iccSel("rate.basis",[["kg","per kg"],["cbm","per CBM"]],st.rate.basis,{aria:"Rate basis"})}${iccSel("rate.cur",items("currency").map(c=>[c.id,c.id]),st.rate.cur,{aria:"Rate currency",rebuild:false})}</div>`,"default from Setup › Lists › Lead-time stages (sea per CBM, air / road / AGL per kg chargeable)")}
 </div></div>
 </div></div>
 <div class="card" id="icc_res"><div class="card-h"><h2>5 · Results</h2></div><div class="tool" id="icc_out" aria-live="polite"></div>
  <div class="tool" style="padding-top:0"><div class="icc-acts"><button type="button" class="btn pri" data-icc-act="po">Create purchase order from this plan</button><input type="text" id="icc_pname" data-icc="planName" value="${esc(st.planName)}" placeholder="Plan name" aria-label="Plan name" style="flex:1;min-width:140px"><button type="button" class="btn" data-icc-act="save">Save plan</button></div></div></div>
 </div>`;iccCalc()}

function iccRender(keepFocus,focusId){const v=$("#view");if(!v||S.view.k!=="planner")return;const ae=document.activeElement;const fid=focusId||(keepFocus!==false&&ae&&v.contains(ae)?(ae.id||null):null);const path=ae?.dataset?.icc;const y=window.scrollY;vPlanner(v);window.scrollTo(0,y);let el=fid?$("#"+fid):null;if(!el&&path)el=v.querySelector(`[data-icc="${CSS.escape(path)}"]`);if(el){try{el.focus({preventScroll:true})}catch(_){}}}

/* results only (called while typing) */
function iccCalc(){const out=$("#icc_out");if(!out)return;const st=S.icc;let M;try{M=iccModel()}catch(e){console.error(e);out.innerHTML=`<div class="match p-bad">Could not work this out: ${esc(e.message||e)}</div>`;return}S._iccM=M;const g=M.g,Ld=M.L;
 /* table cells */
 M.rows.forEach(r=>{const tr=document.querySelector(`#icc_skutab tr[data-icc-row="${CSS.escape(r.key)}"]`);if(!tr)return;const sh=tr.querySelector('[data-c="share"]');if(sh)sh.textContent=M.rows.length>1?num(r.pct*100,1)+"%":"100%";const di=tr.querySelector(`[data-icc="per.${CSS.escape(r.key)}.day"]`);if(di)di.placeholder=num(r.d,2)});
 const ft=(c,v)=>{const el=document.querySelector(`#icc_skutab [data-c="${c}"]`);if(el)el.textContent=v};ft("totd",num(g.d,2));ft("tota",num(M.rows.reduce((a,r)=>a+r.amazon,0)));ft("totw",num(M.rows.reduce((a,r)=>a+r.wh,0)));ft("tott",num(M.rows.reduce((a,r)=>a+r.transit,0)));ft("totp",num(M.rows.reduce((a,r)=>a+r.prod,0)));
 /* size block output (product being edited + order totals) */
 const so=$("#icc_sizeout");if(so){const key=iccKey();const r=M.rows.find(x=>x.key===key);const dm=key?iccDimsFor(key):null;if(dm){const c=dm.ctn;const cb1=iccN(c.L)*iccN(c.W)*iccN(c.H)/1e6;const vol1=cb1*1e6/M.div;const k1=iccN(c.kg)||0;const it=dm.item,pk=dm.pk;const pkCm=iccN(pk.L)*iccN(pk.W)*iccN(pk.H);const per=iccN(dm.perCtn);const pallets=iccN(dm.perPallet)&&r?.ctnN?Math.ceil(r.ctnN/iccN(dm.perPallet)):null;
  so.innerHTML=`${cb1?`Per carton: <b data-r="cbmctn">${num(cb1,6)} CBM</b> · actual ${num(k1,2)} kg · volumetric <b data-r="volctn">${num(vol1,2)} kg</b> (÷${M.div}) · chargeable <b>${num(Math.max(k1,vol1),2)} kg</b>${per?` · ${num(per)} units → ${num(cb1/per,6)} CBM and ${num(k1/per*1000)} g per unit`:""}`:"Type the carton size to see CBM."}${pkCm?`<br>Packaging box ${num(pkCm)} cm³${iccN(pk.g)?` · ${num(iccN(pk.g))} g`:""}${iccN(it.g)?` (product alone ${num(iccN(it.g))} g)`:""}`:""}
  <br><b>This order${M.ship.useOv?" (packing list typed)":""}:</b> <b data-r="ctn">${num(M.ship.ctn)}</b> cartons${r?.ctnN!=null&&!M.ship.useOv&&M.rows.length>1?` (this product ${num(r.ctnN)})`:""} · <b data-r="cbm">${num(M.ship.cbm,6)}</b> CBM · <b data-r="kg">${num(M.ship.kg,2)}</b> kg actual · <b data-r="vol">${num(M.fr.vol,2)}</b> kg volumetric (÷${M.div}) · chargeable <b data-r="chg">${num(M.fr.chg,M.fr.unit==="CBM"?3:2)} ${M.fr.unit}</b>${pallets?` · ${num(pallets)} pallet${pallets===1?"":"s"}`:""}${M.ship.ctn?`<br>Average per carton: ${num(M.ship.kg/M.ship.ctn,2)} kg · ${num(M.ship.cbm/M.ship.ctn,4)} CBM`:""}
  ${how(`CBM per carton = L × W × H ÷ 1,000,000${cb1?` = ${num(iccN(c.L),2)} × ${num(iccN(c.W),2)} × ${num(iccN(c.H),2)} ÷ 1,000,000 = ${num(cb1,6)}`:""}<br>Volumetric kg = CBM × 1,000,000 ÷ divisor ${M.div} (the same as L×W×H ÷ ${M.div})<br>Cartons = order units ÷ units per carton, rounded <b>up</b>${M.rows.filter(x=>x.ctnN!=null).map(x=>`<br>${esc(x.sku||x.name)}: ${num(x.qRaw)} ÷ ${num(x.perCtn)} → ${num(x.ctnN)} ctn (${num(x.q)} units)`).join("")}<br>Chargeable = the higher of actual and volumetric weight (${M.fr.unit==="CBM"?`sea is charged per CBM, minimum ${num(FEES().seaCbmMin||0,2)} CBM`:"kg services"})`,"How")}`}}
 /* checks */
 const checks=iccChecks(M);st._fx=checks.map(c=>c.fn||null);
 const chkHtml=checks.length?`<div class="icc-chk" id="icc_checks">${checks.map((c,i)=>`<div class="match ${c.sev>=2?"p-bad":c.sev===1?"p-warn":"p-info"}" data-sev="${c.sev}"><span>${c.sev>=2?"⛔":c.sev===1?"⚠️":"ℹ️"} ${esc(c.text)}</span>${c.fn&&c.label?`<button type="button" class="btn sm" data-icc-act="fix" data-i="${i}">${esc(c.label)}</button>`:""}</div>`).join("")}</div>`:"";
 if(!M.rows.length||!(g.d>0)){out.innerHTML=chkHtml||'<div class="empty">Pick a product and type the sales to see the plan.</div>';return}
 const shipIt=iccStageItem(st.stages.ship.id);const leadHow=`Lead time = mould ${Ld.mould} + ${st.packWhen==="before"?`packaging ${Ld.pack} + production ${Ld.prod}`:`max(packaging ${Ld.pack}, production ${Ld.prod}) = ${Ld.block}`} + to forwarder ${Ld.fwd} + ${esc(shipIt?.label||"shipping")} ${Ld.ship} + FBA check-in ${Ld.fba} = <b>${Ld.lead} d</b>; safety ${Ld.safety} d`;
 const ropHow=`${leadHow}<br>Reorder point = sales ${num(g.d,2)}/day × (lead ${Ld.lead} + safety ${Ld.safety}) = ${num(g.d,2)} × ${Ld.lead+Ld.safety} = <b>${num(g.rop)}</b> units${M.rows.length>1?"<br>"+M.rows.map(r=>`${esc(r.sku)}: ${num(r.d,2)} × ${Ld.lead+Ld.safety} = ${num(r.rop)}`).join("<br>"):""}<br>When stock you have + on the way + in production falls to this, order.`;
 const qHow=`Cycle quantity = ${num(g.d,2)}/day × ${M.cyc} d = ${num(g.cycQ)}${M.rows.map(r=>`<br>${esc(r.sku||r.name)}: ${num(r.d,2)} × ${M.cyc} = ${num(r.cycQ)} → ${num(r.qRaw)}${r.moqUp?` (raised to MOQ ${num(r.moq)})`:""}${r.perCtn?` → ${num(r.ctnN)} ctn × ${num(r.perCtn)} = <b>${num(r.q)}</b>`:" (no carton size — not rounded)"}`).join("")}${g.moqScaled?`<br>Raised in proportion to the order minimum ${num(st.moqOrder)}`:""}<br>Total <b>${num(g.q)}</b> units`;
 const posHow=`Stock position = at Amazon ${num(M.rows.reduce((a,r)=>a+r.amazon,0))} + warehouse ${num(M.rows.reduce((a,r)=>a+r.wh,0))} + in transit ${num(M.rows.reduce((a,r)=>a+r.transit,0))} + in production ${num(M.rows.reduce((a,r)=>a+r.prod,0))} = <b>${num(g.pos)}</b>`;
 const dHow=k=>{const first=M.rows.filter(r=>r.d>0).sort((a,b)=>(a[k]||"")<(b[k]||"")?-1:1)[0];const r=first;if(!r)return"";const base={orderBy:`(position ${num(r.pos)} − reorder point ${num(r.rop)}) ÷ ${num(r.d,2)}/day`,low:`(position ${num(r.pos)} − safety stock ${num(r.d*Ld.safety)}) ÷ ${num(r.d,2)}/day`,oos:`position ${num(r.pos)} ÷ ${num(r.d,2)}/day`}[k];return`${M.rows.length>1?`Earliest product: ${esc(r.sku)}<br>`:""}Today ${fmtD(today())} + ${base} = ${num(Math.floor((k==="orderBy"?r.pos-r.rop:k==="low"?r.pos-r.d*Ld.safety:r.pos)/r.d))} d → <b>${fmtD(r[k])}</b><br>🟢 more than ${+DEF().reorderWarnDays||30} d away · 🟡 within ${+DEF().reorderWarnDays||30} d · 🟠 within 14 d · 🔴 already past`};
 const chainHow=`Order ${fmtD(g.orderDate)}${g.orderBy&&g.orderBy<today()?" (order-by date has passed, so from today)":""} + mould ${Ld.mould} + ${st.packWhen==="before"?"packaging + production "+(Ld.pack+Ld.prod):"production "+Ld.block} + to forwarder ${Ld.fwd} = dispatch <b>${fmtD(g.dispatch)}</b><br>+ ${esc(shipIt?.label||"shipping")} ${Ld.ship} d = UK port <b>${fmtD(g.ukArr)}</b><br>+ FBA check-in ${Ld.fba} d = available <b>${fmtD(g.avail)}</b>`;
 const tile=(lab,val,sub,h)=>`<div class="icc-tile"><span>${lab}</span>${val}${sub?`<small>${sub}</small>`:""}${h||""}</div>`;
 const rateTxt=`${M.cur} ${M.rate[M.cur]??"—"} £ per ${M.cur}${M.rate.date?" · set "+fmtD(M.rate.date):""}`;
 const frTxt=M.fr.cost!=null?`${fmt(M.fr.cost,st.rate.cur)} ≈ ${M.fr.gbp==null?"no £ rate":gbp(M.fr.gbp)}`:"—";
 const frHow=`Chargeable ${num(M.fr.chg,M.fr.unit==="CBM"?3:2)} ${M.fr.unit} × ${st.rate.v===""?"no rate":fmt(iccN(st.rate.v),st.rate.cur)} per ${M.fr.unit}${M.fr.cost!=null?` = <b>${fmt(M.fr.cost,st.rate.cur)}</b>`:""}${M.fr.gbp!=null&&st.rate.cur!=="GBP"?` → £ at ${num(rateOn(today(),st.rate.cur),4)} = ${gbp2(M.fr.gbp)}`:""}${M.fr.gbp!=null&&g.q?`<br>Per unit ≈ ${gbp2(M.fr.gbp/g.q)} (${num(g.q)} units)`:""}<br>${M.ship.useOv?"Using the packing-list totals you typed.":"From cartons worked out in block 2."}`;
 /* timeline */
 const c0=M.cycles[0],cN=M.cycles[M.cycles.length-1];const t0=today()<c0.order?today():c0.order;const span=Math.max(1,diffDays(t0,cN.avail));const pc=(a,b)=>`left:${(diffDays(t0,a)/span*100).toFixed(2)}%;width:${Math.max(.8,diffDays(a,b)/span*100).toFixed(2)}%`;
 const tl=`<div class="icc-leg"><span><i style="background:var(--warn-bg);border:1px solid var(--warn)"></i>making (order → dispatch)</span><span><i style="background:var(--info-bg);border:1px solid var(--info)"></i>shipping (→ UK port)</span><span><i style="background:var(--ok-bg);border:1px solid var(--ok)"></i>FBA check-in</span></div><div class="icc-tl" aria-hidden="true">${M.cycles.map(c=>`<div class="ln"><i class="p" style="${pc(c.order,c.dispatch)}"></i><i class="s" style="${pc(c.dispatch,c.uk)}"></i><i class="f" style="${pc(c.uk,c.avail)}"></i><em>#${c.k}</em></div>`).join("")}</div>`;
 const cyTab=`<div class="tbl"><table id="icc_cycles"><thead><tr><th>#</th><th>Order by</th><th>Dispatch</th><th>UK port</th><th>Available</th><th class="r">Units</th><th class="r">Goods ${esc(M.cur)}</th><th class="r">≈ £</th></tr></thead><tbody>${M.cycles.map(c=>{const t=iccTone(c.order);return`<tr><td>${c.k}</td><td>${t.e} ${fmtD(c.order)}</td><td>${fmtD(c.dispatch)}</td><td>${fmtD(c.uk)}</td><td>${fmtD(c.avail)}</td><td class="r">${num(c.q)}</td><td class="r">${fmt(c.goods,M.cur)}</td><td class="r">${c.gbp==null?"—":gbp(c.gbp)}</td></tr>`}).join("")}</tbody></table></div>`;
 const modeTab=`<div class="tbl"><table id="icc_modes"><thead><tr><th>Shipping</th><th class="r">Lead</th><th class="r">Reorder point</th><th>Order by</th><th>If ordered today, available</th><th class="r">Freight</th><th></th></tr></thead><tbody>${M.modes.map(m=>{const t=iccTone(m.orderBy);const late=g.oos&&m.avail>g.oos;return`<tr class="${m.on?"on":""}" data-mode="${esc(m.id)}"><td>${esc(m.label)}${m.on?" ✓":""}</td><td class="r">${m.lead} d</td><td class="r" data-r="rop-${esc(m.id)}">${num(m.rop)}</td><td>${t.e} ${fmtD(m.orderBy)}</td><td>${late?"🔴":"🟢"} ${fmtD(m.avail)}</td><td class="r">${m.f.cost==null?"no rate":fmt(m.f.cost,m.cur)}</td><td>${m.on?"":`<button type="button" class="btn sm" data-icc-act="usemode" data-id="${esc(m.id)}">Use</button>`}</td></tr>`}).join("")}</tbody></table></div>`;
 const cashTab=`<div class="tbl"><table id="icc_cash"><thead><tr><th>Payment</th><th>Due</th><th class="r">Amount</th><th class="r">≈ £</th></tr></thead><tbody>${M.cash.map(c=>`<tr><td>${c.pct!=null?num(c.pct)+"% · ":""}${esc(c.label)}</td><td>${iccTone(c.date).e} ${fmtD(c.date)}</td><td class="r">${fmt(c.amt,c.cur||M.cur)}</td><td class="r">${c.gbp==null?"—":gbp(c.gbp)}</td></tr>`).join("")}<tr><td><b>Total</b></td><td></td><td class="r">${fmt(M.goods+M.fee,M.cur)}${M.fr.cost!=null?" + freight":""}</td><td class="r"><b>${(()=>{const s=M.cash.reduce((a,c)=>a+(c.gbp||0),0);return gbp(s)})()}</b></td></tr></tbody></table></div>`;
 const cashHow=`Goods = ${M.rows.map(r=>`${esc(r.sku||r.name)} ${num(r.q)} × ${fmt(r.price,r.cur)}`).join(" + ")} = ${fmt(M.goods,M.cur)}${M.fee?` + China service fee ${fmt(M.fee,M.cur)}`:""}<br>Terms: ${esc(M.terms?.label||"30% deposit / 50% before shipping / 20% at UK port")} — each % of ${fmt(M.goods+M.fee,M.cur)}; dates from the plan (order, dispatch, UK port, available)<br>£ at the latest Setup rate: ${esc(rateTxt)}`;
 out.innerHTML=`${chkHtml}
 <div class="icc-tiles">
  ${tile("Reorder point",`<b data-r="rop">${num(g.rop)}</b>`,`units · lead ${Ld.lead} d + safety ${Ld.safety} d`,how(ropHow))}
  ${tile("Order quantity",`<b data-r="qty">${num(g.q)}</b>`,`units for ${M.cyc} d${M.ship.ctn?` · ${num(M.ship.ctn)} ctn`:""}`,how(qHow))}
  ${tile("Sales per day",`<b data-r="perday">${num(g.d,2)}</b>`,`≈ ${num(g.d*30)} a month`,how(M.rows.map(r=>`${esc(r.sku||r.name)}: ${num(r.d,2)}/day (${num(r.pct*100,1)}%)`).join("<br>")+(M.splitHow?`<br>${esc(M.splitHow)}`:"")+(M.typed!=null?`<br>Typed total ${num(M.typed,2)}/day${st.sales.mode==="month"?` (${num(iccN(st.sales.month))} ÷ 30)`:""}`:"")))}
  ${tile("Stock position",`<b data-r="pos">${num(g.pos)}</b>`,`≈ ${num(g.pos/g.d)} days of sales`,how(posHow))}
 </div>
 <div class="icc-tiles">
  ${tile("Order by",iccDate(g.orderBy,"orderby"),g.orderBy&&g.orderBy<today()?"late — order today":"",how(dHow("orderBy")))}
  ${tile("Dispatch from China",iccDate(g.dispatch,"dispatch"),"",how(chainHow))}
  ${tile("Arrives (available at Amazon)",iccDate(g.avail,"arrival"),`UK port ${fmtD(g.ukArr)}`,how(chainHow))}
  ${tile("Low stock (safety level)",iccDate(g.low,"low"),"",how(dHow("low")))}
  ${tile("Out of stock",iccDate(g.oos,"oos"),g.gap>0?`🔴 ${g.gap} d with no stock before this order lands`:"",how(dHow("oos")))}
  ${tile("Freight estimate",`<b data-r="freight">${frTxt}</b>`,`${num(M.fr.chg,M.fr.unit==="CBM"?3:2)} ${M.fr.unit} chargeable`,how(frHow))}
 </div>
 ${M.rows.length>1?`<h3>Per product</h3><div class="tbl"><table id="icc_per"><thead><tr><th>Product</th><th class="r">Per day</th><th class="r">Position</th><th class="r">Reorder pt</th><th class="r">Order</th><th>Order by</th><th>Out of stock</th></tr></thead><tbody>${M.rows.map(r=>`<tr><td>${esc(r.sku)}</td><td class="r">${num(r.d,2)}</td><td class="r">${num(r.pos)}</td><td class="r">${num(r.rop)}</td><td class="r">${num(r.q)}</td><td>${iccTone(r.orderBy).e} ${fmtD(r.orderBy)}</td><td>${iccTone(r.oos).e} ${fmtD(r.oos)}</td></tr>`).join("")}</tbody></table></div>`:""}
 <h3>Shipping options compared</h3>${modeTab}
 <h3>Next ${M.cycles.length} cycles (every ${M.cyc} d)</h3>${tl}${cyTab}
 <h3>Cash plan — first order ${how(cashHow)}</h3>${cashTab}`}

/* ---------- plan actions ---------- */
function iccPlanCopy(){const s=JSON.parse(JSON.stringify(S.icc));delete s._fx;return s}
async function iccSavePlan(){const st=S.icc;const M=S._iccM||iccModel();if(!M.rows.length){toast("Pick a product first");return}const name=(st.planName||"").trim()||`${st.src==="new"?(st.newp.name||"New product"):st.skus.length>1?st.skus.length+" products":st.skus[0]} · ${num(M.g.q)} units · ${fmtD(today())}`;
 const plans=(SET().plans||[]).slice();const ex=plans.findIndex(p=>norm(p.name)===norm(name));const doc={id:ex>=0?plans[ex].id:"PL"+nid(),name,at:nowIso(),by:user?.name||uid||S.role,s:iccPlanCopy(),sum:{q:M.g.q,rop:Math.round(M.g.rop),orderBy:M.g.orderBy,skus:M.rows.map(r=>r.sku).filter(Boolean)}};
 if(ex>=0)plans[ex]=doc;else plans.push(doc);S.holdRender=true;let ok=false;try{ok=await setupPatch("plans",plans,`Plan saved: ${name}`)}finally{S.holdRender=false}if(ok){st.planName=name;iccRender(false)}}
function iccLoadPlan(id){const p=(SET().plans||[]).find(x=>x.id===id);if(!p)return;S.icc=Object.assign({},JSON.parse(JSON.stringify(p.s)));S.icc.planName=p.name;iccInitFill();toast(`Plan opened: ${p.name}`);iccRender(false)}
function iccInitFill(){const st=S.icc;const d=JSON.parse(JSON.stringify(st));S.icc=null;const base=iccInit();Object.assign(base,d)}
function iccCreatePO(){const M=S._iccM||iccModel();const st=S.icc;if(!M.rows.length||!(M.g.q>0)){toast("Nothing to order yet — pick a product and type the sales");return}
 const party=M.rows.find(r=>r.party)?.party||"";const lines=M.rows.filter(r=>r.q>0).map(r=>({sku:r.sku||"",p:r.sku?(product(r.sku)?.name||r.name):r.name,q:r.q,u:r.price||null}));
 const note=`From Planner (ICC): ${num(M.g.d,2)}/day, cycle ${M.cyc} d, lead ${M.L.lead} d (${iccStageItem(st.stages.ship.id)?.label||"shipping"}), reorder point ${num(M.g.rop)}, dispatch ${fmtD(M.g.dispatch)}, available ${fmtD(M.g.avail)}.`;
 const ctx={force:true,copy:{party,kind:(items("purchaseKind").find(k=>k.id==="china")||defaultItem("purchaseKind")||{}).id,cur:M.cur,account:DEF().company,lines:lines.filter(l=>l.sku),extras:[]}};if(party)ctx.party=party;
 S.iccPO={lines,terms:st.terms,note,at:Date.now()};openForm("purchase",ctx);
 const fill=(n)=>{if(!S.drawer?.form||S.drawer.form!=="purchase"){if(n<20)setTimeout(()=>fill(n+1),50);return}try{if(lines.some(l=>!l.sku)){S.drawer.rows.lines=lines.map(l=>({...l}));redrawRows("lines");if(typeof calcPurchase==="function")calcPurchase()}const n_=$("#f_notes");if(n_&&!n_.value){n_.value=note}const tEl=$("#f_terms");if(tEl&&st.terms&&[...tEl.options].some(o=>o.value===st.terms)){tEl.value=st.terms;tEl.dispatchEvent(new Event("change",{bubbles:true}))}}catch(e){console.warn(e)}};setTimeout(()=>fill(0),60)}

/* ---------- events (document-level, only on the planner page) ---------- */
function iccSet(path,raw){const st=S.icc;const ks=path.split(".");let o=st;for(let i=0;i<ks.length-1;i++){const k=ks[i];if(k==="dims"&&i===0){o=st.dims;const key=ks[1];iccDimsFor(key);o=st.dims;continue}if(o[k]==null||typeof o[k]!=="object")o[k]={};o=o[k]}o[ks[ks.length-1]]=raw}
document.addEventListener("toggle",e=>{if(e.target?.matches?.("details[data-icc-ov]")&&S.icc)S.icc._ovOpen=e.target.open},true);
function iccGet(path){const ks=path.split(".");let o=S.icc;for(const k of ks){if(o==null)return undefined;o=o[k]}return o}
function iccOn(e){return S.view?.k==="planner"&&e.target?.closest?.("[data-icc-root]")}
document.addEventListener("input",e=>{if(!iccOn(e))return;const t=e.target;const p=t.dataset.icc;if(p==null||t.tagName==="SELECT")return;
 /* typing "21*11.5*4.5" straight into a size box spreads it over L / W / H */
 if(/\.(L|W|H)$/.test(p)&&/[x*×]/i.test(t.value)){const o=iccParse(t.value);if(o.L){const base=p.replace(/\.(L|W|H)$/,"");iccSet(base+".L",String(o.L));iccSet(base+".W",String(o.W));iccSet(base+".H",String(o.H));if(o.kg!=null){if(base.endsWith(".ctn"))iccSet(base+".kg",String(o.kg));else iccSet(base+".g",String(r2(o.kg*1000)))}iccRender(true);return}}
 iccSet(p,t.value);if(p==="q"){const box=$("#icc_pick");if(box){const q=norm(t.value);box.querySelectorAll("label").forEach(l=>{l.hidden=!!q&&!norm(l.textContent).includes(q)})}return}if(p==="planName")return;iccCalc()});
document.addEventListener("change",e=>{if(!iccOn(e))return;const t=e.target;const ds=t.dataset;
 if(ds.iccSku!==undefined){const st=S.icc;const s=ds.iccSku;st.skus=t.checked?[...new Set([...st.skus,s])]:st.skus.filter(x=>x!==s);iccRender(false);return}
 if(ds.iccPlan!==undefined){if(t.value)iccLoadPlan(t.value);return}
 if(ds.iccPaste!==undefined){const o=iccParse(t.value);const base=ds.iccPaste;let n=0;if(base==="ov"){if(o.ctn!=null){S.icc.ov.ctn=String(o.ctn);n++}if(o.kg!=null){S.icc.ov.kg=String(o.kg);n++}if(o.cbm!=null){S.icc.ov.cbm=String(o.cbm);n++}}else{if(o.L){iccSet(base+".L",String(o.L));iccSet(base+".W",String(o.W));iccSet(base+".H",String(o.H));n++}if(o.kg!=null){if(base.endsWith(".ctn"))iccSet(base+".kg",String(o.kg));else iccSet(base+".g",String(r2(o.kg*1000)));n++}if(o.pcs&&base.endsWith(".ctn")){iccSet(base.replace(/\.ctn$/,".perCtn"),String(o.pcs));n++}}
  if(!n){toast("Could not read a size or weight — try e.g. 21*11.5*4.5cm 200g");return}const key=base.split(".")[1];if(base!=="ov")iccSaveDims(key);t.value="";iccRender(false);return}
 const p=ds.icc;if(p==null)return;const st=S.icc;
 /* text / number boxes are already applied while typing: on blur only save sizes, never redraw (a redraw here would eat the click that caused the blur) */
 if(t.tagName!=="SELECT"&&String(iccGet(p)??"")===String(t.value)&&!ds.iccRebuild){if(p.startsWith("dims."))iccSaveDims(p.split(".")[1]);return}
 iccSet(p,t.value);
 const m=p.match(/^stages\.(\w+)\.id$/);if(m){const it=iccStageItem(t.value);st.stages[m[1]].days=it?.days??0;if(m[1]==="ship")iccShipRate(st)}
 if(p.startsWith("dims."))iccSaveDims(p.split(".")[1]);
 if(p==="newp.party"&&t.value){const sp=null;void sp}
 if(ds.iccRebuild)iccRender(true);else iccCalc()});
document.addEventListener("click",e=>{if(!iccOn(e))return;const b=e.target.closest("[data-icc-act]");if(!b)return;const st=S.icc;const a=b.dataset.iccAct;
 if(a==="src"){st.src=b.dataset.v;iccRender(false);return}
 if(a==="group"){const g=b.dataset.g;const prods=D.products.filter(p=>!p.mergedInto&&!p.deletedAt&&p.status!=="archived");const top=p=>{const c=item("category",p.category);return c?.parent||p.category||"other"};const list=prods.filter(p=>top(p)===g).map(p=>p.sku);const all=list.every(s=>st.skus.includes(s));st.skus=all?st.skus.filter(s=>!list.includes(s)):[...new Set([...st.skus,...list])];iccRender(false);return}
 if(a==="clear"){st.skus=[];iccRender(false);return}
 if(a==="reset"){S.icc=null;iccRender(false);return}
 if(a==="delplan"){const nm=S.icc?.planName;const plans=(SET().plans||[]);const p=plans.find(x=>x.name===nm);if(!p)return;if(!confirm(`Delete the saved plan "${nm}"? (Undo is possible)`))return;(async()=>{S.holdRender=true;let ok=false;try{ok=await setupPatch("plans",plans.filter(x=>x.id!==p.id),`Plan deleted: ${nm}`)}finally{S.holdRender=false}if(ok){S.icc.planName="";iccRender(false)}})();return}
 if(a==="fix"){const fn=st._fx?.[+b.dataset.i];if(fn)fn();return}
 if(a==="usemode"){const it=iccStageItem(b.dataset.id);if(it){st.stages.ship={id:it.id,days:+it.days||0};iccShipRate(st);iccRender(false)}return}
 if(a==="copydims"){const k=iccKey();const src=JSON.parse(JSON.stringify(iccDimsFor(k)));st.skus.forEach(s=>{if(s!==k){st.dims[s]=JSON.parse(JSON.stringify(src));iccSaveDims(s)}});toast(`Sizes copied to ${st.skus.length-1} product${st.skus.length-1===1?"":"s"}`);iccCalc();return}
 if(a==="clearov"){st.ov={ctn:"",kg:"",cbm:""};st._ovOpen=false;iccRender(false);return}
 if(a==="save"){iccSavePlan();return}
 if(a==="po"){iccCreatePO();return}});
