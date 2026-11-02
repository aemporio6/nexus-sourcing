// Import page UI on real files: total check gate ("save anyway" + note), extra-columns panel + memory, several files at once
// (queue), Google Drive picker (folders, multi-select, filters, "only new", remembered folders) with a demo Drive,
// "Drive works when signed in" note, desktop 1366 px and phone 390 px screenshots without horizontal scroll.
// Run: NODE_PATH=/opt/npm-tools/node_modules node tests/imp/t_ui.js
const { open, upload, state, checker, run, att, SCR } = require("./h");
const fs = require("fs"), path = require("path");
const { ck, done } = checker();
const SHOTS = process.env.SHOTS || "/tmp/mt_imp_shots"; fs.mkdirSync(SHOTS, { recursive: true });
const FILES = { a: att("356dc2aa-CI_WAP-UK-JW20260805001_VARTLEAVES_1"), b: att("cf6ea72e-ROAD_SHIPPING"), c: att("1987e307-image.jpg"), d: att("1250c9b2-Freight_Invoice_SQ"), e: SCR + "/eco_pi/15b.xlsx" };
const TREE = {
  root: [{ id: "F1", name: "Suppliers", mimeType: "application/vnd.google-apps.folder" }, { id: "F2", name: "Forwarders", mimeType: "application/vnd.google-apps.folder" }],
  F1: [{ id: "F3", name: "Joyce", mimeType: "application/vnd.google-apps.folder" }],
  F3: [{ id: "a", name: "CI_WAP-UK-JW20260805001_VARTLEAVES.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", modifiedTime: "2026-10-30T10:00:00Z" },
       { id: "b", name: "ROAD SHIPPING-product information toilet brush.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", modifiedTime: "2026-10-30T10:00:00Z" },
       { id: "c", name: "payment receipt.jpg", mimeType: "image/jpeg", modifiedTime: "2026-10-30T10:00:00Z" }],
  F2: [{ id: "d", name: "Freight_Invoice_SQ-2026-0001_FBA15MNXZ6RBU.pdf", mimeType: "application/pdf", modifiedTime: "2026-10-30T10:00:00Z" }, { id: "e", name: "Eco PI 15b.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", modifiedTime: "2026-10-30T10:00:00Z" }],
  shared: []
};
const driveInit = `window.__DEMO_DRIVE={list:(p,o)=>Promise.resolve((${JSON.stringify(TREE)})[p]||[]),download:async id=>{const b=await window.__mtFile(id);const u=Uint8Array.from(atob(b),c=>c.charCodeAt(0));return new Blob([u])}};`;
(async () => {
  const { br, pg, errs } = await open({ init: driveInit, before: async p => p.exposeFunction("__mtFile", id => fs.readFileSync(FILES[id]).toString("base64")) });
  const ev = (fn, a) => pg.evaluate(fn, a);
  const toasts = []; await ev(() => { const t0 = window.toast; window.toast = (m, o) => { (window.__toasts = window.__toasts || []).push(m); return t0(m, o) } });
  const lastToast = () => ev(() => (window.__toasts || []).slice(-1)[0] || "");

  /* ---------- 1. total check gate on the Joyce CI (one cell changed → totals differ) ---------- */
  await upload(pg, FILES.a);
  await pg.click('#ix_cols [data-ixa="col"][data-h="material"][data-v="skip"]'); await pg.waitForTimeout(200);
  const e = await ev(() => { const sh = S.imp.sheets[S.imp.active]; return `0:0:${sh.map.qty}` });
  await pg.click(`td[data-act="impedit"][data-e="${e}"]`); await pg.waitForTimeout(150); await pg.fill("input.ixin", "250"); await pg.press("input.ixin", "Enter"); await pg.waitForTimeout(400);
  let st = await state(pg);
  ck("1 edited units 240→250: File total 2,274 ≠ Import total 2,284, ONE reason + fix shown", st.tot.ok === false && /not the sum of its lines/.test(st.tot.reason) && /Save anyway/.test(st.tot.fix) && await pg.isVisible("#ix_totbad"), st.tot.reason);
  const nImp = await ev(() => D.imports.length);
  await pg.click('[data-act="runimport"]'); await pg.waitForTimeout(400);
  ck("1 Import refused without 'save anyway' (toast says why)", (await ev(() => D.imports.length)) === nImp && /Not saved/.test(await lastToast()), await lastToast());
  await pg.check('[data-ixc="totack"]'); await pg.waitForTimeout(250);
  await pg.click('[data-act="runimport"]'); await pg.waitForTimeout(400);
  ck("1 'save anyway' ticked but no note → still refused", (await ev(() => D.imports.length)) === nImp && /note/.test(await lastToast()), await lastToast());
  await pg.fill('[data-ixc="totnote"]', "Supplier confirmed 250 Grey pack-1 on WeChat"); await pg.press('[data-ixc="totnote"]', "Tab"); await pg.waitForTimeout(200);
  let im = await run(pg);
  ck("1 saved anyway: IMP doc keeps the difference and the note", im.totals && im.totals.savedAnyway && /WeChat/.test(im.totals.note) && im.totals.fields.some(f => f.file === 2274 && f.imported === 2284), im.totals);
  ck("1 column choice remembered for this supplier format (Material → skip, Brand → keep)", await ev(() => { const c = Object.entries(SET().importMemory.cols || {}).find(([k]) => /joyce_ci/.test(k)); return c && c[1].material === "skip" && c[1].brand === "keep" }));
  await upload(pg, FILES.a);
  ck("1 next time the panel shows Material: skip (remembered)", await ev(() => { const I = S.imp, sh = I.sheets[I.active]; const i = sh.hn.indexOf("material"); const s = ixColState(I, sh, i); return s.a === "skip" && s.why === "remembered" }));
  await ev(() => impCancel()); await ev(no => undoImport(no), im.no); await pg.waitForTimeout(400);

  /* ---------- 2. desktop screenshot of the preview (1366 px) ---------- */
  await upload(pg, FILES.d);
  await pg.screenshot({ path: SHOTS + "/import_1366.png", fullPage: true });
  ck("2 desktop 1366: no horizontal scroll, side panel next to the preview", await ev(() => document.documentElement.scrollWidth <= innerWidth + 1 && getComputedStyle(document.querySelector(".ixlay")).gridTemplateColumns.split(" ").length === 2), await ev(() => [document.documentElement.scrollWidth, innerWidth]));
  await ev(() => impCancel());

  /* ---------- 3. several files at once (manual upload → queue) ---------- */
  await upload(pg, [FILES.e, FILES.c], { noWait: true });
  await pg.waitForFunction(() => S.impQ && S.impQ.items[0].st === "ready", null, { timeout: 30000 });
  ck("3 two files → queue, first one in preview", await pg.isVisible("#ix_queue") && (await ev(() => S.impQ.items.length)) === 2 && (await ev(() => S.imp.file)) === "15b.xlsx");
  im = await run(pg);
  await pg.waitForFunction(() => S.impQ.items.every(x => !["wait", "loading"].includes(x.st)), null, { timeout: 30000 });
  const q = await ev(() => S.impQ.items.map(x => x.st + ":" + (x.imp || "")));
  ck("3 queue: first imported (IMP no shown), photo → attach as proof only", q[0] === "imported:" + im.no && q[1] === "proof:", q);
  await ev(no => undoImport(no), im.no); await pg.waitForTimeout(300);
  await pg.click('[data-ixa="qclear"]');

  /* ---------- 4. Google Drive picker (demo Drive with the real files) ---------- */
  await ev(() => go("import", {}, { force: true }));
  await pg.click('[data-ixa="drive"]'); await pg.waitForSelector("#ix_drive .ixdi");
  ck("4 Drive panel lists My Drive folders", (await pg.textContent("#ix_drive")).includes("Suppliers") && (await pg.textContent("#ix_drive")).includes("Forwarders"));
  await pg.click('[data-ixa="drvopen"][data-id="F1"]'); await pg.waitForSelector('[data-ixc="drvself"][data-id="F3"]');
  await pg.check('[data-ixc="drvself"][data-id="F3"]');
  await pg.click('[data-ixa="drvroot"]'); await pg.waitForSelector('[data-ixa="drvopen"][data-id="F2"]');
  await pg.click('[data-ixa="drvopen"][data-id="F2"]'); await pg.waitForSelector('[data-ixc="drvsel"][data-id="d"]');
  await pg.check('[data-ixc="drvsel"][data-id="d"]'); await pg.waitForTimeout(150);
  ck("4 multi-select across folders: 1 folder + 1 file", /Import selected \(2\)/.test(await pg.textContent('[data-ixa="drvimport"]')));
  await pg.selectOption('[data-ixc="drvtype"]', "pack"); await pg.waitForTimeout(150);
  ck("4 file-type filter hides the PDF when 'Packing info' is chosen", !(await pg.$('[data-ixc="drvsel"][data-id="d"]')));
  await pg.selectOption('[data-ixc="drvtype"]', "all"); await pg.waitForTimeout(150);
  await pg.click('[data-ixa="drvimport"]');
  await pg.waitForFunction(() => S.impQ && S.impQ.items.length === 4 && S.impQ.items[0].st === "ready", null, { timeout: 30000 });
  ck("4 queue built: the PDF + 3 files from the ticked folder", (await ev(() => S.impQ.items.map(x => x.name).join("|"))).split("|").length === 4 && (await ev(() => S.imp.fixed?.fmt)) === "fwd_invoice");
  await pg.click('[data-ixa="qskip"]');
  await pg.waitForFunction(() => S.impQ.items[1].st === "ready", null, { timeout: 30000 });
  ck("4 skip → next file (CI) downloaded and in preview", (await ev(() => S.imp.fixed?.fmt)) === "joyce_ci");
  const imCI = await run(pg);
  await pg.waitForFunction(() => S.impQ.items[2].st === "ready", null, { timeout: 30000 });
  ck("4 after Import the queue goes on with the packing list", (await ev(() => S.imp.fixed?.fmt)) === "packing_info");
  const imPK = await run(pg);
  await pg.waitForFunction(() => S.impQ.items.every(x => !["wait", "loading", "ready"].includes(x.st)), null, { timeout: 30000 });
  const q2 = await ev(() => S.impQ.items.map(x => x.st));
  ck("4 statuses per file: skipped · imported · imported · proof", q2.join() === "skipped,imported,imported,proof", q2);
  ck("4 Drive folders + time of import remembered in Setup", await ev(() => { const d = SET().importMemory.drive; return d.folders.some(f => f.id === "F3") && !!d.last.F3 }));
  await pg.click('[data-ixa="drive"]'); await pg.waitForSelector('[data-ixa="drvgo"][data-id="F3"]');
  ck("4 'Last folders' shows Joyce", (await pg.textContent('[data-ixa="drvgo"][data-id="F3"]')).includes("Joyce"));
  await pg.click('[data-ixa="drvgo"][data-id="F3"]'); await pg.waitForTimeout(400);
  ck("4 'only new since last import' hides the files already imported", /3 files hidden by the filters/.test(await pg.textContent("#ix_drive")), (await pg.textContent("#ix_drive")).slice(-200));
  await pg.selectOption('[data-ixc="drvnew"]', "0"); await pg.waitForTimeout(200);
  ck("4 'all files' shows them again", (await pg.$$('[data-ixc="drvsel"]')).length === 3);
  await pg.click('[data-ixa="drvclose"]');
  for (const no of [imPK.no, imCI.no]) { await ev(n => undoImport(n), no); await pg.waitForTimeout(300) }

  /* ---------- 5. phone 390 px ---------- */
  const ph = await br.newPage({ viewport: { width: 390, height: 844 } });
  await ph.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  ph.on("pageerror", e => errs.push("PAGEERROR(phone) " + e.message));
  await ph.goto(process.env.MT_URL || "http://localhost:8097/index.html?demo");
  await ph.waitForFunction(() => { try { return S.ready } catch (e) { return false } }, null, { timeout: 30000 });
  await ph.evaluate(() => go("import", {}, { force: true }));
  await ph.click('[data-ixa="drive"]'); await ph.waitForTimeout(200);
  ck("5 without a signed-in Drive: friendly note", /Drive works when signed in/.test(await ph.textContent("#ix_drive")));
  for (const [f, n] of [[FILES.a, "ci"], [FILES.d, "freight"]]) {
    await upload(ph, f);
    await ph.screenshot({ path: `${SHOTS}/import_390_${n}.png`, fullPage: true });
    const w = await ph.evaluate(() => [document.documentElement.scrollWidth, innerWidth, document.querySelector("#ix_cols").getBoundingClientRect().width]);
    ck(`5 phone 390 (${n}): no horizontal scroll, extra-columns panel stacked full width`, w[0] <= w[1] + 1 && w[2] <= 390, w);
  }
  await done(br, errs);
})().catch(e => { console.error(e); process.exit(2) });
