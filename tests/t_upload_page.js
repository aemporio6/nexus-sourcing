/* upload.html (the page a supplier opens) against the real gateway code (Node stub). Repo served on :8098 */
const{chromium}=require("playwright");const fs=require("fs");const crypto=require("crypto");const{makeGateway}=require("./gw/stub");
const seedFile=JSON.parse(fs.readFileSync(process.env.SEED_FILE,"utf8"));const G=makeGateway({format:"mytool-1",schema:1,data:seedFile.data||seedFile,tomb:{},revs:{}},{T:{email:"aemporio6@gmail.com"}});
const tok=crypto.randomBytes(24).toString("base64url");const GID="AKfycbTESTtestTESTtestTEST_123";
{const c=G.call({op:"read",token:"T"});const b=JSON.parse(JSON.stringify(c.file));const k=Object.keys(b.data.parties)[0];b.data.parties[k].upload={h:G.run("upHash",tok),on:true,exp:"2099-01-01",max:30};G.call({op:"write",token:"T",base:c.version,body:b})}
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:412,height:860}});let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};const errs=[];const seen=[];
 await ctx.route(/script\.google\.com/,async r=>{const req=r.request();seen.push(req.url());const body=JSON.parse(req.postData()||"{}");await r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(G.call(body))})});
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));p.on("console",m=>{if(m.type()==="error")errs.push(m.text())});
 await p.goto(`http://localhost:8098/upload.html#u=${tok}&g=${GID}`);await p.waitForSelector("#form:not([hidden])",{timeout:10000});
 const name=Object.values(G.call({op:"read",token:"T"}).file.data.parties)[0].name;ok((await p.textContent("#who"))===name,"the page opens and names the supplier ("+name+")");
 ok(seen.every(u=>u===`https://script.google.com/macros/s/${GID}/exec`),"it talks only to the gateway of the link");
 fs.writeFileSync("/tmp/t_up_a.pdf","%PDF-1.4 hello");fs.writeFileSync("/tmp/t_up_b.exe","MZ");
 await p.setInputFiles("#f",["/tmp/t_up_a.pdf","/tmp/t_up_b.exe"]);await p.selectOption("#k","Packing list");await p.fill("#n","78 ctn");await p.click("#b");await p.waitForFunction(()=>!document.getElementById("b").disabled&&document.querySelectorAll("#o li").length===2,null,{timeout:15000});
 const lis=await p.evaluate(()=>[...document.querySelectorAll("#o li")].map(l=>l.className+"|"+l.textContent));ok(/^ok\|✓ t_up_a\.pdf/.test(lis[0])&&/^bad\|✗ t_up_b\.exe — This type of file/.test(lis[1]),"PDF received ✓ · .exe refused with the reason");
 const L=G.call({op:"inboxList",token:"T"}).list;ok(L.length===1&&L[0].name==="t_up_a.pdf"&&L[0].kind==="Packing list"&&L[0].note==="78 ctn","the file is in the supplier’s inbox with kind and note");
 ok(Buffer.from(G.call({op:"inboxFile",token:"T",id:L[0].id}).b64,"base64").toString()==="%PDF-1.4 hello","the bytes arrived unchanged");
 const q=await ctx.newPage();await q.goto(`http://localhost:8098/upload.html#u=${"x".repeat(32)}&g=${GID}`);await q.waitForSelector("#dead:not([hidden])",{timeout:10000});ok(await q.evaluate(()=>document.getElementById("form").hidden),"a wrong link shows only “not active”");
 const q2=await ctx.newPage();await q2.goto("http://localhost:8098/upload.html");await q2.waitForSelector("#dead:not([hidden])");ok(/not complete/.test(await q2.textContent("#why")),"a cut-off link says so");
 const html=fs.readFileSync(__dirname+"/../upload.html","utf8");ok(!/googleapis|gsi\/client|localStorage|document\.cookie/.test(html)&&/connect-src https:\/\/script\.google\.com/.test(html),"the page has no sign-in, no storage, and may only connect to the gateway");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
