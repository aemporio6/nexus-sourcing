/* ---------- Import › From Google Drive: "Shared with me" by PERSON, and company (shared) drives (owner, 20 Nov 2026) ----------
   Before: everything anyone ever shared came as one long list. Now:
   - Drive: My Drive · Shared drives (company drives) · Shared with me
   - Shared with me first shows the people ("joyce@… — 3 folders, 12 files"); tap one to see only what that person shared
   Google only shows what was shared with you — never someone's whole Drive. */
const dpWho=f=>{const o=(f.owners&&f.owners[0])||f.sharingUser||{};return{email:String(o.emailAddress||"unknown").toLowerCase(),name:o.displayName||""}};
const dpLoad0=ixDriveLoad;
ixDriveLoad=async function(){const d=ixDrv();if(!ixDriveOk())return dpLoad0.apply(this,arguments);const top=d.path[0];const inWho=d.root==="shared"&&top&&String(top.id).startsWith("who:");
 if(d.root!=="shared"||(d.path.length>(inWho?1:0)))return dpLoad0.apply(this,arguments);
 d.loading=true;d.err=null;ixDriveRender();try{const all=await MYTOOL.drive.list("shared",{});
  if(inWho){const em=top.id.slice(4);d.items=all.filter(f=>dpWho(f).email===em).sort((a,b)=>(ixIsFolder(b)-ixIsFolder(a))||String(a.name).localeCompare(String(b.name)))}
  else{const by={};all.forEach(f=>{const w=dpWho(f);const g=by[w.email]||(by[w.email]={...w,fo:0,fi:0,last:""});if(ixIsFolder(f))g.fo++;else g.fi++;if((f.modifiedTime||"")>g.last)g.last=f.modifiedTime||"";if(w.name&&!g.name)g.name=w.name});
   d.items=Object.values(by).sort((a,b)=>a.last<b.last?1:-1).map(g=>({id:"who:"+g.email,name:`${g.name&&norm(g.name)!==norm(g.email)?g.name+" · ":""}${g.email} — ${g.fo} folder${g.fo===1?"":"s"}, ${g.fi} file${g.fi===1?"":"s"}`,mimeType:"application/vnd.google-apps.folder",person:true}))}}
 catch(e){d.err=e.message||"Drive did not answer";d.items=[]}d.loading=false;ixDriveRender()};
const dpHtml0=ixDriveHtml;
ixDriveHtml=function(){let h=dpHtml0.apply(this,arguments);try{const d=ixDrv();if(!d.open||!h.includes('data-ixc="drvroot"'))return h;
 h=h.replace('<option value="shared"',`<option value="drives" ${d.root==="drives"?"selected":""}>Shared drives (company)</option><option value="shared"`);
 if(d.root==="drives")h=h.replace(/(data-ixa="drvroot" data-v="drives">)My Drive/,"$1Shared drives");
 h=h.replace(/<input type="checkbox" data-ixc="drvself" data-id="who:[^>]*>/g,"").replace(/📁 ((?:[^<]*) — \d+ folders?, \d+ files?<)/g,"👤 $1");
 if(d.root==="shared"&&d.path.length<=1||d.root==="drives"&&!d.path.length)h=h.replace(/<button[^>]*>[^<]*Import all new files here[^<]*<\/button>/,"");
 if(d.root==="shared"&&!d.path.length)h=h.replace('<div class="ixbar"><label class="status">Drive',`<div class="status" style="color:var(--fg)">👥 People who shared something with you — tap a person to see only their folders and files.</div><div class="ixbar"><label class="status">Drive`)}catch(_){}return h};
/* Create */
chRegister({k:"drvshared",title:"Import from files shared with me (by person)",hint:"Pick the person, then their folder",page:"import",words:"drive shared with me person folder import company drive shared drives",when:()=>can("create"),run:()=>{go("import");setTimeout(async()=>{try{const d=ixDrv();d.open=true;d.root="shared";d.path=[];await ixDriveLoad()}catch(_){}},350)}});
