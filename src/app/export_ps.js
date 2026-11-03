/* MY TOOL — Payment Summary export in the owner's PAYMENT SUMMARY sheet style.
   One tab per supplier / forwarder / inspector ("SUP13- Joyce Wen | Middle Man"), plus INDEX and ALL PAYMENTS.
   SheetJS community cannot write cell styles, so this uses ExcelJS (vendor/exceljs/exceljs.min.js), loaded the first time the button is pressed.
   Self-contained: wraps vReports / vPayments to add the button and listens for clicks on [data-psx]. */

const PSX={NAVY:"FF1C4587",YEL:"FFF1C232",TFILL:"FFE1E9F7",RED:"FFFF0000",BLUE:"FF4A86E8",GREEN:"FF93C47D",GREY:"FFF3F3F3",WHITE:"FFFFFFFF",BLACK:"FF000000",LINK:"FF0000FF",ILINK:"FF1155CC",DIM:"FF8A8A8A",
 MON:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],busy:false};
const psSym=c=>c==="RMB"||c==="CNY"?"¥":c==="GBP"?"£":c==="USD"?"$":(c?c+" ":"");
const psCurX=c=>c==="RMB"?"CNY":(c||"");            /* the owner's sheet writes yuan as CNY */
const psNumFmt=c=>c==="GBP"?'"£"#,##0.00':c==="USD"?'"$"#,##0.00':c==="RMB"||c==="CNY"?'"¥"#,##0.00':'#,##0.00';
/* owner style number: 22217, 24416.5, 1343.5 (no thousands separator, no trailing .00) */
const psN=x=>{const v=Math.round((+x||0)*100)/100;return String(v)};
const psDM=iso=>{if(!iso)return"";const[,m,d]=iso.slice(0,10).split("-");return`${+d} ${PSX.MON[+m-1]}`};
const psDate=iso=>{if(!iso||!/^\d{4}-\d{2}-\d{2}/.test(iso))return null;const[y,m,d]=iso.slice(0,10).split("-").map(Number);return new Date(Date.UTC(y,m-1,d))};
const psFileDate=()=>{const[y,m,d]=today().split("-");return`${d}-${PSX.MON[+m-1]}-${y}`};
const psSign=p=>p&&p.direction==="in"?-1:1;
const psCounted=p=>typeof isCounted==="function"?isCounted(p):(p.status==="paid");
const psStatus=p=>psCounted(p)?"PAID":p.status==="paid"?"PAID (awaiting approval)":String(L("payStatus",p.status)||p.status||"").toUpperCase();
const psUrl=u=>typeof u==="string"&&/^https?:\/\//i.test(u.trim())?u.trim():"";

/* ---------- what the data says ---------- */
function psDocFor(ref){if(!ref)return null;const po=D.purchases.find(x=>x.no===ref);if(po)return{col:"purchases",d:po};const sh=D.shipments.find(x=>x.no===ref);if(sh)return{col:"shipments",d:sh};const ins=(D.inspections||[]).find(x=>x.no===ref);if(ins)return{col:"inspections",d:ins};const cr=(D.credits||[]).find(x=>x.no===ref);if(cr)return{col:"credits",d:cr};return null}
/* the order a payment is listed under: the allocation with the biggest amount that names a record, else forRef */
function psGroupRef(p){const al=(p.allocations||[]).filter(a=>a.ref);if(al.length){return al.slice().sort((a,b)=>(+b.amount||0)-(+a.amount||0))[0].ref}return p.forRef||null}
function psWhat(pt){if(!pt)return"";if(pt.viaAgent)return"Middle Man";const t=pt.type||"";if(t==="forwarder")return"Freight";if(t==="inspector")return"Inspection";if(t==="courier")return"Courier";if(t==="customs")return"Customs";if(t==="supplier")return"Supplier";return String(L("partyType",t)||t)}
function psTabName(pt,used){const code=pt.oldCode||pt.code||"?";const clean=x=>String(x||"").replace(/[\[\]:*?\/\\]/g,"-").replace(/\s+/g," ").trim();const w=psWhat(pt)?" | "+psWhat(pt):"";let nm=clean(pt.name||pt.code);const room=31-(code.length+2)-w.length;if(nm.length>room)nm=nm.slice(0,Math.max(4,room)).trim();
 let n=`${clean(code)}- ${nm}${w}`.replace(/^'+|'+$/g,"").trim();if(n.length>31)n=n.slice(0,31).trim();let k=n,i=2;while(used.has(k.toLowerCase())){const s=` (${i++})`;k=n.slice(0,31-s.length).trim()+s}used.add(k.toLowerCase());return k}
