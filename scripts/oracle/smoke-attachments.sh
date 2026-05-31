#!/usr/bin/env bash
set -euo pipefail

STAMP="$(date +%Y%m%d-%H%M%S)"
SMOKE_DIR="responses/oracle-smoke"
PROMPT_FILE="${SMOKE_DIR}/attachment-smoke-${STAMP}.prompt.txt"
ATTACHMENT_FILE="${SMOKE_DIR}/attachment-smoke-${STAMP}.md"
OUT_FILE="${SMOKE_DIR}/attachment-smoke-${STAMP}.response.md"
SLUG="cf-oracle-attachment-smoke-${STAMP}"
SENTINEL="CF_ORACLE_ATTACHMENT_SMOKE_${STAMP}"

mkdir -p "${SMOKE_DIR}"

printf '%s\n' \
  "Oracle attachment smoke." \
  "" \
  "Read the attached file. Reply with exactly two lines:" \
  "CF_ORACLE_ATTACHMENT_SMOKE_OK" \
  "${SENTINEL}" \
  > "${PROMPT_FILE}"

printf '%s\n' \
  "# Oracle Attachment Smoke" \
  "" \
  "sentinel: ${SENTINEL}" \
  "" \
  "If you can read this file, the Oracle browser file-context path is working." \
  > "${ATTACHMENT_FILE}"

echo "[oracle-smoke] Prompt: ${PROMPT_FILE}"
echo "[oracle-smoke] Attachment: ${ATTACHMENT_FILE}"
echo "[oracle-smoke] Output: ${OUT_FILE}"
echo "[oracle-smoke] Attachment mode: ${ORACLE_BROWSER_ATTACHMENTS:-always}"
echo "[oracle-smoke] Bundle files: ${ORACLE_BROWSER_BUNDLE_FILES:-0}"

ORACLE_BROWSER_ATTACHMENTS="${ORACLE_BROWSER_ATTACHMENTS:-always}" \
ORACLE_BROWSER_BUNDLE_FILES="${ORACLE_BROWSER_BUNDLE_FILES:-0}" \
  ./scripts/oracle/run.sh "${SLUG}" "${PROMPT_FILE}" "${OUT_FILE}" --file "${ATTACHMENT_FILE}"

if ! [ -s "${OUT_FILE}" ]; then
  echo "[oracle-smoke] Missing response file: ${OUT_FILE}" >&2
  exit 1
fi

if ! grep -q "CF_ORACLE_ATTACHMENT_SMOKE_OK" "${OUT_FILE}"; then
  echo "[oracle-smoke] Response did not include success marker." >&2
  exit 1
fi

if ! grep -q "${SENTINEL}" "${OUT_FILE}"; then
  echo "[oracle-smoke] Response did not include sentinel from the attachment." >&2
  exit 1
fi

echo "[oracle-smoke] Attachment smoke passed: ${OUT_FILE}"
