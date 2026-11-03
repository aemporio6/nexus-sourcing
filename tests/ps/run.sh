#!/bin/bash
# Payment Summary export: build both demo data sets, click the buttons (Playwright), check the downloads (openpyxl).
# usage: tests/ps/run.sh [owner.xlsx]
R=$(cd "$(dirname "$0")/../.." && pwd)
OWNER=${1:-/tmp/claude-0/-home-claude/117846c6-ab7f-5f52-9a04-3582b9919749/scratchpad/paysum/PAYMENT SUMMARY (organised 1 Nov 2026).xlsx}
export NODE_PATH=/opt/npm-tools/node_modules; rc=0
bash "$R/tests/demo.sh" /tmp/mt_ps 8094 || exit 1
node "$R/tests/ps/t_ps.js" /tmp/mt_ps/out_seed3 || rc=1
python3 -I "$R/tests/ps/check_ps.py" /tmp/mt_ps/out_seed3/desktop_reports.xlsx /tmp/mt_ps/out_seed3/app.json "$OWNER" || rc=1
python3 "$R/build.py" --demo-seed /tmp/mt_seed_start --out /tmp/mt_ps/index.html || exit 1
node "$R/tests/ps/t_ps.js" /tmp/mt_ps/out_new || rc=1
for f in desktop_reports desktop_payments phone_payments; do python3 -I "$R/tests/ps/check_ps.py" /tmp/mt_ps/out_new/$f.xlsx /tmp/mt_ps/out_new/app.json "$OWNER" --expect-val107 || rc=1; done
exit $rc
