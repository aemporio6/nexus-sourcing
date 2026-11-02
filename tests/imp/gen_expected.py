#!/usr/bin/env python3
"""Independent expected numbers for the importer tests, computed straight from the owner's files with Python
(openpyxl / csv) — NOT with the app's code. Writes tests/imp/expected.json. Run: python3 -I tests/imp/gen_expected.py"""
import csv, io, glob, json, os, re, sys
import openpyxl
ATT = "/mnt/user-data/attachments/117846c6-ab7f-5f52-9a04-3582b9919749"
SCR = "/tmp/claude-0/-home-claude/117846c6-ab7f-5f52-9a04-3582b9919749/scratchpad"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "expected.json")
def att(part): return [f for f in glob.glob(ATT + "/*") if part in os.path.basename(f)][0]
def num(s):
    s = str(s if s is not None else "").replace("£", "").replace("$", "").replace("€", "").replace(",", "").replace("\t", "").strip()
    if s in ("", "-", "N/A"): return 0.0
    neg = s.startswith("(")
    try: v = float(s.strip("()"))
    except ValueError: return 0.0
    return -v if neg else v
def rd(p, skip=0):
    b = open(p, "rb").read()
    try: t = b.decode("utf-8-sig")
    except UnicodeDecodeError: t = b.decode("cp1252")
    return list(csv.reader(io.StringIO(t)))[skip:]
E = {"eco": {}, "market": {}}
# ---- Eco Huang PIs: lines under "Shipping Way" header until "Total"; first number of "Total Price"
MON = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
for f in sorted(glob.glob(SCR + "/eco_pi/*.xlsx")):
    ws = openpyxl.load_workbook(f, data_only=True).worksheets[0]
    rows = [[c.value for c in r] for r in ws.iter_rows()]
    hi = next(i for i, r in enumerate(rows) if any(str(v).strip().lower() == "shipping way" for v in r if v))
    hdr = [str(v or "").strip().lower() for v in rows[hi]]
    pc = hdr.index("total price"); gc = next(i for i, h in enumerate(hdr) if "goods" in h)
    amounts = []; total = None
    for r in rows[hi + 1:]:
        a = str(r[0] or "").strip()
        if a.lower() == "total":
            for v in r[1:]:
                m = re.search(r"-?\d[\d,]*\.?\d*", str(v or ""))
                if v not in (None, "") and m: total = float(m.group(0).replace(",", "")); break
            break
        goods = str(r[gc] or "").strip(); price = str(r[pc] or "").strip()
        if len(goods) > 220: break
        if not goods and not price: continue
        m = re.search(r"-?\d[\d,]*\.?\d*", price)
        if m: amounts.append(float(m.group(0).replace(",", "")))
    dt = next((str(v) for r in rows for v in r if v and str(v).strip().lower().startswith("date")), "")
    md = re.search(r"(\d{1,2})\s*(?:st|nd|rd|th)?\s*[,.\s]*([A-Za-z]{3,9})\.?\s*[,.\s]*(\d{4})", dt)
    iso = "%s-%02d-%02d" % (md.group(3), MON[md.group(2)[:3].lower()], int(md.group(1))) if md else None
    E["eco"][os.path.basename(f)] = {"sum": round(sum(amounts), 2), "total": total, "date": iso, "lines": len([1 for r in rows[hi+1:] if str(r[0] or '').strip().lower() != 'total'])}
