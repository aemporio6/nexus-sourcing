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
