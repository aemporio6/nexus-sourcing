#!/usr/bin/env python3
"""Check a Payment Summary export against the owner's sheet and the app's own totals.
usage: python3 tests/ps/check_ps.py <export.xlsx> <app.json> <owner.xlsx> [--expect-val107]"""
import sys, json, datetime, openpyxl

xlsx, appj, owner = sys.argv[1:4]
expect107 = "--expect-val107" in sys.argv  # newer data (/tmp/mt_seed_start): VAL-106 ¥25,760 + VAL-107 ¥22,217
app = json.load(open(appj))
wb = openpyxl.load_workbook(xlsx)              # styles, formulas, links
wv = openpyxl.load_workbook(xlsx, data_only=True)  # cached formula results
ow = openpyxl.load_workbook(owner)
fails = 0
def check(name, ok, got=""):
    global fails
    if not ok: fails += 1
    print(("PASS " if ok else "FAIL ") + name + (f" | {got}" if got != "" else ""))

names = wb.sheetnames
check("INDEX and ALL PAYMENTS tabs", names[:2] == ["INDEX", "ALL PAYMENTS"], names[:2])
code2tab = {v["code"]: k for k, v in app["byTab"].items() if v["code"]}
missing = [c for c in app["want"] if c not in code2tab or code2tab[c] not in names]
check(f"a tab per supplier/forwarder/inspector ({len(app['want'])})", not missing, missing)
check("tab names 'SUPnn- Name | what' style", all(" | " in n or n.startswith("OTHER") for n in names[2:]), names[2:6])

# --- Joyce tab
jt = code2tab.get("SUP-001")
ws = wb[jt] if jt else None
check("Joyce tab name", jt == "SUP13- Joyce Wen | Middle Man", jt)
def find_rows(ws, amount, date):
    out = []
    for r in range(4, ws.max_row + 1):
        f, h = ws.cell(r, 6).value, ws.cell(r, 8).value
        if f is not None and abs(float(f) - amount) < 0.005 and isinstance(h, datetime.datetime) and h.date() == date: out.append(r)
    return out
def group_ref(ws, r):  # value of merged A cell for row r
    for rng in ws.merged_cells.ranges:
        if rng.min_col == 1 and rng.min_row <= r <= rng.max_row: return ws.cell(rng.min_row, 1).value
    return ws.cell(r, 1).value
if ws:
    r106 = find_rows(ws, 25760, datetime.date(2026, 10, 14)) if expect107 else find_rows(ws, 24416.5, datetime.date(2026, 10, 9))
    if not expect107: print("INFO older seed: VAL-106 is the pending ¥24,416.50 of 9 Oct")
    check("Joyce: VAL-106 ¥25,760 on 14 Oct" if expect107 else "Joyce: VAL-106 ¥24,416.50 on 9 Oct (pending)", len(r106) == 1 and group_ref(ws, r106[0]) == "VAL-106", [(r, group_ref(ws, r)) for r in r106])
    if r106 and not expect107:
        check("pending payment shown as NOT COUNTED", str(ws.cell(r106[0], 16).value).startswith("NOT COUNTED"), ws.cell(r106[0], 16).value)
    if r106 and expect107:
        r = r106[0]; c = ws.cell(r, 1)
        check("VAL row blue bold Arial 14", c.fill.fgColor.rgb == "FF4A86E8" and c.font.b and c.font.sz == 14 and c.font.name == "Arial", (c.fill.fgColor.rgb, c.font.b, c.font.sz))
        check("VAL-106 note shows the personal table", "Ameen" in str(ws.cell(r, 16).value) and "50% ¥24416.5" in str(ws.cell(r, 16).value), ws.cell(r, 16).value)
        check("amount format ¥", ws.cell(r, 6).number_format == '"¥"#,##0.00', ws.cell(r, 6).number_format)
        check("£ value format £", ws.cell(r, 9).number_format == '"£"#,##0.00', ws.cell(r, 9).number_format)
        check("date format dd-mmm-yyyy", ws.cell(r, 8).number_format == "dd-mmm-yyyy", ws.cell(r, 8).number_format)
        j = ws.cell(r, 10)
        check("receipt link is a hyperlink with the full URL as text", j.hyperlink is not None and j.hyperlink.target == j.value and str(j.value).startswith("https://"), j.value)
    r107 = find_rows(ws, 22217, datetime.date(2026, 11, 2))
    if expect107 or r107:
        check("Joyce: VAL-107 ¥22,217 on 2 Nov", len(r107) == 1 and group_ref(ws, r107[0]) == "VAL-107", [(r, group_ref(ws, r)) for r in r107])
        if r107:
            note = str(ws.cell(r107[0], 16).value)
            want = "2 Nov ¥22217 = 50% ¥19317 + Plunger sample ¥150 + Rose ¥650+¥500 + Caroline ¥800+¥800"
            check("VAL-107 split note (owner style)", note == want, note)
            k = ws.cell(r107[0], 11)
            check("VAL-107 invoice link", k.hyperlink is not None and "1KB73on_7VAF" in str(k.value), k.value)
    else:
        print("INFO VAL-107 not in this data set (older seed)")
    links = sum(1 for r in range(4, ws.max_row + 1) for c in (10, 11, 12) if ws.cell(r, c).hyperlink)
    check("Joyce tab has hyperlinks", links > 10, links)

