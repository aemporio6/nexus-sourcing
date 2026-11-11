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
setTimeout(function tick(){try{if(S.ready){setTimeout(async()=>{await dataFix20261103();await dataFix20261103b();await dataFix20261111();await dataFix20261111b();await dataFix20261111c();await dataFix20261111d();await dataFix20261111e()},2500);return}}catch(_){}setTimeout(tick,1000)},1500);

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

/* 11 Nov 2026 (b), owner: "the old 78 ctn (107) were already 50% paid on 2 Nov; the 98-ctn CI IS those 78, and on 10 Nov I paid the 98 + the new 78 again.
   So the 2 Nov ¥19,317 is left over: put it on the 99-ctn road order's 20% (106, due now), and show what is still left." Also: 247 cartons remain on VAL-104, not 244. */
async function dataFix20261111b(){try{if(!S.ready||!can("setup")||!D.setup||D.setup.fix20261111b||!D.setup.fix20261111)return;const o={noUndo:true,quiet:true,derived:true};const done=[];
 const p176=docOf("payments","PAY-26-0176"),p66=docOf("purchases","PO-26-0066"),p69=docOf("purchases","PO-26-0069"),p65=docOf("purchases","PO-26-0065");
 const a=p176&&(p176.allocations||[]).find(x=>x.ref==="PO-26-0069"&&Math.abs(+x.amount-19317)<0.01);
 if(a&&p66&&p69&&+p69.ctn===98){
  const due66=r2(Math.max(0,poState(p66).outstandingCur));const to66=Math.min(due66,19317),left=r2(19317-to66);
  const al=[];(p176.allocations||[]).forEach(x=>{if(x===a){al.push({ref:"PO-26-0066",amount:to66,note:"106 (99 ctn road) 20% — paid from the old 78-ctn 50% left over"});if(left>0)al.push({ref:"PO-26-0069",amount:left,note:"LEFT OVER with Joyce from the old 78-ctn 50% — counts towards 107's 20%"})}else al.push(x)});
  await updateDoc("payments","PAY-26-0176",{allocations:al,notes:((p176.notes||"")+" | 11 Nov (owner): the old 78-ctn order became the 98-ctn CI and its 50% was paid again on 10 Nov, so this ¥19,317 is left over → ¥"+to66.toLocaleString("en-GB")+" used for 106's 20%, ¥"+left.toLocaleString("en-GB")+" still with Joyce (shown on 107).").replace(/^ \| /,"")},null,o);done.push("PAY-26-0176 ¥19,317 → 106 20% ¥"+to66+" + left ¥"+left);
  const sch=(p69.schedule||[]).map((m,i)=>i===2?{...m,label:"On arrival at UK port — ¥"+left.toLocaleString("en-GB")+" already with Joyce (old 78-ctn left over), to pay ¥"+r2(m.amount-left).toLocaleString("en-GB")}:m);
  await updateDoc("purchases","PO-26-0069",{schedule:sch,notes:"Part of VAL-104 (PI WAP-UK-JW20260805001). This is the OLD 78-ctn order (for FBA/AWD), re-issued by Joyce on 3 Nov as 98 ctn — CI WAP-UK-JW20261103002 ¥48,222.72 (goods ¥46,368 + 4% ¥1,854.72). Paid: 30% ¥14,466.82 (8 Aug deposit), 50% ¥24,111.36 (10 Nov). The 2 Nov ¥19,317 (50% of the old 78-ctn CI) became extra: ¥"+to66.toLocaleString("en-GB")+" went to 106's 20%, ¥"+left.toLocaleString("en-GB")+" is LEFT OVER with Joyce and counts towards this order's 20% (¥9,644.54) → still to pay ¥"+r2(9644.54-left).toLocaleString("en-GB")+"."},null,o);
  const s66=(p66.schedule||[]);if(s66.length)await updateDoc("purchases","PO-26-0066",{schedule:s66.map((m,i)=>i===s66.length-1?{...m,paid:"PAY-26-0176"}:m)},null,o);
  await updateDoc("purchases","PO-26-0066",{notes:((p66.notes||"")+" | 11 Nov: 20% ¥"+to66.toLocaleString("en-GB")+" paid from the old 78-ctn 50% left over (PAY-26-0176, 2 Nov).").replace(/^ \| /,"")},null,o);done.push("106 20% settled");
 }
 if(p65&&+p65.ctn===244){await updateDoc("purchases","PO-26-0065",{ctn:247,notes:(p65.notes||"").replace("remaining 244 ctn","remaining 247 ctn (owner's count; the line quantities add up to 244 — 3 ctn to check)")},null,o);done.push("PO-26-0065 247 ctn")}
 await setupPatchMany([[["fix20261111b"],nowIso()]],null,{noUndo:true});if(done.length)logEv("setup","setup","main","Data entry 11 Nov 2026 (b): "+done.join(", "));S._att=null}catch(e){console.warn(e)}}

