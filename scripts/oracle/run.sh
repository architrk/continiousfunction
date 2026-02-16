#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-}"
SLUG="${2:-}"
PROMPT_FILE="${3:-}"
OUT_FILE="${4:-}"

if [ -z "${PORT}" ] || [ -z "${SLUG}" ] || [ -z "${PROMPT_FILE}" ] || [ -z "${OUT_FILE}" ]; then
  echo "Usage:"
  echo "  ./scripts/oracle/run.sh <port> <slug> <prompt-file> <write-output> [--file <path> ...]"
  echo ""
  echo "Example:"
  echo "  ./scripts/oracle/run.sh 9223 cf-discovery-next5-20260216 \\"
  echo "    prompts/cf-discovery-next-5.txt responses/cf-discovery-next5-20260216.md \\"
  echo "    --file data/foundationsData.ts --file data/visualizationMappings.ts"
  exit 2
fi

if [ ! -f "${PROMPT_FILE}" ]; then
  echo "Prompt file not found: ${PROMPT_FILE}" >&2
  exit 2
fi

mkdir -p "$(dirname "${OUT_FILE}")"

shift 4

oracle --engine browser --model "gpt-5 pro" --wait \
  --remote-chrome "127.0.0.1:${PORT}" \
  --slug "${SLUG}" \
  --prompt "$(cat "${PROMPT_FILE}")" \
  --write-output "${OUT_FILE}" \
  --browser-attachments always \
  --browser-bundle-files \
  --timeout auto \
  --heartbeat 60 \
  "$@"

