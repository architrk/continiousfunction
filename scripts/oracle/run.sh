#!/usr/bin/env bash
set -euo pipefail

SLUG="${1:-}"
PROMPT_FILE="${2:-}"
OUT_FILE="${3:-}"

if [ -z "${SLUG}" ] || [ -z "${PROMPT_FILE}" ] || [ -z "${OUT_FILE}" ]; then
  echo "Usage:"
  echo "  ./scripts/oracle/run.sh <slug> <prompt-file> <write-output> [--file <path> ...]"
  echo ""
  echo "Example:"
  echo "  ./scripts/oracle/run.sh cf-discovery-next5-20260216 \\"
  echo "    prompts/cf-discovery-next-5.txt responses/cf-discovery-next5-20260216.md \\"
  echo "    --file data/foundationsData.ts --file data/visualizationMappings.ts"
  exit 2
fi

if [ ! -f "${PROMPT_FILE}" ]; then
  echo "Prompt file not found: ${PROMPT_FILE}" >&2
  exit 2
fi

mkdir -p "$(dirname "${OUT_FILE}")"

shift 3

EXTRA_ARGS=()
if [ "$#" -gt 0 ]; then
  EXTRA_ARGS=("$@")
fi
ORACLE_MODEL="${ORACLE_MODEL:-gpt-5.2-pro}"
if [ -z "${ORACLE_BIN:-}" ]; then
  if command -v oracle >/dev/null 2>&1; then
    ORACLE_BIN="oracle"
  elif [ -x "$HOME/.local/bin/oracle" ]; then
    ORACLE_BIN="$HOME/.local/bin/oracle"
  else
    ORACLE_BIN="oracle"
  fi
fi
ORACLE_BROWSER_PROFILE_DIR="${ORACLE_BROWSER_PROFILE_DIR:-$HOME/.oracle/browser-profile-continuous-function}"
ORACLE_BROWSER_ATTACHMENTS="${ORACLE_BROWSER_ATTACHMENTS:-never}"
ORACLE_BROWSER_BUNDLE_FILES="${ORACLE_BROWSER_BUNDLE_FILES:-0}"

HAS_FILE_ARGS=0
if [ "${#EXTRA_ARGS[@]}" -gt 0 ]; then
  for arg in "${EXTRA_ARGS[@]}"; do
    if [ "${arg}" = "--file" ] || [ "${arg}" = "-f" ]; then
      HAS_FILE_ARGS=1
      break
    fi
  done
fi

ORACLE_BROWSER_FILE_FLAGS=()
if [ "${HAS_FILE_ARGS}" = "1" ] && [ "${ORACLE_BROWSER_ATTACHMENTS}" != "never" ] && [ "${ORACLE_BROWSER_BUNDLE_FILES}" = "1" ]; then
  ORACLE_BROWSER_FILE_FLAGS+=(--browser-bundle-files)
fi

echo "[oracle-run] Using binary: ${ORACLE_BIN}"
echo "[oracle-run] Using model: ${ORACLE_MODEL}"
echo "[oracle-run] Using Oracle browser profile: ${ORACLE_BROWSER_PROFILE_DIR}"
echo "[oracle-run] Using browser attachment mode: ${ORACLE_BROWSER_ATTACHMENTS}"
if [ "${HAS_FILE_ARGS}" = "0" ]; then
  echo "[oracle-run] No --file arguments supplied."
elif [ "${ORACLE_BROWSER_ATTACHMENTS}" = "never" ]; then
  echo "[oracle-run] File context will be pasted inline. No upload chips are expected."
elif [ "${ORACLE_BROWSER_BUNDLE_FILES}" = "1" ]; then
  echo "[oracle-run] File uploads will be bundled because ORACLE_BROWSER_BUNDLE_FILES=1."
else
  echo "[oracle-run] File uploads will be sent as individual attachments when Oracle chooses upload mode."
fi

ORACLE_CMD=(
  "${ORACLE_BIN}" --engine browser --model "${ORACLE_MODEL}" --wait
  --browser-manual-login \
  --browser-keep-browser \
  --browser-model-strategy ignore \
  --slug "${SLUG}" \
  --prompt "$(cat "${PROMPT_FILE}")" \
  --write-output "${OUT_FILE}" \
  --browser-attachments "${ORACLE_BROWSER_ATTACHMENTS}" \
  --timeout auto \
  --heartbeat 60
)

if [ "${#ORACLE_BROWSER_FILE_FLAGS[@]}" -gt 0 ]; then
  ORACLE_CMD+=("${ORACLE_BROWSER_FILE_FLAGS[@]}")
fi

if [ "${#EXTRA_ARGS[@]}" -gt 0 ]; then
  ORACLE_CMD+=("${EXTRA_ARGS[@]}")
fi

ORACLE_BROWSER_PROFILE_DIR="${ORACLE_BROWSER_PROFILE_DIR}" "${ORACLE_CMD[@]}"
