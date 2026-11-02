// The earlier Smart Import suite (scratchpad/app3_imp/test.js, unchanged) re-pointed at the current build:
// only the page (demo build served by tests/demo.sh) and the sample-file folder changed.
const { chromium } = require("playwright"); const fs = require("fs");
const B = "/tmp/claude-0/-home-claude/117846c6-ab7f-5f52-9a04-3582b9919749/scratchpad";
const FILES = B + "/app3_imp/files/";
async function open(viewport) {
  const br = await chromium.launch({ args: ["--headless=new"] }); const pg = await br.newPage({ viewport: viewport || { width: 1280, height: 900 } }); pg.setDefaultTimeout(6000); const errs = [];
  pg.on("pageerror", e => errs.push("PAGEERROR " + e.message)); pg.on("console", m => { if (m.type() === "error" && !/ERR_|net::|Failed to load resource|Bad uncompressed size/.test(m.text())) errs.push("CONSOLE " + m.text()) });
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await pg.goto(process.env.MT_URL || "http://localhost:8097/index.html?demo"); await pg.waitForFunction(() => { try { return S.ready } catch (e) { return false } }, null, { timeout: 30000 });
  /* the old page mocked window.claude downloads into window.__saved; the web build saves with saveBlob — capture it the same way */
  /* the old suite was written before the owner's ASIN table existed (it expects ASIN questions) — empty the table here */
  await pg.evaluate(() => { Object.keys(RD_ASIN).forEach(k => delete RD_ASIN[k]) });
  await pg.evaluate(() => { window.__saved = []; window.saveBlob = async (b, name) => { window.__saved.push({ name, size: b.size, text: await b.text() }); return true } });
  await pg.evaluate(() => go("import", {}, { force: true })); await pg.waitForTimeout(200); return { br, pg, errs }
}
async function upload(pg, file) { await pg.evaluate(() => { S.imp = null; S.drawer = null; if (document.activeElement) document.activeElement.blur(); go("import", {}, { force: true }) }); await pg.setInputFiles("#imp_file", FILES + file); await pg.waitForFunction(() => S.imp && S.imp.preview, null, { timeout: 10000 }); await pg.waitForTimeout(150) }
const state = pg => pg.evaluate(() => { const I = S.imp; const P = I.preview; const sh = I.sheets[I.active]; return { kind: I.kind, pct: Math.round((sh.kinds[I.kind]?.pct || 0) * 100), sheet: sh.name, sheets: I.sheets.map(s => s.name + ":" + s.best + ":" + Math.round(s.bestPct * 100) + ":" + s.nData), hi: sh.hi, map: Object.fromEntries(Object.entries(sh.map).map(([f, c]) => [f, sh.headers[c] + " (" + Math.round((sh.conf[f]?.s || 0) * 100) + ")"])), counts: P.counts, missing: P.missing, nWrite: P.nWrite, summary: P.summary, unk: Object.values(P.unk).map(u => ({ key: u.key, n: u.n, dec: u.dec?.act || null, c: (u.cands || []).slice(0, 2).map(c => c.id + "@" + Math.round(c.s * 100)) })), matches: (P.matches || []).length, meta: { pi: sh.meta.piNo, party: sh.meta.party, date: sh.meta.date }, def: I.def, src: sh.source?.key, rows: P.rows.filter(r => r.st !== "ok").slice(0, 12).map(r => `${r.ri}:${r.st}:${r.why.map(w => w.t).join("; ")}`) } });
module.exports = { open, upload, state, B };
