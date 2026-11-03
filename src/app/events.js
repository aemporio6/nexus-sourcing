/* ===================== events & boot v3 ===================== */
const FORM_FOR_COL={purchases:"purchase",shipments:"shipment",payments:"payment",inspections:"inspection",receipts:"receive",moves:"move",credits:"credit",products:"product",parties:"party"};
function createMenu(date){const items_=CREATE_REG.map(c=>[c.k,c.l,c.hint]);/* one list: the same entries appear in + Create and in each module's menu */
 return`<div class="menu" role="menu"><h6>Create${date?" · "+fmtD(date):""}</h6>${items_.map(([k,l,s])=>`<button role="menuitem" data-act="new" data-k="${k}" ${date?`data-date="${date}"`:""}>${esc(l)}<small>${esc(s)}</small></button>`).join("")}</div>`}
function bellList(){const a=attention().slice(0,12);return`<div class="menu" role="menu" style="min-width:300px"><h6>Alerts</h6>${a.length?a.map(x=>`<button role="menuitem" ${x.col?`data-open="${x.col}" data-id="${esc(x.id)}"`:x.view?`data-view="${x.view}"`:""}><span class="sdot" style="background:${x.sev>=3?"var(--bad)":x.sev===2?"var(--warn)":"var(--info)"}"></span><span style="flex:1">${esc(x.text)}</span></button>`).join(""):`<div class="empty">Nothing needs attention</div>`}<button data-view="attention">All alerts →</button></div>`}
function openNew(k,ds={}){if(!can("create")){toast("Your role cannot create records");return}const ctx={};if(ds.date)ctx.date=ds.date;if(ds.party)ctx.party=ds.party;if(ds.po)ctx.po=ds.po;if(ds.sh)ctx.sh=ds.sh;if(ds.sku)ctx.sku=ds.sku;if(ds.loc)ctx.loc=ds.loc;if(ds.type)ctx.type=ds.type;openForm(k,ctx);if(ds.date)setTimeout(()=>{if($("#f_date"))setv("date",ds.date)},30)}
function editDoc(col,id){const x=(D[col]||[]).find(v=>(v.no||v.id)===id||v.id===id||v.sku===id||v.code===id);if(!x)return;if(col==="payments"&&x.locked&&!can("approve")){toast("Locked payment — Finance/Owner can unlock");return}if(!can("edit")&&!can("create")){toast("Your role cannot edit");return}openForm(FORM_FOR_COL[col],{edit:x,force:true})}

