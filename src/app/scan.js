/* ---------- Barcode / QR scan on the phone (receive, count, move, product) ----------
   Uses the browser's own BarcodeDetector (Chrome / Edge on Android, Chrome desktop with a camera). Where it is missing (iPhone Safari)
   the button says so and the code can be typed. A scanned EAN / SKU / ASIN / FNSKU finds the product; on a lines form it fills the first
   empty line or adds a new one (+1 pack per repeat scan). No photos are stored. */
const SCAN_FORMS={receive:"lines",count:"lines",move:"lines",purchase:"lines",shipment:"lines"};   /* field key of the lines table on each form */
const eanList=p=>[].concat(p.ean||[]).join(",").split(/[,\s;]+/).filter(Boolean);
function scanFind(code){code=String(code||"").trim();if(!code)return null;const n=norm(code);const ps=live(D.products);
 return ps.find(p=>norm(p.sku)===n)||ps.find(p=>eanList(p).some(e=>norm(e)===n))||ps.find(p=>norm(p.asin||"")===n||norm(p.fnsku||"")===n)||ps.find(p=>eanList(p).some(e=>e.replace(/\D/g,"").length>=8&&code.replace(/\D/g,"").endsWith(e.replace(/\D/g,""))))||null}
function scanApply(code){const d=S.drawer;if(!d||!d.form)return;const pr=scanFind(code);
 if(d.form==="product"){if(!pr||pr.sku===d.ctx.edit?.sku){const cur=String(val("ean")||"");if(!cur.split(/[,\s;]+/).includes(code)){setv("ean",cur?cur+", "+code:code);d.changed.ean=true}toast(`Barcode ${code} added`);return}toast(`${code} already belongs to ${pr.sku}`,{ms:6000});return}
 if(!pr){toast(`No product has barcode ${code} — add it on the product (Barcodes / EAN)`,{ms:7000});try{navigator.vibrate&&navigator.vibrate([80,60,80])}catch(_){}return}
 const rk=SCAN_FORMS[d.form];if(!rk||!d.rows||!d.rows[rk]){toast(`${pr.sku} — ${pr.name||""}`);return}
 const rows=d.rows[rk];let row=rows.find(r=>r.sku===pr.sku);if(row){row.q=(+row.q||0)+1}else{row=rows.find(r=>!r.sku);if(row)row.sku=pr.sku;else{row={sku:pr.sku};rows.push(row)}if(row.q==null||row.q==="")row.q=1}
 d.changed["rows:"+rk]=true;redrawRows(rk);try{markDirty();syncCurrent()}catch(_){}try{navigator.vibrate&&navigator.vibrate(40)}catch(_){}toast(`${pr.sku} · ${num(row.q)} pack${row.q>1?"s":""}`)}
let scanStream=null,scanTimer=null;
function scanClose(){clearInterval(scanTimer);scanTimer=null;try{scanStream&&scanStream.getTracks().forEach(t=>t.stop())}catch(_){}scanStream=null;document.getElementById("scanbox")?.remove()}
async function scanOpen(){if(!("BarcodeDetector" in window)){toast("Scanning needs Chrome on Android (or a desktop Chrome with a camera). On iPhone, type the barcode.",{ms:8000});return}
 scanClose();const box=document.createElement("div");box.id="scanbox";box.innerHTML=`<div class="scanin"><video playsinline muted autoplay></video><div class="scanh">Point at the barcode <button type="button" class="btn sm" data-act="scanclose">Close</button></div><div class="scanlast" aria-live="polite"></div></div>`;document.body.appendChild(box);
 const video=box.querySelector("video");try{scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280}},audio:false});video.srcObject=scanStream;await video.play()}catch(e){scanClose();toast("Camera not available: "+(e.message||e),{ms:7000});return}
 let det;try{det=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39","qr_code","itf","data_matrix"]})}catch(_){det=new BarcodeDetector()}
 let last="",lastAt=0;scanTimer=setInterval(async()=>{if(video.readyState<2)return;try{const codes=await det.detect(video);const c=codes&&codes[0]&&codes[0].rawValue;if(!c)return;const now=Date.now();if(c===last&&now-lastAt<1800)return;last=c;lastAt=now;box.querySelector(".scanlast").textContent=c;scanApply(c)}catch(e){}},350)}
document.addEventListener("click",e=>{const b=e.target.closest('[data-act="scan"],[data-act="scanclose"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(b.dataset.act==="scan")scanOpen();else scanClose()},true);
formShell=(function(orig){return function(form){let h=orig(form);try{if(SCAN_FORMS[form]||form==="product"){h=h.replace('<div class="df">',`<div class="df"><button type="button" class="btn" data-act="scan" title="Scan a barcode with the camera">📷 Scan</button>`)}}catch(e){console.warn(e)}return h}})(formShell);
