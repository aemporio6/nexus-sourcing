/* ---------- App lock on this device: fingerprint / face / Windows Hello / PIN, and a password (owner, 17 Nov 2026) ----------
   - 🔒 in the top bar: "Lock now" and "Set up the lock on this device". Each device / browser has its own lock (a fingerprint lives on
     the device), so it is kept on the device, never in the shared data.
   - Unlock with the device (WebAuthn, the same sign-in the phone / laptop uses) or the password. The password is stored only as a
     PBKDF2 hash (150,000 rounds). Locks itself after N minutes without use (default 10) and when the app opens.
   - Never locked out: "Forgot? Sign in with Google again" signs out, clears this device's copy and the lock; after a fresh Google
     sign-in the data loads again from Drive. Nothing in the business data changes. */
const AL_KEY="mt_lock";
function alCfg(){try{return JSON.parse(localStorage.getItem(AL_KEY)||"null")}catch(_){return null}}
function alSave(c){try{if(c)localStorage.setItem(AL_KEY,JSON.stringify(c));else localStorage.removeItem(AL_KEY)}catch(_){}}
const alB64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const alUnB64=s=>Uint8Array.from(atob(String(s).replace(/-/g,"+").replace(/_/g,"/")+"===".slice((String(s).length+3)%4)),c=>c.charCodeAt(0));
async function alHash(pw,salt,iter){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:alUnB64(salt),iterations:iter},k,256);return alB64(bits)}
async function alBioOk(){try{return!!(window.PublicKeyCredential&&await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())}catch(_){return false}}
async function alBioCreate(){const c=await navigator.credentials.create({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),rp:{name:"MY TOOL"},user:{id:crypto.getRandomValues(new Uint8Array(16)),name:(typeof uid!=="undefined"&&uid)||"me",displayName:"MY TOOL lock"},pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required",residentKey:"discouraged"},timeout:60000,attestation:"none"}});return alB64(c.rawId)}
async function alBioCheck(id){const a=await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),allowCredentials:[{type:"public-key",id:alUnB64(id)}],userVerification:"required",timeout:60000}});return!!a}
let alLocked=false,alLast=Date.now();
function alShow(){const c=alCfg();if(!c||!c.on)return;alLocked=true;let o=document.getElementById("alov");if(!o){o=document.createElement("div");o.id="alov";document.body.appendChild(o)}
 o.setAttribute("role","dialog");o.setAttribute("aria-modal","true");o.setAttribute("aria-label","MY TOOL is locked");
 o.innerHTML=`<div class="albox">${typeof MT_LOGO==="function"?MT_LOGO(72):""}<h2>MY TOOL is locked</h2><p class="status">${esc_al(c.email||"")}</p>
  ${c.bio?`<button type="button" class="btn pri albig" data-al="bio">🔐 Unlock with fingerprint / face</button>`:""}
  ${c.pw?`<form data-al="pwf" class="alpw"><input id="al_pw" type="password" autocomplete="current-password" placeholder="Password" aria-label="Password"><button type="submit" class="btn ${c.bio?"":"pri"}">Unlock</button></form>`:""}
  <div class="status" id="al_msg" aria-live="polite"></div>
  <button type="button" class="lnk" data-al="forgot">Forgot? Sign in with Google again</button></div>`;
 o.hidden=false;document.documentElement.classList.add("al-on");setTimeout(()=>{if(c.bio&&!c.noAuto)alTryBio();else document.getElementById("al_pw")?.focus()},250)}
const esc_al=s=>String(s).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
function alUnlock(){alLocked=false;alLast=Date.now();const o=document.getElementById("alov");if(o){o.hidden=true;o.innerHTML=""}document.documentElement.classList.remove("al-on");const c=alCfg();if(c){c.fails=0;alSave(c)}}
async function alTryBio(){const c=alCfg();if(!c?.bio)return;const m=document.getElementById("al_msg");try{if(await alBioCheck(c.bio))alUnlock()}catch(e){if(m)m.textContent=c.pw?"Not unlocked — try again or use the password":"Not unlocked — try again"}}
document.addEventListener("submit",async e=>{if(!e.target.matches?.('[data-al="pwf"]'))return;e.preventDefault();const c=alCfg();const m=document.getElementById("al_msg");const pw=document.getElementById("al_pw")?.value||"";
 if((c.waitUntil||0)>Date.now()){if(m)m.textContent=`Too many tries — wait ${Math.ceil((c.waitUntil-Date.now())/1000)} s`;return}
 const h=await alHash(pw,c.pw.salt,c.pw.iter);if(h===c.pw.hash){alUnlock();return}
 c.fails=(c.fails||0)+1;if(c.fails>=5){c.waitUntil=Date.now()+30000*Math.min(10,c.fails-4)}alSave(c);if(m)m.textContent=c.fails>=5?"Wrong password — wait a little and try again (or use Forgot)":"Wrong password";const i=document.getElementById("al_pw");if(i){i.value="";i.focus()}},true);