document.addEventListener("click",async e=>{if(e.target.matches("input[data-sel]")){e.stopPropagation();return}const t=e.target.closest("[data-act],[data-view],[data-open],[data-gof],[data-crumb],[data-setup],[data-listkey],[data-formkey],[data-sadd],[data-sarch],[data-smove],[data-sdef],[data-sv],[data-sort],[data-day],[data-role],[data-f-toggle],[data-caltype],[data-tab]");
 if(!t){if(!e.target.closest("#menu,#bellp,#moremenu,#sugg,.search,#recentp")){$("#menu").innerHTML="";$("#bellp").innerHTML="";if($("#recentp"))$("#recentp").innerHTML="";const mm=$("#moremenu");if(mm)mm.hidden=true;hideSugg()}return}
 const ds=t.dataset;
 if(ds.view){if(ds.view===S.view.k&&!S.drawer){window.scrollTo(0,0);return}if(S.drawer?.form&&!confirmDirty())return;S.drawer=null;go(ds.view,{},{force:true});return}
 if(ds.gof){try{const g=JSON.parse(ds.gof);if(S.drawer?.form&&!confirmDirty())return;if(!S.drawer?.form)refreshHist();if(g.f){S.f[g.k]={...g.f}}if(g.clear)S.f[g.k]={};S.limit[g.k]=60;S.drawer=null;go(g.k,{},{force:true});filtersChanged(g.k)}catch(e){console.warn(e)}return}
 if(ds.crumb){go(ds.crumb,{},{force:true});return}
 if(ds.open){if(S.drawer?.form&&!confirmDirty())return;$("#bellp").innerHTML="";if($("#recentp"))$("#recentp").innerHTML="";openDoc(ds.open,ds.id);return}
 if(ds.setup){S.setupTab=ds.setup;if(ds.listkey)S.listKey=ds.listkey;if(S.view.k!=="setup")go("setup",{},{force:true});else render();return}if(ds.listkey){S.listKey=ds.listkey;/* the chip keeps focus inside #setupbody, which would hold the re-render */t.blur?.();render();return}if(ds.formkey){S.formKey=ds.formkey;t.blur?.();render();return}
 if(ds.sadd){await setupAdd(ds.sadd,ds);return}
 if(ds.sarch){const cur=getPath(SET(),ds.sarch+".archived");await setupPatch(ds.sarch+".archived",!cur,cur?"Restored":"Archived");render();return}
 if(ds.smove){const path=ds.smove.split(".");const i=+path.pop();const arr=getPath(SET(),path).slice();const j=i+(+ds.dir);if(j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]];await setupPatch(path,arr,"Reordered");render();return}
 if(ds.sdef){const path=ds.sdef.split(".");const i=+path.pop();const arr=getPath(SET(),path).map((x,k)=>({...x,default:k===i}));const pairs=[[path,arr]];/* one default only: the companies radio and Rates › Default buying company are the same setting */if(path.join(".")==="companies")pairs.push(["defaults.company",arr[i].id]);await setupPatchMany(pairs,"Default set");render();return}
 if(ds.sv){const v=D.views.find(x=>x.id===ds.sv);if(v){S.f[v.page]={...v.f};S.limit[v.page]=60;filtersChanged(v.page);render()}return}
 if(ds.sort){const f=F();f.sort=f.sort===ds.sort+"_asc"?ds.sort+"_desc":ds.sort+"_asc";filtersChanged(S.view.k);renderList();return}
 if(ds.day){$("#menu").innerHTML="";const m=$("#menu");m.innerHTML=createMenu(ds.day);m.style.position="fixed";return}
 if(ds.role!==undefined){if((S.realRole||S.role)!=="owner"){toast("Only the Owner can switch view");return}S.role=ds.role;ls.set("role",ds.role);render();return}
 if(ds.fToggle!==undefined){const f=F();if(f[ds.fToggle])delete f[ds.fToggle];else f[ds.fToggle]=1;S.limit[S.view.k]=60;filtersChanged(S.view.k);render();return}
 if(ds.caltype){const all=["due","eta","ready","ship","slot","insp","paid","reorder"];if(!S.calTypes){S.calTypes={};all.forEach(k=>S.calTypes[k]=true)}S.calTypes[ds.caltype]=!S.calTypes[ds.caltype];render();return}
 if(ds.tab){S.tab=ds.tab;render();return}
 const a=ds.act;if(!a)return;
 if(a!=="recent"&&$("#recentp")&&!t.closest("#recentp"))$("#recentp").innerHTML="";if(!["newmenu","bell","moremenu"].includes(a)&&!t.closest("#menu,#bellp,#moremenu")){$("#menu").innerHTML="";$("#bellp").innerHTML=""}
 switch(a){
  case"home":if(S.drawer?.form&&!confirmDirty())return;S.drawer=null;go("home",{},{force:true});break;
  case"refresh":{if(window.MYTOOL){toast("Getting the latest…");await MYTOOL.syncNow().catch(()=>{})}_st&&_st.clear&&_st.clear();render();toast("Up to date");break}
  case"syncnow":if(window.MYTOOL){if(MYTOOL.st?.k==="bad")await MYTOOL.reauth().catch(e=>toast(e.message));else await MYTOOL.syncNow().catch(()=>{})}render();break;
  case"signout":if(window.MYTOOL){if(MYTOOL.pending()&&!confirm("Some changes are still being saved. Sign out anyway?"))return;MYTOOL.signOut()}break;
  case"recnav":{const id=t.dataset.id;if(id&&S.drawer)openDoc(S.drawer.col,id);break}
  case"shareuser":{if(!window.MYTOOL||MYTOOL.demo){toast("Sharing works in the live app");break}const em=String(ds.email||"").trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[a-z]+$/.test(em)){toast("Type a valid Google email first");break}try{await MYTOOL.shareWith(em,ds.ro==="viewer"?"reader":"writer");toast("Data folder shared with "+em)}catch(err){toast("Could not share: "+err.message)}break}
  case"recent":{const p=$("#recentp");if(!p)break;if(p.innerHTML){p.innerHTML="";break}const r=recentList();p.innerHTML=`<div class="recentp" role="menu"><h6>Recently opened</h6>${r.length?r.map(x=>{const d=(D[x.col]||[]).find(v=>(v.no||v.id)===x.id);return`<button type="button" data-open="${esc(x.col)}" data-id="${esc(x.id)}"><span class="ref">${esc(x.id)}</span><span class="lab">${esc(label(x.col,d))}</span></button>`}).join(""):`<p class="note" style="padding:8px 12px">Nothing yet — records you open show here.</p>`}</div>`;break}
  case"back":back();break;case"fwd":fwd();break;case"undo":await undo();break;case"redo":await redo();break;
  case"newmenu":{const m=$("#menu");m.style.position="";m.innerHTML=m.innerHTML?"":createMenu();break}
  case"bell":{const b=$("#bellp");b.innerHTML=b.innerHTML?"":bellList();break}
  case"moremenu":{const mm=$("#moremenu");if(mm)mm.hidden=!mm.hidden;break}
  case"new":$("#menu").innerHTML="";openNew(ds.k,ds);break;
  case"close":closeDrawer();break;
  case"discard":if(S.drawer){S.drawer.dirty=false;closeDrawer(true)}$("#dirtybar").hidden=true;break;
  case"save-current":case"save":{if(!S.drawer?.form)return;const k=S.drawer.form;const btn=$('.df [data-act="save"]');if(btn)btn.disabled=true;try{await freshNumberBeforeSave(k);await SAVE[k]()}catch(err){console.error(err);toast("Could not save: "+(err.message||err))}finally{const b2=$('.df [data-act="save"]');if(b2)b2.disabled=false}break}
  case"ack":if(S.drawer){S.drawer.ack=true;await SAVE[S.drawer.form]()}break;
  case"trashcur":{if(!S.drawer?.ctx.edit)return;const col=FORM_COL[S.drawer.form];const id=S.drawer.id;S.drawer=null;await trashDoc(col,id);render();break}
  case"usedraft":applyDraft();break;case"dropdraft":clearDraft(S.drawer.form,S.drawer.ctx);$("#draftinfo").textContent="";S.drawer.draft=null;break;
  case"addrow":addRow(ds.rows,{});markDirty();if(S.drawer)S.drawer.changed["rows:"+ds.rows]=true;syncCurrent();break;case"rowmore":{const r=rowsOf(ds.rows)[+ds.i];if(r){const f=fields(S.drawer.form).find(x=>x.k===ds.rows);const spec=ROWS[f?.rows]||{};const open=rowMoreOpen(spec,r);if(open&&(spec.more||[]).some(c=>c.t==="owner"&&r[c.k]&&r[c.k]!=="this_order")){toast("Set it back to “"+(ds.rows==="allocations"?"not used":"This order")+"” to close");break}r._more=!open;redrawRows(ds.rows);const nx=$(`#r_${ds.rows}_${ds.i}_${(spec.more||[])[0]?.k}`);if(r._more)nx?.focus()}break}case"rmrow":rmRow(ds.rows,+ds.i);if(S.drawer)S.drawer.changed["rows:"+ds.rows]=true;break;
  case"inladd":await inlineCommit(ds.k,ds.list,ds.rrow!=null?{k:ds.rrow,i:+ds.ri,c:ds.rc}:null);break;case"inladdset":await inlineCommitSet(ds.k,ds.kind);break;case"inlcancel":{const b=$("#"+(ds.box||"inl_"+ds.k));if(b)b.hidden=true;break}
  case"copyref":case"copytext":{const txt=ds.text||$("#"+ds.target)?.textContent||"";try{await navigator.clipboard.writeText(txt);toast("Copied: "+txt)}catch(_){toast(txt)}break}
  case"more":S.limit[S.view.k]=(S.limit[S.view.k]||60)+100;renderList();break;case"all":S.limit[S.view.k]=1e9;renderList();break;
  case"clearf":clearF(S.view.k);render();break;
  case"ffold":S.fopen=S.fopen||{};S.fopen[S.view.k]=!S.fopen[S.view.k];render();break;
  case"saveview":{const name=($("#svname")?.value||"").trim();const pg_=ds.page||S.view.k;const f=F(pg_);if(!Object.keys(f).filter(k=>f[k]!==""&&k!=="q").length){toast("Set a filter first");return}if(!name){$("#svname")?.focus();toast("Give the view a name");return}const id="v_"+nid();await writeDoc("views",id,{id,page:pg_,name,f:{...f},by:uid||"local"},`View "${name}" saved`);break}
  case"delview":await trashDoc("views",ds.id,"View removed");break;
  case"renview":{S.renView=S.renView===ds.id?null:ds.id;render();setTimeout(()=>{const i=$("#svren_"+ds.id);i?.focus();i?.select()},0);break}
  case"renviewok":{const v=D.views.find(x=>x.id===ds.id);const name=($("#svren_"+ds.id)?.value||"").trim();if(!name){toast("Type a name");return}S.renView=null;if(v&&name!==v.name)await updateDoc("views",v.id,{name},"View renamed");else render();break}
  case"exportview":exportXlsx("view");break;case"exportxlsx":exportXlsx(ds.scope||"all");break;case"exportsetup":exportSetupJson();break;case"exportall":exportAllJson();break;case"importsetup":$("#setup_file")?.click();break;
  case"bulk":await bulkAction(ds.op);break;
  case"preview":openDoc(ds.col,ds.id,{allowTrashed:true});break;
  case"histall":S.histAll=S.histAll===ds.sku?null:ds.sku;render();break;
  case"counternext":{const inp=$("#cnt_"+ds.col);if(inp&&inp.value)if(await setCounterNext(ds.col,inp.value))render();break}
  case"edit":editDoc(ds.col,ds.id);break;
  case"copy":{const p=D.purchases.find(x=>x.no===ds.id);if(p)openForm("purchase",{copy:p,force:true});break}
  case"trash":{if(!can("deleteAny")){toast("Only Finance/Owner can trash");return}S.drawer=null;await trashDoc(ds.col,ds.id);render();break}
  case"restore":await restoreDoc(ds.col,ds.id);toast(`${ds.id} restored`,{open:[ds.col,ds.id]});break;
  case"purge":{if(!can("deleteAny"))return;if(!S.confirmPurge||S.confirmPurge!==ds.id){S.confirmPurge=ds.id;toast("Press Delete now again to remove permanently");return}await rawDelete(ds.col,ds.id);logEv("purge",ds.col,ds.id,"Deleted permanently");S.confirmPurge=null;render();break}
  case"setstatus":{const x=(D[ds.col]||[]).find(v=>(v.no||v.id)===ds.id||v.sku===ds.id);if(!x)return;const patch={status:ds.status};const lab=`${ds.id} → ${L({purchases:"poStatus",shipments:"shipStatus",payments:"payStatus",products:"productStatus"}[ds.col]||"",ds.status)||ds.status}`;
   if(ds.col==="shipments"&&ds.status==="arrived")patch.arrival=x.arrival||today();
   if(ds.col==="purchases"){patch.prevStatus=x.status;
    /* closing an order that still owes money needs a reason: the rest is written off and shown everywhere */
    if(ds.status==="closed"){const st=poState(x);if(st.outstandingCur>0.5||st.owedToUs>0.5){S.closeAsk=x.no;render();return}patch.closedManually=true;patch.closeReason="closed by hand — fully paid"}
    else{const pre=["ordered","deposit","production","inspected"].includes(ds.status);const logi=["part_shipped","shipped","part_received","received"].includes(ds.status);patch.stageManual=pre?ds.status:null;patch.statusManual=logi?ds.status:null;if(x.status==="closed"||x.writtenOff){patch.closedManually=false;patch.writtenOff=null;patch.closeReason=null}if(ds.status==="hold")patch.hold=true;else if(x.hold&&ds.status!=="cancelled")patch.hold=false}}
   if(ds.col==="payments"){if(ds.status==="paid"&&x.needsApproval&&!x.approved&&!can("approve")){toast("Needs approval first");return}if(ds.status==="paid"){patch.cancelReason=null;patch.cancelNote=null;patch.cancelledAt=null;patch.cancelledBy=null;if(x.needsApproval&&!x.approved){patch.approved=true;patch.approvedBy=uid||S.role;patch.approvedAt=nowIso()}}}
   await updateDoc(ds.col,x.id,patch,lab);if(ds.col==="purchases"){const now=D.purchases.find(p=>p.no===x.no);if(now&&now.status!==ds.status&&!["closed"].includes(ds.status))toast(`${x.no}: status follows the data — ${L("poStatus",now.status)} (${now.statusWhy?.text||""})`)}
   if(ds.col==="shipments"&&ds.status==="arrived"&&!S.drawer?.form)openForm("receive",{sh:ds.id,force:true});break}
  case"closepono":S.closeAsk=null;render();break;
  case"closepook":{const p=D.purchases.find(x=>x.no===ds.id);if(!p)return;const reason=($("#close_reason")?.value||"").trim();if(!reason){toast("Type why the rest is written off");$("#close_reason")?.focus();return}const st=poState(p);S.closeAsk=null;
   await updateDoc("purchases",p.no,{status:"closed",prevStatus:p.status,closedManually:true,closeReason:`closed by hand: ${reason}`,writtenOff:Math.abs(st.balance)>0.5?{amount:r2(st.balance+(st.writtenOff||0)),cur:p.cur,gbp:r2(st.outstandingGbp-st.owedToUsGbp),reason,at:nowIso(),by:uid||S.role}:null},`${p.no} closed — ${st.outstandingCur>0.5?fmt(st.outstandingCur,p.cur)+" unpaid written off":fmt(st.owedToUs,p.cur)+" overpaid written off"} (${reason})`);break}
  case"writeoffclosed":{if(!can("approve")){toast("Finance/Owner only");return}const list=D.purchases.filter(p=>!p.deletedAt&&p.status==="closed"&&!p.writtenOff&&poState(p).outstandingCur>0.5);if(!list.length){toast("Nothing to write off");return}beginBatch(`${list.length} closed orders: balance written off`);for(const p of list){const st=poState(p);await updateDoc("purchases",p.no,{closedManually:true,closeReason:"closed with a balance — written off (Home task)",writtenOff:{amount:st.outstandingCur,cur:p.cur,gbp:st.outstandingGbp,reason:"closed in the old sheets with a balance",at:nowIso(),by:uid||S.role}},`${p.no} ${fmt(st.outstandingCur,p.cur)} written off (closed order)`,{quiet:true})}await endBatch();toast(`${list.length} closed orders written off`,{undo:true});render();break}
  case"deductcn":{const c=D.credits.find(x=>x.no===ds.id);if(!c)return;const po=owingPOs().filter(p=>p.party===c.party&&p.no!==c.po).sort((a,b)=>(a.date||"")<(b.date||"")?-1:1)[0]||owingPOs().find(p=>p.party===c.party);if(!po){toast(`No open order from ${pname(c.party)} to deduct ${c.no} from — record the refund instead (Apply › Refund received)`);return}openForm("payment",{po:po.no,deductCn:c.no,force:true});break}
  case"recalclanded":{beginBatch(`${ds.id} landed cost recalculated`);await recomputeLanded(ds.id,"Recalculate button");await endBatch();toast(`${ds.id} landed cost recalculated`,{undo:true});render();break}
  case"addrate":await addRate(ds.cur,$("#rate_in_"+ds.k)?.value,ds.k);if(S.view.k==="setup"&&!S.drawer)render();break;
  case"pay":openForm("payment",{po:ds.po,ms:ds.ms!=null&&ds.ms!==""?+ds.ms:undefined,sh:ds.sh,ref:ds.ref,party:ds.party,force:true});break;
  case"ship":openForm("shipment",{po:ds.po,force:true});break;
  case"receive":openForm("receive",{sh:ds.sh,po:ds.po,force:true});break;
  case"inspect":openForm("inspection",{po:ds.po,force:true});break;case"reinspect":openForm("inspection",{reOf:ds.id,force:true});break;
  case"credit":openForm("credit",{po:ds.po,rc:ds.rc,force:true});break;
  case"reorder":{const p=product(ds.sku);if(!p)return;const r=reorderInfo(ds.sku);openForm("purchase",{sku:ds.sku,qty:r.qty||undefined,force:true});break}
  case"move":openForm("move",{sku:ds.sku,loc:ds.loc,type:ds.type,force:true});break;
  case"approve":{if(!can("approve")){toast("Finance/Owner only");return}await updateDoc("payments",ds.id,{approved:true,approvedBy:uid||S.role,approvedAt:nowIso()},`${ds.id} approved`);break}
  case"markpaid":await updateDoc("payments",ds.id,{status:"paid",paidAt:nowIso()},`${ds.id} marked paid`);break;
  case"cancelpay":{S.cancelAsk=ds.id;render();break}
  case"cancelpayno":S.cancelAsk=null;render();break;
  case"cancelpayok":{const p=D.payments.find(x=>x.no===ds.id);if(!p)return;const reason=$("#cancel_reason")?.value||"";if(!reason){toast("Pick a reason");return}S.cancelAsk=null;beginBatch(`${ds.id} not counted: ${L("cancelReason",reason)||reason}`);await updateDoc("payments",ds.id,{status:"cancelled",cancelReason:reason,cancelNote:($("#cancel_note")?.value||"").trim()||null,cancelledAt:nowIso(),cancelledBy:uid||"local"},`${ds.id} not counted (${L("cancelReason",reason)||reason})`,{quiet:true});/* milestones, order statuses and credit notes re-derive in endBatch() */await endBatch();toast(`${ds.id} not counted`,{undo:true});render();break}
  case"refund":{const p=D.payments.find(x=>x.no===ds.id);if(!p)return;openForm("payment",{party:p.party,force:true,refundOf:p.no});setTimeout(()=>{if(!S.drawer)return;S.drawer.refundOf=p.no;["direction","type","amount","cur"].forEach(k=>{S.drawer.touched[k]=true});setv("direction","in");setv("type","refund");setv("amount",p.amount);setv("cur",p.cur);rowsOf("allocations")[0].ref=(p.allocations||[])[0]?.ref||"";redrawRows("allocations");syncPayParty();syncPay()},60);break}
  case"lock":await updateDoc("payments",ds.id,{locked:true},`${ds.id} locked`);break;case"unlock":if(!can("approve")){toast("Finance/Owner only");return}await updateDoc("payments",ds.id,{locked:false},`${ds.id} unlocked`);break;
  case"pdf":pdfDoc(ds.col,ds.id);break;case"fwdpdf":{if(ds.col==="purchases"){const sh=live(D.shipments).filter(x=>(x.lines||[]).some(l=>l.po===ds.id)||(x.purchases||[]).includes(ds.id)).pop();if(sh)forwarderPdf(sh.no);else toast("Create the shipment first — the packing list is built from it")}else forwarderPdf(ds.id);break}case"statement":statementPdf(ds.party);break;
  case"archiveparty":{const p=party(ds.id);if(!p)return;await updateDoc("parties",p.id,{status:p.status==="archived"?"active":"archived"},`${p.name} ${p.status==="archived"?"restored":"archived"}`);break}
  case"linkorders":editDoc("shipments",ds.sh);break;
  case"mergeproduct":{const box=$("#mergebox");if(box){box.hidden=false}break}
  case"mergeinto":{const from=ds.sku;const to=$("#mergesel")?.value;if(!to||to===from){toast("Pick the product to merge into");return}beginBatch(`${from} merged into ${to}`);for(const p of live(D.purchases)){if((p.lines||[]).some(l=>l.sku===from))await updateDoc("purchases",p.no,{lines:p.lines.map(l=>l.sku===from?{...l,sku:to}:l)},null,{quiet:true})}for(const s of live(D.shipments)){if((s.lines||[]).some(l=>l.sku===from))await updateDoc("shipments",s.no,{lines:s.lines.map(l=>l.sku===from?{...l,sku:to}:l)},null,{quiet:true})}for(const r of live(D.receipts)){if((r.lines||[]).some(l=>l.sku===from))await updateDoc("receipts",r.no,{lines:r.lines.map(l=>l.sku===from?{...l,sku:to}:l)},null,{quiet:true})}for(const m of live(D.moves)){if(m.sku===from)await updateDoc("moves",m.no,{sku:to},null,{quiet:true})}await updateDoc("products",from,{status:"archived",mergedInto:to},null,{quiet:true});await endBatch();toast(`${from} merged into ${to}`,{undo:true});openDoc("products",to);break}
  case"maplegacy":{const sel=(ds.sel&&document.querySelector(`[data-legacysel="${CSS.escape(ds.sel)}"]`))||t.parentElement.querySelector("[data-legacysel]");const target=sel?.value;if(!target){toast("Pick a value");return}beginBatch(`Mapped "${ds.value}"`);for(const x of (D[ds.col]||[])){if(x.legacy?.[ds.field]===ds.value){const leg={...x.legacy};delete leg[ds.field];await updateDoc(ds.col,x.id,{[ds.field]:target,legacy:leg},null,{quiet:true})}}await endBatch();toast(`Mapped "${ds.value}" → ${target}`,{undo:true});render();break}
  case"delfield":{const cfg=SET().forms?.[ds.form]||{};const cu=(cfg.custom||[]).slice();if(ds.i!=null&&ds.i!=="")cu.splice(+ds.i,1);else{const j=cu.findIndex(f=>f.k===ds.k);if(j>=0)cu.splice(j,1)}await setupPatch(["forms",ds.form,"custom"],cu,"Custom field removed");render();break}
  case"cancelimport":impCancel();break;case"confirmsetup":await confirmSetupImport();render();break;case"cancelsetup":S.pendingSetup=null;{const o=$("#setup_import_out");if(o)o.innerHTML=""}break;
  case"delalias":{const al={...(SET().aliases||{})};delete al[ds.k];await setupPatch("aliases",al,"Alias removed");render();break}
  case"delskualias":{const al={...(SET().skuAliases||{})};delete al[ds.k];await setupPatch("skuAliases",al,"SKU alias removed");render();break}
  case"runimport":await runImport();break;case"undoimport":await undoImport(ds.id);break;
  /* ===== Smart Import (importer.js) — actions added by the importer; handlers live in ixAct() ===== */
  case"imppaste":case"imppasteread":case"impsheet":case"impdec":case"impsim":case"impgroup":case"impall80":case"impfilter":case"impmore":case"impedit":case"impremember":case"impgrpall":case"impcsv":case"exportviewcsv":await ixAct(a,ds,t);break;
  /* ===== end Smart Import ===== */
  case"scan":scan();break;
  case"cal-prev":S.cal=addMonths((S.cal||today().slice(0,7))+"-01",-1).slice(0,7);render();break;case"cal-next":S.cal=addMonths((S.cal||today().slice(0,7))+"-01",1).slice(0,7);render();break;case"cal-today":S.cal=today().slice(0,7);render();break;
  case"doclink":{const inp=(ds.input&&$(ds.input))||t.parentElement.querySelector("input[type=url],input[type=text]");const url=(inp?.value||"").trim();if(!url){toast("Paste a link first");return}await setDocLink(ds.col,ds.id,ds.doc,{url,at:nowIso(),by:uid||"local"});break}
  case"docclear":await setDocLink(ds.col,ds.id,ds.doc,null);break;
  case"togglelist":{const el=$("#"+ds.target);if(el)el.hidden=!el.hidden;break}
  default:console.warn("unhandled act",a)}});
