/* ---------- Windows: readable on a phone, calm on every screen (owner's phone screenshot, 25 Nov 2026) ----------
   1. Dark phones: the cards in the windows were white with light text (a colour name that did not exist — fixed at the root in
      head.html, and the build now stops on any colour name that is not defined).
   2. All "window" screens (People, Invite, Upload links, Supplier inbox, Where does this go, Documents, Receipt split, Shared,
      Fix it) share ONE look, set here once:
      - phone: the window is the whole screen; a short sticky title with Close always in reach; one column; the main button of a
        card is full width, the others share a row; tables scroll sideways inside their own box instead of squeezing
      - text: titles 16px, body 15px, small print never below 13px and never pale — the file name is the darkest thing on a card
      - less on screen: long hints fold to two lines (tap to read), status chips wrap, generous spacing between cards */
/* create: no entry of its own — it is the look of the windows */
(function(){try{const W=":is(#ppwin,#ivwin,#ulwin,#sbwin,#dbpwin,#dcwin,#rswin,#shwin,#fxwin,#fswin,.dbwin)";const st=document.createElement("style");st.id="ui_clean";st.textContent=`
${W} .ppbody{color:var(--fg);font-size:15px;line-height:1.5}
${W} .ppsec{background:var(--panel);color:var(--fg);box-shadow:0 1px 2px rgba(0,0,0,.04)}
${W} .ppsec b,${W} .ppsec h3{color:var(--fg)}
${W} .status{color:var(--muted);font-size:13px;line-height:1.45}
${W} .note{color:var(--muted);font-size:13.5px;line-height:1.5;margin:8px 0 4px}
${W} .pphead h2{font-size:18px;line-height:1.25;color:var(--fg)}
${W} .pphead{background:var(--bg)}
${W} .sbitem .sbtop b{font-size:15.5px;line-height:1.35;word-break:break-word}
${W} .tbl{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
${W} .tbl table{min-width:100%}
${W} select,${W} input:not([type=checkbox]):not([type=radio]){font-size:15px;color:var(--fg);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:8px 10px;max-width:100%}
${W} select[size]{padding:4px}
${W} select[size] option{padding:7px 8px;border-radius:6px;white-space:normal}
${W} label{color:var(--fg)}
${W} .lnk{color:var(--accent-strong,var(--accent))}
${W} a.btn{text-decoration:none}
.dbtop{background:var(--accent-soft);border-color:var(--accent)}
.dbwarn{background:var(--warn-bg)}.dbwarn b{color:var(--warn)}
.fxwhy{font-size:14px}
.pill.ok{background:var(--ok-bg);color:var(--ok)}.pill.warn{background:var(--warn-bg);color:var(--warn)}.pill.bad{background:var(--bad-bg);color:var(--bad)}
.dcok{color:var(--ok)}.dcno{color:var(--bad)}
@media (max-width:700px){
 ${W}{align-items:stretch}
 ${W} .ppbody{width:100%!important;padding:0 12px calc(24px + env(safe-area-inset-bottom,0px));font-size:15.5px}
 ${W} .pphead{top:0;padding:10px 0;gap:8px;flex-wrap:nowrap;align-items:flex-start;padding-top:calc(10px + env(safe-area-inset-top,0px))}
 ${W} .pphead h2{font-size:17px;flex:1;min-width:0}
 ${W} .pphead .btn{flex:none;min-height:40px;padding:6px 12px}
 ${W} .pphead .btn.sm{display:none}
 ${W} .ppsec{padding:14px;margin:10px 0;border-radius:14px}
 ${W} .ppgrid{grid-template-columns:1fr;gap:12px}
 ${W} .ppgrid label,${W} label{display:block}
 ${W} .ppgrid select,${W} .ppgrid input:not([type=checkbox]){width:100%}
 ${W} .sbtop{align-items:flex-start;gap:10px}
 ${W} .sbicon{font-size:22px;line-height:1.3}
 ${W} .sbtop>.ixbar,${W} .fxsteps{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
 ${W} .sbtop>.ixbar .btn,${W} .fxsteps .btn{width:100%;min-height:44px;justify-content:center;text-align:center;margin:0;white-space:normal;line-height:1.25}
 ${W} .sbtop>.ixbar .btn.pri,${W} .fxsteps .btn.pri,${W} .sbtop>.ixbar .btn:only-child{grid-column:1/-1}
 ${W} .fxsteps>span{display:none}
 ${W} .ixbar{gap:8px}
 ${W} .ixbar>.btn.pri{flex:1 1 100%;min-height:46px;justify-content:center}
 ${W} .dbtabs{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}
 ${W} .dbtabs .btn{width:100%;justify-content:center;min-height:42px}
 ${W} .note{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
 ${W} .note.open,${W} .ppsec .note{display:block;-webkit-line-clamp:unset}
 ${W} .tbl table{min-width:560px}
 ${W} .dcfilters,${W} .sbfilters{display:grid;grid-template-columns:1fr 1fr;gap:8px}
 ${W} .dcfilters label,${W} .sbfilters label{display:flex;flex-direction:column;align-items:stretch;gap:2px;font-size:13px}
 ${W} .dcfilters input[type=search],${W} .sbfilters input[type=search]{grid-column:1/-1;max-width:none!important;width:100%}
 ${W} .dcpv iframe{height:60vh}
 ${W} select[size]{height:auto;max-height:44vh}
 .fxwhy{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.fxwhy.open{display:block}
 ${W} .ppsec>a.btn.sm,${W} .ppsec>div>a.btn.sm{display:inline-flex;margin:6px 0}
 .dbrec{font-size:15px;line-height:1.35}
 .dbchips .pill{font-size:12.5px}
 #dpbar{font-size:13px;padding:8px 10px}
}`;document.head.appendChild(st)}catch(e){console.warn("ui_clean",e)}})();
/* a folded hint opens on tap */
document.addEventListener("click",e=>{const n=e.target.closest?.(".ppbody>.note,.fxwhy");if(n)n.classList.toggle("open")});