document.addEventListener("click",async e=>{const b=e.target.closest("[data-al]");if(!b)return;const a=b.dataset.al;if(a==="pwf")return;e.preventDefault();e.stopImmediatePropagation();
 if(a==="bio")return alTryBio();
 if(a==="forgot"){if(!confirmDirtyAl())return;alSave(null);try{if(window.MYTOOL&&MYTOOL.signOut&&!MYTOOL.demo){await MYTOOL.signOut();return}}catch(_){}location.reload();return}
 if(a==="lock"){alMenuClose();alShow();return}
 if(a==="ws"){alMenuClose();const want=b.dataset.ws||"";const cur=(window.MYTOOL&&MYTOOL.workspace)||"";if(want===cur)return;
  if(!confirm(want==="own"?"Switch this device to your OWN Drive?\nMY TOOL opens your own data (empty the first time, you are its Owner). The company data stays where it is — switch back any time from 🔒.":"Switch this device back to the company data (Vartleaves)?"))return;if(window.MYTOOL&&MYTOOL.setWorkspace)MYTOOL.setWorkspace(want);return}
 if(a==="setup"){alMenuClose();alSetup();return}},true);
function confirmDirtyAl(){try{return confirm("Sign out of MY TOOL on this device and remove the lock?\nYour data stays safe in Drive — after signing in with Google it loads again.")}catch(_){return true}}
/* idle → lock; coming back to the tab after the idle time → lock */
["pointerdown","keydown","wheel","touchstart"].forEach(ev=>document.addEventListener(ev,()=>{if(!alLocked)alLast=Date.now()},{passive:true,capture:true}));
setInterval(()=>{const c=alCfg();if(c&&c.on&&!alLocked&&Date.now()-alLast>(+c.idleMin||10)*60000)alShow()},15000);
document.addEventListener("visibilitychange",()=>{const c=alCfg();if(document.visibilityState==="visible"&&c&&c.on&&!alLocked&&Date.now()-alLast>(+c.idleMin||10)*60000)alShow()});
/* keys do nothing behind the lock */
document.addEventListener("keydown",e=>{if(alLocked&&!e.target.closest?.("#alov")){e.stopImmediatePropagation();e.preventDefault()}},true);
/* 🔒 in the top bar */
function alBtn(){if(document.getElementById("alb"))return;const nb=document.querySelector('[data-act="newmenu"]')?.parentElement;if(!nb)return;const w=document.createElement("div");w.style.position="relative";w.innerHTML=`<button class="ib" id="alb" type="button" aria-label="Lock and device" title="Lock · which data this device opens" aria-haspopup="true">🔒</button><div id="almenu" hidden role="menu"></div>`;nb.parentElement.insertBefore(w,nb)}
function alWsHtml(){const ws=(window.MYTOOL&&MYTOOL.workspace)||"";return`<div class="alws"><div class="status" style="padding:6px 10px 2px">Data on this device</div><button type="button" class="m9i" data-al="ws" data-ws="" role="menuitemradio" aria-checked="${!ws}">${!ws?"✓ ":""}Company data (Vartleaves)</button><button type="button" class="m9i" data-al="ws" data-ws="own" role="menuitemradio" aria-checked="${ws==="own"}">${ws==="own"?"✓ ":""}My own Drive (my own data)</button></div>`}
function alMenuClose(){const m=document.getElementById("almenu");if(m)m.hidden=true}
document.addEventListener("click",e=>{const b=e.target.closest("#alb");const m=document.getElementById("almenu");if(b){e.preventDefault();e.stopImmediatePropagation();const c=alCfg();m.innerHTML=`${c&&c.on?`<button type="button" class="m9i" data-al="lock" role="menuitem">Lock now</button>`:""}<button type="button" class="m9i" data-al="setup" role="menuitem">${c&&c.on?"Change the lock on this device":"Set up a lock on this device"}</button>${alWsHtml()}`;m.hidden=!m.hidden;return}if(m&&!m.hidden&&!e.target.closest("#almenu"))m.hidden=true},true);
/* set up / change / turn off */
async function alSetup(){const c=alCfg()||{};const bio=await alBioOk();let o=document.getElementById("alset");if(!o){o=document.createElement("div");o.id="alset";o.className="ch-ov";document.body.appendChild(o)}
 o.innerHTML=`<div class="ch-box albox2" role="dialog" aria-modal="true" aria-labelledby="als_t"><div class="ch-h"><div><h2 id="als_t">Lock MY TOOL on this device</h2><div class="status">Only this device / browser. Your team set their own on their devices.</div></div><button type="button" class="x" data-als="close" aria-label="Close">×</button></div>
  <div class="form" style="padding:12px 16px">
   <label class="alrow"><input type="checkbox" id="als_bio" ${bio?"":"disabled"} ${c.bio?"checked":""}> Fingerprint / face / Windows Hello ${bio?"":`<span class="status">— not available on this device</span>`}</label>
   <div class="f"><label for="als_pw">Password ${c.pw?"(leave empty to keep the current one)":"(needed — the way in when the fingerprint does not work)"}</label><input id="als_pw" type="password" autocomplete="new-password" minlength="6"></div>
   <div class="f"><label for="als_pw2">Password again</label><input id="als_pw2" type="password" autocomplete="new-password"></div>
   <div class="f"><label for="als_idle">Lock after (minutes without use)</label><select id="als_idle">${[2,5,10,15,30,60].map(n=>`<option value="${n}" ${(+c.idleMin||10)===n?"selected":""}>${n}</option>`).join("")}</select></div>
   <div class="status" id="als_msg" aria-live="polite"></div>
   <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px"><button type="button" class="btn pri" data-als="save">${c.on?"Save":"Turn the lock on"}</button>${c.on?`<button type="button" class="btn" data-als="off">Turn the lock off</button>`:""}<button type="button" class="btn" data-als="close">Cancel</button></div></div></div>`;o.hidden=false;setTimeout(()=>document.getElementById(bio&&!c.bio?"als_bio":"als_pw")?.focus(),50)}
