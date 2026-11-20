/* ---------- A brand-new workspace never starts empty (owner, 20 Nov 2026) ----------
   "Start empty" used to mean: no categories, no units, no statuses, no incoterms … so every dropdown was blank and nothing could
   be created or imported. Now the first time an Owner opens an empty workspace, the standard lists (STARTER_SETUP) are written
   once: statuses, units, currencies, incoterms, freight services, payment types, ports, a starter set of categories, a
   "My company" and a "Main store". Brands, suppliers and products stay empty — they come from your files or "＋ Add".
   A list that is ever missing still shows its standard items (listDef falls back to the starter). */
const stUp0=upgradeSetup;
upgradeSetup=async function(){try{if(!D.setup&&can("setup")){const pairs=Object.entries(STARTER_SETUP).map(([k,v])=>[[k],JSON.parse(JSON.stringify(v))]);
  await setupPatchMany(pairs,"Standard lists added to the new workspace",{noUndo:true,quiet:true});toast("New workspace: standard lists are ready — add your company name in Setup")}}catch(e){console.warn("starter",e)}
 return stUp0.apply(this,arguments)};
/* users and roles are changed only after the person has just proved it is them (fingerprint / PIN), see applock.js */
const stPatch0=setupPatchMany;
setupPatchMany=async function(pairs,labelTxt,o){try{if(!(o&&(o.derived||o.quiet))&&(pairs||[]).some(([p])=>p&&(p[0]==="users"||p[0]==="roles"))&&typeof alVerify==="function"){if(!(await alVerify("Change who can use MY TOOL and what they can do"))){toast("Not changed — it was not confirmed");try{render()}catch(_){}return false}}}catch(_){}return stPatch0.apply(this,arguments)};
/* create: nothing to start by hand — the starter lists are written by themselves the first time an empty workspace opens */
