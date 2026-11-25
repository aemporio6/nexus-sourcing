// The "two devices saved at once" screen: plain words, machine fields gone, learned things merged, lists merged without loss.
// Run: NODE_PATH=/opt/npm-tools/node_modules CF_FILE=<a real conflict as json> node tests/t_sync_plain.js   (live-data copy on :8096)
process.env.MT_URL=process.env.MT_URL||"http://localhost:8096/index.html?demo";const h=require("./imp/h.js");const fs=require("fs");
(async()=>{const {br,pg,errs}=await h.open();let ok=0,bad=0;const t=(n,c,x)=>{c?ok++:bad++;console.log((c?"PASS ":"FAIL ")+n+(c?"":" → "+String(JSON.stringify(x)).slice(0,700)))};
 const real=process.env.CF_FILE&&fs.existsSync(process.env.CF_FILE)?JSON.parse(fs.readFileSync(process.env.CF_FILE,"utf8")):null;
 await pg.evaluate(real=>{window.__CF_TEST=true;S.isOwner=true;const L0=JSON.parse(JSON.stringify(SET().lists));const theirs=JSON.parse(JSON.stringify(L0));theirs.role.items.push({id:"hr_test",label:"HR test"});const mineA={...(SET().skuAliases||{})};
  const x=real||{at:"2026-11-23T13:03:27.352Z",by:"aemporio6@gmail.com",other:"aemporio6@gmail.com",kind:"field",key:"setup/main",fields:["lists","users.uid:u1.role","skuAliases","healthSummary","importMemory","digestFeed"],mine:{lists:L0,"users.uid:u1.role":"owner",skuAliases:mineA,healthSummary:{day:"a"},importMemory:SET().importMemory||{},digestFeed:{day:"a"}},theirs:{lists:theirs,"users.uid:u1.role":"partner",skuAliases:{...mineA,"Pack of 10 test":"LMN-WH-10"},healthSummary:{day:"b"},importMemory:{...(SET().importMemory||{}),sigs:{...((SET().importMemory||{}).sigs||{}),zz_test:{kind:"cipart"}}},digestFeed:{day:"b"}}};
  window.__cf=[x];window.__dis=[];MYTOOL.conflictsRaw=()=>window.__cf.filter(c=>!window.__dis.includes(c.at)).map(c=>JSON.parse(JSON.stringify(c)));MYTOOL.dismissConflict=(at)=>window.__dis.push(at)},real);
 let st=await pg.evaluate(()=>{const c=MYTOOL.conflicts()[0];return{fields:c.fields,text:cfPlainText(c),box:conflictBox(c)}});
 t("what the tool writes for itself (health, digest) and what it learns (aliases, importer memory) are not shown as a clash",st.fields.join()==="lists,users.uid:u1.role",st.fields);
 t("the line on Home is in plain words — no raw data",!/[{}]/.test(st.text)&&/Dropdown lists/.test(st.text)&&/Person “.+” \(u1\) — role \(kept Owner, other Partner\)/i.test(st.text),st.text);
 t("lists: says exactly what differs (the role only the other device has)",/Roles?[^<]*the other device has “[^”]+”/i.test(st.box),st.box.replace(/<[^>]+>/g," ").slice(0,500));
 t("lists: 'Merge both ✓' is offered; the role line shows Owner / Partner",/Merge both ✓/.test(st.box)&&/>Owner</.test(st.box)&&/>Partner</.test(st.box)&&!/\{"/.test(st.box),st.box.slice(0,300));
 const before=await pg.evaluate(()=>({roles:SET().lists.role.items.length,al:Object.keys(SET().skuAliases||{}).length,want:window.__cf[0].theirs.lists.role.items.filter(i=>!SET().lists.role.items.some(j=>j.id===i.id)).map(i=>i.id),wantAl:Object.keys(window.__cf[0].theirs.skuAliases||{}).filter(k=>!(k in (SET().skuAliases||{})))}));
 await pg.evaluate(()=>cfTidy());await pg.waitForTimeout(500);
 st=await pg.evaluate(w=>({al:w.every(k=>k in (SET().skuAliases||{})),n:Object.keys(SET().skuAliases||{}).length}),before.wantAl);
 t(`learned product names from the other device are merged in by themselves (${before.wantAl.length} were missing)`,st.al&&st.n>=before.al,st);
 await pg.evaluate(()=>{go("home",{},{force:true})});await pg.waitForTimeout(300);
 await pg.evaluate(()=>{const d=document.createElement("div");d.id="cf_t";d.innerHTML=conflictBox(MYTOOL.conflicts()[0]);document.body.appendChild(d)});
 await pg.click('#cf_t [data-act="cfmerge"][data-field="lists"]');await pg.waitForTimeout(600);
 st=await pg.evaluate(w=>({has:w.every(id=>SET().lists.role.items.some(i=>i.id===id)),n:SET().lists.role.items.length,others:Object.keys(SET().lists).length}),before.want);
 t(`Merge both: the role${before.want.length>1?"s":""} from the other device (${before.want.join(", ")}) is back, nothing of this device is lost`,before.want.length>0&&st.has&&st.n===before.roles+before.want.length,st);
 st=await pg.evaluate(()=>cfMerge({a:1,l:[{id:"x",v:1}],o:{k:"mine"}},{b:2,l:[{id:"x",v:9},{id:"y"}],o:{k:"theirs",n:1}}));
 t("merge rule: additions from both; a value changed on both sides keeps this device's",st.a===1&&st.b===2&&st.l.length===2&&st.l[0].v===1&&st.o.k==="mine"&&st.o.n===1,st);
 await pg.evaluate(()=>{window.__cf[0].fields=["healthSummary","digestFeed","importMemory"];cfDone.clear();return cfTidy()});await pg.waitForTimeout(300);
 t("a clash with nothing left for a person closes by itself",await pg.evaluate(()=>window.__dis.length===1&&MYTOOL.conflicts().length===0));
 t("no page errors",!errs.length,errs);console.log(`\n${ok} pass, ${bad} fail`);await br.close();process.exit(bad?1:0)})();
