/* Gateway: access requests + "Companies this person sees" (21 Nov 2026). Node only. */
const fs = require("fs"); const { makeGateway } = require("./stub");
const seedFile = JSON.parse(fs.readFileSync(process.env.SEED_FILE, "utf8")); const seedData = seedFile.data || seedFile;
const main = seedData.setup.main || seedData.setup; const cos = (main.companies || []).map(c => c.id);
const byCo = {}; Object.values(seedData.purchases).forEach(p => { if(p.account) byCo[p.account] = (byCo[p.account] || 0) + 1; });
const coA = Object.keys(byCo).sort((a, b) => byCo[b] - byCo[a])[0], coB = Object.keys(byCo).filter(c => c !== coA)[0] || cos.filter(c => c !== coA)[0];
main.users = (main.users || []).concat([{ name: "Fin", uid: "finance@x.com", role: "finance", active: true }, { name: "OneCo", uid: "oneco@x.com", role: "partner", active: true, companies: [coA] }, { name: "NoCo", uid: "noco@x.com", role: "partner", active: true, companies: [] }]);
main.roles = main.roles || {}; main.roles.partner = { bank: true, create: true, edit: true, deleteAny: true, restore: true, approve: true, export: true, setup: false };
const seed = { format: "mytool-1", schema: 1, savedBy: "aemporio6@gmail.com", data: seedData, tomb: {}, revs: {} };
const tokens = { T_A: { email: "aemporio6@gmail.com" }, T_FIN: { email: "finance@x.com" }, T_ONE: { email: "oneco@x.com" }, T_NO: { email: "noco@x.com" }, T_X: { email: "stranger@x.com" }, T_Y: { email: "other@x.com" } };
for(let i = 0; i < 25; i++) tokens["T_S" + i] = { email: "s" + i + "@x.com" };
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if(!c) fails++; }; const clone = o => JSON.parse(JSON.stringify(o));
const G = makeGateway(seed, tokens);
/* ---- a stranger ---- */
let r = G.call({ op: "read", token: "T_X" }); ok(r.status === 403 && !r.file, "a stranger gets nothing of the data (403)");
r = G.call({ op: "accessState", token: "T_X" }); ok(r.ok && r.state === "none", "a stranger can ask what became of a request: none yet");
r = G.call({ op: "accessAsk", token: "T_X", name: "Stranger <b>One</b>", note: "I am the new accountant\n" + "x".repeat(900) }); ok(r.ok && r.state === "pending", "Send request → waiting");
r = G.call({ op: "accessAsk", token: "T_X", name: "again", note: "again" }); ok(r.ok && r.state === "pending", "asking twice does not make a second request");
ok(G.call({ op: "accessList", token: "T_X" }).status === 403 && G.call({ op: "accessList", token: "T_FIN" }).status === 403 && G.call({ op: "accessDecide", token: "T_FIN", email: "stranger@x.com", decision: "approved" }).status === 403, "only an Owner sees or decides requests (stranger and Finance: refused)");
r = G.call({ op: "accessList", token: "T_A" }); const mine = r.list.find(x => x.email === "stranger@x.com");
ok(r.ok && mine && mine.state === "pending" && mine.name === "Stranger b One /b" && mine.note.length <= 300 && !/[<>\n]/.test(mine.note), "the Owner sees it: who, when, note (cleaned, cut to 300 characters)");
ok(G.call({ op: "accessState", token: "T_FIN" }).state === "member" && G.call({ op: "accessAsk", token: "T_FIN" }).state === "member", "someone who already has access is told so (no request made)");
ok(G.call({ op: "read", token: "T_X" }).status === 403, "asking gives no access by itself");
/* ---- reject / block ---- */
r = G.call({ op: "accessDecide", token: "T_A", email: "stranger@x.com", decision: "rejected" }); ok(r.ok && G.call({ op: "accessState", token: "T_X" }).state === "rejected", "Reject → the person sees: not approved");
r = G.call({ op: "accessAsk", token: "T_X", note: "please" }); ok(r.ok === false && r.state === "rejected", "…and cannot ask again the same day");
G.call({ op: "accessDecide", token: "T_A", email: "stranger@x.com", decision: "blocked" }); r = G.call({ op: "accessAsk", token: "T_X", note: "please" }); ok(r.ok === false && r.state === "blocked", "Block → can never ask again");
G.call({ op: "accessDecide", token: "T_A", email: "stranger@x.com", decision: "clear" }); ok(G.call({ op: "accessState", token: "T_X" }).state === "none", "the Owner can lift a block");
/* ---- the limit ---- */
let last; for(let i = 0; i < 25; i++) last = G.call({ op: "accessAsk", token: "T_S" + i, note: "n" + i });
ok(last.status === 429 && G.call({ op: "accessList", token: "T_A" }).list.filter(x => x.state === "pending").length === 20, "at most 20 requests wait at a time (the 21st is refused)");
/* ---- approve = the Owner adds the person; then the request is gone and the person is in ---- */
G.call({ op: "accessAsk", token: "T_Y", name: "Other", note: "VA" }); const before = G.call({ op: "accessList", token: "T_A" }).list.length;
const put = (tok, fn) => { const c = G.call({ op: "read", token: tok }); const nb = clone(c.file); fn(nb.data); return G.call({ op: "write", token: tok, base: c.version, body: nb }); };
G.call({ op: "accessDecide", token: "T_A", email: "s0@x.com", decision: "approved" });
r = put("T_A", d => { (d.setup.main || d.setup).users.push({ name: "S Zero", uid: "s0@x.com", role: "viewer", active: true }); });
ok(G.call({ op: "accessList", token: "T_A" }).list.find(x => x.email === "s0@x.com").state === "approved", "Approve marks the request approved (the person sees: approved, opening…)");
ok(r.ok && G.call({ op: "accessState", token: "T_S0" }).state === "member" && G.call({ op: "accessList", token: "T_A" }).list.length === before - 1 && G.call({ op: "read", token: "T_S0" }).ok, "Approve: added in Users → the request is gone and the person can open the data");
ok(!Object.keys(G.call({ op: "read", token: "T_A" }).file.data).includes("accessRequests") && !JSON.stringify(G.call({ op: "read", token: "T_A" }).file).includes("stranger@x.com"), "requests are never written into the data file");
/* ---- companies ---- */
const all = G.call({ op: "read", token: "T_A" }).file.data, nAll = Object.keys(all.purchases).length, nA = Object.values(all.purchases).filter(p => !p.account || p.account === coA).length;
r = G.call({ op: "read", token: "T_ONE" }); const seen = r.file.data;
ok(r.ok && Object.values(seen.purchases).every(p => !p.account || p.account === coA) && Object.keys(seen.purchases).length === nA && nA < nAll, `a person limited to one company gets only its orders (${nA} of ${nAll})`);
const hidNos = new Set(Object.values(all.purchases).filter(p => p.account && p.account !== coA).map(p => String(p.no)));
ok(Object.values(seen.inspections || {}).every(x => !hidNos.has(String(x.po))) && Object.values(seen.payments || {}).every(p => { const b = (main.banks || []).find(x => x.id === p.bank); const c = p.company || (b && b.company) || ""; return !c || c === coA; }), "…and only its payments and inspections");
ok(Object.keys(G.call({ op: "read", token: "T_FIN" }).file.data.purchases).length === nAll, "a person with All companies still gets everything");
const none = G.call({ op: "read", token: "T_NO" }).file.data; ok(Object.values(none.purchases).every(p => !p.account), "an empty list = no company's orders at all");
/* a save by the limited person keeps the other companies' records exactly */
const anyVisible = Object.keys(seen.purchases)[0];
r = put("T_ONE", d => { d.purchases[anyVisible].notes = "edited by OneCo"; }); const after = G.call({ op: "read", token: "T_A" }).file.data;
ok(r.ok && Object.keys(after.purchases).length === nAll && after.purchases[anyVisible].notes === "edited by OneCo" && [...hidNos].every(no => { const id = Object.keys(all.purchases).find(k => String(all.purchases[k].no) === no); return JSON.stringify(after.purchases[id]) === JSON.stringify(all.purchases[id]); }), "their save changes their own record and leaves every other company's order untouched");
ok(Object.keys(after.payments).length === Object.keys(all.payments).length && Object.keys(after.shipments).length === Object.keys(all.shipments).length, "no payment or shipment is lost by their save");
if(coB){ r = put("T_ONE", d => { d.purchases[anyVisible].account = coB; }); ok(r.status === 403, "they cannot move an order into a company they do not work for");
  r = put("T_ONE", d => { d.purchases["PO-TEST-X"] = { id: "PO-TEST-X", no: "PO-TEST-X", account: coB, lines: [] }; }); ok(r.status === 403, "…nor create one there"); }
r = put("T_ONE", d => { d.purchases["PO-TEST-Y"] = { id: "PO-TEST-Y", no: "PO-TEST-Y", account: coA, lines: [], status: "draft" }; }); ok(r.ok, "they can create an order in their own company");
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS"); process.exit(fails ? 1 : 0);
