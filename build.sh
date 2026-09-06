#!/usr/bin/env bash
# Rebuild the site. Order matters:
#   1. stamp the decks   — so the generator can read their build stamps
#   2. build the index   — derives slide counts + stamps into decks.manifest.json
#   3. stamp again       — the freshly generated index.html has no stamp yet
# Doing 2 before 1 leaves `"build": null` in the manifest, which is how this
# ordering was found.
set -euo pipefail
cd "$(dirname "$0")"
./stamp.sh > /dev/null
node build-index.mjs
./stamp.sh | tail -1
