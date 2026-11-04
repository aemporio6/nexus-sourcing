/* Business calculations against known expected values (demo build on :8093).  node tests/t_calc.js */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("http://localhost:8093/index.html?demo"); await p.waitForFunction(() => { try{ return S.ready }catch(e){ return false } }); await p.waitForTimeout(500);
  let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if(!c) fails++; };
  const r = await p.evaluate(() => {
    const out = {};
    /* rounding */
    out.r2 = [r2(1.005), r2(-1.005), r2(2.675), r2(0.1 + 0.2), r2(313513.82 * 0.3), r2(1e12 + 0.004), r2("abc")];
    /* 30/50/20 on the 546-carton order */
    const total = 313513.82; out.sched = [r2(total * 0.3), r2(total * 0.5), r2(total * 0.2)]; out.schedSum = r2(out.sched[0] + out.sched[1] + out.sched[2]);
    /* fx at the date of payment, not today */
    const rate = rateOn("2026-08-08", "RMB"); out.fx = { rate, gbp: rate ? r2(94054.15 * rate) : null, gbpFn: r2(toGbp(94054.15, "RMB", "2026-08-08")), todayDiff: r2(toGbp(94054.15, "RMB", today())) };
    /* an order's money identity: paid + credits + written off + via + balance = total */
    out.ident = live(D.purchases).slice(0, 80).map(po => { const st = poState(po); return [po.no, r2(st.paidCur + st.credits + st.writtenOff + st.viaUsed + st.balance), r2(st.total)]; }).filter(x => Math.abs(x[1] - x[2]) > 0.5);
    /* packing: 950 units at 100 per carton → 9 full + 1 tail of 50 */
    const prP = live(D.products).find(x => +x.perCtn > 0 && x.ctn && +x.ctn.L); const per = +prP.perCtn; const q = per * 9 + Math.floor(per / 2);
    try{ const pk = packingOf({ lines: [{ sku: prP.sku, q }] }); const m = ctnMath(prP); out.pack = { per, q, full: pk.rows[0].full, tail: pk.rows[0].tail, n: pk.ctn, cbm: r2(pk.cbm), expCbm: r2(10 * m.vol), kg: pk.kg, expKg: r2(9 * m.gross + pk.rows[0].tailKg) }; }catch(e){ out.packErr = e.message; }
    /* landed cost is goods + fee + extras + freight + uk + duty + vat */
    const anyPo = live(D.purchases).find(x => (x.lines || []).some(l => l.sku && +l.q > 0)); const line = anyPo && anyPo.lines.find(l => l.sku && +l.q > 0);
    if(line){ const lp = landedParts({ sku: line.sku, po: anyPo.no, q: +line.q }, {}); out.landed = [r2(lp.goods + lp.fee + lp.extras + lp.freight + lp.uk + lp.duty + lp.vat), r2(lp.total)]; }
    /* overrides: an AUTO value changed by hand is recorded on the record */
    out.hasOverrideFn = typeof overridesBlock === "function" && typeof reconBlock === "function";
    return out;
  });
  ok(JSON.stringify(r.r2) === JSON.stringify([1.01, -1.01, 2.68, 0.3, 94054.15, 1000000000000, 0]), "r2 float-safe: " + JSON.stringify(r.r2));
  ok(JSON.stringify(r.sched) === JSON.stringify([94054.15, 156756.91, 62702.76]) && r.schedSum === 313513.82, "30/50/20 of ¥313,513.82 = 94,054.15 / 156,756.91 / 62,702.76 (sum exact)");
  ok(r.fx.rate && r.fx.gbp === r.fx.gbpFn, "£ uses the rate on the payment date (" + r.fx.rate + " → £" + r.fx.gbp + (r.fx.todayDiff !== r.fx.gbp ? ", today would give £" + r.fx.todayDiff : "") + ")");
  ok(r.ident.length === 0, "money identity holds on every order (" + (r.ident.length ? JSON.stringify(r.ident.slice(0, 3)) : "80 checked") + ")");
  ok(r.pack && r.pack.full === 9 && r.pack.tail === Math.floor(r.pack.per / 2) && r.pack.n === 10 && r.pack.cbm === r.pack.expCbm && Math.abs(r.pack.kg - r.pack.expKg) < 0.01, "9.5 cartons' worth → 9 full + 1 tail carton, CBM = 10 × carton, kg = 9 full + tail: " + JSON.stringify(r.pack || r.packErr));
  ok(r.landed && r.landed[0] === r.landed[1], "landed total = sum of its parts " + JSON.stringify(r.landed));
  ok(r.hasOverrideFn, "override log + reconciliation block present");
  /* override log end-to-end: open a new purchase form, let AUTO fill a date, change it by hand, save → overrides recorded */
  const ov = await p.evaluate(async () => {
    openForm("purchase", {}); await new Promise(z => setTimeout(z, 300));
    const auto = Object.keys(S.drawer.autoVal || {}); const k = auto.find(x => /date|ready|eta/i.test(x)) || auto[0]; if(!k) return { auto };
    const el = document.getElementById("f_" + k); const before = el.value; el.value = "2027-01-15"; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
    S.drawer.changed[k] = true;
    /* minimal required fields */
    const setIf = (f, v) => { const e = document.getElementById("f_" + f); if(e && !e.value){ e.value = v; e.dispatchEvent(new Event("change", { bubbles: true })); } };
    setIf("party", D.parties.find(x => x.type === "supplier")?.code); setIf("account", (SET().companies || [])[0]?.id);
    const rows = rowsOf("lines"); rows.length = 0; rows.push({ sku: D.products[0].sku, q: 10, u: 1, a: 10 }); redrawRows("lines"); S.drawer.changed["rows:lines"] = true;
    const id = await (async () => { try{ await freshNumberBeforeSave("purchase"); S.drawer.ack = true; await SAVE.purchase(); }catch(e){ return "ERR " + e.message; } return S.drawer ? (S.drawer.id || "saved") : "saved"; })();
    const rec = D.purchases.slice().sort((a, b) => (a.createdAt || "") < (b.createdAt || "") ? 1 : -1)[0];
    return { k, before, id, overrides: rec && rec.overrides, no: rec && rec.no };
  });
  ok(ov.overrides && ov.k && ov.overrides[ov.k] && ov.overrides[ov.k].auto === ov.before && ov.overrides[ov.k].value === "2027-01-15", "AUTO " + ov.k + " changed by hand → override logged (auto " + ov.before + " → 2027-01-15) on " + ov.no + " " + JSON.stringify(ov.overrides || ov));
  ok(!errs.length, "no page errors " + JSON.stringify(errs));
  console.log(fails ? fails + " FAILED" : "ALL PASS"); await b.close(); process.exit(fails ? 1 : 0);
})();