# --- header rows 1-3 match the owner's sheet (Joyce tab)
if ws:
    os_ = ow["SUP13- JoyceWen | Middle Man"]
    bad = []
    for r in (1, 2, 3):
        for col in "ABCDEFGHIJKLMNO":
            a, b = os_[f"{col}{r}"], ws[f"{col}{r}"]
            if r == 1 and col > "E": continue          # owner row 1 right side holds totals only
            if (a.value or None) != (b.value or None) and not (r == 1 and col == "A"): bad.append(f"{col}{r} value {a.value!r}≠{b.value!r}")
            if a.fill.fgColor.rgb != b.fill.fgColor.rgb: bad.append(f"{col}{r} fill {a.fill.fgColor.rgb}≠{b.fill.fgColor.rgb}")
            hidden = type(b).__name__ == "MergedCell"   # covered by a merge: its font never shows
            if hidden: pass
            elif (a.font.name, bool(a.font.b), a.font.sz) != (b.font.name, bool(b.font.b), b.font.sz): bad.append(f"{col}{r} font {(a.font.name,a.font.b,a.font.sz)}≠{(b.font.name,b.font.b,b.font.sz)}")
            ac = a.font.color.rgb if a.font.color is not None and isinstance(a.font.color.rgb, str) else None
            bc = b.font.color.rgb if b.font.color is not None and isinstance(b.font.color.rgb, str) else None
            if ac != bc and not hidden: bad.append(f"{col}{r} colour {ac}≠{bc}")
    merged_owner = {str(m) for m in os_.merged_cells.ranges if m.max_row <= 3}
    merged_ours = {str(m) for m in ws.merged_cells.ranges if m.max_row <= 3}
    check("header merges like the owner (A2:A3 C2:D2 F2:G2 H2:K2 L2:O2)", merged_owner - {"A1:E1"} <= merged_ours, sorted(merged_owner - merged_ours))
    check("header rows 1-3: values, fills, fonts, colours = owner's sheet", not bad, bad[:8])
    check("F1 total format ¥", ws["F1"].number_format == '"¥"#,##0.00' and os_["F1"].number_format == '"¥"#,##0.00', ws["F1"].number_format)
    check("freeze below the header (A4)", ws.freeze_panes == "A4", ws.freeze_panes)

# --- INDEX totals = app totals
ix = wv["INDEX"]; hdr = [ix.cell(4, c).value for c in range(1, 9)]
check("INDEX headers", hdr[:7] == ["Supplier", "Tab", "Payments", "Paid ¥ (RMB)", "Paid £ (GBP)", "Paid $ (USD)", "Outstanding"], hdr)
tot_row = next(r for r in range(5, ix.max_row + 1) if ix.cell(r, 1).value == "TOTAL")
for col, cur in ((4, "RMB"), (5, "GBP"), (6, "USD")):
    got = round(float(ix.cell(tot_row, col).value or 0), 2); want = round(app["tot"].get(cur, 0), 2)
    check(f"INDEX total {cur} = app sum of counted payments", abs(got - want) < 0.01, f"{got} vs {want}")
check("INDEX payments count = app", int(ix.cell(tot_row, 3).value) == app["nCounted"], f"{ix.cell(tot_row,3).value} vs {app['nCounted']}")
rowsum = {"RMB": 0, "GBP": 0, "USD": 0}
for r in range(5, tot_row):
    t = ix.cell(r, 2).value; a = app["byTab"].get(t)
    if not a: check(f"INDEX row tab {t} known", False); continue
    for col, cur in ((4, "RMB"), (5, "GBP"), (6, "USD")):
        v = float(ix.cell(r, col).value or 0); rowsum[cur] += v
        if abs(v - a[cur]) > 0.01: check(f"INDEX {t} {cur}", False, f"{v} vs {a[cur]}")
check("INDEX tab links are internal hyperlinks", all(wb["INDEX"].cell(r, 2).hyperlink is not None for r in range(5, tot_row)))
# recompute from ALL PAYMENTS (what the SUMIFS formulas do) to prove the formulas agree with the cached values
ap = wv["ALL PAYMENTS"]; apc = {"CNY": 0, "GBP": 0, "USD": 0}; n_ap = 0
for r in range(4, ap.max_row + 1):
    if ap.cell(r, 3).value is None: continue
    n_ap += 1
    if ap.cell(r, 11).value == "PAID" and ap.cell(r, 8).value in apc: apc[ap.cell(r, 8).value] += float(ap.cell(r, 7).value)
check("ALL PAYMENTS has one line per payment", n_ap == app["nPays"], f"{n_ap} vs {app['nPays']}")
check("ALL PAYMENTS sums = INDEX totals", all(abs(apc[x] - app["tot"].get(y, 0)) < 0.01 for x, y in (("CNY", "RMB"), ("GBP", "GBP"), ("USD", "USD"))), apc)
aph = [wb["ALL PAYMENTS"].cell(3, c).value for c in range(1, 15)]
check("ALL PAYMENTS columns", aph == ["#", "Supplier tab", "Payment no", "Order Ref", "Old ref", "Payment date", "Amount", "Currency", "£ value", "Bank", "Status", "Receipt link", "Invoice link", "Note"], aph)
check("ALL PAYMENTS header fill yellow", wb["ALL PAYMENTS"]["A3"].fill.fgColor.rgb == "FFF1C232")
print(f"{fails} FAILED" if fails else "ALL PASS"); sys.exit(1 if fails else 0)
