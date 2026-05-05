#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v lftp >/dev/null 2>&1; then
  echo "[deploy] Missing dependency: lftp"
  echo "[deploy] Install on macOS: brew install lftp"
  exit 1
fi

CF_FTP_PROTOCOL="${CF_FTP_PROTOCOL:-ftps}"

: "${CF_FTP_HOST:?Set CF_FTP_HOST (e.g. ftp.continuousfunction.ai)}"
: "${CF_FTP_USER:?Set CF_FTP_USER}"
: "${CF_FTP_PASS:?Set CF_FTP_PASS}"
: "${CF_FTP_REMOTE_DIR:?Set CF_FTP_REMOTE_DIR (e.g. /public_html or ..)}"

DELETE_FLAG=""
if [[ "${CF_FTP_DELETE:-0}" == "1" ]]; then
  DELETE_FLAG="--delete"
fi

LFTP_URL=""
LFTP_SECURITY_SETTINGS=""

case "${CF_FTP_PROTOCOL}" in
  ftps)
    LFTP_URL="ftps://${CF_FTP_HOST}"
    if [[ -n "${CF_FTP_PORT:-}" ]]; then
      LFTP_URL="${LFTP_URL}:${CF_FTP_PORT}"
    fi
    LFTP_SECURITY_SETTINGS=$'set ftp:ssl-force yes\nset ftp:ssl-protect-data yes\nset ssl:verify-certificate yes'
    ;;
  sftp)
    LFTP_URL="sftp://${CF_FTP_HOST}"
    if [[ -n "${CF_FTP_PORT:-}" ]]; then
      LFTP_URL="${LFTP_URL}:${CF_FTP_PORT}"
    fi
    LFTP_SECURITY_SETTINGS=$'set sftp:auto-confirm yes'
    ;;
  *)
    echo "[deploy] Unsupported CF_FTP_PROTOCOL: ${CF_FTP_PROTOCOL}"
    echo "[deploy] Supported values: ftps, sftp"
    exit 1
    ;;
esac

echo "[deploy] Building static export..."
npm run build

echo "[deploy] Uploading out/ via ${CF_FTP_PROTOCOL^^} to: ${CF_FTP_HOST} (remote: ${CF_FTP_REMOTE_DIR})"
echo "[deploy] Delete remote extras: ${CF_FTP_DELETE:-0} (set CF_FTP_DELETE=1 to enable)"

lftp "${LFTP_URL}" <<EOF
set cmd:fail-exit yes
set net:max-retries 2
set net:timeout 20
${LFTP_SECURITY_SETTINGS}
user "${CF_FTP_USER}" "${CF_FTP_PASS}"
cd "${CF_FTP_REMOTE_DIR}"
mirror -R --verbose --parallel=4 ${DELETE_FLAG} \
  --exclude public_html/ \
  --exclude-glob .DS_Store \
  --exclude-glob '*.map' \
  out/ .
bye
EOF

echo "[deploy] Done."
