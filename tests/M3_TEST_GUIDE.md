# M3 GBP Category Sync - Testing Guide

## Prerequisites

1. **Doppler CLI** installed and configured
2. **Admin JWT token** for API authentication
3. **API and Web servers** running (locally or remote)
4. **Database** with M3 migrations applied

---

## Quick Start with Doppler

### 1. Set Up Doppler Local Config

```powershell
# Navigate to project root
cd c:\Users\pauly\Documents\Windsurf Projects\RVP\retail-visibility-platform

# Verify Doppler is configured
doppler setup

# Check current environment
doppler run -- printenv | Select-String "DATABASE_URL|API_BASE_URL"
```

### 2. Get Admin Token

You need an admin JWT token to test the API endpoints. Options:

**Option A: Login via Web UI**
```powershell
# Start web app with Doppler
cd apps\web
doppler run -- npm run dev

# Navigate to http://localhost:3000/login
# Login as admin user
# Open browser DevTools > Application > Local Storage
# Copy the 'token' value
```

**Option B: Generate via API** (if you have admin credentials)
```powershell
$body = @{
    email = "admin@example.com"
    password = "your-password"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:4000/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$adminToken = $response.token
```

### 3. Set Environment Variables

```powershell
# Set admin token
$env:ADMIN_TOKEN = "your-jwt-token-here"

# Optional: Override default URLs if using remote server
$env:API_BASE_URL = "https://your-api-domain.com"
$env:WEB_BASE_URL = "https://your-web-domain.com"

# Optional: Set test tenant ID
$env:TEST_TENANT_ID = "your-tenant-id"
```

### 4. Run Test Script

```powershell
# PowerShell (Windows)
.\tests\m3-gbp-sync-test.ps1

# Or with Doppler (loads all env vars automatically)
doppler run -- pwsh -File .\tests\m3-gbp-sync-test.ps1
```

```bash
# Bash (Linux/Mac)
chmod +x ./tests/m3-gbp-sync-test.sh
./tests/m3-gbp-sync-test.sh

# Or with Doppler
doppler run -- ./tests/m3-gbp-sync-test.sh
```

---

## Test Coverage

The automated test script validates:

### ✅ API Endpoints
1. **Health Check** - Verify API is running
2. **GET /api/admin/sync-stats** - Dashboard metrics
3. **GET /api/admin/sync-logs** - Sync history
4. **GET /api/admin/mirror/last-run** - Last sync run details
5. **POST /api/categories/mirror** - Trigger dry-run sync

### ✅ Telemetry & Metrics
- Out-of-sync detection
- Metric emission verification
- Job tracking in database

### ⚠️ Manual Verification Required
- Admin dashboard UI (`/settings/admin`)
- GBP Sync page UI (`/settings/admin/gbp-sync`)
- Feature flag status
- Database schema verification

---

## Expected Test Results

### Successful Run Output

```
========================================
M3 GBP Category Sync Test Suite
========================================

[INFO] Checking prerequisites...
[PASS] Admin token found
[INFO] API Base URL: http://localhost:4000
[INFO] Web Base URL: http://localhost:3000

[TEST] Test 1: Verify API is running
[PASS] API is running at http://localhost:4000

[TEST] Test 2: GET /api/admin/sync-stats
[PASS] Sync stats endpoint returned 200
[INFO] Total Runs (24h): 5
[INFO] Success Rate: 100%
[INFO] Out of Sync Count: 2

[TEST] Test 3: GET /api/admin/sync-logs
[PASS] Sync logs endpoint returned 200
[INFO] Retrieved 5 sync logs

[TEST] Test 4: GET /api/admin/mirror/last-run
[PASS] Last run endpoint returned 200

[TEST] Test 5: POST /api/categories/mirror (dry-run)
[PASS] Mirror endpoint accepted dry-run job (202)
[INFO] Job ID: gbp-mirror-1730689234567-a1b2c3
[INFO] Waiting 3 seconds for job to complete...
[PASS] Job found in sync logs

========================================
Test Summary
========================================

[PASS] Automated Tests Completed
```

---

## Troubleshooting

### Error: "ADMIN_TOKEN not set"
```powershell
# Set the token in your current session
$env:ADMIN_TOKEN = "your-jwt-token"

# Or add to Doppler secrets
doppler secrets set ADMIN_TOKEN="your-jwt-token"
```

### Error: "API is not responding"
```powershell
# Check if API is running
cd apps\api
doppler run -- npm run dev

# Verify DATABASE_URL is set
doppler run -- printenv | Select-String "DATABASE_URL"
```