function psSortKey(pt){const c=pt.oldCode||pt.code||"";const m=c.match(/^([A-Za-z]+)-?0*(\d+)/);return[pt.oldCode?0:1,m?m[1].toUpperCase():c,m?+m[2]:0,pt.code||""]}
function psCmp(a,b){const x=psSortKey(a),y=psSortKey(b);for(let i=0;i<x.length;i++){if(x[i]<y[i])return-1;if(x[i]>y[i])return 1}return 0}
/* short owner-style label from an allocation note: "Reimburse Joyce: Caroline 1st inspection (VAL-105…)" → "Caroline 1st inspection" */
function psShort(note){let s=String(note||"").trim();s=s.replace(/^reimburse\s+[^:]{1,30}:\s*/i,"");s=s.split(/\s+[—–-]\s+|\s*\(|;|\n/)[0].trim();const w=s.split(/\s+/);return(w.length>5?w.slice(0,5).join(" "):s)||"other"}
/* the note column: how a mixed payment splits, e.g. "2 Nov ¥22217 = 50% ¥19317 + Plunger sample ¥150 + Rose ¥650+¥500 + Caroline ¥800+¥800" */
function psNote(p,groupRef){const sym=psSym(p.cur);const al=p.allocations||[];const out=[];const groups=[];const byKey={};
 const pctOf=(a,doc)=>{if(!doc||doc.col!=="purchases")return null;const tot=+poState(doc.d).total||0;if(!tot)return null;const pct=Math.round((+a.amount||0)/tot*100);if(pct<1||pct>100)return null;return Math.abs(tot*pct/100-(+a.amount||0))<=Math.max(1,tot*0.006)?pct:null};
 const refAl=al.filter(a=>a.ref),oth=al.filter(a=>!a.ref);
 refAl.forEach(a=>{const doc=psDocFor(a.ref);let lab;if(a.ref===groupRef){const pct=pctOf(a,doc);lab=pct!=null?`${pct}%`:String(L("payType",p.type)||"").toLowerCase()}else lab=doc?.d?.oldRef||a.ref;out.push({lab,amts:[+a.amount||0]})});
 const firsts={};oth.forEach(a=>{const f=psShort(a.note).split(/\s+/)[0].toLowerCase();firsts[f]=(firsts[f]||0)+1});
 oth.forEach(a=>{const sh=psShort(a.note);const f=sh.split(/\s+/)[0];const key=firsts[f.toLowerCase()]>1?f.toLowerCase():"#"+sh;const lab=(firsts[f.toLowerCase()]>1?f:sh)+(a.belongsTo==="personal"?" (personal)":"");if(byKey[key])byKey[key].amts.push(+a.amount||0);else{byKey[key]={lab,amts:[+a.amount||0]};groups.push(byKey[key])}});
 const all=out.concat(groups);const used=al.reduce((s,a)=>s+(+a.amount||0),0);const rest=Math.round(((+p.amount||0)-used)*100)/100;if(al.length&&rest>0.5)all.push({lab:"not allocated",amts:[rest]});
 const fmtPart=x=>`${x.lab?x.lab+" ":""}${x.amts.map(v=>sym+psN(v)).join("+")}`;
 let note="";
 if(all.length>1)note=`${psDM(p.date)} ${sym}${psN(p.amount)} = ${all.map(fmtPart).join(" + ")}`;
 else if(all.length===1&&all[0].lab&&!/^[a-z ]+$/.test(all[0].lab))note=`${psDM(p.date)} ${sym}${psN(p.amount)} = ${all[0].lab}`;   /* e.g. "= 30%" or "= VAL-104" */
 else if(!al.length)note="not allocated to an order";
 const extra=[p.notes].filter(Boolean).map(String);if(p.paidBy==="person"&&p.person)extra.push(`paid by ${person(p.person)?.name||p.person}`);if(p.direction==="in")extra.push("money IN (refund / credit)");
 note=[note,...extra].filter(Boolean).join(" · ");
 if(!psCounted(p))note=`NOT COUNTED (${L("payStatus",p.status)||p.status}${p.status==="paid"?", awaiting approval":""})${note?" · "+note:""}`;
 return note}
function psLinks(p,grp){const rec=psUrl(p.receipt)||psUrl(p.docs?.receipt?.url)||"";const inv=[];const push=u=>{u=psUrl(u);if(u&&u!==rec&&!inv.includes(u))inv.push(u)};
 /* INVOICE LINK = the order's PI / CI (as in the owner's sheet), INVOICE LINK 2 = any other invoice on the payment */
 const d=grp?.doc?.d;if(d){push(d.piLink);push(d.docs?.pi?.url);push(d.docs?.invoice?.url);(d.links||[]).forEach(l=>push(l&&l.url))}push(p.invoice);push(p.docs?.invoice?.url);(p.links||[]).forEach(l=>push(l&&l.url));
 return{rec,inv1:inv[0]||"",inv2:inv[1]||""}}

/* every payment row with its tab, group and note (same numbers the app shows) */
function psModel(){const pays=live(D.payments).slice().sort((a,b)=>(a.date||"")<(b.date||"")?-1:(a.date||"")>(b.date||"")?1:String(a.no).localeCompare(String(b.no)));
 const typesWithTab=new Set(["supplier","forwarder","inspector"]);const byParty={};pays.forEach(p=>{(byParty[p.party||""]=byParty[p.party||""]||[]).push(p)});
 const parties=D.parties.filter(pt=>(typesWithTab.has(pt.type)&&pt.status!=="archived"&&!pt.deletedAt)||byParty[pt.code]).sort(psCmp);
 const used=new Set(["index","all payments"]);const tabs=parties.map(pt=>({pt,name:psTabName(pt,used),pays:byParty[pt.code]||[]}));
 const orphan=pays.filter(p=>!parties.some(pt=>pt.code===p.party));
 if(orphan.length)tabs.push({pt:{code:"",name:"Unknown party",type:""},name:psTabName({code:"OTHER",name:"No party",type:""},used),pays:orphan});
 const rows=[];tabs.forEach(t=>{const groups=[];const gi={};t.pays.forEach(p=>{const ref=psGroupRef(p);const key=ref||("#"+p.no);if(!gi[key]){gi[key]={ref,doc:psDocFor(ref),pays:[]};groups.push(gi[key])}gi[key].pays.push(p)});
  groups.sort((a,b)=>{const x=a.pays[0].date||"",y=b.pays[0].date||"";return x<y?-1:x>y?1:0});t.groups=groups;
  groups.forEach(g=>{const d=g.doc?.d;g.a=d?(d.oldRef||d.no):(g.pays[0].oldRef?String(g.pays[0].oldRef).replace(/-P\d+$/,""):g.pays[0].no);
   g.b=d?[String((g.doc.col==="purchases"?d.desc||poDesc(d):d.goods||d.desc)||"").slice(0,160),d.oldRef?`(${d.no})`:""].filter(Boolean).join("\n"):String(g.pays[0].desc||"").slice(0,160);
   g.kind=/^VAL-/i.test(g.a)?"val":/^BAY-/i.test(g.a)?"bay":"";
   if(g.doc?.col==="purchases"){const st=poState(d);g.rem={amt:st.outstandingCur,cur:st.cur}}
   g.pays.forEach(p=>{const r={p,tab:t.name,grp:g,note:psNote(p,g.ref),links:psLinks(p,g),sAmt:psSign(p)*(+p.amount||0),gbp:p.gbp!=null&&p.gbp!==""?psSign(p)*(+p.gbp):null};rows.push(r);(g.rows=g.rows||[]).push(r)})})});
 return{tabs,rows}}
/* INDEX numbers: counted payments per tab and currency, and what is still to pay on the party's orders (poState) */
function psTotals(m){const T={};m.tabs.forEach(t=>{T[t.name]={n:0,RMB:0,GBP:0,USD:0,other:0,gbp:0,out:{},outRefs:[]}});
 m.rows.forEach(r=>{if(!psCounted(r.p))return;const x=T[r.tab];x.n++;const c=r.p.cur;if(c==="RMB"||c==="GBP"||c==="USD")x[c]+=r.sAmt;else x.other+=r.sAmt;x.gbp+=r.gbp||0});
 m.tabs.forEach(t=>{if(!t.pt.code)return;const x=T[t.name];openPOs().filter(p=>p.party===t.pt.code).forEach(p=>{const st=poState(p);if(st.outstandingCur>0.5){x.out[st.cur]=(x.out[st.cur]||0)+st.outstandingCur;x.outRefs.push(`${p.oldRef||p.no} ${psSym(st.cur)}${psN(st.outstandingCur)}`)}})});
 Object.values(T).forEach(x=>["RMB","GBP","USD","other","gbp"].forEach(k=>x[k]=Math.round(x[k]*100)/100));return T}

/* ---------- ExcelJS ---------- */
function psLoadLib(){if(window.ExcelJS)return Promise.resolve(window.ExcelJS);if(PSX.loading)return PSX.loading;
 PSX.loading=new Promise((ok,no)=>{const s=document.createElement("script");s.src="vendor/exceljs/exceljs.min.js";s.async=true;s.onload=()=>window.ExcelJS?ok(window.ExcelJS):no(new Error("ExcelJS did not load"));s.onerror=()=>{PSX.loading=null;s.remove();no(new Error("Could not load the Excel writer — check the connection and try again"))};document.head.appendChild(s)});return PSX.loading}
const psFont=(o={})=>({name:"Arial",size:o.size||12,bold:!!o.bold,italic:!!o.italic,strike:!!o.strike,color:{argb:o.color||PSX.BLACK},...(o.u?{underline:true}:{})});
const psFill=c=>({type:"pattern",pattern:"solid",fgColor:{argb:c},bgColor:{argb:c}});
const psBorder=s=>({top:{style:s},left:{style:s},bottom:{style:s},right:{style:s}});
const psAlign=(h="center")=>({horizontal:h,vertical:"middle",wrapText:true});
const psQ=n=>`'${String(n).replace(/'/g,"''")}'`;
function psSet(ws,addr,value,st={}){const c=ws.getCell(addr);if(value!==undefined)c.value=value;if(st.font)c.font=st.font;if(st.fill)c.fill=st.fill;if(st.border)c.border=st.border;if(st.align)c.alignment=st.align;if(st.fmt)c.numFmt=st.fmt;return c}
const psCol=n=>{let s="";n++;while(n){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26)}return s};
/* rough wrapped-height estimate so long notes and URLs stay readable */
function psLinesFor(text,width,size){if(text==null||text==="")return 1;const per=Math.max(4,Math.floor(width*(size>=14?0.78:0.92)));return String(text).split("\n").reduce((s,l)=>s+Math.max(1,Math.ceil(l.length/per)),0)}