/* 11 Nov 2026 (c), owner: "order 069 shows 49 cartons, it is 98". The AGL sea shipment SH-26-0056 (booked 3 Nov) still carried the OLD 78-ctn lines of 107
   (GRY-01 240, FBM-01 1404, FBA-04 630), so only the overlapping 49 ctn counted as shipped. The 98-ctn CI is those same goods → the shipment carries the 9 CI lines, 98 ctn. */
async function dataFix20261111c(){try{if(!S.ready||!can("setup")||!D.setup||D.setup.fix20261111c||!D.setup.fix20261111)return;const o={noUndo:true,quiet:true,derived:true};let done="";
 const sh=docOf("shipments","SH-26-0056"),po=docOf("purchases","PO-26-0069");
 const old=sh&&JSON.stringify((sh.lines||[]).map(l=>[l.po,l.sku,+l.q]))===JSON.stringify([["PO-26-0069","WAL-TB-GRY-01",240],["PO-26-0069","WAL-TB-FBM-01",1404],["PO-26-0069","WAL-TB-FBA-04",630]]);
 if(old&&po&&+po.ctn===98){
  const lines=(po.lines||[]).filter(l=>l.sku&&+l.q>0).map(l=>{const pr=product(l.sku);return{po:"PO-26-0069",sku:l.sku,q:+l.q,ctn:pr?.perCtn?Math.ceil(+l.q/pr.perCtn):null}});
  const ctn=lines.reduce((a,l)=>a+(+l.ctn||0),0);let kg=0,cbm=0,all=true;lines.forEach(l=>{const c=product(l.sku)?.ctn;if(c&&c.kg&&c.L&&c.W&&c.H){kg+=l.ctn*c.kg;cbm+=l.ctn*c.L*c.W*c.H/1e6}else all=false});
  const ch={lines,ctn,goods:lines.map(l=>(product(l.sku)?.name||l.sku)+" ×"+l.q).join(", "),notes:((sh.notes||"").trim()+" | 11 Nov: lines changed to Joyce's 98-ctn CI WAP-UK-JW20261103002 (the old 78-ctn goods re-issued as 98 ctn). Was 78 ctn / "+sh.kg+" kg / "+sh.cbm+" cbm. CHECK with AGL: freight £"+sh.cost+" was quoted for 78 ctn.").replace(/^ \| /,"")};
  if(all){ch.kg=r2(kg);ch.cbm=Math.round(cbm*1000)/1000}
  await updateDoc("shipments","SH-26-0056",ch,null,o);done="SH-26-0056 → 98 ctn ("+lines.length+" lines"+(all?", "+ch.kg+" kg, "+ch.cbm+" cbm":"")+")"}
 const p70=live(D.purchases).find(x=>[].concat(x.oldRef||[]).includes("VAL-108"));const CI108="https://drive.google.com/file/d/1NdU5uTZInTffWSa2roXZlZ8pc98vW8xw/view";
 if(p70&&!(p70.docs&&p70.docs.pi)){await updateDoc("purchases",p70.no,{docs:{...(p70.docs||{}),pi:{url:CI108}},links:[{label:"CI 78 ctn",url:CI108},...(p70.links||[])],notes:(p70.notes||"").replace(" CI file: upload to the Drive 108 folder (too big for the connector).","")},null,o);done+=(done?", ":"")+p70.no+" CI linked"}
 await setupPatchMany([[["fix20261111c"],nowIso()]],null,{noUndo:true});if(done)logEv("setup","setup","main","Data entry 11 Nov 2026 (c): "+done);S._att=null}catch(e){console.warn(e)}}

/* 11 Nov 2026 (d): Joyce's 247-ctn CI WAP-UK-JW20261103001 = the rest of VAL-104 → own order 109 (to Amazon). VAL-104 is now fully split (99 + 98 + 78 + 247 = 522 ctn).
   Joyce's CIs only use ¥56,300.41 of the ¥94,054 8 Aug deposit (106 14,649.90 · 107 14,466.82 · 108 6,149.52 · 109 21,034.17) → ¥37,753.59 stays on PO-26-0065 and shows as "Joyce owes us".
   Also: product-information sheets + CI + inspection links on 107 / 108 / 109. */
