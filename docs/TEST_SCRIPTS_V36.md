# v3.6 End-to-End Test Scripts (All Phases)

This single file provides copy-paste friendly scripts to validate Phase 1–4. Use either the PowerShell or Bash section for each test.

Set these variables first (substitute your values):

PowerShell
```
$BASE = "http://localhost:4000"
$TENANT = "<your_tenant_id>"
$TOKEN = "$(Get-Content env:ACCESS_TOKEN)"  # or paste a valid bearer
```

Bash
```
BASE="http://localhost:4000"
TENANT="<your_tenant_id>"
TOKEN="${ACCESS_TOKEN}"   # export ACCESS_TOKEN first or paste directly
```

---

## Phase 1 — Tenant Context, Flags, Security

Prereqs:
- Web: set `FF_TENANT_URLS=true` (NEXT_PUBLIC_FF_TENANT_URLS or server env for middleware).
- API: set `FF_ENFORCE_CSRF=true` to enforce CSRF on writes.

1) Canonical URL redirects (manual)
- Visit: `http://localhost:3000/items?tenantId=$TENANT`
- Expect 301 → `/t/$TENANT/items` and a `tcx` cookie set.

2) CSRF enforcement on writes
- Try write WITHOUT CSRF header. Expect 403 when flag is on.

PowerShell
```
# Missing x-csrf-token should fail when FF_ENFORCE_CSRF=true
$body = @{ tenant_id=$TENANT; business_name="Test Co" } | ConvertTo-Json
curl -Method POST -Uri "$BASE/tenant/profile" -Headers @{ "Authorization"="Bearer $TOKEN"; "Content-Type"="application/json" } -Body $body
```

Bash
```
body='{"tenant_id":"'$TENANT'","business_name":"Test Co"}'
curl -i -X POST "$BASE/tenant/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$body"
```

- Get `csrf` cookie then send with header. Expect 200.

PowerShell
```
# First request to get CSRF cookie issued
curl -Method GET -Uri "$BASE/health" | Out-Null
$csrf = (curl -Method GET -Uri "$BASE/health" -Headers @{"Authorization"="Bearer $TOKEN"} -PassThru).Headers["Set-Cookie"] | Select-String -Pattern "csrf=.*?;" | ForEach-Object { $_.Matches.Value.Split('=')[1].TrimEnd(';') } | Select-Object -First 1
$body = @{ tenant_id=$TENANT; business_name="Test Co" } | ConvertTo-Json
curl -Method POST -Uri "$BASE/tenant/profile" -Headers @{ "Authorization"="Bearer $TOKEN"; "Content-Type"="application/json"; "Cookie"="csrf=$csrf"; "x-csrf-token"="$csrf" } -Body $body
```

Bash
```
# Get csrf cookie
curl -c /tmp/c.jar "$BASE/health" >/dev/null
csrf=$(grep csrf /tmp/c.jar | awk '{print $7}')
body='{"tenant_id":"'$TENANT'","business_name":"Test Co"}'
curl -i -X POST "$BASE/tenant/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $csrf" \
  -b "/tmp/c.jar" -d "$body"
```

---

## Phase 2 — Governance & UX Compliance

Prereqs:
- API: `FF_FEED_ALIGNMENT_ENFORCE=true`.
- Some items are active+public and either missing category or unmapped.

1) Precheck (summary of missing/unmapped)

PowerShell
```
curl -Method POST -Uri "$BASE/api/$TENANT/feed/precheck" | ConvertFrom-Json | Format-List
```

Bash
```
curl -s -X POST "$BASE/api/$TENANT/feed/precheck" | jq
```

2) Validate (full validation set)

PowerShell
```
curl -Method GET -Uri "$BASE/api/$TENANT/feed/validate" | ConvertFrom-Json | Select-Object -Expand data | Format-List
```

Bash
```
curl -s "$BASE/api/$TENANT/feed/validate" | jq
```

3) Push feed (expect 422 alignment_required when unmapped exists)

PowerShell
```
$resp = curl -Method POST -Uri "$BASE/api/feed-jobs" -Headers @{"Content-Type"="application/json"} -Body (@{ tenantId=$TENANT } | ConvertTo-Json) -PassThru
$resp.StatusCode
$resp.Content | Write-Output
```

Bash
```
curl -i -X POST "$BASE/api/feed-jobs" -H "Content-Type: application/json" -d '{"tenantId":"'$TENANT'"}'
```

UI (manual):
- Edit Item modal → Sticky Quick Actions Footer appears when `FF_CATEGORY_QUICK_ACTIONS` is enabled.
- Shortcuts: Alt+G (Align), Alt+V (Validate), Alt+S (Save & Return).

