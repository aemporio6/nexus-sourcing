/* ---------- Importer: row-level report + an honest Import button ----------
   "⬇ Row report" downloads every row of the preview with its status and the exact reasons (errors, skips, warnings) and the mapped
   values — the file the person sends back to a supplier or VA. The Import button says what is left out and why. */
function ixRowReport(I,P){const K=IXK[I.kind];const fields=Object.keys(IXF).filter(f=>I.sheets.some(s=>s.map[f]!=null));const rows=[["Sheet","Row","Status","Reasons",...fields.map(f=>IXF[f].l)]];
 P.rows.forEach(r=>{const s=I.sheets[r.si];const cells=I.edits[r.si+":"+r.ri];const val=c=>cells&&c in cells?cells[c]:s.data[r.ri][c];
  rows.push([s.name,r.ri+1+s.hi+s.span,{ok:"OK",warn:"Check",err:"Error",skip:"Skipped",info:"OK"}[r.st]||r.st,r.why.map(w=>(w.l==="err"?"ERROR: ":w.l==="warn"?"CHECK: ":w.l==="skip"?"SKIPPED: ":"")+w.t).join(" | "),...fields.map(f=>{const c=s.map[f];return c==null?"":val(c)})])});
 const name=`MYTOOL_import_report_${(I.file||"paste").replace(/\.[^.]+$/,"").replace(/[^A-Za-z0-9_-]+/g,"_").slice(0,40)}_${today()}.csv`;
 saveBlob(new Blob([ixToCsv(rows)],{type:"text/csv;charset=utf-8"}),name);toast(`Row report ready: ${P.rows.length} rows — ${P.counts.err||0} errors, ${P.rows.filter(r=>r.st==="skip").length} skipped`)}
ixFootHtml=(function(orig){return function(I,P){let h=orig(I,P);try{const open=Object.values(P.unk).filter(u=>!u.dec).length;const skip=P.rows.filter(r=>r.st==="skip").length;const err=P.counts.err||0;
  const parts=[];if(err)parts.push(`${err} with errors left out`);if(open)parts.push(`${open} undecided waiting`);if(skip)parts.push(`${skip} skipped`);
  h=h.replace('<button class="btn" data-act="cancelimport">Clear</button>',`<button class="btn" data-act="improwreport" title="Every row with its status and reasons, as CSV">⬇ Row report</button><button class="btn" data-act="cancelimport">Clear</button>${parts.length?`<span class="status" style="color:var(--warn,#8a5a00)">Not imported: ${esc(parts.join(" · "))} — see the row report</span>`:""}`)}catch(e){console.warn(e)}return h}})(ixFootHtml);
document.addEventListener("click",e=>{const b=e.target.closest('[data-act="improwreport"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const I=S.imp;if(!I||!I.preview){toast("Nothing to report yet");return}ixRowReport(I,I.preview)},true);
