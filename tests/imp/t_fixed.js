// Fixed-format readers on the owner's REAL files, through the real Import page (file input → preview → Import → Undo).
// Run: tests/demo.sh /tmp/mt_imp 8097 ; NODE_PATH=/opt/npm-tools/node_modules node tests/imp/t_fixed.js
const { open, upload, state, checker, run, att, SCR } = require("./h");
const { ck, done } = checker();
(async () => {
  const { br, pg, errs } = await open();
  const ev = (fn, a) => pg.evaluate(fn, a);
  const dec = async (key, d) => { await pg.click(`[data-act="impdec"][data-key="${key}"][data-do="${d}"]`); await pg.waitForTimeout(200) };
  const near = (a, b, t = 0.006) => a != null && Math.abs(a - b) <= t;
  const tot = (st, f) => (st.tot?.fields || []).find(x => x.f === f) || {};

  /* ---------- A. Joyce commercial invoice → part of PO-26-0065 (VAL-104) ---------- */
  const nPO0 = await ev(() => live(D.purchases).length);
  await upload(pg, att("356dc2aa-CI_WAP-UK-JW20260805001_VARTLEAVES_1"));
  let st = await state(pg);
  ck("A CI recognised (fixed format, kind cipart)", st.fmt === "joyce_ci" && st.kind === "cipart", st.fmt + " " + st.kind);
  ck("A 3 lines (Blank Template + Instructions sheets ignored)", st.nData === 3 && st.counts.ok + st.counts.warn === 3, st.counts);
  const m = st.fixed.meta;
  ck("A invoice no WAP-UK-JW20260805001", m.piNo === "WAP-UK-JW20260805001", m.piNo);
  ck("A 78 ctn · 2,274 units", m.ctn === 78 && m.units === 2274, [m.ctn, m.units]);
  ck("A goods ¥37,148.40", near(m.goods, 37148.40), m.goods);
  ck("A fee 4% ¥1,485.94", m.feePct === 4 && near(m.fee, 1485.94), [m.feePct, m.fee]);
  ck("A total ¥38,634.34 · paid ¥11,590.30 · due ¥27,044.04", near(m.total, 38634.34) && near(m.paid, 11590.30) && near(m.due, 27044.04), [m.total, m.paid, m.due]);
  ck("A currency RMB, supplier SUP-001 (Joyce)", m.cur === "RMB" && st.def.party === "SUP-001", [m.cur, st.def.party]);
  ck("A totals: file = import for ctn / units / amount ✅", tot(st, "ctn").ok && tot(st, "qty").ok && tot(st, "amount").ok && tot(st, "qty").file === 2274, st.tot.fields.map(f => `${f.f}:${f.file}=${f.imp}`));
  ck("A document checks all pass (subtotal, fee, total, paid+due)", st.fixed.checks.filter(c => !c.warnOnly).every(c => c.ok) && st.fixed.checks.length >= 4, st.fixed.checks.map(c => c.l + ":" + c.ok));
  ck("A linked to PO-26-0065 (VAL-104), not PO-26-0066", st.def.po === "PO-26-0065", st.def.po);
  ck("A summary says PART, no new order", st.summary.some(s => /PO-26-0065 \(VAL-104\) · linked as a PART/.test(s)), st.summary);
  ck("A ASINs resolved: Grey1 / White2 / White4", (await ev(() => S.imp.preview.rows.map(r => r.v.sku))).join() === "WAL-TB-GRY-01,WAL-TB-FBM-01,WAL-TB-FBA-04");
  const cols = await ev(() => { const I = S.imp, sh = I.sheets[I.active]; return ixUnused(I, sh).map(([h, i]) => h + ":" + ixColState(I, sh, i).a + ":" + ixColState(I, sh, i).why) });
  ck("A extra columns: Brand + Material kept, Carton No. skipped (serial), Picture skipped (empty)", cols.includes("Brand:keep:has data") && cols.includes("Material:keep:has data") && cols.some(c => /^Carton No\.:skip:serial/.test(c)) && cols.includes("Picture:skip:empty"), cols);
  ck("A side panel rendered with keep / skip toggles", await pg.isVisible('#ix_cols [data-ixa="col"][data-v="keep"]'));
  let im = await run(pg);
  const po = await ev(() => D.purchases.find(p => p.no === "PO-26-0065"));
  const part = (po.parts || [])[0] || {};
  ck("A import wrote ONE update (no new PO)", (await ev(() => live(D.purchases).length)) === nPO0 && im.updates.some(u => u.id === "PO-26-0065"), [nPO0, im.updates.map(u => u.id)]);
  ck("A part stored on PO-26-0065 with all numbers", part.no === "WAP-UK-JW20260805001" && part.ctn === 78 && part.units === 2274 && near(part.goods, 37148.4) && near(part.fee, 1485.94) && near(part.total, 38634.34) && near(part.paid, 11590.3) && near(part.due, 27044.04) && part.lines.length === 3, { no: part.no, ctn: part.ctn, units: part.units, goods: part.goods, total: part.total });
  ck("A part lines map to PO lines by unit price", part.lines.map(l => l.poLine).join() === "0,1,2", part.lines.map(l => l.poLine));
  ck("A PO total / schedule untouched (a part is not a new order)", near(po.total, 313513.824, 0.01), po.total);
  ck("A Brand / Material created as custom fields in Setup › Forms › purchase", await ev(() => { const cu = SET().forms?.purchase?.custom || []; return ["brand", "material"].every(s => cu.some(f => f.src === s)) }));
  ck("A kept values stored on the part lines", JSON.stringify(part.lines[0].custom || {}).includes("VARTLEAVES") && JSON.stringify(part.custom || {}).includes("PP + TPR"), part.lines[0].custom);
  ck("A IMP doc keeps the total check", im.totals?.ok === true && im.totals.fields.some(f => f.file === 2274), im.totals);
  ck("A ASIN saved on the products", (await ev(() => ["WAL-TB-GRY-01", "WAL-TB-FBM-01", "WAL-TB-FBA-04"].map(s => product(s).asin))).join() === "B0DT1YPSYN,B0C6QY4HGJ,B0CDYH3KJ3");
  await upload(pg, att("356dc2aa-CI_WAP-UK-JW20260805001_VARTLEAVES_1"));
  st = await state(pg);
  ck("A re-import: already linked, nothing written", st.nWrite === 0 && st.rows.every(r => /Already on PO-26-0065/.test(r)), st.summary);
  ck("A re-import: column choices remembered for this format", (await ev(() => { const I = S.imp, sh = I.sheets[I.active]; return ixUnused(I, sh).map(([h, i]) => h + ":" + ixColState(I, sh, i).why) })).includes("Brand:remembered"));
  await ev(() => impCancel());
  await ev(no => undoImport(no), im.no); await pg.waitForTimeout(500);
  ck("A undo removes the part", !((await ev(() => D.purchases.find(p => p.no === "PO-26-0065").parts)) || []).length);

  /* ---------- B. product / packing information (ROAD, 9 products) ---------- */
  await upload(pg, att("cf6ea72e-ROAD_SHIPPING"));
  st = await state(pg);
  ck("B packing info recognised", st.fmt === "packing_info" && st.kind === "packinfo", st.fmt);
  ck("B 9 products by ASIN, all matched", st.nData === 9 && (await ev(() => S.imp.preview.rows.filter(r => r.v.sku).length)) === 9, st.counts);
  ck("B totals 99 ctn · 2,952 pcs · 1,920.5 kg · 6.772608 CBM (file = import)", tot(st, "ctn").file === 99 && tot(st, "qty").file === 2952 && near(tot(st, "kg").file, 1920.5) && near(tot(st, "cbm").file, 6.772608, 1e-6) && ["ctn", "qty", "kg", "cbm"].every(f => tot(st, f).ok), st.tot.fields.map(f => `${f.f}:${f.file}=${f.imp}`));
  ck("B no HS warning (9603909090 is the detailed form of 9603.90)", st.counts.warn === 0, st.rows);
  im = await run(pg);
  const g1 = await ev(() => product("WAL-TB-GRY-01"));
  ck("B carton data on WAL-TB-GRY-01: 60/ctn, 48×44×36 cm, 18.5 kg, HS 9603909090", g1.perCtn === 60 && g1.ctn.L === 48 && g1.ctn.W === 44 && g1.ctn.H === 36 && g1.ctn.kg === 18.5 && String(g1.hs) === "9603909090", { perCtn: g1.perCtn, ctn: g1.ctn, hs: g1.hs });
  ck("B pack size + weight read from text (21×11.5×4.5 cm, 0.241 kg)", g1.pk?.L === 21 && g1.pk?.W === 11.5 && near(g1.pk?.kg, 0.2405, 0.001), g1.pk);
  ck("B 4-pack: 18/ctn, 19 kg", (await ev(() => product("WAL-TB-BLK-04").perCtn)) === 18 && (await ev(() => product("WAL-TB-BLK-04").ctn.kg)) === 19);
  ck("B material / specification kept as product custom fields", JSON.stringify(g1.custom || {}).includes("PP+TPR"), g1.custom);
  await ev(no => undoImport(no), im.no); await pg.waitForTimeout(500);
  ck("B undo restores the product", (await ev(() => product("WAL-TB-GRY-01").perCtn)) !== 60 || (await ev(() => product("WAL-TB-GRY-01").ctn?.L)) !== 48);

  /* ---------- C. packing information SEA (3 products, 78 ctn) ---------- */
  await upload(pg, att("f3eb1e49-to_AMAZON_2274packs78ctns"));
  st = await state(pg);
  ck("C 3 products · 78 ctn · 2,274 pcs · 1,519 kg · 5.39136 CBM", st.nData === 3 && tot(st, "ctn").file === 78 && tot(st, "qty").file === 2274 && tot(st, "kg").file === 1519 && near(tot(st, "cbm").file, 5.39136, 1e-6) && st.tot.ok, st.tot.fields.map(f => `${f.f}:${f.file}=${f.imp}`));
  await ev(() => impCancel());

  /* ---------- D. Shunqi freight invoice (text PDF via pdf.js) ---------- */
  const nSh0 = await ev(() => live(D.shipments).length);
  await upload(pg, att("1250c9b2-Freight_Invoice_SQ-2026-0001"));
  st = await state(pg);
  ck("D PDF read with pdf.js (fixed format fwd_invoice → shipment)", st.fmt === "fwd_invoice" && st.kind === "shipments" && (await ev(() => !!window.pdfjsLib)), st.fmt);
  const dm = st.fixed.meta;
  ck("D Shunqi · truck · DDP · SQ-2026-0001 · FBA15MNXZ6RBU · BHX4", /Shunqi/.test(dm.partyRaw) && /truck/i.test(dm.mode) && dm.incoterm === "DDP" && dm.invoiceNo === "SQ-2026-0001" && dm.fbaId === "FBA15MNXZ6RBU" && dm.fc === "BHX4", dm);
  ck("D dates: ETD 16/10/2026, ETA 10/12/2026, invoice 19/10/2026", dm.etd === "2026-10-16" && dm.eta === "2026-12-10" && dm.date === "2026-10-19", [dm.etd, dm.eta, dm.date]);
  ck("D 9 lines", st.nData === 9);
  ck("D file totals 99 ctn · 2,952 units · 1,920.5 kg · $4,033.05", tot(st, "ctn").file === 99 && tot(st, "qty").file === 2952 && near(tot(st, "kg").file, 1920.5) && near(tot(st, "cost").file, 4033.05), st.tot.fields.map(f => `${f.f}:${f.file}`));
  ck("D invoice arithmetic checks pass", st.fixed.checks.filter(c => !c.warnOnly).every(c => c.ok) && st.fixed.checks.length >= 11);
  const pk = st.unk.find(u => u.key.startsWith("party|"));
  ck("D unknown forwarder → ONE decision card (Shunqi is not in the app yet)", pk && pk.n === 9 && st.unk.length === 1, st.unk);
  ck("D before the decision: totals differ with ONE reason + fix, Import refused", st.tot.ok === false && /left out/.test(st.tot.reason) && /decide the values above/.test(st.tot.fix));
  await dec(pk.key, "new");
  st = await state(pg);
  ck("D after creating the forwarder: File total = Import total ✅", st.tot.ok && st.counts.err === 0, st.tot.reason);
  im = await run(pg);
  const sh = await ev(() => live(D.shipments).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1)[0]);
  ck("D one new shipment", (await ev(() => live(D.shipments).length)) === nSh0 + 1);
  ck("D shipment: $4,033.05 USD · 99 ctn · 1,920.5 kg · truck · DDP", near(sh.cost, 4033.05) && sh.costCur === "USD" && sh.ctn === 99 && near(sh.kg, 1920.5) && sh.mode === "truck" && sh.incoterm === "DDP", { cost: sh.cost, cur: sh.costCur, ctn: sh.ctn, kg: sh.kg, mode: sh.mode, inco: sh.incoterm });
  ck("D 9 lines with SKUs, 2,952 units", sh.lines.length === 9 && sh.lines.every(l => l.sku) && sh.lines.reduce((s, l) => s + l.q, 0) === 2952, sh.lines.map(l => l.sku + ":" + l.q));
  ck("D FBA id + FC kept, ETA 2026-12-10, invoice no", sh.destinations?.[0]?.fbaId === "FBA15MNXZ6RBU" && sh.destinations[0].fc === "BHX4" && sh.eta === "2026-12-10" && sh.fwdInvNo === "SQ-2026-0001", { dest: sh.destinations, eta: sh.eta, inv: sh.fwdInvNo });
  ck("D new forwarder party created (type forwarder)", await ev(no => { const s = D.shipments.find(x => x.no === no); return party(s.party)?.type === "forwarder" && /Shunqi/.test(party(s.party).name) }, sh.no));
  /* the ROAD packing list now offers to fill that shipment's lines (same 99 cartons) */
  await ev(no => updateDoc("shipments", no, { lines: [] }, null, { quiet: true }), sh.no); await pg.waitForTimeout(200);
  await upload(pg, att("cf6ea72e-ROAD_SHIPPING"));
  st = await state(pg);
  ck("D→B packing list suggests the Shunqi shipment (same 99 ctn / 1,920.5 kg)", st.def.sh === sh.no, st.def.sh);
  await ev(() => impCancel());
  await ev(no => undoImport(no), im.no); await pg.waitForTimeout(500);
  ck("D undo trashes the shipment and the new party", await ev(no => !!D.shipments.find(x => x.no === no)?.deletedAt, sh.no));

  /* ---------- E. scanned PDF / photo / unknown PDF → proof only, no crash ---------- */
  for (const [f, re] of [[att("1987e307-image.jpg"), /picture/], [require("path").join(__dirname, "fixtures/scanned.pdf"), /scanned/], [att("37aa87d8-WUL-INV-SLF-2026-0000023777.pdf"), /not known yet/]]) {
    await ev(() => { window.__lastToast = null; const t0 = window.toast; if (!window.__tw) { window.__tw = 1; window.toast = (m, o) => { window.__lastToast = m; return t0(m, o) } } });
    await upload(pg, f, { noWait: true }); await pg.waitForFunction(() => window.__lastToast, null, { timeout: 20000 });
    const msg = await ev(() => window.__lastToast);
    ck(`E ${require("path").basename(f)} → attach as proof only`, re.test(msg) && /proof/.test(msg) && !(await ev(() => S.imp)), msg);
  }
  await done(br, errs);
})().catch(e => { console.error(e); process.exit(2) });
