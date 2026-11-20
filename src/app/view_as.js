/* ---------- "View as" never traps the Owner (owner, 18 Nov 2026) ----------
   Bug: the Owner tapped "View as" (e.g. VA / Finance) — that choice was remembered in the browser, and the View-as switch itself
   was then hidden (it checked the role being viewed, not the real one). So actions said "Your role cannot remove records"
   (Import → Undo) with no way back. Now:
   - View as lasts only until the app is reopened (every sign-in starts as your real role)
   - while viewing as another role, a bar on top says so with "Back to Owner"
   - the View-as switch always shows for the real Owner
   - a "your role cannot…" message while viewing as another role says why, with the same way back */
try{ls.del("role")}catch(_){}
const vaIsReal=()=>(S.realRole||S.role)==="owner";
const vaRS0=roleSwitch;
roleSwitch=function(){if(!vaIsReal())return vaRS0.apply(this,arguments);const r=S.role;S.role="owner";try{return vaRS0.apply(this,arguments).replace(/class="rb on"/g,'class="rb"').replace(new RegExp(`(class="rb) ("[^>]*data-role="${r}")`),'$1 on$2')}finally{S.role=r}};
function vaBack(){S.role=S.realRole||"owner";try{ls.del("role")}catch(_){}render();toast("Back to "+(item("role",S.role)?.label||"Owner")+" — everything is allowed again")}
const vaRender0=render;
render=function(){const r=vaRender0.apply(this,arguments);try{let bar=document.getElementById("vabar");const on=vaIsReal()&&S.realRole&&S.role!==S.realRole;
 if(!on){bar?.remove();return r}if(!bar){bar=document.createElement("div");bar.id="vabar";bar.setAttribute("role","status");document.body.prepend(bar)}
 bar.innerHTML=`👁 You are viewing as <b>${esc(item("role",S.role)?.label||S.role)}</b> — some buttons are blocked on purpose. <button type="button" class="btn sm pri" data-va-back>Back to Owner</button>`}catch(e){console.warn(e)}return r};
const vaToast0=toast;
toast=function(msg,o){if(typeof msg==="string"&&/role|Only the Owner/i.test(msg)&&!/Back to|now/.test(msg)&&vaIsReal()&&S.realRole&&S.role!==S.realRole)msg=`${msg} — because you are viewing as ${item("role",S.role)?.label||S.role}. Tap "Back to Owner" at the top.`;return vaToast0.call(this,msg,o)};
document.addEventListener("click",e=>{if(!e.target.closest("[data-va-back]"))return;e.preventDefault();e.stopImmediatePropagation();vaBack()},true);
(function(){try{const st=document.createElement("style");st.textContent=`#vabar{position:sticky;top:0;z-index:60;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;padding:8px 14px;background:#fff4d6;color:#5a4300;border-bottom:1px solid #f0d28a;font-size:13px}`;document.head.appendChild(st)}catch(_){}})();
/* create: nothing to create — a safety bar for “View as” */
