/* Save & add another + touch targets (demo build on :8093).  node tests/t_daily.js */
const {chromium}=require("playwright");(async()=>{const b=await chromium.launch();let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const p=await ctx.newPage();const errs=[];p.on("pageerror",e=>errs.push(e.message));
 await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(600);
 const r=await p.evaluate(async()=>{openForm("party",{});await new Promise(z=>setTimeout(z,300));const has=!!document.querySelector('[data-act="saveadd"]');
  const set=(f,v)=>{const e=document.getElementById("f_"+f);e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}))};
  set("name","Batch Supplier One");set("company","Batch Co Ltd");set("type","supplier");set("country","china");set("cur","RMB");const n0=D.parties.length;S.drawer.ack=true;
  document.querySelector('[data-act="saveadd"]').click();await new Promise(z=>setTimeout(z,900));
  return{has,saved:D.parties.length===n0+1&&D.parties.some(x=>x.name==="Batch Supplier One"),open:S.drawer&&S.drawer.form==="party"&&!S.drawer.ctx.edit,kept:[val("type"),val("country"),val("cur")],nameEmpty:!val("name")}});
 ok(r.has,"'Save & add another' button on a new form");ok(r.saved,"record saved");ok(r.open&&r.nameEmpty,"a fresh form of the same kind opened, name empty");ok(JSON.stringify(r.kept)===JSON.stringify(["supplier","china","RMB"]),"type / country / currency carried over: "+JSON.stringify(r.kept));
 const sizes=await p.evaluate(()=>{const small=[];document.querySelectorAll(".drawer .btn, .drawer input:not([type=checkbox]):not([type=hidden]), .drawer select, .tabbar button").forEach(el=>{const r=el.getBoundingClientRect();if(r.width&&r.height&&r.height<36)small.push(el.tagName+"."+el.className+" "+Math.round(r.height))});return small});
 ok(sizes.length===0,"every button / input in the form ≥ 36px on a phone "+JSON.stringify(sizes.slice(0,5)));
 ok(!errs.length,"no page errors "+JSON.stringify(errs));console.log(fails?fails+" FAILED":"ALL PASS");await b.close();process.exit(fails?1:0)})();
