// Payment Summary export test.
// Run: tests/demo.sh /tmp/mt_ps 8094 && NODE_PATH=/opt/npm-tools/node_modules node tests/ps/t_ps.js /tmp/mt_ps/out
// Clicks the button on Reports (desktop) and Payments (phone), saves the downloads + the app's own expected totals as JSON for check_ps.py.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const URL_ = process.env.PS_URL || "http://localhost:8094/index.html?demo";
const OUT = process.argv[2] || "/tmp/mt_ps/out";
fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const check = (n, ok, got) => { if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + n + (got !== undefined ? " | " + got : "")); };

async function open(browser, vp, mobile) {
  const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true, isMobile: !!mobile, hasTouch: !!mobile });
  const page = await ctx.newPage(); const errs = []; const failed = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("requestfailed", r => failed.push(r.url()));
  page.on("console", m => { if (m.type() !== "error") return; if (/Failed to load resource/.test(m.text()) && failed.length && failed.every(u => /fonts\.(googleapis|gstatic)/.test(u))) return; errs.push("console: " + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(URL_);
  await page.waitForFunction(() => { try { return S.ready } catch (e) { return false } }, null, { timeout: 30000 });
  return { ctx, page, errs };
}
async function exportFrom(page, view, file) {
  await page.evaluate(v => go(v), view);
  await page.waitForSelector('#psxcard [data-psx="export"]', { timeout: 10000 });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.click('#psxcard [data-psx="export"]')]);
  const p = path.join(OUT, file); await dl.saveAs(p); return { p, name: dl.suggestedFilename() };
}

(async () => {
  const browser = await chromium.launch();
  /* desktop: Reports page */
  const d = await open(browser, { width: 1366, height: 900 });
  check("ExcelJS not loaded before the click", await d.page.evaluate(() => !window.ExcelJS));
  const r1 = await exportFrom(d.page, "reports", "desktop_reports.xlsx");
  check("file name", /^PAYMENT SUMMARY \(MY TOOL \d{2}-[A-Z][a-z]{2}-\d{4}\)\.xlsx$/.test(r1.name), r1.name);
  check("ExcelJS loaded lazily after the click", await d.page.evaluate(() => !!window.ExcelJS));
  await d.page.screenshot({ path: path.join(OUT, "reports_desktop.png") });
  /* the app's own numbers for the Python checks */
  const app = await d.page.evaluate(() => {
    const pays = live(D.payments).filter(isCounted); const tot = {};
    pays.forEach(p => { const s = p.direction === "in" ? -1 : 1; tot[p.cur] = Math.round(((tot[p.cur] || 0) + s * (+p.amount || 0)) * 100) / 100; });
    const m = psModel(); const T = psTotals(m);
    const byTab = {}; m.tabs.forEach(t => { byTab[t.name] = { code: t.pt.code, type: t.pt.type, n: T[t.name].n, RMB: T[t.name].RMB, GBP: T[t.name].GBP, USD: T[t.name].USD } });
    const want = D.parties.filter(p => ["supplier", "forwarder", "inspector"].includes(p.type) && p.status !== "archived").map(p => p.code);
    return { tot, byTab, want, nPays: live(D.payments).length, nCounted: pays.length };
  });
  fs.writeFileSync(path.join(OUT, "app.json"), JSON.stringify(app, null, 1));
  const r2 = await exportFrom(d.page, "payments", "desktop_payments.xlsx");
  check("payments page button works (desktop)", fs.statSync(r2.p).size > 5000, fs.statSync(r2.p).size);
  check("no page errors desktop", d.errs.length === 0, d.errs.join(" ; "));
  await d.ctx.close();
  /* phone: Payments page */
  const ph = await open(browser, { width: 390, height: 844 }, true);
  const r3 = await exportFrom(ph.page, "payments", "phone_payments.xlsx");
  check("phone download", fs.statSync(r3.p).size > 5000, fs.statSync(r3.p).size);
  await ph.page.screenshot({ path: path.join(OUT, "payments_phone.png") });
  const ov = await ph.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check("no horizontal scroll on phone", !ov);
  await ph.page.evaluate(() => go("reports")); await ph.page.waitForSelector("#psxcard");
  check("reports card on phone", true);
  check("no page errors phone", ph.errs.length === 0, ph.errs.join(" ; "));
  await browser.close();
  console.log(fails ? `${fails} FAILED` : "ALL PASS"); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