async function setDocLink(col,id,doc,val_){const x=(D[col]||[]).find(v=>(v.no||v.id)===id);if(!x)return;const docs={...(x.docs||{})};if(val_)docs[doc]=val_;else delete docs[doc];const patch={docs};if(col==="payments"&&doc==="receipt")patch.receipt=val_?.url||null;await updateDoc(col,x.id,patch,`${L("docType",doc)||doc} ${val_?"attached":"removed"}`)}
async function bulkAction(op){const page=S.view.k;if(op==="clear"){S.sel[page]={};render();return}const ids=Object.keys(S.sel[page]||{}).filter(k=>S.sel[page][k]);if(!ids.length){toast("Select rows first");return}if(op==="tag"&&!$("#bulktag")?.value){toast("Pick a tag first");return}const col={purchases:"purchases",shipments:"shipments",payments:"payments",stock:"products",products:"products",parties:"parties"}[page];
 if(op==="export"){const keep=S.lastRows[page];const set=new Set(ids);S.lastRows[page]=(keep||[]).filter(x=>set.has(x.no||x.sku||x.code||x.p?.sku||x.p?.code||x.id));exportXlsx("view");S.lastRows[page]=keep;return}if(op==="trash"&&!can("deleteAny")){toast("Finance/Owner only");return}
 let skipped=[];beginBatch(`${ids.length} ${page}: ${op}`);for(const id of ids){const x=(D[col]||[]).find(v=>(v.no||v.id)===id||v.sku===id||v.code===id);if(!x)continue;if(op==="close"){/* only settled orders close in bulk; one that still owes money needs its own reason */const st=poState(x);if(st.outstandingCur>0.5||st.owedToUs>0.5){skipped.push(x.no);continue}await updateDoc(col,x.id,{status:"closed",prevStatus:x.status,closedManually:true,closeReason:"closed by hand (bulk) — fully paid"},null,{quiet:true})}else if(op==="arrived")await updateDoc(col,x.id,{status:"arrived",arrival:x.arrival||today()},null,{quiet:true});else if(op==="archive")await updateDoc(col,x.id,{status:"archived"},null,{quiet:true});else if(op==="trash")await trashDoc(col,x.id,null);else if(op==="tag"){const tag=$("#bulktag")?.value;if(tag)await updateDoc(col,x.id,{tags:[...new Set([...(x.tags||[]),tag])]},null,{quiet:true})}}
 await endBatch();S.sel[page]={};toast(`${ids.length-skipped.length} updated${skipped.length?` · ${skipped.length} not closed (still owing: ${skipped.slice(0,4).join(", ")}${skipped.length>4?"…":""}) — close each one with a reason`:""}`,{undo:true});render()}
