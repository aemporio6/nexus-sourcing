/* Rules of tools/gateway.gs, tested in Node (no Google):  node tests/gw/t_gateway.js */
const { makeGateway } = require("./stub");
const seedData = JSON.parse(require("fs").readFileSync(process.env.SEED_FILE || "/home/claude/mt_data/MYTOOL-start-data.json", "utf8")).data;
const main = seedData.setup.main || seedData.setup;
main.users = (main.users || []).concat([{ id: "u_fin", name: "Fin", uid: "finance@x.com", role: "finance", active: true }, { id: "u_va", name: "VA", uid: "va@x.com", role: "va", active: true }, { id: "u_off", name: "Old", uid: "old@x.com", role: "finance", active: false }]);
main.roles.viewer = { setup: false, approve: false, bank: false, deleteAny: false, edit: false, create: false, export: false };
main.users.push({ id: "u_view", name: "View", uid: "viewer@x.com", role: "viewer", active: true });
const seed = { format: "mytool-1", schema: 1, savedBy: "aemporio6@gmail.com", data: seedData, tomb: {}, revs: {} };
const tokens = { T_ADMIN: { email: "aemporio6@gmail.com" }, T_FIN: { email: "finance@x.com" }, T_VA: { email: "va@x.com" }, T_VIEW: { email: "viewer@x.com" }, T_OLD: { email: "old@x.com" }, T_STRANGER: { email: "nobody@x.com" }, T_WRONGAUD: { email: "aemporio6@gmail.com", aud: "other-app" } };
const G = makeGateway(seed, tokens);
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if(!c) fails++; };
const clone = o => JSON.parse(JSON.stringify(o));
const firstPay = Object.keys(seedData.payments)[0], firstPo = Object.keys(seedData.purchases)[0];

let r = G.call({ op: "meta", token: "BAD" }); ok(r.status === 401, "bad token → 401 (" + r.error + ")");
r = G.call({ op: "meta", token: "T_WRONGAUD" }); ok(r.status === 401, "token for another app → 401");
r = G.call({ op: "meta", token: "T_STRANGER" }); ok(r.status === 403, "stranger → 403");
r = G.call({ op: "meta", token: "T_OLD" }); ok(r.status === 403, "inactive user → 403");
r = G.call({ op: "meta", token: "T_ADMIN" }); ok(r.ok && r.exists && r.role === "owner" && r.email === undefined, "admin meta ok, email not echoed");
const v0 = r.version;
r = G.call({ op: "read", token: "T_VA" }); ok(r.ok && r.file.redacted === true && !("bank" in (r.file.data.payments[firstPay] || {})) , "VA read is redacted (no bank fields)");
const adminRead = G.call({ op: "read", token: "T_ADMIN" }); ok(!adminRead.file.redacted && "bank" in adminRead.file.data.payments[firstPay], "admin read full (payment has bank)");

/* viewer cannot write at all */
let body = clone(adminRead.file); body.data.parties[Object.keys(body.data.parties)[0]].note = "x";
r = G.call({ op: "write", token: "T_VIEW", base: v0, body }); ok(r.status === 403, "viewer write → 403");

/* VA (create only): new record ok, editing existing refused, trashing refused */
body = clone(G.call({ op: "read", token: "T_VA" }).file); body.data.parties["SUP-999"] = { id: "SUP-999", no: "SUP-999", name: "New", createdAt: "2026-11-04T00:00:00Z", createdBy: "va@x.com" };
r = G.call({ op: "write", token: "T_VA", base: v0, body }); ok(r.ok && r.version === v0 + 1, "VA creates a record → ok, version " + r.version);
const v1 = r.version;
const stored = JSON.parse(Object.values(G.drive.files).find(f => f.name === "MYTOOL-DATA.json").content);
ok("bank" in stored.data.payments[firstPay] && stored.data.parties["SUP-999"] && stored.savedBy === "va@x.com", "bank fields re-attached after VA save; savedBy recorded");
body = clone(G.call({ op: "read", token: "T_VA" }).file); body.data.purchases[firstPo].note = "changed by va";
r = G.call({ op: "write", token: "T_VA", base: v1, body }); ok(r.status === 403 && /cannot change/.test(r.error), "VA edits existing record → 403");
body = clone(G.call({ op: "read", token: "T_VA" }).file); body.data.purchases[firstPo].deletedAt = "2026-11-04T00:00:00Z";
r = G.call({ op: "write", token: "T_VA", base: v1, body }); ok(r.status === 403 && /trash/.test(r.error), "VA trashes → 403");

