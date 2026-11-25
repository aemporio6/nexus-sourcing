// Share → MY TOOL: what the service worker kept is shown, placed on a record (file kept in the files folder first), text as a note.
// Needs the LIVE-DATA copy build on :8096.  Run: NODE_PATH=/opt/npm-tools/node_modules node tests/t_share.js
process.env.MT_URL=process.env.MT_URL||"http://localhost:8096/index.html?demo";const h=require("./imp/h.js");const fs=require("fs"),path=require("path");
(async()=>{const {br,pg,errs}=await h.open();let ok=0,bad=0;const t=(n,c,x)=>{c?ok++:bad++;console.log((c?"PASS ":"FAIL ")+n+(c?"":" → "+String(JSON.stringify(x)).slice(0,600)))};
 const R=path.join(__dirname,"..");const man=JSON.parse(fs.readFileSync(path.join(R,"manifest.webmanifest"),"utf8"));const sw=fs.readFileSync(path.join(R,"src/sw.template.js"),"utf8");
 t("manifest: share target takes files, text and links by POST",man.share_target&&man.share_target.method==="POST"&&man.share_target.enctype==="multipart/form-data"&&man.share_target.params.files[0].accept.includes("image/*")&&man.share_target.action==="./share-in");
 t("service worker: keeps the share on the phone and opens the app",/share-in/.test(sw)&&/mytool-share/.test(sw)&&/\?shared=1/.test(sw));
 // what the service worker would have stored
 await pg.evaluate(async()=>{const c=await caches.open("mytool-share");for(const k of await c.keys())await c.delete(k);
  const put=async(id,meta,files)=>{let i=0;meta.files=[];for(const f of files){const k="share/"+id+"/"+(i++);await c.put(k,new Response(new Blob([f.body],{type:f.type}),{headers:{"Content-Type":f.type}}));meta.files.push({k,name:f.name,type:f.type,size:f.body.length})}await c.put("share/"+id+"/meta",new Response(JSON.stringify({id,at:new Date().toISOString(),title:"",text:"",url:"",...meta})))};
  await put("a1",{text:"110 plunger receipt 24 Nov"},[{name:"IMG-20261124-WA0007.jpg",type:"image/jpeg",body:"\xFF\xD8\xFFjpegdata"}]);
  await put("a2",{title:"108-109 inspection report",url:"https://drive.google.com/file/d/1HFrO6sM0keaKHz3Ikcfk-13-zFITRdLD/view"},[]);
  await put("a3",{text:"Colin says the earwax cartons are 5 now, not 6"},[])});
 await pg.evaluate(()=>shOpen());await pg.waitForSelector("#shwin");await pg.waitForTimeout(200);
 let st=await pg.evaluate(()=>({n:shItems().length,kinds:shItems().map(i=>i.kind),txt:document.getElementById("shwin").textContent}));
 t("the window lists the photo, the link and the text",st.n===3&&st.kinds.join()==="file,link,text"&&/IMG-20261124/.test(st.txt)&&/Add to Home screen/.test(st.txt),st);
 t("the WhatsApp caption is used: photo named IMG-… is recognised as the plunger receipt",/Payment receipt/.test(st.txt)&&/PO-26-0072/.test(st.txt),st.txt.slice(0,500));
 // place the photo
 const nAssets=await pg.evaluate(()=>Object.keys(localStorage).length);
 await pg.click('#shwin [data-sh="place"][data-k="share/a1/0"]');await pg.waitForSelector("#dbpwin");
 st=await pg.evaluate(()=>({url:S.dbp.item.url,rec:S.dbp.rec,src:S.dbp.item.src}));t("the photo is kept first (it has a link), then “Where does this go?” opens with the recommendation",!!st.url&&st.rec==="PO-26-0072"&&st.src==="share",st);
 await pg.click('#dbpwin [data-dbp="ok"]');await pg.waitForTimeout(700);
 st=await pg.evaluate(async()=>({links:(docOf("purchases","PO-26-0072").links||[]).filter(l=>l.from==="share").length,done:Object.values(S.sh.done),left:(await shLoad()).map(m=>m.id)}));
 t("approved: on PO-26-0072 (from: share); it left the phone's waiting list",st.links===1&&/put on PO-26-0072/.test(st.done.join())&&!st.left.includes("a1"),st);
 // the link
 await pg.click('#shwin [data-sh="place"][data-k="a2:link"]');await pg.waitForSelector("#dbpwin");st=await pg.evaluate(()=>({url:S.dbp.item.url,sure:dbSure(S.dbp.rank.list)?.id,kind:S.dbp.rank.F.kind}));
 t("a shared Drive link (135 MB report): recommendation by folder number, nothing is downloaded",/1HFrO6s/.test(st.url)&&/PO-26-007[01]/.test(st.sure||"")&&st.kind==="inspection",st);
 await pg.evaluate(()=>dbPlaceClose());
 // the text → note
 await pg.click('#shwin [data-sh="place"][data-k="a3:text"]');await pg.waitForSelector("#dbpwin");await pg.selectOption('#dbpwin [data-dbp-f="col"]',"purchases");await pg.fill('#dbpwin [data-dbp-f="q"]',"PO-26-0073");await pg.waitForTimeout(150);await pg.selectOption('#dbpwin [data-dbp-f="rec"]',"PO-26-0073");await pg.waitForTimeout(100);await pg.click('#dbpwin [data-dbp="ok"]');await pg.waitForTimeout(700);
 st=await pg.evaluate(async()=>({notes:docOf("purchases","PO-26-0073").notes,left:(await shLoad()).map(m=>m.id)}));t("a shared text is kept as a note on the chosen order",/cartons are 5 now/.test(st.notes||"")&&/\[shared /.test(st.notes)&&!st.left.includes("a3"),st);
 // remove
 await pg.click('#shwin [data-sh="drop"][data-k="a2:link"]');await pg.waitForTimeout(300);st=await pg.evaluate(async()=>(await shLoad()).length);t("Remove forgets it",st===0,st);
 await pg.evaluate(()=>shClose());
 t("Create has it (Import & files)",await pg.evaluate(()=>chItems().some(i=>i.key==="x:sharein"&&i.dept==="Import & files")));
 t("no page errors",!errs.length,errs);console.log(`\n${ok} pass, ${bad} fail`);await br.close();process.exit(bad?1:0)})();