async function setupAdd(what,ds){const s=SET();const u=(arr,base)=>{let id=base,n=2;while((arr||[]).some(x=>x.id===id))id=base+n++;return id};
 if(what==="companies"){await setupPatch("companies",(s.companies||[]).concat([{id:u(s.companies,"c"+((s.companies||[]).length+1)),name:"New company",tag:"NEW",vatRegistered:false}]),"Company added")}
 else if(what==="banks"){await setupPatch("banks",(s.banks||[]).concat([{id:u(s.banks,"b"+((s.banks||[]).length+1)),name:"New bank",cur:"GBP",company:DEF().company}]),"Bank added")}
 else if(what==="people"){await setupPatch("people",(s.people||[]).concat([{id:u(s.people,"p"+((s.people||[]).length+1)),name:"New person",role:""}]),"Person added")}
 else if(what==="emails"){await setupPatch("emails",(s.emails||[]).concat([{id:u(s.emails,"e"+((s.emails||[]).length+1)),address:"new@email.com",usedFor:""}]),"Email added")}
 else if(what==="locations"){const parent=ds.parent||null;const base=parent?parent+String.fromCharCode(97+(s.locations||[]).filter(l=>l.parent===parent).length):"L"+((s.locations||[]).filter(l=>!l.parent).length+1);await setupPatch("locations",(s.locations||[]).concat([{id:u(s.locations,base),name:parent?"New area":"New location",kind:parent?loc(parent)?.kind||"own":"own",parent}]),"Location added")}
 else if(what==="newlist"){const key=u(Object.keys(s.lists||{}).map(k=>({id:k})),"list"+(Object.keys(s.lists||{}).length+1));await setupPatch(["lists",key],{label:"New list",group:"General",items:[]},"List added");S.listKey=key}
 else if(what==="listitem"||what==="listsub"){const key=ds.list;const def=listDef(key);const label="New item "+(def.items.length+1);const it={id:u(def.items,slugId(label,def.items)),label};if(what==="listsub")it.parent=ds.parent||def.items.find(i=>!i.parent)?.id||"";(def.fields||[]).forEach(([k,,ty])=>{if(it[k]===undefined)it[k]=ty==="bool"?false:ty==="num"?0:ty==="json"?[]:""});await setupPatch(["lists",key,"items"],def.items.concat([it]),"Item added")}
 else if(what==="user"){await setupPatch("users",(s.users||[]).concat([{uid:"u"+((s.users||[]).length+1),name:"New user",role:"va",active:true}]),"User added")}
 else if(what==="alias"){const al={...(s.aliases||{})};let k="new",n=2;while(al[k])k="new"+n++;al[k]="";await setupPatch("aliases",al,"Alias added")}
 else if(what==="skualias"){const al={...(s.skuAliases||{})};let k="alias",n=2;while(al[k])k="alias"+n++;al[k]="";await setupPatch("skuAliases",al,"SKU alias added")}
 else if(what==="rate"){const h=(s.rates?.history||[]).slice();const lastR=h[h.length-1]||{};h.push({date:today(),RMB:lastR.RMB||.11,USD:lastR.USD||.79});await setupPatch("rates.history",h,"Rate row added")}
 else if(what==="vat"){await setupPatch("vatHistory",(s.vatHistory||[]).concat([{date:today(),pct:FEES().vatPct}]),"VAT row added")}
 else if(what==="field"){const cfg=s.forms?.[ds.form]||{};const custom=(cfg.custom||[]).slice();const k="custom"+(custom.length+1);custom.push({k,l:"New field",t:"text"});await setupPatch(["forms",ds.form,"custom"],custom,"Field added")}
 else if(what==="tag"){const def=listDef("tag");await setupPatch(["lists","tag","items"],def.items.concat([{id:u(def.items,"tag"+(def.items.length+1)),label:"New tag"}]),"Tag added")}
 render()}

