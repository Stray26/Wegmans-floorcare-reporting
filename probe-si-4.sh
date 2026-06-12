#!/usr/bin/env bash
# Probe 4: member endpoints using the web-app session (SIQ-0) auth. Read-only GETs.
set -uo pipefail

AUTH="SIQ-0 4970c724-ce65-4529-8065-64f3f6456baf"
COOKIE="sessionID=cc8f2743c7fadd79152a5a03a2e5dce8d62b977c"
BASE="https://app.mysmartinspect.com/api"
mkdir -p probe-output

get() { # $1=name $2=path-with-query
  HTTP=$(curl -s -w "%{http_code}" -o "probe-output/$1.raw" "$BASE$2" \
    -H "authorization: $AUTH" -b "$COOKIE" -H "referer: https://app.mysmartinspect.com/" \
    -H "accept: application/json, text/plain, */*")
  python3 -m json.tool "probe-output/$1.raw" > "probe-output/$1.json" 2>/dev/null \
    && rm -f "probe-output/$1.raw" || mv "probe-output/$1.raw" "probe-output/$1.json"
  printf "GET  %-58s HTTP %s\n" "$2" "$HTTP"
}
post() { # $1=name $2=path $3=body
  HTTP=$(curl -s -w "%{http_code}" -o "probe-output/$1.raw" -X POST "$BASE$2" \
    -H "authorization: $AUTH" -b "$COOKIE" -H "referer: https://app.mysmartinspect.com/" \
    -H "content-type: application/json" -d "$3")
  python3 -m json.tool "probe-output/$1.raw" > "probe-output/$1.json" 2>/dev/null \
    && rm -f "probe-output/$1.raw" || mv "probe-output/$1.raw" "probe-output/$1.json"
  printf "POST %-58s HTTP %s\n" "$2" "$HTTP"
}

echo "--- session-auth member endpoints ---"
get s-memberGroups   "/listMemberGroups?companyId=1382&status=all"
get s-listMembers    "/listMembers?companyId=1382&status=all"
get s-getMember-30   "/getMember?memberId=30&companyId=1382"
get s-permissions    "/getPermissions?permissionType=Access&companyId=1382"

echo "--- per-member permissions via session auth ---"
post s-perm-m30      /getPermissions '{"permissionType":"Access","memberId":30}'

echo
echo "Done. Tell Claude to read probe-output/."
