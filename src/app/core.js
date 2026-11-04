/* ===================== core v3: state, setup access, dates, money, numbering, business logic, writes/undo, nav, search ===================== */
const MAIN=[["home","Home"],["purchases","Purchases"],["shipments","Shipments"],["payments","Payments"],["stock","Stock"]];
const MORE=[["products","Products","products"],["parties","Parties","parties"],["calendar","Calendar","cal"],["planner","Planner (ICC)","trend"],["tools","Tools","tools"],["refs","References","refs"],["reports","Reports","trend"],["import","Import","import"],["attention","All alerts","bell"],["log","Activity","log"],["trash","Trash","trash"],["setup","Setup","setup"]];
const PAGES=["planner","home","purchases","shipments","payments","stock","products","parties","calendar","tools","refs","reports","import","attention","log","trash","setup","more","doc"];
const S={view:{k:"home",params:{}},hist:[],hi:-1,f:{},limit:{},drawer:null,ready:false,err:null,undo:[],redo:[],role:"owner",tools:{},holdRender:false,sel:{},batch:null,pendingOpen:null,cal:null,imp:null,setupTab:"companies",listKey:null,formKey:null};
const D={setup:null,counters:null,parties:[],products:[],purchases:[],shipments:[],payments:[],inspections:[],receipts:[],moves:[],credits:[],imports:[],views:[],log:[],salesStats:[]};
const COLS=["parties","products","purchases","shipments","payments","inspections","receipts","moves","credits","imports","views","log","salesStats"];
let db=null,assets=null,downloads=null,user=null,uid=null;
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const nid=()=>Math.random().toString(36).slice(2,8);
const ls={get(k,d){try{const v=localStorage.getItem("nx3."+k);return v?JSON.parse(v):d}catch(_){return d}},set(k,v){try{localStorage.setItem("nx3."+k,JSON.stringify(v))}catch(_){}},del(k){try{localStorage.removeItem("nx3."+k)}catch(_){}}};
let tt;function toast(m,opts={}){const t=$("#toast");if(!t)return;t.innerHTML=esc(m)+(opts.undo?' <button data-act="undo">Undo</button>':"")+(opts.open?` <button data-open="${esc(opts.open[0])}" data-id="${esc(opts.open[1])}">Open</button>`:"")+(opts.restore?` <button data-act="restore" data-col="${esc(opts.restore[0])}" data-id="${esc(opts.restore[1])}">Restore</button>`:"");t.classList.toggle("top",!!S.drawer);t.hidden=false;clearTimeout(tt);const hide=()=>{if(!t.matches(":hover"))t.hidden=true;else tt=setTimeout(hide,2000)};tt=setTimeout(hide,opts.ms||(opts.undo||opts.restore?9000:2800))}