/* ---------- change ---------- */
document.addEventListener("change",async e=>{const t=e.target;const ds=t.dataset;
 if(ds.f==="q")return;
 if(ds.f!==undefined&&t.value==="__multi"){openMultiPick(S.view.k,ds.f,t);return}
 if(ds.f!==undefined){if(t.type!=="checkbox"&&String(F()[ds.f]??"")===t.value)return;setF(S.view.k,ds.f,t.type==="checkbox"?(t.checked?1:""):t.value);if(ds.f==="date"&&t.value){setF(S.view.k,"year","")}render();return}
 if(ds.sp){let v=t.type==="checkbox"?t.checked:t.type==="number"?(t.value===""?null:+t.value):t.value;if(t.dataset.json||ds.sptype==="json"){try{v=JSON.parse(t.value||"null")}catch(_){toast("Not valid JSON");return}}if(ds.sptype==="csv")v=String(t.value).split(",").map(x=>x.trim()).filter(Boolean);
  /* duplicate check on rename */const m=ds.sp.match(/^(lists\.[^.]+\.items|companies|banks|emails|locations|people)\.(\d+)\.(label|name|address)$/);if(m&&typeof v==="string"){const arr=getPath(SET(),m[1])||[];const dup=arr.some((x,i)=>i!==+m[2]&&norm(x[m[3]]||"")===norm(v)&&(x.parent||"")===(arr[+m[2]]?.parent||""));if(dup){toast(`"${v}" already exists — not saved`);t.value=getPath(SET(),ds.sp)||"";return}}
  /* numbering patterns must keep the running number */if(/^numbering\.[^.]+\.pattern$/.test(ds.sp)&&!String(v||"").includes("{####}")){toast("Pattern needs {####} (the running number) — not saved");t.value=getPath(SET(),ds.sp)||"";return}
  const pairs=[[ds.sp,v]];
  {const mr=ds.sp.match(/^rates\.history\.(\d+)\.(?!date$|note$|auto$)/);if(mr&&getPath(SET(),`rates.history.${mr[1]}.auto`))pairs.push([`rates.history.${mr[1]}.auto`,false])}/* a rate changed by hand is no longer "auto" — the daily fetch will not overwrite it */
  /* the default company / locations are one setting shown in two places (Companies radio, Locations ticks, Rates › Defaults) */
  if(ds.sp==="defaults.company"&&v)pairs.push(["companies",(SET().companies||[]).map(c=>({...c,default:c.id===v}))]);
  {const dm={receiveLoc:"receive",sellLoc:"sell",shipTo:"ship"};const m1=ds.sp.match(/^defaults\.(receiveLoc|sellLoc|shipTo)$/);if(m1&&v){const fl=dm[m1[1]];pairs.push(["locations",(SET().locations||[]).map(l=>({...l,default:{...(l.default||{}),[fl]:l.id===v}}))])}
   const m2=ds.sp.match(/^locations\.(\d+)\.default\.(receive|sell|ship)$/);if(m2){const fl=m2[2];const i=+m2[1];const key={receive:"receiveLoc",sell:"sellLoc",ship:"shipTo"}[fl];if(v){pairs[0]=["locations",(SET().locations||[]).map((l,j)=>({...l,default:{...(l.default||{}),[fl]:j===i}}))];pairs.push(["defaults."+key,(SET().locations||[])[i]?.id])}}}
  S.holdRender=true;await setupPatchMany(pairs,null);S.holdRender=false;if(t.tagName==="SELECT"||t.type==="checkbox"||pairs.length>1)render();return}
 if(ds.aliaskey!==undefined||ds.aliasval!==undefined){const al={...(SET().aliases||{})};const old=ds.aliaskey??ds.aliasval;if(ds.aliaskey!==undefined){const nk=t.value.trim().toLowerCase();if(!nk||(nk!==old&&al[nk])){toast("Alias key empty or already used");t.value=old;return}const v=al[old];delete al[old];al[nk]=v}else al[old]=t.value.trim();await setupPatch("aliases",al,"Alias saved");return}
 if(ds.skualiaskey!==undefined||ds.skualiasval!==undefined){const al={...(SET().skuAliases||{})};const old=ds.skualiaskey??ds.skualiasval;if(ds.skualiaskey!==undefined){const nk=t.value.trim();if(!nk||(nk!==old&&al[nk])){toast("Alias already used");t.value=old;return}const v=al[old];delete al[old];al[nk]=v}else al[old]=t.value.trim();await setupPatch("skuAliases",al,"SKU alias saved");return}
 /* ===== Smart Import (importer.js) — change events on its controls (data-ixc) ===== */
 if(ds.ixc!==undefined){ixChange(t);return}
 /* ===== end Smart Import ===== */
 if(ds.impmap!==undefined){impMapChange(ds.impmap,t.value);return}
 if(ds.impalias!==undefined){impAliasChange(ds.impalias,t.value);return}
 if(t.id==="imp_file"&&t.files[0]){await handleImport(t.files[0]);return}if(t.id==="imp_kind"){impSetKind(t.value);return}if(t.id==="imp_datefmt"){impSetDateFmt(t.value);return}if(t.id==="imp_loc"){impSetLoc(t.value);return}
 if(t.id==="setup_file"&&t.files[0]){await importSetupJson(t.files[0]);t.value="";return}
 if(ds.act==="mapsku"){const p=D.purchases.find(x=>x.no===ds.po);if(!p||!t.value)return;if(t.value==="__new"){t.value="";openForm("product",{name:p.lines[+ds.i]?.p?.slice(0,60),force:true});return}const lines=p.lines.map((l,i)=>i===+ds.i?{...l,sku:t.value,skuAuto:false}:l);await updateDoc("purchases",p.no,{lines},`${p.no} line mapped to ${t.value}`);return}
 if(ds.act==="docfile"){const f=t.files?.[0];if(!f)return;toast("Uploading…");const id=await uploadFile(f);if(!id){toast("Upload failed");return}const patch={url:null,assetId:id,name:f.name,at:nowIso(),by:uid||"local"};const x=(D[ds.col]||[]).find(v=>(v.no||v.id)===ds.id);const docs={...(x?.docs||{}),[ds.doc]:patch};const p={docs};if(ds.col==="payments"&&ds.doc==="receipt")p.receiptAsset=id;await updateDoc(ds.col,x.id,p,`${L("docType",ds.doc)||ds.doc} uploaded`);return}
 if(ds.sel!==undefined){const page=S.view.k;S.sel[page]=S.sel[page]||{};if(t.checked)S.sel[page][ds.sel]=true;else delete S.sel[page][ds.sel];const bb=$("#bulkbar");if(bb)bb.outerHTML=bulkBar(page);return}
 if(ds.row!==undefined){rowChanged(ds.row,+ds.i,ds.k,t.value,t);return}
 if(t.id==="cal_month"||ds.act==="cal-month"){S.cal=t.value;render();return}
 if(S.drawer?.form&&t.id?.startsWith("f_")){const k=t.id.slice(2).replace(/_(L|W|H|kg)$/,"");const fdef=fields(S.drawer.form).find(x=>x.k===k);const prev=S.drawer.lastVal?.[k];
  if(["__new","__add","__addperson","__addset"].includes(t.value)){const pick=t.value;t.value=prev??"";
   if(pick==="__new"){const f=S.drawer.form;const st=stashForm();if(fdef?.t==="sku"){openForm("product",{force:true,returnTo:{stash:st,field:k}});return}openForm("party",{type:fdef?.ptype||{purchase:"supplier",shipment:"forwarder",inspection:"inspector",credit:"supplier"}[f]||"supplier",force:true,returnTo:{stash:st,field:k}});return}
   if(pick==="__add"){if(fdef?.t==="list")inlineAdd(k,fdef.list);else if(SET_KIND[fdef?.t])inlineAddSet(k,fdef.t);return}if(pick==="__addperson"){inlineAddPerson(k);return}if(pick==="__addset"){inlineAddSet(k,fdef?.t);return}}
  S.drawer.lastVal=S.drawer.lastVal||{};S.drawer.lastVal[k]=t.value;
  S.drawer.touched[k]=true;S.drawer.changed[k]=true;const a=$("#auto_"+k);if(a)a.hidden=true;markDirty();saveDraft();showListHint(k);
  const f=S.drawer.form;if(f==="purchase"){if(["party","kind","terms","date","cur"].includes(k)){if(k==="terms"&&t.value&&!(S.drawer.rows.schedule||[]).some(m=>m.paid)){S.drawer.rows.schedule=scheduleFromTerms(t.value,S.drawer.total||0,{date:val("date"),party:val("party"),readyDate:val("readyDate")});redrawRows("schedule")}syncPurchase(false)}else calcPurchase()}
  if(f==="shipment")syncShip(false);if(f==="payment"){if(k==="party"){rowsOf("allocations").forEach(a=>a.ref="");syncPayParty();syncPay()}else{if((k==="cur"||k==="company")&&!touched("bank")){const b=pickBank(val("party"),val("cur"),val("company"));if(b)setv("bank",b,true)}syncPay()}}
  if(f==="inspection")syncInsp();if(f==="receive"){if(k==="src")syncReceive(true);else syncReceive(false)}if(f==="move")syncMove();if(f==="count")syncCount(false);if(f==="product")syncProduct();if(f==="party")syncParty();showAll(f);return}
 if(t.id?.startsWith("t_")){toolsCalc();return}
 if(t.id==="rolesel"){if((S.realRole||S.role)!=="owner")return;S.role=t.value;ls.set("role",t.value);render();return}});
