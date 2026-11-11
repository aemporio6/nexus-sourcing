/* ---------- one-time data corrections agreed with the owner (3 Nov 2026) ----------
   Up to 2024: kept exactly as in the Payment Summary sheet (only marked as checked so Data health stops asking).
   2025 onwards: matched to the sheet / Drive and corrected. Runs once (flag in Setup), only on a Setup-allowed device; never overwrites a record someone already changed after the check. */
async function dataFix20261103(){try{if(!S.ready||!can("setup")||!D.setup||D.setup.fix20261103)return;const done=[];
 const up=async(col,id,patch,why)=>{const x=docOf(col,id);if(!x)return;const ok=await updateDoc(col,id,patch,null,{noUndo:true,quiet:true,derived:true});if(ok){done.push(id);logEv("update",col,id,"Data check 3 Nov 2026: "+why)}};
 const note=(x,t)=>(x&&x.notes&&x.notes.includes(t))?x.notes:((x&&x.notes?x.notes+" | ":"")+t);
 const p148=docOf("payments","PAY-25-0148");if(p148&&!(p148.allocations||[]).length)await up("payments","PAY-25-0148",{type:"extra",tags:[...new Set([...(p148.tags||[]),"loan"])],allocations:[{amount:+p148.amount||156,belongsTo:"other",note:"LOAN to Emran (HK Next Focus) — $200 received by them; not a purchase"}],notes:note(p148,"LOAN to Emran 31 Dec 2025 (Drive 101-EMRAN/31-12-25 LOAN) — to be repaid or deducted")},"Emran £156 marked as a LOAN (not an order)");
 const p56=docOf("purchases","PO-26-0056");if(p56&&!p56.samePiAs)await up("purchases","PO-26-0056",{samePiAs:"PO-25-0049",notes:note(p56,"Same Joyce PI WAP-UK-JW20250925001 as PO-25-0049: that order = deposit + first 2,004 pcs + mould; this one = the remaining 4,230 pcs")},"linked to PO-25-0049 (same PI, second batch)");
 const p174=docOf("payments","PAY-26-0174");if(p174)await up("payments","PAY-26-0174",{notes:note(p174,"Joyce paid Colin ¥2,727 (= $406) for us on 10 Sep 2026 — check it is included in a later payment to Joyce")},"Colin $406 = ¥2,727 paid by Joyce");
 const p165=docOf("payments","PAY-26-0165");if(p165)await up("payments","PAY-26-0165",{notes:note(p165,"From the Drive receipt (SH-26-0049, 59 ctn; PI $1,093 + fees = $1,125). Not in the Payment Summary sheet — add it there")},"Sam $1,125 kept (Drive receipt)");
 const p138=docOf("payments","PAY-25-0138");if(p138)await up("payments","PAY-25-0138",{notes:note(p138,"PI dated 12 Sep 2025 (SH-25-0033, 23 ctn); paid 9 Nov 2025 as in the sheet")},"Sam SUP15-003: PI 12 Sep, paid 9 Nov");
 const p54=docOf("payments","PAY-24-0054");if(p54&&!(p54.tags||[]).includes("not_duplicate"))await up("payments","PAY-24-0054",{tags:[...new Set([...(p54.tags||[]),"not_duplicate"])],notes:note(p54,"Kept as in the sheet (two lines P4 and P5 of £1,884.75 on 8 Nov 2024)")},"2024: kept as in the sheet");
 const p15=docOf("purchases","PO-24-0015");if(p15&&!p15.samePiAs)await up("purchases","PO-24-0015",{samePiAs:"PO-24-0013",notes:note(p15,"Same PI VCL-202407-10 as PO-24-0013 — kept as in the sheet")},"2024: kept as in the sheet");
 await setupPatchMany([[["fix20261103"],nowIso()]],null,{noUndo:true});if(done.length)logEv("setup","setup","main","Data check 3 Nov 2026 applied to "+done.join(", "));S._att=null}catch(e){console.warn(e)}}
setTimeout(function tick(){try{if(S.ready){setTimeout(async()=>{await dataFix20261103();await dataFix20261103b();await dataFix20261111()},2500);return}}catch(_){}setTimeout(tick,1000)},1500);

