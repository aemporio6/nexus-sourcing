// "What is new in a Drive folder": states, recommendation, approve one / the sure ones, company copy, link check, brands per company.
// Run: NODE_PATH=/opt/npm-tools/node_modules node tests/t_folderscan.js   (live-data copy on :8096)
process.env.MT_URL=process.env.MT_URL||"http://localhost:8096/index.html?demo";const h=require("./imp/h.js");
(async()=>{const {br,pg,errs}=await h.open();let ok=0,bad=0;const t=(n,c,x)=>{c?ok++:bad++;console.log((c?"PASS ":"FAIL ")+n+(c?"":" → "+String(JSON.stringify(x)).slice(0,700)))};
 await pg.evaluate(()=>{S.isOwner=true;const F="application/vnd.google-apps.folder";const X="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const tree={root:[{id:"f110",name:"110 | 300 Plunger | 24 Nov ",mimeType:F},{id:"f41",name:"41/ 24NOV  1000 Earwex ",mimeType:F},{id:"f108",name:"108-109 inspection",mimeType:F},{id:"fx",name:"misc",mimeType:F}],
   f110:[{id:"A1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",name:"110 | 24 Nov | Invoice |300 Plunger ",mimeType:X,size:"508297",modifiedTime:"2026-11-25T01:24:36Z",owners:[{emailAddress:"ahmaduk0044@gmail.com"}]},{id:"A2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",name:"110 | 24 Nov | Rcpt",mimeType:"image/jpeg",size:"37888",modifiedTime:"2026-11-25T01:25:55Z"}],
   f41:[{id:"B1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",name:"Invoice ",mimeType:X,size:"109519",modifiedTime:"2026-11-25T01:13:14Z"}],
   f108:[{id:"C1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",name:"108-109-Inspection Report ",mimeType:"application/pdf",size:"135592403",modifiedTime:"2026-11-25T02:25:30Z"}],
   fx:[{id:"D1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",name:"scan0007",mimeType:"image/jpeg",size:"1000",modifiedTime:"2026-11-25T03:00:00Z"}]};
  window.__dl=[];window.__DEMO_DRIVE={list:async id=>tree[id]||[],meta:id=>id==="root"?{id:"root",name:"Chinese suppliers",mimeType:F}:id==="DEAD0000000000000000000000000000X"?(()=>{const e=new Error("404 not found");e.status=404;throw e})():{id,name:id,mimeType:"x"},download:async id=>{window.__dl.push(id);return new File(["PK\x03\x04 xl/workbook"],"x",{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})}};
  fsOpen({folder:{id:"root",name:"Chinese suppliers"}})});
 await pg.waitForFunction(()=>S.fs&&!S.fs.loading&&S.fs.files.length===5);
 let st=await pg.evaluate(()=>S.fs.files.map(f=>({n:f.name.trim(),state:f.state,top:f.top&&f.top.id,pct:f.top&&f.top.pct,folder:f.folder})));
 const by=n=>st.find(x=>x.n.startsWith(n));
 t("walks sub-folders: 5 files, all New",st.length===5&&st.every(x=>x.state==="new"),st);
 t("a file called just 'Invoice' is placed by its FOLDER name (41 … Earwex → PO-26-0073)",by("Invoice").top==="PO-26-0073",by("Invoice"));
 t("110 invoice and 110 receipt → PO-26-0072; 108-109 report → PO-26-0070/71; 'scan0007' → no guess",by("110 | 24 Nov | Invoice").top==="PO-26-0072"&&by("110 | 24 Nov | Rcpt").top==="PO-26-0072"&&/PO-26-007[01]/.test(by("108-109").top)&&by("scan0007").top==null,st);
 let txt=await pg.textContent("#fswin");t("window: counts, 'Approve the sure ones', company-copy tick, Drive owner shown",/5<\/b> new|5 new/.test(await pg.innerHTML("#fswin"))&&/Approve the sure ones \(\d\)/.test(txt)&&/Keep a copy in the company Drive/.test(txt)&&/ahmaduk0044/.test(txt),txt.slice(0,300));
 // one file, with company copy
 await pg.click('#fswin [data-fs="put"][data-id="A1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"]');await pg.waitForFunction(()=>S.fs.done["A1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"]);
 st=await pg.evaluate(()=>{const l=(docOf("purchases","PO-26-0072").links||[]).find(x=>x.from==="drive import");return{l,dl:window.__dl,folderNo:docOf("purchases","PO-26-0072").folderNo,done:S.fs.done["A1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"]}});
 t("Put on PO-26-0072: a copy is kept in the company files, the link points to the copy and remembers the original; #110 remembered",st.l&&st.l.orig&&/A1AAAA/.test(st.l.orig)&&!/A1AAAA/.test(st.l.url)&&st.dl.includes("A1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")&&st.folderNo==="110"&&/copy kept/.test(st.done),st);
 st=await pg.evaluate(()=>{const f=S.fs.files.find(x=>x.id.startsWith("A2"));return{top:f.top&&f.top.id,pct:f.top&&f.top.pct,why:f.top&&f.top.why[0]}});
 t("what was just learned is used at once: the 110 receipt is now sure (folder number 110)",st.top==="PO-26-0072"&&st.pct>=60&&/folder number 110/.test(st.why),st);
 // the sure ones together
 await pg.click('#fswin [data-fs="allsure"]');await pg.waitForTimeout(200);txt=await pg.textContent("#fswin .rsoffer");t("'Approve the sure ones' first shows exactly what goes where",/will be put on their records/.test(txt)&&/→/.test(txt)&&!/scan0007/.test(txt),txt);
 const nSure=await pg.evaluate(()=>S.fs.confirm.length);await pg.click('#fswin [data-fs="allgo"]');await pg.waitForFunction(n=>Object.values(S.fs.done).filter(Boolean).length>=n+1&&S.fs.done["A2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"],nSure,{timeout:20000});
 st=await pg.evaluate(()=>({dl:window.__dl,big:(docOf("purchases","PO-26-0070").links||[]).concat(docOf("purchases","PO-26-0071").links||[]).find(l=>/Inspection Report/.test(l.label)),mem:fsMem().root}));
 t("the 135 MB report is kept as its own Drive link (not downloaded); the folder's last-looked time is remembered",st.big&&/C1CCCC/.test(st.big.url)&&!st.big.orig&&!st.dl.includes("C1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC")&&st.mem&&st.mem.at,st);
 await pg.click('#fswin [data-fs="put"][data-id="B1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"]');await pg.waitForFunction(()=>S.fs.done["B1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"],null,{timeout:20000});
 // look again
 await pg.click('#fswin [data-fs="reload"]');await pg.waitForFunction(()=>S.fs&&!S.fs.loading&&S.fs.files.length===5);await pg.waitForTimeout(200);
 st=await pg.evaluate(()=>({states:S.fs.files.map(f=>[f.name.trim().slice(0,12),f.state]),shown:fsShown().length}));
 t("looking again: what was taken is 'Already in MY TOOL' (also the one that became a company copy); only the rest is shown",st.states.filter(x=>x[1]==="have").length>=4&&st.shown<=1,st);
 await pg.evaluate(()=>{window.__DEMO_DRIVE.list=(o=>async id=>{const l=await o(id);return id==="f41"?l.map(f=>({...f,modifiedTime:"2027-01-01T00:00:00Z"})):l})(window.__DEMO_DRIVE.list);return fsLoad()});await pg.waitForFunction(()=>S.fs&&!S.fs.loading&&S.fs.files.length===5);
 t("a file edited in Drive after it was taken shows as 'Changed'",await pg.evaluate(()=>S.fs.files.find(f=>f.id.startsWith("B1")).state==="changed"));
 await pg.evaluate(()=>fsClose());
 // link check → Fix it
 st=await pg.evaluate(async()=>{window.__FS_TEST=true;Object.defineProperty(MYTOOL,"driveOk",{get:()=>true,configurable:true});await dbAttach("purchases","PO-26-0074",{label:"old packing list",url:"https://drive.google.com/file/d/DEAD0000000000000000000000000000X/view"});const dead=await fsLinkCheck(true);return{dead:Object.keys(dead||{}),fix:fxList(false).filter(x=>/^dead:/.test(x.id)).map(x=>x.title)}});
 t("weekly link check: a link that no longer opens is found and shows in Fix it",st.dead.includes("DEAD0000000000000000000000000000X")&&st.fix.some(x=>/PO-26-0074 no longer opens/.test(x)),st);
 // companies: other names + brands
 st=await pg.evaluate(async()=>{const cs=JSON.parse(JSON.stringify(SET().companies));cs[1].aliasText="VLOOK LTD; Vlook Limited";await setupPatch(["companies"],cs,"t");const html=sCompanies();const p=live(D.purchases).find(x=>!x.historic&&x.account&&(x.lines||[]).some(l=>product(l.sku)?.brand));const b=product(p.lines.find(l=>product(l.sku)?.brand).sku).brand;const cs2=JSON.parse(JSON.stringify(SET().companies));const other=cs2.find(c=>c.id!==p.account&&!c.archived);other.brands=[b];await setupPatch(["companies"],cs2,"t2");return{m:fxCoMatch("Vlook Limited, Company number 14000237")?.id,want:cs[1].id,card:/Other names and brands of each company/.test(html)&&/Brands of this company/.test(html),fix:fxList(false).filter(x=>/^brandco:/.test(x.id)).map(x=>x.title).slice(0,1),po:p.no}});
 t("Settings › Companies: 'Other names on invoices' works for matching; brands per company",st.m===st.want&&st.card,st);
 t("an order whose brand belongs to another company shows in Fix it",st.fix.length===1&&st.fix[0].includes("belongs to"),st);
 t("Create has 'What is new in a Drive folder?'",await pg.evaluate(()=>chItems().some(i=>i.key==="x:folderscan")));
 t("no page errors",!errs.length,errs);console.log(`\n${ok} pass, ${bad} fail`);await br.close();process.exit(bad?1:0)})();
