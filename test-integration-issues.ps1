# Security UI Integration Test Script
# Tests all components and identifies integration issues
# Run from project root: .\test-integration-issues.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Security UI Integration Test Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorCount = 0
$WarningCount = 0
$FixCount = 0

# Change to web app directory
Set-Location "apps\web"

Write-Host "Step 1: Checking TypeScript compilation..." -ForegroundColor Yellow
Write-Host ""

# Run TypeScript check and capture output
$tscOutput = npx tsc --noEmit 2>&1 | Out-String

# Parse errors
$errors = $tscOutput -split "`n" | Where-Object { $_ -match "error TS" }
$ErrorCount = $errors.Count

Write-Host "Found $ErrorCount TypeScript errors" -ForegroundColor $(if ($ErrorCount -gt 0) { "Red" } else { "Green" })
Write-Host ""

# Categorize errors
$missingModules = @()
$missingProps = @()
$typeErrors = @()
$importErrors = @()

foreach ($error in $errors) {
    if ($error -match "Cannot find module") {
        $missingModules += $error
    }
    elseif ($error -match "Property .* does not exist") {
        $missingProps += $error
    }
    elseif ($error -match "not assignable to type") {
        $typeErrors += $error
    }
    elseif ($error -match "differs from already included file name.*only in casing") {
        $importErrors += $error
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Error Summary by Category" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Missing UI Components: $($missingModules.Count)" -ForegroundColor Yellow
if ($missingModules.Count -gt 0) {
    $uniqueModules = $missingModules | ForEach-Object {
        if ($_ -match "Cannot find module '([^']+)'") {
            $matches[1]
        }
    } | Select-Object -Unique
    
    Write-Host "   Missing modules:" -ForegroundColor Gray
    foreach ($module in $uniqueModules) {
        Write-Host "   - $module" -ForegroundColor Gray
    }
    Write-Host ""
}

Write-Host "2. Missing Properties/Methods: $($missingProps.Count)" -ForegroundColor Yellow
if ($missingProps.Count -gt 0) {
    $uniqueProps = $missingProps | ForEach-Object {
        if ($_ -match "Property '([^']+)' does not exist") {
            $matches[1]
        }
    } | Select-Object -Unique | Select-Object -First 10
    
    Write-Host "   Missing properties (top 10):" -ForegroundColor Gray
    foreach ($prop in $uniqueProps) {
        Write-Host "   - $prop" -ForegroundColor Gray
    }
    Write-Host ""
}

Write-Host "3. Type Mismatches: $($typeErrors.Count)" -ForegroundColor Yellow
Write-Host "4. Import Casing Issues: $($importErrors.Count)" -ForegroundColor Yellow
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Automated Fixes Available" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check for missing dependencies
Write-Host "Checking for missing dependencies..." -ForegroundColor Yellow
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$hasDatFns = $packageJson.dependencies.'date-fns' -or $packageJson.devDependencies.'date-fns'

if (-not $hasDatFns) {
    Write-Host "[FIX AVAILABLE] date-fns is not installed" -ForegroundColor Red
    Write-Host "   Run: pnpm add date-fns" -ForegroundColor Green
    $FixCount++
}
else {
    Write-Host "[OK] date-fns is installed" -ForegroundColor Green
}
Write-Host ""

# Check for UI components
Write-Host "Checking UI components..." -ForegroundColor Yellow
$uiPath = "src\components\ui"
$requiredComponents = @(
    "Switch.tsx",
    "Checkbox.tsx",
    "Dialog.tsx",
    "Select.tsx",
    "RadioGroup.tsx",
    "Progress.tsx",
    "Textarea.tsx"
)

foreach ($component in $requiredComponents) {
    $exists = Test-Path "$uiPath\$component"
    if (-not $exists) {
        Write-Host "[MISSING] $component" -ForegroundColor Red
        $FixCount++
    }
    else {
        Write-Host "[OK] $component exists" -ForegroundColor Green
    }
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Component File Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check all security components exist
$components = @(
    # Phase 1
    "src\components\security\SecuritySettings.tsx",
    "src\components\security\shared\LoginActivityTable.tsx",
    "src\components\security\shared\SecurityAlerts.tsx",
    "src\components\security\gdpr\DataExportWidget.tsx",
    "src\components\security\gdpr\ExportHistoryTable.tsx",
    "src\components\security\gdpr\AccountDeletionModal.tsx",
    "src\components\security\gdpr\DeletionProgressModal.tsx",
    # Phase 2
    "src\components\security\gdpr\ConsentManager.tsx",
    "src\components\security\gdpr\ConsentCard.tsx",
    "src\components\security\gdpr\ConsentHistory.tsx",
    "src\components\security\gdpr\BulkConsentActions.tsx",
    "src\components\security\gdpr\PreferencesManager.tsx",
    "src\components\security\gdpr\PreferenceCategory.tsx",
    "src\components\security\gdpr\PreferenceEditor.tsx",
    "src\components\security\gdpr\PreferenceBackup.tsx",
    # Phase 3
    "src\components\security\mfa\MFASetupWizard.tsx",
    "src\components\security\mfa\MFAVerification.tsx",
    "src\components\security\mfa\BackupCodesDisplay.tsx",
    "src\components\security\mfa\MFASettings.tsx",
    "src\components\security\monitoring\SecurityDashboard.tsx",
    "src\components\security\monitoring\ThreatMonitor.tsx",
    "src\components\security\monitoring\BlockedIPsTable.tsx",
    "src\components\security\monitoring\SecurityMetrics.tsx"
)

$missingComponents = @()
foreach ($component in $components) {
    if (Test-Path $component) {
        Write-Host "[OK] $component" -ForegroundColor Green
    }
    else {
        Write-Host "[MISSING] $component" -ForegroundColor Red
        $missingComponents += $component
    }
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Foundation Layer Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$foundation = @(
    "src\types\security.ts",
    "src\services\security.ts",
    "src\services\gdpr.ts",
    "src\services\mfa.ts",
    "src\services\securityMonitoring.ts",
    "src\hooks\useSecurity.ts",
    "src\hooks\useGDPR.ts",
    "src\hooks\useMFA.ts",
    "src\hooks\useSecurityMonitoring.ts"
)

foreach ($file in $foundation) {
    if (Test-Path $file) {
        Write-Host "[OK] $file" -ForegroundColor Green
    }
    else {
        Write-Host "[MISSING] $file" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Final Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Total TypeScript Errors: $ErrorCount" -ForegroundColor $(if ($ErrorCount -gt 0) { "Red" } else { "Green" })
Write-Host "Missing Components: $($missingComponents.Count)" -ForegroundColor $(if ($missingComponents.Count -gt 0) { "Red" } else { "Green" })
Write-Host "Available Quick Fixes: $FixCount" -ForegroundColor Yellow
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Install missing dependencies:" -ForegroundColor Yellow
Write-Host "   pnpm add date-fns" -ForegroundColor Green
Write-Host ""

Write-Host "2. Add missing UI components:" -ForegroundColor Yellow
Write-Host "   - Create Switch.tsx, Checkbox.tsx, Dialog.tsx, etc." -ForegroundColor Green
Write-Host "   - Or install from shadcn/ui: npx shadcn-ui@latest add switch checkbox dialog select" -ForegroundColor Green
Write-Host ""

Write-Host "3. Fix hook APIs:" -ForegroundColor Yellow
Write-Host "   - Update useMFA.ts to match component expectations" -ForegroundColor Green
Write-Host "   - Update useSecurityMonitoring.ts (healthStatus vs health)" -ForegroundColor Green
Write-Host ""

Write-Host "4. Update types:" -ForegroundColor Yellow
Write-Host "   - Add missing fields to SecurityThreat and BlockedIP types" -ForegroundColor Green
Write-Host ""

Write-Host "5. Fix import casing:" -ForegroundColor Yellow
Write-Host "   - Use @/components/ui/Card (not card)" -ForegroundColor Green
Write-Host "   - Use @/components/ui/Button (not button)" -ForegroundColor Green
Write-Host "   - Use @/components/ui/Badge (not badge)" -ForegroundColor Green
Write-Host ""

Write-Host "For detailed fixes, see: INTEGRATION_FIX_GUIDE.md" -ForegroundColor Cyan
Write-Host ""

# Return to root
Set-Location "..\..\"

Write-Host "Test complete!" -ForegroundColor Cyan
Write-Host ""

# Exit with error code if there are errors
if ($ErrorCount -gt 0) {
    exit 1
}
exit 0