async function dataFix20261111d(){try{if(!S.ready||!can("setup")||!D.setup||D.setup.fix20261111d||!D.setup.fix20261111c)return;const o={noUndo:true,quiet:true,derived:true};const done=[];
 const parent=docOf("purchases","PO-26-0065");const PI_F="https://drive.google.com/drive/folders/1AR43hH5G9LXkigbIy5URCjZpdbM7r2Is",F109="https://drive.google.com/drive/folders/1FeOO0KvJC-vg1a436hhLArA8Hnkl7t-p";
 const addLinks=async(no,ls)=>{const x=docOf("purchases",no);if(!x)return;const have=new Set((x.links||[]).map(l=>l.url));const nl=[...(x.links||[]),...ls.filter(l=>!have.has(l.url))];if(nl.length!==(x.links||[]).length)await updateDoc("purchases",no,{links:nl},null,o)};
 if(parent&&+parent.ctn===247&&!live(D.purchases).some(x=>[].concat(x.oldRef||[]).includes("VAL-109"))){
  const pn=sku=>product(sku)?.name||sku;
  const R=[["WAL-TB-FBA-01",120,7.5],["WAL-TB-GRY-01",180,7.5],["WAL-TB-BLK-01",180,7.5],["WAL-TB-FBM-01",1116,13.6],["WAL-TB-GRY-02",576,13.6],["WAL-TB-BLK-02",576,13.6],["WAL-TB-FBA-04",810,25.8],["WAL-TB-GRY-03",234,25.8],["WAL-TB-BLK-04",234,25.8],
   ["WAL-TB-WHT-P3",416,21],["WAL-TB-BLK-P3",224,21],["WAL-TB-GRY-P3",224,21],["WAL-TB-WHT-P6",156,39.5],["WAL-TB-BLK-P6",108,39.5],["WAL-TB-GRY-P6",108,39.5],["WAL-TB-WHT-P8",104,51.5],["WAL-TB-BLK-P8",64,51.5],["WAL-TB-GRY-P8",64,51.5],["WAL-TB-BEI-02",216,13.6],["WAL-TB-BLU-02",216,13.6],["WAL-TB-GRN-02",216,13.6]];
  const lines=R.map(([sku,q,u])=>({sku,p:pn(sku),q,u,a:r2(q*u),n:"CI WAP-UK-JW20261103001 (247 ctn)",skuAuto:false}));
  const no=nextNo("purchases","2026-11-03");
  await writeDoc("purchases",no,{no,id:no,oldRef:"VAL-109",date:"2026-11-03",party:"SUP-001",account:parent.account||"c1",kind:"china",cur:"RMB",total:125856.64,lines,extras:[{kind:"fee",a:4840.64,n:"JOYCE 4% COST"}],
   piNo:"WAP-UK-JW20261103001",yourRef:"WAP-UK-JW20261103001",refType:"REP",partOf:"PO-26-0065",ctn:247,piBilledTo:"VARTLEAVES LIMITED",terms:"30_50_20_port",incoterm:"EXW",depositPct:30,status:"deposit",historic:false,folder:F109,
   links:[{label:"Drive folder 109",url:F109},{label:"Product info sheets",url:PI_F}],docs:{},totalGbpAtOrder:r2(toGbp(125856.64,"RMB","2026-11-03")),
   schedule:[{pct:17,label:"Deposit (30% of the old designs, from 8 Aug)",dueEvent:"order",due:null,amount:21034.17,paid:"PAY-26-0171"},{pct:63,label:"Before shipping (50% + 30% of the new packs)",dueEvent:"ship",due:null,amount:79651.15,paid:null},{pct:20,label:"On arrival at UK port",dueEvent:"arrive",due:null,amount:25171.32,paid:null}],
   notes:"Part of VAL-104 — the last 247 ctn, to Amazon. CI WAP-UK-JW20261103001 ¥125,856.64 (goods ¥121,016 + 4% ¥4,840.64), 6,142 packs. Old designs ¥67,417.20 (deposit 30% ¥21,034.17 from 8 Aug); NEW packs 3/6/8 and Beige/Blue/Green ¥53,598.80 (no deposit — 30% added to the 50% line). Before shipping ¥79,651.15; 20% ¥25,171.33 at UK port."},null,o);done.push(no+" (109, 247 ctn) created");
  const p171=docOf("payments","PAY-26-0171");if(p171){const al=[];(p171.allocations||[]).forEach(a=>{if(a.ref==="PO-26-0065"&&Math.abs(+a.amount-58787.76)<0.01){al.push({ref:no,amount:21034.17});al.push({ref:"PO-26-0065",amount:37753.59,note:"Not on any Joyce CI (106/107/108/109 use ¥56,300.41 of ¥94,054) — ask Joyce"})}else al.push(a)});
   await updateDoc("payments","PAY-26-0171",{allocations:al,notes:((p171.notes||"")+" | 11 Nov: 109 ¥21,034.17; ¥37,753.59 left on VAL-104 (not shown on any Joyce CI).").replace(/^ \| /,"")},null,o);done.push("PAY-26-0171: 109 ¥21,034.17, ¥37,753.59 left")}
  await updateDoc("purchases","PO-26-0065",{lines:[],extras:[],ctn:0,total:0,schedule:[],totalGbpAtOrder:0,
   notes:"VAL-104 = PI WAP-UK-JW20260805001 (546 ctn, ¥313,513.82, 30% ¥94,054 paid 8 Aug). Fully split by Joyce's CIs: 106 (99 ctn road), 107 (98 ctn), 108 (78 ctn, our warehouse), 109 (247 ctn) = 522 ctn. Joyce's four CIs use only ¥56,300.41 of the deposit → ¥37,753.59 is still with Joyce (shown as owed to us). Plus ¥9,550.41 old-78 left over on 107. Ask Joyce for a statement. 24 ctn of the PI (546 − 522) not invoiced."},null,o);done.push("PO-26-0065 → split done, ¥37,753.59 with Joyce");
  await addLinks(no,[]);
 }
 const D107="https://drive.google.com/file/d/1s-9HXy7TfjaClHPGnKGLyJ6k8eW1xqto/view",IQ107="https://drive.google.com/file/d/1vIAHwaLU5rT5eNS5ShwNuph3y6nD71-v/view";
 await addLinks("PO-26-0069",[{label:"Product info 98 ctn",url:D107},{label:"Inspection quote (78 ctn)",url:IQ107},{label:"Drive folder 107",url:"https://drive.google.com/drive/folders/178i-OdJs9nwRUE6GY98UBtiQNNqhovea"}]);
 const p70=live(D.purchases).find(x=>[].concat(x.oldRef||[]).includes("VAL-108"));if(p70)await addLinks(p70.no,[{label:"Product info sheets",url:PI_F}]);
 await setupPatchMany([[["fix20261111d"],nowIso()]],null,{noUndo:true});if(done.length)logEv("setup","setup","main","Data entry 11 Nov 2026 (d): "+done.join(", "));S._att=null}catch(e){console.warn(e)}}

