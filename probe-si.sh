#!/usr/bin/env bash
# Read-only Smart Inspect API probe. Saves raw responses to probe-output/.
# Usage:
#   1. vercel env pull .env.probe --environment=production
#   2. bash probe-si.sh
# Touches ONLY read endpoints. Never calls createTicket.
set -uo pipefail

TOKEN=$(grep '^SMART_INSPECT_API_TOKEN=' .env.probe | cut -d= -f2- | tr -d '"')
if [ -z "${TOKEN:-}" ]; then
  echo "No SMART_INSPECT_API_TOKEN found in .env.probe — run: vercel env pull .env.probe --environment=production"
  exit 1
fi

BASE="https://app.mysmartinspect.com/api"
mkdir -p probe-output

call() { # $1=output-name  $2=path  $3=json-body
  echo "→ $2  ($1)"
  HTTP=$(curl -s -w "%{http_code}" -o "probe-output/$1.raw" -X POST "$BASE$2" \
    -H "authorization: SIQ-1 $TOKEN" -H "content-type: application/json" -d "$3")
  echo "$HTTP" > "probe-output/$1.status"
  python3 -m json.tool "probe-output/$1.raw" > "probe-output/$1.json" 2>/dev/null \
    && rm "probe-output/$1.raw" \
    || mv "probe-output/$1.raw" "probe-output/$1.json"
  echo "   HTTP $HTTP"
}

# Known endpoints — full raw shapes
call permissions-access      /getPermissions     '{"permissionType":"Access"}'
call permissions-nobody      /getPermissions     '{}'
call company-details         /getCompanyDetails  '{}'
call config-20035            /getConfig          '{"configId":20035}'
call list-tags               /listTags           '{}'

# Probe for other permission types (error messages often reveal valid values)
call permissions-admin       /getPermissions     '{"permissionType":"Admin"}'
call permissions-role        /getPermissions     '{"permissionType":"Role"}'

# Speculative role/user endpoints — 404s are fine, we just want to know
call users                   /getUsers           '{}'
call roles                   /getRoles           '{}'
call user-details            /getUserDetails     '{}'

echo
echo "Done. Results in probe-output/ — tell Claude to read them."
