# BSaaS Coupon Metadata Migration Script
# 
# For existing purchases that have coupon_id in metadata but lack the new
# coupon_duration / coupon_duration_in_months / coupon_percent_off / coupon_amount_off
# / original_price_cents / renewal_count fields.
#
# Usage: doppler run --config local -- node scripts/migrate_bsaas_coupon_metadata.js
#
# Prerequisites:
#   - STRIPE_SECRET_KEY must be set in environment
#   - Database connection must be configured
#
# This script is idempotent — it only updates purchases missing the new fields.

param(
    [string]$DryRun = "false"
)

Write-Host "BSaaS Coupon Metadata Migration" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan
Write-Host "DryRun: $DryRun"
Write-Host ""

# This script is a PowerShell wrapper that calls the Node.js implementation
# The actual logic is in migrate_bsaas_coupon_metadata.js

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$nodeScript = Join-Path $scriptDir "migrate_bsaas_coupon_metadata.js"

if (Test-Path $nodeScript) {
    $env:MIGRATION_DRY_RUN = $DryRun
    node $nodeScript
} else {
    Write-Host "Error: migrate_bsaas_coupon_metadata.js not found in $scriptDir" -ForegroundColor Red
    Write-Host "Please ensure the Node.js migration script exists." -ForegroundColor Red
    exit 1
}
