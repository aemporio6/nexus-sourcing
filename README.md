# MY TOOL

Sourcing, purchase orders, payments, shipments, stock and planning for Vartleaves.

- Web app (GitHub Pages): `https://aemporio6.github.io/nexus-sourcing/`
- Sign in with Google. Data lives in the admin's Google Drive (folder **MY TOOL – DATA**), never in this repository.
- Works on Windows, Mac, Android and iPhone; can be installed ("Add to Home Screen").

## Build
`python3 build.py` → `index.html`, `sw.js`. Source in `src/`.

## Backups
- While an admin uses the app, a same-day copy "MYTOOL-DATA backup YYYY-MM-DD.json" is made in the data folder (Data health › Version history).
- **Independent daily backup** (runs even when nobody opens the app): `tools/daily-backup.gs` — a Google Apps Script set up once in the data owner's account (instructions at the top of the file). It copies the data file every night, verifies the copy, keeps 30 daily / 12 weekly / all monthly copies and emails the owner if it fails.

## Data gateway (recommended)
`tools/gateway.gs` — an Apps Script web app in the data owner's account. With it, nobody needs Drive access to the data file: every read and save goes through the gateway, which verifies the caller's Google token, enforces the roles from Setup › Users at the data itself (create / edit / trash / Setup / users; bank details hidden from roles without "bank"), and refuses saves made from an old version (compare-and-swap). Set-up steps are at the top of the file; switch on in Setup › Users › Data gateway, then "Lock data folder".

## Tests
| Suite | Command | Checks |
|---|---|---|
| Importer (owner's real files + public formats) | `bash tests/imp/run_all.sh` | 316 |
| Gateway rules (Node, no Google) | `node tests/gw/t_gateway.js` | 27 |
| Gateway end-to-end (app + rules) | `node tests/gw/t_gw_client.js` (repo on :8098, `SEED_FILE=…`) | 13 |
| Google sign-in, Drive, backup + restore | `node tests/t_google.js` (repo on :8098) | 18 |
| Sync: merge, conflicts chooser, offline, upload failure | `node tests/t_sync.js` (repo on :8098) | 23 |
| Calculations with expected values | `node tests/t_calc.js` (demo on :8093) | 9 |
| Trash guard + CSV guard | `node tests/t_guard.js` (demo on :8093) | 6 |
| Save & add another, touch targets | `node tests/t_daily.js` (demo on :8093) | 6 |
| Importer row report | `node tests/t_impreport.js` (demo on :8093) | 6 |
| Planner (ICC) | `node tests/icc/t_icc.js` (demo on :8096) | 44 |
| Payment Summary export | `bash tests/ps/run.sh` | — |
Demo build for the :8093 suites: `python3 build.py --demo-seed /tmp/mt_seed_start --out /tmp/mt_g/index.html` (seed from `make_start.py` + `to_dir.py`), served with `python3 -m http.server 8093` in that folder.

## Measured (4 Nov 2026, demo data: 69 orders, 177 payments, 35 products, 440 KB)
Ready in ~1 s (DOMContentLoaded 0.58 s); Purchases list render 65 ms; Home 59 ms; Data health 19 ms; one search 18 ms; open an order 114 ms. At 5× the data: list 208 ms, health 102 ms, search 73 ms — no optimisation needed yet.
