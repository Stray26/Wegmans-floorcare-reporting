#!/usr/bin/env bash
# Probe 6: member-session calls WITH companyId (sessions span companies).
# Read-only. Usage: bash probe-si-6.sh
set -uo pipefail
BASE="https://app.mysmartinspect.com/api"
mkdir -p probe-output

read -p    "SI username (email): " SI_U
read -s -p "SI password: " SI_P; echo
export SI_U SI_P
BODY=$(python3 -c 'import json,os; print(json.dumps({"username":os.environ["SI_U"],"memberPassword":os.environ["SI_P"]}))')

HTTP=$(curl -s -w "%{http_code}" -o probe-output/m6-session.json -X POST "$BASE/startSession" \
  -H "content-type: application/json" -H "authorization: SIQ-0 null" -d "$BODY")
TOKEN=$(python3 -c "import json; print(json.load(open('probe-output/m6-session.json')).get('sessionToken',''))")
[ -z "$TOKEN" ] && { echo "startSession failed (HTTP $HTTP)"; exit 1; }
echo "startSession HTTP $HTTP — token ${TOKEN:0:8}…"

call() { # $1=name $2=method $3=path $4=body
  if [ "$2" = "GET" ]; then
    HTTP=$(curl -s -w "%{http_code}" -o "probe-output/$1.raw" "$BASE$3" -H "authorization: SIQ-0 $TOKEN")
  else
    HTTP=$(curl -s -w "%{http_code}" -o "probe-output/$1.raw" -X POST "$BASE$3" \
      -H "authorization: SIQ-0 $TOKEN" -H "content-type: application/json" -d "$4")
  fi
  python3 -m json.tool "probe-output/$1.raw" > "probe-output/$1.json" 2>/dev/null \
    && rm -f "probe-output/$1.raw" || mv "probe-output/$1.raw" "probe-output/$1.json"
  printf "%-4s %-44s HTTP %s\n" "$2" "$3 ($1)" "$HTTP"
}

call m6-permissions POST /getPermissions '{"permissionType":"Access","companyId":1382}'
call m6-widgets     POST /runWidgets '{"companyId":1382,"filters":{"companyId":1382,"inspectionRange":{"startDate":"2026-04-01T00:00:00Z","endDate":"2026-04-30T23:59:59Z","timezone":"America/New_York"},"configs":["Wegmans Floorcare Pilot"]},"widgets":{"inspection.details":{}}}'
call m6-getconfig   POST /getConfig '{"configId":20035,"companyId":1382}'
call m6-configs-g   GET  "/getCompanyDetails?companyId=1382"
call m6-listconfigs GET  "/listConfigs?companyId=1382"

echo
echo "Done. Tell Claude to read probe-output/ (m6-*.json)."
