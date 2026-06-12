#!/usr/bin/env bash
# Probe 5: full login-flow test as a member. Prompts for credentials (kept out
# of shell history). Read-only: startSession + permission/identity lookups.
# Usage: bash probe-si-5.sh
set -uo pipefail

BASE="https://app.mysmartinspect.com/api"
mkdir -p probe-output

read -p    "SI username (email): " SI_U
read -s -p "SI password: " SI_P; echo
export SI_U SI_P

BODY=$(python3 -c 'import json,os; print(json.dumps({"username":os.environ["SI_U"],"memberPassword":os.environ["SI_P"]}))')

echo "--- 1. startSession ---"
HTTP=$(curl -s -w "%{http_code}" -o probe-output/m-session.json -X POST "$BASE/startSession" \
  -H "content-type: application/json" -H "authorization: SIQ-0 null" \
  -H "origin: https://app.mysmartinspect.com" -H "referer: https://app.mysmartinspect.com/" \
  -d "$BODY")
echo "startSession HTTP $HTTP"
python3 -m json.tool probe-output/m-session.json > /tmp/ms.json 2>/dev/null && mv /tmp/ms.json probe-output/m-session.json

# Extract a session token: any string value that looks like a UUID or any key containing 'token'
TOKEN=$(python3 - <<'EOF'
import json, re
d = json.load(open('probe-output/m-session.json'))
found = []
def walk(x, key=''):
    if isinstance(x, dict):
        for k, v in x.items(): walk(v, k)
    elif isinstance(x, list):
        for v in x: walk(v, key)
    elif isinstance(x, str):
        if 'token' in key.lower() or re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', x):
            found.append((key, x))
walk(d)
print(found[0][1] if found else '')
EOF
)
if [ -z "$TOKEN" ]; then
  echo "!! Could not auto-extract a token from the response — Claude will read m-session.json."
  exit 0
fi
echo "Got session token (${TOKEN:0:8}…)"

call() { # $1=name $2=method $3=path $4=body(optional)
  if [ "$2" = "GET" ]; then
    HTTP=$(curl -s -w "%{http_code}" -o "probe-output/$1.raw" "$BASE$3" \
      -H "authorization: SIQ-0 $TOKEN" -H "referer: https://app.mysmartinspect.com/")
  else
    HTTP=$(curl -s -w "%{http_code}" -o "probe-output/$1.raw" -X POST "$BASE$3" \
      -H "authorization: SIQ-0 $TOKEN" -H "content-type: application/json" \
      -H "referer: https://app.mysmartinspect.com/" -d "${4:-{}}")
  fi
  python3 -m json.tool "probe-output/$1.raw" > "probe-output/$1.json" 2>/dev/null \
    && rm -f "probe-output/$1.raw" || mv "probe-output/$1.raw" "probe-output/$1.json"
  printf "%-4s %-50s HTTP %s\n" "$2" "$3" "$HTTP"
}

echo "--- 2. what can this member's session see? ---"
call m-permissions POST /getPermissions '{"permissionType":"Access"}'
call m-widgets     POST /runWidgets '{"filters":{"inspectionRange":{"startDate":"2026-04-01T00:00:00Z","endDate":"2026-04-30T23:59:59Z","timezone":"America/New_York"},"configs":["Wegmans Floorcare Pilot"]},"widgets":{"inspection.details":{}}}'
call m-listMembers GET  "/listMembers?companyId=1382&status=all"

echo
echo "Done. Tell Claude to read probe-output/ (files m-*.json)."
