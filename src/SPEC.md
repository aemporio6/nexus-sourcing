# NEXUS v3 — specification (single source of truth for all modules)

Owner: Muhammad Aashiq, Vartleaves Limited. UK e-commerce, China sourcing. Everything below answers the two audits in `../app2/AUDIT_1.md` and `../app2/AUDIT_2.md`. Modules: `head.html` (shell+CSS), `core.js`, `forms.js`, `views.js`, `drawers.js`, `setup.js`, `events.js`. Assembled into `../nexus-app3.html` (one `<script>` after head). Runtime: Claude artifact `window.claude.use("db"|"user"|"assets"|"downloads")`; the test harness mocks `db` with `seed3/`.

Principles (owner rules): entry once, rest auto (AUTO badge, changeable); every choice is a dropdown fed from Setup (archive, no duplicates, inline "+ Add" for Owner); free text only for unique values; numbers never restart; old refs searchable; stock only from movements; every record editable keeping its number; nothing deleted (Trash 30 d, archive); extensible without code (lists, fields, defaults, statuses, document types, roles).

---

## 1. Storage layout (db collections)

| collection | id | purpose |
|---|---|---|
| `setup/main` | — | whole Setup document (see §3) |
| `parties` | `SUP-001` … | suppliers, forwarders, inspectors, couriers, customs agents, VAs |
| `products` | SKU | products (packs) |
| `purchases` | `PO-YY-####` | purchase orders (China / UK / Sample) |
| `shipments` | `SH-YY-####` | freight shipments, lines per PO/SKU |
| `payments` | `PAY-YY-####` | money out/in with allocations |
| `inspections` | `IN-YY-####` | |
| `receipts` | `RC-YY-####` | goods received → batches |
| `moves` | `MV-YY-####` | stock movements (transfer, sale, return, adjust, count, allocate) |
| `credits` | `CN-YY-####` | supplier credit notes / claims |
| `imports` | `IMP-YY-####` | import runs (undoable) |
| `salesStats` | `SA-YY-####` | per product × period × marketplace: Amazon Business Report traffic/sales (`type:"traffic"`) or fee summaries (`type:"fees"`); `velocityFromStats(sku)` uses them when a SKU has no Sold moves in 90 days |
| `log` | auto | activity log (who, what, when, before/after summary) |
| `views` | auto | saved views (shared) |
| `counters/main` | — | `{purchases:68, shipments:52, …}` persisted; `nextNo()` = max(counter, max in data)+1 |

