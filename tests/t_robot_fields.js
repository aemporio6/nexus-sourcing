/* ROBOT (20 Nov 2026): opens EVERY form, adds a line to every table, and checks EVERY dropdown on the given data
   (PORT=8093 full demo data, PORT=8095 empty data). A dropdown fails when it has nothing to pick AND no way to add,
   or when it can take new values (list / party / product / order …) but shows no visible "＋ Add / ＋ New".
   Fixed choice sets (status, yes/no, basis …) only need options. Also fails on any page error.  */
const{chromium}=require("playwright");const PORT=process.env.PORT||"8093";
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1366,height:900}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0,checked=0;const bad=[];
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto(`http://localhost:${PORT}/index.html?demo`);await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(500);
 const forms=await p.evaluate(()=>Object.keys(SAVE));
 for(const f of forms){await p.evaluate(f=>{if(S.drawer)S.drawer.dirty=false;S.drawer=null;openForm(f,{force:true})},f);await p.waitForTimeout(600);
  await p.evaluate(()=>{const ks=fields(S.drawer.form).filter(x=>x.t==="rows").map(x=>x.k);ks.forEach(k=>{try{if(!rowsOf(k).length)addRow(k)}catch(_){}})});await p.waitForTimeout(300);
  const r=await p.evaluate(()=>{const form=S.drawer.form;const defs=fields(form);const out=[];
   const fixed=d=>!d||["opts","bool","owner","feeflag","currency","mode","incoterm"].includes(d.t)||d.t==="ro"||d.t==="calc"||(d.t==="list"&&/Status$|^inspResult$|^role$/.test(d.list||""))||!!d.fixed;
   document.querySelectorAll(".drawer select").forEach(s=>{if(!s.offsetParent)return;let d=null,where;
    if(s.id.startsWith("f_")){d=defs.find(x=>x.k===s.id.slice(2));where=s.id}
    else if(s.dataset.row){const rf=defs.find(x=>x.k===s.dataset.row);const R=ROWS[rf?.rows]||{};d=(R.cols||[]).concat(R.more||[]).find(c=>c.k===s.dataset.k);where=`${s.dataset.row}[].${s.dataset.k}`}
    else return;
    const vals=[...s.options].map(o=>o.value);const real=vals.filter(v=>v&&!/^__/.test(v)).length;const act=vals.some(v=>/^__/.test(v))||!!s.closest(".f")?.querySelector(".fadd");
    const lab=(d&&d.l)||where;
    if(fixed(d)){if(!real)out.push(`EMPTY fixed list: ${lab} (${where})`);return}
    if(!act)out.push(`NO ADD: ${lab} (${where}, ${d?.t||"?"}) — ${real} options`);
   });return{n:document.querySelectorAll(".drawer select").length,out}});
  checked+=r.n;r.out.forEach(x=>bad.push(`${f}: ${x}`))}
 bad.forEach(x=>console.log("FAIL "+x));fails+=bad.length;
 console.log(`checked ${checked} dropdowns in ${forms.length} forms on :${PORT}`);
 if(errs.length){console.log("FAIL page errors: "+errs.join(" | "));fails++}
 if(!fails)console.log("PASS every dropdown has options or a visible Add");await b.close();process.exit(fails?1:0)})();