function inlineAddPerson(k){const box=$("#inl_"+k);if(!box)return;box.hidden=false;box.innerHTML=`<input id="inl_in_${k}" placeholder="Person name" aria-label="Person name"><button type="button" class="btn sm pri" data-act="inladdperson" data-k="${k}">Add</button><button type="button" class="btn sm" data-act="inlcancel" data-k="${k}">✕</button>`;$("#inl_in_"+k)?.focus()}
document.addEventListener("click",async e=>{const t=e.target.closest('[data-act="inladdperson"]');if(!t)return;const k=t.dataset.k;const name=($("#inl_in_"+k)?.value||"").trim();if(!name)return;const people=(SET().people||[]).slice();if(people.some(p=>norm(p.name)===norm(name))){toast("Already exists");return}const id=slugId(name,people);people.push({id,name,role:""});await setupPatch("people",people,`${name} added`);const sel=$("#f_"+k);if(sel){sel.innerHTML=inputFor({t:"person"},"tmp",id).replace(/^<select[^>]*>|<\/select>$/g,"");sel.value=id}$("#inl_"+k).hidden=true;markDirty()});

/* ---------- input (live) ---------- */
let qT,dT;document.addEventListener("input",e=>{const t=e.target;const ds=t.dataset;
 if(t.id==="q"){clearTimeout(qT);qT=setTimeout(()=>showSugg(t.value),120);return}
 if(ds.f==="q"){setF(S.view.k,"q",t.value);clearTimeout(qT);qT=setTimeout(()=>renderList(),150);return}
 if(t.id==="refq"){clearTimeout(qT);qT=setTimeout(()=>refsSearch(t.value),150);return}
 if(ds.row!==undefined){if(t.tagName==="SELECT")return;/* selects are handled on change (so "＋ Add…" picks never land in the row) */const r=rowsOf(ds.row)[+ds.i];if(r){r[ds.k]=t.type==="number"?(t.value===""?null:+t.value):t.value;markDirty();S.drawer.changed["rows:"+ds.row]=true;const f=S.drawer.form;if(f==="purchase"&&ds.row==="lines"&&["q","u"].includes(ds.k))delete r._stored;if(f==="purchase"&&ds.row==="lines"&&ds.k==="u")r.uAuto=false;if(f==="purchase"&&ds.row==="schedule"&&ds.k==="due")r.dueAuto=false;if(f==="purchase")calcPurchase();if(f==="shipment"&&["q","ctn"].includes(ds.k))syncShip(false);if(f==="payment"&&ds.k==="amount"){S.drawer.autoSet.alloc0=false;syncPay()}if(f==="receive")syncReceive(false);if(f==="count")syncCount(false);clearTimeout(dT);dT=setTimeout(saveDraft,600)}return}
 if(S.drawer?.form&&t.id?.startsWith("f_")){const k=t.id.slice(2).replace(/_(L|W|H|kg)$/,"");S.drawer.touched[k]=true;S.drawer.changed[k]=true;const a=$("#auto_"+k);if(a)a.hidden=true;markDirty();clearTimeout(dT);dT=setTimeout(saveDraft,600);const f=S.drawer.form;
  if(f==="payment"&&["amount","gbp","yourRef"].includes(k)){if(k==="amount")S.drawer.autoSet.alloc0=true;syncPay()}if(f==="shipment"&&["rate","kg","cbm","cost","ctn","platformFeePct","insurance"].includes(k))syncShip(false);if(f==="purchase"&&["feePct","date"].includes(k))calcPurchase();if(f==="party"&&k==="name")syncParty();if(f==="product"&&["sku","packOf","name"].includes(k))syncProduct();if(f==="move"&&k==="qty")syncMove();if(f==="receive"&&["dutyGbp","vatGbp","ukExtraGbp"].includes(k))syncReceive(false);return}
 if(t.id?.startsWith("t_")){toolsCalc()}});