/* ---------- dates: pure UTC string arithmetic ---------- */
const _ukDF=(()=>{try{return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"})}catch(_){return null}})();
/* business date = the calendar date in the UK (Europe/London), not the UTC date */
const today=()=>{const d=new Date();if(_ukDF){try{const s=_ukDF.format(d);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s}catch(_){}}return d.toISOString().slice(0,10)};
const toD=iso=>{const[y,m,d]=(iso||today()).slice(0,10).split("-").map(Number);return Date.UTC(y,m-1,d)};
const fromD=ms=>new Date(ms).toISOString().slice(0,10);
const addDays=(iso,n)=>fromD(toD(iso)+n*86400000);
const diffDays=(a,b)=>Math.round((toD(b)-toD(a))/86400000);
const addMonths=(iso,n)=>{const[y,m]=(iso||today()).split("-").map(Number);const d=new Date(Date.UTC(y,m-1+n,1));return d.toISOString().slice(0,10)};
const monthKey=iso=>(iso||"").slice(0,7);
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtD=iso=>{if(!iso)return"—";const[y,m,d]=iso.slice(0,10).split("-");return`${d} ${MONTHS[+m-1]} ${y.slice(2)}`};
const fmtDL=iso=>{if(!iso)return"—";const[y,m,d]=iso.slice(0,10).split("-");return`${d} ${MONTHS[+m-1]} ${y}`};
const nowIso=()=>new Date().toISOString();

/* ---------- setup access ---------- */
const EMPTY_SET={companies:[],banks:[],emails:[],people:[],locations:[],lists:{},numbering:{},refPatterns:{},forms:{},defaults:{company:"c1",receiveLoc:"",sellLoc:"",shipTo:"",cur:"RMB",mode:"air",incoterm:"FOB",approvalGbp:2000,trashDays:30,reminderDays:7,reorderWarnDays:30,targetMarginPct:30,cycleDays:90,safetyDays:14,leadDays:30},fees:{chinaNew:5,chinaOld:4,batchAlertPct:10,vatPct:20,dutyDefaultPct:5},rates:{history:[]},users:[],roles:{},aliases:{},skuAliases:{},driveRoot:"NEXUS",folderPattern:"{no} {party} {what} {date}"};
const SET=()=>D.setup||EMPTY_SET;
const DEF=()=>{const s=SET();const d={...EMPTY_SET.defaults,...(s.defaults||{})};const c=(s.companies||[]).find(x=>x.default&&!x.archived);if(c)d.company=c.id;const lf=k=>(s.locations||[]).find(l=>l.default&&l.default[k]&&!l.archived)?.id;d.receiveLoc=lf("receive")||d.receiveLoc;d.sellLoc=lf("sell")||d.sellLoc;d.shipTo=lf("ship")||d.shipTo;return d};
const FEES=()=>({...EMPTY_SET.fees,...(SET().fees||{})});
const listDef=k=>SET().lists?.[k]||{label:k,items:[]};
const items=(k,o={})=>listDef(k).items.filter(i=>(o.all||!i.archived)&&(o.parent===undefined||(i.parent||"")===(o.parent||""))&&(!o.group||i.group===o.group));
const item=(k,id)=>listDef(k).items.find(i=>i.id===id);
const L=(k,id)=>{if(id==null||id==="")return"";const it=item(k,id);if(!it)return String(id);return it.parent?`${L(k,it.parent)} › ${it.label}`:it.label};
const defaultItem=k=>items(k).find(i=>i.default)||items(k)[0];
const company=id=>(SET().companies||[]).find(c=>c.id===id);
const cname=id=>company(id)?.name||id||"—";
const bank=id=>(SET().banks||[]).find(b=>b.id===id);
const bname=id=>bank(id)?.name||id||"—";
const person=id=>(SET().people||[]).find(p=>p.id===id);
const locs=(o={})=>(SET().locations||[]).filter(l=>o.all||!l.archived);
const loc=id=>(SET().locations||[]).find(l=>l.id===id);
const locName=id=>{if(!id)return"—";const l=loc(id);if(!l)return String(id);return l.parent?`${loc(l.parent)?.name||""} › ${l.name}`:l.name};
const leafLocs=()=>{const all=locs();return all.filter(l=>!all.some(c=>c.parent===l.id)).map(l=>[l.id,locName(l.id)])};
const live=a=>(a||[]).filter(x=>!x.deletedAt);
const party=c=>D.parties.find(p=>p.code===c);
const pname=c=>party(c)?.name||c||"—";
const plabel=c=>{const p=party(c);return p?`${p.name}${p.company?" · "+p.company:""} · ${p.code}`:c||"—"};
const product=s=>D.products.find(p=>p.sku===s);
const can=perm=>{const r=SET().roles?.[S.role];if(!r)return S.role==="owner";return!!r[perm]};
const partyTypeDef=t=>item("partyType",t)||{prefix:"SUP",dept:"supplier",defaultCur:"RMB"};

/* ---------- money ---------- */
const curDef=c=>item("currency",c)||{id:c,symbol:c==="GBP"?"£":c==="USD"?"$":c==="RMB"?"¥":"",decimals:2};
/* rate on a date = the latest Setup › Rates row on or before that date that carries this currency (before the first row: the earliest row that carries it).
   A currency without any rate returns null — it is never converted 1:1. Forms block on it with "Add rate". */
function rateOn(date,c){if(c==="GBP"||!c)return 1;const all=(SET().rates?.history||[]).filter(r=>r&&r[c]!=null&&r[c]!==""&&+r[c]>0).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);if(!all.length)return null;const d=date||"9999";let r=null;for(const x of all){if((x.date||"")<=d)r=x;else break}return +((r||all[0])[c])}
const hasRate=(c,date)=>rateOn(date,c)!=null;
const noRateMsg=(c,date)=>`No ${c} rate${date?" on "+fmtD(date):""} — add it in Setup › Rates (amounts in ${c} cannot be converted to £ until then)`;
const latestRate=()=>{const h=(SET().rates?.history||[]).slice().sort((a,b)=>a.date<b.date?-1:1);return h[h.length-1]||{date:"",RMB:.11,USD:.79}};
/* currencies in use (records or the Currency list) that have no rate at all */
function curNoRate(){const used=new Set(items("currency").map(c=>c.id));["purchases","payments","credits","inspections"].forEach(col=>live(D[col]).forEach(x=>x.cur&&used.add(x.cur)));live(D.shipments).forEach(s=>s.costCur&&used.add(s.costCur));return[...used].filter(c=>c&&c!=="GBP"&&rateOn(today(),c)==null)}
function toGbp(a,c,date){a=+a||0;if(c==="GBP"||!c)return a;const r=rateOn(date||today(),c);return r==null?null:a*r}
/* convert between two currencies through £ (null when a rate is missing) */
function convCur(a,from,to,date){if(from===to)return +a||0;const g=toGbp(a,from,date);const r=rateOn(date||today(),to);return g==null||r==null?null:g/r}
const fmt=(a,c,d)=>{if(a==null||a===""||isNaN(+a))return"—";const cd=curDef(c);d=d==null?cd.decimals??2:d;return(cd.symbol||"")+Number(a).toLocaleString("en-GB",{minimumFractionDigits:d,maximumFractionDigits:d})};
const gbp=a=>fmt(a,"GBP",0);
const gbp2=a=>fmt(a,"GBP",2);
/* "ⓘ How" toggle: shows the working behind a number with the actual figures (native <details>, no script) */
const how=(html,label)=>html?`<details class="how"><summary>ⓘ ${esc(label||"How")}</summary><div class="howb">${html}</div></details>`:"";
const num=(a,d=0)=>a==null||isNaN(+a)?"—":Number(a).toLocaleString("en-GB",{maximumFractionDigits:d});
/* money rounding, one place: half away from zero on a float-safe basis (1.005 → 1.01, −1.005 → −1.01) */
const r2=x=>{x=+x||0;const s=x<0?-1:1;return s*Math.round((Math.abs(x)+1e-9)*100)/100};

/* ---------- numbering & references ---------- */
const noNum=no=>{const n=parseInt(String(no||"").split("-").pop(),10);return isNaN(n)?null:n};
function nextNo(col,date){const n=SET().numbering?.[col]||{pfx:col.slice(0,2).toUpperCase(),pattern:"{pfx}-{yy}-{####}"};const nums=(D[col]||[]).map(x=>noNum(x.no||x.id)).filter(n=>n!=null);const c=+(D.counters?.[col]||0);const next=nums.reduce((a,b)=>b>a?b:a,c)+1;/* the year in the number is the year the record is created (numbers run on across years; the document date is kept separately) */const dt=today();return String(n.pattern||"{pfx}-{yy}-{####}").replace("{pfx}",n.pfx||"").replace("{yyyy}",dt.slice(0,4)).replace("{yy}",dt.slice(2,4)).replace("{####}",String(next).padStart(4,"0"))}
/* counters/main keeps the highest number ever issued, so a purged or undone number is never reused */
async function bumpCounter(col,no){if(!db||!SET().numbering?.[col])return;const n=noNum(no);if(n==null)return;if(n<=+(D.counters?.[col]||0))return;D.counters={...(D.counters||{}),id:"main",[col]:n};try{await db.collection("counters").doc("main").set({...D.counters})}catch(e){console.warn("counter not saved",e)}}
async function setCounterNext(col,next){const max=Math.max(+(D.counters?.[col]||0),...(D[col]||[]).map(x=>noNum(x.no||x.id)).filter(n=>n!=null),0);const want=Math.floor(+next)-1;if(!(want>max)){toast(`Next number must be above ${max} — counters never go down`);return false}D.counters={...(D.counters||{}),id:"main",[col]:want};await db.collection("counters").doc("main").set({...D.counters});toast(`${col}: next number ${want+1}`);return true}
function partyCode(type){const pfx=partyTypeDef(type).prefix||"SUP";const nums=D.parties.filter(p=>String(p.code).startsWith(pfx+"-")).map(p=>parseInt(p.code.split("-")[1],10)).filter(n=>!isNaN(n));return`${pfx}-${String(Math.max(0,...nums)+1).padStart(3,"0")}`}
function skuFor(brand,category){const b=item("brand",brand)?.code||brand||"XX";const c=item("category",category);const parts=[b];if(c){if(c.parent){parts.push(item("category",c.parent)?.code||c.parent);parts.push(c.code||c.id)}else parts.push(c.code||c.id)}const pre=parts.join("-")+"-";const nums=D.products.filter(p=>p.sku.startsWith(pre)).map(p=>parseInt(p.sku.slice(pre.length),10)).filter(n=>!isNaN(n));return pre+String(Math.max(0,...nums)+1).padStart(2,"0")}
/* bank / transfer reference text. One allocation: "{acc} {ref} {type}{pct} {yourRef}" with pct = this allocation ÷ that order's total.
   Several allocations: every order is named with its own type code and % ("VL PO-26-0070 FUL100 + PO-26-0071 DEP30"), never one % of the first order. */
function refTextFor(form,d){const pat=SET().refPatterns?.[form]||"{acc} {ref} {type}{pct} {yourRef}";const acc=company(d.account||d.company)?.tag||"";const rt=item("refType",d.refType);const allocs=(d.allocations||[]).filter(a=>a&&a.ref&&!(a.belongsTo&&a.belongsTo!=="this_order"));/* a part for something else never changes the bank reference: it stays per main ref */
 const pctOf=(ref,amt)=>{const po=D.purchases.find(p=>p.no===ref);const t=po?poTotal(po):0;return po&&t&&+amt?Math.round(+amt/t*100):""};
 const first=allocs[0]?.ref||d.ref||d.no;const po=D.purchases.find(p=>p.no===first);
 if(form==="payment"&&allocs.length>1){const parts=allocs.map(a=>{const code=item("refType",defaultRefType("payment",{type:null,allocations:[a],no:d.no,amountCur:+a.amount||0}))?.code||"";return`${a.ref} ${code}${pctOf(a.ref,a.amount)}`.trim()});return`${acc} ${parts.join(" + ")}`.replace(/\s+/g," ").trim()}
 const pct=d.pct!=null&&d.pct!==""?d.pct:(allocs[0]?pctOf(allocs[0].ref,allocs[0].amount!=null&&allocs[0].amount!==""?allocs[0].amount:d.amount):(po&&d.amount?pctOf(po.no,d.amount):""));
 return pat.replace("{acc}",acc).replace("{ref}",first&&first!==d.no?first:(d.ref||"")).replace("{no}",d.no||"").replace("{type}",rt?.code||"").replace("{pct}",pct?String(pct):"").replace("{yourRef}",d.yourRef||po?.piNo||"").replace("{pos}",(d.lines||[]).map(l=>l.po).filter((v,i,a)=>v&&a.indexOf(v)===i).join("+")).replace(/\s+/g," ").trim()}
function defaultRefType(form,d){if(form==="payment"){const t=d.type;const map={deposit:"DEP",balance:"BAL",final:"FIN",full:"FUL",freight:"FRT",inspection:"INS",duty:"DTY",extra:"EXT",refund:"REF",credit:"CRN"};if(map[t])return map[t];const ref=((d.allocations||[]).find(a=>a&&a.ref&&!(a.belongsTo&&a.belongsTo!=="this_order"))||d.allocations?.[0])?.ref||d.ref;if(ref){if(ref.startsWith("SH-"))return"FRT";if(ref.startsWith("IN-"))return"INS";const po=D.purchases.find(p=>p.no===ref);if(po){const prev=paysFor(ref).filter(p=>p.no!==d.no);if(!prev.length)return poTotal(po)>0&&(+d.amountCur||0)>=poTotal(po)-0.5?"FUL":(po.schedule||[]).length>1||po.depositPct<100?"DEP":"FUL";const st=poState(po);return st.outstandingCur-(+d.amountCur||0)<=0.5?"FIN":"BAL"}}return"EXT"}
 if(form==="purchase"){if(d.kind==="uk")return"UKP";if(d.kind==="sample")return"SMPO";return(d.lines||[]).some(l=>product(l.sku)?.isNew)?"NEW":"REP"}
 if(form==="shipment"){return{air:"AIR",airE:"AIR",exp:"EXP",seaL:"SEA",seaF:"SEA",rail:"TRK",truck:"TRK"}[d.mode]||"AIR"}
 if(form==="inspection")return"PRE";if(form==="move"){return{transfer:"FBA",return:"RET",damaged:"DMG",lost:"LST",sample:"SMPG"}[d.type]||null}return null}
function folderName(d,col){const pat=SET().folderPattern||"{no} {party} {what} {date}";const what=col==="purchases"?poDesc(d).slice(0,30):col==="shipments"?`${L("mode",d.mode)} ${d.ctn||""}ctn`:col==="payments"?`${L("payType",d.type)} ${d.allocations?.[0]?.ref||""}`:"";const dt=d.date||d.dispatch||today();return pat.replace("{no}",d.no||"").replace("{party}",pname(d.party)).replace("{what}",what).replace("{date}",fmtD(dt).replace(/ /g,"")).replace(/[\/\\:*?"<>|]/g,"-").replace(/\s+/g," ").trim()}
function label(col,x){if(!x)return"";switch(col){
 case"purchases":return`${x.no} · ${pname(x.party)} · ${poDesc(x).slice(0,34)}${x.oldRef?" · "+x.oldRef:""}`;
 case"shipments":return`${x.no} · ${pname(x.party)} · ${L("mode",x.mode)}${x.ctn?" · "+x.ctn+" ctn":""}${x.oldRef?" · "+x.oldRef:""}`;
 case"payments":return`${x.no} · ${pname(x.party)} · ${fmt(x.amount,x.cur)}${x.allocations?.[0]?.ref?" · "+x.allocations[0].ref:""}`;
 case"inspections":return`${x.no} · ${pname(x.party)} · ${x.po||""} · ${L("inspResult",x.result)}`;
 case"receipts":return`${x.no} · ${x.src||""} · ${(x.lines||[]).reduce((s,l)=>s+(+l.q||0),0)} packs`;
 case"moves":return`${x.no} · ${L("moveType",x.type)} · ${x.sku||""} · ${x.qty||0}`;
 case"credits":return`${x.no} · ${pname(x.party)} · ${fmt(x.amount,x.cur)}`;
 case"imports":return`${x.no} · ${L("importKind",x.kind)} · ${x.rows||0} rows`;
 case"parties":return plabel(x.code);
 case"products":return`${x.name} · ${x.sku}${x.brand?" · "+L("brand",x.brand):""}`;
 default:return x.no||x.id}}
/* description of an order: the live product names (a product rename shows everywhere); legacy lines without a product keep their PI text; orders without lines use the stored description */
const poDesc=p=>{const ls=(p.lines||[]).map(l=>l.sku&&product(l.sku)?product(l.sku).name:l.p).filter(Boolean);return ls.length?ls.join("; "):(p.desc||"")};

/* ---------- business logic ---------- */
const exSign=e=>{const s=item("extraLine",e?.kind)?.sign;return s==null||s===""||isNaN(+s)?1:+s};
const hasFeeExtra=p=>(p?.extras||[]).some(e=>e.kind==="fee");
/* a PI that carries the China fee as an extra line (kind "fee") must not also get the % fee on its lines */
function lineFeePct(p,l){if(!l||hasFeeExtra(p))return 0;return l.feePct!=null&&l.feePct!==""?+l.feePct:(+p?.feePct||0)}
function extrasSum(p){return(p?.extras||[]).reduce((s,e)=>s+(+e.a||0)*exSign(e),0)}
/* ---------- mixed invoices and payments: what belongs to THIS order, what was paid for something else ----------
   lines / extras can carry belongsTo (list chargeOwner; missing = this_order), ref (PO-/SH-/IN- no, "co:<company>", "br:<brand>", "pt:<party>")
   and fee (China fee applies). Payment allocations can carry belongsTo + oref + note for the part that is for something else. */
const CHARGE_OWNER_DEF=[{id:"this_order",label:"This order",refKind:""},{id:"other_order",label:"Another order of ours",refKind:"doc"},{id:"other_company",label:"Another company (ours)",refKind:"company",recharge:true},{id:"other_brand",label:"Another brand",refKind:"brand",recharge:true},{id:"client",label:"A client (on their behalf / resale)",refKind:"party",recharge:true},{id:"personal",label:"Personal / non-business",refKind:"",recharge:true,personal:true},{id:"shipping_other",label:"Shipping / customs for another shipment",refKind:"doc"},{id:"other",label:"Other (see note)",refKind:"any"}];
const chargeOwners=()=>{const l=SET().lists?.chargeOwner;return l&&(l.items||[]).length?l.items.filter(i=>!i.archived):CHARGE_OWNER_DEF};
const coItem=id=>(SET().lists?.chargeOwner?.items||[]).find(i=>i.id===id)||CHARGE_OWNER_DEF.find(i=>i.id===id)||null;
const coLabel=id=>coItem(id)?.label||String(id||"");
const ownerOf=x=>x&&x.belongsTo&&x.belongsTo!=="this_order"?x.belongsTo:"this_order";
const isOther=x=>ownerOf(x)!=="this_order";
const isOtherAlloc=a=>!!a&&!!a.belongsTo&&a.belongsTo!=="this_order";
/* an allocation row that is kept on save: a reference, or a part marked as for something else */
const allocKept=a=>!!a&&(!!a.ref||isOtherAlloc(a));
const truthy=v=>v===true||v==="true";
function orefInfo(r){r=String(r||"").trim();if(!r)return null;if(r.startsWith("co:"))return{t:"company",id:r.slice(3),label:cname(r.slice(3))};if(r.startsWith("br:"))return{t:"brand",id:r.slice(3),label:L("brand",r.slice(3))};if(r.startsWith("pt:"))return{t:"party",id:r.slice(3),label:pname(r.slice(3))};const col=typeof colOfRef==="function"?colOfRef(r):null;return{t:col?"doc":"text",col,id:r,label:r}}
/* "for PO-26-0065 (another order of ours)" */
function ownerText(x,refKey){const o=ownerOf(x);const inf=orefInfo(x[refKey||"ref"]);return`${inf?inf.label+" — ":""}${coLabel(o)}`}
/* China fee applies to a line / extra: stored flag wins; otherwise this-order lines yes, this-order extras when their kind is "feeable" (Setup › Lists › PI extra line kinds), anything for something else never */
function feeApplies(p,x,isLine){if(x&&x.fee!=null&&x.fee!=="")return truthy(x.fee);if(isOther(x))return false;if(isLine)return true;if(["fee","deposit","discount"].includes(x?.kind))return false;return truthy(item("extraLine",x?.kind)?.feeable)}
/* the ONE split of an invoice: invoice total = this order + other charges (each with its reference and whether the fee was charged on it) */
function poSplit(p){const cur=p.cur||"RMB";const feeRow=hasFeeExtra(p);const pPct=+p.feePct||0;let lines=0,extras=0,feeRows=0,feePctAmt=0,feeBase=0,otherLinesQ=0,thisExSigned=0,feeOnExtras=0;const others=[];
 (p.lines||[]).forEach((l,i)=>{const a=+l.a||0;const fa=feeApplies(p,l,true);const fp=fa?lineFeePct(p,l):0;const fee=a*fp/100;
  if(isOther(l)){otherLinesQ+=+l.q||0;others.push({src:"line",i,belongsTo:ownerOf(l),ref:l.ref||"",note:l.n||"",label:`${num(l.q)} × ${l.sku&&product(l.sku)?product(l.sku).name:(l.p||"line")}`,base:r2(a),feeAmt:r2(fee),amount:r2(a+fee),fee:fa&&fp>0})}
  else{lines+=a;if(fa)feeBase+=a;feePctAmt+=fee}});
 (p.extras||[]).forEach((e,i)=>{const a=(+e.a||0)*exSign(e);const fa=feeApplies(p,e,false);const fp=fa&&!feeRow?pPct:0;const fee=a*fp/100;
  if(isOther(e)){others.push({src:"extra",i,belongsTo:ownerOf(e),ref:e.ref||"",note:e.n||"",kind:e.kind,label:L("extraLine",e.kind)||e.kind||"extra",base:r2(a),feeAmt:r2(fee),amount:r2(a+fee),fee:fa&&fp>0})}
  else{thisExSigned+=a;if(e.kind==="fee")feeRows+=a;else{extras+=a;if(fa)feeBase+=a;feePctAmt+=fee;feeOnExtras+=fee}}});
 const othersSum=r2(others.reduce((s,o)=>s+o.amount,0));const thisComputed=r2(lines+extras+feeRows+feePctAmt);const computed=r2(thisComputed+othersSum);
 const stored=p.total!=null&&p.total!=="";const invoiceTotal=stored?+p.total:computed;const fee=r2(feeRows+feePctAmt);
 return{cur,invoiceTotal,thisOrder:r2(invoiceTotal-othersSum),thisComputed,lines:r2(lines),extras:r2(extras),fee,feeBase:r2(feeBase),feePct:feeBase?fee/feeBase*100:0,feeFromRows:feeRow,others,othersSum,computed,diff:stored?r2(invoiceTotal-computed):0,otherLinesQ,thisExSigned:r2(thisExSigned),feeOnExtras:r2(feeOnExtras),hasOthers:others.length>0}}
function poTotal(p){if(p.total!=null&&p.total!=="")return +p.total;return poSplit(p).computed}
/* amounts billed on ANOTHER order's invoice (extras / lines marked "belongs to" this order) — they settle this order */
function poViaRows(p){if(!p?.no)return[];const cur=p.cur||"RMB";const out=[];live(D.purchases).filter(x=>x.no!==p.no&&x.status!=="cancelled").forEach(x=>{const sp=(x.extras||[]).some(e=>e.ref===p.no)||(x.lines||[]).some(l=>l.ref===p.no)?poSplit(x):null;if(!sp)return;sp.others.filter(o=>o.ref===p.no).forEach(o=>{const inCur=x.cur===cur?o.amount:convCur(o.amount,x.cur||"RMB",cur,x.date);out.push({from:x.no,src:o.src,i:o.i,label:o.label,note:o.note,amt:o.amount,cur:x.cur||"RMB",inCur:r2(inCur||0),noRate:inCur==null,fee:o.fee,date:x.date||""})})});return out.sort((a,b)=>a.date<b.date?-1:1)}
/* parts of payments that were sent for something else (not this order): [{pay, a (allocation), amount, cur}] */
function otherAllocs(filter){const out=[];live(D.payments).filter(isCounted).forEach(x=>(x.allocations||[]).forEach((a,i)=>{if(isOtherAlloc(a)&&(!filter||filter(x,a)))out.push({pay:x,a,i,amount:+a.amount||0,cur:x.cur})}));return out}
/* the payment a part of it went with: the first allocation that is not "for something else" */
const mainAllocOf=x=>(x?.allocations||[]).find(a=>a.ref&&!isOtherAlloc(a))||null;
/* does a PI / payment text say the amount is for something else? → {belongsTo, ref, why, sure} (form assistant, importer) */
function mixGuess(text,o={}){const t=String(text||"");if(!t.trim())return null;const self=o.self||null;const T=t.toLowerCase();
 const doc=no=>{no=String(no).toUpperCase();if(no===self)return null;const col=typeof colOfRef==="function"?colOfRef(no):null;return col&&["purchases","shipments","inspections"].includes(col)&&(D[col]||[]).some(x=>x.no===no)?{no,col}:null};
 const m=t.match(/\b(?:PO|SH|IN)-\d{2}-\d{3,5}\b/i);if(m){const d=doc(m[0]);if(d)return{belongsTo:d.col==="shipments"?"shipping_other":"other_order",ref:d.no,why:`the text names ${d.no}`,sure:true}}
 const olds=t.match(/\b[A-Z]{2,5}-\d{2,4}\b/g)||[];for(const w of olds){const hit=["purchases","shipments"].flatMap(c=>live(D[c]).map(x=>({c,x}))).find(({x})=>x.no!==self&&[].concat(x.oldRef||[]).some(r=>String(r).toUpperCase()===w.toUpperCase()||String(r).toUpperCase().startsWith(w.toUpperCase()+"-")));if(hit)return{belongsTo:hit.c==="shipments"?"shipping_other":"other_order",ref:hit.x.no,why:`the text names old ref ${w} (= ${hit.x.no})`,sure:true}}
 if(/\b(last|previous|earlier|prior|old|next|other)\s+(order|shipment|batch|po|invoice)\b/i.test(t)){const nums=(t.match(/\d[\d,]*\.\d+|\d{4,}/g)||[]).map(x=>+x.replace(/,/g,"")).filter(x=>x>0);const cands=live(D.purchases).filter(p=>p.no!==self&&p.status!=="cancelled"&&(!o.party||p.party===o.party)&&(!o.date||(p.date||"")<=o.date)).sort((a,b)=>(a.date||"")<(b.date||"")?1:-1);
  const hit=cands.find(p=>{const tot=poTotal(p);return tot&&nums.some(n=>Math.abs(n-tot)<=1)});if(hit)return{belongsTo:"other_order",ref:hit.no,why:`"${t.match(/(last|previous|earlier|prior|old|next|other)\s+\w+/i)[0]}" and ${fmt(poTotal(hit),hit.cur)} = ${hit.no}'s total`,sure:true};
  if(cands[0])return{belongsTo:"other_order",ref:cands[0].no,why:`"${t.match(/(last|previous|earlier|prior|old|next|other)\s+\w+/i)[0]}" — probably ${cands[0].no} (latest earlier order of this supplier); check`,sure:false};return{belongsTo:"other_order",ref:"",why:"the text mentions another order",sure:false}}
 if(/custom(s)?\s+(declaration|clearance|doc)|declaration\s+doc/i.test(t))return{belongsTo:"shipping_other",ref:"",why:"a customs / declaration cost — usually for a shipment, not this order's goods",sure:false};
 const pm=live(D.parties).filter(p=>p.code!==o.party&&p.name&&p.name.length>=4).find(p=>new RegExp("\\b"+p.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","i").test(t));
 if(/\b(client|customer|on behalf|resale|resell)\b/i.test(t))return{belongsTo:"client",ref:pm?"pt:"+pm.code:"",why:`the text says ${(T.match(/client|customer|on behalf|resale|resell/)||[""])[0]}${pm?" — "+pm.name:""}`,sure:!!pm};
 const by=t.match(/(?:charged|paid|borne|billed)\s+(?:by|to)\s+([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*)?)/);if(by)return{belongsTo:pm?"client":"other",ref:pm?"pt:"+pm.code:"",why:`the text says "${by[0]}"`,sure:false};
 if(pm&&new RegExp("\\b(?:for|on behalf of)\\s+(?:mr\\.?\\s+|ms\\.?\\s+|mrs\\.?\\s+)?"+pm.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","i").test(t))return{belongsTo:"client",ref:"pt:"+pm.code,why:`the text says it is for ${pm.name}`,sure:false};
 if(/\b(personal|private|not business|non-business)\b/i.test(t))return{belongsTo:"personal",ref:"",why:"the text says personal / private",sure:false};
 return null}
/* Recharge list: money paid for a client, another company / brand, personal or other — who should bear it */
function recharges(){const out=[];const T=today();
 live(D.purchases).filter(p=>p.status!=="cancelled").forEach(p=>{const sp=(p.extras||[]).some(isOther)||(p.lines||[]).some(isOther)?poSplit(p):null;if(!sp)return;sp.others.forEach(o=>{const it=coItem(o.belongsTo)||{};const inf=orefInfo(o.ref);if(inf?.t==="doc"&&!it.recharge&&o.belongsTo!=="other")return;out.push({via:"invoice",src:p.no,col:"purchases",date:p.date,belongsTo:o.belongsTo,ref:o.ref,inf,label:o.label,note:o.note,amount:o.amount,cur:sp.cur,gbp:toGbp(o.amount,sp.cur,p.date),fee:o.fee,personal:!!truthy(it.personal),party:p.party})})});
 otherAllocs().forEach(({pay,a,amount,cur})=>{const it=coItem(a.belongsTo)||{};const inf=orefInfo(a.oref||a.ref);if(inf?.t==="doc"&&!it.recharge&&a.belongsTo!=="other")return;const main=mainAllocOf(pay);out.push({via:"payment",src:pay.no,col:"payments",with:main?.ref||null,date:pay.date,belongsTo:a.belongsTo,ref:a.oref||a.ref||"",inf,label:a.note||coLabel(a.belongsTo),note:a.note||"",amount,cur,gbp:(payRate(pay)||0)*amount,fee:false,personal:!!truthy(it.personal),party:pay.party})});
 return out.sort((a,b)=>(a.date||"")<(b.date||"")?1:-1)}
function allocAmount(pay,ref){return(pay.allocations||[]).filter(x=>x.ref===ref).reduce((s,a)=>s+(+a.amount||0),0)}
/* ---------- payments: ONE rule for what counts ----------
   counted = live, status "paid" and approved when it needed approval. Pending, not approved, cancelled ("not counted"), failed, reversed
   and refunded payments never move a balance, a milestone or a status anywhere (Home, lists, drawers, ledger, Calendar, alerts). */
function isCounted(x){return!!x&&!x.deletedAt&&x.status==="paid"&&!(x.needsApproval&&!x.approved)}
function payWhyNot(x){if(!x)return"";if(x.deletedAt)return"in Trash";if(x.status==="pending"||(x.needsApproval&&!x.approved))return x.approved?"approved, not marked paid yet":"waiting for approval";if(x.status!=="paid")return String(L("payStatus",x.status)||x.status||"not paid").toLowerCase();return""}
function paysFor(ref,o={}){return live(D.payments).filter(p=>(o.incPending?!["cancelled","failed","reversed"].includes(p.status):isCounted(p))&&(p.allocations||[]).some(a=>a.ref===ref))}
/* £ per unit of a payment: the actual £ from the bank wins, then the stored £, then the rate on its day */
function payRate(x){if(!x)return null;if(x.cur==="GBP")return 1;const g=x.gbpActual!=null&&x.gbpActual!==""?+x.gbpActual:(x.gbp!=null&&x.gbp!==""?+x.gbp:null);if(g!=null&&+x.amount)return g/(+x.amount);if(+x.fxRate)return +x.fxRate;return rateOn(x.date,x.cur)}
const paySignOf=x=>x&&x.direction==="in"?-1:1;
function allocGbp(x,ref){const r=payRate(x);return r==null?0:allocAmount(x,ref)*r*paySignOf(x)}
function creditsFor(po){return live(D.credits).filter(c=>c.po===po&&c.status!=="refunded")}
function creditInCur(c,cur){return c.cur===cur?+c.amount||0:(convCur(+c.amount||0,c.cur,cur,c.date)??0)}
const poShipments=no=>no?live(D.shipments).filter(s=>s.status!=="cancelled"&&((s.lines||[]).some(l=>l.po===no)||(s.purchases||[]).includes(no))):[];
const poReceipts=no=>no?live(D.receipts).filter(r=>(r.pos||[]).includes(no)||(r.lines||[]).some(l=>l.po===no)):[];
/* every counted money movement that settles an order, in the order's currency: payments allocated to the order and payments allocated
   to a credit note of the order (a refund received, or the credit deducted inside another payment). Each row carries its conversion text. */
function poPayRows(p){const cur=p.cur||"RMB";const T=today();const rows=[];
 const add=(x,ref,via)=>{const amt=allocAmount(x,ref);const sign=paySignOf(x);const r=payRate(x);const g=r==null?null:amt*r;let inCur,conv="";
  if(x.cur===cur)inCur=amt;else{const rd=x.date&&x.date<=T?x.date:T;const rc=rateOn(rd,cur);inCur=g==null||rc==null?null:g/rc;conv=`${fmt(amt,x.cur)} → ${g==null?"no "+x.cur+" rate":gbp2(g)+(x.gbpActual!=null&&x.gbpActual!==""?" (actual £ from the bank)":` (at ${num(r,5)} on ${fmtD(x.date)})`)} → ${inCur==null?"no "+cur+" rate":fmt(inCur,cur)+` at the ${cur} rate on ${fmtD(rd)} (${num(rc,5)})`}`}
  rows.push({x,no:x.no,ref,via:via||null,date:x.date||"",amt:sign*amt,cur:x.cur,inCur:sign*(inCur||0),gbp:sign*(g||0),conv,noRate:inCur==null})};
 paysFor(p.no).forEach(x=>add(x,p.no));live(D.credits).filter(c=>c.po===p.no).forEach(c=>paysFor(c.no).forEach(x=>add(x,c.no,c.no)));
 return rows.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0)}
/* the ONE place an order's money and quantities are worked out (Home, lists, drawers, Reports, party ledger, Calendar, alerts all read this) */
function poState(p){const total=poTotal(p);const cur=p.cur||"RMB";const rows=poPayRows(p);const paidCur=r2(rows.reduce((s,r)=>s+r.inCur,0));const paidGbp=r2(rows.reduce((s,r)=>s+r.gbp,0));
 const crs=creditsFor(p.no);const cr=r2(crs.reduce((s,c)=>s+creditInCur(c,cur),0));/* written off (by hand with a reason, or at migration): positive = unpaid rest forgiven, negative = overpayment the supplier will not return */const wo=p.writtenOff&&+p.writtenOff.amount?r2(+p.writtenOff.amount):0;
 /* within 50p (or 0.50 in the PI currency) an order counts as settled — the same tolerance everywhere *//* billed on another order's invoice for this order: settles what is still owed; anything beyond that is an extra cost of this order billed elsewhere (never an overpayment) */
 const via=poViaRows(p);const viaCur=r2(via.reduce((s,v)=>s+v.inCur,0));const bal0=r2(total-paidCur-cr-wo);const viaUsed=r2(Math.max(0,Math.min(viaCur,bal0)));const viaExtra=r2(viaCur-viaUsed);
 const balance=r2(bal0-viaUsed);/* a CLOSED order paid in another currency: what is left is only exchange-rate difference, not money owed either way */const fxDiff=p.status==="closed"&&rows.some(r=>r.cur!==cur)?balance:0;const outstandingCur=total>0&&balance-fxDiff>0.5?balance:0;const owedToUs=total>0&&balance-fxDiff<-0.5?-balance:0;
 const pct=total?Math.min(1.5,(paidCur+cr+wo+viaUsed)/total):0;const over=total?(paidCur+cr+viaUsed)/total:0;const rc=rateOn(today(),cur);
 const st=item("poStatus",p.status);const steps=items("poStatus").filter(i=>i.step>=0).sort((a,b)=>a.step-b.step);const stepIndex=Math.max(0,steps.findIndex(s=>s.id===p.status));
 const ship=poShipments(p.no);const rec=poReceipts(p.no);
 const ordered=(p.lines||[]).reduce((s,l)=>s+(+l.q||0),0);const shipped=ship.reduce((s,sh)=>s+shipLinesExpanded(sh).filter(l=>l.po===p.no).reduce((a,l)=>a+(+l.q||0),0),0);const recL=rec.flatMap(r=>(r.lines||[]).filter(l=>l.po===p.no));const received=recL.reduce((a,l)=>a+(+l.q||0),0);const damaged=recL.reduce((a,l)=>a+(+l.damaged||0),0);
 const payLabel=total===0?(rows.length?"Paid (no PI)":"No PI"):outstandingCur<=0.5?(owedToUs>0.5?"Overpaid":wo?"Written off":"Paid"):paidCur>0||viaUsed>0?"Part paid":"Unpaid";
 return{fxDiff,total,cur,rows,pays:[...new Set(rows.map(r=>r.x))],paidCur,paidGbp,credits:cr,creditDocs:crs,writtenOff:wo,balance,outstandingCur,outstandingGbp:rc==null?0:r2(outstandingCur*rc),owedToUs,owedToUsGbp:rc==null?0:r2(owedToUs*rc),via,viaCur,viaUsed,viaExtra,noRate:rc==null,pct,over,status:st,stepIndex,steps,ship,rec,ordered,shipped,received,damaged,payLabel}}
/* orders that can owe money: every live order except cancelled. A closed order owes nothing only when it is settled or its rest is written off (reason shown everywhere) */
/* products whose stock counts (Home tile, Stock page, Reports): live and not merged away */
const stockProducts=()=>live(D.products).filter(p=>!p.mergedInto);
const openPOs=()=>live(D.purchases).filter(p=>p.status!=="cancelled");
/* orders whose money is still in play for alerts, Calendar and Cash needed (closed and cancelled ones are done) */
const dueScope=()=>openPOs().filter(p=>p.status!=="closed");
const owingPOs=()=>openPOs().filter(p=>{const st=poState(p);return st.total>0&&st.outstandingCur>0.5});
function msAmount(p,m,total){return m.amount!=null&&m.amount!==""&&+m.amount>0?+m.amount:(total??poTotal(p))*(+m.pct||0)/100}
/* milestones are filled in order by what is counted (payments oldest first, then credit notes and a write-off). A milestone is covered when the
   cumulative amount reaches it; "by" lists which payments paid it and how much. m.paid is kept equal to the payment that completed it. */
function msCoverage(p){const sch=p.schedule||[];if(!sch.length)return[];const st=poState(p);const pool=st.rows.filter(r=>Math.abs(r.inCur)>0.004).map(r=>({no:r.no,amt:r.inCur,via:r.via}));if(st.credits)pool.push({no:st.creditDocs.map(c=>c.no).join(" + "),amt:st.credits,credit:true});if(st.viaUsed>0){let left=st.viaUsed;st.via.forEach(v=>{const u=r2(Math.min(left,v.inCur));if(u>0.004){pool.push({no:v.from+" invoice",amt:u,viaInv:true});left=r2(left-u)}})}if(st.writtenOff>0)pool.push({no:"written off",amt:st.writtenOff,wo:true});
 const avail=r2(pool.reduce((s,x)=>s+x.amt,0));const iv=[];let c0=0;pool.filter(x=>x.amt>0).forEach(x=>{iv.push({...x,s:c0,e:c0+x.amt});c0+=x.amt});let cum=0;
 return sch.map(m=>{const a=msAmount(p,m,st.total);const s=cum,e=cum+a;cum=e;const by=iv.filter(x=>x.e>s+0.005&&x.s<e-0.005).map(x=>({no:x.no,amt:r2(Math.min(x.e,e)-Math.max(x.s,s)),credit:!!x.credit,wo:!!x.wo}));const got=r2(Math.max(0,Math.min(avail,e)-s));const covered=st.total>0&&avail>=e-0.5;const pays=iv.filter(x=>!x.credit&&!x.wo&&!x.viaInv&&x.s<e-0.005);return{m,amount:r2(a),got,covered,by,paidBy:covered&&pays.length?pays[pays.length-1].no:null}})}
function msCovered(p){return msCoverage(p).map(c=>c.covered)}
const msByText=(c,cur)=>c.by.length?c.by.map(b=>`${b.wo?"written off":b.no} (${fmt(b.amt,cur)})`).join(" + "):"";
function nextMilestone(p){const c=msCovered(p);return(p.schedule||[]).find((m,i)=>!c[i])}
const nextMilestoneIndex=p=>{const c=msCovered(p);return(p.schedule||[]).findIndex((m,i)=>!c[i])};
/* when a milestone falls due, and why. "ready" is pulled forward when goods leave before the ready date; "receipt" waits for the FULL receipt */
function fullReceiptDate(p){const ordered=(p.lines||[]).reduce((s,l)=>s+(+l.q||0),0);if(!ordered||!p.no)return null;let cum=0;for(const r of poReceipts(p.no).slice().sort((a,b)=>(a.date||"")<(b.date||"")?-1:1)){cum+=(r.lines||[]).filter(l=>l.po===p.no).reduce((s,l)=>s+(+l.q||0),0);if(cum>=ordered)return{d:r.date,no:r.no,q:ordered}}return null}
function dueInfo0(p,m){if(m.due)return{d:m.due,why:"date typed on the order"};const ev=m.dueEvent;const lead=+party(p.party)?.leadDays||DEF().leadDays;const ready=p.readyDate||addDays(p.date,lead);
 const shs=poShipments(p.no).filter(s=>s.dispatch||s.date).sort((a,b)=>(a.dispatch||a.date)<(b.dispatch||b.date)?-1:1);const fs=shs[0];const firstShip=fs?(fs.dispatch||fs.date):null;
 if(ev==="order"||!ev)return{d:p.date,why:"order date"};
 if(ev==="ready"){if(firstShip&&firstShip<ready)return{d:firstShip,why:`goods left on ${fs.no} (${fmtD(firstShip)}) before the ready date ${fmtD(ready)}`};return{d:ready,why:p.readyDate?`goods ready ${fmtD(ready)}`:`order date + ${lead} d lead time`}}
 if(ev==="ship")return firstShip?{d:firstShip,why:`dispatch of ${fs.no}`}:{d:ready,why:"estimate — not shipped yet, uses the ready date",est:true};
 if(ev==="receipt"){const full=fullReceiptDate(p);if(full)return{d:full.d,why:`all ${num(full.q)} packs received (${full.no})`};const eta=shs.map(s=>s.eta).filter(Boolean).sort().pop();return{d:eta||addDays(ready,item("mode",DEF().mode)?.days||30),why:`estimate — due after the FULL receipt${eta?" (latest ETA "+fmtD(eta)+")":""}`,est:true}}
 if(ev==="arrive"){const arr=shs.filter(x=>x.arrival||["customs","arrived","part_delivered","delivered"].includes(x.status)).map(x=>({d:x.arrival||x.eta,no:x.no})).filter(x=>x.d).sort((a,b)=>a.d<b.d?-1:1)[0];if(arr)return{d:arr.d,why:`arrived at UK port — ${arr.no} (${fmtD(arr.d)})`};const eta=shs.map(x=>x.eta).filter(Boolean).sort()[0];if(eta)return{d:eta,why:`estimate — ETA of ${fs?fs.no:"shipment"} at UK port`,est:true};return{d:addDays(ready,item("mode",DEF().mode)?.days||30),why:"estimate — not shipped yet (ready date + transit days)",est:true}}
 if(ev==="invoice30")return{d:addDays(p.date,30),why:"30 days after the order"};return{d:p.date,why:"order date"}}
/* one-time upgrade of Setup for data created before these items existed */
async function upgradeSetup(){if(!D.setup||!can("setup"))return;const pairs=[];const de=D.setup.lists?.dueEvent;if(de&&!de.items.some(i=>i.id==="arrive")){const its=de.items.map(i=>i.id==="ship"?{...i,label:"On dispatch to forwarder / shipping invoice"}:i);its.splice(Math.max(0,its.findIndex(i=>i.id==="receipt")),0,{id:"arrive",label:"On arrival at UK port"});pairs.push([["lists","dueEvent","items"],its])}
 const pt=D.setup.lists?.payTerms;if(pt&&!pt.items.some(i=>i.id==="30_50_20_port"))pairs.push([["lists","payTerms","items"],pt.items.concat([{id:"30_50_20_port",label:"30% deposit / 50% at dispatch / 20% on UK port arrival",template:[{pct:30,label:"Deposit",dueEvent:"order"},{pct:50,label:"At dispatch (shipping invoice)",dueEvent:"ship"},{pct:20,label:"On arrival at UK port",dueEvent:"arrive"}]}])]);
 /* mixed invoices / payments: who a charge belongs to; which PI extra kinds get the China fee */
 if(!D.setup.lists?.chargeOwner)pairs.push([["lists","chargeOwner"],{label:"Charge belongs to (mixed invoices / payments)",group:"Purchases",items:CHARGE_OWNER_DEF.map(i=>({...i})),fields:[["refKind","Reference kind (doc / company / brand / party / any)","text"],["recharge","Goes to the Recharge list","bool"],["personal","Personal / non-business","bool"]]}]);
 const xl=D.setup.lists?.extraLine;if(xl&&!(xl.fields||[]).some(f=>f[0]==="feeable")){pairs.push([["lists","extraLine","fields"],(xl.fields||[]).concat([["feeable","China fee applies (default)","bool"]])]);pairs.push([["lists","extraLine","items"],xl.items.map(i=>i.feeable!=null?i:{...i,feeable:["packaging","adjust"].includes(i.id)})])}
 if(pairs.length)await setupPatchMany(pairs,null,{noUndo:true})}
function dueInfo(p,m){const r=dueInfo0(p,m);if(r.est&&["ship","arrive","receipt"].includes(m.dueEvent)&&r.d<today())return{...r,wait:true,waitText:m.dueEvent==="ship"?"waiting — goods not dispatched yet":m.dueEvent==="arrive"?"waiting — not arrived at UK port yet":"waiting — not received yet"};return r}
function dueFor(p,m){return dueInfo(p,m).d}
/* event milestones keep due = null so dueFor() follows the ready date / dispatch live */
function scheduleFromTerms(termsId,total,p){const t=item("payTerms",termsId);const tpl=t?.template||[{pct:100,label:"Full payment",dueEvent:"order"}];return tpl.map(m=>({pct:m.pct,label:m.label,dueEvent:m.dueEvent,due:null,amount:r2(total*m.pct/100),paid:null}))}
function shipLinesExpanded(sh){if(sh.lines?.length)return sh.lines;return(sh.purchases||[]).flatMap(no=>{const p=D.purchases.find(x=>x.no===no);return(p?.lines||[]).filter(l=>l.sku).map(l=>({po:no,sku:l.sku,q:+l.q||0,ctn:product(l.sku)?.perCtn?Math.ceil((+l.q||0)/product(l.sku).perCtn):0}))})}
const lineCtn=l=>{const p=product(l.sku);return +l.ctn||(p?.perCtn?Math.ceil((+l.q||0)/p.perCtn):0)};
function shipWeights(sh){const lines=shipLinesExpanded(sh);let kg=0,cbm=0,ctn=0;lines.forEach(l=>{const p=product(l.sku);const c=lineCtn(l);ctn+=c;if(p?.ctn?.kg)kg+=c*p.ctn.kg;if(p?.ctn?.L&&p?.ctn?.W&&p?.ctn?.H)cbm+=c*p.ctn.L*p.ctn.W*p.ctn.H/1e6});return{kg:r2(kg),cbm:Math.round(cbm*1000)/1000,ctn}}
function chargeable(sh){const m=item("mode",sh.mode)||{basis:"kg",divisor:6000};const kg=+sh.kg||0,cbm=+sh.cbm||0;if(m.basis==="cbm")return{basis:"cbm",value:Math.max(cbm,FEES().seaCbmMin||0),vol:cbm,min:cbm<(FEES().seaCbmMin||0)};const vol=m.divisor?cbm*1e6/m.divisor:0;return{basis:"kg",value:Math.max(kg,vol),vol:r2(vol),divisor:m.divisor}}
/* the working behind "chargeable" with the actual numbers */
function chargeHow(sh){const m=item("mode",sh.mode)||{basis:"kg",divisor:6000};const kg=+sh.kg||0,cbm=+sh.cbm||0;const ch=chargeable(sh);
 if(ch.basis==="cbm"){const min=FEES().seaCbmMin||0;return`${esc(L("mode",sh.mode)||"Sea")} is charged by volume: ${num(cbm,3)} cbm${min&&cbm<min?` → minimum ${num(min,3)} cbm applied (Setup › Rates & fees)`:""} = <b>${num(ch.value,3)} cbm chargeable</b>`}
 return`Volumetric = ${num(cbm,3)} cbm × 1,000,000 ÷ ${num(m.divisor||0)} = ${num(ch.vol,1)} kg; actual ${num(kg,1)} kg → <b>${num(ch.value,1)} kg chargeable</b> (the higher of the two)`}
/* freight £ of a shipment: the actual £ paid when counted freight payments cover the cost, otherwise the estimate at the dispatch-date rate */
function shipCostInfo(sh){const base=+sh.cost||0;const fee=base*(+sh.platformFeePct||0)/100;const ins=+sh.insurance||0;const cc=sh.costCur||"USD";const d=sh.dispatch||sh.date||today();const tot=r2(base+fee+ins);const r=rateOn(d,cc);const est=r==null?null:r2(tot*r);
 const pays=sh.no?paysFor(sh.no):[];let paidCur=0,paidG=0;pays.forEach(x=>{const a=allocAmount(x,sh.no)*paySignOf(x);const pr=payRate(x);paidG+=pr==null?0:a*pr;paidCur+=x.cur===cc?a:(convCur(a,x.cur,cc,x.date)||0)});paidCur=r2(paidCur);paidG=r2(paidG);
 const actual=pays.length>0&&tot>0&&paidCur>=tot-0.5;const gbpV=actual?paidG:(est||0);
 const text=actual?`actual £ paid: ${pays.map(x=>`${x.no} ${gbp2(allocAmount(x,sh.no)*(payRate(x)||0))}`).join(" + ")} = ${gbp2(paidG)}`:(r==null?noRateMsg(cc,d):`estimate: ${fmt(tot,cc)}${fee||ins?` (${fmt(base,cc)}${fee?` + ${num(sh.platformFeePct,1)}% platform fee`:""}${ins?` + ${fmt(ins,cc)} insurance`:""})`:""} × ${num(r,5)} (${cc} rate on ${fmtD(d)}) = ${gbp2(est)}${pays.length?` · paid so far ${fmt(paidCur,cc)} — the actual £ is used once payments cover the cost`:""}`);
 return{base,fee,ins,tot,cur:cc,date:d,rate:r,est,pays,paidCur,paidG,actual,gbp:r2(gbpV),text}}
function shipCostGbp(sh){return shipCostInfo(sh).gbp}
function ukCostsGbp(sh){return(sh.ukCosts||[]).reduce((s,c)=>s+(+c.gbp||0),0)}
/* goods £ of a shipment / receipt line at the order-date rate, incl. the China fee */
function lineGoodsGbp(l){const po=D.purchases.find(p=>p.no===l.po);const pl=(po?.lines||[]).find(x=>x.sku===l.sku);if(!po||!pl)return 0;const r=rateOn(po.date,po.cur);return r==null?0:(+pl.u||0)*(+l.q||0)*r*(1+lineFeePct(po,pl)/100)}
/* how a shipment's freight is split over its lines. By chargeable weight (air/express: max(actual, volumetric) kg; sea: cbm) only when EVERY
   line has carton data; otherwise by goods value (£ at the order rate) for all lines — kilos are never mixed with pack counts. */
function freightSplit(sh){const m=item("mode",sh.mode)||{basis:"kg",divisor:6000};const ls=shipLinesExpanded(sh).filter(l=>l.sku);
 const rows=ls.map(l=>{const p=product(l.sku);const c=lineCtn(l);const kg=p?.ctn?.kg?c*p.ctn.kg:0;const cbm=p?.ctn?.L&&p.ctn.W&&p.ctn.H?c*p.ctn.L*p.ctn.W*p.ctn.H/1e6:0;const vol=m.divisor?cbm*1e6/m.divisor:0;const w=m.basis==="cbm"?cbm:Math.max(kg,vol);return{po:l.po,sku:l.sku,q:+l.q||0,ctn:c,kg:r2(kg),cbm:Math.round(cbm*1000)/1000,vol:r2(vol),w,g:lineGoodsGbp(l)}});
 const missing=rows.filter(r=>!(r.w>0));let basis=rows.length&&!missing.length?(m.basis==="cbm"?"cbm":"kg"):"value";let key=r=>basis==="value"?r.g:r.w;let tot=rows.reduce((s,r)=>s+key(r),0);
 if(!(tot>0)&&rows.length){basis="qty";key=r=>r.q;tot=rows.reduce((s,r)=>s+r.q,0)}rows.forEach(r=>{r.share=tot>0?key(r)/tot:0;r.basisVal=key(r)});
 const label={kg:"chargeable weight (kg)",cbm:"volume (cbm)",value:"goods value (£)",qty:"pack count (no weights or prices)"}[basis];
 const warn=basis==="kg"||basis==="cbm"||rows.length<2?"":`Carton size / packs per carton missing on ${[...new Set(missing.map(r=>product(r.sku)?.name||r.sku))].join(", ")||"a line"} — freight split by ${basis==="value"?"goods value (£)":"pack count"} for every line`;
 return{basis,label,rows,missing:[...new Set(missing.map(r=>r.sku))],warn,total:tot}}
function freightShare(sh,line){return freightSplit(sh).rows.filter(r=>r.sku===line.sku&&(!line.po||!r.po||r.po===line.po)).reduce((s,r)=>s+r.share,0)}
/* landed £ per pack of one receipt line, every part kept so drawers and forms can show the working:
   goods (unit × order-date rate; ex VAT when the price included VAT and the company is VAT-registered) + China fee + share of PI extras
   + freight (shipment £ × this line's share ÷ packs shipped on the line) + UK costs + duty + import VAT (only when not VAT-registered) */
function landedParts(rl,ctx){const po=D.purchases.find(p=>p.no===rl.po);const pl=(po?.lines||[]).find(l=>l.sku===rl.sku&&!isOther(l))||(po?.lines||[]).find(l=>l.sku===rl.sku);const q=+rl.q||0;const o={q,po,pl,goods:0,fee:0,feePct:0,extras:0,viaExtra:0,othersSum:0,freight:0,uk:0,duty:0,vat:0,total:0,rate:null,share:0,basis:null,basisLabel:"",warn:"",costInfo:null,noRate:false};if(!q)return o;
 const rate=po?rateOn(po.date,po.cur):1;o.rate=rate;if(rate==null)o.noRate=true;let unit=pl?(+pl.u||0)*(rate||0):0;if(po?.vatIncluded&&company(po.account)?.vatRegistered){unit/=1+(+FEES().vatPct||20)/100;o.exVat=true}
 o.goods=unit;o.feePct=pl?lineFeePct(po,pl):0;o.fee=unit*o.feePct/100;/* only what belongs to THIS order: its own extras (+ fee on fee-able ones) and any extra cost of this order billed on another order's invoice; charges for something else are left out */
 let ex=0,den=0;if(po){const sp=poSplit(po);const vx=poViaRows(po).length?poState(po).viaExtra:0;o.viaExtra=vx;o.othersSum=sp.othersSum;ex=(sp.thisExSigned+sp.feeOnExtras+vx)*(rate||0);den=poTotal(po)-sp.othersSum}o.extras=po&&pl&&den?ex*((+pl.a||0)/den)/((+pl.q)||1):0;
 const sh=ctx.shipment;if(sh){const fs=freightSplit(sh);const rs=fs.rows.filter(r=>r.sku===rl.sku&&(!rl.po||!r.po||r.po===rl.po));o.share=rs.reduce((s,r)=>s+r.share,0);const shippedQ=rs.reduce((s,r)=>s+r.q,0)||q;o.costInfo=shipCostInfo(sh);o.freight=o.costInfo.gbp*o.share/shippedQ;o.uk=ukCostsGbp(sh)*o.share/shippedQ;o.basis=fs.basis;o.basisLabel=fs.label;o.warn=fs.warn}
 const vs=ctx.valueShare!=null?ctx.valueShare:1;o.valueShare=vs;o.uk+=(+ctx.ukGbp||0)*vs/q;o.duty=(+ctx.dutyGbp||0)*(ctx.dutyShare!=null?ctx.dutyShare:vs)/q;o.vat=ctx.vatApplies?(+ctx.vatGbp||0)*vs/q:0;
 o.total=r2(o.goods+o.fee+o.extras+o.freight+o.uk+o.duty+o.vat);return o}
function landedFor(rl,ctx){return landedParts(rl,ctx).total}
/* shares of a receipt's goods value (UK costs, import VAT) and of its duty base (goods × duty %) per line */
function receiptShares(lines){const val=l=>{const po=D.purchases.find(p=>p.no===l.po);const pl=(po?.lines||[]).find(x=>x.sku===l.sku);const r=po?rateOn(po.date,po.cur):1;return(+pl?.u||0)*(+l.q||0)*(r||0)};const vals=lines.map(val);const tv=vals.reduce((s,v)=>s+v,0);const qs=lines.map(l=>+l.q||0);const tq=qs.reduce((s,v)=>s+v,0);
 const dv=lines.map((l,i)=>{const pr=product(l.sku);const dp=pr?.dutyPct!=null&&pr.dutyPct!==""?+pr.dutyPct:FEES().dutyDefaultPct;return vals[i]*dp/100});const td=dv.reduce((s,v)=>s+v,0);const vsh=i=>tv>0?vals[i]/tv:(tq?qs[i]/tq:0);return lines.map((l,i)=>({valueShare:vsh(i),dutyShare:td>0?dv[i]/td:vsh(i)}))}
/* landed parts for every line of a receipt (Receive form, receipt drawer and the automatic recalculation all use this) */
function receiptLanded(r,lines){lines=(lines||r.lines||[]).filter(l=>l.sku);const sh=D.shipments.find(s=>s.no===r.src)||null;const comp=company(D.purchases.find(p=>p.no===lines[0]?.po)?.account||D.purchases.find(p=>p.no===r.src)?.account);const vatApplies=!!comp&&!comp.vatRegistered;const sh_=sh;const shares=receiptShares(lines);
 return lines.map((l,i)=>landedParts({sku:l.sku,po:l.po,q:+l.q||0},{shipment:sh_,dutyGbp:r.dutyGbp,vatGbp:r.vatGbp,ukGbp:r.ukExtraGbp,vatApplies,valueShare:shares[i].valueShare,dutyShare:shares[i].dutyShare}))}
/* the working of one landed figure, with the actual numbers */
function landedHow(lp){const po=lp.po,pl=lp.pl;const rows=[];
 rows.push(`Goods ${po&&pl?`${esc(fmt(pl.u,po.cur))} × ${lp.rate==null?"<b>no "+esc(po.cur)+" rate</b>":num(lp.rate,5)} (${esc(po.cur)} rate on the order date ${fmtD(po.date)})${lp.exVat?" ÷ (1 + VAT, the PI price included VAT)":""}`:"(no PI line)"} = ${gbp2(lp.goods)}`);
 if(lp.fee)rows.push(`+ China fee ${num(lp.feePct,1)}% = ${gbp2(lp.fee)}`);if(lp.extras)rows.push(`+ share of the PI extra lines${lp.viaExtra?` (incl. ${esc(fmt(lp.viaExtra,po?.cur))} billed on another order's invoice)`:""} = ${gbp2(lp.extras)}`);if(lp.othersSum)rows.push(`<small class="status">${esc(fmt(lp.othersSum,po?.cur))} on this invoice is for something else — not in this cost</small>`);
 if(lp.costInfo){rows.push(`+ freight: ${gbp2(lp.costInfo.gbp)} (${lp.costInfo.actual?"actual £ paid":"estimated at the rate"}) × ${num(lp.share*100,1)}% share by ${esc(lp.basisLabel)} ÷ packs on the line = ${gbp2(lp.freight)}`);if(lp.warn)rows.push(`<span class="err">⚠ ${esc(lp.warn)}</span>`)}
 if(lp.uk)rows.push(`+ UK-side costs share = ${gbp2(lp.uk)}`);if(lp.duty)rows.push(`+ duty share = ${gbp2(lp.duty)}`);if(lp.vat)rows.push(`+ import VAT share (company not VAT-registered) = ${gbp2(lp.vat)}`);
 rows.push(`<b>= ${gbp2(lp.total)} landed per pack</b>`);return rows.join("<br>")}
function moveEffect(m){const e=item("moveType",m.type)?.effect||{transfer:"transfer",quarantine:"transfer",sold:"out",return:"in",opening:"in",adjust:"adjust",count:"adjust",allocate:"allocate"}[m.type]||"out";return e==="count"?"adjust":e}
const retCond=c=>c?(item("returnCondition",c)||items("returnCondition",{all:true}).find(i=>norm(i.label)===norm(c))):null;
function stockOf(sku){const batches=[];live(D.receipts).forEach(r=>(r.lines||[]).filter(l=>l.sku===sku).forEach(l=>batches.push({batch:l.batch||r.no,date:r.date,loc:l.loc,q:+l.q||0,left:+l.q||0,cost:+l.landed||0,po:l.po,src:r.no})));
 const take=(need,from)=>{for(const b of batches){if(need<=0)break;if(b.left<=0||(from&&b.loc!==from))continue;const t=Math.min(b.left,need);b.left-=t;need-=t}return need};
 live(D.moves).filter(m=>m.sku===sku).sort((a,b)=>(a.date||"")<(b.date||"")?-1:(a.date||"")>(b.date||"")?1:0).forEach(m=>{const eff=moveEffect(m);const q=+m.qty||0;if(eff==="in"){const rc=m.type==="return"?retCond(m.condition):null;if(rc?.noStock)return;const to=m.type==="return"&&rc?.toLoc&&!m.to?rc.toLoc:m.to;batches.push({batch:m.no,date:m.date,loc:to,q,left:q,cost:rc?.cost0?0:(+m.costGbp||batches[batches.length-1]?.cost||0),po:null,src:m.no})}else if(eff==="out"){if(q<=0)return;let need=take(q,m.from);if(need>0&&m.from)take(need,null)}else if(eff==="transfer"){if(q<=0)return;let need=q;for(const b of batches.slice()){if(need<=0)break;if(b.left<=0||b.loc!==m.from)continue;const t=Math.min(b.left,need);b.left-=t;need-=t;batches.push({...b,loc:m.to,q:t,left:t,moved:m.no})}}else if(eff==="adjust"){if(q>=0)batches.push({batch:m.no,date:m.date,loc:m.to||m.from,q,left:q,cost:batches[batches.length-1]?.cost||0,po:null,src:m.no});else take(-q,m.from||m.to)}});
 /* damaged / quarantine locations hold stock that is not sellable: kept out of "in hand" and stock value, shown separately */
 const byLoc={};let onHand=0,value=0,qQty=0,qVal=0;batches.forEach(b=>{if(b.left>0){byLoc[b.loc]=(byLoc[b.loc]||0)+b.left;if(isQuarLoc(b.loc)){qQty+=b.left;qVal+=b.left*b.cost}else{onHand+=b.left;value+=b.left*b.cost}}});
 const alloc={};live(D.moves).filter(m=>m.sku===sku&&moveEffect(m)==="allocate").forEach(m=>{alloc[m.channel]=(alloc[m.channel]||0)+(+m.qty||0)});
 const recvFor=(src,po,s)=>live(D.receipts).filter(r=>r.src===src).reduce((a,r)=>a+(r.lines||[]).filter(l=>l.sku===s&&(!po||!l.po||l.po===po)).reduce((x,l)=>x+(+l.q||0),0),0);
 /* in transit = shipped on open shipments minus what has been received from that shipment, per order line */
 let transit=0;live(D.shipments).filter(s=>!["delivered","cancelled"].includes(s.status)).forEach(sh=>{const ls=shipLinesExpanded(sh).filter(l=>l.sku===sku);const pos=[...new Set(ls.map(l=>l.po||""))];pos.forEach(po=>{const q=ls.filter(l=>(l.po||"")===po).reduce((a,l)=>a+(+l.q||0),0);transit+=Math.max(0,q-recvFor(sh.no,po,sku))})});
 /* on order = ordered on open stock POs that contain this SKU, minus shipped (any shipment) and minus received directly (UK purchases) */
 let onOrder=0;const onOrderPOs=[];live(D.purchases).filter(p=>!["received","closed","cancelled"].includes(p.status)&&item("purchaseKind",p.kind)?.stock!==false&&(p.lines||[]).some(l=>l.sku===sku)).forEach(p=>{const q=(p.lines||[]).filter(l=>l.sku===sku).reduce((a,l)=>a+(+l.q||0),0);const shipped=poShipments(p.no).reduce((a,sh)=>a+shipLinesExpanded(sh).filter(l=>l.po===p.no&&l.sku===sku).reduce((x,l)=>x+(+l.q||0),0),0);const direct=recvFor(p.no,p.no,sku);const left=Math.max(0,q-shipped-direct);if(left>0){onOrder+=left;onOrderPOs.push({no:p.no,q:left})}});
 const since=addDays(today(),-90);const sold=live(D.moves).filter(m=>m.sku===sku&&m.type==="sold"&&(m.date||"")>=since).reduce((s,m)=>s+(+m.qty||0),0);const vi=velocityInfo(sku,sold);const velocity=vi.v;
 const open=batches.filter(b=>b.left>0&&!isQuarLoc(b.loc));const costs=open.map(b=>b.cost).filter(c=>c>0);const alert=costs.length>1&&(Math.max(...costs)-Math.min(...costs))/Math.min(...costs)*100>FEES().batchAlertPct;
 return{onHand,byLoc,alloc,transit,onOrder:Math.max(0,onOrder),onOrderPOs,batches,open,avgCost:onHand?value/onHand:(costs[0]||0),value:r2(value),quarantine:qQty,quarantineValue:r2(qVal),sold90:sold,velocity,velText:vi.text,alert}}
/* a location whose stock is not sellable: flagged "quarantine" in Setup › Locations (DMG and names with damaged / quarantine by default) */
function isQuarLoc(id){const l=loc(id);if(l&&l.quarantine!=null&&l.quarantine!=="")return l.quarantine===true||l.quarantine==="true";return id==="DMG"||/damag|quarant/i.test(l?.name||"")}
/* the working behind stock value / average cost: open sellable batches, left × cost */
function stockHow(st){const parts=st.open.filter(b=>b.left>0).map(b=>`${num(b.left)} × ${gbp2(b.cost)}`);return`${parts.length?parts.join(" + ")+" = "+gbp2(st.value):"no sellable stock"}${st.onHand?` → average ${gbp2(st.avgCost)} per pack (${gbp2(st.value)} ÷ ${num(st.onHand)} packs)`:""}${st.quarantine?`<br>Not included: ${num(st.quarantine)} damaged / quarantine pack${st.quarantine===1?"":"s"} (${gbp2(st.quarantineValue)})`:""}<br>Batches are used first in, first out; transfers keep the batch cost.`}
/* ---------- sales speed from imported Amazon reports (collection salesStats, written by importer.js) — used only when the SKU has no Sold moves in the last 90 days ---------- */
function velocityStats(sku){const st=live(D.salesStats||[]).filter(s=>s.sku===sku&&s.type!=="fees"&&s.from&&s.to&&(+s.units||0)>0&&diffDays(s.to,today())<=180);if(!st.length)return{v:0,rows:[]};const by={};st.forEach(s=>{const k=s.marketplace||"";if(!by[k]||s.to>by[k].to)by[k]=s});const rows=Object.values(by);return{v:rows.reduce((a,s)=>a+(+s.units||0)/Math.max(1,diffDays(s.from,s.to)+1),0),rows}}
function velocityFromStats(sku){return velocityStats(sku).v}
/* sales per day and where it comes from: override on the product, else Sold moves of the last 90 days, else the latest imported Amazon report per marketplace */
function velocityInfo(sku,sold){const p=product(sku);if(+p?.velocityOverride)return{v:+p.velocityOverride,text:`${num(p.velocityOverride,2)}/day — typed on the product (override)`};if(sold>0)return{v:sold/90,text:`${num(sold)} sold in the last 90 days ÷ 90 = ${num(sold/90,2)}/day`};const vs=velocityStats(sku);if(vs.v>0)return{v:vs.v,text:`no Sold moves in 90 days — from imported Amazon reports: ${vs.rows.map(s=>`${num(s.units)} units ${fmtD(s.from)}–${fmtD(s.to)}${s.marketplace?" ("+(L("marketplace",s.marketplace)||s.marketplace)+")":""}`).join(" + ")} = ${num(vs.v,2)}/day`};return{v:0,text:"no sales in the last 90 days and no imported sales report"}}
function reorderInfo(sku){const p=product(sku);if(!p)return{};const st=stockOf(sku);const cycle=+p.cycleDays||DEF().cycleDays;const safety=+p.safetyDays||DEF().safetyDays;const sup=(p.suppliers||[])[0];const supLead=+party(sup?.party)?.leadDays||DEF().leadDays;const md=item("mode",p.defaultMode||DEF().mode);const modeDays=md?.days||30;const lead=supLead+modeDays;const total=st.onHand+st.transit+st.onOrder;const v=st.velocity;const daysLeft=v>0?total/v:null;const reorderIn=daysLeft==null?null:Math.round(daysLeft-lead-safety);const moq=+sup?.moq||0;const cyc=v>0?Math.ceil(v*cycle):0;const qty=Math.max(moq,cyc);
 const howT=`Sales speed: ${esc(st.velText)}<br>Lead time = supplier ${num(supLead)} d${sup?.party?" ("+esc(pname(sup.party))+")":""} + ${esc(md?.label||"freight")} ${num(modeDays)} d = <b>${num(lead)} d</b><br>Days of stock = (in hand ${num(st.onHand)} + in transit ${num(st.transit)} + on order ${num(st.onOrder)}${st.onOrderPOs.length?" ["+st.onOrderPOs.map(x=>`${x.no} ${num(x.q)}`).join(", ")+"]":""}) ÷ ${num(v,2)}/day = <b>${daysLeft==null?"—":num(daysLeft)+" d"}</b>${reorderIn!=null?`<br>Reorder in = ${num(daysLeft)} − lead ${num(lead)} − safety ${num(safety)} = <b>${num(reorderIn)} d</b>`:""}<br>Suggested qty = max(MOQ ${num(moq)}, ${num(v,2)}/day × cycle ${num(cycle)} d = ${num(cyc)}) = <b>${num(qty)} packs</b>${st.quarantine?`<br>${num(st.quarantine)} damaged / quarantine packs are not counted as in hand`:""}`;
 return{total,daysLeft,reorderIn,qty,lead,supLead,modeDays,safety,cycle,moq,velocity:v,out:total===0&&v>0,how:howT}}
function matchOf(ref,amountGbp,excludeNo){const p=D.purchases.find(x=>x.no===ref),s=D.shipments.find(x=>x.no===ref),i=D.inspections.find(x=>x.no===ref),c=D.credits.find(x=>x.no===ref),rc=D.receipts.find(x=>x.no===ref);let tot=null,cur=null,date=today();if(p){tot=poTotal(p);cur=p.cur;date=p.date}else if(s){tot=+s.cost||0;cur=s.costCur||"USD";date=s.dispatch||s.date}else if(i){tot=+i.fee||0;cur=i.cur||"USD";date=i.date}else if(c){tot=+c.amount||0;cur=c.cur}else if(rc){tot=(+rc.dutyGbp||0)+(+rc.vatGbp||0)+(+rc.ukExtraGbp||0);cur="GBP";date=rc.date}
 if(!tot)return{pct:null,text:"No total on this reference — saved without match"};const tg=toGbp(tot,cur,date);const before=paysFor(ref).filter(x=>x.no!==excludeNo).reduce((a,x)=>a+toGbp(allocAmount(x,ref),x.cur,x.date),0);const share=amountGbp/tg,rest=Math.max(0,1-before/tg);
 const T=[[1,"full amount"],[.3,"30% deposit"],[.5,"50%"],[.7,"70% balance"],[.2,"20% final"]];if(before>0&&rest>0.01)T.push([rest,"remaining balance"]);const best=T.reduce((a,t)=>Math.abs(share-t[0])/Math.max(t[0],.01)<Math.abs(share-a[0])/Math.max(a[0],.01)?t:a);const close=Math.max(0,1-Math.abs(share-best[0])/Math.max(best[0],.01));
 const looks=close>=.8?` → looks like ${best[1]}`:close>=.5?` → near ${best[1]}?`:` → does not match a usual milestone — check amount`;return{pct:Math.round(close*100)/100,text:`${(share*100).toFixed(1).replace(/\.0$/,"")}% of ${fmt(tot,cur)}${looks}`,share}}
function payCheck(p){if(p.status==="cancelled")return["Not counted","p-mute"];if(["failed","reversed"].includes(p.status))return[L("payStatus",p.status),"p-bad"];if(p.status==="refunded")return["Refunded","p-warn"];if(p.status==="pending"||(p.needsApproval&&!p.approved))return["Needs approval","p-warn"];if(!p.docs?.receipt&&!p.receipt&&!p.receiptAsset)return["No receipt","p-bad"];if(p.paidBy&&p.paidBy!=="company")return[L("paidBy",p.paidBy),"p-warn"];if(p.match!=null&&p.match<.9)return["Check match","p-warn"];return["OK","p-ok"]}
function relatedDocs(col,id){const out=[];const add=(c,x,why)=>{if(x&&!out.some(o=>o.col===c&&o.id===(x.no||x.id)))out.push({col:c,id:x.no||x.id,why,x})};/* every payment that names this document, counted or not (the label says which) */const relPays=(ref,why)=>live(D.payments).filter(p=>(p.allocations||[]).some(a=>a.ref===ref)).forEach(p=>add("payments",p,isCounted(p)?why:`${why} — not counted (${payWhyNot(p)})`));
 if(col==="purchases"){live(D.shipments).filter(s=>(s.lines||[]).some(l=>l.po===id)||(s.purchases||[]).includes(id)).forEach(s=>add("shipments",s,"shipment"));relPays(id,"payment");live(D.credits).filter(c=>c.po===id).forEach(c=>relPays(c.no,"via "+c.no));live(D.inspections).filter(i=>i.po===id).forEach(i=>add("inspections",i,"inspection"));live(D.receipts).filter(r=>(r.pos||[]).includes(id)).forEach(r=>add("receipts",r,"receipt"));live(D.credits).filter(c=>c.po===id).forEach(c=>add("credits",c,"credit note"))}
 if(col==="shipments"){const s=D.shipments.find(x=>x.no===id);[...new Set([...(s?.lines||[]).map(l=>l.po),...(s?.purchases||[])])].forEach(no=>add("purchases",D.purchases.find(p=>p.no===no),"order"));relPays(id,"freight payment");live(D.receipts).filter(r=>r.src===id).forEach(r=>add("receipts",r,"receipt"))}
 if(col==="payments"){const p=D.payments.find(x=>x.no===id);(p?.allocations||[]).forEach(a=>{add("purchases",D.purchases.find(x=>x.no===a.ref),"for");add("shipments",D.shipments.find(x=>x.no===a.ref),"for");add("inspections",D.inspections.find(x=>x.no===a.ref),"for");add("credits",D.credits.find(x=>x.no===a.ref),"for");add("receipts",D.receipts.find(x=>x.no===a.ref),"for");add("moves",D.moves.find(x=>x.no===a.ref),"for")});live(D.payments).filter(x=>x.refundOf===id).forEach(x=>add("payments",x,"refund"));if(p?.refundOf)add("payments",D.payments.find(x=>x.no===p.refundOf),"refund of")}
 if(col==="inspections"){const i=D.inspections.find(x=>x.no===id);add("purchases",D.purchases.find(p=>p.no===i?.po),"order");relPays(id,"fee payment");if(i?.reInspectionOf)add("inspections",D.inspections.find(x=>x.no===i.reInspectionOf),"re-inspection of")}
 if(col==="receipts"){const r=D.receipts.find(x=>x.no===id);add("shipments",D.shipments.find(s=>s.no===r?.src),"shipment");(r?.pos||[]).forEach(no=>add("purchases",D.purchases.find(p=>p.no===no),"order"));live(D.moves).filter(m=>m.receipt===id).forEach(m=>add("moves",m,"auto move"));if(r?.claim?.credit)add("credits",D.credits.find(c=>c.no===r.claim.credit),"credit")}
 if(col==="moves"){const m=D.moves.find(x=>x.no===id);if(m?.receipt)add("receipts",D.receipts.find(r=>r.no===m.receipt),"receipt");if(m?.import)add("imports",D.imports.find(i=>i.no===m.import),"import");if(m?.sku)add("products",product(m.sku),"product");relPays(id,"courier payment")}
 if(col==="credits"){const c=D.credits.find(x=>x.no===id);add("purchases",D.purchases.find(p=>p.no===c?.po),"order");add("receipts",D.receipts.find(r=>r.no===c?.receipt),"receipt");relPays(id,"applied")}
 if(col==="products"){live(D.purchases).filter(p=>(p.lines||[]).some(l=>l.sku===id)).slice(-6).forEach(p=>add("purchases",p,"ordered"))}
 if(col==="parties"){live(D.purchases).filter(p=>p.party===id).slice(-5).forEach(p=>add("purchases",p,"order"));live(D.shipments).filter(s=>s.party===id).slice(-5).forEach(s=>add("shipments",s,"shipment"))}
 return out}

/* ---------- attention & calendar ---------- */
/* when the balance of an order without a payment schedule falls due: the ready date (UK: expected delivery), else order + lead time */
const unschedDue=p=>p.readyDate||p.expectedDelivery||addDays(p.date,+party(p.party)?.leadDays||DEF().leadDays);
function attention(){const out=[];const T=today();const rem=DEF().reminderDays||7;
 /* the same orders as the Calendar and Cash needed: every open order (legacy included) */
 dueScope().forEach(p=>{const st=poState(p);const kind=item("purchaseKind",p.kind)||{};if(p.hold)out.push({sev:3,text:`${p.no} on hold — inspection failed`,col:"purchases",id:p.no,d:T});const cov=msCoverage(p);
  (p.schedule||[]).forEach((m,i)=>{const c=cov[i];if(!c||c.covered)return;const di=dueInfo(p,m);const due=di.d;const late=diffDays(due,T);const left=r2(c.amount-c.got);const amt=`${fmt(left,p.cur)}${c.got>0.5?` (of ${fmt(c.amount,p.cur)})`:""}`;if(di.wait){out.push({sev:1,text:`${p.no} · ${m.label} ${m.pct}% · ${amt} — ${di.waitText}`,col:"purchases",id:p.no,d:T});return}if(late>=0)out.push({sev:late>7?3:2,text:`${p.no} · ${m.label} ${m.pct}% ${late?`overdue ${late} d`:"due today"} · ${amt}`,col:"purchases",id:p.no,d:due,act:{k:"pay",po:p.no,ms:i}});else if(-late<=rem)out.push({sev:1,text:`${p.no} · ${m.label} ${m.pct}% due ${fmtD(due)}${di.est?" (estimate)":""} · ${amt}`,col:"purchases",id:p.no,d:due,act:{k:"pay",po:p.no,ms:i}})});
  if(!(p.schedule||[]).length&&st.outstandingCur>0.5&&st.total>0){const due=unschedDue(p);if(diffDays(due,T)>=-rem)out.push({sev:diffDays(due,T)>0?2:1,text:`${p.no} · ${fmt(st.outstandingCur,p.cur)} still to pay · ${diffDays(due,T)>0?"overdue":"due "+fmtD(due)}`,col:"purchases",id:p.no,d:due,act:{k:"pay",po:p.no}})}
  /* "ready — not shipped" only for orders that travel by freight and still have packs at the supplier */
  if(!p.historic&&kind.freight!==false&&p.readyDate&&diffDays(p.readyDate,T)>=0&&!st.ship.length&&st.received<st.ordered&&!["shipped","part_shipped","part_received","received"].includes(p.status))out.push({sev:1,text:`${p.no} ready ${fmtD(p.readyDate)} — not shipped yet`,col:"purchases",id:p.no,d:p.readyDate});
  if(kind.freight===false&&kind.stock!==false&&st.ordered>0&&st.received<st.ordered&&p.expectedDelivery&&diffDays(p.expectedDelivery,T)>0)out.push({sev:2,text:`${p.no} · UK delivery overdue — expected ${fmtD(p.expectedDelivery)}`,col:"purchases",id:p.no,d:p.expectedDelivery,act:{k:"receivepo",po:p.no}});
  if(st.owedToUs>0.5)out.push({sev:1,text:`${p.no} · ${pname(p.party)} owes us ${fmt(st.owedToUs,p.cur)} (overpaid / credit) — refund or deduct from the next payment`,col:"purchases",id:p.no,d:T});
  if(!p.historic&&(p.lines||[]).some(l=>!l.sku))out.push({sev:0,text:`${p.no} · ${(p.lines||[]).filter(l=>!l.sku).length} line(s) without a product`,col:"purchases",id:p.no,d:T})});
 curNoRate().forEach(c=>out.push({sev:2,text:`${c} is in use but has no exchange rate — add it in Setup › Rates (nothing in ${c} is converted to £ until then)`,view:"setup",tab:"rates",d:T}));
 live(D.shipments).forEach(s=>{if(["delivered","cancelled"].includes(s.status))return;if(s.status==="arrived"||s.status==="part_delivered")out.push({sev:2,text:`${s.no} arrived — receive stock`,col:"shipments",id:s.no,d:s.arrival||T,act:{k:"receive",sh:s.no}});else if(s.eta&&diffDays(s.eta,T)>0)out.push({sev:2,text:`${s.no} late — ETA was ${fmtD(s.eta)}`,col:"shipments",id:s.no,d:s.eta,act:{k:"arrive",sh:s.no}});else if(s.eta&&diffDays(s.eta,T)>=-2)out.push({sev:1,text:`${s.no} due ${fmtD(s.eta)}`,col:"shipments",id:s.no,d:s.eta});if(!s.historic&&!(s.lines||[]).length&&!(s.purchases||[]).length)out.push({sev:0,text:`${s.no} has no orders linked`,col:"shipments",id:s.no,d:s.date||T})});
 live(D.payments).forEach(p=>{if(p.status==="pending"||(p.needsApproval&&!p.approved))out.push({sev:2,text:`${p.no} pending approval · ${fmt(p.amount,p.cur)} to ${pname(p.party)}`,col:"payments",id:p.no,d:p.date});else if(p.status==="paid"&&!p.docs?.receipt&&!p.receipt&&!p.receiptAsset&&!p.historic)out.push({sev:1,text:`${p.no} paid without receipt · ${fmt(p.amount,p.cur)}`,col:"payments",id:p.no,d:p.date})});
 live(D.inspections).filter(i=>i.result==="pending"&&i.plannedDate&&diffDays(i.plannedDate,T)>=0).forEach(i=>out.push({sev:1,text:`${i.no} inspection planned ${fmtD(i.plannedDate)} — result?`,col:"inspections",id:i.no,d:i.plannedDate}));
 live(D.products).filter(p=>item("productStatus",p.status)?.sellable!==false).forEach(p=>{const r=reorderInfo(p.sku);if(r.out)out.push({sev:3,text:`${p.name} out of stock — reorder now`,col:"products",id:p.sku,d:T,act:{k:"reorder",sku:p.sku}});else if(r.reorderIn!=null&&r.reorderIn<=(DEF().reorderWarnDays||30))out.push({sev:r.reorderIn<=0?2:1,text:`${p.name} · reorder ${r.reorderIn<=0?"now":"in "+r.reorderIn+" d"} · ${Math.round(r.daysLeft)} d of stock`,col:"products",id:p.sku,d:addDays(T,Math.max(0,r.reorderIn)),act:{k:"reorder",sku:p.sku}})});
 const rd=latestRate().date;if(rd&&diffDays(rd,T)>45)out.push({sev:1,text:`Exchange rates are ${diffDays(rd,T)} days old — update in Setup › Rates`,view:"setup",tab:"rates",d:T});
 owedToPeople().filter(o=>o.gbp>0.5).forEach(o=>out.push({sev:1,text:`${o.name} is owed ${gbp(o.gbp)} — paid personally, not yet reimbursed`,view:"reports",d:o.last||T}));
 return out.sort((a,b)=>(b.sev-a.sev)||((a.d||"")<(b.d||"")?-1:1))}
/* money owed to people: payments paid personally (paidBy person) minus reimbursement payments to that person; legacy history is ignored */
function owedToPeople(){const m={};const add=(id,g,d)=>{if(!id)return;const o=m[id]=m[id]||{id,name:person(id)?.name||id,paid:0,back:0,gbp:0,last:""};if(g>0)o.paid+=g;else o.back+=-g;o.gbp=r2(o.paid-o.back);if((d||"")>o.last)o.last=d||""};
 live(D.payments).filter(p=>p.status==="paid"&&!p.historic).forEach(p=>{const g=p.gbpActual!=null&&p.gbpActual!==""?+p.gbpActual:+p.gbp||toGbp(p.amount,p.cur,p.date);if(p.paidBy==="person"&&p.person&&p.type!=="reimburse")add(p.person,g,p.date);if(p.type==="reimburse"&&(p.person||p.reimburseTo))add(p.person||p.reimburseTo,-g,p.date)});
 return Object.values(m).sort((a,b)=>b.gbp-a.gbp)}
function calEvents(from,to){const ev=[];const inR=d=>d&&d>=from&&d<=to;
 dueScope().forEach(p=>{const st=poState(p);const kind=item("purchaseKind",p.kind)||{};const cov=msCoverage(p);(p.schedule||[]).forEach((m,i)=>{const di=dueInfo(p,m);const d=di.d;const c=cov[i];if(inR(d))ev.push({d,t:"due",col:"purchases",id:p.no,ms:i,text:`${m.pct}% ${m.label} · ${p.no}${c?.covered?" ✓":""}${di.est&&!c?.covered?" (est.)":""}`,done:!!c?.covered,amtCur:c?r2(c.amount-c.got):0,cur:p.cur})});
  /* an order without a schedule still shows its balance on the day it falls due (same rule as Cash needed and alerts) */
  if(!(p.schedule||[]).length&&st.total>0&&st.outstandingCur>0.5){const d=unschedDue(p);if(inR(d))ev.push({d,t:"due",col:"purchases",id:p.no,text:`${fmt(st.outstandingCur,p.cur)} to pay · ${p.no}`,done:false,amtCur:st.outstandingCur,cur:p.cur})}
  if(kind.freight!==false&&!st.ship.length&&st.received<st.ordered){const rd=p.readyDate||addDays(p.date,+party(p.party)?.leadDays||DEF().leadDays);if(inR(rd))ev.push({d:rd,t:"ready",col:"purchases",id:p.no,text:`Ready · ${p.no}`})}
  if(kind.freight===false&&inR(p.expectedDelivery))ev.push({d:p.expectedDelivery,t:"eta",col:"purchases",id:p.no,text:`UK delivery · ${p.no}`,done:st.ordered>0&&st.received>=st.ordered})});
 live(D.shipments).filter(s=>s.status!=="cancelled").forEach(s=>{if(inR(s.eta))ev.push({d:s.eta,t:"eta",col:"shipments",id:s.no,text:`ETA · ${s.no} · ${pname(s.party)}`,done:["delivered","arrived"].includes(s.status)});if(inR(s.dispatch))ev.push({d:s.dispatch,t:"ship",col:"shipments",id:s.no,text:`Dispatch · ${s.no}`});(s.destinations||[]).forEach(x=>{if(inR((x.slot||"").slice(0,10)))ev.push({d:x.slot.slice(0,10),t:"slot",col:"shipments",id:s.no,text:`Delivery slot ${locName(x.loc)} · ${s.no}`})})});
 live(D.inspections).forEach(i=>{if(inR(i.plannedDate))ev.push({d:i.plannedDate,t:"insp",col:"inspections",id:i.no,text:`Inspection · ${i.po}`,done:i.result!=="pending"})});
 live(D.payments).filter(p=>p.status==="paid").forEach(p=>{if(inR(p.date))ev.push({d:p.date,t:"paid",col:"payments",id:p.no,text:`Paid ${fmt(p.amount,p.cur)} · ${pname(p.party)}`,done:true})});
 live(D.products).filter(p=>item("productStatus",p.status)?.sellable!==false).forEach(p=>{const r=reorderInfo(p.sku);if(r.reorderIn!=null){const d=addDays(today(),Math.max(0,r.reorderIn));if(inR(d))ev.push({d,t:"reorder",col:"products",id:p.sku,text:`Reorder · ${p.name}`})}});
 return ev.sort((a,b)=>a.d<b.d?-1:1)}

/* ---------- writes, batches, undo ---------- */
function stamp(d){d.updatedAt=nowIso();d.updatedBy=uid||"local";if(!d.createdAt){d.createdAt=d.updatedAt;d.createdBy=d.updatedBy}return d}
/* A batch is one user action. Every write in it notes which orders / shipments / receipts / credit notes it affects ("touch");
   endBatch() then re-derives them through ONE function each (recomputePO, recomputeShipment, recomputeLanded, recomputeCredit) inside
   the same undo group, and every automatic change is logged with its reason. A single write outside a batch gets its own batch. */
const newTouch=()=>({po:new Set(),sh:new Set(),landed:new Set(),cn:new Set(),rc:new Set(),cost:{}});
function beginBatch(labelTxt){S.batch={label:labelTxt,entries:[],touch:newTouch()}}
async function endBatch(){const b=S.batch;if(!b)return;try{if(!b.noDerive)await reconcile(b)}catch(e){console.error("re-derive failed",e)}S.batch=null;
 if(b.entries.length&&!b.noUndo){S.undo.push({label:b.label,entries:b.entries});if(S.undo.length>40)S.undo.shift();S.redo=[];ls.set("undo",S.undo.slice(-20))}
 if(b.label&&b.entries.length>1)logEv("action",null,null,`${b.label} — ${b.entries.length} records changed together (one Undo)`)}
function pushUndo(entry){if(S.batch){if(!S.batch.noUndo)S.batch.entries.push(entry);return}S.undo.push({label:entry.label,entries:[entry]});if(S.undo.length>40)S.undo.shift();S.redo=[];ls.set("undo",S.undo.slice(-20))}
/* ---------- write guard: data that is plainly wrong is never saved; closed periods (Setup › Period lock) cannot be changed ---------- */
const GUARD_QUIET=new Set(["updatedAt","updatedBy","createdAt","createdBy","statusWhy","refText","folderName","landedAt","_k","fa"]);
const DOC_DATE={purchases:"date",payments:"date",shipments:"dispatch",receipts:"date",credits:"date",moves:"date",inspections:"date"};
function docDate(col,d){return d?(d[DOC_DATE[col]]||d.date||""):""}
function guardWrite(col,before,d,opts={}){try{if(before&&before._arch)return`${before.no||before.sku||before.id} is archived (${before._arch}) — read only. Setup › Backup › "Bring back ${before._arch}" to change it.`;if(!DOC_DATE[col]&&col!=="products"&&col!=="parties")return null;const who=d.no||d.sku||d.code||d.id;
 const badNum=(v,path)=>{if(typeof v==="number"&&!isFinite(v))return path;if(v&&typeof v==="object"){for(const[k,x]of Object.entries(v)){const r=badNum(x,path+"."+k);if(r)return r}}return null};
 const bn=badNum(d,"");if(bn)return`${who}: not saved — "${bn.slice(1)}" is not a number`;
 for(const k of ["date","dispatch","eta","readyDate","expectedDelivery","arrival","dueDate"]){const v=d[k];if(v!=null&&v!==""&&(!/^\d{4}-\d\d-\d\d$/.test(String(v))||isNaN(Date.parse(v))))return`${who}: not saved — ${k} "${v}" is not a real date`}
 if(col==="payments"){if(d.status==="paid"&&!(+d.amount>0))return`${who}: not saved — a paid payment needs an amount above 0`;const al=(d.allocations||[]).reduce((a,x)=>a+(+x.amount||0),0);if(al>(+d.amount||0)+0.01&&!d.deletedAt)return`${who}: not saved — the split (${num(al,2)}) is more than the payment (${num(d.amount,2)})`}
 if(Array.isArray(d.lines))for(const l of d.lines){if((+l.q||0)<0&&col!=="moves")return`${who}: not saved — line ${l.sku||l.p||""} has a negative quantity`}
 /* period lock */const lk=SET().lockDate;if(lk&&!opts.derived&&!S.unlocked&&DOC_DATE[col]){const old=docDate(col,before),nw=docDate(col,d);const inLock=(old&&old<=lk)||(nw&&nw<=lk);if(inLock){const keys=[...new Set([...Object.keys(before||{}),...Object.keys(d||{})])].filter(k=>!GUARD_QUIET.has(k)&&!(k==="status"&&(col==="purchases"||col==="shipments"))&&JSON.stringify(before?.[k]??null)!==JSON.stringify(d?.[k]??null));if(keys.length)return`${who}: not saved — dated on or before ${fmtD(lk)}, which is locked (Setup › Period lock). The owner can unlock it for this session.`}}
 return null}catch(e){console.warn(e);return null}}
async function rawSet(col,id,data){if(!db)throw new Error("no db");await db.collection(col).doc(id).set(data);const arr=D[col];if(arr){const i=arr.findIndex(x=>x.id===id);if(i>=0)arr[i]=data;else arr.push(data)}}
async function rawDelete(col,id){await db.collection(col).doc(id).delete();const arr=D[col];if(arr){const i=arr.findIndex(x=>x.id===id);if(i>=0)arr.splice(i,1)}}
const DERIVE_COLS=new Set(["purchases","shipments","payments","receipts","credits","inspections","products"]);
const autoBatch=(col,opts)=>!S.batch&&!opts.noUndo&&!opts.derived&&!opts._solo&&DERIVE_COLS.has(col);
async function soloBatch(label,fn,labelTxt,opts){beginBatch(label);let ok=false;try{ok=await fn()}finally{await endBatch()}if(ok&&labelTxt&&!opts.quiet)toast(labelTxt,{undo:true});render();return ok}
async function writeDoc(col,id,data,labelTxt,opts={}){if(autoBatch(col,opts))return soloBatch(labelTxt||`${id} saved`,()=>writeDoc(col,id,data,labelTxt,{...opts,_solo:true}),labelTxt,opts);
 const before=D[col]?.find(x=>x.id===id);const d=stamp(before?{...data,id}:(({createdAt,createdBy,...rest})=>({...rest,id}))(data));/* a new record always gets its own maker + time (its identity), even when copied from another */{const ge=guardWrite(col,before,d,opts);if(ge){toast(ge,{ms:7000});return false}}try{await rawSet(col,id,d);if(!before&&d.no)await bumpCounter(col,d.no);if(!opts.noUndo)pushUndo({label:labelTxt||`${id} saved`,col,id,before:before?{...before}:null,after:d});if(!opts.derived)noteTouch(col,before,d);
  logEv(before?"update":"create",col,id,opts.derived?labelTxt:[labelTxt,before?diffSummary(col,before,d):createdSummary(col,d)].filter(Boolean).join(" · "));if(!S.batch&&labelTxt)toast(labelTxt,{undo:!opts.noUndo});render();return true}catch(e){console.error(e);S.err="Could not save — "+(e.message||"try again");toast("Could not save — try again");return false}}
async function updateDoc(col,id,patch,labelTxt,opts={}){if(autoBatch(col,opts))return soloBatch(labelTxt||`${id} updated`,()=>updateDoc(col,id,patch,labelTxt,{...opts,_solo:true}),labelTxt,opts);
 const cur=D[col]?.find(x=>x.id===id);if(!cur){return false}const d=stamp({...cur,...patch});{const ge=guardWrite(col,cur,d,opts);if(ge){toast(ge,{ms:7000});return false}}try{await rawSet(col,id,d);if(!opts.noUndo)pushUndo({label:labelTxt||`${id} updated`,col,id,before:{...cur},after:d});if(!opts.derived)noteTouch(col,cur,d);
  logEv("update",col,id,opts.derived?labelTxt:[labelTxt,diffSummary(col,cur,d)].filter(Boolean).join(" · "));if(!S.batch&&labelTxt&&!opts.quiet)toast(labelTxt,{undo:!opts.noUndo});render();return true}catch(e){console.error(e);toast("Could not save — try again");return false}}
/* ---------- human-readable before → after for the activity log ---------- */
const DIFF_SKIP=new Set(["updatedAt","updatedBy","createdAt","createdBy","id","statusWhy","refText","folderName","landedAt","_k","fa"]);
const STATUS_LIST={purchases:"poStatus",shipments:"shipStatus",payments:"payStatus",credits:"creditStatus",products:"productStatus",inspections:"inspResult"};
function shortVal(col,k,v){if(v==null||v==="")return"—";if(k==="status"||(col==="inspections"&&k==="result"))return L(STATUS_LIST[col]||"",v)||String(v);if(k==="party"||k==="paidVia")return pname(v);if(k==="lines"&&Array.isArray(v))return`${num(v.reduce((s,l)=>s+(+l.q||0),0))} packs on ${v.length} line${v.length===1?"":"s"}`;if(k==="allocations"&&Array.isArray(v))return v.map(a=>`${a.ref} ${num(a.amount,2)}`).join(" + ")||"none";if(k==="schedule"&&Array.isArray(v))return v.map(m=>`${m.pct}%${m.paid?" ✓"+m.paid:""}`).join(" / ");if(typeof v==="boolean")return v?"yes":"no";if(Array.isArray(v))return`${v.length} item${v.length===1?"":"s"}`;if(typeof v==="object")return k==="writtenOff"?`${num(v.amount,2)} written off`:"(changed)";const s=String(v);return s.length>40?s.slice(0,40)+"…":s}
function diffSummary(col,a,b){const keys=[...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].filter(k=>!DIFF_SKIP.has(k));const ch=keys.filter(k=>JSON.stringify(a?.[k]??null)!==JSON.stringify(b?.[k]??null));if(!ch.length)return"no change";if(ch.includes("deletedAt"))return b?.deletedAt?"moved to Trash":"restored from Trash";const ord=[...ch.filter(k=>k==="status"),...ch.filter(k=>k!=="status")];return ord.slice(0,6).map(k=>`${k} ${shortVal(col,k,a?.[k])} → ${shortVal(col,k,b?.[k])}`).join(" · ")+(ord.length>6?` · +${ord.length-6} more`:"")}
function createdSummary(col,d){return"created · "+String(label(col,d)||d.no||d.id||"").slice(0,100)}
/* ---------- what a write affects ---------- */
function noteTouch(col,before,after){const b=S.batch;if(!b||!b.touch)return;const t=b.touch;const both=[before,after].filter(Boolean);const no=(after||before||{}).no||(after||before||{}).id;
 if(col==="purchases"){t.po.add(no);const sig=x=>x?JSON.stringify([x.lines,x.date,x.cur,x.extras,x.feePct,x.vatIncluded,x.account,!!x.deletedAt]):"";if(sig(before)!==sig(after)){live(D.shipments).filter(s=>(s.lines||[]).some(l=>l.po===no)||(s.purchases||[]).includes(no)).forEach(s=>t.landed.add(s.no));live(D.receipts).filter(r=>r.src===no).forEach(r=>t.rc.add(r.no))}
  /* charges on this invoice that belong to ANOTHER order: that order is re-derived too, with the reason logged */
  const viaOf=x=>{const m={};if(!x||x.deletedAt||x.status==="cancelled")return m;const sp=poSplit(x);sp.others.forEach(o=>{if(o.ref&&D.purchases.some(y=>y.no===o.ref))m[o.ref]=r2((m[o.ref]||0)+o.amount)});return m};const vb=viaOf(before),va=viaOf(after);
  new Set([...Object.keys(vb),...Object.keys(va)]).forEach(r=>{if(r===no||(vb[r]||0)===(va[r]||0))return;t.po.add(r);t.viaWhy=t.viaWhy||{};t.viaWhy[r]=`billed on ${no} invoice: ${fmt(vb[r]||0,(after||before).cur)} → ${fmt(va[r]||0,(after||before).cur)}`;live(D.receipts).filter(rc=>(rc.pos||[]).includes(r)||(rc.lines||[]).some(l=>l.po===r)).forEach(rc=>t.rc.add(rc.no))})}
 if(col==="shipments"){both.forEach(x=>{(x.lines||[]).forEach(l=>l.po&&t.po.add(l.po));(x.purchases||[]).forEach(n=>t.po.add(n))});t.sh.add(no);t.landed.add(no);const tot=x=>x?`${fmt((+x.cost||0)*(1+(+x.platformFeePct||0)/100)+(+x.insurance||0),x.costCur||"USD")}${ukCostsGbp(x)?" + UK "+gbp2(ukCostsGbp(x)):""}`:"";if(before&&after&&tot(before)!==tot(after))t.cost[no]=`freight ${tot(before)} → ${tot(after)}`}
 if(col==="payments"){both.forEach(x=>(x.allocations||[]).forEach(a=>{const r=a.ref;if(!r)return;if(D.purchases.some(p=>p.no===r))t.po.add(r);else if(D.shipments.some(s=>s.no===r)){t.sh.add(r);t.landed.add(r);const g=y=>y&&(y.allocations||[]).some(z=>z.ref===r)&&isCounted(y)?gbp2(allocGbp(y,r)):"not counted";if(g(before)!==g(after))t.cost[r]=`freight payment ${x.no} ${g(before)} → ${g(after)}`}else{const c=D.credits.find(c=>c.no===r);if(c){t.cn.add(c.no);if(c.po)t.po.add(c.po)}}}))}
 if(col==="receipts"){both.forEach(x=>{(x.pos||[]).forEach(n=>t.po.add(n));(x.lines||[]).forEach(l=>l.po&&t.po.add(l.po));if(x.src){if(D.shipments.some(s=>s.no===x.src))t.sh.add(x.src);else t.po.add(x.src)}})}
 if(col==="credits"){t.cn.add(no);both.forEach(x=>x.po&&t.po.add(x.po))}
 if(col==="inspections")both.forEach(x=>x.po&&t.po.add(x.po));
 if(col==="products"){const sig=x=>x?JSON.stringify([x.ctn,x.perCtn,x.dutyPct]):"";if(sig(before)!==sig(after))live(D.shipments).filter(s=>shipLinesExpanded(s).some(l=>l.sku===no)).forEach(s=>t.landed.add(s.no))}}
/* ---------- re-derive everything a batch touched ---------- */
async function derivedUpdate(col,id,patch,reason,why){return updateDoc(col,id,patch,`${reason}${why?` · after: ${why}`:""}`,{quiet:true,derived:true})}
async function reconcile(b){const t=b.touch;if(!t)return;const why=b.label||"";
 for(const no of [...t.cn])await recomputeCredit(no,why);
 for(const no of [...t.sh]){await recomputeShipment(no,why);const s=D.shipments.find(x=>x.no===no);if(s){(s.lines||[]).forEach(l=>l.po&&t.po.add(l.po));(s.purchases||[]).forEach(n=>t.po.add(n))}}
 for(const no of [...t.po]){live(D.credits).filter(c=>c.po===no&&!t.cn.has(c.no)).forEach(c=>t.cn.add(c.no))}
 for(const no of [...t.cn])await recomputeCredit(no,why);
 for(const no of [...t.po])await recomputePO(no,why);
 const rcs=new Set(t.rc);for(const sh of t.landed)live(D.receipts).filter(r=>r.src===sh).forEach(r=>rcs.add(r.no));
 for(const no of rcs){const r=D.receipts.find(x=>x.no===no);await recomputeLanded(no,why,r&&t.cost[r.src])}}
/* credit note: "applied" while a counted payment uses it, back to "open" when that payment stops counting */
async function recomputeCredit(no,why){const c=D.credits.find(x=>x.no===no);if(!c||c.deletedAt)return;const pays=paysFor(no);let status=c.status||"open",appliedTo=c.appliedTo||null;const viaPay=appliedTo&&D.payments.some(p=>p.no===appliedTo);
 if(pays.length){status="applied";appliedTo=pays[pays.length-1].no}else if(status==="applied"&&viaPay){status="open";appliedTo=null}
 if(status!==(c.status||"open")||appliedTo!==(c.appliedTo||null))await derivedUpdate("credits",no,{status,appliedTo},`credit ${L("creditStatus",c.status||"open")||c.status} → ${L("creditStatus",status)||status} (${pays.length?`used by ${appliedTo}`:`${c.appliedTo} no longer counted`})`,why)}
/* shipment status from its receipts (manual steps booked → arrived stay as set; cancelled stays cancelled) */
async function recomputeShipment(no,why){const s=D.shipments.find(x=>x.no===no);if(!s||s.deletedAt||s.status==="cancelled")return;const rcs=live(D.receipts).filter(r=>r.src===no).sort((a,b)=>(a.date||"")<(b.date||"")?-1:1);const got=rcs.reduce((a,r)=>a+(r.lines||[]).reduce((x,l)=>x+(+l.q||0),0),0);const exp=shipLinesExpanded(s).reduce((a,l)=>a+(+l.q||0),0);
 let status=s.status,reason="";if(got>0){status=exp>0&&got>=exp?"delivered":"part_delivered";reason=`${num(got)} of ${num(exp)} packs received (${rcs.map(r=>r.no).join(", ")})`}else if(["delivered","part_delivered"].includes(s.status)&&!s.historic){status="arrived";reason="no receipt on it any more"}
 const dests=(s.destinations||[]).map(x=>({...x,received:rcs.reduce((a,r)=>a+(r.lines||[]).filter(l=>l.loc===x.loc).reduce((y,l)=>y+(+l.q||0),0),0)}));const patch={};
 if(status!==s.status){patch.status=status;patch.statusWhy={text:reason,at:nowIso(),from:s.status}}if(got>0&&!s.arrival)patch.arrival=rcs[0].date;if(JSON.stringify(dests)!==JSON.stringify(s.destinations||[]))patch.destinations=dests;
 if(Object.keys(patch).length)await derivedUpdate("shipments",no,patch,patch.status?`status ${L("shipStatus",s.status)||s.status} → ${L("shipStatus",status)||status} (${reason})`:"received packs counted on the destinations",why)}
const poStep=id=>{const it=item("poStatus",id);return it?+it.step:-9};
/* the status an order should have from its data: logistics first (part shipped → shipped → part received → received), before shipping the
   money / inspection stage; auto-closes when fully received and paid (credits / write-off included) with no open claim */
function derivePO(p){const st=poState(p);const cur=p.status||"ordered";const kind=item("purchaseKind",p.kind)||{};const ins=live(D.inspections).filter(i=>i.po===p.no).sort((a,b)=>(a.date||a.plannedDate||"")<(b.date||b.plannedDate||"")?-1:1);
 if(["cancelled","draft"].includes(cur))return{status:cur,why:""};
 if(p.hold){const f=ins.filter(i=>item("inspResult",i.result)?.blocks).pop();return{status:"hold",why:`inspection ${f?.no||""} failed`.replace("  "," ")}}
 if(cur==="closed"&&(p.closedManually||p.writtenOff||p.historic))return{status:"closed",why:p.closeReason||"closed"};
 /* a shipment still "booked" has not left the supplier: it counts for what is left to book, not as shipped */const left_=st.ship.filter(x=>x.status!=="booked");const o=st.ordered,sh=left_.reduce((a,x)=>a+shipLinesExpanded(x).filter(l=>l.po===p.no).reduce((b,l)=>b+(+l.q||0),0),0),rc=st.received;const shN=left_.map(s=>s.no).join(", "),rcN=st.rec.map(r=>r.no).join(", ");const crQ=creditsFor(p.no).filter(c=>+c.shortQty>0);const credQ=crQ.reduce((s,c)=>s+(+c.shortQty||0),0);let s=null,why="";
 if(o>0){if(rc>0&&rc+credQ>=o){s="received";why=rc>=o?`all ${num(o)} packs received in ${rcN}`:`${num(rc)} received in ${rcN} + ${num(credQ)} credited on ${crQ.map(c=>c.no).join(", ")}`}
  else if(rc>0){s="part_received";why=`${num(rc)} of ${num(o)} packs received in ${rcN}`}
  else if(kind.freight!==false&&sh>=o){s="shipped";why=`all ${num(o)} packs shipped on ${shN}`}
  else if(kind.freight!==false&&sh>0){s="part_shipped";why=`${num(sh)} of ${num(o)} packs shipped on ${shN} — ${num(o-sh)} still at the supplier`}}
 else if(poStep(cur)>=poStep("part_shipped")){s=cur;why="kept — the order has no PI lines to count"}
 if(!s){const pay=st.total>0&&st.outstandingCur<=0.5?["production",`fully paid (${fmt(st.paidCur+st.credits+st.writtenOff,p.cur)} of ${fmt(st.total,p.cur)})`]:st.paidCur>0.5?["deposit",`${fmt(st.paidCur,p.cur)} of ${fmt(st.total,p.cur)} counted as paid`]:["ordered",st.total>0?"nothing counted as paid yet":"no PI total yet"];let best=pay;
  const ok=ins.filter(i=>i.result&&i.result!=="pending"&&!item("inspResult",i.result)?.blocks).pop();if(ok&&poStep("inspected")>poStep(best[0]))best=["inspected",`${ok.no} ${L("inspResult",ok.result)}`];
  if(p.stageManual&&poStep(p.stageManual)>poStep(best[0])&&poStep(p.stageManual)<poStep("part_shipped"))best=[p.stageManual,"set by hand"];s=best[0];why=best[1]}
 if(p.statusManual&&p.statusManual!=="closed"&&poStep(p.statusManual)>poStep(s)){s=p.statusManual;why="set by hand"}
 const openClaim=st.rec.some(r=>r.claim?.status==="raised");const settled=st.total>0&&Math.abs(st.balance)<=0.5;
 if(s==="received"&&settled&&!openClaim)return{status:"closed",why:`closed automatically: fully received and paid${st.credits?" (credit notes applied)":""}`,auto:true};
 if(s==="received"&&!settled)why+=st.owedToUs>0.5?` — not closed: ${pname(p.party)} owes us ${fmt(st.owedToUs,p.cur)}`:` — not closed: ${fmt(st.outstandingCur,p.cur)} still to pay`;else if(s==="received"&&openClaim)why+=" — not closed: a claim is still open";
 return{status:s,why}}
async function recomputePO(no,why){const p=D.purchases.find(x=>x.no===no);if(!p||p.deletedAt)return;const patch={};const notes=[];
 const cov=msCoverage(p);if(cov.length){const sched=(p.schedule||[]).map((m,i)=>({...m,paid:cov[i].paidBy||null}));const was=(p.schedule||[]).map(m=>m.paid||null);if(JSON.stringify(sched.map(m=>m.paid))!==JSON.stringify(was)){patch.schedule=sched;sched.forEach((m,i)=>{if(m.paid!==was[i])notes.push(`${m.label||"milestone"} ${m.paid?"paid by "+m.paid:"open again"}`)})}}
 const fsd=poShipments(no).map(s=>s.dispatch||s.date).filter(Boolean).sort()[0];if(fsd&&p.readyDate&&fsd<p.readyDate){patch.readyDate=fsd;notes.push(`goods ready ${fmtD(p.readyDate)} → ${fmtD(fsd)} (shipped early)`)}
 const d=derivePO({...p,...patch});if(d.status!==p.status){patch.status=d.status;patch.statusWhy={text:d.why,at:nowIso(),from:p.status};if(p.statusManual&&poStep(d.status)>=poStep(p.statusManual))patch.statusManual=null;notes.unshift(`status ${L("poStatus",p.status)||p.status} → ${L("poStatus",d.status)||d.status} (${d.why})`);if(d.status==="closed"&&d.auto)patch.closeReason=d.why}
 const vw=S.batch?.touch?.viaWhy?.[no];if(vw)notes.push(vw);
 if(Object.keys(patch).length)await derivedUpdate("purchases",no,patch,notes.join(" · ")||"status note updated",why);else if(vw)logEv("derive","purchases",no,`${vw} — balance re-derived (outstanding ${fmt(poState(p).outstandingCur,p.cur)})${why?` · after: ${why}`:""}`)}
/* landed cost of a receipt follows its inputs (shipment cost, actual freight £, UK costs, duty, PI prices, carton data) automatically */
async function recomputeLanded(no,why,costNote){const r=D.receipts.find(x=>x.no===no);if(!r||r.deletedAt)return;const lps=receiptLanded(r);let i=0;const lines=(r.lines||[]).map(l=>{if(!l.sku)return l;const lp=lps[i++];return lp&&Math.abs((+l.landed||0)-lp.total)>0.004?{...l,landed:lp.total}:l});const ch=lines.map((l,k)=>[l,r.lines[k]]).filter(([a,b])=>a!==b);if(!ch.length)return;
 await derivedUpdate("receipts",no,{lines,landedAt:nowIso()},`landed cost recalculated${costNote?" ("+costNote+")":""}: ${ch.map(([a,b])=>`${product(a.sku)?.name||a.sku} ${gbp2(b.landed)} → ${gbp2(a.landed)}`).join(", ")}`,why)}
async function setupPatch(path,value,labelTxt){return setupPatchMany([[path,value]],labelTxt)}
/* per-path write: read the current server copy first and apply only these paths to it, so a change made meanwhile by someone else on another path is kept */
async function setupPatchMany(pairs,labelTxt,o={}){let base=D.setup;try{const snap=await db.collection("setup").doc("main").get();if(snap&&snap.exists){const sv=snap.data();if(sv&&(!D.setup||sv.updatedAt!==D.setup.updatedAt))base=sv}}catch(_){}
 const before=JSON.parse(JSON.stringify(base||{}));const next=JSON.parse(JSON.stringify(base||{id:"main"}));pairs.forEach(([p,v])=>setPath(next,p,v));next.id="main";next.updatedAt=nowIso();try{await db.collection("setup").doc("main").set(next);D.setup=next;if(!o.noUndo)pushUndo({label:labelTxt||"Setup changed",col:"setup",id:"main",before,after:next});if(labelTxt)toast(labelTxt,{undo:true});return true}catch(e){toast("Could not save Setup");return false}}
function setPath(o,path,v){const ks=Array.isArray(path)?path:String(path).split(".");let c=o;for(let i=0;i<ks.length-1;i++){const k=ks[i];if(c[k]==null)c[k]=/^\d+$/.test(ks[i+1])?[]:{};c=c[k]}c[ks[ks.length-1]]=v}
function getPath(o,path){const ks=Array.isArray(path)?path:String(path).split(".");return ks.reduce((c,k)=>c==null?undefined:c[k],o)}
/* Trash / Restore are ordinary writes in one batch: the orders, shipments and milestones they affect re-derive automatically.
   A receipt takes its automatic damaged → quarantine moves with it (and brings them back on Restore). */
async function trashDoc(col,id,labelTxt){const cur=D[col]?.find(x=>x.id===id);if(!cur)return false;const lab=labelTxt===null?null:(labelTxt||`${id} moved to Trash`);const own=!S.batch;if(own)beginBatch(lab||`${id} moved to Trash`);let ok=false;
 try{ok=await updateDoc(col,id,{deletedAt:nowIso(),deletedBy:uid||"local"},lab||`${id} moved to Trash`,{quiet:true});
  if(ok&&col==="receipts")for(const m of D.moves.filter(m=>m.receipt===id&&!m.deletedAt&&(m.auto||m.type==="quarantine"||m.type==="damaged")))await updateDoc("moves",m.no,{deletedAt:nowIso(),deletedBy:uid||"local",trashedWith:id},`automatic move trashed with ${id}`,{quiet:true})}
 finally{if(own){await endBatch();if(lab)toast(lab,{undo:true});render()}}return ok}
async function restoreDoc(col,id){const own=!S.batch;if(own)beginBatch(`${id} restored`);let ok=false;
 try{ok=await updateDoc(col,id,{deletedAt:null,deletedBy:null},`${id} restored`,{quiet:true});if(ok&&col==="receipts")for(const m of D.moves.filter(m=>m.receipt===id&&m.deletedAt&&m.trashedWith===id))await updateDoc("moves",m.no,{deletedAt:null,deletedBy:null,trashedWith:null},`automatic move restored with ${id}`,{quiet:true})}
 finally{if(own){await endBatch();toast(`${id} restored`,{undo:true});render()}}return ok}
async function purgeTrash(){const days=DEF().trashDays||30;const cutoff=addDays(today(),-days);for(const col of COLS){for(const x of (D[col]||[]).slice()){if(x.deletedAt&&x.deletedAt.slice(0,10)<cutoff){try{await rawDelete(col,x.id);logEv("purge",col,x.id,"Removed from Trash after "+days+" days")}catch(e){}}}}}
/* Undo / Redo put every record of the action back, then re-derive what they touched (no-op when consistent), and are logged */
async function undo(){const g=S.undo.pop();if(!g)return toast("Nothing to undo");S.batch={label:"Undo: "+g.label,entries:[],touch:newTouch(),noUndo:true};
 try{for(const e of g.entries.slice().reverse()){const cur=D[e.col]?.find(x=>x.id===e.id)||(e.col==="setup"?D.setup:null);if(cur&&e.after&&cur.updatedAt&&e.after.updatedAt&&cur.updatedAt!==e.after.updatedAt&&cur.updatedBy!==(uid||"local")){toast(`${e.id} was changed by someone else since — not undone`);continue}
  if(e.col==="setup"){await db.collection("setup").doc("main").set(e.before);D.setup=e.before}else if(e.before)await rawSet(e.col,e.id,e.before);else await rawDelete(e.col,e.id);
  if(e.col!=="setup")noteTouch(e.col,e.after,e.before);logEv("undo",e.col==="setup"?"setup":e.col,e.col==="setup"?"main":e.id,`Undone: ${g.label}${e.label&&e.label!==g.label?" — "+String(e.label).slice(0,120):""}`)}
  await reconcile(S.batch)}catch(err){console.error(err)}finally{S.batch=null}
 S.redo.push(g);ls.set("undo",S.undo.slice(-20));toast("Undone: "+g.label);render()}
async function redo(){const g=S.redo.pop();if(!g)return toast("Nothing to redo");S.batch={label:"Redo: "+g.label,entries:[],touch:newTouch(),noUndo:true};
 try{for(const e of g.entries){if(e.col==="setup"){await db.collection("setup").doc("main").set(e.after);D.setup=e.after}else{const before=D[e.col]?.find(x=>x.id===e.id)||null;await rawSet(e.col,e.id,e.after);noteTouch(e.col,before,e.after)}logEv("redo",e.col==="setup"?"setup":e.col,e.col==="setup"?"main":e.id,`Redone: ${g.label}${e.label&&e.label!==g.label?" — "+String(e.label).slice(0,120):""}`)}
  await reconcile(S.batch)}catch(err){console.error(err)}finally{S.batch=null}
 S.undo.push(g);toast("Redone: "+g.label);render()}
function logEv(kind,col,id,text){const e={id:nid()+Date.now().toString(36),at:nowIso(),by:uid||"local",byName:SET().users?.find(u=>u.uid===uid)?.name||S.role,kind,col,ref:id,text:text||""};D.log.unshift(e);if(D.log.length>500)D.log.length=500;if(db){db.collection("log").doc(e.id).set(e).catch(()=>{})}}

/* ---------- navigation & history ---------- */
function snapshot(){return{view:{...S.view},f:JSON.parse(JSON.stringify(S.f)),limit:{...S.limit},scrollY:window.scrollY,drawer:S.drawer&&!S.drawer.form?{col:S.drawer.col,id:S.drawer.id}:null}}
function refreshHist(){if(S.hi>=0&&S.hist[S.hi])S.hist[S.hi]=snapshot()}
function pushHist(){S.hist=S.hist.slice(0,S.hi+1);S.hist.push(snapshot());if(S.hist.length>80)S.hist.shift();S.hi=S.hist.length-1;S._seq=(S._seq||0)+1;S.hseq=S.hseq||[];S.hseq=S.hseq.slice(0,S.hi);S.hseq[S.hi]=S._seq;try{const h=S.drawer&&!S.drawer.form?`#/doc/${S.drawer.col}/${S.drawer.id}`:(typeof navHref==="function"&&typeof fNow==="function"?navHref(S.view.k,fNow(S.view.k)):`#/${S.view.k}`);if(S.hi===0&&!S._hinit){S._hinit=1;history.replaceState({mt:S._seq},"",h)}else history.pushState({mt:S._seq},"",h)}catch(_){}}
/* Recent: last opened records (this browser) — Home + top bar clock */
function noteRecent(col,id){try{const r=ls.get("recent",[]).filter(x=>!(x.col===col&&x.id===id));r.unshift({col,id,at:nowIso()});ls.set("recent",r.slice(0,20))}catch(_){}}
function recentList(){return ls.get("recent",[]).filter(r=>(D[r.col]||[]).some(v=>(v.no||v.id)===r.id&&!v.deletedAt))}
function mirrorHash(){try{const h=S.drawer&&!S.drawer.form?`#/doc/${S.drawer.col}/${S.drawer.id}`:`#/${S.view.k}`;if(location.hash!==h)history.replaceState(history.state,"",h)}catch(_){}}
function go(k,params={},opts={}){if(S.drawer?.form&&!opts.force){if(!confirmDirty())return}if(!S.drawer?.form)refreshHist();if(!PAGES.includes(k))k="home";if(!opts.keepFilters&&k!==S.view.k){/* filters are per page: nothing to clear */}S.view={k,params};if(params.f){S.f[k]={...(S.f[k]||{}),...params.f}}if(S.drawer&&!opts.keepDrawer)S.drawer=null;pushHist();render();if(!opts.noScroll)window.scrollTo(0,0)}
function openDoc(col,id,opts={}){const x=(D[col]||[]).find(v=>(v.no||v.id)===id||v.id===id||v.code===id||v.sku===id);if(!x){toast(`${id} not found`);return}if(x.deletedAt&&!opts.allowTrashed){toast(`${id} is in Trash`,{restore:[col,id]});return}noteRecent(col,x.no||x.id);if(!S.drawer?.form)refreshHist();S.drawer={col,id:x.no||x.id};pushHist();render()}
function applySnap(s){S.view={...s.view};S.f=JSON.parse(JSON.stringify(s.f||{}));S.limit={...(s.limit||{})};S.drawer=s.drawer?{...s.drawer}:null;render();window.scrollTo(0,s.scrollY||0)}
function back(){if(S.drawer?.form){if(!confirmDirty())return;const rt=S.drawer.ctx?.returnTo;S.drawer=null;render();if(rt?.stash)restoreStash(rt.stash);return}if(S.hi>0){S._navBtn=1;history.back()}}
function fwd(){if(S.hi<S.hist.length-1){S._navBtn=1;history.forward()}}
/* browser / phone back button = the app's Back (step by step, never jumps to the start) */
window.addEventListener("popstate",e=>{S._popAt=Date.now();const seq=e.state&&e.state.mt;if(!seq||!S.hseq)return;const i=S.hseq.indexOf(seq);if(i<0)return;if(S.drawer?.form&&!S._navBtn){if(!confirmDirty()){history.pushState({mt:S.hseq[S.hi]},"",location.hash);return}}S._navBtn=0;refreshHist();S.hi=i;applySnap(S.hist[S.hi])});
function closeDrawer(force){if(S.drawer?.form&&!force){if(!confirmDirty())return false}const rt=S.drawer?.form?S.drawer.ctx?.returnTo:null;S.drawer=null;const b=$("#dirtybar");if(b)b.hidden=true;render();mirrorHash();if(rt?.stash)restoreStash(rt.stash);return true}
function confirmDirty(){if(!S.drawer?.form||!S.drawer.dirty)return true;if(S.drawer.confirmShown){S.drawer.dirty=false;const b=$("#dirtybar");if(b)b.hidden=true;return true}S.drawer.confirmShown=true;const bar=$("#dirtybar");if(bar){bar.hidden=false;setTimeout(()=>{if(S.drawer)S.drawer.confirmShown=false;if(bar)bar.hidden=true},6000)}toast("Unsaved changes — press again to discard, or Save");return false}
const F=page=>S.f[page||S.view.k]||(S.f[page||S.view.k]={});
/* filters are per page: kept in the current history entry (Back/Forward) and in this browser (survive a reload); the search text is not kept */
function filtersChanged(page){if(S.hi>=0&&S.hist[S.hi]){S.hist[S.hi].f=JSON.parse(JSON.stringify(S.f));S.hist[S.hi].limit={...S.limit}}const keep={};Object.entries(S.f||{}).forEach(([p,f])=>{const o={};Object.entries(f||{}).forEach(([k,v])=>{if(k!=="q"&&v!==""&&v!=null)o[k]=v});if(Object.keys(o).length)keep[p]=o});ls.set("filters",keep)}
function setF(page,k,v){const f=F(page);if(v===""||v==null)delete f[k];else f[k]=v;S.limit[page]=60;filtersChanged(page)}
function clearF(page){S.f[page]={};S.limit[page]=60;filtersChanged(page)}

/* ---------- search ---------- */
function norm(s){s=String(s||"").toLowerCase();const al=SET().aliases||{};return s.split(/[\s,;|·]+/).map(w=>al[w]||w).join(" ").replace(/[^a-z0-9£$¥.\-\s]/g," ").replace(/\s+/g," ").trim()}
function lev(a,b){if(a===b)return 0;const al=a.length,bl=b.length;if(!al)return bl;if(!bl)return al;if(Math.abs(al-bl)>3)return 9;let d=[];for(let i=0;i<=al;i++){d[i]=[i]}for(let j=0;j<=bl;j++)d[0][j]=j;for(let i=1;i<=al;i++)for(let j=1;j<=bl;j++){const c=a[i-1]===b[j-1]?0:1;d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+c);if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1)}return d[al][bl]}
function score(text,q){const t=norm(text);const words=norm(q).split(" ").filter(Boolean);if(!words.length)return 0;let s=0,hit=0;const tw=t.split(" ");for(const w of words){if(t.includes(w)){s+=w.length>2?3:1;hit++;continue}const nw=w.replace(/[,.]/g,"");if(/^\d+(\.\d+)?$/.test(nw)&&tw.some(x=>x.replace(/[,.]/g,"")===nw||x.replace(/[,.]/g,"").startsWith(nw))){s+=2;hit++;continue}if(w.length>3){const tol=w.length>6?2:1;if(tw.some(x=>x.length>3&&lev(x,w)<=tol)){s+=1;hit++;continue}}}
 if(!hit)return 0;return hit===words.length?s:s*hit/words.length*0.6}
const _st=new Map();
function searchText(col,x){const key=col+"/"+x.id+"/"+(x.updatedAt||"");if(_st.has(key))return _st.get(key);let t="";const old=[].concat(x.oldRef||[]).join(" ");const tags=(x.tags||[]).map(t=>L("tag",t)).join(" ");switch(col){
 case"purchases":t=[x.no,old,pname(x.party),party(x.party)?.company,poDesc(x),x.piNo,x.yourRef,(x.lines||[]).map(l=>l.sku+" "+(product(l.sku)?.name||l.p)).join(" "),cname(x.account),L("poStatus",x.status),L("purchaseKind",x.kind),x.cur,x.total,x.tracking,x.notes,L("refType",x.refType),x.refText].join(" | ");break;
 case"shipments":t=[x.no,old,pname(x.party),L("mode",x.mode),L("shipStatus",x.status),x.tracking,x.awb,x.fwdInvNo,x.mrn,x.yourRef,(x.lines||[]).map(l=>l.po+" "+l.sku).join(" "),(x.purchases||[]).join(" "),(x.destinations||[]).map(d=>d.fbaId+" "+locName(d.loc)).join(" "),locName(x.deliverTo),x.goods,x.cost,x.ctn,x.kg,x.notes,L("incoterm",x.incoterm)].join(" | ");break;
 case"payments":t=[x.no,old,x.forOld,pname(x.party),(x.allocations||[]).map(a=>a.ref).join(" "),L("payType",x.type),L("payStatus",x.status),L("platform",x.platform),L("paidBy",x.paidBy),person(x.person)?.name,bname(x.bank),cname(x.company),x.email,x.amount,x.gbp,x.cur,x.yourRef,x.refText,x.notes,x.desc,L("refType",x.refType)].join(" | ");break;
 case"inspections":t=[x.no,x.po,pname(x.party),L("inspResult",x.result),x.notes,x.fee].join(" | ");break;
 case"receipts":t=[x.no,x.src,(x.pos||[]).join(" "),(x.lines||[]).map(l=>l.sku+" "+locName(l.loc)).join(" "),x.customsEntryNo,x.notes].join(" | ");break;
 case"moves":t=[x.no,L("moveType",x.type),x.sku,product(x.sku)?.name,locName(x.from),locName(x.to),L("marketplace",x.channel),x.orderId,x.tracking,x.fbaId,L("adjustReason",x.reason),x.notes].join(" | ");break;
 case"credits":t=[x.no,pname(x.party),x.po,x.receipt,x.amount,L("creditReason",x.reason),x.notes].join(" | ");break;
 case"products":t=[x.sku,x.name,L("brand",x.brand),L("category",x.category),(x.ean||[]).join(" "),x.fnsku,x.asin,(x.listings||[]).map(l=>l.id).join(" "),x.hs,L("productStatus",x.status),"pack of "+(x.packOf||1),(x.suppliers||[]).map(s=>pname(s.party)).join(" ")].join(" | ");break;
 case"parties":t=[x.code,old,x.name,x.company,L("partyType",x.type),L("country",x.country),x.cur,x.wechat,x.email,x.phone,x.contact,x.notes].join(" | ");break;
 default:t=JSON.stringify(x)}
 t=(t+" "+tags).replace(/\s+/g," ");_st.set(key,t);if(_st.size>5000)_st.clear();return t}
function searchAll(q){const out=[];const nq=norm(q);const add=(col,x,ref,extra)=>{const sc=score(searchText(col,x),q);if(sc>0)out.push({col,x,sc,ref,extra,close:!norm(searchText(col,x)).includes(nq)})};
 live(D.purchases).forEach(p=>add("purchases",p,p.no,`${pname(p.party)} · ${poDesc(p).slice(0,40)} · ${fmtD(p.date)}`));live(D.shipments).forEach(s=>add("shipments",s,s.no,`${pname(s.party)} · ${L("mode",s.mode)} · ${fmtD(s.dispatch||s.date)}`));live(D.payments).forEach(p=>add("payments",p,p.no,`${pname(p.party)} · ${fmt(p.amount,p.cur)} · ${fmtD(p.date)}`));
 live(D.inspections).forEach(i=>add("inspections",i,i.no,`${i.po} · ${L("inspResult",i.result)}`));live(D.receipts).forEach(r=>add("receipts",r,r.no,`${r.src} · ${fmtD(r.date)}`));live(D.moves).forEach(m=>add("moves",m,m.no,`${L("moveType",m.type)} · ${m.sku} · ${m.qty}`));live(D.credits).forEach(c=>add("credits",c,c.no,`${pname(c.party)} · ${fmt(c.amount,c.cur)}`));
 D.products.forEach(p=>add("products",p,p.sku,`${p.name} · ${L("brand",p.brand)}`));D.parties.filter(p=>p.status!=="archived").forEach(p=>add("parties",p,p.code,`${p.name} · ${p.company||L("partyType",p.type)}`));
 return out.sort((a,b)=>b.sc-a.sc).slice(0,40)}
function resolveRef(q){const n=String(q||"").trim();if(!n)return null;const up=n.toUpperCase();for(const col of ["purchases","shipments","payments","inspections","receipts","moves","credits"]){const x=(D[col]||[]).find(v=>v.no===up||[].concat(v.oldRef||[]).map(o=>String(o).toUpperCase()).includes(up)||(v.forOld||"").toUpperCase()===up||(v.piNo||"").toUpperCase()===up||(v.yourRef||"").toUpperCase()===up||(v.tracking||"").toUpperCase()===up||(v.awb||"").toUpperCase()===up||(v.destinations||[]).some(d=>(d.fbaId||"").toUpperCase()===up)||(v.fbaId||"").toUpperCase()===up);if(x)return{col,id:x.no}}
 const pr=D.products.find(p=>p.sku===up||(p.ean||[]).includes(n)||p.fnsku===up||p.asin===up||SET().skuAliases?.[n]===p.sku);if(pr)return{col:"products",id:pr.sku};const pa=D.parties.find(p=>p.code===up||[].concat(p.oldRef||[]).map(o=>String(o).toUpperCase()).includes(up));if(pa)return{col:"parties",id:pa.code};return null}
function didYouMean(q){const words=norm(q).split(" ").filter(w=>w.length>2);const vocab=new Set();D.products.forEach(p=>{norm(p.name).split(" ").forEach(w=>w.length>2&&vocab.add(w));vocab.add(p.sku.toLowerCase())});D.parties.forEach(p=>norm(p.name+" "+(p.company||"")).split(" ").forEach(w=>w.length>2&&vocab.add(w)));["purchases","shipments","payments"].forEach(c=>(D[c]||[]).forEach(x=>{vocab.add(String(x.no).toLowerCase());[].concat(x.oldRef||[]).forEach(o=>vocab.add(String(o).toLowerCase()))}));Object.keys(SET().aliases||{}).forEach(a=>vocab.add(a));
 const out=words.map(w=>{if(vocab.has(w))return w;let best=null,bd=3;for(const v of vocab){const d=lev(v,w);if(d<bd){bd=d;best=v}}return best||w});const s=out.join(" ");return s!==norm(q)?s:null}
