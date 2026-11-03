#!/usr/bin/env python3
"""Build MY TOOL: index.html (app) + manifest + service worker. Run: python3 build.py [--demo-seed DIR --out FILE]"""
import json, os, re, sys, glob, subprocess, hashlib
R = os.path.dirname(os.path.abspath(__file__))
MODS = ["icons", "core", "forms", "forms2", "views", "drawers", "setup", "importer", "readers", "icc", "extra", "export_ps", "events"]

def read(p): return open(os.path.join(R, p), encoding="utf-8").read()

def build(seed_dir=None, out="index.html"):
    head = read("src/app/head.html")
    js = "\n".join(read(f"src/app/{m}.js") for m in MODS if os.path.exists(os.path.join(R, f"src/app/{m}.js")))
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
    ver = hashlib.sha1((head + js + read("src/gshim.js")).encode()).hexdigest()[:10]
    pre = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
           '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
           '<meta name="description" content="MY TOOL — sourcing, orders, payments, shipments and stock for Vartleaves">'
           '</head><body>\n')
    sw = ("<script>window.MYTOOL_VERSION='" + ver + "';if('serviceWorker' in navigator&&location.protocol==='https:'){navigator.serviceWorker.register('sw.js').catch(()=>{})}</script>\n")
    html = pre + seed + "<script>" + read("src/gshim.js") + "</script>\n" + head + "\n<script>\n" + js + "\n</script>\n" + sw + "</body></html>\n"
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
