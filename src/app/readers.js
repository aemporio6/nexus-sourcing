/* ===================== Fixed-format readers (readers.js, loaded after importer.js) =====================
   Rules only — no AI, no outside service. Each reader recognises one known document layout and turns it into
   a clean table (one header row + data rows) plus the values printed outside the table (invoice no., dates,
   party, currency …), the totals printed by the file (used as CHECKS, never as data) and arithmetic checks.
   The Smart Import engine (importer.js) then treats that table like any other sheet: column mapping, decisions,
   row checks, extra columns, totals check, commit and undo.
   Readers: Joyce / WinApproach commercial invoice (xlsx) · product / packing information (xlsx, 2-row merged header)
   · forwarder freight invoice (text PDF via pdf.js, Vartleaves template — Shunqi) · Eco Huang (Yucheng) freight PI
   (xlsx) · Amazon Sales Dashboard (csv). Plus: pdf.js lazy loader, CSV rows with extra commas re-aligned from the
   right, and the owner's confirmed ASIN → SKU table.
   Public: rdRecognise(ctx), rdPdfRead(buf), rdRealign(rows), rdAsinSku(asin), rdPOCands(piNo, lines), RD_ASIN. */

/* the owner's confirmed ASIN table (lead's notes, Oct 2026). Used only when no product carries the ASIN yet;
   once a product has the ASIN (saved by an import) the product wins. */
const RD_ASIN={B0CCPPFZCT:"WAL-TB-FBA-01",B0C6QY4HGJ:"WAL-TB-FBM-01",B0CDYH3KJ3:"WAL-TB-FBA-04",B0DT1YPSYN:"WAL-TB-GRY-01",B0DT1P77DP:"WAL-TB-GRY-02",B0DT257LR5:"WAL-TB-GRY-03",B0D33S5PQW:"WAL-TB-BLK-01",B0D33PPM3C:"WAL-TB-BLK-02",B0D33QY8GY:"WAL-TB-BLK-04"};
const RD_ASIN_RE=/^B0[A-Z0-9]{8}$/;
function rdAsinSku(asin){const a=String(asin||"").trim().toUpperCase();if(!RD_ASIN_RE.test(a))return null;const ok=p=>p&&!p.deletedAt&&!p.mergedInto;
 const p=(D.products||[]).find(p=>ok(p)&&(String(p.asin||"").toUpperCase()===a||(p.listings||[]).some(l=>String(l.id||"").toUpperCase()===a)));if(p)return p.sku;
 const s=RD_ASIN[a];return s&&ok(product(s))?s:null}

/* ---------- small helpers ---------- */
const rdT=v=>String(v??"").replace(/\s+/g," ").trim();
const rdN=v=>{if(v==null||v==="")return null;if(typeof v==="number")return isFinite(v)?v:null;const n=ixNum(String(v).replace(/[＄]/g,"$")).v;return n};
const rdR=(n,d=2)=>n==null?null:Math.round(n*10**d)/10**d;
/* a sheet as a full grid: values as the importer reads them, every merged range filled (labels and grouped cells) */
function rdGrid(sh){if(sh._grid)return sh._grid;const ws=sh.ws;const rows=(sh.rows||[]).map(r=>r.slice());if(ws&&ws["!merges"]&&ws["!ref"]){const R=XLSX.utils.decode_range(ws["!ref"]);
  ws["!merges"].forEach(mg=>{const v=rows[mg.s.r-R.s.r]?.[mg.s.c-R.s.c];if(v===""||v==null)return;for(let r=mg.s.r;r<=mg.e.r;r++)for(let c=mg.s.c;c<=mg.e.c;c++){const rr=rows[r-R.s.r];if(rr)rr[c-R.s.c]=v}})}
 sh._grid=rows;return rows}
/* value printed right of a label (first non-empty cell that is not the label itself) */
/* rows as typed: merged ranges keep their value only in the first cell (no copies) */
function rdRaw(sh){if(sh._raw)return sh._raw;const ws=sh.ws;const rows=(sh.rows||[]).map(r=>r.slice());if(ws&&ws["!merges"]&&ws["!ref"]){const R=XLSX.utils.decode_range(ws["!ref"]);ws["!merges"].forEach(mg=>{const v=rows[mg.s.r-R.s.r]?.[mg.s.c-R.s.c];for(let r=mg.s.r;r<=mg.e.r;r++)for(let c=mg.s.c;c<=mg.e.c;c++){if(r===mg.s.r&&c===mg.s.c)continue;const rr=rows[r-R.s.r];if(rr)rr[c-R.s.c]=""}})}sh._raw=rows;return rows}
function rdLabel(g,re,o={}){let k=0;for(let r=o.from||0;r<Math.min(g.length,o.to||g.length);r++){const row=g[r]||[];for(let c=0;c<row.length;c++){const t=rdT(row[c]);if(!t||!re.test(t))continue;if(k++<(o.nth||0))continue;
   const rest=[];for(let j=c+1;j<row.length;j++){const v=row[j];if(v===""||v==null)continue;if(rdT(v)===t)continue;rest.push(v)}
   if(o.all)return rest;if(o.lastNum){const ns=rest.map(rdN).filter(x=>x!=null);return ns.length?ns[ns.length-1]:null}if(o.num){const n=rest.map(rdN).find(x=>x!=null);return n??null}return rest.length?rest[0]:null}}return o.all?[]:null}