const PS_COLS=[["A",11.4],["B",26],["C",14],["D",19],["E",22],["F",15],["G",14.2],["H",16],["I",14.2],["J",30],["K",30],["L",30],["M",16],["N",14],["O",14],["P",58]];
function psPartySheet(wb,t,m,T){const ws=wb.addWorksheet(t.name,{views:[{state:"frozen",xSplit:0,ySplit:3,topLeftCell:"A4",activeCell:"A4"}],pageSetup:{orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9}});
 PS_COLS.forEach(([c,w])=>ws.getColumn(c).width=w);
 /* row 1: title (red on light blue) + totals the owner keeps in F1 */
 ws.getRow(1).height=25.5;const t1={font:psFont({bold:true,color:PSX.RED}),fill:psFill(PSX.TFILL)};["A1","B1","C1"].forEach(a=>psSet(ws,a,null,t1));["D1","E1"].forEach(a=>psSet(ws,a,null,{...t1,fill:psFill(PSX.WHITE),align:psAlign("left")}));psSet(ws,"A1",t.name);
 const x=T[t.name];const N=m.rows.length+3;const ap=k=>`${psQ("ALL PAYMENTS")}!$${k}$4:$${k}$${N}`;
 const sumf=cur=>`SUMIFS(${ap("G")},${ap("B")},"${t.name.replace(/"/g,'""')}",${ap("H")},"${cur}",${ap("K")},"PAID")`;
 const mainCur=x.RMB||!(x.GBP)?"RMB":"GBP";
 psSet(ws,"F1",{formula:sumf(psCurX(mainCur)),result:x[mainCur]},{font:psFont({bold:true}),fill:psFill(PSX.WHITE),align:psAlign(),fmt:psNumFmt(mainCur)});
 psSet(ws,"G1",{formula:sumf("USD"),result:x.USD},{font:psFont({bold:true}),fill:psFill(PSX.WHITE),align:psAlign(),fmt:psNumFmt("USD")});
 if(mainCur==="RMB"&&x.GBP)psSet(ws,"H1",{formula:sumf("GBP"),result:x.GBP},{font:psFont({bold:true}),fill:psFill(PSX.WHITE),align:psAlign(),fmt:psNumFmt("GBP")});
 /* rows 2–3: the owner's header (navy sender/recipient block, yellow money block) */
 ws.getRow(2).height=15.75;ws.getRow(3).height=31.5;
 const nav={font:psFont({bold:true,color:PSX.WHITE}),fill:psFill(PSX.NAVY),border:psBorder("double"),align:psAlign()};
 const yel={font:psFont({bold:true}),fill:psFill(PSX.YEL),border:psBorder("double"),align:psAlign()};
 const H2={A:"Order Ref. No",C:"SENDER DETAILS",E:"RECIPIENT DETAILS",F:"Total PAYMENT ",H:"DEPOSIT PAYMENT",L:"REMAINING PAYMENT",P:"NOTE"};
 const H3={B:"PRODUCT REF.",C:"BANK",D:"OWNER / COMPANY NAME",E:"OWNER / COMPANY NAME",F:"Yuan ¥ / GBP",G:"USD",H:"PAYMENT DATE",I:"Full Payment PAYMENT",J:"RECEIPT LINK",K:"INVOICE LINK",L:"INVOICE LINK 2",M:"REMAINING PAYMENT",N:"RECEIPT LINK",O:"INVOICE LINK"};
 ["A2:A3","C2:D2","F2:G2","H2:K2","L2:O2","P2:P3"].forEach(r=>ws.mergeCells(r));
 /* styles go on every cell after merging, so the hidden cells of a merge keep the fill and border too */
 PS_COLS.forEach(([c])=>{const st=c<="E"?nav:yel;[2,3].forEach(n=>{const cell=ws.getCell(c+n);const v=(n===2?H2:H3)[c];if(v!=null)cell.value=v;cell.style={font:st.font,fill:st.fill,border:st.border,alignment:c==="K"&&n===3?psAlign("left"):st.align}})});
 /* data rows: one per payment, grouped by order (VAL orders blue, eBay orders green — as in the owner's sheet) */
 let r=4;(t.groups||[]).forEach(g=>{const r0=r;g.rows.forEach((row,i)=>{const p=row.p;const k=g.kind;const dim=!psCounted(p);
   const base=k==="val"?{fill:PSX.BLUE,size:14,bold:true,color:PSX.BLACK}:k==="bay"?{fill:PSX.GREEN,size:14,bold:true,color:PSX.WHITE}:{fill:null,size:12,bold:false,color:PSX.BLACK};
   const font=o=>psFont({size:base.size,bold:base.bold,color:dim?PSX.DIM:(o&&o.color)||base.color,strike:dim&&o&&o.num,italic:dim});
   const fillFor=c=>base.fill?psFill(base.fill):(c>="F"?psFill(PSX.GREY):undefined);
   const cell=(c,v,o={})=>psSet(ws,c+r,v,{font:font(o),fill:fillFor(c),border:psBorder("thin"),align:psAlign(o.left?"left":"center"),fmt:o.fmt});
   const link=(c,u)=>u?cell(c,{text:u,hyperlink:u},{color:base.fill?base.color:PSX.LINK}):cell(c,null);
   const pt=party(p.party);const senderName=cname(p.company);
   cell("A",i===0?g.a:null);cell("B",i===0?g.b:null);
   cell("C",can("bank")?[bname(p.bank),L("platform",p.platform)].filter((v,j,a)=>v&&v!=="—"&&a.indexOf(v)===j).join(" · "):"");
   cell("D",[senderName!=="—"?senderName:"",p.paidBy==="person"&&p.person?`paid by ${person(p.person)?.name||p.person}`:""].filter(Boolean).join("\n"));
   cell("E",i===0?(pt?[pt.name,pt.company&&pt.company!==pt.name?pt.company:""].filter(Boolean).join("\n"):pname(p.party)):null);
   const isUsd=p.cur==="USD";cell("F",isUsd?null:row.sAmt,{fmt:psNumFmt(p.cur),num:true});cell("G",isUsd?row.sAmt:null,{fmt:psNumFmt("USD"),num:true});
   cell("H",psDate(p.date),{fmt:"dd-mmm-yyyy"});cell("I",row.gbp,{fmt:psNumFmt("GBP"),num:true});
   link("J",row.links.rec);link("K",row.links.inv1);link("L",row.links.inv2);
   cell("M",i===g.rows.length-1&&g.rem?g.rem.amt:null,{fmt:psNumFmt(g.rem?.cur)});cell("N",null);cell("O",null);
   cell("P",row.note,{left:true});
   const lines=Math.max(psLinesFor(i===0?g.b:"",26,base.size)/Math.max(1,g.rows.length),psLinesFor(row.note,58,base.size),psLinesFor(row.links.rec,30,base.size),psLinesFor(row.links.inv1,30,base.size),psLinesFor(row.links.inv2,30,base.size),2);
   ws.getRow(r).height=Math.min(409,Math.ceil(lines*(base.size>=14?18.75:15.75)+6));r++});
  if(g.rows.length>1){["A","B","E","M"].forEach(c=>ws.mergeCells(`${c}${r0}:${c}${r-1}`))}});
 if(!(t.groups||[]).length){psSet(ws,"A4","No payments recorded in MY TOOL yet",{font:psFont({italic:true,color:PSX.DIM})});ws.mergeCells("A4:E4")}
 return ws}