Common fields on every document: `id` (= doc id), `no` (same), `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt` (Trash), `oldRef` (legacy numbers, string or array), `tags` (array of tag ids), `notes`, `links` (array `{label,url}`), `docs` (object `{docTypeId:{url|assetId, at, by}}`), `custom` (object for Setup custom fields), `historic` (immutable: imported legacy), `refType` (reference type id), `yourRef` (counterparty's number), `refText` (auto-built reference string).

All list-valued fields store the **list item id**. Labels only via `L(listKey,id)`.

### 1.1 parties
`type` (list partyType) · `name` · `company` · `code` (auto from partyType.prefix) · `country` (list) · `cur` (list currency) · `terms` (list payTerms) · `leadDays` · `feePct` (China service fee %, only agents) · `viaAgent` (bool: fee applies) · `incoterm` (list) · `defaultMode` (list mode) · `originPort` (list) · `contact` · `wechat` · `email` · `phone` · `address` · `website` · `vatNo` · `eori` · `beneficiary` (text, role bank) · `defaultBank` (our bank id) · `defaultPlatform` · `defaultFee` (inspector) · `rateCard` (forwarder: `[{mode, basis:"kg"|"cbm", rate, cur, minKg}]`) · `status` (Active/Archived) · `suppliesSkus` derived.

### 1.2 products
`sku` (auto `BRAND-CAT[-SUB]-NN`, editable, unique, pattern `^[A-Z0-9]+(-[A-Z0-9]+)+$`) · `name` (AUTO suggestion from category/sub/pack) · `brand` (list) · `category` (list, two-level; top carries `hs`,`duty`,`goodsType`) · `packOf` · `unit` (list uom, default pack) · `isNew` (bool; auto false after first receipt) · `status` (list productStatus: active/discontinued/archived; `sellable` flag) · `sellGbp` · `ean[]` · `fnsku` · `asin` · `listings[]` `{marketplace,id,url}` · `pk{L,W,H,kg}` · `ctn{L,W,H,kg}` · `perCtn` · `hs` · `dutyPct` · `goodsType` · `originCountry` · `cycleDays` · `safetyDays` · `defaultMode` · `velocityOverride` · `suppliers[]` `{party, price, cur, moq, validFrom, lastPo, lastDate}` (latest first) · `priceHistory[]` · `components[]` `{sku,qty}` (bundle) · `photo` · `mergedInto`.

### 1.3 purchases
`kind` (list purchaseKind: china/uk/sample; item flags `freight`, `fee`, `stock`) · `party` · `account` (company id) · `date` · `readyDate` (AUTO date+leadDays) · `cur` · `incoterm` · `piNo` (yourRef) · `piLink` · `feePct` (default from party.viaAgent? product.isNew→fees.chinaNew:chinaOld) · `lines[]` `{sku, p (desc), q, u, a, feePct, shippedQ (derived), receivedQ (derived)}` · `extras[]` `{kind (list extraLine), a, n, belongsTo?, ref?, fee?}` (signed; see Mixed invoices in §4) · `total` (= Σa + Σfee + Σextras) · `totalGbpAtOrder` (fixed at order-date rate) · `schedule[]` `{pct, label, dueEvent (list dueEvent), due, paid (PAY no), amount}` · `status` (list poStatus, ordered steps: draft/ordered/deposit/production/inspected/shipped/part_received/received/closed/cancelled/hold) · `hold` (bool, inspection fail) · `folder` · `tracking` (UK) · `expectedDelivery` (UK) · `vatIncluded` (UK) · `docs`.

### 1.4 shipments
`party` (forwarder) · `mode` · `incoterm` · `goodsType` · `originPort` · `lines[]` `{po, sku, q, ctn}` (partial allowed; validation q ≤ ordered − already shipped) · `purchases[]` derived from lines · `ctn`,`kg`,`cbm` (AUTO from lines/products, editable) · `chargeBasis` (from mode: kg|cbm) · `rate` · `cost`,`costCur` (AUTO party.cur) · `platformFeePct` · `insurance` · `pallets` · `paidVia` (party id when netted via supplier) · `dispatch` · `eta` (AUTO, `_touched` guard) · `arrival` · `status` (list shipStatus: booked/in_transit/customs/arrived/part_delivered/delivered) · `tracking` · `awb` · `fwdInvNo` · `mrn` · `dutyBy` (list) · `deliverTo` (loc id) · `destinations[]` `{loc, ctn, fbaId, slot, received}` · `ukCosts[]` `{type (list ukCost), gbp, party, payRef, invoice}` · `folder` · `docs`.

### 1.5 payments
`party` · `direction` (out|in) · `type` (list payType) · `refType` (list refType.payment; AUTO) · `allocations[]` `{ref (PO/SH/IN/CN/RC), amount, belongsTo?, oref?, note?}` (AUTO first = full; parts for something else, see §4) · `amount` · `cur` · `gbp` (AUTO at rate-on-date; editable `gbpActual`) · `fxRate` (= gbp/amount) · `bankFeeGbp` · `date` · `bank` (our bank id, role bank) · `company` · `person` (list person, when paidBy ≠ company) · `email` · `platform` · `paidBy` · `status` (list payStatus: paid/pending/cancelled/refunded/reversed/failed) · `approved`,`approvedBy`,`approvedAt`,`needsApproval` · `receipt` (url) · `receiptAsset` · `invoice` (url) · `refundOf` · `dept` (derived from party.type via partyType.dept) · `match` (0–1) · `refText` (AUTO e.g. `VL PO-26-0067 DEP30 WAP-UK-JW20260907001`, copy button).

### 1.6 inspections
`po` · `party` · `plannedDate` · `date` · `qtyInspected` · `aql` (list) · `defects` · `result` (list inspResult: pending/pass/pass_remarks/fail) · `fee`,`cur` · `report` · `photos[]` (assets) · `reInspectionOf` · `docs`.

### 1.7 receipts
`src` (`SH-…` or `PO-…` for UK) · `pos[]` · `date` · `lines[]` `{sku, po, loc, q, damaged, landed (per pack £), batch}` · `ukCostsGbp` (derived from shipment.ukCosts + extra) · `dutyGbp` · `vatGbp` (import VAT, C79) · `c79Link` · `customsEntryNo` · `agent` (party) · `claim` `{status (list claimStatus), text, credit (CN no)}` · editable → recomputes `landed` and batch costs.

Landed per pack = (line goods £ at order rate + line share of China fee + freight share by chargeable weight of this line + line share of duty + line share of UK costs + (vat if company not VAT-registered)) / q. Damaged packs are booked into location `DMG` (Damaged) via auto move so they stay visible.

### 1.8 moves
`type` (list moveType, each with `effect`: `out|in|transfer|adjust|count|allocate`) · `sku` · `from` · `to` · `qty` (integer packs) · `channel` (list channel) · `orderId` · `priceGbp` · `courier` · `tracking` · `fbaId` · `reason` (list adjustReason, required for adjust/count) · `date` · `batch` (consumed batches detail) · `import` (IMP no) · `condition` (returns).
Stock = Σ receipts − Σ out + Σ in ± adjust, per (sku, loc). FIFO consume per batch; returns go back to latest batch at its cost. Count: form takes location + counted per SKU → creates adjust moves (counted − system) with reason `count_diff`.

### 1.9 credits
`party` · `po` · `receipt` · `amount`,`cur` · `reason` (list creditReason) · `status` (open/applied/refunded) · `appliedTo` (PAY/PO) — netted in `poState()` and party ledger.

### 1.10 imports
Smart Import engine lives in `importer.js` (after setup.js). Kinds: sales, returns, count, inventory (FBA inventory / ledger / restock), bizreport, fees, purchases (PI lines), orders (order register), pilines, shipments (packing list), freight (freight bills), payments, bank, products, parties, summary (not importable). IMP doc also keeps `updates[{col,id,before}]` (PI lines into a PO, fill-missing, bank matches, ASIN links) which Undo import restores. Learning in Setup: `importMemory{sigs,src,ignore,keep}`, `skuAliases`, `partyAliases{normKey:code}`, `listAliases{listKey|loc|bank|payer|skip:<type>:{normKey:id}}`.
`kind` (sales/count/purchases/payments/products/parties/inventory) · `file` · `rows` · `moveIds[]`/`docIds[]` · `mapping` · `channelLoc` · `dateFormat` · undo = trash all created docs.

---

## 2. Reference system (ERP style)

- **Our ref** = document `no` (auto). **Your ref** = counterparty number (`piNo`, forwarder invoice, Amazon shipment id…) — field label per form from Setup.
- **Reference type** (list `refType`, grouped by form: payment / purchase / shipment / inspection / move / credit). Each item: `id`, `label`, `code` (letters, e.g. DEP), `group`, `default` rule (e.g. payment: first payment on a PO → DEP, later → BAL, last → FIN; freight → FRT), owner can add any.
- **Reference text** auto-built from a pattern in Setup (`refPatterns.payment = "{acc} {ref} {type}{pct} {yourRef}"`) → `VL PO-26-0067 DEP30 WAP-UK-JW20260907001`; shown with a Copy button on the form and drawer; used as the bank/Wise/WeChat transfer reference so both sides match.
- **Related documents** block on every drawer: PO ↔ SH ↔ PAY ↔ IN ↔ RC ↔ CN ↔ MV, each clickable.
- **Tags** (list `tag`): free labels, filterable everywhere.
- **References page** = register: type anything (new no, old ref, your ref, AWB, tracking, FBA id, EAN) → resolves and opens; plus browse by department/party with old refs under each.

---

## 3. Setup document (`setup/main`)

```
companies[]   {id, name, tag (VL/BAY), vatNo, eori, vatRegistered, address, default, archived}
banks[]       {id, name, last4, cur, company, default, archived}
emails[]      {id, address, usedFor, archived}
people[]      {id, name, role, archived}            // who paid personally / VAs
locations[]   {id, name, kind (list locationKind), parent, address, archived, default:{receive|sell|ship}}
lists{key: {label, group, coded, fields:[[k,label,type]], items:[{id,label,code,parent,archived,default,...extra}]}}
  keys: partyType(prefix,dept,defaultCur,defaultCountry) · currency(symbol,decimals) · country · payTerms(template:[{pct,label,dueEvent}]) ·
        purchaseKind(freight,fee,stock) · poStatus(step) · shipStatus(step) · payStatus · payType · platform · paidBy · person? (use people) ·
        mode(days,basis,divisor) · incoterm · goodsType · originPort · dueEvent · docType(for:[collections]) · ukCost · extraLine(sign) ·
        moveType(effect) · adjustReason · claimStatus · creditReason · inspResult(blocks) · aql · productStatus(sellable) · brand(code) ·
        category(code,hs,duty,goodsType; two-level) · uom · marketplace(feePct,fulfilGbp,loc) · channel(loc) · locationKind · tag ·
        refType(group,code) · role · dutyBy · importKind · chargeOwner(refKind,recharge,personal) · extraLine(sign,feeable)
numbering{collection: pattern "{PFX}-{yy}-{####}", pfx}  + party prefixes from partyType
refPatterns{payment, purchase, shipment}
forms{formKey: {fields:[{k,l,t,list,opts,req,hidden,w,default,hint,role,order}], custom:[...]}}   // full override, editable in Setup
defaults{company, receiveLoc, sellLoc, shipTo, cur, mode, incoterm, approvalGbp, trashDays:30, reminderDays:7, reorderWarnDays:30, targetMarginPct:30}
fees{chinaNew:5, chinaOld:4, batchAlertPct:10, vatPct:20, dutyDefaultPct:5, volDivisorAir:6000, volDivisorExpress:5000, seaCbmMin:1}
rates{history:[{date, rmbGbp, usdGbp, ...perCurrency}]}      // rate on date = latest ≤ date
vatHistory[{date,pct}]
users[{uid, name, role, defaults{company,bank}, active}]
roles{roleId:{setup,approve,bank,deleteAny,edit,create,export}}
aliases{word:expansion}, skuAliases{alias:sku}
driveRoot "NEXUS", folderPattern "{no} {party} {what} {date}"
```
Setup editing: per-field save (`updateDoc` with path), undoable, no full-document overwrite; rename duplicates refused on edit too; coded lists show their extra fields; items can be reordered, defaulted, archived; custom fields get a type picker (text/num/date/bool/list(+which)/link/textarea) and are saved generically by every form.

---

## 4. Core API (core.js) — every module uses only these

State: `S` `{view:{k,params}, hist[], hi, f:{[page]:{...filters, sort, q}}, drawer, role, limit}`; `D` `{setup, parties, products, purchases, shipments, payments, inspections, receipts, moves, credits, imports, views, counters}`.

Dates: `today()`, `addDays(iso,n)`, `diffDays(a,b)`, `fmtD(iso)`, `monthKey(iso)` — pure UTC string arithmetic.
Setup: `SET()`, `L(listKey,id)` label, `items(listKey,{parent,all})`, `item(listKey,id)`, `defaultItem(listKey)`, `locs()`, `locName(id)`, `company(id)`, `bank(id)`.
Money: `cur(id)` → `{symbol,decimals}`, `rateOn(date,cur)`, `toGbp(amt,cur,date)`, `fmt(amt,cur)`, `gbp(x)`.
Numbers: `nextNo(col)` (counter ∪ data), `partyCode(type)`.
Parties/products: `party(code)`, `pname(code)`, `product(sku)`, `supplierPrice(sku,party)`.
Business: `poState(po)` → `{total, paidCur, paidGbp, outstandingCur, pct, stage, stepIndex, over, credits}` (in PI currency), `shipChargeable(sh)`, `shipCostGbp(sh)`, `freightShare(sh, line)`, `landedFor(receiptLine, ctx)`, `stockOf(sku)` → `{onHand, byLoc, transit, onOrder, batches[], avgCost, sold30, velocity}`, `reorderInfo(sku)`, `paysFor(ref)`, `matchOf(ref, amountGbp, excludeNo)`, `payCheck(p)`, `relatedDocs(col,id)`, `refTextFor(form, data)`, `defaultRefType(form, data)`, `searchText(col,x)` (cached per updatedAt), `searchAll(q)`, `resolveRef(q)`, `didYouMean(q)`, `norm`, `lev` (Damerau), `score`.
Writes: `beginBatch(label)`, `endBatch()`, `writeDoc(col,id,data,label)`, `updateDoc(col,id,patch,label)`, `trashDoc`, `restoreDoc`, `purgeTrash()`, `undo()`, `redo()`, `logEv()`. Undo groups by batch; checks `updatedAt` conflict.
Derivation (fix pass 25 Oct 26): `isCounted(pay)` (live + status paid + approved) is the only rule for money; `poState` subtracts credit notes and `writtenOff` (signed) and settles within ±0.50; `msCoverage`/`dueInfo` drive milestones everywhere; `openPOs()` (all but cancelled) is the owing rule for Home, lists, Reports, ledger, statement; `dueScope()` for alerts, Calendar, Cash. Every write notes what it touches and `await endBatch()` runs `recomputeCredit` → `recomputeShipment` → `recomputePO` (status from data: part_shipped/shipped/part_received/received, auto-close; milestone links; ready date pulled forward) → `recomputeLanded`, inside the same undo group, each change logged with its reason. Undo/redo re-derive and are logged. A currency without a rate converts to null (never 1:1). Damaged/quarantine locations (`location.quarantine`) are outside sellable stock and value.
Mixed invoices / payments (26 Oct 26): `extras[]` and `lines[]` may carry `belongsTo` (list `chargeOwner`: this_order (default, not stored) / other_order / other_company / other_brand / client / personal / shipping_other / other), `ref` (PO-/SH-/IN- no, `co:<company>`, `br:<brand>`, `pt:<party>`) and `fee` (China fee applies; default = this-order lines yes, this-order extras when `extraLine.feeable`, anything for something else no). `poSplit(p)` is the one split: `{invoiceTotal, thisOrder, lines, extras, fee, feeBase, feePct, others[{belongsTo,ref,label,amount,fee}], othersSum, computed, diff}`; `poTotal` = invoice total (what the supplier is owed). Landed cost / stock value / spend by product use only this order (`landedParts` leaves `othersSum` out). An amount for another order shows on that order via `poViaRows` (`poState.via/viaUsed/viaExtra`): it settles what that order still owes (`viaUsed`, counts toward its milestones) and anything beyond is an extra cost of that order (`viaExtra`, in its landed cost) — never an overpayment. Payment `allocations[]` rows may be "for something else": `{belongsTo, oref, note, amount, ref?}` (`isOtherAlloc`, `allocKept`); a doc `oref` is also stored as `ref` so it counts on that document; the main ref keeps the bank reference text (`refTextFor` ignores other parts). `recharges()` lists client / company / brand / personal / other amounts (Reports › Recharge, party drawer). `mixGuess(text,{self,party,date})` reads PI / payment text (PO no, old ref, "last order" + matching total, customs declaration, client / customer, "charged by X", personal) for the form assistant and the importer (decision card type `owner`; payment-summary split proposal; bank line bigger than an app payment → `split:PAY-…`). Saving a PO whose other-order charges change re-derives that order in the same batch (`touch.viaWhy`, logged).
Nav: `go(k,params,{keepFilters})`, `openDoc(col,id)` (pushes `{k:"doc"}` on history with underlying view), `back()`, `fwd()`, `closeDrawer()`, history snapshots `{view, f, q, limit, scrollY, drawer}`; hash mirror `#/purchases` `#/doc/purchases/PO-26-0067`.
Role: `can(perm)` from `setup.roles[user.role]`; role from `user` capability / `setup.users` (switcher visible only to Owner, labelled "View as").
Attention: `attention()` → sorted by severity `[{sev, text, col, id, action}]`; `calEvents(from,to)`.

Render contract: `render()` draws rail/tabbar + `#view` for `S.view.k` + re-opens drawer from `S.drawer`; skips rebuild when focus is inside `#setupbody`, a form, or Tools (`S.holdRender`); lists re-render only `#listbody` on filter/search change; drawer keeps `scrollTop`.

---

## 5. Forms engine (forms.js)

`fields(formKey)` = Setup `forms[formKey].fields` (with Setup defaults seeded from `FORM_DEFAULTS`) incl. custom; types: `ro, text, num, int, money, date, datetime, bool, textarea, link, file, opts, list(list,{parent,inlineAdd}), party(ptype), company, bank(role bank), email, person, loc, channel, sku, ref(kinds), tags, rows(spec)` (repeating rows with own column spec: lines, allocations, destinations, ukCosts, suppliers, listings, components, schedule, shipLines, countLines), `calc` (readonly computed).
Every list field renders `＋ Add…` (Owner) → inline input → adds item to Setup (duplicate check) → selects it.
`openForm(key, ctx)`; `ctx.edit` keeps `no` and all unseen fields (`{...old, ...formValues}`); `ctx.copy`; `ctx.ref`/`ctx.po`/`ctx.milestone` prefill. Drafts keyed `form+ctx.ref`, saved on input (debounced), restored with a "Draft for X — discard?" bar; dirty check on close (Esc/scrim) with confirm bar.
Per form: `init`, `sync` (AUTO fills with badge; `_touched` guards), `validate` (returns `{errors:{k:msg}, warnings:[], blocks:[]}` shown inline + summary; "Save anyway" for warnings only), `save` (batched writes; returns new/updated id; opens drawer from snapshot callback). Keyboard: Ctrl/⌘+Enter save, Esc close, focus trap, autofocus.
Forms: purchase, shipment, payment, inspection, receive, move, count, credit, product, party, import(mapper), setupItem (generic).
Validations (minimum): required by Setup; duplicates (sku, ean, party name+company, PI no per party, receipt url, payment party+amount+date±3d, PO same party+skus±7d warn); ranges (pct 0–100, int packs, from≠to, qty ≤ available, shipped ≤ ordered, received ≤ shipped, damaged ≤ q, dates ≥ order/dispatch, no future payments); price sanity (×5 block, ±30% warn vs latest supplier price in same currency); schedule 100% ascending; inspection fail → hold.

---

## 6. Views & drawers (views.js, drawers.js, setup.js)

Pages: home, purchases, shipments, payments, stock, products, parties, calendar, tools, refs (register), reports, import, trash, setup, attention (all alerts), log (activity), more.
Every list page: filter bar (options = Setup list ∪ distinct data values, unmapped flagged), date presets (today/7d/30d/90d/this month/last month/quarter/year/custom from–to; exclusive with Year), amount range, tags, sort ▼ (+ clickable headers desktop), search (uses `searchText`), saved views bar (shared `views` collection, inline name, rename/delete, normalised compare), count "(N of M)" + Show more / Show all, "Export this view" (role-filtered), bulk select (checkbox → archive/close/tag/export/mark arrived).
Drawers: openPO, openShip, openPay, openInsp, openReceipt, openMove, openCredit, openProduct, openParty, openImport — each with header (no, status pill, refText copy), stepper from Setup statuses, Related documents, Documents (per docType `for` collection; link or upload), Tags, footer actions incl. **Edit** (keeps number), Set status ▼, Trash (role), Copy/Reorder, PDF. Links to trashed items → toast with Restore. Phone: footer "More ▼" when > 3 actions; stepper shows current step text; row grids stack.
Home: tiles whose click opens the exact matching filter (owing / open shipments), Needs attention (severity-sorted, "All (N)"), cash 30/60/90 incl. freight/inspection/duty, recent activity, tasks (unmapped lines, shipments without orders, rates stale, unmapped legacy values).
Calendar: overdue group, event-type chips, month input, day click → create with date, events: due milestones, ETA, ready date, inspection planned, UK delivery, FBA slot, reorder, paid history.
Tools: product ▼ fills everything; service from mode list; channel ▼ fees from marketplace list; values kept in `S.tools`.
Reports: filter bar; outstanding by supplier, paid by month/party/account/currency, landed cost per SKU/batch, freight £/kg by mode, duty & import VAT by quarter, spend by product; Excel all / accountant / this view.
Trash: collection chips, days left, preview, Restore (toast with Open), Delete now (Owner, confirm), auto purge > trashDays on boot (logged).
Setup tabs: Companies, Banks & people, Emails, Locations, Lists (all keys, grouped; coded fields; reorder; default; map legacy values), Numbering & references (patterns, counters, refType groups, refPatterns), Forms & fields (rename/reorder/hide/require/default/custom with type+list), Rates & fees (history), Users & roles (matrix), Aliases (key editable), Backup (export/import Setup JSON, nightly Drive note).
Mobile: tab bar Home/Purchases/Shipments/Stock/More(+Create inside top bar); top bar Home/Back/Fwd/Search/Create; Undo/Redo/Bell in More and as toast; amounts in original currency primary.
A11y: dialog aria, listbox suggestions with ↑↓/Enter, aria-pressed chips, labelled × buttons, progressbar roles, toast aria-live, focus trap, `inert` behind drawer, text next to colour dots.
Keyboard: Ctrl/⌘K or `/` search, Esc, Ctrl/⌘Z/⇧Z (not inside select/input), Alt+←/→, N create, Ctrl/⌘+Enter save.

---

## 7. Seed migration (seed2 → seed3)
- labels → ids for mode/goodsType/deliverTo/type/platform/paidBy/bank/account; unmapped values kept in `legacy{field:value}` and listed in Setup → "Map legacy values" (one click maps all records).
- `party.depositPct` → percent; `terms` → payTerms id when recognisable; `feePct/viaAgent` only SUP-001.
- POs to FWD/INS parties → keep as purchases `kind:"service"` (list item) so they stay payable; flagged in tasks to convert.
- `[extra]` lines → `extras[]` with kind (fee/shipping/adjust/other) and sign.
- payments: `allocations=[{ref:forRef, amount}]`, `direction:"out"`, `fxRate=gbp/amount` backfilled, `status` ids, `type:"legacy"` archived list item, `refType` guessed from type/match.
- products: suppliers price+cur; isNew from latest PO desc containing "NEW"; category/brand ids (done).
- shipments: `lines` empty (unknown) → Home task "link orders"; `status` ids; `arrival`=`eta` when Delivered.
- counters from max numbers.
