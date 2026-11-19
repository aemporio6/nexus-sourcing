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
