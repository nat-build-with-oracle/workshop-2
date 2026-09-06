#!/usr/bin/env bash
# Rebuild the site: index.html from decks.json, then stamp every page.
# Run this before any deploying commit.
set -euo pipefail
cd "$(dirname "$0")"
node build-index.mjs
./stamp.sh | tail -1