/* 3 Nov 2026 (b): orders split from VAL-104 kept the £ total of the whole 546-carton PI — recompute £ at order from their own total × rate on the order date */
async function dataFix20261103b(){try{if(!S.ready||!can("setup")||!D.setup||D.setup.fix20261103b)return;const done=[];
 for(const no of ["PO-26-0065","PO-26-0066","PO-26-0069"]){const p=docOf("purchases",no);if(!p||p.status==="cancelled")continue;const want=r2(toGbp(poTotal(p),p.cur,p.date));if(!(want>0))continue;const have=+p.totalGbpAtOrder||0;
  if(Math.abs(have-want)>Math.max(1,want*0.005)){const ok=await updateDoc("purchases",no,{totalGbpAtOrder:want},null,{noUndo:true,quiet:true,derived:true});if(ok){done.push(no);logEv("update","purchases",no,`Data check 3 Nov 2026: £ at order ${fmt(have,"GBP")} → ${fmt(want,"GBP")} (its own total × rate on ${fmtD(p.date)})`)}}}
 await setupPatchMany([[["fix20261103b"],nowIso()]],null,{noUndo:true});S._att=null}catch(e){console.warn(e)}}

/* 11 Nov 2026: Joyce's two new CIs + the 10 Nov WorldFirst payment + three PSI inspection quotes (owner: "107 = 78 → 98 ctn, 108 = new 78 ctn, each invoice its own order").
   107 (PO-26-0069) becomes the 98-ctn CI WAP-UK-JW20261103002; a new order 108 holds the 78-ctn CI WAP-UK-JW20261103003; both come out of VAL-104 (PO-26-0065).
   The 8 Aug deposit (PAY-26-0171) is re-split to match Joyce's CIs; ¥50,603.52 of 10 Nov = 107 50% ¥24,111.36 + 108 ¥26,492.16. Runs once; skips anything already done. */
