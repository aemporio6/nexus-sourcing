// Planner (ICC) test. Run: tests/demo.sh /tmp/mt_icc 8096 && NODE_PATH=/opt/npm-tools/node_modules node tests/icc/t_icc.js [shotDir]
const { chromium } = require("playwright");
const URL_ = process.env.ICC_URL || "http://localhost:8096/index.html?demo";
const SHOTS = process.argv[2] || "/tmp/mt_icc/shots";
require("fs").mkdirSync(SHOTS, { recursive: true });
const rows = []; let fails = 0;
const check = (name, expected, got, ok) => { ok = ok === undefined ? String(expected) === String(got) : ok; rows.push({ name, expected: String(expected), got: String(got), ok }); if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + name + " | expected " + expected + " | got " + got); };

async function open(browser, vp) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  const failed = []; page.on("requestfailed", r => failed.push(r.url()));
  page.on("console", m => { if (m.type() !== "error") return; if (/Failed to load resource/.test(m.text()) && failed.length && failed.every(u => /fonts\.(googleapis|gstatic)/.test(u))) return; errs.push("console: " + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(URL_);
  await page.waitForFunction(() => { try { return S.ready } catch (e) { return false } }, null, { timeout: 30000 });
  await page.evaluate(() => { S.icc = null; go("planner"); });
  await page.waitForSelector("#icc_out");
  return { ctx, page, errs };
}
const txt = (page, sel) => page.$eval(sel, e => e.textContent.trim()).catch(() => "(missing)");
const setSel = async (page, sel, v) => { await page.selectOption(sel, v); await page.waitForTimeout(80); };
const typeIn = async (page, sel, v) => { await page.fill(sel, String(v)); await page.waitForTimeout(60); };
const change = async (page, sel, v) => { await page.fill(sel, String(v)); await page.$eval(sel, e => e.dispatchEvent(new Event("change", { bubbles: true }))); await page.waitForTimeout(120); };

(async () => {
  const browser = await chromium.launch();
  const { page, errs } = await open(browser, { width: 1366, height: 900 });

  /* 1. sanity example: new product, 2,000/month, sea, 60-day cycle */
  await page.click('[data-icc-act="src"][data-v="new"]');
  await typeIn(page, "#icc_nname", "Test brush");
  await setSel(page, "#icc_smode", "month");
  await typeIn(page, "#icc_month", "2000");
  await setSel(page, "#icc_cycle", "60");
  check("per day from 2,000/month", "66.67", await txt(page, '[data-r="perday"]'));
  check("sea lead time (days)", 105, await page.evaluate(() => S._iccM.L.lead));
  check("sea reorder point", "7,933", await txt(page, '[data-r="rop"]'));
  check("60-day order quantity", "4,000", await txt(page, '[data-r="qty"]'));
  check("air reorder point (compare table)", "4,933", await txt(page, '[data-r="rop-ship_air"]'));
  check("order-by colour with no stock", "🔴", (await txt(page, '[data-tone="orderby"]')).slice(0, 2));

  /* 2. paste parsing + carton maths */
  await change(page, '[data-icc-paste="dims.__new.item"]', "21*11.5*4.5cm 200g");
  check("paste 21*11.5*4.5cm 200g", "21,11.5,4.5,200", await page.evaluate(() => { const d = S.icc.dims.__new.item; return [d.L, d.W, d.H, d.g].join(",") }));
  await change(page, '[data-icc-paste="dims.__new.pk"]', "22x12x5 cm 1.2kg");
  check("paste 1.2kg into grams field", "1200", await page.evaluate(() => S.icc.dims.__new.pk.g));
  await change(page, "#icc_perctn", "48");
  await change(page, '[data-icc-paste="dims.__new.ctn"]', "57*40*30cm 19.4kg");
  check("CBM per carton 57×40×30", "0.0684 CBM", await txt(page, '[data-r="cbmctn"]'));
  check("volumetric per carton ÷6000", "11.4 kg", await txt(page, '[data-r="volctn"]'));
  check("cartons for 4,000 @48 (rounded up)", "84", await txt(page, '[data-r="ctn"]'));
  check("order qty rounded to cartons", "4,032", await txt(page, '[data-r="qty"]'));
  // real road shipment: 99 ctn, 1,920.5 kg, 6.772608 CBM (packing list totals)
  await page.click('[data-mode="ship_road"] [data-icc-act="usemode"]'); await page.waitForTimeout(100);
  await page.$eval("#icc_res", e => e.scrollIntoView());
  await page.evaluate(() => document.querySelectorAll("details.how").forEach(d => { if (d.querySelector('[data-icc-paste="ov"]')) d.open = true }));
  await change(page, '[data-icc-paste="ov"]', "99 ctns 1,920.5 kg 6.772608 cbm");
  check("road: cartons", "99", await txt(page, '[data-r="ctn"]'));
  check("road: total CBM", "6.772608", await txt(page, '[data-r="cbm"]'));
  check("road: actual kg", "1,920.5", await txt(page, '[data-r="kg"]'));
  check("road: volumetric kg (÷6000)", "1,128.77", await txt(page, '[data-r="vol"]'));
  check("road: chargeable", "1,920.5 kg", await txt(page, '[data-r="chg"]'));
  check("road: freight @ $2.10/kg", "$4,033.05", (await txt(page, '[data-r="freight"]')).split(" ")[0]);
  check("road lead time (days)", 75, await page.evaluate(() => S._iccM.L.lead));
  check("avg kg / CBM per carton", "19.4 kg · 0.0684 CBM", await page.evaluate(() => { const m = S._iccM.ship; return (m.kg / m.ctn).toFixed(1) + " kg · " + (m.cbm / m.ctn).toFixed(4) + " CBM" }));
  await page.click('[data-icc-act="clearov"]'); await page.waitForTimeout(100);
  await page.click('[data-mode="ship_sea"] [data-icc-act="usemode"]'); await page.waitForTimeout(100);

  /* 3. date colours via stock at Amazon (d = 66.67, ROP = 7,933.3) */
  for (const [stock, emoji, label] of [[11934, "🟢", "60 d away"], [9267, "🟡", "20 d away"], [8267, "🟠", "5 d away"], [0, "🔴", "past"]]) {
    await typeIn(page, '[data-icc="per.__new.amazon"]', stock);
    check(`order-by colour ${label}`, emoji, (await txt(page, '[data-tone="orderby"]')).slice(0, 2));
  }
  await typeIn(page, '[data-icc="per.__new.amazon"]', 11934);
  check("out-of-stock date colour (179 d)", "🟢", (await txt(page, '[data-tone="oos"]')).slice(0, 2));

  /* 4. validation with one-click fix: 2000 typed as per day */
  await setSel(page, "#icc_smode", "day");
  await typeIn(page, "#icc_day", "2000");
  const fixBtn = await page.$('#icc_checks button:has-text("per month")');
  check("suggests per-month for 2,000/day", "fix shown", fixBtn ? "fix shown" : "no fix");
  if (fixBtn) { await fixBtn.click(); await page.waitForTimeout(120); }
  check("fix applied → 66.67/day", "66.67", await txt(page, '[data-r="perday"]'));
  // grams typed as kg
  await change(page, '[data-icc="dims.__new.item.g"]', "0.2");
  const gfix = await page.$('#icc_checks button:has-text("200 g")');
  check("suggests 200 g for 0.2", "fix shown", gfix ? "fix shown" : "no fix");
  if (gfix) { await gfix.click(); await page.waitForTimeout(100); }
  check("grams fixed", "200", await page.evaluate(() => S.icc.dims.__new.item.g));

  /* 5. create PO from new product plan */
  await page.click('[data-icc-act="po"]');
  await page.waitForTimeout(500);
  const po1 = await page.evaluate(() => ({ form: S.drawer?.form, lines: (S.drawer?.rows?.lines || []).map(l => [l.p, l.q]) }));
  check("PO form opens (new product)", "purchase", po1.form);
  check("PO line = Test brush × 4,032", "Test brush × 4032", po1.lines.map(l => l[0] + " × " + l[1]).join("; "));
  await page.evaluate(() => { S.drawer = null; render(); go("planner"); }); await page.waitForTimeout(200);

  /* 6. multi-SKU: all toilet brushes, 2,000/month split */
  await page.click('[data-icc-act="src"][data-v="app"]');
  await page.click('[data-icc-act="group"][data-g="TB"]'); await page.waitForTimeout(200);
  const n = await page.evaluate(() => S.icc.skus.length);
  check("toilet-brush group selected", "10", n);
  await setSel(page, "#icc_smode", "month");
  await typeIn(page, "#icc_month", "2000");
  const split = await page.evaluate(() => S._iccM.rows.map(r => r.d));
  check("split sums to 66.67/day", "66.67", split.reduce((a, b) => a + b, 0).toFixed(2));
  check("no sales data → equal split", (66.6667 / n).toFixed(3), split[0].toFixed(3));
  const k0 = await page.evaluate(() => S._iccM.rows[0].key);
  await typeIn(page, `[data-icc="per.${k0}.day"]`, "30");
  const split2 = await page.evaluate(() => S._iccM.rows.map(r => r.d));
  check("typed row kept, rest share remainder", `30 / ${((66.6667 - 30) / (n - 1)).toFixed(3)}`, `${split2[0]} / ${split2[1].toFixed(3)}`);
  check("shares column total 100%", "100.0", await page.evaluate(() => (S._iccM.rows.reduce((a, r) => a + r.pct, 0) * 100).toFixed(1)));
  check("per-product table rows", String(n), await page.$$eval("#icc_per tbody tr", t => t.length));
  await page.screenshot({ path: SHOTS + "/icc_desktop.png", fullPage: true });
  await page.click('[data-icc-act="po"]'); await page.waitForTimeout(500);
  const po2 = await page.evaluate(() => ({ form: S.drawer?.form, lines: (S.drawer?.rows?.lines || []).filter(l => l.sku).length, party: document.querySelector("#f_party")?.value || "" }));
  check("PO form opens (multi-SKU) with one line per SKU", `purchase ${n}`, `${po2.form} ${po2.lines}`);
  await page.screenshot({ path: SHOTS + "/icc_po_prefill.png" });
  await page.evaluate(() => { S.drawer = null; render(); go("planner"); }); await page.waitForTimeout(200);

  /* 7. save plan + setup lists */
  await typeIn(page, "#icc_pname", "TB test plan");
  await page.click('[data-icc-act="save"]'); await page.waitForTimeout(400);
  check("plan saved in setup.plans", "TB test plan", await page.evaluate(() => (SET().plans || []).map(p => p.name).join(",")));
  check("Setup list leadStage created", "true", await page.evaluate(() => !!SET().lists?.leadStage && !!SET().lists?.packType));
  await page.evaluate(() => { S.icc = null; go("home"); go("planner"); }); await page.waitForTimeout(200);
  await page.selectOption("[data-icc-plan]", { index: 1 }); await page.waitForTimeout(200);
  check("saved plan re-opens", "10 / 30", await page.evaluate(() => S.icc.skus.length + " / " + S._iccM.rows[0].d));

  /* 8. phone 390px */
  const ph = await open(browser, { width: 390, height: 844 });
  await ph.page.click('[data-icc-act="src"][data-v="app"]');
  await ph.page.click('[data-icc-act="group"][data-g="TB"]'); await ph.page.waitForTimeout(150);
  await setSel(ph.page, "#icc_smode", "month"); await typeIn(ph.page, "#icc_month", "2000");
  const sw = await ph.page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  check("phone 390: no horizontal page scroll", "≤ " + sw[1], sw[0], sw[0] <= sw[1]);
  await ph.page.screenshot({ path: SHOTS + "/icc_phone.png", fullPage: true });

  check("no page errors (desktop)", "0", errs.length + (errs.length ? " " + errs.slice(0, 3).join(" | ") : ""), errs.length === 0);
  check("no page errors (phone)", "0", ph.errs.length + (ph.errs.length ? " " + ph.errs.slice(0, 3).join(" | ") : ""), ph.errs.length === 0);
  await browser.close();
  console.log(`\n${rows.length - fails}/${rows.length} passed`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