# ---- marketplace / public formats
r = rd(att("093d1895-eBay-OrdersReport"), 1); h = r[0]; ix = {k: i for i, k in enumerate(h)}; d = [x for x in r[1:] if len(x) == len(h) and any(c.strip() for c in x)]
E["market"]["ebay"] = {"rows": len(d), "qty": sum(num(x[ix["Quantity"]]) for x in d), "soldFor": round(sum(num(x[ix["Sold for"]]) for x in d), 2), "total": round(sum(num(x[ix["Total price"]]) for x in d), 2)}
r = rd(att("fd2e3630-taxReport")); h = r[0]; ix = {k: i for i, k in enumerate(h)}
E["market"]["tax"] = {"rows": len(r) - 1, "qty": sum(num(x[ix["Quantity"]]) for x in r[1:]), "incl": round(sum(num(x[ix["OUR_PRICE Tax Inclusive Selling Price"]]) for x in r[1:]), 2), "vat": round(sum(num(x[ix["OUR_PRICE Tax Amount"]]) for x in r[1:]), 2), "excl": round(sum(num(x[ix["OUR_PRICE Tax Exclusive Selling Price"]]) for x in r[1:]), 2)}
r = rd(att("18f77cd7-2026Jul1-2026Sep30CustomTransaction"), 9); h = r[0]; ix = {k: i for i, k in enumerate(h)}
E["market"]["ctx"] = {"rows": len(r) - 1, "qty": sum(num(x[ix["quantity"]]) for x in r[1:]), "sales": round(sum(num(x[ix["product sales"]]) for x in r[1:]), 2), "selling": round(sum(num(x[ix["selling fees"]]) for x in r[1:]), 2), "fba": round(sum(num(x[ix["fba fees"]]) for x in r[1:]), 2), "total": round(sum(num(x[ix["total"]]) for x in r[1:]), 2)}
r = rd(att("8b726475-UK-Vartleaves-Reports")); h = r[0]; ix = {k: i for i, k in enumerate(h)}
E["market"]["temuTx"] = {"rows": len(r) - 1, "qty": sum(num(x[ix["Quantity"]]) for x in r[1:]), "fee": round(sum(num(x[ix["Service fee (tax incl.)"]]) for x in r[1:]), 2), "total": round(sum(num(x[ix["Total"]]) for x in r[1:]), 2)}
r = rd(att("5f730a19-order_export")); h = r[0]; W = len(h); fixed = []
for x in r[1:]:
    if len(x) > W: n = len(x) - W; x = x[:7] + [",".join(x[7:8 + n])] + x[8 + n:]
    fixed.append(x)
ix = {k: i for i, k in enumerate(h)}
E["market"]["temu"] = {"rows": len(fixed), "longRows": sum(1 for x in r[1:] if len(x) > W), "qty": sum(num(x[ix["quantity purchased"]]) for x in fixed), "price": round(sum(num(x[ix["goods base price"]]) for x in fixed), 2), "total": round(sum(num(x[ix["retail price total"]]) for x in fixed), 2), "cancelled": sum(1 for x in fixed if x[1] == "Canceled")}
r = rd(att("a83f5ba6-All_Orders")); h = r[0]; ix = {k: i for i, k in enumerate(h)}
E["market"]["p2g"] = {"rows": len(r) - 1, "value": round(sum(num(x[ix["Value"]]) for x in r[1:]), 2), "weight": round(sum(num(x[ix["Weight"]]) for x in r[1:]), 3)}
r = rd(att("3b2171a0-statement_"), 1); h = r[0]; ix = {k: i for i, k in enumerate(h)}
E["market"]["ads"] = {"rows": len(r) - 1, "billedGbp": round(sum(num(x[ix["Amount billed (converted)"]]) for x in r[1:]), 2), "paidGbp": round(sum(num(x[ix["Amount Paid (converted)"]]) for x in r[1:]), 2), "taxGbp": round(sum(num(x[ix["Tax amount billed (converted)"]]) for x in r[1:]), 2)}
E["market"]["br"] = {}
for f in sorted(glob.glob(ATT + "/*BusinessReport*")):
    r = rd(f); h = r[0]; ix = {k: i for i, k in enumerate(h)}
    if "(Child) ASIN" in ix:  # a variation-parent line (parent = child) repeats its children's sales: not a data line
        r = [h] + [x for x in r[1:] if x[ix["(Child) ASIN"]] != x[ix["(Parent) ASIN"]]]
    E["market"]["br"][os.path.basename(f)[:8]] = {"rows": len(r) - 1, "units": sum(num(x[ix["Units ordered"]]) for x in r[1:]), "sales": round(sum(num(x[ix["Ordered Product Sales"]]) for x in r[1:]), 2)}
r = rd(att("e79cc5cc-SalesDashboard"))
i = [k for k, x in enumerate(r) if x and x[0].startswith("Time")][0]; days = [x for x in r[i + 1:] if x and x[0][:2] == "20"]
E["market"]["dash"] = {"days": len(days), "units": sum(num(x[2]) for x in days), "sales": round(sum(num(x[1]) for x in days), 2)}
rows = list(csv.reader(open(att("a12acd78-All_Listings_Report"), encoding="utf-8"), delimiter="\t"))
E["market"]["listings"] = {"rows": len(rows) - 1, "asins": sorted(set(x[16] for x in rows[1:]))}
json.dump(E, open(OUT, "w"), indent=1)
print("wrote", OUT)
