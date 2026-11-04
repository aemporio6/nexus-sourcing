/* ---------- Google Drive: paste any link, and a Drive "inbox" that imports by itself ----------
   1. Paste a link (folder, file, Google Sheet, shared drive, "open?id=") in Import › From Google Drive → MY TOOL opens that folder
      (any depth) or queues that file. If Google refuses, it says exactly why (not shared with you / deleted / not a Drive link).
   2. Inbox: one folder (Setup › Import inbox) is checked when the app opens and every 30 min. New files are imported by themselves
      when they are a recognised fixed format with zero errors (eBay Transaction report, Joyce CI, Shunqi, packing info…); the eBay
      account comes from the sub-folder name (INBOX/TOUQEER/…). Anything else waits in the import queue for one click — nothing is
      ever saved from a file the tool did not fully understand. Every processed file is remembered (id + what happened). */
function driveIdFromLink(s){s=String(s||"").trim();if(!s)return null;let m;
 if(/^[A-Za-z0-9_-]{20,}$/.test(s))return{id:s,kind:"unknown"};
 if((m=s.match(/\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)/)))return{id:m[1],kind:"folder"};
 if((m=s.match(/\/file\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)/)))return{id:m[1],kind:"file"};
 if((m=s.match(/\/(?:spreadsheets|document|presentation)\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)/)))return{id:m[1],kind:"file"};
 if((m=s.match(/[?&]id=([A-Za-z0-9_-]+)/)))return{id:m[1],kind:"unknown"};
 if((m=s.match(/\/drive\/(?:u\/\d+\/)?(?:shared-drives|drives)\/([A-Za-z0-9_-]+)/)))return{id:m[1],kind:"folder"};
 return null}
function driveErrText(e,id){const m=String(e&&e.message||e);if(/404|not found/i.test(m))return`Google says this item does not exist or is not shared with ${(window.MYTOOL&&MYTOOL.me&&MYTOOL.me.email)||"your Google account"} — ask the owner to share it (Viewer is enough), then paste the link again.`;if(/403|forbidden|insufficient/i.test(m))return`No permission for this item (${id.slice(0,8)}…) — ask the owner to share it with your Google account.`;return"Drive: "+m}
async function driveOpenLink(url){const r=driveIdFromLink(url);if(!r){toast("That is not a Google Drive link. Copy it from the address bar or from ‘Share › Copy link’.",{ms:8000});return null}
 let meta;try{meta=await MYTOOL.drive.meta(r.id)}catch(e){toast(driveErrText(e,r.id),{ms:10000});return null}
 const d=ixDrv();d.open=true;d.err=null;
 if(meta.mimeType==="application/vnd.google-apps.folder"||meta.mimeType==="application/vnd.google-apps.shortcut"&&meta.shortcutDetails?.targetMimeType==="application/vnd.google-apps.folder"){const id=meta.shortcutDetails?.targetId||meta.id;d.root=meta.driveId?"shared":"root";d.path=[{id,name:meta.name}];await ixDriveLoad();
  try{const dr={...(ixMem().drive||{})};dr.folders=[{id,name:meta.name,root:d.root},...(dr.folders||[]).filter(f=>f.id!==id)].slice(0,12);await setupPatch(["importMemory","drive"],dr,null)}catch(_){}
  toast(`Opened “${meta.name}” — tick files or folders, or “Import all new files here”`,{ms:7000});return{folder:meta}}
 const items=[{id:meta.shortcutDetails?.targetId||meta.id,name:meta.name,mime:meta.shortcutDetails?.targetMimeType||meta.mimeType,src:"drive",folder:null,st:"wait"}];ixQStart(items);toast(`Reading “${meta.name}” from Drive…`);return{file:meta}}
/* panel: link box + "import all new files here" */
ixDriveHtml=(function(orig){return function(){let h=orig();if(!h||!ixDriveOk())return h;const d=ixDrv();const fid=d.path.length?d.path[d.path.length-1].id:null;
 const box=`<div class="ixbar" style="flex-wrap:wrap"><input id="ix_link" class="in" style="flex:1;min-width:240px" placeholder="Paste any Google Drive link (folder, file or Sheet) and press Open" aria-label="Drive link"><button class="btn sm pri" data-ixa="drvlink">Open link</button>${fid?`<button class="btn sm" data-ixa="drvall" title="Every file in this folder and its sub-folders that is new since the last import">⬇ Import all new files here</button>`:""}</div>`;
 return h.replace('<div style="padding:10px 14px;display:flex;flex-direction:column;gap:8px">','<div style="padding:10px 14px;display:flex;flex-direction:column;gap:8px">'+box)}})(ixDriveHtml);
