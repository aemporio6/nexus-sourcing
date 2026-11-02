#!/bin/bash
# Build the demo copy (real starting data), serve it on :8097 and run every importer test. Usage: tests/imp/run_all.sh
R=$(cd "$(dirname "$0")/../.." && pwd); export NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules}
bash "$R/tests/demo.sh" /tmp/mt_imp 8097 </dev/null >/dev/null 2>&1
python3 -I "$R/tests/imp/gen_expected.py" >/dev/null || exit 1
fail=0
for t in t_fixed t_eco t_listings t_market t_ui legacy/test; do
  printf "%-12s " "$t"; out=$(cd /tmp && timeout 1500 node "$R/tests/imp/$t.js" 2>&1); echo "$out" | grep -E "^OKS|^CRASH" | tail -1
  echo "$out" | grep -E "^FAIL|^CRASH" ; echo "$out" | grep -qE "^FAIL|^CRASH|FAILS: [1-9]" && fail=1
done
exit $fail
