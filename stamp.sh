#!/usr/bin/env bash
# Stamp every page with a CalVer build marker, then you can tell at a glance
# whether the browser is showing you a cached copy.
#
#   v{yy}.{m}.{d}-alpha.{HMM}   e.g. 2026-09-06 14:30 → v26.9.6-alpha.1430
#
# Same format the skills CLI uses. Idempotent — re-running replaces the stamp
# rather than adding another. Run it before every commit that deploys.
set -euo pipefail
cd "$(dirname "$0")"

TZ_NAME="${STAMP_TZ:-Asia/Bangkok}"
V="v$(TZ="$TZ_NAME" date '+%y.%-m.%-d')-alpha.$(TZ="$TZ_NAME" date '+%H%M')"
WHEN="$(TZ="$TZ_NAME" date '+%Y-%m-%d %H:%M %Z')"

for f in index.html multi-agent.html multi-agent-full.html oracle-prism.html oracle-prism-full.html oracle-dna.html; do
  [ -f "$f" ] || continue
  # NB: `node` here is bun, and bun's -e does not pass positional args into
  # process.argv — argv[1] is undefined and every write silently no-ops.
  # Pass the path in the environment instead.
  F="$f" V="$V" WHEN="$WHEN" node -e '
    const fs = require("fs");
    const f = process.env.F, v = process.env.V, when = process.env.WHEN;
    let s = fs.readFileSync(f, "utf8");
    const label = `<span class="build" title="built ${when}">${v}</span>`;
    const re = /<span class="build"[^>]*>[^<]*<\/span>/;

    if (re.test(s)) {                       // already stamped — replace in place
      s = s.replace(re, label);
    } else if (/<span class="mark">/.test(s)) {   // decks: bottom chrome bar
      s = s.replace(/(<span class="mark">)/, `${label}$1`);
    } else if (/<footer>/.test(s)) {              // index: footer
      s = s.replace(/(<footer>)/, `$1${label} · `);
    }
    // one CSS rule, only if the page has not got it yet
    if (!/\.build\{/.test(s)) {
      s = s.replace(/<\/style>/, `.build{font-family:var(--mono);font-size:11.5px;color:var(--faint);opacity:.85;margin-right:10px;font-variant-numeric:tabular-nums}\n</style>`);
    }
    fs.writeFileSync(f, s);
  '
  printf "  %-24s %s\n" "$f" "$V"
done

echo "stamped $V  ($WHEN)"
