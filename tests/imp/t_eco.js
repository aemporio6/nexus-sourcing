// Eco Huang (Yucheng) freight PIs — all 20 real files: recognised, lines added, Total row checked, date read, format memory.
// Run: NODE_PATH=/opt/npm-tools/node_modules node tests/imp/t_eco.js
const { open, upload, state, checker, run, SCR } = require("./h");
const X = require("./expected.json").eco;
const { ck, done } = checker();
(async () => {
  const { br, pg, errs } = await open();
  const ev = (fn, a) => pg.evaluate(fn, a);
  let committed = null;
  for (const [f, e] of Object.entries(X)) {
    await upload(pg, SCR + "/eco_pi/" + f);
    const st = await state(pg);
    const c = st.tot.fields.find(x => x.f === "cost") || {};
    const ok = st.fmt === "eco_pi" && st.kind === "freight" && st.def.party === "FWD-003" && Math.abs(c.lines - e.sum) < 0.011 && (e.total == null ? c.file == null : Math.abs(c.file - e.total) < 0.011) && st.fixed.meta.date === e.date;
    ck(`${f}: Eco PI · $${e.sum}${e.total == null ? " (Total row empty — no file total)" : ` = Total $${e.total} ✅`} · ${e.date}`, ok && (e.total == null || st.tot.ok), { fmt: st.fmt, party: st.def.party, lines: c.lines, file: c.file, date: st.fixed.meta.date, mem: st.mem, match: st.summary });
    if (!committed && st.nWrite > 0 && st.tot.ok && e.total != null) { const im = await run(pg); committed = { f, im }; }
  }
  ck("one Eco PI imported as a new freight bill", !!committed, committed && committed.f);
  if (committed) {
    const sh = await ev(no => { const im = D.imports.find(i => i.no === no); const id = (im.docIds || [])[0]?.split(":")[1]; return D.shipments.find(s => s.no === id) }, committed.im.no);
    ck("freight bill: Eco (FWD-003), USD cost = the PI total, detail lines kept", sh && sh.party === "FWD-003" && sh.costCur === "USD" && Math.abs(sh.cost - X[committed.f].total) < 0.011 && /Lines|@|=/.test(JSON.stringify(sh.notes || "")), sh && { cost: sh.cost, notes: sh.notes });
    await upload(pg, SCR + "/eco_pi/" + committed.f);
    const st = await state(pg);
    ck("format memory: the same layout is reused automatically next time", st.mem === "layout", st.mem);
    ck("same PI again → found as already in the app, not imported twice", st.nWrite === 0, st.summary);
  }
  await done(br, errs);
})().catch(e => { console.error(e); process.exit(2) });
