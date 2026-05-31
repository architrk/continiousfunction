#!/usr/bin/env bash
set -euo pipefail

cat >&2 <<'EOF'
This script is intentionally disabled for Continuous Function.

Normal Oracle work must use Oracle's documented persistent manual-login profile:
  ~/.oracle/browser-profile-continuous-function

Use:
  ./scripts/oracle/login.sh
  ./scripts/oracle/run.sh <slug> <prompt-file> <write-output> [--file <path> ...]

Do not start ad hoc Chrome profiles or --remote-chrome sessions for this repo.
EOF

exit 2
