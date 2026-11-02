// Public / marketplace formats on the owner's REAL files: kind recognised by header signature, rows counted,
// money / quantity totals computed (compared with tests/imp/expected.json, made by gen_expected.py from the raw files).
// Run: NODE_PATH=/opt/npm-tools/node_modules node tests/imp/t_market.js
const { open, upload, state, checker, run, att } = require("./h");
const X = require("./expected.json").market;
const { ck, done } = checker();
(async () => {
  const { br, pg, errs } = await open({ timeout: 60000 });
  const ev = (fn, a) => pg.evaluate(fn, a);
  const near = (a, b, t = 0.011) => a != null && b != null && Math.abs(a - b) <= t;
  const lines = (st, f) => (st.tot?.fields || []).find(x => x.f === f)?.lines;
  const totCard = async () => (await pg.textContent("#ix_tot").catch(() => "")) || "";
  const t = async (name, file, kind, rows, sums, extra) => {
    await upload(pg, att(file), { timeout: 60000 });
    const st = await state(pg);
    ck(`${name}: kind ${kind}`, st.kind === kind, `${st.kind} (${st.pct}%) src ${st.src || "—"}`);
    ck(`${name}: ${rows} rows counted`, st.tot && st.tot.rowsFile === rows, st.tot && `${st.tot.rowsFile} rows, importing ${st.tot.rowsImp}`);
    for (const [f, v] of Object.entries(sums)) ck(`${name}: ${f} lines total ${v}`, near(lines(st, f), v), lines(st, f));
    const card = await totCard();
    ck(`${name}: total check shown (file total vs import total)`, /Total check/.test(card) && /importing/.test(card), card.slice(0, 160));
    if (extra) await extra(st);
    return st;
  };
  await t("eBay orders", "093d1895-eBay-OrdersReport", "sales", X.ebay.rows, { qty: X.ebay.qty, total: X.ebay.total }, async st => {
    ck("eBay: channel NOT mapped to 'Sold via Promoted listings', status NOT 'Tax status'", st.map.channel !== "Sold via Promoted listings" && st.map.status !== "Tax status", st.map);
  });
  await t("Amazon VAT report", "fd2e3630-taxReport", "taxreport", X.tax.rows, { qty: X.tax.qty, taxIncl: X.tax.incl, taxAmt: X.tax.vat, taxExcl: X.tax.excl });
  await t("Amazon CustomTransaction", "18f77cd7-2026Jul1-2026Sep30CustomTransaction", "fees", X.ctx.rows, { qty: X.ctx.qty, sales: X.ctx.sales, sellingFee: X.ctx.selling, fbaFee: X.ctx.fba, net: X.ctx.total }, async st => ck("CustomTransaction: header found under the 9 note lines", st.hi === 9, st.hi));
  await t("Temu transactions (UK-Vartleaves-Reports csv)", "8b726475-UK-Vartleaves-Reports", "fees", X.temuTx.rows, { qty: X.temuTx.qty, sellingFee: X.temuTx.fee, net: X.temuTx.total }, async st => ck("Temu transactions: source recognised", st.src === "temu_tx", st.src));
  await upload(pg, att("42df34e4-UK-Vartleaves-Reports-2026_08_01"));
  { const st = await state(pg); ck("Temu transactions xlsx (August, header only): recognised, 0 rows, no crash", st.kind === "fees" && st.nData === 0 && st.nWrite === 0, [st.kind, st.nData]); }
  await t("Temu orders (extra commas)", "5f730a19-order_export", "sales", X.temu.rows, { qty: X.temu.qty, total: X.temu.total }, async st => {
    ck("Temu orders: quantity = 'quantity purchased' (built-in format map)", st.map.qty === "quantity purchased" && st.map.sku === "contribution sku", st.map);
    const n = await ev(() => S.imp.preview.rows.filter(r => r.why.some(w => /aligned from the right/.test(w.t))).length);
    ck(`Temu orders: ${X.temu.longRows} rows with extra commas re-aligned from the right`, n === X.temu.longRows, n);
    const c = await ev(() => S.imp.preview.rows.filter(r => r.why.some(w => /Order cancelled/.test(w.t))).length);
    ck(`Temu orders: ${X.temu.cancelled} cancelled orders left out`, c === X.temu.cancelled, c);
  });
  await t("Parcel2Go All_Orders", "a83f5ba6-All_Orders", "dispatch", X.p2g.rows, { total: X.p2g.value, weight: X.p2g.weight });
  await t("Amazon Ads statement_", "3b2171a0-statement_", "adsbill", X.ads.rows, { billedGbp: X.ads.billedGbp, paidGbp: X.ads.paidGbp, taxBilled: X.ads.taxGbp }, async st => {
    const im = await run(pg);
    ck("Amazon Ads: check record saved (IMP doc with totals, nothing else)", im.kind === "adsbill" && im.checkOnly && !im.moveIds.length && !im.docIds.length && im.totals.fields.some(f => near(f.lines, X.ads.paidGbp)), { kind: im.kind, totals: im.totals?.fields });
  });
  for (const [k, v] of Object.entries(X.br)) {
    const st = await t(`Business report ${k}`, k, "bizreport", v.rows, { units: v.units, sales: v.sales });
    if (k === "13f95492") ck("Business report: 9 toilet-brush ASINs linked to products by the ASIN table", (await ev(() => S.imp.preview.rows.filter(r => r.v?.sku).length)) >= 9, st.unk.length);
  }
  await t("Sales dashboard", "e79cc5cc-SalesDashboard", "dashboard", X.dash.days, { dunits: X.dash.units, dsales: X.dash.sales }, async st => {
    ck("Sales dashboard: snapshot total = sum of days ✅", st.tot.ok && st.tot.fields.find(f => f.f === "dunits").file === 4508, st.tot.fields);
    const im = await run(pg);
    const s = await ev(no => live(D.salesStats).find(x => x.import === no), im.no);
    ck("Sales dashboard: one marketplace stats record 4,508 units / £53,884.70", s && s.units === 4508 && near(s.sales, 53884.7) && s.from === "2026-07-01" && s.to === "2026-10-01", s && { units: s.units, sales: s.sales, from: s.from, to: s.to });
  });
  await done(br, errs);
})().catch(e => { console.error(e); process.exit(2) });
