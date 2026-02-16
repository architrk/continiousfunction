#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-9223}"
PROFILE_DIR="${2:-$HOME/ChromeOracleProfile-${PORT}}"
URL="${3:-https://chatgpt.com/}"

# macOS: `open -na` forces a new Chrome instance; invoking the binary directly
# often reuses an existing session and ignores flags like --remote-debugging-port.
if ! command -v open >/dev/null 2>&1; then
  echo "This helper is currently macOS-only (requires: open)." >&2
  exit 1
fi

open -na "Google Chrome" --args \
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
