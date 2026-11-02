// Shared harness for the importer tests (tests/imp/t_*.js).
// Needs the demo build served: tests/demo.sh /tmp/mt_imp 8097  (or set MT_URL)
// Run: NODE_PATH=/opt/npm-tools/node_modules node tests/imp/t_xxx.js
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const URL_ = process.env.MT_URL || "http://localhost:8097/index.html?demo";
const ATT = "/mnt/user-data/attachments/117846c6-ab7f-5f52-9a04-3582b9919749";
const SCR = "/tmp/claude-0/-home-claude/117846c6-ab7f-5f52-9a04-3582b9919749/scratchpad";
const att = f => { const n = fs.readdirSync(ATT).find(x => x.includes(f)); if (!n) throw new Error("attachment not found: " + f); return path.join(ATT, n); };
async function open(o = {}) {
  const br = await chromium.launch({ args: ["--headless=new"] });
  const pg = await br.newPage({ viewport: o.viewport || { width: 1366, height: 900 } });
  pg.setDefaultTimeout(o.timeout || 15000);
  const errs = [];
  pg.on("pageerror", e => errs.push("PAGEERROR " + e.message));
  pg.on("console", m => { if (m.type() === "error" && !/ERR_|net::|favicon|Failed to load resource/.test(m.text())) errs.push("CONSOLE " + m.text()); });
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (o.init) await pg.addInitScript(o.init);
  await pg.goto(URL_);
  await pg.waitForFunction(() => { try { return S.ready } catch (e) { return false } }, null, { timeout: 30000 });
  await pg.evaluate(() => go("import", {}, { force: true }));
  await pg.waitForTimeout(150);
  return { br, pg, errs };
}
/* upload one or more files through the real file input of the Import page */
async function upload(pg, files, o = {}) {
  files = [].concat(files);
  await pg.evaluate(() => { S.imp = null; S.drawer = null; if (document.activeElement) document.activeElement.blur(); go("import", {}, { force: true }) });
  await pg.waitForTimeout(100);
  const sel = (await pg.$("#imp_files")) ? "#imp_files" : "#imp_file";
  await pg.setInputFiles(sel, files);
  if (o.noWait) return;
  await pg.waitForFunction(() => (S.imp && S.imp.preview) || (S.impQ && S.impQ.items.some(x => x.st === "error" || x.st === "proof")), null, { timeout: o.timeout || 30000 });
  await pg.waitForTimeout(150);
}
const state = pg => pg.evaluate(() => {
  const I = S.imp; if (!I) return null; const P = I.preview; const sh = I.sheets[I.active];
  return { kind: I.kind, fmt: I.fixed?.fmt || null, pct: Math.round((sh.kinds?.[I.kind]?.pct || 0) * 100), sheet: sh.name, hi: sh.hi, nData: sh.nData,
    map: Object.fromEntries(Object.entries(sh.map).map(([f, c]) => [f, sh.headers[c]])), counts: P.counts, missing: P.missing, nWrite: P.nWrite, summary: P.summary,
    unk: Object.values(P.unk).map(u => ({ key: u.key, n: u.n, dec: u.dec?.act || null, c: (u.cands || []).slice(0, 2).map(c => c.id + "@" + Math.round(c.s * 100)) })),
    def: I.def, src: sh.source?.key, mem: I.mem?.how || null, tot: P.tot || null, fixed: I.fixed ? { meta: I.fixed.meta, checks: I.fixed.checks } : null,
    rows: P.rows.filter(r => r.st !== "ok").slice(0, 12).map(r => `${r.ri}:${r.st}:${r.why.map(w => w.t).join("; ")}`) };
});
function checker() {
  let fails = 0, oks = 0; const res = [];
  const ck = (name, cond, info) => { const s = info === undefined ? "" : " | " + (typeof info === "string" ? info : JSON.stringify(info)).slice(0, 300); res.push({ name, ok: !!cond, info: s }); if (cond) { oks++; console.log("OK  ", name + s) } else { fails++; console.log("FAIL", name + s) } };
  const done = async (br, errs) => { ck("no page / console errors", !errs.length, errs.slice(0, 5)); console.log(`OKS: ${oks} FAILS: ${fails}`); if (br) await br.close(); process.exit(fails ? 1 : 0) };
  return { ck, done };
}
async function run(pg) { const n0 = await pg.evaluate(() => D.imports.length); await pg.click('[data-act="runimport"]'); await pg.waitForFunction(n => D.imports.length > n && !S.imp?.busy, n0, { timeout: 30000 }); await pg.waitForTimeout(300); return pg.evaluate(() => live(D.imports).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1)[0]) }
module.exports = { open, upload, state, checker, run, att, ATT, SCR };
