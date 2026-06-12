#!/usr/bin/env bash
# Probe 3: member endpoints as GET (mirroring the SI web app's own calls),
# and POST with companyId/status params. Read-only.
set -uo pipefail

TOKEN=$(grep '^SMART_INSPECT_API_TOKEN=' .env.probe | cut -d= -f2- | tr -d '"')
[ -z "${TOKEN:-}" ] && { echo "No token in .env.probe"; exit 1; }

BASE="https://app.mysmartinspect.com/api"
mkdir -p probe-output

get() { # $1=name $2=path-with-query
  HTTP=$(curl -s -w "%{http_code}" -o "probe-output/$1.raw" "$BASE$2" \
    -H "authorization: SIQ-1 $TOKEN")
  python3 -m json.tool "probe-output/$1.raw" > "probe-output/$1.json" 2>/dev/null \
    && rm -f "probe-output/$1.raw" || mv "probe-output/$1.raw" "probe-output/$1.json"
  printf "GET  %-58s HTTP %s\n" "$2" "$HTTP"
}
post() { # $1=name $2=path $3=body
  HTTP=$(curl -s -w "%{http_code}" -o "probe-output/$1.raw" -X POST "$BASE$2" \
    -H "authorization: SIQ-1 $TOKEN" -H "content-type: application/json" -d "$3")
  python3 -m json.tool "probe-output/$1.raw" > "probe-output/$1.json" 2>/dev/null \
    && rm -f "probe-output/$1.raw" || mv "probe-output/$1.raw" "probe-output/$1.json"
  printf "POST %-58s HTTP %s\n" "$2" "$HTTP"
}

echo "--- exact call the SI web app makes ---"
get  g-memberGroups       "/listMemberGroups?companyId=1382&status=all"

echo "--- member endpoints as GET ---"
get  g-listMembers        "/listMembers?companyId=1382&status=all"
get  g-getMember          "/getMember?memberId=30"
get  g-getMember-co       "/getMember?companyId=1382&memberId=30"
get  g-getPermissions     "/getPermissions?permissionType=Access&companyId=1382"

echo "--- POST with companyId/status (web-app param names) ---"
post p-listMemberGroups   /listMemberGroups '{"companyId":1382,"status":"all"}'
post p-listMembers        /listMembers      '{"companyId":1382,"status":"all"}'
post p-getMember          /getMember        '{"companyId":1382,"memberId":30}'

echo
echo "Done. Tell Claude to read probe-output/."