document.addEventListener("click",async e=>{const b=e.target.closest("[data-als]");if(!b)return;e.preventDefault();e.stopImmediatePropagation();const o=document.getElementById("alset");const a=b.dataset.als;const msg=document.getElementById("als_msg");
 if(a==="close"){o.hidden=true;return}
 if(a==="off"){const c=alCfg();if(c?.pw){const pw=document.getElementById("als_pw").value;if(!pw||await alHash(pw,c.pw.salt,c.pw.iter)!==c.pw.hash){msg.textContent="Type your current password in the box above to turn the lock off";return}}alSave(null);o.hidden=true;toast("Lock is off on this device");return}
 if(a==="save"){const c=alCfg()||{};const pw=document.getElementById("als_pw").value,pw2=document.getElementById("als_pw2").value;const wantBio=document.getElementById("als_bio").checked;
  if(!c.pw&&!pw){msg.textContent="Choose a password (6 or more characters) — it is the way in when the fingerprint does not work";return}
  if(pw&&pw.length<6){msg.textContent="Use 6 or more characters";return}if(pw&&pw!==pw2){msg.textContent="The two passwords are not the same";return}
  const n={...c,on:true,idleMin:+document.getElementById("als_idle").value||10,email:(typeof uid!=="undefined"&&uid)||c.email||"",fails:0,waitUntil:0};
  if(pw){const salt=alB64(crypto.getRandomValues(new Uint8Array(16)));n.pw={salt,iter:150000,hash:await alHash(pw,salt,150000)}}
  if(wantBio&&!c.bio){try{msg.textContent="Touch the fingerprint sensor / look at the camera…";n.bio=await alBioCreate()}catch(err){msg.textContent="Fingerprint / face was not set up ("+(err.name||err.message)+") — the password still works";n.bio=null}}else if(!wantBio)n.bio=null;
  alSave(n);o.hidden=true;toast(`Lock is on — ${n.bio?"fingerprint / face or password":"password"}, after ${n.idleMin} min without use`)}},true);
/* when the app opens: lock first (before anything is shown), and put the 🔒 in the top bar */
(function(){const c=alCfg();if(c&&c.on){if(document.body)alShow();else document.addEventListener("DOMContentLoaded",alShow)}const t=setInterval(()=>{alBtn();if(document.getElementById("alb"))clearInterval(t)},300)})();
(function(){try{const st=document.createElement("style");st.textContent=`#alov{position:fixed;inset:0;z-index:1000;background:var(--bg,#f8fafb);display:flex;align-items:center;justify-content:center;padding:16px}#alov[hidden]{display:none}html.al-on body>*:not(#alov):not(script):not(style){visibility:hidden}
.albox{width:min(380px,100%);text-align:center;display:flex;flex-direction:column;gap:12px;align-items:stretch}.albox h2{margin:4px 0 0}.albox .mt-logo{margin:0 auto}.albig{min-height:52px;font-size:16px}.albox .lnk{align-self:center}.alpw{display:flex;gap:8px}.alpw input{flex:1;min-height:44px}
#almenu{position:absolute;right:0;top:44px;z-index:40;min-width:240px;background:var(--card,#fff);border:1px solid var(--line,#dde3ea);border-radius:10px;box-shadow:0 10px 28px rgba(20,40,60,.16);padding:6px}#almenu[hidden]{display:none}.alrow{display:flex;gap:8px;align-items:center;padding:6px 0}.albox2{max-width:480px}`;document.head.appendChild(st)}catch(_){}})();