/* finance: edit ok, setup change refused, users change refused */
body = clone(G.call({ op: "read", token: "T_FIN" }).file); body.data.purchases[firstPo].note = "changed by finance";
r = G.call({ op: "write", token: "T_FIN", base: v1, body }); ok(r.ok, "finance edits a record → ok"); const v2 = r.version;
body = clone(G.call({ op: "read", token: "T_FIN" }).file); (body.data.setup.main || body.data.setup).companies[0].name = "Hacked Ltd";
r = G.call({ op: "write", token: "T_FIN", base: v2, body }); ok(r.status === 403 && /Setup/.test(r.error), "finance changes Setup → 403");
body = clone(G.call({ op: "read", token: "T_FIN" }).file); (body.data.setup.main || body.data.setup).users[0].role = "va";
r = G.call({ op: "write", token: "T_FIN", base: v2, body }); ok(r.status === 403 && /users or roles/.test(r.error), "finance changes users → 403");

/* compare-and-swap */
body = clone(adminRead.file); body.data.parties[Object.keys(body.data.parties)[0]].note = "admin edit";
r = G.call({ op: "write", token: "T_ADMIN", base: v0, body }); ok(r.status === 409 && r.conflict && r.version === v2 && r.file && r.file.data, "stale base → 409 with the current file");
r = G.call({ op: "write", token: "T_ADMIN", base: v2, body }); ok(r.ok && r.version === v2 + 1, "same write with fresh base → ok");
r = G.call({ op: "write", token: "T_ADMIN", base: v2 + 1, body: { data: {} } }); ok(r.status === 400, "incomplete file refused");

/* admin-only ops */
r = G.call({ op: "revoke", token: "T_FIN" }); ok(r.status === 403, "revoke by finance → 403");
r = G.call({ op: "revoke", token: "T_ADMIN" }); ok(r.ok && r.removed.includes("editor@x.com") && r.removed.includes("viewer@x.com"), "lock data folder removes non-admin access: " + r.removed.join(","));
r = G.call({ op: "share", token: "T_ADMIN", email: "va@x.com", role: "writer" }); ok(r.ok, "share FILES folder");
ok(Object.values(G.folders).some(f => f.name === "MY TOOL – FILES" && f.editors.includes("va@x.com")), "VA is editor of FILES folder only");
r = G.call({ op: "backupNow", token: "T_ADMIN" }); r = G.call({ op: "backups", token: "T_VA" }); ok(r.ok && r.list.length === 1 && r.list[0].nightly, "backup made in backups/ and listed");
r = G.call({ op: "backupRead", token: "T_VA", id: r.list[0].id }); ok(r.status === 403, "backup read by VA → 403");
r = G.call({ op: "upload", token: "T_VIEW", name: "a.pdf", b64: Buffer.from("hi").toString("base64") }); ok(r.status === 403, "viewer upload → 403");
r = G.call({ op: "upload", token: "T_VA", name: "a/b:c.pdf", mime: "application/pdf", b64: Buffer.from("hi").toString("base64") }); ok(r.ok && r.id && G.drive.files[r.id].name === "a_b_c.pdf", "VA upload ok, name sanitised");
/* tasks: a VA may tick a task given to them, but change nothing else, and not someone else's */
{ let cur = G.call({ op: "read", token: "T_ADMIN" }); let b0 = clone(cur.file); b0.data.tasks = { "TA-26-0001": { no: "TA-26-0001", id: "TA-26-0001", title: "For VA", who: "va@x.com", by: "aemporio6@gmail.com", status: "todo" }, "TA-26-0002": { no: "TA-26-0002", id: "TA-26-0002", title: "For Fin", who: "finance@x.com", by: "aemporio6@gmail.com", status: "todo" } };
  r = G.call({ op: "write", token: "T_ADMIN", base: cur.version, body: b0 }); ok(r.ok, "admin adds two tasks");
  const step = (tok, id, fn) => { const c = G.call({ op: "read", token: tok }); const nb = clone(c.file); fn(nb.data.tasks[id]); return G.call({ op: "write", token: tok, base: c.version, body: nb }); };
  r = step("T_VA", "TA-26-0001", t => { t.status = "done"; t.doneAt = "2026-11-12T01:00:00Z"; }); ok(r.ok, "VA ticks their own task Done → allowed");
  r = step("T_VA", "TA-26-0001", t => { t.title = "changed"; }); ok(r.status === 403, "VA changes the task title → 403");
  r = step("T_VA", "TA-26-0002", t => { t.status = "done"; }); ok(r.status === 403, "VA ticks someone else's task → 403");
  r = step("T_VA", "TA-26-0001", t => { t.status = "deleted"; }); ok(r.status === 403, "VA sets an unknown status → 403"); }
ok(G.drive.files && Object.values(G.drive.files).some(f => f.name.startsWith("MYTOOL-GATEWAY-LOG") && /REFUSED/.test(f.content) && /ok write va@x.com/.test(f.content)), "gateway log has writes and refusals");
console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(fails ? 1 : 0);