/* ---------- search suggestions ---------- */
let sugIdx=-1;function hideSugg(){const s=$("#sugg");if(s){s.hidden=true;s.innerHTML=""}$("#q")?.setAttribute("aria-expanded","false");sugIdx=-1}
function showSugg(q){const s=$("#sugg");if(!s)return;q=q.trim();if(q.length<1){hideSugg();return}const r=searchAll(q);const direct=resolveRef(q);const groups={};r.forEach(x=>{(groups[x.col]=groups[x.col]||[]).push(x)});const dym=r.length<3?didYouMean(q):null;
 s.innerHTML=(direct?`<h6>Exact</h6><button role="option" data-open="${direct.col}" data-id="${esc(direct.id)}"><span class="ref">${esc(direct.id)}</span><span class="lab">Open ${esc(direct.col)}</span></button>`:"")+Object.entries(groups).map(([col,xs])=>`<h6>${col}</h6>${xs.slice(0,6).map(x=>`<button role="option" data-open="${col}" data-id="${esc(x.ref)}"><span class="ref">${esc(x.ref)}</span><span class="lab">${esc(x.extra)}${x.x.oldRef?`<small>old: ${esc([].concat(x.x.oldRef).join(", "))}</small>`:""}</span></button>`).join("")}`).join("")+(!r.length?`<div class="empty">No results${dym?` — did you mean <button data-act="dym" data-q="${esc(dym)}" class="btn sm">${esc(dym)}</button>?`:""}</div>`:dym?`<div class="empty" style="padding:6px 12px">Did you mean <button data-act="dym" data-q="${esc(dym)}" class="btn sm">${esc(dym)}</button>?</div>`:"");
 s.hidden=false;$("#q").setAttribute("aria-expanded","true");sugIdx=-1}
document.addEventListener("click",e=>{const t=e.target.closest('[data-act="dym"]');if(!t)return;$("#q").value=t.dataset.q;showSugg(t.dataset.q)});
document.addEventListener("focusin",e=>{if(e.target.id==="q"&&e.target.value)showSugg(e.target.value);if(S.drawer?.form&&e.target.tagName==="SELECT"&&e.target.id?.startsWith("f_")){S.drawer.lastVal=S.drawer.lastVal||{};S.drawer.lastVal[e.target.id.slice(2)]=e.target.value}});
document.addEventListener("keydown",e=>{const t=e.target;const inField=t.matches("input,textarea,select,[contenteditable]");const mod=e.ctrlKey||e.metaKey;
 if((mod&&e.key.toLowerCase()==="k")||(!inField&&e.key==="/")){e.preventDefault();$("#q")?.focus();$("#q")?.select();return}
 if(t.id==="q"){const opts=$$("#sugg [role=option]");if(e.key==="ArrowDown"||e.key==="ArrowUp"){if(!opts.length)return;e.preventDefault();sugIdx=(sugIdx+(e.key==="ArrowDown"?1:-1)+opts.length)%opts.length;opts.forEach((o,i)=>o.classList.toggle("on",i===sugIdx));opts[sugIdx].scrollIntoView({block:"nearest"});return}
  if(e.key==="Enter"){e.preventDefault();const pick=opts[sugIdx>=0?sugIdx:0];if(pick){pick.click();hideSugg();t.blur()}else{const d=resolveRef(t.value);if(d)openDoc(d.col,d.id)}return}
  if(e.key==="Escape"){hideSugg();t.blur();return}return}
 if(e.key==="Escape"){if($("#menu").innerHTML){$("#menu").innerHTML="";return}if($("#bellp").innerHTML){$("#bellp").innerHTML="";return}const mm=$("#moremenu");if(mm&&!mm.hidden){mm.hidden=true;return}if(S.drawer){closeDrawer()}return}
 if(mod&&e.key==="Enter"&&S.drawer?.form){e.preventDefault();$('.df [data-act="save"]')?.click();return}
 if(mod&&e.key.toLowerCase()==="z"&&!inField){e.preventDefault();if(e.shiftKey)redo();else undo();return}
 if(mod&&!e.shiftKey&&e.key.toLowerCase()==="y"&&!inField){e.preventDefault();redo();return}
 if(e.altKey&&e.key==="ArrowLeft"){e.preventDefault();back();return}if(e.altKey&&e.key==="ArrowRight"){e.preventDefault();fwd();return}
 if(!inField&&!mod&&!e.altKey&&e.key.toLowerCase()==="n"&&!S.drawer){e.preventDefault();$('[data-act="newmenu"]')?.click();return}
 if(e.key==="Enter"&&t.matches(".row[role=button]")){t.click()}
 if(e.key==="Enter"&&t.matches("input[data-doclink]")){t.parentElement.querySelector('[data-act="doclink"]')?.click()}
 if(e.key==="Enter"&&t.id==="svname"){$('[data-act="saveview"]')?.click()}
 if(e.key==="Enter"&&t.id?.startsWith("svren_")){$(`[data-act="renviewok"][data-id="${t.id.slice(6)}"]`)?.click()}
 if(e.key==="Enter"&&t.id?.startsWith("inl_in_")){e.preventDefault();t.parentElement.querySelector('[data-act="inladd"],[data-act="inladdset"],[data-act="inladdperson"]')?.click()}
 if(e.key==="Tab"&&S.drawer){/* focus trap */const d=$(".drawer");if(!d)return;const f=[...d.querySelectorAll("button,input,select,textarea,a[href]")].filter(x=>!x.disabled&&!x.hidden&&x.offsetParent!==null);if(!f.length)return;const first=f[0],last_=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last_.focus()}else if(!e.shiftKey&&document.activeElement===last_){e.preventDefault();first.focus()}}});
