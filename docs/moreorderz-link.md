# MY TOOL ↔ MoreOrderz link

This is what MoreOrderz needs so that MY TOOL can exchange data with it directly. Until then, the same packages travel as link files: MY TOOL downloads a file, and you load it into the other tool.

## The rule

Nothing moves without permission, not even one word.

- In MY TOOL (Settings › Link with MoreOrderz), each kind of data has a permission for each direction: **Always**, **Ask every time** or **Never**.
- **Ask every time** opens a review window. Every record and every field has its own tick box, and only ticked fields move.
- MoreOrderz should apply the same rule on its side: a permission per kind and direction, and a review screen for "Ask".
- One master switch turns the link off on each side. When it is off, nothing goes out and nothing is accepted.
- Bank details (`bank`, `beneficiary`, `iban`, `swift`, `account`, `sortCode`) are not sent unless the owner ticks "Include bank details".
- An incoming deletion is never applied by MY TOOL. It is only listed in the review.

## Package format

Both directions use this format. The `format` value is `mytool-link-1` when MY TOOL sends, and `moreorderz-link-1` when MoreOrderz sends.

```json
{
  "format": "mytool-link-1",
  "from": "MY TOOL",
  "company": "Vartleaves Limited",
  "sentAt": "2026-11-12T01:00:00.000Z",
  "sentBy": "aemporio6@gmail.com",
  "items": [
    { "kind": "purchases", "id": "PO-26-0071", "op": "upsert", "data": { "...": "the whole record" } },
    { "kind": "parties",   "id": "SUP-001",    "op": "delete", "data": {} }
  ]
}
```

### Kinds MY TOOL keeps

| Kind | Meaning |
|---|---|
| `purchases` | Orders (POs) |
| `shipments` | Shipments |
| `payments` | Payments |
| `inspections` | Inspections |
| `receipts` | Goods received |
| `moves` | Stock moves |
| `credits` | Credit notes |
| `products` | Products |
| `parties` | Suppliers and partners |
| `tasks` | Tasks |
| `salesStats` | Marketplace sales summaries |

Items of any other kind are listed in MY TOOL's review as "not kept by MY TOOL" and left out.

### Record ids

- `id` is the record's own number: `PO-26-0071`, `PAY-26-0178`, `SH-26-0056`, a product SKU, or a party code.
- MoreOrderz should store MY TOOL's id next to its own record, so the next exchange updates the same record instead of making a new one.

### Field names

`data` uses MY TOOL's field names. When MoreOrderz sends, it converts its registry fields to these names: `party`, `date`, `cur`, `total`, `lines[] {sku, q, u, a}`, `amount`, `allocations[] {ref, amount}`, and so on.

## Endpoints MoreOrderz adds

All three use HTTPS. Every request carries `Authorization: Bearer <link key>`. The link key is made in MoreOrderz › Settings, can be revoked there at any time, and is stored only on the MY TOOL owner's device.

| Method | Path | Does |
|---|---|---|
| GET | `/api/mytool/hello` | Returns `{ ok: true, company: "…" }`. Used by "Test connection". |
| POST | `/api/mytool/receive` | Body: a `mytool-link-1` package. MoreOrderz applies its own permissions: Always → apply; Ask → queue for review; Never → refuse. Returns `{ ok, applied, queued, refused }`. |
| GET | `/api/mytool/send?since=<ISO time>` | Returns a `moreorderz-link-1` package of the records changed since that time. It contains only kinds that MoreOrderz's permissions allow to go out. |

## Giving access, pausing, moving over

- **Give access:** turn the link on, enter the MoreOrderz address, and paste the link key.
- **Pause:** turn the switch off on either side. Revoking the key in MoreOrderz also stops the link at once.
- **Move everything to MoreOrderz:** set every "Send" permission to Always and press "Send to MoreOrderz". Each record goes once. Records you declined or unticked are offered again next time.
- **Bring everything into MY TOOL:** the same, in the other direction.

## Log

Every send and every receive goes into MY TOOL's Activity log and the link's History. Each entry records who did it, when, how many records moved, which ids, how many were blocked, and whether it went as a file or through the direct connection.
