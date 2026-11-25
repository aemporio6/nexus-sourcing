// Files whose NAME has no ending (as people put them in Drive) are read by their real kind.
// Run: NODE_PATH=/opt/npm-tools/node_modules MT_URL=http://localhost:8096/index.html?demo node tests/imp/t_filetype.js <dir with sample files>
const h=require("./h.js");const path=require("path");const D=process.argv[2];
(async()=>{const {br,pg,errs}=await h.open();let ok=0,bad=0;const t=(n,c,x)=>{c?ok++:bad++;console.log((c?"PASS ":"FAIL ")+n+(c?"":" → "+JSON.stringify(x)))};
 const run=async f=>pg.evaluate(async({b64,name})=>{const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const file=new File([bin],name,{type:""});const fx=await ftFix(file);S.imp=null;S.impQ=null;const r=await handleImport(file);return{fixed:fx.name,real:fx.ftReal||null,r:{ok:r&&r.ok,err:r&&r.error,proof:r&&r.proof,msg:r&&r.msg},fmt:S.imp&&S.imp.fixed&&S.imp.fixed.fmt,kind:S.imp&&S.imp.kind}},{b64:require("fs").readFileSync(path.join(D,f)).toString("base64"),name:f});
 let r=await run("110 | 24 Nov | Invoice |300 Plunger ");t("Excel without ending → xlsx",r.real==="xlsx"&&/Plunger\.xlsx$/.test(r.fixed),r);t("… and read as Joyce CI",r.fmt==="joyce_ci",r);
 const base=await run("ok.xlsx");t("normal .xlsx untouched",base.real===null&&base.fixed==="ok.xlsx"&&base.fmt==="joyce_ci",base);
 r=await run("002-Nov21-CI-Earwex");t("PDF without ending → pdf",r.real==="pdf",r);t("… PDF goes to the PDF reader (not 'unknown file')",r.fmt==="fwd_invoice"||/PDF/i.test(r.r.msg||""),r);
 r=await run("108-109-Nov18-CI");t("old Word without ending → doc + clear message",r.real==="doc"&&/Word file/.test(r.r.msg||""),r);
 r=await run("Inspection ZIP");t("zip → clear message, no crash",r.real==="zip"&&/ZIP archive/.test(r.r.msg||""),r);
 const ft=await pg.evaluate(()=>[ixFType({name:"42- Nov24-W-H-7500  ",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),ixFType({name:"x.xlsx",mimeType:""})]);t("Drive list: kind from Drive's type when the name has no ending",ft[0]===ft[1],ft);
 const q=await pg.evaluate(async()=>{window.__DEMO_DRIVE={meta:id=>({id,name:id,mimeType:id==="big"?"application/pdf":id==="zip"?"application/x-zip-compressed":"text/csv",size:id==="big"?135592403:id==="zip"?154184742:20}),download:async()=>{window.__dl=(window.__dl||0)+1;return new File(["a,b\n1,2\n"],"small.csv",{type:"text/csv"})},list:()=>[]};
  go("import",{},{force:true});await new Promise(z=>setTimeout(z,800));const L=[{id:"big",name:"108-109-Inspection Report ",mime:"application/pdf",src:"drive",st:"wait"},{id:"zip",name:"108-109-Inspection ZIP",mime:"application/x-zip-compressed",src:"drive",st:"wait"},{id:"small",name:"small",mime:"text/csv",src:"drive",st:"wait"}];L._planned=true;await ixQStart(L);await new Promise(z=>setTimeout(z,2500));window.__dbg=[!!S.impQ,S.impQ&&S.impQ.busy,S.view.k];
  return{st:L.map(x=>x.st),msg:L.map(x=>x.msg||""),dl:window.__dl||0,dbg:window.__dbg}});
 t("135 MB PDF and ZIP are not downloaded, small file still read",q.st[0]==="proof"&&q.st[1]==="proof"&&q.dl===1&&/136|135|129 MB/.test(q.msg[0])&&/archive/.test(q.msg[1]),q);
 t("no page errors",!errs.length,errs);console.log(`\n${ok} pass, ${bad} fail`);await br.close();process.exit(bad?1:0)})();
