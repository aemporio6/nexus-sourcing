/* trash guard + CSV guard — run against a demo build on :8093 (bash tests/demo.sh /tmp/mt_g 8093) */
const {chromium}=require("playwright");(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(800);
const r=await p.evaluate(async()=>{const out={};
 const po=live(D.purchases).find(p=>live(D.payments).some(x=>(x.allocations||[]).some(a=>a.ref===p.no)));out.po=po.no;out.dep=dependantsOf("purchases",po.no).length;
 window.confirm=()=>false;out.refused=await trashDoc("purchases",po.no);out.stillLive=!D.purchases.find(x=>x.no===po.no).deletedAt;
 window.confirm=()=>true;out.allowed=await trashDoc("purchases",po.no);out.nowTrashed=!!D.purchases.find(x=>x.no===po.no).deletedAt;await restoreDoc("purchases",po.no);
 const free=live(D.purchases).find(p=>!dependantsOf("purchases",p.no).length);out.free=free?free.no:null;if(free){out.freeTrash=await trashDoc("purchases",free.no);await restoreDoc("purchases",free.no)}
 out.csv=ixToCsv([["=1+1","-5","-abc","@x","12.5","+44 7"]]);return out});
console.log(JSON.stringify(r,null,1));console.log("errors",errs);
const ok=r.dep>0&&r.refused===false&&r.stillLive&&r.allowed===true&&r.nowTrashed&&r.freeTrash===true&&r.csv.includes("'=1+1")&&r.csv.includes(",-5,")&&r.csv.includes("'-abc")&&r.csv.includes("'@x")&&r.csv.includes("'+44 7");console.log(ok?"ALL PASS":"FAIL");await b.close()})();
