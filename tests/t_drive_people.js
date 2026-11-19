/* Import › From Google Drive: Shared with me grouped by person + Shared drives (20 Nov 2026). Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.addInitScript(()=>{const F="application/vnd.google-apps.folder";const sh=[{id:"a1",name:"13 - Chinese supplier",mimeType:F,owners:[{emailAddress:"Joyce@x.com",displayName:"Joyce Wen"}]},{id:"a2",name:"CI.xlsx",mimeType:"x",owners:[{emailAddress:"joyce@x.com",displayName:"Joyce Wen"}],modifiedTime:"2026-11-10"},{id:"b1",name:"Freight",mimeType:F,owners:[{emailAddress:"eco@y.com"}]}];
  window.__DEMO_DRIVE={list:(pid)=>pid==="shared"?sh:pid==="drives"?[{id:"D1",name:"Vartleaves Company",mimeType:F}]:pid==="a1"?[{id:"c1",name:"PI.xlsx",mimeType:"x"}]:[]}});
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(600);
 await p.evaluate(async()=>{go("import");await new Promise(r=>setTimeout(r,400));const d=ixDrv();d.open=true;d.root="shared";d.path=[];d.onlyNew=false;await ixDriveLoad()});await p.waitForTimeout(500);
 const t=await p.evaluate(()=>$("#ix_drive").innerText);ok(/Joyce Wen · joyce@x.com — 1 folder, 1 file/.test(t)&&/eco@y.com — 1 folder, 0 files/.test(t)&&!/CI\.xlsx/.test(t),"Shared with me shows the people first, with counts");
 ok(await p.evaluate(()=>!!$('#ix_drive select[data-ixc="drvroot"] option[value="drives"]')&&!document.querySelector('#ix_drive [data-ixc="drvself"][data-id^="who:"]')),"Drive choice has Shared drives; a person is not a selectable folder");
 await p.click('#ix_drive [data-ixa="drvopen"][data-id="who:joyce@x.com"]');await p.waitForTimeout(500);
 const t2=await p.evaluate(()=>$("#ix_drive").innerText);ok(/13 - Chinese supplier/.test(t2)&&/CI\.xlsx/.test(t2)&&!/📁 Freight/.test(t2)&&!/Import all new files here/.test(t2),"tap a person → only what that person shared");
 await p.click('#ix_drive [data-ixa="drvopen"][data-id="a1"]');await p.waitForTimeout(500);ok(/PI\.xlsx/.test(await p.evaluate(()=>$("#ix_drive").innerText)),"…and their folders open as usual");
 await p.evaluate(async()=>{const d=ixDrv();d.root="drives";d.path=[];await ixDriveLoad()});await p.waitForTimeout(400);ok(/Vartleaves Company/.test(await p.evaluate(()=>$("#ix_drive").innerText)),"Shared drives lists the company drives");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
