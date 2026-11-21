/* Gateway: upload link secret only for Owners, orders on the supplier page, instant emails, mailOut (21 Nov 2026). Node only. */
const fs = require("fs"); const crypto = require("crypto"); const { makeGateway } = require("./stub");
const seedData = JSON.parse(fs.readFileSync(process.env.SEED_FILE, "utf8")).data; const main = seedData.setup.main || seedData.setup;
main.users = (main.users || []).concat([{ name: "Fin", uid: "finance@x.com", role: "finance", active: true }, { name: "Va", uid: "va@x.com", role: "va", active: true, perms: { approve: false, create: true, edit: true } }]); main.roles.finance = main.roles.finance || { bank: true, edit: true, create: true };
const sup = Object.values(seedData.parties).find(p => Object.values(seedData.purchases).some(o => o.party === p.code && !["closed", "cancelled", "draft"].includes(o.status)));
const tok = crypto.randomBytes(24).toString("base64url"); const h = crypto.createHash("sha256").update("mytool-upload:" + tok).digest("base64url");
const pid = Object.keys(seedData.parties).find(k => seedData.parties[k] === sup); seedData.parties[pid].upload = { h, t: tok, on: true, exp: "2099-01-01", max: 30, orders: true };
const tokens = { T_VA: { email: "va@x.com" }, T_A: { email: "aemporio6@gmail.com" }, T_FIN: { email: "finance@x.com" }, T_X: { email: "stranger@x.com" } };
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if(!c) fails++; }; const clone = o => JSON.parse(JSON.stringify(o));
const G = makeGateway({ format: "mytool-1", schema: 1, savedBy: "aemporio6@gmail.com", data: seedData, tomb: {}, revs: {} }, tokens, null, "vartleaves.data@gmail.com");
ok(G.call({ op: "read", token: "T_A" }).file.data.parties[pid].upload.t === tok, "an Owner gets the link's secret (can copy the link again)");
const fin = G.call({ op: "read", token: "T_FIN" }); ok(fin.file.data.parties[pid].upload && !fin.file.data.parties[pid].upload.t, "anyone else never gets it (Finance with bank access: no secret)");
{ const nb = clone(fin.file); nb.data.parties[pid].upload = { h: "x", t: "y", on: true }; nb.data.parties[pid].notes = "fin edit"; const r = G.call({ op: "write", token: "T_FIN", base: fin.version, body: nb }); const after = G.call({ op: "read", token: "T_A" }).file.data.parties[pid];
  ok(r.ok && after.notes === "fin edit" && after.upload.t === tok && after.upload.h === h, "a non-Owner's save keeps the link exactly (cannot change or wipe it)"); }
const info = G.call({ op: "supplierInfo", tok }); const open = Object.values(seedData.purchases).filter(o => o.party === sup.code && !["closed", "cancelled", "draft"].includes(o.status) && !o.deletedAt);
ok(info.ok && info.orders.length === Math.min(40, open.length) && info.orders.every(o => o.k && o.ref) && !JSON.stringify(info).match(/amount|total|price|bank/i), `the supplier page gets only their own open orders, by reference (${info.orders.length}) — no amounts`);
const b64 = Buffer.from("%PDF-1.4 test").toString("base64"); const po = info.orders[0] && info.orders[0].k;
let r = G.call({ op: "supplierUpload", tok, name: "inv.pdf", mime: "application/pdf", b64, kind: "Invoice (PI / CI)", note: "hello", po });
ok(r.ok, "upload works"); const list = G.call({ op: "inboxList", token: "T_A" }).list; ok(list.some(f => f.name === "inv.pdf" && f.po === po), "the file keeps which order it is for");
G.call({ op: "supplierUpload", tok, name: "inv2.pdf", mime: "application/pdf", b64, po: "PO-NOT-THEIRS" }); ok(G.call({ op: "inboxList", token: "T_A" }).list.find(f => f.name === "inv2.pdf").po === "", "an order that is not theirs is ignored");
const m1 = G.drive.mails.filter(m => /sent a file/.test(m.subject)); ok(m1.length === 1 && m1[0].to === "aemporio6@gmail.com" && /inv\.pdf/.test(m1[0].body), "the Owner gets ONE email (aemporio6) — the second file within the hour sends none");
G.call({ op: "accessAsk", token: "T_X", name: "Ali", note: "VA" }); G.call({ op: "accessAsk", token: "T_X", name: "Ali", note: "again" });
const m2 = G.drive.mails.filter(m => /asks for access/.test(m.subject)); ok(m2.length === 1 && m2[0].to === "aemporio6@gmail.com" && /stranger@x\.com/.test(m2[0].body), "an access request emails the Owner once");
r = G.call({ op: "mailOut", token: "T_FIN", to: "a@b.com", subject: "s", body: "b" }); ok(r.status === 403, "only an Owner can send email from MY TOOL");
r = G.call({ op: "mailOut", token: "T_A", to: "not an email", subject: "s", body: "b" }); ok(r.status === 400, "a wrong address is refused");
r = G.call({ op: "mailOut", token: "T_A", to: "supplier@example.com", subject: "Upload link", body: "here" }); ok(r.ok && G.drive.mails.some(m => m.to === "supplier@example.com" && m.o && m.o.replyTo === "aemporio6@gmail.com"), "an Owner sends the link / invitation; replies go to the Owner");
/* big file: a download link instead; approve / reject rights (21 Nov 2026) */
r = G.call({ op: "supplierUpload", tok, link: "https://we.tl/t-ABC123", name: "Inspection report VAL-104", kind: "Inspection / photos", po });
ok(r.ok && r.link, "a download link is accepted instead of a big file");
ok(G.call({ op: "supplierUpload", tok, link: "javascript:alert(1)" }).ok === false, "only real https links");
const L2 = G.call({ op: "inboxList", token: "T_A" }).list; const lk = L2.find(f => f.link === "https://we.tl/t-ABC123"); ok(!!lk && lk.po === po && lk.kind === "Inspection / photos", "it waits in the inbox as a link (with its order)");
ok(G.call({ op: "inboxDone", token: "T_VA", id: lk.id, attach: true }).status === 403 && G.call({ op: "inboxList", token: "T_VA" }).ok, "a VA can see the inbox but not approve (needs the Owner or the approve switch)");
r = G.call({ op: "inboxDone", token: "T_A", id: lk.id, attach: true, to: "purchases:" + po }); ok(r.ok && r.url === "https://we.tl/t-ABC123", "the Owner approves: the link itself is what gets attached");
const f2 = G.call({ op: "inboxList", token: "T_A" }).list.find(f => f.name === "inv2.pdf"); r = G.call({ op: "inboxDone", token: "T_A", id: f2.id, reject: "Wrong file" });
ok(r.ok && r.rejected && !G.call({ op: "inboxList", token: "T_A" }).list.some(f => f.id === f2.id), "Reject: out of the inbox (kept in the supplier's “rejected” folder)");
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS"); process.exit(fails ? 1 : 0);