---

## Phase 3 — Observability & DX

Prereqs:
- API: `FF_AUDIT_LOG=true` to enable auditing.

1) Audit writes for category lifecycle

PowerShell
```
# Create category
$cat = curl -Method POST -Uri "$BASE/api/v1/tenants/$TENANT/categories" -Headers @{"Content-Type"="application/json"} -Body '{"name":"Test Cat","slug":"test-cat"}' | ConvertFrom-Json
$catId = $cat.data.id
# Align category
curl -Method POST -Uri "$BASE/api/v1/tenants/$TENANT/categories/$catId/align" -Headers @{"Content-Type"="application/json"} -Body '{"googleCategoryId":"123"}' | Out-Null
# Update category
curl -Method PUT -Uri "$BASE/api/v1/tenants/$TENANT/categories/$catId" -Headers @{"Content-Type"="application/json"} -Body '{"name":"Test Cat 2"}' | Out-Null
# Delete (soft)
curl -Method DELETE -Uri "$BASE/api/v1/tenants/$TENANT/categories/$catId" | Out-Null
```

Bash
```
catId=$(curl -s -X POST "$BASE/api/v1/tenants/$TENANT/categories" -H "Content-Type: application/json" -d '{"name":"Test Cat","slug":"test-cat"}' | jq -r .data.id)
curl -s -X POST "$BASE/api/v1/tenants/$TENANT/categories/$catId/align" -H "Content-Type: application/json" -d '{"googleCategoryId":"123"}' >/dev/null
curl -s -X PUT "$BASE/api/v1/tenants/$TENANT/categories/$catId" -H "Content-Type: application/json" -d '{"name":"Test Cat 2"}' >/dev/null
curl -s -X DELETE "$BASE/api/v1/tenants/$TENANT/categories/$catId" >/dev/null
```

2) Audit item category assignment

PowerShell
```
$assignBody = @{ tenantCategoryId=$catId } | ConvertTo-Json
curl -Method PATCH -Uri "$BASE/api/v1/tenants/$TENANT/items/<item_id>/category" -Headers @{"Content-Type"="application/json"} -Body $assignBody
```

Bash
```
curl -s -X PATCH "$BASE/api/v1/tenants/$TENANT/items/<item_id>/category" -H "Content-Type: application/json" -d '{"tenantCategoryId":"'$catId'"}' | jq
```

3) Verify audit_log rows (via psql)

SQL
```
-- Connect to DB, then:
SELECT action, tenant_id, occurred_at, payload->>'requestId' AS request_id
FROM audit_log
WHERE tenant_id = '<TENANT_UUID>'
ORDER BY occurred_at DESC
LIMIT 20;
```

4) Coverage endpoint

PowerShell
```
curl -Method GET -Uri "$BASE/api/$TENANT/categories/coverage" | ConvertFrom-Json | Select -Expand data | Format-List
```

Bash
```
curl -s "$BASE/api/$TENANT/categories/coverage" | jq
```

---

## Phase 4 — Platform Ops & Analytics

1) View exists and returns data

SQL
```
SELECT * FROM v_feed_category_resolved WHERE tenant_id = '<TENANT_UUID>' LIMIT 10;
```

2) CI Schema Drift (conceptual)
- Run nightly: compare current migrations vs `$PROD_DB_SNAPSHOT_URL`. Example commands:
```
# prisma migrate diff or pg_dump based comparison (pseudo commands)
# prisma migrate diff --from-url=$PROD_DB_SNAPSHOT_URL --to-url=$DATABASE_URL --script > drift.sql
# or: pg_dump -s $PROD_DB_SNAPSHOT_URL > prod_schema.sql && pg_dump -s $DATABASE_URL > head_schema.sql && diff -u prod_schema.sql head_schema.sql
```
- Fail the pipeline on non-empty diff; allow override via approver.

3) RUM weighted sampling and KPIs (future)
- Verify presence once implemented via dashboards.

---

## Notes
- Most API calls accept `Authorization: Bearer` if your server enforces auth.
- Web UI tests: run `pnpm dev:local`, ensure flags:
  - `FF_TENANT_URLS=true` (redirects)
  - `FF_ENFORCE_CSRF=true` (CSRF enforcement)
  - `FF_CATEGORY_QUICK_ACTIONS=true` (sticky footer)
  - `FF_AUDIT_LOG=true` (audit rows)
- Replace `<item_id>` and `<TENANT_UUID>` placeholders.
