// Where the data lives: company data only, the Owner's switch, Drive off for the team (with guidance + history), the "in step" line.
// Run: NODE_PATH=/opt/npm-tools/node_modules node tests/t_dataplace.js   (live-data copy on :8096)
process.env.MT_URL=process.env.MT_URL||"http://localhost:8096/index.html?demo";const h=require("./imp/h.js");const fs=require("fs"),path=require("path");
(async()=>{const {br,pg,errs}=await h.open();let ok=0,bad=0;const t=(n,c,x)=>{c?ok++:bad++;console.log((c?"PASS ":"FAIL ")+n+(c?"":" → "+String(JSON.stringify(x)).slice(0,600)))};
 const g=fs.readFileSync(path.join(__dirname,"../src/gshim.js"),"utf8");
 t("sign-in: no 'Which data do you want to open?' any more; company data is the only button unless the device was switched",!/Which data do you want to open/.test(g)&&/Sign in — company data \(Vartleaves\)/.test(g)&&/This device is set to ANOTHER data place/.test(g));
 // Owner card
 await pg.evaluate(()=>{S.isOwner=true;go("setup",{tab:"backup"},{force:true})});await pg.waitForTimeout(400);
 let st=await pg.evaluate(()=>({card:sBackup().includes("Where the data lives"),btn:/Open another data place on THIS device/.test(sBackup()),tbl:/Who opened MY TOOL/.test(sBackup()),menu:alWsHtml()}));
 t("Owner: Settings shows 'Where the data lives' with the switch for THIS device and who-opened table",st.card&&st.btn&&st.tbl,st);
 t("🔒 menu no longer offers another data place",!/My own Drive|data-al="ws"/.test(st.menu),st);
 // not an Owner
 await pg.evaluate(()=>{window.__DP_TEST=true;S.isOwner=false;const u=(SET().users||[]).find(u=>u.role!=="admin"&&u.active!==false)||{uid:"va@test",role:"va",name:"VA"};window.__u=u.uid;S.realRole=S.role=u.role||"va";uid=u.uid});
 st=await pg.evaluate(()=>({card:dpCard(),allowed:dpDriveAllowed()}));t("team member: no card at all, Drive from MY TOOL is off",st.card===""&&st.allowed===false,st);
 await pg.evaluate(()=>{go("import",{},{force:true});ixDrv().open=true;ixDriveRender()});await pg.waitForTimeout(300);
 st=await pg.evaluate(()=>({txt:document.querySelector("#ix_drive")?.textContent||"",log:D.log.find(e=>e.kind==="blocked")?.text,link:null}));
 t("team member opens 'From Google Drive' → stopped, told what to do instead (4 ways)",/switched off for you/.test(st.txt)&&/Share → MY TOOL/.test(st.txt)&&/upload link/.test(st.txt)&&/ask the Owner/i.test(st.txt),st.txt.slice(0,300));
 t("… the attempt is written in their history",/Tried: import from a Google Drive/.test(st.log||""),st);
 st=await pg.evaluate(async()=>({r:await driveOpenLink("https://drive.google.com/drive/folders/1YKQEDrftRiI81VkZH2wtIogiaY2URNf6"),scan:(await inboxScan()).length}));t("a pasted Drive link is refused too; the Drive inbox does not run",st.r===null&&st.scan===0,st);
 await pg.click('[data-dp="ask"]');await pg.waitForTimeout(200);t("'Ask the Owner' leaves a request",await pg.evaluate(()=>D.log.some(e=>e.kind==="ask"&&/Use Google Drive/.test(e.text))));
 // the Owner gives the switch
 st=await pg.evaluate(()=>{const us=SET().users||[];const u=us.find(x=>x.uid===window.__u);if(!u)return{skip:true};u.perms={...(u.perms||{}),drive:true};return{allowed:dpDriveAllowed(),gen:PP_GEN.some(x=>x[0]==="drive")}});
 t("People & Access has the switch 'Use Google Drive from MY TOOL'; with it on, Drive works for that person",st.skip||(st.allowed&&st.gen),st);
 // line
 await pg.evaluate(()=>{S.isOwner=true;go("home",{},{force:true})});await pg.waitForTimeout(400);
 st=await pg.evaluate(()=>document.getElementById("dpline")?.textContent||"");t("every page shows which data this is: 'Company data · Vartleaves'",/Company data · Vartleaves/.test(st),st);
 st=await pg.evaluate(()=>{logEv("seen","users",(SET().users||[])[0].uid,"Opened MY TOOL · version abc1234 · computer");return dpSeenRows()[0]});t("who-opened table: last opening and version per person, older version marked",st.ver==="abc1234"&&st.old===true&&!!st.at,st);
 t("no page errors",!errs.length,errs);console.log(`\n${ok} pass, ${bad} fail`);await br.close();process.exit(bad?1:0)})();
