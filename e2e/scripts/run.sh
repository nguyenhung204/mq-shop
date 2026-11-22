#!/usr/bin/env bash
# One command: fresh state -> stack up -> Playwright. Extra args go to `playwright test`.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
"$HERE/stack.sh" reset
"$HERE/stack.sh" frontend
cd "$HERE/../.."
rm -rf e2e/.auth
npx playwright test "$@"