/* 11 Nov 2026 (e): owner uploaded the big files → direct links: 108 product info, 109 CI + product info. */
async function dataFix20261111e(){try{if(!S.ready||!can("setup")||!D.setup||D.setup.fix20261111e||!D.setup.fix20261111d)return;const o={noUndo:true,quiet:true,derived:true};const done=[];
 const U=id=>"https://drive.google.com/file/d/"+id+"/view";
 const set=async(oldRef,ls,pi)=>{const x=live(D.purchases).find(q=>[].concat(q.oldRef||[]).includes(oldRef));if(!x)return;const have=new Set((x.links||[]).map(l=>l.url));
  const ch={links:[...ls.filter(l=>!have.has(l.url)),...(x.links||[])]};if(pi&&!(x.docs&&x.docs.pi))ch.docs={...(x.docs||{}),pi:{url:pi}};await updateDoc("purchases",x.no,ch,null,o);done.push(x.no)};
 await set("VAL-108",[{label:"Product info 78 ctn",url:U("1qKNeU_GCr48V56jgOhpq3144VPtQo4iK")}]);
 await set("VAL-109",[{label:"CI 247 ctn",url:U("1dkjbY41R0ryIOhbJ2E99XihS2XjHWOau")},{label:"Product info 247 ctn",url:U("1nZCdvKDfDxcbAh6KrllM2-YQwBDM5Iuj")}],U("1dkjbY41R0ryIOhbJ2E99XihS2XjHWOau"));
 await setupPatchMany([[["fix20261111e"],nowIso()]],null,{noUndo:true});if(done.length)logEv("setup","setup","main","Data entry 11 Nov 2026 (e): file links on "+done.join(", "));S._att=null}catch(e){console.warn(e)}}
