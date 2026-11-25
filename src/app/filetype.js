/* ---------- the real kind of a file (25 Nov 2026) ----------
   The importer chose how to read a file from the END OF ITS NAME (".xlsx", ".pdf"). Files put in Drive by hand often have
   no ending at all ("110 | 24 Nov | Invoice |300 Plunger ") — so an Excel invoice was not read as Excel.
   Now the kind comes from the file ITSELF (its first bytes), then from the type Drive gives, and only last from the name.
   One place for every way a file comes in: file picker, drag-drop, Drive link, Drive inbox, supplier inbox, share. */
/* create: no entry of its own — it makes every import in Create read the file by its real kind */
const FT_KNOWN=/\.(xlsx|xlsm|xls|csv|tsv|txt|pdf|docx?|jpe?g|png|webp|gif|heic|zip|json)$/i;
const FT_MIME={"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"xlsx","application/vnd.ms-excel":"xls","application/vnd.ms-excel.sheet.macroenabled.12":"xlsm","text/csv":"csv","text/tab-separated-values":"tsv","application/pdf":"pdf","application/msword":"doc","application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx","image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","image/heic":"heic","application/zip":"zip","application/x-zip-compressed":"zip","text/plain":"txt"};
function ftHas(u,word,max){const w=[...word].map(c=>c.charCodeAt(0));const n=Math.min(u.length,max||u.length)-w.length;outer:for(let i=0;i<=n;i++){for(let j=0;j<w.length;j++)if(u[i+j]!==w[j])continue outer;return true}return false}
/* → "xlsx" | "xls" | "pdf" | "docx" | "doc" | "jpg" | "png" | "gif" | "webp" | "zip" | "csv" | null */
async function ftSniff(file){let u;try{u=new Uint8Array(await file.slice(0,Math.min(file.size,262144)).arrayBuffer())}catch(_){return null}if(u.length<4)return null;
 const b=(i)=>u[i];
 if(b(0)===0x25&&b(1)===0x50&&b(2)===0x44&&b(3)===0x46)return"pdf";
 if(b(0)===0xFF&&b(1)===0xD8&&b(2)===0xFF)return"jpg";
 if(b(0)===0x89&&b(1)===0x50&&b(2)===0x4E&&b(3)===0x47)return"png";
 if(b(0)===0x47&&b(1)===0x49&&b(2)===0x46)return"gif";
 if(b(0)===0x52&&b(1)===0x49&&b(2)===0x46&&b(3)===0x46&&b(8)===0x57&&b(9)===0x45)return"webp";
 if(b(0)===0x50&&b(1)===0x4B&&(b(2)===3||b(2)===5)){   /* a zip: Excel and Word are zips with their own folders inside */
  if(ftHas(u,"xl/")||ftHas(u,"[Content_Types].xml")&&ftHas(u,"worksheet"))return"xlsx";if(ftHas(u,"word/"))return"docx";
  try{const t=new Uint8Array(await file.slice(Math.max(0,file.size-262144)).arrayBuffer());if(ftHas(t,"xl/workbook"))return"xlsx";if(ftHas(t,"word/document"))return"docx"}catch(_){}
  return"zip"}
 if(b(0)===0xD0&&b(1)===0xCF&&b(2)===0x11&&b(3)===0xE0){   /* old Office file: Excel or Word */
  let t=u;try{t=new Uint8Array(await file.slice(0,Math.min(file.size,2097152)).arrayBuffer())}catch(_){}
  const utf16=s=>[...s].map(c=>c+"\0").join("");if(ftHas(t,utf16("Workbook"))||ftHas(t,utf16("Book")))return"xls";if(ftHas(t,utf16("WordDocument")))return"doc";return"xls"}
 return null}
/* the same file with a name the readers understand; untouched when the name is already right */
async function ftFix(file,mimeHint){if(!file||typeof file.slice!=="function")return file;const name=String(file.name||"file");const nm=name.trim();
 const cur=(nm.match(FT_KNOWN)||[])[1];let real=await ftSniff(file);if(!real)real=FT_MIME[String(mimeHint||file.type||"").toLowerCase()]||null;
 if(!real)return file;const same=cur&&(cur.toLowerCase()===real||/^jpe?g$/i.test(cur)&&real==="jpg"||/^xls[xm]$/i.test(cur)&&real==="xlsx"||/^(csv|tsv|txt|json|heic)$/i.test(cur));
 if(same)return file;
 const base=cur?nm:nm.replace(/[.\s]+$/,"");const f=new File([file],(base||"file")+"."+real,{type:file.type||Object.keys(FT_MIME).find(k=>FT_MIME[k]===real)||"",lastModified:file.lastModified||Date.now()});
 f.ftWas=name;f.ftReal=real;return f}
handleImport=(function(orig){return async function(file){let f=file;try{const Q=typeof S!=="undefined"&&S.impQ;f=await ftFix(file,Q&&Q.cur&&Q.cur.mime)}catch(e){console.warn("filetype",e)}
 if(f&&f.ftReal==="zip")return{error:true,proof:true,msg:`${file.name}: a ZIP archive — MY TOOL does not open archives. Keep it in Drive and attach its link to the record (e.g. the inspection’s “Report link”).`};
 const a=[...arguments];a[0]=f;return orig.apply(this,a)}})(handleImport);
/* the Drive list: a file without an ending shows its real kind, so "Invoices / Packing / Receipts" filters do not hide it */
ixFType=(function(orig){return function(f){const n=String(f&&f.name||"");if(f&&!FT_KNOWN.test(n.trim())){const e=FT_MIME[String(f.mimeType||"").toLowerCase()];if(e)return orig({...f,name:n.trim().replace(/[.\s]+$/,"")+"."+e})}return orig(f)}})(ixFType);
/* very large files and archives are never pulled into the browser (a 135 MB inspection PDF froze the import list):
   they are marked at once with a clear line, and the rest of the list carries on */
const FT_MAX_MB=40;
function ftSkipWhy(name,mime,size){const mb=Number(size||0)/1048576;const m=String(mime||"").toLowerCase();
 if(/zip|x-rar|x-7z/.test(m))return`an archive${mb>=1?` (${Math.round(mb)} MB)`:""} — not opened. Attach its Drive link to the record (e.g. the inspection’s “Report link”).`;
 if(/^video\//.test(m))return"a video — attach its Drive link to the record.";
 if(mb>FT_MAX_MB)return`${Math.round(mb)} MB — too big to read here, so it was not downloaded. Attach its Drive link to the record as proof.`;return""}
ixQStart=(function(orig){return function(items){const list=items||[];const need=list.filter(x=>x&&x.src==="drive"&&!x.file&&x.st==="wait");
 const mark=()=>{for(const x of need){const why=ftSkipWhy(x.name,x.mime,x.size);if(why){x.st="proof";x.msg=x.name.trim()+": "+why}}};
 if(!need.length||need.every(x=>x.size!=null)||(window.MYTOOL&&MYTOOL.demo&&!(window.__DEMO_DRIVE&&window.__DEMO_DRIVE.meta))){mark();return orig(list)}
 return Promise.all(need.filter(x=>x.size==null).map(x=>MYTOOL.drive.meta(x.id).then(m=>{x.size=Number(m&&m.size||0);if(m&&m.mimeType&&!x.mime)x.mime=m.mimeType}).catch(()=>{x.size=0}))).then(()=>{mark();return orig(list)})}})(ixQStart);