document.addEventListener("click",async e=>{const b=e.target.closest('[data-ixa="drvlink"],[data-ixa="drvall"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();
 if(b.dataset.ixa==="drvlink"){const u=$("#ix_link")?.value||"";if(!u.trim()){toast("Paste a Drive link first");return}b.disabled=true;await driveOpenLink(u);b.disabled=false;return}
 const d=ixDrv();const top=d.path[d.path.length-1];if(!top)return;d.selF={[top.id]:{id:top.id,name:top.name}};d.sel={};await ixDriveImport()},true);
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.id==="ix_link"){e.preventDefault();$('[data-ixa="drvlink"]')?.click()}},true);
/* ---------- inbox ---------- */
const INBOX_FIXED_AUTO=["ebay_tx","joyce_ci","packing_info","fwd_invoice","eco_pi","amazon_dashboard"];   /* formats safe to save without a human when there are no errors */
function inboxCfg(){return(D.setup&&D.setup.inbox)||null}
function inboxDone(){return(D.setup&&D.setup.inboxDone)||{}}
async function inboxScan(){const c=inboxCfg();if(!c||!c.id||!ixDriveOk()||MYTOOL.demo||!can("create"))return[];const done=inboxDone();const found=[];
 const walk=async(fid,depth,acct)=>{let list=[];try{list=await MYTOOL.drive.list(fid,{})}catch(e){throw new Error(driveErrText(e,fid))}
  for(const f of list){if(ixIsFolder(f)){if(depth<3)await walk(f.id,depth+1,depth===0?f.name:acct);continue}if(done[f.id])continue;if(/^image\//.test(f.mimeType)||/\.(jpe?g|png|heic|webp|gif|pdf)$/i.test(f.name)&&!/invoice|freight|packing|\bCI\b|\bPI\b/i.test(f.name))continue;found.push({id:f.id,name:f.name,mime:f.mimeType,modified:f.modifiedTime,account:acct||null,folder:fid})}};
 await walk(c.id,0,null);S.inboxNew=found;return found}
async function inboxMark(id,what){const done={...inboxDone()};done[id]={at:nowIso(),...what};await setupPatchMany([[["inboxDone"],done]],null,{noUndo:true,quiet:true,derived:true})}
/* run the inbox: recognised + clean → saved; everything else → queue for review */
async function inboxRun(files){if(!files||!files.length)return{auto:0,review:0};let auto=0;const review=[];S.view={k:"import",params:{}};render();await new Promise(z=>setTimeout(z,200));
 for(const f of files){let st="review";try{const blob=await MYTOOL.drive.download(f.id,f.mime);const file=blob instanceof File?blob:new File([blob],f.name,{type:blob.type||""});S.imp=null;const r=await handleImport(file);await new Promise(z=>setTimeout(z,300));const I=S.imp;
   if(r.ok&&I&&I.fixed&&INBOX_FIXED_AUTO.includes(I.fixed.fmt)){if(I.kind==="ebaytx"&&!I.def.account&&f.account)I.def.account=f.account;buildPreview();const P=I.preview;
    const clean=P&&!P.missing.length&&!(P.counts.err||0)&&!Object.values(P.unk||{}).some(u=>!u.dec)&&P.nWrite>0;
    if(clean){const before=live(D.imports).length;await runImport();await new Promise(z=>setTimeout(z,400));const imp=live(D.imports).slice().sort((a,b)=>(a.createdAt||"")<(b.createdAt||"")?1:-1)[0];if(live(D.imports).length>before){st="auto";auto++;await inboxMark(f.id,{st:"imported",imp:imp&&imp.no,name:f.name});logEv("import","imports",imp&&imp.no||"-",`Inbox: ${f.name} imported by itself (${I.fixed.label})`);continue}}
    else if(P&&P.nWrite===0&&!P.missing.length&&!(P.counts.err||0)){st="dup";await inboxMark(f.id,{st:"already",name:f.name});continue}}
   if(!r.ok&&r.proof){await inboxMark(f.id,{st:"proof",name:f.name});continue}}
  catch(e){console.warn("inbox",f.name,e);f.err=e.message}
  review.push({id:f.id,name:f.name,mime:f.mime,src:"drive",folder:f.folder,st:"wait",account:f.account});}
 S.imp=null;if(review.length){S.view={k:"import",params:{}};render();await new Promise(z=>setTimeout(z,150));ixQStart(review);toast(`${auto} file${auto!==1?"s":""} imported by itself · ${review.length} waiting for your check`,{ms:9000})}else{render();toast(auto?`${auto} inbox file${auto>1?"s":""} imported by itself`:"Inbox: nothing new")}
 S.inboxNew=[];return{auto,review:review.length}}
/* queue items from the inbox remember their account and are marked when imported */
ixQAfterImport=(function(orig){return function(no){const Q=S.impQ;const cur=Q&&Q.cur;const r=orig(no);if(cur&&cur.src==="drive"&&inboxCfg()&&!inboxDone()[cur.id])inboxMark(cur.id,{st:"imported",imp:no,name:cur.name}).catch(()=>{});return r}})(ixQAfterImport);
handleImport=(function(orig){return async function(file){const r=await orig.apply(this,arguments);try{const Q=S.impQ;const cur=Q&&Q.cur;if(cur&&cur.account&&S.imp&&S.imp.kind==="ebaytx"&&!S.imp.def.account){S.imp.def.account=cur.account;buildPreview();renderImportPreview()}}catch(_){}return r}})(handleImport);
/* home banner + alert */
function inboxBanner(){const n=(S.inboxNew||[]).length;if(!n)return"";return`<section class="card" style="border-left:4px solid var(--accent)"><div class="card-h"><h2>📥 ${n} new file${n>1?"s":""} in the Drive inbox</h2><button class="btn pri" data-act="inboxrun">Import now</button></div><div class="status" style="padding:0 14px 12px">${esc(S.inboxNew.slice(0,5).map(f=>f.name+(f.account?" ("+f.account+")":"")).join(" · "))}${n>5?" …":""}<br>Recognised reports with no errors are saved by themselves; the rest wait for your check.</div></section>`}
vHome=(function(orig){return function(v){orig(v);try{const h=inboxBanner();if(h){const f=v.querySelector(".flow");if(f)f.insertAdjacentHTML("afterend",h);else v.insertAdjacentHTML("afterbegin",h)}}catch(e){console.warn(e)}}})(vHome);
document.addEventListener("click",async e=>{const b=e.target.closest('[data-act="inboxrun"],[data-act="inboxscan"],[data-act="inboxset"],[data-act="inboxclear"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const a=b.dataset.act;
 try{if(a==="inboxrun"){b.disabled=true;const files=S.inboxNew&&S.inboxNew.length?S.inboxNew:await inboxScan();await inboxRun(files)}
  else if(a==="inboxscan"){b.disabled=true;const f=await inboxScan();toast(f.length?`${f.length} new file${f.length>1?"s":""} found`:"Inbox: nothing new");render()}
  else if(a==="inboxset"){const u=$("#inbox_link")?.value||"";const r=driveIdFromLink(u);if(!r){toast("Paste the inbox folder's Drive link first");return}const meta=await MYTOOL.drive.meta(r.id);if(meta.mimeType!=="application/vnd.google-apps.folder"){toast("That link is a file — the inbox must be a folder");return}await setupPatchMany([[["inbox"],{id:meta.id,name:meta.name,at:nowIso(),by:uid}]],"Drive inbox set to "+meta.name);toast(`Inbox: ${meta.name}. Sub-folders named after the eBay account (e.g. TOUQEER) tell the tool which account a report belongs to.`,{ms:9000});render()}
  else if(a==="inboxclear"){if(!confirm("Stop watching the inbox folder?"))return;await setupPatchMany([[["inbox"],null]],"Drive inbox removed");render()}}
 catch(err){toast(err.message,{ms:9000})}finally{b.disabled=false}},true);
function inboxCard(){if(!window.MYTOOL||MYTOOL.demo||!can("setup"))return"";const c=inboxCfg();const done=Object.values(inboxDone());const n=done.length;
 return fsec("Drive inbox (files import by themselves)",`<div style="padding:12px 14px;display:flex;flex-direction:column;gap:10px"><p class="note" style="padding:0">Point MY TOOL at one Drive folder. When the app opens (and every 30 minutes) new files there are read: recognised reports with no errors — eBay Transaction reports, Joyce CI, Shunqi freight, packing sheets — are saved by themselves; anything else waits in Import for one click. Put eBay reports in a sub-folder named after the account (e.g. <b>INBOX/TOUQEER</b>). Photos and PDFs are left alone.</p>
 ${c?`<div><b>Watching:</b> <a href="https://drive.google.com/drive/folders/${esc(c.id)}" target="_blank" rel="noopener">${esc(c.name)}</a> <small class="status">· ${n} file${n!==1?"s":""} processed so far</small> <button type="button" class="btn sm" data-act="inboxscan">Check now</button> <button type="button" class="btn sm" data-act="inboxclear">Stop</button></div>`:""}
 <div class="fx" style="gap:8px;flex-wrap:wrap"><input id="inbox_link" class="in" style="flex:1;min-width:240px" placeholder="Paste the inbox folder's Drive link" aria-label="Inbox folder link"><button type="button" class="btn sm pri" data-act="inboxset">${c?"Change folder":"Use this folder"}</button></div></div>`,"")}
sBackup=(function(orig){return function(){return orig()+inboxCard()}})(sBackup);
/* check on open and every 30 minutes */
(function(){let t=null;const tick=async()=>{try{if(!S.ready||!inboxCfg())return;const f=await inboxScan();if(f.length&&S.view.k==="home")render();if(f.length){try{if(typeof recordAttention==="function")recordAttention()}catch(_){}}}catch(e){console.warn("inbox",e)}};
 const arm=()=>{clearInterval(t);t=setInterval(tick,30*60000);setTimeout(tick,8000)};const w=setInterval(()=>{if(S.ready){clearInterval(w);arm()}},1000)})();
attention=(function(orig){return function(){const a=orig.apply(this,arguments);try{const n=(S.inboxNew||[]).length;if(n)a.unshift({sev:1,t:`${n} new file${n>1?"s":""} in the Drive inbox — Import now`,k:"home",act:{k:"inboxrun"}})}catch(_){}return a}})(attention);
