#!/usr/bin/env python3
"""Build MY TOOL: index.html (app) + manifest + service worker. Run: python3 build.py [--demo-seed DIR --out FILE]"""
import json, os, re, sys, glob, subprocess, hashlib
R = os.path.dirname(os.path.abspath(__file__))
MODS = ["icons", "starter_data", "applock", "core", "forms", "forms2", "views", "drawers", "setup", "importer", "readers", "icc", "extra", "export_ps", "help_view", "health", "rates_auto", "nav2", "home_flow", "datafix", "alloc_multi", "packing", "landing", "prodsheet", "connect", "helpmode", "brand", "guard_links", "sync_ui", "calc_trace", "daily", "imp_report", "archive_ui", "scan", "ebay", "drive_link", "form_nav", "create_hub", "tasks_links", "mo_link", "product_add", "guards", "approvals", "landed_final", "bank_safe", "qc", "samples", "ideas", "menu9", "listcols", "reports9", "ui_polish", "ship_status", "add_more", "view_as", "starter", "importer_auto", "roles2", "history2", "access3", "drive_people", "move_data", "supplier_link", "uplinks", "sbox", "pick", "access_req", "stock_why", "people", "invite", "create_more", "filetype", "docbrain", "documents", "create_order", "events"]

def read(p): return open(os.path.join(R, p), encoding="utf-8").read()

def build(seed_dir=None, out="index.html"):
    head = read("src/app/head.html")
    # The owner's rule: everything new must be reachable from Create. A module passes when it has a form / CREATE_REG entry,
    # a chRegister(...) call, or a written reason "/* create: ... */". Modules from before the rule (20 Nov 2026) are listed once.
    CREATE_BASELINE = {"icons", "applock", "core", "forms", "forms2", "views", "drawers", "setup", "importer", "readers", "icc", "extra", "export_ps", "help_view", "health", "rates_auto", "nav2", "home_flow", "datafix", "alloc_multi", "packing", "landing", "prodsheet", "connect", "helpmode", "brand", "guard_links", "sync_ui", "calc_trace", "daily", "imp_report", "archive_ui", "scan", "ebay", "drive_link", "form_nav", "create_hub", "tasks_links", "mo_link", "product_add", "guards", "approvals", "landed_final", "bank_safe", "qc", "samples", "ideas", "menu9", "listcols", "reports9", "ui_polish", "events"}
    missing = [m for m in MODS if m not in CREATE_BASELINE and os.path.exists(os.path.join(R, f"src/app/{m}.js")) and not any(t in read(f"src/app/{m}.js") for t in ("chRegister(", "CREATE_REG.push", "/* create:"))]
    if missing:
        sys.exit("BUILD STOPPED - these modules are not in Create yet (add chRegister(...) or a /* create: reason */): " + ", ".join(missing))
    # The owner's rule (21 Nov 2026): a dropdown is never built loose. Every <select written after that day must say what it
    # chooses (data-src="company" / "list:role" ...) or why its list is fixed (data-fixed="reason") - pick.js does the rest.
    PICK_BASELINE = CREATE_BASELINE | {"ship_status", "add_more", "view_as", "starter", "importer_auto", "roles2", "history2", "access3", "drive_people", "move_data", "supplier_link", "create_more", "pick"}
    loose = []
    for m in MODS:
        fp = os.path.join(R, f"src/app/{m}.js")
        if m in PICK_BASELINE or not os.path.exists(fp): continue
        for tag in re.findall(r"<select\b[^>]*>", read(f"src/app/{m}.js")):
            if "data-src" not in tag and "data-fixed" not in tag: loose.append(m + ": " + tag[:80])
    if loose:
        sys.exit("BUILD STOPPED - a dropdown without data-src / data-fixed (use the centre, src/app/pick.js):\n  " + "\n  ".join(loose))
    js = "\n".join(read(f"src/app/{m}.js") for m in MODS if os.path.exists(os.path.join(R, f"src/app/{m}.js")))
    js = js.replace("/* ---------- Help page", "const HELP=" + read("src/app/help.json") + ";\n/* ---------- Help page", 1)
    # syntax check
    tmp = "/tmp/mytool_check.js"; open(tmp, "w").write(js)
    subprocess.run(["node", "--check", tmp], check=True)
    seed = ""
    if seed_dir:
        data = {}
        for col in os.listdir(seed_dir):
            p = os.path.join(seed_dir, col)
            if os.path.isdir(p): data[col] = [json.load(open(f)) for f in sorted(glob.glob(p + "/*.json"))]
        s = {c: {d["id"]: d for d in docs} for c, docs in data.items()}
        seed = "<script>window.__SEED=" + json.dumps(s, ensure_ascii=False).replace("</", "<\\/") + ";</script>\n"
    ver = hashlib.sha1((head + js + read("src/logo.js") + read("src/gshim.js")).encode()).hexdigest()[:10]
    pre = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
           '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
           '<meta name="description" content="MY TOOL — sourcing, orders, payments, shipments and stock for Vartleaves">'
           '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\' https://accounts.google.com; '
           'style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com https://accounts.google.com; font-src \'self\' data: https://fonts.gstatic.com; '
           'img-src \'self\' data: blob: https:; connect-src \'self\' https://www.googleapis.com https://accounts.google.com https://oauth2.googleapis.com https://api.frankfurter.dev https://open.er-api.com https://script.google.com https://script.googleusercontent.com; '
           'frame-src https://accounts.google.com https://drive.google.com https://docs.google.com; worker-src \'self\' blob:; object-src \'none\'; base-uri \'self\'; form-action \'none\'">'
           '<meta name="referrer" content="strict-origin-when-cross-origin">'
           '<title>MY TOOL</title><link rel="icon" type="image/png" sizes="16x16" href="assets/icon-16.png?v=4"><link rel="icon" type="image/png" sizes="32x32" href="assets/icon-32.png?v=4"><link rel="icon" type="image/png" sizes="192x192" href="assets/icon-192.png?v=4">'
           '<link rel="shortcut icon" href="assets/icon-32.png?v=4"><link rel="apple-touch-icon" href="assets/icon-180.png?v=4"><link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#2f5f8f">'
           '</head><body>\n')
    sw = ("<script>window.MYTOOL_VERSION='" + ver + "';if('serviceWorker' in navigator&&location.protocol==='https:'){navigator.serviceWorker.register('sw.js').then(r=>{r.addEventListener('updatefound',()=>{const w=r.installing;w&&w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller){const d=document.createElement('div');d.id='mt_upd';d.innerHTML='<b>New version of MY TOOL is ready</b> <button type=\"button\">Reload</button>';d.querySelector('button').onclick=()=>location.reload();document.body.appendChild(d)}})});setInterval(()=>r.update().catch(()=>{}),30*60*1000)}).catch(()=>{})}</script>\n")
    html = pre + seed + "<script>" + read("src/logo.js") + "</script>\n<script>" + read("src/gshim.js") + "</script>\n" + head + "\n<script>\n" + js + "\n</script>\n" + sw + "</body></html>\n"
    open(os.path.join(R, out) if not os.path.isabs(out) else out, "w", encoding="utf-8").write(html)
    if not seed_dir:
        open(os.path.join(R, "sw.js"), "w").write(read("src/sw.template.js").replace("__VER__", ver))
    print("built", out, len(html), "bytes, version", ver)

if __name__ == "__main__":
    a = sys.argv[1:]
    if "--demo-seed" in a:
        build(a[a.index("--demo-seed") + 1], a[a.index("--out") + 1])
    else:
        build()
