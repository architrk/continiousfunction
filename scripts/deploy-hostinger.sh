#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v lftp >/dev/null 2>&1; then
  echo "[deploy] Missing dependency: lftp"
  echo "[deploy] Install on macOS: brew install lftp"
  exit 1
fi

: "${CF_FTP_HOST:?Set CF_FTP_HOST (e.g. ftp.continuousfunction.ai)}"
: "${CF_FTP_USER:?Set CF_FTP_USER}"
: "${CF_FTP_PASS:?Set CF_FTP_PASS}"
: "${CF_FTP_REMOTE_DIR:?Set CF_FTP_REMOTE_DIR (e.g. /public_html or ..)}"

DELETE_FLAG=""
if [[ "${CF_FTP_DELETE:-0}" == "1" ]]; then
  DELETE_FLAG="--delete"
fi

echo "[deploy] Building static export..."
npm run build

echo "[deploy] Uploading out/ via FTP to: ${CF_FTP_HOST} (remote: ${CF_FTP_REMOTE_DIR})"
echo "[deploy] Delete remote extras: ${CF_FTP_DELETE:-0} (set CF_FTP_DELETE=1 to enable)"

lftp -c "
set ftp:ssl-allow no
set net:max-retries 2
set net:timeout 20
open -u \"${CF_FTP_USER}\",\"${CF_FTP_PASS}\" ftp://${CF_FTP_HOST}
cd ${CF_FTP_REMOTE_DIR}
mirror -R --verbose --parallel=4 ${DELETE_FLAG} \
  --exclude public_html/ \
  --exclude-glob .DS_Store \
  --exclude-glob '*.map' \
  out/ .
bye
"

echo "[deploy] Done."

