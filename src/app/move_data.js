/* ---------- Move the data to the company Google account (owner, 20 Nov 2026) ----------
   Setup › Users (Owner only) → "Move the data to the company account". The Owner pastes the Web-app URL of the gateway that
   was deployed IN THE NEW ACCOUNT (same tools/gateway.gs). Then, step by step and checked after every step:
     1 new gateway answers, runs as another account, has no data of its own
     2 everything on this device is saved; a backup copy is made in the old account
     3 the whole data file is copied to the new account and read back — every collection must have the same number of records
     4 attachments are copied into the new account's "MY TOOL – FILES" and their links re-pointed
     5 only if nobody saved in between: the old copy gets a pointer "moved to …" — from that moment every device switches by
       itself, and the old copy refuses every save (it stays untouched as a backup)
   Nothing is deleted anywhere. "Go back" does the same in the other direction (so no work is lost either way). */
const MV_URL=/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
const mvMain=f=>f&&f.data&&f.data.setup&&(f.data.setup.main||f.data.setup)||{};
const mvCounts=f=>{const o={};Object.keys(f.data||{}).forEach(c=>{o[c]=Object.keys(f.data[c]||{}).length});return o};
function mvFileIds(txt){const s=new Set();const re=/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([A-Za-z0-9_-]{20,})/g;let m;while((m=re.exec(txt)))s.add(m[1]);return[...s]}
async function mvRun(url,say){url=String(url||"").trim();if(!MV_URL.test(url))throw new Error("Paste the Web-app URL of the new gateway (it ends with /exec)");if(!S.isOwner)throw new Error("Only an Owner can move the data");
 const cur=MYTOOL.gateway;if(!cur&&!MYTOOL.demo)throw new Error("This device is not using the data gateway — turn it on first (card above)");if(url===cur)throw new Error("That is the gateway MY TOOL is already using");
 say(1,"Checking the new gateway…");const w=await MYTOOL.gwAt(url,"whoami");if(!w.admin)throw new Error("The new gateway does not know you as an Owner — paste the latest gateway.gs there and deploy it again");
 const meNow=String(MYTOOL.me?.email||uid||"").toLowerCase();let redo=false;
 if(w.exists){const nf0=(await MYTOOL.gwAt(url,"read")).file;/* a copy from an earlier, unfinished try of this same move (made and last saved by you) — or the frozen old copy when going back */if((nf0.adoptedFrom&&String(nf0.savedBy||"").toLowerCase()===String(w.you||meNow).toLowerCase())||mvMain(nf0).movedTo)redo=true;else throw new Error(`${w.account} already has its own MY TOOL data with later changes — nothing was touched. Tell me before going on.`)}
 say(1,`New gateway OK — it runs as ${w.account}${redo?" (an unfinished copy from an earlier try will be replaced)":""}`,true);
 say(2,"Saving everything and making a backup in the old account…");const dirtyN=()=>MYTOOL.demo?0:Object.keys(MYTOOL._debug().dirty||{}).length;for(let i=0;i<20&&dirtyN();i++)await new Promise(r=>setTimeout(r,1500));if(dirtyN())throw new Error("Some changes on this device are not saved yet — wait for “Synced” and press again");
 try{await MYTOOL.gwCall("backupNow")}catch(e){throw new Error("The backup could not be made ("+e.message+") — nothing was moved")}
 const o1=await MYTOOL.gwCall("read");const full=o1.file;if(mvMain(full).movedTo)throw new Error("This copy is already marked as moved");say(2,"Saved and backed up",true);
 say(3,"Copying the data to the new account…");const body=JSON.parse(JSON.stringify(full));mvMain(body).movedFrom={gateway:cur,account:MYTOOL.cfg?.dataOwner||"",at:nowIso()};
 const a=await MYTOOL.gwAt(url,"adopt",{body,from:meNow,force:redo});const want=mvCounts(full);const bad=Object.keys(want).filter(c=>(a.counts||{})[c]!==want[c]);if(bad.length)throw new Error("The copy is not complete ("+bad.join(", ")+") — nothing is switched; press again");
 let nf=await MYTOOL.gwAt(url,"read");const strip=f=>{const d=JSON.parse(JSON.stringify(f.data));const m=d.setup.main||d.setup;delete m.movedFrom;delete m.movedTo;return JSON.stringify(d,Object.keys(d).sort())};
 const same=Object.keys(full.data).every(c=>c==="setup"||JSON.stringify(full.data[c])===JSON.stringify(nf.file.data[c]));if(!same)throw new Error("The copy read back from the new account is different — nothing is switched; press again");
 const total=Object.values(want).reduce((x,y)=>x+y,0);say(3,`Copied and read back: ${total} records in ${Object.keys(want).length} collections — identical`,true);
 say(4,"Copying the attachments…");const ids=mvFileIds(JSON.stringify(full));let map={},missing=[];
 if(ids.length){try{await MYTOOL.gwCall("share",{email:a.account||w.account,role:"reader"})}catch(e){throw new Error("The attachments folder could not be opened for the new account ("+e.message+") — nothing is switched")}
  for(let i=0;i<ids.length;i+=20){const r=await MYTOOL.gwAt(url,"adoptFiles",{ids:ids.slice(i,i+20)});Object.assign(map,r.map||{});missing=missing.concat(r.missing||[]);say(4,`Copying the attachments… ${Math.min(i+20,ids.length)} of ${ids.length}`)}
  const changed=Object.entries(map).filter(([o,n])=>o!==n);if(changed.length){let txt=JSON.stringify(nf.file);changed.forEach(([o,n])=>{txt=txt.split(o).join(n)});const wr=await MYTOOL.gwAt(url,"write",{base:nf.version,body:JSON.parse(txt)});if(!wr.ok)throw new Error("The new links could not be saved in the new account — nothing is switched; press again")}}
 say(4,ids.length?`${Object.keys(map).length} attachment${Object.keys(map).length===1?"":"s"} copied${missing.length?` · ${missing.length} link${missing.length===1?"":"s"} point to files outside MY TOOL’s folder and stay as they are`:""}`:"No attachments to copy",true);
 say(5,"Switching…");const o2=await MYTOOL.gwCall("read");if(String(o2.version)!==String(o1.version))throw new Error("Someone saved a change while the copy was running — nothing is switched. Press the button again (it starts over with the latest data).");
 const ob=JSON.parse(JSON.stringify(o2.file));mvMain(ob).movedTo={gateway:url,account:a.account||w.account,at:nowIso(),by:meNow};const pw=await MYTOOL.gwCall("write",{base:o2.version,body:ob});if(!pw.ok)throw new Error("The old copy could not be marked as moved — nothing is switched; press again");
 say(5,`Done — the data now lives in ${a.account||w.account}. Every device switches by itself.`,true);return{account:a.account||w.account,url}}