function rdFindRow(g,test,from=0){for(let r=from;r<g.length;r++)if(test((g[r]||[]).map(rdT),r))return r;return-1}
function rdCol(hdr,re){return hdr.findIndex(h=>re.test(h))}
function rdDate(v,fmt){if(v==null||v==="")return null;const d=ixDate(v,fmt||"DMY");return d.iso||null}
/* "21st ,Janu.2025" · "8th ,April.2025" · "Date:3rd ,July.2025" */
function rdLooseDate(s){const m=String(s||"").match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s*[,.\s]*\s*([A-Za-z]{3,9})\.?\s*[,.\s]*\s*(\d{4})/);if(!m)return null;const mo=IXMON[m[2].slice(0,3).toLowerCase()];if(!mo)return null;const d=ixDate(`${m[1]}/${mo}/${m[3]}`,"DMY");return d.iso||null}
function rdCheck(l,file,calc,o={}){const tol=o.tol??Math.max(0.011,Math.abs(file||0)*1e-7);const ok=file!=null&&calc!=null&&Math.abs(file-calc)<=tol;return{l,file:file==null?null:rdR(file,o.d??2),calc:calc==null?null:rdR(calc,o.d??2),ok,unit:o.unit||"",warnOnly:!!o.warnOnly}}

/* ---------- pdf.js (vendor/pdfjs, loaded only when a PDF is opened) ---------- */
let RD_PDFJS=null;
function rdScript(src){return new Promise((ok,no)=>{const s=document.createElement("script");s.src=src;s.async=true;s.onload=()=>ok();s.onerror=()=>no(new Error("Could not load the PDF reader ("+src+") — check the connection and try again"));document.head.appendChild(s)})}
async function rdPdfLib(){if(window.pdfjsLib)return window.pdfjsLib;if(!RD_PDFJS)RD_PDFJS=rdScript("vendor/pdfjs/pdf.min.js").then(()=>{const L=window.pdfjsLib;if(!L)throw new Error("PDF reader did not start");L.GlobalWorkerOptions.workerSrc="vendor/pdfjs/pdf.worker.min.js";return L}).catch(e=>{RD_PDFJS=null;throw e});return RD_PDFJS}
/* text of every page grouped into lines (same baseline) and cells (gaps between words) — positions kept */
async function rdPdfRead(buf){const L=await rdPdfLib();const doc=await L.getDocument({data:new Uint8Array(buf),isEvalSupported:false,disableFontFace:true,useSystemFonts:false,stopAtErrors:false}).promise;const pages=[];let chars=0;
 for(let p=1;p<=Math.min(doc.numPages,40);p++){const page=await doc.getPage(p);const tc=await page.getTextContent();
  const its=tc.items.filter(i=>i.str&&i.str.trim()).map(i=>({s:i.str.replace(/\s+/g," ").trim(),x:i.transform[4],y:i.transform[5],w:i.width||0,h:Math.abs(i.transform[3])||i.height||8}));chars+=its.reduce((a,i)=>a+i.s.length,0);
  its.sort((a,b)=>b.y-a.y||a.x-b.x);const lines=[];for(const it of its){let ln=null;for(const l of lines)if(Math.abs(l.y-it.y)<=Math.max(1.5,Math.min(l.h,it.h)*.45)){ln=l;break}if(!ln){ln={y:it.y,h:it.h,cells:[]};lines.push(ln)}ln.cells.push(it)}
  lines.forEach(l=>{l.cells.sort((a,b)=>a.x-b.x);const m=[];for(const c of l.cells){const last=m[m.length-1];const gap=last?c.x-(last.x+last.w):1e9;if(last&&gap<Math.max(1.5,c.h*.42)){last.s+=(gap>c.h*.08?" ":"")+c.s;last.w=c.x+c.w-last.x}else m.push({...c})}l.cells=m;l.text=m.map(c=>c.s).join(" ")});
  lines.sort((a,b)=>b.y-a.y);pages.push(lines);page.cleanup?.()}
 const n=doc.numPages;try{await doc.destroy()}catch(_){}return{pages,chars,numPages:n}}

/* ---------- CSV rows with extra (unquoted) commas: re-align from the right ---------- */
/* the dominant row length is the real width; a longer row has n extra cells inside ONE text column — that column is
   found by comparing every possible join with the shape of the normal rows (empty / number / text per column) */
function rdRealign(rows){const lens={};rows.forEach(r=>{if(r.length>=3)lens[r.length]=(lens[r.length]||0)+1});const tot=Object.values(lens).reduce((a,b)=>a+b,0);const top=Object.entries(lens).sort((a,b)=>b[1]-a[1])[0];if(!top||top[1]<Math.max(5,tot*.7))return{rows,fixed:[]};const W=+top[0];
 const normal=rows.filter(r=>r.length===W).slice(1,400);if(normal.length<5)return{rows,fixed:[]};const isN=v=>v!==""&&ixNum(String(v).replace(/\t/g,"")).v!=null;
 const prof=[];for(let c=0;c<W;c++){let e=0,n=0;normal.forEach(r=>{const v=String(r[c]??"").trim();if(!v)e++;else if(isN(v))n++});const k=normal.length;prof.push({e:e/k,n:n/k,t:1-(e+n)/k})}
 const fixed=[];const out=rows.map((r,i)=>{if(r.length<=W||r.length>W+12)return r;const n=r.length-W;let best=null;for(let j=0;j<W;j++){const cand=r.slice(0,j).concat([r.slice(j,j+n+1).join(",")],r.slice(j+n+1));let s=0;for(let c=0;c<W;c++){const v=String(cand[c]??"").trim();const p=prof[c];s+=!v?p.e:isN(v)?p.n:p.t}s+=prof[j].t*.5;if(!best||s>best.s+1e-9)best={s,cand}}fixed.push(i);return best.cand});
 return{rows:out,fixed}}

