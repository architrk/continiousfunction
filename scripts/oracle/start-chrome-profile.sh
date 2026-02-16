#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-9223}"
PROFILE_DIR="${2:-$HOME/ChromeOracleProfile-${PORT}}"
URL="${3:-https://chatgpt.com/}"

CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ ! -x "$CHROME_BIN" ]; then
  echo "Chrome not found at: $CHROME_BIN" >&2
  echo "Edit scripts/oracle/start-chrome-profile.sh for your platform." >&2
  exit 1
fi

"$CHROME_BIN" \
  --remote-debugging-port="$PORT" \
  --user-data-dir "$PROFILE_DIR" \
  --no-first-run --no-default-browser-check \
  "$URL" >/dev/null 2>&1 &

echo "Started Chrome for Oracle:"
echo "- DevTools: http://127.0.0.1:${PORT}/json/version"
echo "- Profile : ${PROFILE_DIR}"
echo "- URL     : ${URL}"
echo ""
echo "Next:"
echo "1) Log into ChatGPT in that Chrome window (manual login)."
echo "2) Run Oracle with: --remote-chrome 127.0.0.1:${PORT}"

