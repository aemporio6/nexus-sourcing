// Amazon All Listings report (real file): ASIN ↔ SKU, ASIN saved on products, unknown listings → one question each, answers remembered.
// Run: NODE_PATH=/opt/npm-tools/node_modules node tests/imp/t_listings.js
const { open, upload, state, checker, run, att } = require("./h");
const X = require("./expected.json").market.listings;
const { ck, done } = checker();
const MAP = { B0CCPPFZCT: "WAL-TB-FBA-01", B0C6QY4HGJ: "WAL-TB-FBM-01", B0CDYH3KJ3: "WAL-TB-FBA-04", B0DT1YPSYN: "WAL-TB-GRY-01", B0DT1P77DP: "WAL-TB-GRY-02", B0DT257LR5: "WAL-TB-GRY-03", B0D33S5PQW: "WAL-TB-BLK-01", B0D33PPM3C: "WAL-TB-BLK-02", B0D33QY8GY: "WAL-TB-BLK-04" };
(async () => {
  const { br, pg, errs } = await open();
  const ev = (fn, a) => pg.evaluate(fn, a);
  await upload(pg, att("a12acd78-All_Listings_Report"));
  let st = await state(pg);
  ck("kind = Amazon All Listings", st.kind === "listings" && st.src === "amazon_listings", st.kind);
  ck(`${X.rows} listings read (the file has ${X.rows} data rows)`, st.tot.rowsFile === X.rows, st.tot.rowsFile);
  const known = Object.keys(MAP), unknownAsins = X.asins.filter(a => !known.includes(a));
  ck(`${unknownAsins.length} unknown ASINs → one question each`, st.unk.length === unknownAsins.length && st.unk.every(u => u.key.startsWith("sku|B0")), st.unk.length);
  const rows = await ev(() => S.imp.preview.rows.filter(r => r.v?.sku).map(r => [r.v.asin, r.v.sku]));
  ck("every listing of the 9 known ASINs maps to the right SKU (incl. amzn.gr.* and FBM copies)", rows.length === 16 && rows.every(([a, s]) => MAP[a] === s), rows);
  // answer one question in the UI (Dehumidifier 1pc), skip the rest
  await pg.selectOption('[data-ixc="pick"][data-key="sku|B0GHGCKGX4"]', "LMN-DHB-1PC"); await pg.waitForTimeout(250);
  await pg.click('[data-act="impgroup"][data-type="sku"][data-do="skip"]'); await pg.waitForTimeout(400);
  st = await state(pg);
  ck("after the answers nothing is undecided", st.unk.every(u => u.dec), st.unk.filter(u => !u.dec).length);
  const im = await run(pg);
  const p = await ev(m => Object.entries(m).map(([a, s]) => [a, product(s).asin, (product(s).listings || []).length]), MAP);
  ck("ASIN saved on all 9 products", p.every(([a, b]) => a === b), p);
  ck("listings (seller SKU + ASIN) stored on the products", p.every(([, , n]) => n >= 1) && (await ev(() => (product("WAL-TB-BLK-04").listings || []).map(l => l.sku))).includes("TB4 - Black - FBM"), await ev(() => product("WAL-TB-BLK-04").listings));
  ck("Dehumidifier answer saved: LMN-DHB-1PC has ASIN B0GHGCKGX4", await ev(() => product("LMN-DHB-1PC").asin === "B0GHGCKGX4" || (product("LMN-DHB-1PC").listings || []).some(l => l.id === "B0GHGCKGX4")));
  ck("seller SKUs remembered as SKU aliases", await ev(() => SET().skuAliases["VAL-FBA-TOILET-BRUSH-1"] === "WAL-TB-FBA-01" && SET().skuAliases["TB 1-Grey-FBA"] === "WAL-TB-GRY-01"));
  await upload(pg, att("a12acd78-All_Listings_Report"));
  st = await state(pg);
  ck("re-import: no question asked again (answers remembered), nothing new to write", st.unk.filter(u => !u.dec).length === 0 && st.nWrite === 0, { unk: st.unk.length, nWrite: st.nWrite, sum: st.summary });
  await ev(() => impCancel());
  await ev(no => undoImport(no), im.no); await pg.waitForTimeout(500);
  ck("undo removes the listings again", (await ev(() => (product("WAL-TB-GRY-01").listings || []).length)) === 0);
  await done(br, errs);
})().catch(e => { console.error(e); process.exit(2) });