function psIndexSheet(wb,m,T){const ws=wb.addWorksheet("INDEX",{views:[{state:"frozen",ySplit:4,topLeftCell:"A5"}]});[34,32,10,16,16,16,34,60].forEach((w,i)=>ws.getColumn(i+1).width=w);
 psSet(ws,"A1",`PAYMENT SUMMARY - INDEX  (har supplier ka total paid, currency wise) · MY TOOL ${psFileDate()}`,{font:psFont({size:14,bold:true,color:PSX.RED}),fill:psFill(PSX.TFILL)});
 psSet(ws,"A2","Totals ALL PAYMENTS tab se formulas hain (sirf PAID payments). Outstanding = jo abhi dena hai (MY TOOL orders se).",{font:psFont({size:10})});
 const hd={font:psFont({size:11,bold:true}),fill:psFill(PSX.YEL),border:psBorder("thin"),align:psAlign("left")};
 ["Supplier","Tab","Payments","Paid ¥ (RMB)","Paid £ (GBP)","Paid $ (USD)","Outstanding","Note"].forEach((h,i)=>psSet(ws,psCol(i)+"4",h,hd));
 const N=m.rows.length+3;const ap=k=>`${psQ("ALL PAYMENTS")}!$${k}$4:$${k}$${N}`;let r=5;const f11=psFont({size:11});
 m.tabs.forEach(t=>{const x=T[t.name];const pt=t.pt;
  psSet(ws,"A"+r,pt.code?`${pt.name} · ${pt.code}${pt.oldCode?" ("+pt.oldCode+")":""}`:t.name,{font:f11});
  psSet(ws,"B"+r,{text:t.name,hyperlink:`#${psQ(t.name)}!A1`},{font:psFont({size:11,color:PSX.ILINK,u:true})});
  psSet(ws,"C"+r,{formula:`COUNTIFS(${ap("B")},B${r},${ap("K")},"PAID")`,result:x.n},{font:f11});
  [["D","CNY","RMB"],["E","GBP","GBP"],["F","USD","USD"]].forEach(([c,cx,cur])=>psSet(ws,c+r,{formula:`SUMIFS(${ap("G")},${ap("B")},B${r},${ap("H")},"${cx}",${ap("K")},"PAID")`,result:x[cur]},{font:f11,fmt:psNumFmt(cur)}));
  psSet(ws,"G"+r,Object.entries(x.out).map(([c,v])=>psSym(c)+Number(v).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2})).join(" + ")||"",{font:f11});
  const notes=[];if(x.outRefs.length)notes.push("to pay: "+x.outRefs.slice(0,6).join(", ")+(x.outRefs.length>6?` +${x.outRefs.length-6} more`:""));if(x.other)notes.push(`other currencies ${psN(x.other)}`);const nc=t.pays.filter(p=>!psCounted(p)).length;if(nc)notes.push(`${nc} not counted (cancelled / pending)`);
  psSet(ws,"H"+r,notes.join(" · "),{font:f11});r++});
 const last=r-1;const tb={font:psFont({size:11,bold:true}),fill:psFill(PSX.YEL),border:psBorder("thin")};const sum=k=>m.tabs.reduce((s,t)=>s+T[t.name][k],0);
 psSet(ws,"A"+r,"TOTAL",tb);psSet(ws,"B"+r,`${m.tabs.length} tabs`,tb);psSet(ws,"C"+r,{formula:`SUM(C5:C${last})`,result:sum("n")},tb);
 [["D","RMB"],["E","GBP"],["F","USD"]].forEach(([c,cur])=>psSet(ws,c+r,{formula:`SUM(${c}5:${c}${last})`,result:Math.round(sum(cur)*100)/100},{...tb,fmt:psNumFmt(cur)}));
 psSet(ws,"G"+r,null,tb);psSet(ws,"H"+r,`£ value of all PAID payments: £${Number(Math.round(sum("gbp")*100)/100).toLocaleString("en-GB",{minimumFractionDigits:2})}`,tb);
 return ws}