function mvCard(){const main=SET();const from=main.movedFrom;const demo=!window.MYTOOL||MYTOOL.demo;const st=S.mv||{};
 const steps=["New gateway","Save + backup","Copy the data + check","Attachments","Switch every device"];
 const prog=st.lines?`<ol class="mvsteps">${steps.map((t,i)=>{const l=st.lines[i+1];return`<li class="${l?.done?"ok":l?"run":""}">${esc(l?.t||t)}</li>`}).join("")}</ol>${st.err?`<div class="badbox">${esc(st.err)}</div>`:""}`:"";
 const back=from&&from.gateway?`<div class="status" style="padding:0 14px 12px">The data came from ${esc(from.account||"the old account")} on ${fmtD(String(from.at||"").slice(0,10))}; that copy is still there as a backup. <button type="button" class="btn sm" data-mv="back" ${st.busy?"disabled":""}>Go back to the old account</button></div>`:"";
 return fsec("Move the data to the company account",`<div style="padding:12px 14px;display:flex;flex-direction:column;gap:10px">
  <div class="status" style="color:var(--fg)">Now the data is in <b>${esc(MYTOOL?.cfg?.dataOwner&&!from?MYTOOL.cfg.dataOwner:(main.adoptedIn||"this account"))}</b>${from?" (moved)":""}. To put it in a pure company account (vartleaves.data@gmail.com):</div>
  <ol class="status" style="margin:0;padding-left:20px;color:var(--fg);line-height:1.6"><li>Sign in to Google as the <b>new account</b> and open script.google.com → New project.</li><li>Paste <b>gateway.gs</b>, Save, then Deploy → New deployment → Web app → Execute as: <b>Me</b> · Who has access: <b>Anyone</b> → Deploy → copy the Web-app URL.</li><li>Make a second project with <b>daily-backup.gs</b>, Save, Run <b>setup</b> once.</li><li>Come back here (signed in to MY TOOL as an Owner), paste the URL and press the button.</li></ol>
  <div class="ixbar"><input id="mv_url" placeholder="https://script.google.com/macros/s/…/exec" aria-label="Web-app URL of the new gateway" style="flex:1;min-width:240px" value="${esc(st.url||"")}" ${st.busy?"disabled":""}><button type="button" class="btn pri" data-mv="go" ${st.busy||demo&&!window.__DEMO_GW?"disabled":""}>Check and move the data</button></div>
  ${prog}<div class="status">Nothing is deleted. The old copy stays as a backup and refuses changes after the switch. If anything does not check out, nothing is switched.</div></div>${back}`)}
const mvUsers0=sUsers;
sUsers=function(){let h=mvUsers0.apply(this,arguments);try{if(S.isOwner)h+=mvCard()}catch(e){console.warn("mv card",e)}return h};
function mvRedraw(){const y=window.scrollY;const v=$("#view");if(v&&document.querySelector('[data-mv]')&&typeof vSetup==="function"){const u=$("#mv_url")?.value;vSetup(v);if(u&&$("#mv_url")&&!S.mv?.url)$("#mv_url").value=u}window.scrollTo(0,y)}
document.addEventListener("click",async e=>{const b=e.target.closest("[data-mv]");if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(S.mv?.busy)return;const back=b.dataset.mv==="back";const url=back?SET().movedFrom?.gateway:($("#mv_url")?.value||"").trim();
 if(typeof alVerify==="function"&&!(await alVerify("Move the company data to another account")))return;
 if(!confirm(back?"Go back to the old account?\nEverything saved until now is copied back first, then every device switches back.":"Move the company data to the account of this gateway?\nIt is copied and checked first; the old copy stays as a backup."))return;
 S.mv={busy:true,url,lines:{},err:""};mvRedraw();const say=(n,t,done)=>{S.mv.lines[n]={t,done:!!done};mvRedraw()};
 try{const r=await mvRun(url,say);S.mv.busy=false;S.mv.done=true;mvRedraw();toast(`Moved — MY TOOL now opens the data in ${r.account}`,{ms:8000});setTimeout(()=>{try{MYTOOL.useGateway(r.url)}catch(_){location.reload()}},2500)}
 catch(err){S.mv.busy=false;S.mv.err=(err&&err.message)||String(err);mvRedraw()}},true);
(function(){try{const st=document.createElement("style");st.textContent=`.mvsteps{margin:0;padding-left:20px;line-height:1.7}.mvsteps li{color:var(--muted)}.mvsteps li.run{color:var(--fg);font-weight:600}.mvsteps li.ok{color:#1b7a3d}.mvsteps li.ok::marker{content:"✓  "}`;document.head.appendChild(st)}catch(_){}})();