/* ---------- 1. Joyce / WinApproach commercial invoice (xlsx) ---------- */
function rdJoyceCI(ctx){for(const sh of ctx.sheets||[]){const g=rdGrid(sh);const head=g.slice(0,3).flat().map(rdT).join(" ");if(!/commercial invoice|proforma invoice/i.test(head))continue;
  const hr=rdFindRow(g,r=>r.some(c=>/^asin$/i.test(c))&&r.some(c=>/units?\s*\/\s*carton|units per carton|pcs\/ctn/i.test(c))&&r.some(c=>/amount/i.test(c)));if(hr<0)continue;
  const H=(g[hr]||[]).map(rdT);const ci=re=>rdCol(H,re);const C={no:ci(/^(carton )?no\.?$/i),pic:ci(/picture|photo|image/i),asin:ci(/^asin$/i),sku:ci(/seller sku|^sku$/i),title:ci(/title|description|product/i),brand:ci(/^brand$/i),colour:ci(/colou?r/i),mat:ci(/material/i),hs:ci(/hs ?code/i),ctn:ci(/^cartons?$|^ctns?$/i),per:ci(/units?\s*\/\s*carton|units per carton/i),qty:ci(/total units|^qty$|quantity/i),unit:ci(/unit price/i),amt:ci(/^amount/i)};
  const sub=rdFindRow(g,r=>r.some(c=>/goods subtotal|^subtotal$|^total$/i.test(c)),hr+1);const end=sub<0?g.length:sub;const lines=[];
  for(let r=hr+1;r<end;r++){const row=g[r]||[];const v=k=>C[k]>=0?row[C[k]]:"";const asin=rdT(v("asin")).toUpperCase(),title=rdT(v("title"));const q=rdN(v("qty")),ctn=rdN(v("ctn")),a=rdN(v("amt"));if(!asin&&!title&&q==null&&a==null)continue;
   let sku=rdT(v("sku")),link="";if(/^https?:\/\//i.test(sku)){link=sku;sku=""}lines.push({r,no:rdT(v("no")),pic:rdT(v("pic")),asin,sku,link,title,brand:rdT(v("brand")),colour:rdT(v("colour")),mat:rdT(v("mat")),hs:rdT(v("hs")),ctn,per:rdN(v("per")),q,u:rdN(v("unit")),a})}
  if(!lines.length)continue;/* blank template: no goods rows */
  const subRow=sub>=0?g[sub]:null;const st=k=>subRow&&C[k]>=0?rdN(subRow[C[k]]):null;
  const piNo=rdT(rdLabel(g,/^invoice no\.?$|^pi no\.?$/i));const date=rdDate(rdLabel(g,/^invoice date$|^date$/i));const cur=ixCurOf(rdLabel(g,/^currency$/i))||rdT(rdLabel(g,/^currency$/i)).toUpperCase()||null;
  const company=rdT(rdLabel(g,/^company$/i)),contact=rdT(rdLabel(g,/^contact$/i)),buyer=rdT(rdLabel(g,/^company$/i,{nth:1}));
  const party=findParty(contact)||findParty(company)||ixPartyInText(company+" "+contact)?.code||null;
  const tg=rdLabel(g,/^goods subtotal$/i,{lastNum:true});const feePct=rdLabel(g,/service fee|sourcing.*fee|agent fee/i,{num:true});const fee=rdLabel(g,/service fee|sourcing.*fee|agent fee/i,{lastNum:true});const other=rdLabel(g,/packaging|mould|other charges/i,{lastNum:true});const total=rdLabel(g,/^total invoice value/i,{lastNum:true});
  const paid=rdLabel(g,/^total paid$/i,{num:true}),due=rdLabel(g,/^balance due$/i,{num:true});
  const pays=[];const ph=rdFindRow(g,r=>r[0]&&/^stage$/i.test(r[0]));if(ph>=0)for(let r=ph+1;r<g.length;r++){const row=(g[r]||[]);const t=rdT(row[0]);if(!t||/^total paid|^balance due/i.test(t))break;const amt=rdN(row[3]);pays.push({stage:t,date:rdDate(row[2]),amount:amt,ref:rdT(row[4])})}
  const sumA=lines.reduce((s,l)=>s+(l.a||0),0),sumQ=lines.reduce((s,l)=>s+(l.q||0),0),sumC=lines.reduce((s,l)=>s+(l.ctn||0),0);const pct=feePct!=null&&feePct<1?feePct*100:feePct;
  const checks=[rdCheck("Goods subtotal = sum of the lines",tg??st("amt"),sumA),...(pct!=null&&fee!=null?[rdCheck(`Service fee ${rdR(pct,2)}% of goods`,fee,(tg??sumA)*pct/100)]:[]),...(total!=null?[rdCheck("Total = goods + fee + other charges",total,(tg??sumA)+(fee||0)+(other||0))]:[]),...(paid!=null&&due!=null&&total!=null?[rdCheck("Paid + balance due = total",total,paid+due)]:[])];
  lines.forEach(l=>{if(l.ctn!=null&&l.per!=null&&l.q!=null&&l.ctn*l.per!==l.q)checks.push(rdCheck(`Line ${l.asin||l.title}: cartons × units/carton = units`,l.q,l.ctn*l.per,{warnOnly:true,d:0}));if(l.q!=null&&l.u!=null&&l.a!=null&&Math.abs(l.q*l.u-l.a)>0.011)checks.push(rdCheck(`Line ${l.asin||l.title}: units × price = amount`,l.a,l.q*l.u,{warnOnly:true}))});
  const hdr=["Carton No.","Picture","ASIN","Seller SKU","Product link","Product Title","Brand","Colour","Material","HS Code","Cartons","Units / Carton","Total Units","Unit Price","Amount"];
  const rows=[hdr].concat(lines.map(l=>[l.no,l.pic,l.asin,l.sku,l.link,l.title,l.brand,l.colour,l.mat,l.hs,l.ctn??"",l.per??"",l.q??"",l.u??"",l.a??""]));
  const meta={piNo,date,cur,party,partyRaw:company,contact,buyer,poRef:rdT(rdLabel(g,/^po \/ order ref/i)),payStatus:rdT(rdLabel(g,/^payment status$/i)),incoterm:rdT(rdLabel(g,/^incoterms?$/i)),pickup:rdT(rdLabel(g,/^pickup location$/i)),port:rdT(rdLabel(g,/^port of loading$/i)),origin:rdT(rdLabel(g,/^country of origin$/i)),shipDate:rdDate(rdLabel(g,/^ship date$/i)),forwarder:rdT(rdLabel(g,/^forwarder$/i)),fwdInv:rdT(rdLabel(g,/^forwarder inv/i)),fbaId:rdT(rdLabel(g,/^fba shipment id$/i)),
   goods:rdR(tg??sumA),feePct:pct,fee:fee==null?null:rdR(fee),other:other==null?null:rdR(other),total:total==null?null:rdR(total),paid:paid==null?null:rdR(paid),due:due==null?null:rdR(due),payments:pays,ctn:st("ctn")??sumC,units:st("qty")??sumQ};
  return{map:{asin:"ASIN",sku:"Seller SKU",link:"Product link",title:"Product Title",colour:"Colour",hs:"HS Code",ctn:"Cartons",perCtn:"Units / Carton",qty:"Total Units",unit:"Unit Price",amount:"Amount"},fmt:"joyce_ci",label:"Supplier commercial invoice (WinApproach / Joyce layout)",kind:"cipart",sheetName:sh.name,
   sheets:[{name:sh.name+" › goods",rows,fixed:true,fileTotals:{ctn:st("ctn"),qty:st("qty"),amount:st("amt")}}],meta,checks,
   def:{party,piNo,date,cur},info:[`Invoice ${piNo||"—"} · ${fmtD(date)} · ${lines.length} line${lines.length===1?"":"s"} · ${meta.ctn} ctn · ${meta.units} units`]}}
 return null}

/* ---------- 2. product / packing information (xlsx, two-row merged header, product photos) ---------- */
function rdPackInfo(ctx){for(const sh of ctx.sheets||[]){const g=rdGrid(sh);let hr=-1;for(let r=0;r<Math.min(g.length,8);r++){const t=(g[r]||[]).map(rdT).join(" | ")+" | "+(g[r+1]||[]).map(rdT).join(" | ");if(/\basin\b/i.test(t)&&/units per master carton|master carton dim|total carton|gw\s*\/\s*carton/i.test(t)){hr=r;break}}if(hr<0)continue;
  /* header = grouping row + the row under it (merged cells already filled) */
  const top=(g[hr]||[]).map(rdT),sub=(g[hr+1]||[]).map(rdT);const subIsHdr=sub.filter(Boolean).length>=3&&sub.filter(x=>rdN(x)!=null).length<=1;const W=Math.max(top.length,sub.length);
  const H=[];for(let c=0;c<W;c++){const a=top[c]||"",b=subIsHdr?(sub[c]||""):"";H.push(a&&b&&ixNorm(a)!==ixNorm(b)?(/^product info$/i.test(a)?b:`${a.replace(/:$/,"")} ${b}`):(b||a))}
  const first=hr+(subIsHdr?2:1);const ci=re=>rdCol(H,re);const C={no:ci(/carton no/i),photo:ci(/photo|picture/i),name:ci(/product name/i),asin:ci(/^asin$|\basin\b/i),link:ci(/link/i),price:ci(/product price/i),pct:ci(/30%|% of selling/i),hs:ci(/hs code/i),size:ci(/dimension\/size|^size/i),qty:ci(/required qty|^qty$|quantity/i),mat:ci(/material/i),spec:ci(/specification/i),pw:ci(/^product weight/i),pd:ci(/^product dimensions?/i),kd:ci(/^packing dimensions?/i),kw:ci(/weight with packing/i),ctn:ci(/total carton/i),per:ci(/units per master carton|pcs\/ctn|units\/ctn/i),L:ci(/master carton.* l$/i),Wd:ci(/master carton.* w$/i),Hh:ci(/master carton.* h$/i),gw:ci(/gw\s*\/\s*carton/i),kg:ci(/total weight/i),cbm:ci(/total cbm|cbm/i)};
  const tr=rdFindRow(g,r=>r.some(c=>/^total$/i.test(c)),first);const end=tr<0?g.length:tr;const lines=[];
  for(let r=first;r<end;r++){const row=g[r]||[];const v=k=>C[k]>=0?row[C[k]]:"";const asin=rdT(v("asin")).toUpperCase(),name=rdT(v("name"));if(!asin&&!name)continue;lines.push({r,row,asin,name,qty:rdN(v("qty")),ctn:rdN(v("ctn")),per:rdN(v("per")),L:rdN(v("L")),W:rdN(v("Wd")),H:rdN(v("Hh")),gw:rdN(v("gw")),kg:rdN(v("kg")),cbm:rdN(v("cbm"))})}
  if(!lines.length)continue;const T=tr>=0?g[tr]:null;const tv=k=>T&&C[k]>=0?rdN(T[C[k]]):null;
  const sum=k=>lines.reduce((s,l)=>s+(l[k]||0),0);const checks=[];
  lines.forEach(l=>{const id=l.asin||l.name;if(l.ctn!=null&&l.per!=null&&l.qty!=null&&l.ctn*l.per!==l.qty)checks.push(rdCheck(`${id}: cartons × units per carton = quantity`,l.qty,l.ctn*l.per,{d:0,warnOnly:true}));if(l.ctn!=null&&l.gw!=null&&l.kg!=null)checks.push(rdCheck(`${id}: cartons × GW per carton = total weight`,l.kg,l.ctn*l.gw,{warnOnly:true}));if(l.L&&l.W&&l.H&&l.ctn&&l.cbm!=null)checks.push(rdCheck(`${id}: carton L×W×H × cartons = CBM`,l.cbm,l.L*l.W*l.H/1e6*l.ctn,{d:6,tol:0.0005,warnOnly:true}))});
  const hdr=["Carton No.","Photo","Product Name","ASIN","Product Link","Product Price","30% of Selling Price","HS Code","Dimension/Size","Required QTY","Product Material","Product Specification","Product Weight","Product Dimensions","Packing Dimensions","Weight with Packing","Total Carton","Units Per Master Carton","Carton L (cm)","Carton W (cm)","Carton H (cm)","GW / Carton (kg)","Total Weight (kg)","Total CBM"];
  const keys=["no","photo","name","asin","link","price","pct","hs","size","qty","mat","spec","pw","pd","kd","kw","ctn","per","L","Wd","Hh","gw","kg","cbm"];
  const rows=[hdr].concat(lines.map(l=>keys.map(k=>{const v=C[k]>=0?l.row[C[k]]:"";return typeof v==="string"?v.replace(/\s*\n\s*/g," / ").trim():v})));
  const ft={qty:tv("qty"),ctn:tv("ctn"),kg:tv("kg"),cbm:tv("cbm")};
  return{map:{asin:"ASIN",title:"Product Name",link:"Product Link",sellGbp:"Product Price",hs:"HS Code",qty:"Required QTY",ctn:"Total Carton",perCtn:"Units Per Master Carton",ctnL:"Carton L (cm)",ctnW:"Carton W (cm)",ctnH:"Carton H (cm)",gwCtn:"GW / Carton (kg)",kg:"Total Weight (kg)",cbm:"Total CBM",pkDims:"Packing Dimensions",pkKg:"Weight with Packing"},fmt:"packing_info",label:"Product / packing information (supplier layout)",kind:"packinfo",sheetName:sh.name,sheets:[{name:sh.name+" › products",rows,fixed:true,fileTotals:ft}],checks,
   meta:{products:lines.length,ctn:ft.ctn??sum("ctn"),qty:ft.qty??sum("qty"),kg:ft.kg??rdR(sum("kg")),cbm:ft.cbm??rdR(sum("cbm"),6),mode:/road|truck/i.test(ctx.name)?"truck":/sea/i.test(ctx.name)?"seaL":/air/i.test(ctx.name)?"air":null},def:{},
   info:[`${lines.length} products · ${ft.ctn??sum("ctn")} ctn · ${ft.qty??sum("qty")} pcs · ${ft.kg??rdR(sum("kg"))} kg · ${ft.cbm??rdR(sum("cbm"),6)} CBM`]}}
 return null}

/* ---------- 3. Eco Huang / Yucheng freight PI (xlsx): Destination | Shipping Way | Goods Details | rate | [discount] | Total Price ---------- */
function rdEcoPI(ctx){for(const sh of ctx.sheets||[]){const g=rdGrid(sh);const hr=rdFindRow(g,r=>r.some(c=>/^shipping way$/i.test(c))&&r.some(c=>/^total price$/i.test(c)));if(hr<0||hr>12)continue;
  const H=(g[hr]||[]).map(rdT);const ci=re=>rdCol(H,re);const C={dest:ci(/^destination$/i),way:ci(/^shipping way$/i),goods:ci(/goods/i),rate:ci(/^rate$/i),disc:ci(/discount/i),price:ci(/^total price$/i)};const all=g.flat().map(rdT).join(" \n ");
  const tr=rdFindRow(g,r=>/^total$/i.test(r[0]||""),hr+1);const end=tr<0?Math.min(g.length,hr+30):tr;const lines=[];let lastDest="",lastWay="";
  const raw=rdRaw(sh);for(let r=hr+1;r<end;r++){const row=g[r]||[],rr=raw[r]||[];const v=k=>C[k]>=0?rdT((k==="dest"||k==="way"?row:rr)[C[k]]):"";const goods=v("goods"),priceT=v("price");if(!goods&&!priceT)continue;if(goods.length>220)break;
   const dest=v("dest")||lastDest,way=v("way")||lastWay;lastDest=dest;lastWay=way;const nums=(priceT.match(/-?\d[\d,]*\.?\d*/g)||[]).map(x=>+x.replace(/,/g,""));const amount=nums.length?nums[0]:null;
   const txt=goods+" "+v("rate");const kgM=txt.match(/\*\s*(\d+(?:\.\d+)?)\s*kgs?/i)||txt.match(/(\d+(?:\.\d+)?)\s*kgs?\b/i);const ctnM=txt.match(/(\d+)\s*(?:ctns?|cartons?|boxe?s)\b/i);
   lines.push({r,dest:dest.replace(/\s*\n\s*/g," ").slice(0,120),way,goods,rateT:v("rate"),rate:rdN(v("rate").replace(/[^\d.]/g,"")||null),disc:C.disc>=0?rdN(v("disc").replace(/[^\d.\-]/g,"")):null,priceT,amount,kg:kgM?+kgM[1]:null,ctn:ctnM?+ctnM[1]:null,note:nums.length>1||/reduce|discount/i.test(priceT)?priceT:""})}
  if(!lines.length)continue;let total=null;if(tr>=0){const tv=(g[tr]||[]).slice(1).map(rdT).filter(Boolean);for(const t of tv){const n=(t.match(/-?\d[\d,]*\.?\d*/)||[])[0];if(n){total=+n.replace(/,/g,"");break}}}
  const dateCell=g.flat().map(rdT).find(t=>/^date\s*[:：]/i.test(t))||"";const date=rdLooseDate(dateCell);const sign=g.flat().map(rdT).find(t=>/^(eco|amber)\b.*huang$/i.test(t))||"";
  const company=(all.match(/(SHEN\s*ZHEN\s+YUCHENG\s+LOGISTICS[^\n]*?LTD)/i)||[])[1]||"";const party=findParty(sign)||findParty(company)||findParty("Eco Huang")&&/yucheng/i.test(all)&&findParty("Eco Huang")||null;
  const sum=rdR(lines.reduce((s,l)=>s+(l.amount||0),0));const modes=[...new Set(lines.map(l=>l.way.toLowerCase()).filter(Boolean))];const big=lines.slice().sort((a,b)=>(b.amount||0)-(a.amount||0))[0];
  const kg=lines.some(l=>l.kg!=null)?rdR(lines.reduce((s,l)=>s+(l.kg||0),0)):null,ctn=lines.some(l=>l.ctn!=null)?lines.reduce((s,l)=>s+(l.ctn||0),0):null;
  const detail=lines.map(l=>`${l.way||"?"}: ${l.goods}${l.rateT?` @ ${l.rateT}`:""}${l.disc?` (discount ${l.disc})`:""} = ${l.priceT||"—"}`).join(" ; ");const dests=[...new Set(lines.map(l=>l.dest).filter(Boolean))];
  const hdr=["PI date","Forwarder","Goods","Destination","Shipping way","Kg","Cartons","Total price","Currency","Lines"];
  const rows=[hdr,[date||"",party?(D.parties.find(p=>p.code===party)?.name||sign||company):(sign||company||"Eco Huang"),ixShort(lines.map(l=>l.goods).join(" + "),200),ixShort(dests.join(" / "),120),modes.length>1?(big?.way||modes[0]):(modes[0]||""),kg??"",ctn??"",sum,"USD",detail]];
  const checks=[];if(total!=null)checks.push(rdCheck("Total row = sum of the lines",total,sum));lines.forEach(l=>{if(l.rate&&l.kg&&l.amount&&!l.disc&&!l.note&&Math.abs(l.rate*l.kg-l.amount)>Math.max(2,l.amount*.02))checks.push(rdCheck(`${ixShort(l.goods,30)}: rate × kg = price`,l.amount,l.rate*l.kg,{warnOnly:true}))});
  return{map:{date:"PI date",party:"Forwarder",title:"Goods",cost:"Total price",cur:"Currency",mode:"Shipping way",kg:"Kg",ctn:"Cartons",notes:"Lines"},fmt:"eco_pi",label:"Forwarder freight PI (Eco Huang / Yucheng layout)",kind:"freight",sheetName:sh.name,sheets:[{name:"Eco PI",rows,fixed:true,fileTotals:{cost:total}}],checks,
   meta:{date,party,partyRaw:sign||company,lines:lines.length,total,sum,modes,kg,ctn,cur:"USD"},def:{party,cur:"USD",date},
   info:[`${lines.length} line${lines.length===1?"":"s"} · ${modes.join(" + ")||"—"} · ${kg!=null?kg+" kg · ":""}${ctn!=null?ctn+" ctn · ":""}$${sum}${total==null?" · the file's Total row is empty":""}`]}}
 return null}

/* ---------- 4. forwarder freight invoice (text PDF, Vartleaves template: Shunqi …) ---------- */
function rdFwdInvoicePdf(ctx){const pdf=ctx.pdf;if(!pdf)return null;const lines=pdf.pages.flat();const all=lines.map(l=>l.text).join("\n");if(!/billing\s*weight/i.test(all)||!/rate/i.test(all)||!/(fba shipment id|ship to|commercial invoice)/i.test(all))return null;
 const val=(re,nth=0)=>{let k=0;for(const l of lines)for(let i=0;i<l.cells.length;i++){if(re.test(l.cells[i].s)){if(k++<nth)continue;const nx=l.cells[i+1];return nx?nx.s:""}}return""};
 const lastNum=re=>{for(const l of lines){const i=l.cells.findIndex(c=>re.test(c.s));if(i>=0){const ns=l.cells.slice(i+1).map(c=>rdN(c.s)).filter(x=>x!=null);if(ns.length)return ns[ns.length-1]}}return null};
 const hi=lines.findIndex(l=>l.cells.some(c=>/^asin$/i.test(c.s)));if(hi<0)return null;const ti=lines.findIndex((l,i)=>i>hi&&l.cells.some(c=>/^total$/i.test(c.s)));const end=ti<0?lines.length:ti;
 const isNumCell=s=>/^-?[\d,]+(\.\d+)?$/.test(s.replace(/\s/g,""));const rows=[];const xs=[[],[],[],[],[],[],[]];
 for(let i=hi+1;i<end;i++){const cs=lines[i].cells;const ai=cs.findIndex(c=>RD_ASIN_RE.test(c.s.toUpperCase())||/^[A-Z0-9][A-Z0-9\-]{5,}$/.test(c.s)&&i>hi&&!isNumCell(c.s));if(ai<0)continue;
  let j=cs.length;const nums=[];while(j>ai+1&&isNumCell(cs[j-1].s)){j--;nums.unshift({n:rdN(cs[j].s),x:cs[j].x})}const mid=cs.slice(ai+1,j).map(c=>c.s);
  const pick=nums.length>=7?nums.slice(-7):null;if(pick)pick.forEach((p,k)=>xs[k].push(p.x));const N=k=>pick?pick[k].n:null;
  rows.push({no:rdT(cs[0]?.s),asin:cs[ai].s.toUpperCase(),desc:mid[0]||"",colour:mid.slice(1).join(" "),ctn:N(0),per:N(1),units:N(2),wt:N(3),bill:N(4),rate:N(5),amount:N(6),ok:!!pick})}
 if(!rows.length)return null;
 const cx=xs.map(a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null);const tot={};if(ti>=0){lines[ti].cells.filter(c=>isNumCell(c.s)).forEach(c=>{let b=-1,bd=1e9;cx.forEach((x,k)=>{if(x!=null&&Math.abs(x-c.x)<bd){bd=Math.abs(x-c.x);b=k}});if(b>=0)tot[b]=rdN(c.s)})}
 const invNo=val(/^invoice no\.?$/i),dt=rdDate(val(/^invoice date$/i)),due=rdDate(val(/^payment due$/i)),cur=ixCurOf(val(/^currency$/i))||rdT(val(/^currency$/i)).toUpperCase()||"USD";
 const company=val(/^company$/i),fc=val(/^fc code$/i),fbaId=val(/^fba shipment id$/i),amzRef=val(/^amazon ref/i),modeT=val(/^shipping mode$/i),etd=rdDate(val(/departure date|^etd/i)),eta=rdDate(val(/est\.? arrival|^eta/i)),inco=val(/^incoterms?$/i),status=val(/^status$/i),track=val(/waybill|tracking no/i);
 const freight=lastNum(/^freight charges$/i),duty=lastNum(/^customs duty/i),vat=lastNum(/^import vat/i),other=lastNum(/^other charges$/i),disc=lastNum(/^discount/i),dueAmt=lastNum(/^total amount due/i);
 const sum=k=>rows.reduce((s,r)=>s+(r[k]||0),0);const checks=[];
 if(freight!=null)checks.push(rdCheck("Sum of the lines = freight charges",freight,sum("amount")));if(dueAmt!=null)checks.push(rdCheck("Freight + duty + VAT + other + discount = total due",dueAmt,(freight??sum("amount"))+(duty||0)+(vat||0)+(other||0)+(disc||0)));
 rows.forEach(r=>{const id=r.asin;if(!r.ok)checks.push({l:`${id}: line could not be read completely`,file:null,calc:null,ok:false,warnOnly:true});if(r.ctn!=null&&r.per!=null&&r.units!=null&&r.ctn*r.per!==r.units)checks.push(rdCheck(`${id}: cartons × units per carton = total units`,r.units,r.ctn*r.per,{d:0,warnOnly:true}));if(r.bill!=null&&r.rate!=null&&r.amount!=null)checks.push(rdCheck(`${id}: billing kg × rate = amount`,r.amount,r.bill*r.rate,{warnOnly:true}))});
 const mode=findListItem("mode",modeT)||null;const party=findParty(company)||null;const fbaLoc=item("marketplace","amazon_uk")?.loc||null;
 const hdr=["No.","ASIN","Product Description","Colour","Cartons","Units / Carton","Total Units","Weight / Carton (kg)","Billing Weight (kg)","Rate (per kg)","Amount","Forwarder"];
 const out=[hdr].concat(rows.map(r=>[r.no,r.asin,r.desc,r.colour,r.ctn??"",r.per??"",r.units??"",r.wt??"",r.bill??"",r.rate??"",r.amount??"",company]));
 const ft={ctn:tot[0]??null,qty:tot[2]??null,kg:tot[4]??null,cost:tot[6]??freight??null};
 return{map:{asin:"ASIN",title:"Product Description",ctn:"Cartons",qty:"Total Units",kg:"Billing Weight (kg)",rate:"Rate (per kg)",cost:"Amount",party:"Forwarder"},fmt:"fwd_invoice",label:"Forwarder freight invoice (PDF, Vartleaves template)",kind:"shipments",sheetName:"PDF",sheets:[{name:"Freight invoice › charges",rows:out,fixed:true,fileTotals:ft}],checks,
  meta:{piNo:invNo,invoiceNo:invNo,date:dt,due,cur,partyRaw:company,party,fc,fbaId,amzRef,mode:modeT,etd,eta,incoterm:inco,status,tracking:/not yet/i.test(track)?"":track,freight,duty,vat,other,disc,dueAmt},
  def:{party,date:etd||dt,ref:invNo,cur,mode,eta,fbaId,fc,incoterm:findListItem("incoterm",inco)||inco||null,dest:fbaLoc,due,fwdStatus:status},
  info:[`${company||"Forwarder"} · invoice ${invNo||"—"} · ${modeT||"—"} · ${inco||""} · ${rows.length} lines · ${ft.ctn??sum("ctn")} ctn · ${ft.qty??sum("units")} units · ${ft.kg??rdR(sum("bill"))} kg · ${cur} ${dueAmt??freight??rdR(sum("amount"))}${fbaId?` · ${fbaId}`:""}${fc?` → ${fc}`:""}`]}}

/* ---------- 5. Amazon Sales Dashboard (csv): snapshot totals + daily graph table ---------- */
function rdSalesDash(ctx){const rows=ctx.sheets?.[0]?.rows;if(!rows||!/^sales dashboard$/i.test(rdT(rows[0]?.[0])))return null;
 const si=rdFindRow(rows,r=>/^total order items$/i.test(r[0]||""));const snap=si>=0?rows[si+1]:null;const S_={items:snap?rdN(snap[0]):null,units:snap?rdN(snap[1]):null,sales:snap?rdN(snap[2]):null};
 const ti=rdFindRow(rows,r=>/^time$/i.test(r[0]||""));if(ti<0)return null;const H=rows[ti].map(rdT);const out=[["Date","Ordered product sales","Units ordered","Sales one year ago","Units one year ago"]];
 for(let r=ti+1;r<rows.length;r++){const row=rows[r]||[];const d=rdT(row[0]);if(!/^\d{4}-\d{2}-\d{2}/.test(d))break;out.push([d.slice(0,10),rdN(row[1]),rdN(row[2]),rdN(row[3]),rdN(row[4])])}
 const days=out.length-1;if(!days)return null;const sum=k=>out.slice(1).reduce((s,r)=>s+(r[k]||0),0);const fb=(rows.find(r=>/^fulfil?ment channel$/i.test(rdT(r[0])))||[])[1]||"";const bd=(rows.find(r=>/^sales breakdown$/i.test(rdT(r[0])))||[])[1]||"";
 return{map:{date:"Date",dsales:"Ordered product sales",dunits:"Units ordered"},fmt:"amazon_dashboard",label:"Amazon Sales Dashboard",kind:"dashboard",sheetName:ctx.sheets[0].name,sheets:[{name:"Sales dashboard › daily",rows:out,fixed:true,fileTotals:{dunits:S_.units,dsales:S_.sales}}],
  checks:[rdCheck("Snapshot units = sum of the days",S_.units,sum(2),{d:0}),rdCheck("Snapshot sales = sum of the days",S_.sales,sum(1))],meta:{from:out[1][0],to:out[days][0],days,items:S_.items,units:S_.units,sales:S_.sales,breakdown:rdT(bd),fulfilment:rdT(fb)},def:{channel:"amazon_uk"},
  info:[`${days} days ${fmtD(out[1][0])}–${fmtD(out[days][0])} · ${S_.units} units · £${S_.sales} · ${rdT(bd)} · ${rdT(fb)}`]}}

/* ---------- recognise ---------- */
/* ctx {name, ext, sheets:[{name, rows, ws?}], pdf?} → a reader result or null. A reader that throws is reported, never fatal. */
const RD_READERS=[["joyce_ci",rdJoyceCI],["packing_info",rdPackInfo],["eco_pi",rdEcoPI],["fwd_invoice",rdFwdInvoicePdf],["amazon_dashboard",rdSalesDash]];
function rdRecognise(ctx){const errs=[];for(const[id,fn]of RD_READERS){try{const r=fn(ctx);if(r){r.file=ctx.name;return r}}catch(e){console.warn("reader",id,e);errs.push(id+": "+e.message)}}if(errs.length)ctx.readerErrors=errs;return null}

/* candidate orders for a supplier invoice that is PART of an order (same PI no.): lines fit what is still open */
function rdPOCands(piNo,lines,skuOf){const pi=String(piNo||"").trim().toUpperCase();if(!pi)return[];const pos=live(D.purchases).filter(p=>[p.piNo,p.yourRef].some(x=>x&&String(x).trim().toUpperCase()===pi));
 return pos.map(po=>{const used={};(po.parts||[]).forEach(pt=>(pt.lines||[]).forEach(l=>{if(l.poLine!=null)used[l.poLine]=(used[l.poLine]||0)+(+l.q||0)}));const take={};let fit=0,miss=0,over=0;const map=[];
  lines.forEach(l=>{const sku=skuOf(l);let i=(po.lines||[]).findIndex((x,k)=>x.sku&&sku&&x.sku===sku&&!take[k]);if(i<0)i=(po.lines||[]).findIndex((x,k)=>l.u!=null&&Math.abs((+x.u||0)-l.u)<0.005&&(ixPack(x.p)==null||ixPack(l.title)==null||ixPack(x.p)===ixPack(l.title))&&(((+x.q||0)-(used[k]||0)-(take[k]||0))>=(l.q||0)));if(i<0)i=(po.lines||[]).findIndex(x=>l.u!=null&&Math.abs((+x.u||0)-l.u)<0.005);
   if(i<0){miss++;map.push(null);return}const open=(+po.lines[i].q||0)-(used[i]||0)-(take[i]||0);take[i]=(take[i]||0)+(l.q||0);if((l.q||0)<=open)fit++;else over++;map.push(i)});
  const openQ=(po.lines||[]).reduce((s,x,k)=>s+(+x.q||0)-(used[k]||0),0);const dupe=(po.parts||[]).find(p=>String(p.no||"").toUpperCase()===String(lines.invNo||"").toUpperCase()&&lines.invNo);
  return{po,map,fit,miss,over,openQ,score:fit*10-miss*20-over*15+Math.min(5,openQ/1e4),why:`${fit} of ${lines.length} lines fit what is still open${over?` · ${over} over the open quantity`:""}${miss?` · ${miss} not on the order`:""} · ${num(openQ)} units still open`}}).sort((a,b)=>b.score-a.score||(b.openQ-a.openQ)||(a.po.no<b.po.no?-1:1))}