window.addEventListener("hashchange",()=>{if(Date.now()-(S._popAt||0)<400)return;const h=location.hash;const m=h.match(/^#\/doc\/([a-z]+)\/(.+)$/);if(m){if(S.drawer?.id!==decodeURIComponent(m[2]))openDoc(m[1],decodeURIComponent(m[2]))}else{const k=h.replace(/^#\//,"");if(PAGES.includes(k)&&k!==S.view.k){S.drawer=null;go(k,{},{force:true})}}});
window.addEventListener("online",()=>{$("#offline").hidden=true});window.addEventListener("offline",()=>{$("#offline").hidden=false});

/* ===== FORM ASSISTANT events (form-related only; logic lives in forms2.js › SMART FORM ASSISTANT) =====
   live checks on input (debounced) / change / leaving a field, Issues panel clicks, "Use" suggestions, Fix all,
   Alt+↓ / Alt+↑ next / previous issue, Esc inside the panel returns to the form instead of closing it. */
const inForm=t=>!!(S.drawer?.form&&t&&t.closest&&t.closest(".drawer .form"));
document.addEventListener("input",e=>{if(!inForm(e.target))return;faNoteInput(e.target);faSchedule(350)});
document.addEventListener("change",e=>{if(!inForm(e.target))return;faNoteInput(e.target);faSchedule(60)});
document.addEventListener("focusout",e=>{if(!inForm(e.target)||!faState())return;faVisit(e.target);if(e.relatedTarget?.closest?.("[data-fa],#fa"))return;faSchedule(120)});
/* a click on a suggestion must not be lost when the blur re-check repaints the messages */
document.addEventListener("pointerdown",e=>{if(!e.target.closest?.(".drawer [data-fa],.drawer #fa button"))return;const fa=faState();if(!fa)return;fa.hold=true;setTimeout(()=>{if(S.drawer?.fa===fa)fa.hold=false},700)},true);
document.addEventListener("click",e=>{const b=e.target.closest?.("[data-fa]");if(!b||!S.drawer?.form)return;const fa=faState();if(!fa)return;fa.hold=false;e.preventDefault();const a=b.dataset.fa;
 if(a==="go")faGoto(b.dataset.id);else if(a==="use")faUse(b.dataset.id,+b.dataset.s);else if(a==="next")faNext(1);else if(a==="prev")faNext(-1);else if(a==="fixall")faFixAll();else if(a==="first")faFirst();else if(a==="toggle"){fa.open=!fa.open;faPanel();$('#fa [data-fa="toggle"]')?.focus()}});
window.addEventListener("keydown",e=>{if(!S.drawer?.form)return;if(e.altKey&&!e.ctrlKey&&!e.metaKey&&(e.key==="ArrowDown"||e.key==="ArrowUp")){e.preventDefault();e.stopImmediatePropagation();faNext(e.key==="ArrowDown"?1:-1);return}
 if(!e.target.closest?.("#fa"))return;if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();faReturnFocus();return}if(e.key==="Enter"&&(e.target.id==="fa"||!e.target.matches("button"))){e.preventDefault();faNext(1)}},true);
/* ===== /FORM ASSISTANT events ===== */

/* ---------- barcode scan ---------- */
async function scanImage(){const inp=document.createElement("input");inp.type="file";inp.accept="image/*";inp.onchange=async()=>{const f=inp.files?.[0];if(!f)return;try{const bmp=await createImageBitmap(f);const det=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39","qr_code"]});const codes=await det.detect(bmp);if(!codes.length){toast("No barcode found in that photo — type the number into search");return}const raw=codes[0].rawValue;const r=resolveRef(raw);if(r){openDoc(r.col,r.id);toast("Found "+r.id)}else toast("No product with barcode "+raw+" — add it in Products")}catch(e){toast("Could not read that photo — type the number into search")}};inp.click()}
async function scan(){if(!("BarcodeDetector"in window)){toast("This browser cannot read barcodes — type or paste the barcode number into search (top bar)");$("#q")?.focus();return}
 let stream;try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}})}catch(_){scanImage();return}
 const wrap=document.createElement("div");wrap.className="scrim";wrap.style.display="grid";wrap.style.placeItems="center";wrap.innerHTML=`<div style="background:var(--panel);padding:12px;border-radius:12px;max-width:92vw"><video autoplay playsinline style="width:100%;max-height:60vh;border-radius:8px"></video><div style="display:flex;gap:8px;margin-top:8px;justify-content:space-between"><span class="status">Point at the barcode</span><button class="btn sm" id="scanstop">Cancel</button></div></div>`;document.body.appendChild(wrap);const v=wrap.querySelector("video");v.srcObject=stream;const det=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39","qr_code"]});let stop=false;const end=()=>{stop=true;stream.getTracks().forEach(t=>t.stop());wrap.remove()};wrap.querySelector("#scanstop").onclick=end;
 const loop=async()=>{if(stop)return;try{const codes=await det.detect(v);if(codes.length){const raw=codes[0].rawValue;end();const r=resolveRef(raw);if(r){openDoc(r.col,r.id);toast("Found "+r.id)}else{toast("No product with barcode "+raw+" — add it in Products");}return}}catch(_){}requestAnimationFrame(loop)};v.onloadedmetadata=()=>loop()}

/* ---------- boot ---------- */
async function boot(){try{
 if(window.claude?.use){db=await window.claude.use("db");try{user=await window.claude.use("user");uid=await user.id?.()||null;S.isOwner=!!(await user.isOwner?.())}catch(_){S.noUser=true}try{assets=await window.claude.use("assets")}catch(_){}try{downloads=await window.claude.use("downloads")}catch(_){}}
 else{S.err="Open this page from your Claude artifacts so it can connect to the shared database.";render();return}
 S.undo=ls.get("undo",[]).filter(g=>g.entries);S.f=ls.get("filters",{})||{};
 await new Promise(res=>{db.collection("setup").doc("main").onSnapshot(s=>{D.setup=s.exists?s.data():null;if(D.setup&&!D.setup.lists)D.setup.lists={};resolveRole();if(!S._upg){S._upg=1;setTimeout(()=>upgradeSetup().catch(()=>{}),0)}render();res()})});
 db.collection("counters").doc("main").onSnapshot(s=>{D.counters=s.exists?s.data():null});
 let pending=COLS.length;COLS.forEach(col=>db.collection(col).onSnapshot(snap=>{D[col]=snap.docs.map(d=>({...d.data(),id:d.id}));_st.clear();if(pending>0){pending--;if(pending===0){S.ready=true;if(S.hi<0){S.view=S.view||{k:"home",params:{}};pushHist()}purgeTrash();ensureSetup();const h=location.hash;const m=h.match(/^#\/doc\/([a-z]+)\/(.+)$/);if(m)openDoc(m[1],decodeURIComponent(m[2]));else if(h.length>2&&PAGES.includes(h.slice(2)))go(h.slice(2),{},{force:true})}}render()}));
 if(!navigator.onLine)$("#offline").hidden=false;
}catch(e){console.error(e);S.err="Could not connect: "+(e.message||e);render()}}
/* role: the user's row in Setup › Users; the artifact owner is Owner; anyone else signed in is a VA until listed.
   "View as" (stored in this browser) only applies when the real role is Owner. */
function resolveRole(){const lc=x=>String(x||"").trim().toLowerCase();const su=(SET().users||[]).find(u=>u.uid&&lc(u.uid)===lc(uid)&&u.active!==false);let real=su?.role||(S.isOwner?"owner":(S.noUser||!uid?"owner":"va"));if(S.isOwner&&!su)real="owner";const prev=S.realRole;S.realRole=real;const viewAs=ls.get("role",null);S.role=real==="owner"&&viewAs?viewAs:real;if(prev&&prev!==real)toast("Your role is now "+(item("role",real)?.label||real))}
/* Setup items newer builds rely on (added once, quietly, for the Owner): the "Part shipped" order step */
async function ensureSetup(){try{if(!D.setup||!can("setup"))return;const ps=listDef("poStatus").items||[];if(!ps.length||ps.some(i=>i.id==="part_shipped"))return;const shp=ps.find(i=>i.id==="shipped");const st=shp?+shp.step:5;const its=ps.map(i=>+i.step>=st?{...i,step:+i.step+1}:{...i});const at=its.findIndex(i=>i.id==="shipped");its.splice(at<0?its.length:at,0,{id:"part_shipped",label:"Part shipped",step:st});await setupPatchMany([[["lists","poStatus","items"],its]],null,{noUndo:true});logEv("setup","setup","main","Order step \"Part shipped\" added to Setup › Lists › Purchase statuses")}catch(e){console.warn(e)}}
boot();
