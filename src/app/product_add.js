/* ---------- Adding a NEW product (owner, 15 Nov 2026) ----------
   Type the name first: brand, category, "pack of" and the SKU fill themselves from the name (and from the most similar
   product already in MY TOOL). When no category fits, the form offers "＋ New category" with the name ready —
   never a random "most used" category. No old product names pop up under the name box. */
function paTok(s){return norm(String(s||"")).split(/[^a-z0-9]+/).filter(w=>w.length>2&&!["with","and","the","for","pcs","pack","set","new"].includes(w))}
function paGuess(name){const t=paTok(name);if(!t.length)return null;const T=new Set(t);let best=null;
 /* 1) a category whose name is in the product name (sub-category wins when its parent matches too) */
 items("category").forEach(c=>{const lt=paTok(c.label);if(!lt.length)return;const hit=lt.filter(w=>T.has(w)||T.has(w.replace(/s$/,""))||[...T].some(x=>x.replace(/s$/,"")===w.replace(/s$/,""))).length/lt.length;if(hit<1)return;
  const par=c.parent&&item("category",c.parent);const ph=par?paTok(par.label).some(w=>T.has(w)||[...T].some(x=>x.replace(/s$/,"")===w.replace(/s$/,""))):false;if(c.parent&&!ph)return;const sc=1+(c.parent?0.5:0);if(!best||sc>best.sc)best={cat:c.id,sc,why:"category name in the product name"}});
 /* 2) the most similar product already in MY TOOL */
 let sim=null;live(D.products).forEach(p=>{const pt=new Set(paTok(p.name));if(!pt.size)return;const sc=t.filter(w=>pt.has(w)).length/Math.max(t.length,pt.size);if(sc>=0.5&&(!sim||sc>sim.sc))sim={p,sc}});
 const out={};if(best){out.cat=best.cat;out.why=best.why}else if(sim){out.cat=sim.p.category;out.why="like "+sim.p.sku}if(sim)out.brand=sim.p.brand;
 const pk=String(name).match(/pack of\s*(\d+)|(\d+)\s*(?:pcs|pieces|pack)\b|\b(\d+)\s*pk\b/i);if(pk)out.packOf=+(pk[1]||pk[2]||pk[3]);return out}
let paT=null;
function paRun(){const d=S.drawer;if(!d||d.form!=="product"||d.ctx?.edit)return;const name=val("name");const g=paGuess(name)||{};
 if(g.brand&&!touched("brand")&&item("brand",g.brand))setv("brand",g.brand,true);
 if(!touched("category")){if(g.cat&&item("category",g.cat))setv("category",g.cat,true);else if(d.autoSet?.category||val("category")&&d._paCat)setv("category","",true);d._paCat=!!g.cat}
 if(g.packOf&&!touched("packOf"))setv("packOf",g.packOf,true);
 try{syncProduct()}catch(_){}try{showAll("product")}catch(_){}paHint(name,g)}
function paHint(name,g){const w=$("#fw_category");if(!w)return;const old=w.querySelector(".pahint");if(!name||val("category")){old?.remove();return}if(old&&old.dataset.n===name)return;old?.remove();
 const sug=paTok(name).slice(0,2).map(x=>x[0].toUpperCase()+x.slice(1)).join(" ");
 w.insertAdjacentHTML("beforeend",`<div class="hint pahint" data-n="${esc(name)}">No category fits “${esc(name.slice(0,40))}”. ${can("setup")?`<button type="button" class="btn sm" data-act="panewcat" data-v="${esc(sug)}">＋ New category “${esc(sug)}”</button> <button type="button" class="btn sm" data-act="panewcat" data-v="">＋ Other name…</button>`:"Ask the owner to add the category."}</div>`)}
document.addEventListener("input",e=>{if(e.target.id!=="f_name"||S.drawer?.form!=="product")return;clearTimeout(paT);paT=setTimeout(paRun,350)});
document.addEventListener("change",e=>{if(S.drawer?.form!=="product")return;if(e.target.id==="f_name")paRun();if(e.target.id==="f_category"){$("#fw_category .pahint")?.remove()}});
document.addEventListener("click",e=>{const b=e.target.closest('[data-act="panewcat"]');if(!b)return;e.preventDefault();e.stopPropagation();inlineAdd("category","category");const inp=$("#inl_in_category");if(inp){inp.value=b.dataset.v||"";inp.focus();inp.select()}},true);
/* never suggest an unrelated "most used" category for a new product */
const paReq0=faReqSuggest;
faReqSuggest=function(form,k,c){if(form==="product"&&!S.drawer?.ctx?.edit&&k==="category"){const g=paGuess(val("name"));return g&&g.cat&&item("category",g.cat)?[{label:`Use ${L("category",g.cat)} (${g.why})`,safe:false,apply:()=>faSetField(k,g.cat)}]:[]}return paReq0.apply(this,arguments)};
/* opened with a name (from an order line, the importer, "Create product") → fill the rest straight away */
const paOpen0=openForm;openForm=function(form,ctx={}){const r=paOpen0.apply(this,arguments);if(form==="product"&&ctx&&ctx.name&&!ctx.edit)setTimeout(()=>{try{paRun()}catch(_){}},400);return r};
