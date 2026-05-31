#!/usr/bin/env bash
set -euo pipefail

ORACLE_BIN="${ORACLE_BIN:-oracle}"
ORACLE_BROWSER_PROFILE_DIR="${ORACLE_BROWSER_PROFILE_DIR:-$HOME/.oracle/browser-profile-continuous-function}"

cat <<EOF
[oracle-login] Opening Oracle's persistent browser profile:
  ${ORACLE_BROWSER_PROFILE_DIR}

Sign into ChatGPT there with:
  Archit Khare / adrinkscoffee@gmail.com

Leave the browser window open after login. Future ./scripts/oracle/run.sh calls
reuse this same Oracle profile with --browser-manual-login.
EOF

ORACLE_BROWSER_PROFILE_DIR="${ORACLE_BROWSER_PROFILE_DIR}" \
"${ORACLE_BIN}" --engine browser --browser-manual-login \
  --browser-keep-browser \
  --browser-input-timeout 120000 \
  --browser-auto-reattach-delay 5s \
  --browser-auto-reattach-interval 3s \
  --browser-auto-reattach-timeout 60s \
  -p "HI"
