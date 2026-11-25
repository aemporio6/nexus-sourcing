// Look (light default / dark / auto) and the search that finds everything.
// Run: NODE_PATH=/opt/npm-tools/node_modules node tests/t_look_search.js   (live-data copy on :8096)
const { chromium, devices } = require("playwright");const URL_=process.env.MT_URL||"http://localhost:8096/index.html?demo";
(async()=>{const br=await chromium.launch();let ok=0,bad=0;const t=(n,c,x)=>{c?ok++:bad++;console.log((c?"PASS ":"FAIL ")+n+(c?"":" → "+String(JSON.stringify(x)).slice(0,700)))};const errs=[];
 const ctx=await br.newContext({...devices["Galaxy S9+"],colorScheme:"dark"});const pg=await ctx.newPage();pg.on("pageerror",e=>errs.push(e.message));await pg.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await pg.goto(URL_);await pg.waitForFunction(()=>{try{return S.ready}catch(e){return false}},null,{timeout:30000});
 const lum=c=>{const m=c.match(/\d+/g).map(Number);return(0.299*m[0]+0.587*m[1]+0.114*m[2])/255};
 let st=await pg.evaluate(()=>({theme:document.documentElement.getAttribute("data-theme"),bg:getComputedStyle(document.body).backgroundColor,fg:getComputedStyle(document.body).color}));
 t("a phone set to dark still opens MY TOOL light (white, dark writing)",st.theme==="light"&&lum(st.bg)>0.9&&lum(st.fg)<0.3,st);
 const contrast=async()=>pg.evaluate(()=>{S.isOwner=true;sbOpen({tab:"hist"});const c=document.querySelector("#sbwin .ppsec");const b=c.querySelector("b");const s=c.querySelector(".status");const r={card:getComputedStyle(c).backgroundColor,title:getComputedStyle(b).color,small:getComputedStyle(s).color,size:parseFloat(getComputedStyle(b).fontSize),ssize:parseFloat(getComputedStyle(s).fontSize)};sbClose();return r});
 const cr=(a,b)=>{const L=c=>{const m=c.match(/\d+/g).slice(0,3).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*m[0]+0.7152*m[1]+0.0722*m[2]};const x=L(a),y=L(b);return(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)};
 st=await contrast();t("light: card title contrast ≥ 7, small print ≥ 4.5, title ≥ 15px, small print ≥ 13px",cr(st.card,st.title)>=7&&cr(st.card,st.small)>=4.5&&st.size>=15&&st.ssize>=13,{...st,c1:cr(st.card,st.title),c2:cr(st.card,st.small)});
 await pg.evaluate(()=>lkSet("dark"));st=await contrast();t("dark look: cards are dark too, title contrast ≥ 7, small print ≥ 4.5 (the white cards with pale writing are gone)",lum(st.card)<0.2&&cr(st.card,st.title)>=7&&cr(st.card,st.small)>=4.5,{...st,c1:cr(st.card,st.title),c2:cr(st.card,st.small)});
 await pg.evaluate(()=>lkSet("auto"));t("Auto follows the device (dark here)",await pg.evaluate(()=>!document.documentElement.hasAttribute("data-theme")&&getComputedStyle(document.body).backgroundColor!=="rgb(248, 250, 251)"));
 await pg.evaluate(()=>lkSet("light"));await pg.reload();await pg.waitForFunction(()=>{try{return S.ready}catch(e){return false}},null,{timeout:30000});t("the choice is remembered on the device; the 🔒 menu has the three looks",await pg.evaluate(()=>document.documentElement.getAttribute("data-theme")==="light"&&(alWsHtml().match(/data-look=/g)||[]).length===3));
 // search
 const find=q=>pg.evaluate(q=>{const r=searchAll(q);return r.slice(0,8).map(x=>x.ref)},q);
 t("search: a word from an order's NOTES finds it ('wax removal')",(await find("wax removal")).includes("PO-26-0073"));
 t("search: amount without commas (17160) and with (17,160)",(await find("17160")).includes("PO-26-0073")&&(await find("17,160")).includes("PO-26-0073"));
 t("search: the supplier's invoice number",(await find("JW20261115001")).includes("PO-26-0074"));
 t("search: words in any order + a typing mistake ('plungar joyce')",(await find("plungar joyce")).includes("PO-26-0072"));
 t("search: another word for the same thing ('vendor joyce' finds the supplier)",(await pg.evaluate(()=>searchAll("vendor joyce").some(x=>x.col==="parties"))));
 const sug=async q=>{await pg.evaluate(q=>{const i=document.getElementById("q");i.value=q;showSugg(q)},q);return pg.evaluate(()=>({h:[...document.querySelectorAll("#sugg h6")].map(x=>x.textContent),txt:document.getElementById("sugg").textContent,hidden:document.getElementById("sugg").hidden}))};
 st=await sug("commercial invoice");t("box: documents on records are found, groups have plain names",st.h.includes("Documents")&&!st.h.includes("purchases"),st.h);
 st=await sug("split receipt");t("box: things to do are found ('split receipt' → the split window)",st.h.includes("Do / open")&&/several bills/.test(st.txt),st);
 st=await sug("hr");t("box: people, companies, banks and list values are found",st.h.includes("People & settings"),st);
 st=await sug("wax removal");t("box: says where it was found ('found in notes: …')",/found in notes/.test(st.txt),st.txt.slice(0,300));
 await pg.evaluate(()=>{s2Remember("plunger 110");const i=document.getElementById("q");i.value="";showSugg("")});st=await pg.evaluate(()=>document.getElementById("sugg").textContent);
 t("empty box: last searches and often-needed things",/Your last searches/.test(st)&&/plunger 110/.test(st)&&/Often needed/.test(st)&&/Fix it/.test(st),st.slice(0,200));
 await pg.evaluate(()=>{const i=document.getElementById("q");i.value="fix it";showSugg("fix it")});await pg.click('#sugg [data-s2run="x:fixit"]');await pg.waitForTimeout(400);t("choosing an action from the search opens it",await pg.evaluate(()=>!!document.getElementById("fxwin")));
 st=await sug("zzqqxx");t("nothing found is said plainly",/No results|Nothing found/.test(st.txt),st.txt);
 t("no page errors",!errs.length,errs);console.log(`\n${ok} pass, ${bad} fail`);await br.close();process.exit(bad?1:0)})();
