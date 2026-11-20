/* Move the data to the company account (wizard) + supplier upload link, end to end against the real gateway code (Node stub). Demo :8093 */
const{chromium}=require("playwright");const fs=require("fs");const{makeGateway}=require("./gw/stub");
const seedFile=JSON.parse(fs.readFileSync(process.env.SEED_FILE,"utf8"));const seed={format:"mytool-1",schema:1,savedBy:"aemporio6@gmail.com",data:seedFile.data||seedFile,tomb:{},revs:{}};
const tokens={T:{email:"aemporio6@gmail.com"}};const OLD=makeGateway(seed,tokens),NEW=makeGateway(null,tokens,null,"vartleaves.data@gmail.com");
const NEWURL="https://script.google.com/macros/s/NEWnewNEWnew123/exec";
/* two attachments in the old account's FILES folder, linked from a party */
const ff=OLD.ctx.DriveApp.createFolder("MY TOOL – FILES");const a1=ff.createFile("CI.pdf","pdf-1","application/pdf"),a2=ff.createFile("PL.xlsx","xls-2","x");
[[a1,"1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345"],[a2,"1ZyXwVuTsRqPoNmLkJiHgFeDcBa543210"]].forEach(([f,id])=>{const o=OLD.drive.files[f.getId()];delete OLD.drive.files[o.id];o.id=id;OLD.drive.files[id]=o}); /* real Drive ids are long */
/* "shared with the new account": the same two files are visible there, owned by the old account */
NEW.drive.n=100;NEW.ctx.DriveApp.createFolder("MY TOOL – FILES");[a1,a2].forEach(f=>{NEW.drive.files[f.getId()]={...OLD.drive.files[f.getId()],owner:"aemporio6@gmail.com"}});
{const c=OLD.call({op:"read",token:"T"});const b=JSON.parse(JSON.stringify(c.file));const k=Object.keys(b.data.parties)[0];b.data.parties[k].links=[{label:"CI",url:a1.getUrl()},{label:"PL",url:a2.getUrl()},{label:"outside",url:"https://drive.google.com/file/d/OUTSIDEoutsideOUTSIDE12345/view"}];OLD.call({op:"write",token:"T",base:c.version,body:b})}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 let moved=false;
 await p.exposeFunction("__gwNode",(op,extra,url)=>{const G=url===NEWURL||(moved&&!url)?NEW:OLD;return G.call({op,token:"T",...extra})});
 await p.addInitScript(()=>{window.__DEMO_GW=async(op,extra,url)=>{const j=await window.__gwNode(op,extra,url);if(j.error){const e=new Error(j.error);e.status=j.status;throw e}return j}});
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready&&!!SET().roles2}catch(e){return false}},null,{timeout:30000});await p.waitForTimeout(800);
 /* ---- move wizard ---- */
 await p.evaluate(()=>go("setup"));await p.waitForTimeout(300);await p.evaluate(()=>document.querySelector('[data-setup="users"]')?.click());await p.waitForTimeout(600);
 ok(await p.evaluate(()=>!!document.querySelector('[data-mv="go"]')&&!!$("#mv_url")),"Setup › Users has “Move the data to the company account” (Owner)");
 await p.fill("#mv_url","https://example.com/x");await p.click('[data-mv="go"]');await p.waitForTimeout(600);ok(await p.evaluate(()=>/Web-app URL/.test(document.querySelector(".badbox")?.innerText||"")),"a wrong URL is refused before anything happens");
 /* someone saves during the copy → nothing is switched */
 const r1=await p.evaluate(async url=>{const real=window.__DEMO_GW;let n=0;window.__DEMO_GW=async(op,extra,u)=>{const j=await real(op,extra,u);if(op==="adopt"){const c=await real("read",{},"");const b=JSON.parse(JSON.stringify(c.file));b.data.purchases[Object.keys(b.data.purchases)[0]].notes="saved in between";await real("write",{base:c.version,body:b},"")}return j};try{await mvRun(url,()=>{});return"moved"}catch(e){return e.message}finally{window.__DEMO_GW=real}},NEWURL);
 ok(/Someone saved a change/.test(r1)&&!(OLD.call({op:"read",token:"T"}).file.data.setup.main.movedTo),"someone saves during the copy → stops, nothing switched ("+r1.slice(0,40)+"…)");
 await p.fill("#mv_url",NEWURL);await p.click('[data-mv="go"]');await p.waitForFunction(()=>S.mv&&!S.mv.busy,null,{timeout:60000});
 const st=await p.evaluate(()=>JSON.stringify(S.mv));ok(await p.evaluate(()=>S.mv.done&&!S.mv.err&&Object.values(S.mv.lines).length===5&&Object.values(S.mv.lines).every(l=>l.done)),"second press (replaces the unfinished copy): all 5 steps ticked "+(JSON.parse(st).err||""));
 const of=OLD.call({op:"read",token:"T"}).file,nf=NEW.call({op:"read",token:"T"}).file;
 ok(of.data.setup.main.movedTo&&of.data.setup.main.movedTo.gateway===NEWURL&&of.data.setup.main.movedTo.account==="vartleaves.data@gmail.com","old copy points to the new account");
 ok(Object.keys(of.data).every(c=>c==="setup"||c==="parties"||JSON.stringify(of.data[c])===JSON.stringify(nf.data[c]))&&Object.keys(nf.data.parties).length===Object.keys(of.data.parties).length&&nf.data.purchases[Object.keys(nf.data.purchases)[0]].notes==="saved in between","new account has every record — including the change saved in between");
 const k=Object.keys(nf.data.parties)[0];const L=nf.data.parties[k].links;ok(L[0].url!==a1.getUrl()&&L[1].url!==a2.getUrl()&&/drive\.google\.com\/file\/d\//.test(L[0].url)&&L[2].url.includes("OUTSIDEoutside"),"attachments copied into the new account and re-linked; a link outside MY TOOL stays");
 ok(Object.values(NEW.drive.files).filter(f=>f.folder==="MY TOOL – FILES"&&!f.owner).map(f=>f.content).filter((x,i,a)=>a.indexOf(x)===i).sort().join()==="pdf-1,xls-2","the copied files have the same content");
 ok(nf.data.setup.main.movedFrom&&!nf.data.setup.main.movedTo,"new copy remembers where it came from (for Go back)");
 {const c=OLD.call({op:"read",token:"T"});const bb=JSON.parse(JSON.stringify(c.file));bb.data.purchases[Object.keys(bb.data.purchases)[0]].notes="too late";const w=OLD.call({op:"write",token:"T",base:c.version,body:bb});ok(w.status===410,"the old copy refuses every save from now on")}
 moved=true;await p.waitForTimeout(3500);await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}},null,{timeout:30000});ok(await p.evaluate(()=>localStorage.getItem("mt_gw")),"this device now uses the new gateway (and reloaded)");
 /* ---- supplier upload link ---- */
 await p.waitForFunction(()=>!!SET().roles2,null,{timeout:30000});const sup=await p.evaluate(()=>{const x=live(D.parties).find(q=>q.type==="supplier");return{code:x.code,id:x.id||x.code,name:x.name}});
 await p.evaluate(s=>openDoc("parties",s.id),sup);await p.waitForTimeout(700);ok(await p.evaluate(()=>!!document.querySelector('.drawer [data-sl="make"]')),"supplier record has 📤 Upload link");
 await p.evaluate(()=>{document.querySelector(".drawer .slbox").open=true});await p.click('.drawer [data-sl="make"]');await p.waitForTimeout(900);
 const link=await p.evaluate(()=>S.slNew?.link||"");ok(/upload\.html#u=[A-Za-z0-9_-]{30,}&g=[A-Za-z0-9_-]+$/.test(link)&&await p.evaluate(()=>/copy it now/.test(document.querySelector(".drawer .slbox").innerText)&&!JSON.stringify(D.parties).includes(S.slNew.link.split("#u=")[1].split("&")[0])),"a link is made, shown once; only its hash is stored");
 const tok=link.split("#u=")[1].split("&")[0];const up=await p.evaluate(s=>docOf("parties",s.id).upload,sup);
 /* the gateway (same data) accepts the supplier's file with that secret */
 {const c=NEW.call({op:"read",token:"T"});const bb=JSON.parse(JSON.stringify(c.file));const pk=Object.keys(bb.data.parties).find(x=>(bb.data.parties[x].code||x)===sup.code)||Object.keys(bb.data.parties)[0];bb.data.parties[pk].upload=up;bb.data.parties[pk].code=bb.data.parties[pk].code||sup.code;NEW.call({op:"write",token:"T",base:c.version,body:bb});
  ok(NEW.call({op:"supplierInfo",tok}).ok===true,"the gateway recognises the link made in the app (same hash)");
  NEW.call({op:"supplierUpload",tok,name:"WAP-CI-247.pdf",mime:"application/pdf",b64:Buffer.from("%PDF demo").toString("base64"),kind:"Invoice (PI / CI)",note:"247 ctn"})}
 await p.evaluate(()=>{S.drawer=null;go("home")});await p.evaluate(()=>slLoad(true));await p.waitForTimeout(800);await p.evaluate(()=>render());await p.waitForTimeout(400);
 ok(await p.evaluate(()=>/From suppliers \(1\)/.test($("#slin")?.innerText||"")&&/WAP-CI-247\.pdf/.test($("#slin").innerText)&&/247 ctn/.test($("#slin").innerText)),"Home shows “From suppliers (1)” with file, kind and note");
 await p.click('#slin [data-slin="attach"]');await p.waitForTimeout(1200);
 ok(await p.evaluate(s=>(docOf("parties",s.id).links||[]).some(l=>/WAP-CI-247\.pdf/.test(l.label)&&/drive\.google\.com/.test(l.url))&&!document.querySelector("#slin"),sup),"Attach: the file is linked on the supplier’s record and leaves the list");
 ok(NEW.call({op:"inboxList",token:"T"}).list.length===0,"the inbox on the server is empty again");
 await p.evaluate(s=>openDoc("parties",s.id),sup);await p.waitForTimeout(600);await p.evaluate(()=>{document.querySelector(".drawer .slbox").open=true});await p.click('.drawer [data-sl="off"]');await p.waitForTimeout(800);ok(await p.evaluate(s=>docOf("parties",s.id).upload.on===false,sup),"Switch off works");
 /* after a move: a file attached THROUGH MY TOOL in the old account is fetched by the Owner's device and stored in the new one */
 const fx=await p.evaluate(async()=>{const OLDID="1oldOLDoldOLDoldOLDoldOLD_xyz";const pa=live(D.parties)[0];await rawSet("parties",pa.id,{...pa,docs:{ci:"drive:"+OLDID}});window.__DEMO_DRIVE={meta:id=>({id,name:"old CI.pdf",mimeType:"application/pdf"}),download:id=>new Blob(["%PDF old"],{type:"application/pdf"}),list:()=>[]};
  const r=await mvFixFiles();const now=docOf("parties",pa.id).docs.ci;return{r,now,gone:!JSON.stringify(D.parties).includes(OLDID)}});
 ok(fx.r.done===1&&fx.r.left===0&&fx.gone&&fx.now&&fx.now!=="drive:1oldOLDoldOLDoldOLDoldOLD_xyz","an attachment kept in the old account is copied into the new one and the record re-pointed ("+JSON.stringify(fx.r)+")");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