### Error: "Feature disabled - check FF_CATEGORY_MIRRORING flag"
```powershell
# Enable the feature flag in database or config
# Option 1: Via API (if you have admin access)
# Navigate to /settings/admin/platform-flags
# Enable FF_CATEGORY_MIRRORING

# Option 2: Via Doppler
doppler secrets set FF_CATEGORY_MIRRORING="true"
```

### Error: 401 Unauthorized
```powershell
# Token might be expired - get a fresh one
# Login again via web UI or API
```

### Error: 500 Internal Server Error
```powershell
# Check API logs for details
# Common issues:
# 1. Database connection failed
# 2. Missing migrations
# 3. Missing environment variables

# Run migrations
cd apps\api
doppler run -- npx prisma migrate deploy
```

---

## Manual Testing Checklist

After running the automated script, verify these manually:

### Admin Dashboard (`/settings/admin`)
- [ ] "GBP Category Sync" tile appears in dashboard
- [ ] Success rate displays correctly (e.g., "95% success rate")
- [ ] Badge shows "M3"
- [ ] Clicking tile navigates to `/settings/admin/gbp-sync`

### GBP Sync Page (`/settings/admin/gbp-sync`)
- [ ] 4 stat cards load with correct data:
  - Total Runs (24h)
  - Success Rate (color-coded: green ≥95%, yellow ≥80%, red <80%)
  - Out of Sync Count (color-coded: green=0, yellow<5, red≥5)
  - Failed Runs (color-coded: green=0, red>0)
- [ ] "Trigger Manual Sync" button works
- [ ] Confirmation dialog appears before triggering
- [ ] Recent errors section shows (if any failures exist)
- [ ] Sync logs table displays with columns:
  - Started, Tenant, Strategy, Created, Updated, Deleted, Status
- [ ] Status badges show correct colors:
  - Success (green), Error (red), Skipped (gray), Running (yellow)

### API Logs
- [ ] Check for `[GBP_SYNC]` log entries
- [ ] Verify `OUT-OF-SYNC detected` messages when differences exist
- [ ] Confirm retry/backoff behavior on errors

### Database
```sql
-- Verify categoryMirrorRun table exists
SELECT * FROM "categoryMirrorRun" ORDER BY "startedAt" DESC LIMIT 5;

-- Check for out-of-sync runs
SELECT * FROM "categoryMirrorRun" 
WHERE (created > 0 OR updated > 0 OR deleted > 0) 
  AND skipped = false
ORDER BY "startedAt" DESC;
```

---

## Feature Flags Required

Ensure these flags are enabled for M3:

| Flag | Purpose | Default |
|------|---------|---------|
| `FF_CATEGORY_MIRRORING` | Controls mirror endpoint + strategy switch | `off` |
| `FF_TENANT_PLATFORM_CATEGORY` | Enables tenant category UI/API | `pilot` |
| `FF_TENANT_GBP_CATEGORY_SYNC` | Worker + dashboard tiles visible | `pilot` |

Enable via:
```powershell
# Doppler
doppler secrets set FF_CATEGORY_MIRRORING="true"
doppler secrets set FF_TENANT_PLATFORM_CATEGORY="true"
doppler secrets set FF_TENANT_GBP_CATEGORY_SYNC="true"

# Or via Admin UI
# Navigate to /settings/admin/platform-flags
```

---

## Success Criteria

M3 is considered fully functional when:

- ✅ All automated tests pass
- ✅ Admin dashboard displays sync stats correctly
- ✅ Manual sync trigger works without errors
- ✅ Out-of-sync detection emits telemetry
- ✅ Sync logs persist to database
- ✅ Success rate ≥95% in pilot
- ✅ No critical errors in API logs

---

## Next Steps After Testing

1. **Monitor pilot tenants** for 48 hours
2. **Review sync logs** for patterns or issues
3. **Adjust retry/backoff** if needed based on GBP API behavior
4. **Enable globally** via `FF_CATEGORY_UNIFICATION=true`
5. **Set up alerts** for:
   - Success rate < 95%
   - Out-of-sync count > 5
   - Failed runs > 10 per day

---

## Support

If tests fail or you encounter issues:

1. Check API logs: `apps/api/logs` or console output
2. Verify Doppler config: `doppler secrets`
3. Review database migrations: `npx prisma migrate status`
4. Check feature flags: `/settings/admin/platform-flags`
5. Consult tracking doc: `docs/IMPLEMENTATION_TRACKING_V3_7_V3_8.md`
