/* Own Drive (17 Nov 2026): someone the company data is not shared with can use MY TOOL with their own Drive; the company file is never touched. Repo on :8098 */
const{chromium}=require("playwright");const fs=require("fs");const{drive,mkRoute}=require("./fakedrive");
(async()=>{const b=await chromium.launch();let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};const errs=[];
 const mk=(name,parent,owner,extra)=>{const id="F"+(++drive.n);drive.files[id]={id,name,owner,parent,version:1,...extra};return id};
 const df=mk("MY TOOL – DATA","root","aemporio6@gmail.com",{folder:true});const seed=JSON.parse(fs.readFileSync(process.env.SEED_FILE,"utf8"));const coId=mk("MYTOOL-DATA.json",df,"aemporio6@gmail.com",{content:JSON.stringify(seed)});const co0=drive.files[coId].content;
 const ctx=await b.newContext({viewport:{width:1200,height:860}});await ctx.addInitScript(()=>{window.__who="team@x.com";try{localStorage.setItem("mt_gw","off")}catch(_){}});
 await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await ctx.route(/accounts\.google\.com|googleapis\.com/,mkRoute(ctx));
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());await p.goto("http://localhost:8098/index.html");await p.waitForSelector("#mt_signin");await p.click("#mt_signin");
 await p.waitForSelector("#mt_ownws",{timeout:20000});ok(/not been shared/.test(await p.textContent("body")),"not shared → the gate offers own Drive");
 await p.click("#mt_ownws");await p.waitForSelector("#mt_signin,#mt_empty",{timeout:20000});if(await p.$("#mt_signin"))await p.click("#mt_signin");
 await p.waitForSelector("#mt_empty",{timeout:20000});ok(/your own Drive/.test(await p.textContent("body")),"first run in own Drive");await p.click("#mt_empty");
 await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}},null,{timeout:30000});await p.waitForTimeout(1500);
 ok(await p.evaluate(()=>S.role==="owner"&&MYTOOL.workspace==="own"),"they are Owner of their own data");
 const own=Object.values(drive.files).filter(f=>f.name==="MYTOOL-DATA.json"&&f.owner==="team@x.com");ok(own.length===1,"own data file made in their Drive");
 ok(await p.evaluate(()=>live(D.purchases).length===0),"their data is empty (no company data)");
 ok(drive.files[coId].content===co0,"company file untouched");
 await p.click("#alb");ok(/My own Drive/.test(await p.textContent("#almenu")),"🔒 menu shows which data this device opens");
 await p.evaluate(()=>MYTOOL.setWorkspace(""));await p.waitForTimeout(3000);if(await p.$("#mt_signin"))await p.click("#mt_signin");await p.waitForSelector("#mt_ownws",{timeout:20000});ok(true,"switch back → company data (not shared) gate");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
