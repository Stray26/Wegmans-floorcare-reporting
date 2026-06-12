#!/usr/bin/env bash
# Probe 2: hunt for member/user endpoints and per-member permission lookups.
# Read-only. Usage: bash probe-si-members.sh
set -uo pipefail

TOKEN=$(grep '^SMART_INSPECT_API_TOKEN=' .env.probe | cut -d= -f2- | tr -d '"')
[ -z "${TOKEN:-}" ] && { echo "No token in .env.probe"; exit 1; }

BASE="https://app.mysmartinspect.com/api"
mkdir -p probe-output

call() { # $1=name $2=path $3=body
  HTTP=$(curl -s -w "%{http_code}" -o "probe-output/$1.raw" -X POST "$BASE$2" \
    -H "authorization: SIQ-1 $TOKEN" -H "content-type: application/json" -d "$3")
  python3 -m json.tool "probe-output/$1.raw" > "probe-output/$1.json" 2>/dev/null \
    && rm -f "probe-output/$1.raw" || mv "probe-output/$1.raw" "probe-output/$1.json"
  printf "%-34s %s %s\n" "$2 ($1)" "HTTP" "$HTTP"
}

echo "--- getPermissions with explicit memberId (does it accept one?) ---"
call perm-m30   /getPermissions '{"permissionType":"Access","memberId":30}'
call perm-m1    /getPermissions '{"permissionType":"Access","memberId":1}'
call perm-m31   /getPermissions '{"permissionType":"Access","memberId":31}'
call perm-m999  /getPermissions '{"permissionType":"Access","memberId":99999}'

echo "--- candidate member/user endpoints ---"
for ep in getMembers listMembers getMember getCompanyMembers getCompanyUsers \
          listUsers getInspectors listInspectors getClients getMemberDetails \
          getCompany getCompanyDetails getCompanyInfo getClientDetails; do
  call "ep-$ep" "/$ep" '{}'
done

echo "--- same candidates with apiVersion (error hinted at this) ---"
call ep-getCompanyDetails-v1 /getCompanyDetails '{"apiVersion":1}'
call ep-getCompanyDetails-vs /getCompanyDetails '{"apiVersion":"1"}'
call ep-getMembers-v1        /getMembers        '{"apiVersion":1}'

echo "--- inspectors via runWidgets (known-good endpoint) ---"
call widget-details /runWidgets '{"filters":{"inspectionRange":{"startDate":"2026-01-01T00:00:00Z","endDate":"2026-06-12T23:59:59Z","timezone":"America/New_York"},"configs":["Wegmans Floorcare Pilot"]},"widgets":{"inspection.details":{}}}'

echo
echo "Done. Tell Claude to read probe-output/."
