/* ---------- Create: clear sections in a fixed order (owner, 21 Nov 2026) ----------
   Create had grown: "Settings" held 27 entries (imports, calculator, three older entries for giving access …), an empty "Home"
   heading showed at the end. Now every entry is put in one of these sections, in this order, forms ("+ New …") first:
   Buying · Shipments · Money · Stock · Products · Suppliers · Import & files · People & access · Planning & tasks · Reports · Settings
   Entries that were replaced by the People window (New user, Access ticks, Hide an area / field) open that window instead. */
const CO_ORDER=["Buying","Shipments","Money","Stock","Products","Suppliers","Import & files","People & access","Home & planning","Reports","Settings","Other"];
const CO_KEY={"x:invite":"People & access","x:people":"People & access","x:addperson":"People & access","x:invite":"People & access","x:accessreq":"People & access","x:accesstpl":"People & access",
 "x:impmany":"Import & files","x:drvshared":"Import & files","x:supfiles":"Import & files","x:uplink":"Suppliers","v:import":"Import & files","v:drive":"Import & files","v:pis":"Import & files",
 "v:tools":"Home & planning","v:planner":"Home & planning","v:calendar":"Home & planning","v:task":"Home & planning",
 "x:history":"Reports","v:views":"Reports","x:bin":"Settings","x:lock":"Settings","x:locknow":"Settings","x:movedata":"Settings","x:centre":"Settings","x:listadd":"Settings"};
const CO_FIRST={"x:invite":0,"x:addperson":1,"x:people":2,"x:accessreq":3,"v:import":1,"x:impmany":2,"v:pis":3,"v:task":1};
const CO_GONE=new Set(["x:user","x:access","x:fineaccess","x:supfiles"]);   /* replaced by "People & access" */
const CO_NAME={Shipping:"Shipments",Partners:"Suppliers",Data:"Import & files",Planning:"Home & planning",Home:"Other"};
function coSection(it){if(CO_KEY[it.key])return CO_KEY[it.key];if(it.page==="import")return"Import & files";if(["home","attention","tasks","calendar","planner","tools"].includes(it.page))return"Home & planning";const d=CO_NAME[it.dept]||it.dept;return CO_ORDER.includes(d)?d:"Other"}
const coItems0=chItems;
chItems=function(){let a=[];try{a=coItems0.apply(this,arguments)}catch(e){console.warn(e);return[]}
 a=a.filter(i=>!CO_GONE.has(i.key)).map(i=>({...i,dept:coSection(i)}));const rank=d=>{const k=CO_ORDER.indexOf(d);return k<0?99:k};
 /* forms first (so typing "pay" offers + New payment first, and its section comes first), then the fixed section order */
 return a.map((it,n)=>({it,n})).sort((x,y)=>(x.it.form?0:1)-(y.it.form?0:1)||rank(x.it.dept)-rank(y.it.dept)||(CO_FIRST[x.it.key]??9)-(CO_FIRST[y.it.key]??9)||x.n-y.n).map(x=>x.it)};
/* create: no entry of its own — it orders the Create window */