function psAllSheet(wb,m){const ws=wb.addWorksheet("ALL PAYMENTS",{views:[{state:"frozen",ySplit:3,topLeftCell:"A4"}]});
 const H=[["#",5],["Supplier tab",30],["Payment no",14],["Order Ref",16],["Old ref",16],["Payment date",14],["Amount",14],["Currency",9],["£ value",14],["Bank",16],["Status",12],["Receipt link",34],["Invoice link",34],["Note",70]];
 H.forEach(([,w],i)=>ws.getColumn(i+1).width=w);
 psSet(ws,"A1",`ALL PAYMENTS - har payment ek line (amount number + currency) · MY TOOL ${psFileDate()}`,{font:psFont({size:14,bold:true,color:PSX.RED}),fill:psFill(PSX.TFILL)});
 const hd={font:psFont({size:11,bold:true}),fill:psFill(PSX.YEL),border:psBorder("thin"),align:psAlign("left")};H.forEach(([h],i)=>psSet(ws,psCol(i)+"3",h,hd));
 const f10=o=>psFont({size:10,...o});let r=4;
 m.rows.forEach((x,i)=>{const p=x.p;const dim=!psCounted(p);const f=f10(dim?{color:PSX.DIM,italic:true}:{});
  const v=[i+1,{text:x.tab,hyperlink:`#${psQ(x.tab)}!A1`},p.no,x.grp.ref||"",x.grp.doc?.d?.oldRef||[].concat(p.oldRef||[]).join(", "),psDate(p.date),x.sAmt,psCurX(p.cur),x.gbp,can("bank")?bname(p.bank):"",psStatus(p),x.links.rec?{text:x.links.rec,hyperlink:x.links.rec}:"",x.links.inv1?{text:x.links.inv1,hyperlink:x.links.inv1}:"",x.note];
  v.forEach((val,j)=>{const c=psCol(j)+r;const isLink=val&&typeof val==="object"&&val.hyperlink;psSet(ws,c,val===""?null:val,{font:isLink?f10({color:PSX.ILINK,u:true}):f,fmt:j===5?"dd-mmm-yyyy":j===6?psNumFmt(p.cur):j===8?psNumFmt("GBP"):undefined})});r++});
 ws.autoFilter={from:"A3",to:`N${Math.max(3,r-1)}`};return ws}

