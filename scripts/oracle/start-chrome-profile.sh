#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-9223}"
PROFILE_DIR="${2:-$HOME/ChromeOracleProfile-${PORT}}"
URL="${3:-https://chatgpt.com/}"
LOG_FILE="${4:-/tmp/chrome-oracle-${PORT}.log}"

CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ ! -x "$CHROME_BIN" ]; then
  echo "Chrome not found at: $CHROME_BIN" >&2
  echo "Edit scripts/oracle/start-chrome-profile.sh for your platform." >&2
  exit 1
fi

mkdir -p "$PROFILE_DIR"

# NOTE: On macOS, launching Chrome without these "automation-friendly" flags can
# cause it to attach to an existing session and ignore --remote-debugging-port.
# This flag set matches Oracle's browser engine so we reliably get a dedicated
# instance + DevTools port.
"$CHROME_BIN" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE_DIR" \
  --disable-features=Translate,OptimizationHints,MediaRouter,DialMediaRouteProvider,CalculateNativeWinOcclusion,InterestFeedContentSuggestions,CertificateTransparencyComponentUpdater,AutofillServerCommunication,PrivacySandboxSettings4,RenderDocument \
  --disable-extensions \
  --disable-component-extensions-with-background-pages \
  --disable-background-networking \
  --disable-component-update \
  --disable-client-side-phishing-detection \
  --disable-sync \
  --metrics-recording-only \
  --disable-default-apps \
  --mute-audio \
  --no-default-browser-check \
  --no-first-run \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-background-timer-throttling \
  --disable-ipc-flooding-protection \
  --password-store=basic \
  --use-mock-keychain \
  --force-fieldtrials='*BackgroundTracing/default/' \
  --disable-hang-monitor \
  --disable-prompt-on-repost \
  --disable-domain-reliability \
  --propagate-iph-for-testing \
  --disable-breakpad \
  --disable-popup-blocking \
  --disable-translate \
  --safebrowsing-disable-auto-update \
  --disable-features=TranslateUI,AutomationControlled \
  --window-size=1280,720 \
  --lang=en-US \
  --accept-lang=en-US,en \
  "$URL" >"$LOG_FILE" 2>&1 &

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