async function dataFix20261111(){try{if(!S.ready||!can("setup")||!D.setup||D.setup.fix20261111)return;const done=[];const o={noUndo:true,quiet:true,derived:true};
 const W="2026-11-11 data entry: ";const note=(x,t)=>(x&&x.notes&&x.notes.includes(t))?x.notes:((x&&x.notes?x.notes+" | ":"")+t);
 const pn=sku=>product(sku)?.name||sku;const L_=(rows,n)=>rows.map(([sku,q,u])=>({sku,p:pn(sku),q,u,a:r2(q*u),n,skuAuto:false}));
 const parent=docOf("purchases","PO-26-0065"),p107=docOf("purchases","PO-26-0069");if(!parent||!p107){await setupPatchMany([[["fix20261111"],nowIso()]],null,{noUndo:true});return}
 const D107="https://drive.google.com/drive/folders/178i-OdJs9nwRUE6GY98UBtiQNNqhovea",D108="https://drive.google.com/drive/folders/1eCfMAIrNjFd3ed6YHpCFGx9mcKgfnx31";
 const CI107="https://drive.google.com/file/d/1MGvyMswUBZDBql4uDGnnQOlirZTVqX7e/view",RC="https://drive.google.com/file/d/1SSsVGFnc1bouKppkIXLQnAbLR9mb0KQY/view";
 const old107=(p107.lines||[]).map(l=>[l.sku,+l.q||0]);
 const L98=[["WAL-TB-FBA-01",180,7.5],["WAL-TB-GRY-01",120,7.5],["WAL-TB-BLK-01",120,7.5],["WAL-TB-FBM-01",504,13.6],["WAL-TB-GRY-02",432,13.6],["WAL-TB-BLK-02",432,13.6],["WAL-TB-FBA-04",594,25.8],["WAL-TB-GRY-03",180,25.8],["WAL-TB-BLK-04",180,25.8]];
 const L78=[["WAL-TB-FBA-01",240,7.5],["WAL-TB-GRY-01",240,7.5],["WAL-TB-BLK-01",240,7.5],["WAL-TB-FBM-01",180,13.6],["WAL-TB-GRY-02",180,13.6],["WAL-TB-BLK-02",180,13.6],["WAL-TB-FBA-04",90,25.8],["WAL-TB-GRY-03",90,25.8],["WAL-TB-BLK-04",90,25.8],
  ["WAL-TB-WHT-P3",160,21],["WAL-TB-BLK-P3",160,21],["WAL-TB-GRY-P3",160,21],["WAL-TB-WHT-P6",36,39.5],["WAL-TB-BLK-P6",36,39.5],["WAL-TB-GRY-P6",36,39.5],["WAL-TB-WHT-P8",24,51.5],["WAL-TB-BLK-P8",24,51.5],["WAL-TB-GRY-P8",24,51.5],["WAL-TB-BEI-02",36,13.6],["WAL-TB-BLU-02",36,13.6],["WAL-TB-GRN-02",36,13.6]];
 /* only on the real data as it was on 5 Nov (not on demo / test copies), and only after pulling the latest file so two devices never both do it */
 if(!(+parent.ctn===342&&p107.piNo==="WAP-UK-JW20260805001-C")&&!(+p107.ctn===98)){await setupPatchMany([[["fix20261111"],nowIso()]],null,{noUndo:true});return}
 try{if(window.MYTOOL&&MYTOOL.syncNow){await MYTOOL.syncNow();await new Promise(z=>setTimeout(z,1500))}}catch(_){}if(D.setup.fix20261111)return;
 const already=+p107.ctn===98||live(D.purchases).some(x=>[].concat(x.oldRef||[]).includes("VAL-108"));
 if(!already){
  /* 1. 107 → 98 ctn */
  await updateDoc("purchases","PO-26-0069",{ctn:98,total:48222.72,lines:L_(L98,"CI WAP-UK-JW20261103002 (98 ctn)"),extras:[{kind:"fee",a:1854.72,n:"JOYCE 4% COST"}],piNo:"WAP-UK-JW20261103002",yourRef:"WAP-UK-JW20261103002",
   links:[{label:"CI 98 ctn",url:CI107},{label:"Old CI 78 ctn",url:"https://drive.google.com/file/d/1KB73on_7VAF-UZf690nNQYzTHZPq1F9Y/view"},{label:"Receipt 10 Nov",url:RC}],docs:{pi:{url:CI107}},totalGbpAtOrder:r2(toGbp(48222.72,"RMB",p107.date)),
   schedule:[{pct:30,label:"Deposit",dueEvent:"order",due:null,amount:14466.82,paid:"PAY-26-0171"},{pct:50,label:"Before shipping",dueEvent:"ship",due:null,amount:24111.36,paid:null},{pct:20,label:"On arrival at UK port",dueEvent:"arrive",due:null,amount:9644.54,paid:null}],
   notes:"Part of VAL-104 (PI WAP-UK-JW20260805001). 11 Nov: Joyce re-issued this order as 98 ctn — CI WAP-UK-JW20261103002 ¥48,222.72 (goods ¥46,368 + 4% ¥1,854.72). 30% ¥14,466.82 inside the 8 Aug deposit; 50% ¥24,111.36 paid 10 Nov (WorldFirst ¥50,603.52 with 108); 20% ¥9,644.54 at UK port. CHECK: the 2 Nov ¥19,317 (50% of the old 78-ctn CI) is not shown on Joyce's new CIs — ask Joyce for a credit or where it went."},null,o);done.push("PO-26-0069 → 98 ctn");
  /* 2. new order 108 = 78 ctn */
  const no108=nextNo("purchases","2026-11-03");
  await writeDoc("purchases",no108,{no:no108,id:no108,oldRef:"VAL-108",date:"2026-11-03",party:"SUP-001",account:p107.account||"c1",kind:"china",cur:"RMB",total:40802.11,lines:L_(L78,"CI WAP-UK-JW20261103003 (78 ctn)"),extras:[{kind:"fee",a:1569.31,n:"JOYCE 4% COST"}],
   piNo:"WAP-UK-JW20261103003",yourRef:"WAP-UK-JW20261103003",refType:"REP",partOf:"PO-26-0065",ctn:78,piBilledTo:"VARTLEAVES LIMITED",terms:"30_50_20_port",incoterm:p107.incoterm||"EXW",depositPct:30,status:"deposit",historic:false,folder:D108,
   links:[{label:"Drive folder 108",url:D108},{label:"Receipt 10 Nov",url:RC}],docs:{},totalGbpAtOrder:r2(toGbp(40802.11,"RMB","2026-11-03")),
   schedule:[{pct:15,label:"Deposit (30% of the old-design part, from 8 Aug)",dueEvent:"order",due:null,amount:6149.52,paid:"PAY-26-0171"},{pct:65,label:"Before shipping (50% + 30% of the new packs)",dueEvent:"ship",due:null,amount:26492.16,paid:null},{pct:20,label:"On arrival at UK port",dueEvent:"arrive",due:null,amount:8160.43,paid:null}],
   notes:"Part of VAL-104. CI WAP-UK-JW20261103003 78 ctn ¥40,802.11 (goods ¥39,232.80 + 4% ¥1,569.31). Old designs ¥19,710 (deposit 30% ¥6,149.52 from 8 Aug); NEW packs 3/6/8 and Beige/Blue/Green ¥19,522.80 (no deposit — 30% added to the 50% line). Paid 10 Nov ¥26,492.16; 20% ¥8,160.42 at UK port. CI file: upload to the Drive 108 folder (too big for the connector)."},null,o);done.push(no108+" (108) created");
  /* 3. parent VAL-104: old 107 back in, new 107 + 108 out */
  const q={};(parent.lines||[]).forEach(l=>q[l.sku]=+l.q||0);old107.forEach(([s,n])=>q[s]=(q[s]||0)+n);L98.concat(L78).forEach(([s,n])=>q[s]=(q[s]||0)-n);
  const short=Object.entries(q).filter(([,n])=>n<0).map(([s,n])=>s+" "+n);
  const pl=(parent.lines||[]).map(l=>{const nq=Math.max(0,q[l.sku]);return{...l,q:nq,a:l.u!=null&&l.u!==""?r2(nq*l.u):l.a,n:"SEA_SHIPPING sheet (420 ctn) minus 98-ctn (107) and 78-ctn (108) parts"}});
  const ptot=r2(226046.49-(48222.72-38634.34)-20498.40);
  await updateDoc("purchases","PO-26-0065",{lines:pl,ctn:244,total:ptot,extras:[{kind:"fee",a:r2(ptot*0.04/1.04),n:"JOYCE 4% COST"}],totalGbpAtOrder:r2(toGbp(ptot,"RMB",parent.date)),
   schedule:[{pct:30,label:"Deposit",due:"2026-08-08",dueEvent:null,amount:58787.76,paid:"PAY-26-0171"},{pct:50,label:"Before shipping",due:null,dueEvent:"ship",amount:r2(ptot*0.5),paid:null},{pct:20,label:"Before arrival",due:null,dueEvent:"arrive",amount:r2(ptot-58787.76-r2(ptot*0.5)),paid:null}],
   notes:note(parent,"11 Nov: 107 is now 98 ctn and 108 (78 ctn) split out → this order = remaining 244 ctn. PI money left ¥"+ptot.toLocaleString("en-GB")+" (new packs are extra to the PI: P3 ¥21, P6 ¥39.5, P8 ¥51.5, 2-pack colours ¥13.6 per set, from CI 003)."+(short.length?" SHORT: "+short.join(", "):""))},null,o);done.push("PO-26-0065 → 244 ctn");
  /* 4. 8 Aug deposit re-split */
  const p171=docOf("payments","PAY-26-0171");if(p171){const al=(p171.allocations||[]).filter(a=>!["PO-26-0065","PO-26-0069",no108].includes(a.ref));
   await updateDoc("payments","PAY-26-0171",{allocations:[{ref:"PO-26-0065",amount:58787.76},...al,{ref:"PO-26-0069",amount:14466.82},{ref:no108,amount:6149.52}],notes:note(p171,"11 Nov: re-split to Joyce's new CIs — 107 ¥14,466.82, 108 ¥6,149.52, VAL-104 rest ¥58,787.76")},null,o);done.push("PAY-26-0171 re-split")}
  /* 5. the 10 Nov payment */
  const pay=nextNo("payments","2026-11-10");
  await writeDoc("payments",pay,{no:pay,id:pay,date:"2026-11-10",party:"SUP-001",forRef:"PO-26-0069",type:"balance",refType:"BAL",cur:"RMB",amount:50603.52,gbp:r2(toGbp(50603.52,"RMB","2026-11-10")),bank:"b2",company:"c1",status:"paid",platform:"worldfirst",paidBy:"company",direction:"out",dept:"supplier",
   yourRef:"20261110160280214005300057485584",allocations:[{ref:"PO-26-0069",amount:24111.36},{ref:no108,amount:26492.16}],receipt:RC,docs:{receipt:{url:RC}},source:"WorldFirst screenshot 10 Nov",approved:true,needsApproval:false,historic:false,
   desc:"Joyce Wen — 107 (98 ctn) 50% + 108 (78 ctn) 50% + 30% new packs",notes:"WorldFirst ¥50,603.52 CNH, 10 Nov 2026 = 107 ¥24,111.36 + 108 ¥26,492.17 (Joyce CI 002 + CI 003)."},null,o);done.push(pay+" ¥50,603.52");
  const s107=docOf("purchases","PO-26-0069");if(s107)await updateDoc("purchases","PO-26-0069",{schedule:s107.schedule.map((m,i)=>i===1?{...m,paid:pay}:m)},null,o);
  const s108=docOf("purchases",no108);if(s108)await updateDoc("purchases",no108,{schedule:s108.schedule.map((m,i)=>i===1?{...m,paid:pay}:m)},null,o);
 }
 /* 6. inspections (PSI quotes, ¥800 each) */
 if(!live(D.inspections).some(i=>(i.tags||[]).includes("psi-2026"))){
  const ins=[{po:"PO-26-0067",plannedDate:"2026-09-01",qty:400,txt:"105: 400 sets = 20 ctn (quote 1 Sep). Fee ¥800 is on PO-26-0068 (paid by Joyce, PAY-26-0172; repaid 2 Nov in PAY-26-0176).",fee:null,report:"https://drive.google.com/file/d/1GpbwY706_YG3yUK5n9G8q70viVnjtzTK/view"},
   {po:"PO-26-0066",plannedDate:"2026-10-10",qty:2952,txt:"106: 2,952 sets = 99 ctn (quote 10 Oct). NO payment found — pay ¥800 or tell us who paid.",fee:800,report:"https://drive.google.com/file/d/1_x0VWDRDbvxj0ykNYokc2GJs6RiGPsD0/view"},
   {po:"PO-26-0069",plannedDate:"2026-10-30",qty:2274,txt:"107: 2,274 sets = 78 ctn (quote 30 Oct) — the OLD 78-ctn CI; 107 is now 98 ctn (2,742 sets), so 20 ctn may not be inspected. ¥800 paid via Joyce 2 Nov (PAY-26-0176).",fee:800,report:"https://drive.google.com/file/d/1vIAHwaLU5rT5eNS5ShwNuph3y6nD71-v/view",pay:"PAY-26-0176"}];
  for(const x of ins){if(!docOf("purchases",x.po))continue;const no=nextNo("inspections",x.plannedDate);
   await writeDoc("inspections",no,{no,id:no,po:x.po,party:"INS-001",refType:"PRE",plannedDate:x.plannedDate,date:null,qtyInspected:x.qty,result:"pending",fee:x.fee,cur:"RMB",report:x.report,tags:["psi-2026"],docs:{},notes:"PSI Inspection Service Co. quote ¥800 / $120. "+x.txt+" Result: add when the report comes."},null,o);done.push(no+" for "+x.po);
   if(x.pay){const pp=docOf("payments",x.pay);if(pp){const al=(pp.allocations||[]).map(a=>(!a.ref&&a.amount===800&&/78 ctn/i.test(a.note||""))?{ref:no,amount:800}:a);await updateDoc("payments",x.pay,{allocations:al},null,o)}}}
  const p68=docOf("purchases","PO-26-0068");if(p68&&/^101-/.test(p68.desc||""))await updateDoc("purchases","PO-26-0068",{desc:"105 (VAL-105) — 8 Sep white P4 20 ctn for AGL, inspection ¥800 (paid by Joyce with Colin)",notes:"Inspection for order 105 (VAL-105, PO-26-0067; AGL 20 cartons P4 white); paid by Joyce, repaid 2 Nov"},null,o);
 }
 await setupPatchMany([[["fix20261111"],nowIso()]],null,{noUndo:true});if(done.length)logEv("setup","setup","main","Data entry 11 Nov 2026 (Joyce CIs 98 + 78 ctn, payment ¥50,603.52, PSI inspections): "+done.join(", "));S._att=null}catch(e){console.warn(e)}}
