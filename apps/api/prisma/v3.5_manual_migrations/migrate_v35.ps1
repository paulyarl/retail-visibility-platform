# v3.5 Migration Runner for Windows/PowerShell
# Run from: retail-visibility-platform/apps/api/prisma/migrations/v3.5/

$ErrorActionPreference = "Stop"

# Database connection (from environment or Railway)
$DB_HOST = "metro.proxy.rlwy.net"
$DB_PORT = "40244"
$DB_USER = "postgres"
$DB_NAME = "railway"
$PSQL = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

Write-Host "[v3.5] Starting migrations..." -ForegroundColor Cyan

# 001 - Audit Log Enhancements
Write-Host "  → 001_audit_log_enhancements.sql" -ForegroundColor Yellow
& $PSQL -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "001_audit_log_enhancements.sql"
if ($LASTEXITCODE -ne 0) { throw "Migration 001 failed" }

# 002 - Policy Versioning
Write-Host "  → 002_policy_versioning.sql" -ForegroundColor Yellow
& $PSQL -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "002_policy_versioning.sql"
if ($LASTEXITCODE -ne 0) { throw "Migration 002 failed" }

# 003 - Effective Policy View v2
Write-Host "  → 003_effective_policy_view_v2.sql" -ForegroundColor Yellow
& $PSQL -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "003_effective_policy_view_v2.sql"
if ($LASTEXITCODE -ne 0) { throw "Migration 003 failed" }

# 004 - Tier Automation Enhancements
Write-Host "  → 004_tier_automation_enhancements.sql" -ForegroundColor Yellow
& $PSQL -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "004_tier_automation_enhancements.sql"
if ($LASTEXITCODE -ne 0) { throw "Migration 004 failed" }

# 005 - Observability Helpers
Write-Host "  → 005_observability_helpers.sql" -ForegroundColor Yellow
& $PSQL -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "005_observability_helpers.sql"
if ($LASTEXITCODE -ne 0) { throw "Migration 005 failed" }

Write-Host "[v3.5] ✓ All migrations applied successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Update Prisma schema with new fields"
Write-Host "  2. Run: npx prisma generate"
Write-Host "  3. Deploy API with audit middleware"
Write-Host "  4. Enable feature flags: FF_AUDIT_LOG, FF_POLICY_HISTORY, FF_TIER_AUTOMATION"
