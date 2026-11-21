/* Gateway: move the data to another account + supplier upload link + inbox (20 Nov 2026). Node only. */
const fs = require("fs"), crypto = require("crypto"); const { makeGateway } = require("./stub");
const seedFile = JSON.parse(fs.readFileSync(process.env.SEED_FILE, "utf8")); const seedData = seedFile.data || seedFile;
const main = seedData.setup.main || seedData.setup; main.users = (main.users || []).concat([{ name: "Fin", uid: "finance@x.com", role: "finance", active: true }]);
const seed = { format: "mytool-1", schema: 1, savedBy: "aemporio6@gmail.com", data: seedData, tomb: {}, revs: {} };
const tokens = { T_A: { email: "aemporio6@gmail.com" }, T_V: { email: "vartleaves.data@gmail.com" }, T_FIN: { email: "finance@x.com" }, T_X: { email: "nobody@x.com" } };
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if(!c) fails++; }; const clone = o => JSON.parse(JSON.stringify(o));
const OLD = makeGateway(seed, tokens), NEW = makeGateway(null, tokens, null, "vartleaves.data@gmail.com");
/* --- the new (empty) account --- */
let r = NEW.call({ op: "meta", token: "T_A" }); ok(r.ok && r.exists === false && r.role === "owner", "new account: gateway answers, no data yet, aemporio6 is Owner there too");
r = NEW.call({ op: "whoami", token: "T_A" }); ok(r.account === "vartleaves.data@gmail.com", "it runs as the company account");
ok(NEW.call({ op: "adopt", token: "T_FIN", body: seed }).status === 403 && NEW.call({ op: "adopt", token: "T_X", body: seed }).status === 403, "only an Owner can move data in");
const full = OLD.call({ op: "read", token: "T_A" }).file;
r = NEW.call({ op: "adopt", token: "T_A", body: full, from: "aemporio6@gmail.com" }); ok(r.ok && r.counts.purchases === Object.keys(full.data.purchases).length && r.counts.payments === Object.keys(full.data.payments).length, "adopt: the whole file is written, counts match (" + r.counts.purchases + " orders, " + r.counts.payments + " payments)");
ok(NEW.call({ op: "adopt", token: "T_A", body: full }).status === 409, "a second adopt is refused (data already there)");
const nf = NEW.call({ op: "read", token: "T_A" }); ok(nf.ok && JSON.stringify(nf.file.data.purchases) === JSON.stringify(full.data.purchases) && nf.file.adoptedFrom === "aemporio6@gmail.com", "the new account serves exactly the same records");
r = NEW.call({ op: "read", token: "T_FIN" }); ok(r.ok, "the team's roles work on the new account at once");
/* --- the old copy gets the forwarding pointer --- */
const put = (G, tok, fn) => { const c = G.call({ op: "read", token: tok }); const nb = clone(c.file); fn(nb.data); return G.call({ op: "write", token: tok, base: c.version, body: nb }); };
r = put(OLD, "T_FIN", d => { (d.setup.main || d.setup).movedTo = { gateway: "https://x", at: "now" }; }); ok(r.status === 403, "a non-Owner cannot set the 'moved' pointer");
r = put(OLD, "T_A", d => { (d.setup.main || d.setup).movedTo = { gateway: "https://new.example/exec", account: "vartleaves.data@gmail.com", at: "2026-11-20T00:00:00Z" }; }); ok(r.ok, "the Owner sets the pointer on the old copy");
r = put(OLD, "T_FIN", d => { d.purchases[Object.keys(d.purchases)[0]].notes = "late edit"; }); ok(r.status === 410 && r.moved && r.moved.gateway === "https://new.example/exec", "after that the old copy refuses every save and says where the data is");
ok((OLD.call({ op: "read", token: "T_FIN" }).file.data.setup.main || {}).movedTo, "…and every reader sees the pointer");
r = put(OLD, "T_A", d => { delete (d.setup.main || d.setup).movedTo; }); ok(r.ok, "the Owner can take the pointer off again (going back)");
/* --- supplier upload link --- */
const tok = crypto.randomBytes(24).toString("base64url"); const h = NEW.run("upHash", tok); const sup = Object.keys(nf.file.data.parties)[0];
put(NEW, "T_A", d => { d.parties[sup].upload = { h, on: true, exp: "2099-01-01", max: 2 }; });
const info = t => { Object.keys(NEW.drive.cache).forEach(k => { if(k.startsWith("upf:")) delete NEW.drive.cache[k]; }); return NEW.call({ op: "supplierInfo", tok: t }); }, send = o => NEW.call({ op: "supplierUpload", ...o });
let pg = info(tok); ok(pg.ok === true && pg.name === nf.file.data.parties[sup].name, "the link is recognised and names that supplier");
ok(info("wrongwrongwrongwrongwrongwrong").ok === false && info("../etc").ok === false, "a wrong link gets 'not active' — nothing else");
ok(JSON.stringify(Object.keys(pg).sort()) === '["name","ok","orders"]' && (pg.orders || []).every(o => JSON.stringify(Object.keys(o).sort()) === '["k","ref"]'), "the page is given only the supplier's name and their own open orders' references (21 Nov 2026)");
ok(NEW.call({ op: "read", tok }).status === 401 && NEW.call({ op: "inboxList", tok }).status === 401 && NEW.call({ op: "file", tok, id: "x" }).status === 401, "the link's secret opens no other call (read, inbox, files all refuse)");
const b64 = Buffer.from("%PDF-1.4 test").toString("base64");
r = send({ tok, name: "CI WAP-1.pdf", mime: "application/pdf", b64, kind: "Invoice (PI / CI)", note: "hello" }); ok(r.ok && r.left === 1, "a file is received");
ok(/type of file/.test(send({ tok, name: "run.exe", b64 }).error) && /type of file/.test(send({ tok, name: "x.html", b64 }).error), "other file types are refused");
ok(/not active/.test(send({ tok: tok + "x", name: "a.pdf", b64 }).error), "a wrong secret uploads nothing");
send({ tok, name: "../../evil/pack.xlsx", b64 }); ok(/limit/.test(send({ tok, name: "third.pdf", b64 }).error), "the day limit of the link holds");
const list = NEW.call({ op: "inboxList", token: "T_FIN" }).list; ok(list.length === 2 && list.every(x => x.party === (nf.file.data.parties[sup].code || sup)) && list.some(x => x.kind === "Invoice (PI / CI)" && x.note === "hello") && list.some(x => x.name === "pack.xlsx"), "the app sees the 2 files with supplier, kind and note (file names made safe)");
ok(NEW.call({ op: "inboxList", token: "T_X" }).status === 403, "outsiders cannot list the inbox");
r = NEW.call({ op: "inboxFile", token: "T_FIN", id: list[0].id }); ok(r.ok && Buffer.from(r.b64, "base64").toString() === "%PDF-1.4 test", "a file can be opened through the gateway");
const dataId = Object.values(NEW.drive.files).find(f => f.name === "MYTOOL-DATA.json").id; ok(NEW.call({ op: "inboxFile", token: "T_FIN", id: dataId }).status === 403, "…but only files of the inbox — never the data file");
r = NEW.call({ op: "inboxDone", token: "T_FIN", id: list[0].id, attach: true }); ok(r.ok && /drive\.google\.com/.test(r.url), "Attach: the file moves to the attachments folder");
r = NEW.call({ op: "inboxDone", token: "T_FIN", id: list[1].id }); ok(r.ok && NEW.call({ op: "inboxList", token: "T_FIN" }).list.length === 0, "Done: the inbox is empty again");
put(NEW, "T_A", d => { d.parties[sup].upload.on = false; }); ok(info(tok).ok === false && /not active/.test(send({ tok, name: "a.pdf", b64 }).error), "switched off → the link is dead (within 2 minutes at the latest)");
put(NEW, "T_A", d => { d.parties[sup].upload = { h, on: true, exp: "2020-01-01" }; }); ok(info(tok).expired === true, "after the end date the link says it has expired");
console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(fails ? 1 : 0);
