#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-9223}"
PROFILE_DIR="${2:-$HOME/ChromeOracleProfile-${PORT}}"
URL="${3:-https://chatgpt.com/}"
LOG_FILE="${4:-/tmp/chrome-oracle-${PORT}.log}"

CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

mkdir -p "$PROFILE_DIR"

LAUNCH_ARGS=(
  --remote-debugging-port="$PORT"
  --user-data-dir="$PROFILE_DIR"
  --no-default-browser-check
  --no-first-run
  --window-size=1280,720
  --lang=en-US
  --accept-lang=en-US,en
  "$URL"
)

# NOTE: We prefer launching via `open -na` on macOS. We've seen cases where
# exec'ing the Chrome binary directly causes MachPort rendezvous permission
# errors and the process exits immediately.
if command -v open >/dev/null 2>&1; then
  echo "Launching Chrome via 'open -na' (logs not captured)."
  echo "If you need verbose logs, run the Chrome binary directly instead." >"$LOG_FILE"
  open -na "Google Chrome" --args "${LAUNCH_ARGS[@]}" >/dev/null 2>&1 &
else
  if [ ! -x "$CHROME_BIN" ]; then
    echo "Chrome not found at: $CHROME_BIN" >&2
    echo "Edit scripts/oracle/start-chrome-profile.sh for your platform." >&2
    exit 1
  fi

  "$CHROME_BIN" "${LAUNCH_ARGS[@]}" >"$LOG_FILE" 2>&1 &
fi

# Give Chrome a moment to bind the DevTools socket.
for _ in $(seq 1 10); do
  if curl -sS --max-time 1 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

if ! curl -sS --max-time 1 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  echo "Failed to start Chrome DevTools on port ${PORT}." >&2
  echo "Log: ${LOG_FILE}" >&2
  tail -n 30 "$LOG_FILE" 2>/dev/null || true
  echo "" >&2
  echo "Troubleshooting:" >&2
  echo "- If Chrome is already running, this command must start a dedicated instance (new user-data-dir)." >&2
  echo "- Try a different port (e.g. 9224) and a fresh profile dir." >&2
  echo "- If it still fails, quit Chrome completely and retry." >&2
  exit 1
fi

echo "Started Chrome for Oracle:"
echo "- DevTools: http://127.0.0.1:${PORT}/json/version"
echo "- Profile : ${PROFILE_DIR}"
echo "- URL     : ${URL}"
echo "- Log     : ${LOG_FILE}"
echo ""
echo "Next:"
echo "1) Log into ChatGPT in that Chrome window (manual login)."
echo "2) Run Oracle with: --remote-chrome 127.0.0.1:${PORT}"