async function psBuild(){const EJ=await psLoadLib();const m=psModel();const T=psTotals(m);const wb=new EJ.Workbook();wb.creator="MY TOOL";wb.created=new Date();
 psIndexSheet(wb,m,T);psAllSheet(wb,m);m.tabs.forEach(t=>psPartySheet(wb,t,m,T));
 const buf=await wb.xlsx.writeBuffer();return{blob:new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),name:`PAYMENT SUMMARY (MY TOOL ${psFileDate()}).xlsx`,model:m,totals:T}}
async function psExport(btn){if(PSX.busy)return;if(!can("export")){toast("Export is not allowed for your role");return}PSX.busy=true;const lab=btn?btn.textContent:"";
 if(btn){btn.disabled=true;btn.textContent="Building the Excel file…"}
 try{const o=await psBuild();await saveBlob(o.blob,o.name);toast("Excel ready: "+o.name)}catch(e){console.error(e);toast(e&&/load/i.test(e.message)?e.message:"Could not build the Payment Summary")}
 finally{PSX.busy=false;if(btn&&btn.isConnected){btn.disabled=false;btn.textContent=lab}}}

/* ---------- button on Reports and Payments ---------- */
function psCard(v){if(!v||!can("export")||v.querySelector("#psxcard"))return;
 const html=`<div class="card" id="psxcard" style="padding:12px 14px;margin:0 0 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div style="flex:1 1 240px;min-width:0"><b>Payment Summary</b><div class="note">One tab per supplier, forwarder and inspector (one row per payment, grouped by order, receipt + invoice links, mixed-payment notes), plus INDEX and ALL PAYMENTS — the same layout and colours as the owner's PAYMENT SUMMARY sheet.</div></div><button type="button" class="btn pri" data-psx="export">⬇ Payment Summary (owner's sheet style)</button></div>`;
 const cr=v.querySelector(":scope > nav.crumb");if(cr)cr.insertAdjacentHTML("afterend",html);else v.insertAdjacentHTML("afterbegin",html)}
if(typeof vReports==="function"){const _psR=vReports;vReports=function(v){const r=_psR.apply(this,arguments);try{psCard(v)}catch(e){console.error(e)}return r}}
if(typeof vPayments==="function"){const _psP=vPayments;vPayments=function(v){const r=_psP.apply(this,arguments);try{psCard(v)}catch(e){console.error(e)}return r}}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-psx]");if(!b)return;e.preventDefault();if(b.dataset.psx==="export")psExport(b)});
