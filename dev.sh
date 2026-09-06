#!/usr/bin/env bash
# Local preview + deck registrar. Not part of the deployed site.
set -euo pipefail
cd "$(dirname "$0")"
exec node dev.mjs "$@"
