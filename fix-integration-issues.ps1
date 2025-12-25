# Automated Integration Fix Script
# Applies common fixes automatically
# Run from project root: .\fix-integration-issues.ps1

param(
    [switch]$DryRun = $false,
    [switch]$SkipDependencies = $false,
    [switch]$SkipImports = $false
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Automated Integration Fix Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "[DRY RUN MODE] No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

$FixCount = 0
$ErrorCount = 0

# Change to web app directory
Set-Location "apps\web"

# ============================================
# Fix 1: Install Missing Dependencies
# ============================================
if (-not $SkipDependencies) {
    Write-Host "Fix 1: Installing missing dependencies..." -ForegroundColor Yellow
    Write-Host ""

    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $hasDatFns = $packageJson.dependencies.'date-fns' -or $packageJson.devDependencies.'date-fns'

    if (-not $hasDatFns) {
        Write-Host "Installing date-fns..." -ForegroundColor Green
        if (-not $DryRun) {
            pnpm add date-fns
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[SUCCESS] date-fns installed" -ForegroundColor Green
                $FixCount++
            } else {
                Write-Host "[ERROR] Failed to install date-fns" -ForegroundColor Red
                $ErrorCount++
            }
        } else {
            Write-Host "[DRY RUN] Would install: pnpm add date-fns" -ForegroundColor Gray
        }
    } else {
        Write-Host "[SKIP] date-fns already installed" -ForegroundColor Gray
    }
    Write-Host ""
}

# ============================================
# Fix 2: Fix Import Casing
# ============================================
if (-not $SkipImports) {
    Write-Host "Fix 2: Fixing import casing issues..." -ForegroundColor Yellow
    Write-Host ""

    $importFixes = @(
        @{
            Pattern = "@/components/ui/card"
            Replacement = "@/components/ui/Card"
        },
        @{
            Pattern = "@/components/ui/button"
            Replacement = "@/components/ui/Button"
        },
        @{
            Pattern = "@/components/ui/badge"
            Replacement = "@/components/ui/Badge"
        }
    )

    $securityFiles = Get-ChildItem -Path "src\components\security" -Recurse -Filter "*.tsx"

    foreach ($file in $securityFiles) {
        $content = Get-Content $file.FullName -Raw
        $modified = $false

        foreach ($fix in $importFixes) {
            if ($content -match [regex]::Escape($fix.Pattern)) {
                Write-Host "Fixing imports in: $($file.Name)" -ForegroundColor Green
                $content = $content -replace [regex]::Escape($fix.Pattern), $fix.Replacement
                $modified = $true
            }
        }

        if ($modified) {
            if (-not $DryRun) {
                Set-Content -Path $file.FullName -Value $content -NoNewline
                Write-Host "[SUCCESS] Fixed imports in $($file.Name)" -ForegroundColor Green
                $FixCount++
            } else {
                Write-Host "[DRY RUN] Would fix imports in $($file.Name)" -ForegroundColor Gray
            }
        }
    }
    Write-Host ""
}

# ============================================
# Fix 3: Create Missing UI Component Stubs
# ============================================
Write-Host "Fix 3: Creating missing UI component stubs..." -ForegroundColor Yellow
Write-Host ""

$uiPath = "src\components\ui"
$missingComponents = @()

# Check which components are missing
$requiredComponents = @("Switch", "Checkbox", "Dialog", "Select", "RadioGroup", "Progress", "Textarea", "Label")

foreach ($component in $requiredComponents) {
    if (-not (Test-Path "$uiPath\$component.tsx")) {
        $missingComponents += $component
    }
}

if ($missingComponents.Count -gt 0) {
    Write-Host "Missing components: $($missingComponents -join ', ')" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "RECOMMENDATION: Install from shadcn/ui:" -ForegroundColor Cyan
    Write-Host "  cd apps/web" -ForegroundColor Gray
    foreach ($comp in $missingComponents) {
        $compLower = $comp.ToLower() -replace "group", "-group"
        Write-Host "  npx shadcn-ui@latest add $compLower" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Or install Radix UI primitives:" -ForegroundColor Cyan
    Write-Host "  pnpm add @radix-ui/react-switch @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-radio-group @radix-ui/react-progress" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "[OK] All required UI components exist" -ForegroundColor Green
}
Write-Host ""

# ============================================
# Fix 4: Update Hook Exports
# ============================================
Write-Host "Fix 4: Checking hook exports..." -ForegroundColor Yellow
Write-Host ""

$hookFiles = @(
    @{
        Path = "src\hooks\useMFA.ts"
        RequiredExports = @("setupMFA", "verifyLogin", "mfaStatus", "disableMFA", "regenerateBackupCodes")
    },
    @{
        Path = "src\hooks\useSecurityMonitoring.ts"
        RequiredExports = @("healthStatus")
    }
)

foreach ($hookFile in $hookFiles) {
    if (Test-Path $hookFile.Path) {
        $content = Get-Content $hookFile.Path -Raw
        $missingExports = @()

        foreach ($export in $hookFile.RequiredExports) {
            if ($content -notmatch [regex]::Escape($export)) {
                $missingExports += $export
            }
        }

        if ($missingExports.Count -gt 0) {
            Write-Host "[WARNING] $($hookFile.Path) missing exports:" -ForegroundColor Yellow
            foreach ($export in $missingExports) {
                Write-Host "  - $export" -ForegroundColor Gray
            }
            Write-Host "  See INTEGRATION_FIX_GUIDE.md for manual fix instructions" -ForegroundColor Cyan
        } else {
            Write-Host "[OK] $($hookFile.Path) has all required exports" -ForegroundColor Green
        }
    } else {
        Write-Host "[ERROR] $($hookFile.Path) not found" -ForegroundColor Red
        $ErrorCount++
    }
}
Write-Host ""

# ============================================
# Fix 5: Verify Type Definitions
# ============================================
Write-Host "Fix 5: Checking type definitions..." -ForegroundColor Yellow
Write-Host ""

$typesFile = "src\types\security.ts"
if (Test-Path $typesFile) {
    $content = Get-Content $typesFile -Raw
    
    $requiredFields = @(
        @{ Type = "SecurityThreat"; Field = "status" },
        @{ Type = "SecurityThreat"; Field = "description" },
        @{ Type = "SecurityThreat"; Field = "source" },
        @{ Type = "SecurityThreat"; Field = "detectedAt" },
        @{ Type = "SecurityThreat"; Field = "affectedResources" },
        @{ Type = "BlockedIP"; Field = "permanent" },
        @{ Type = "BlockedIP"; Field = "attempts" }
    )

    $missingFields = @()
    foreach ($field in $requiredFields) {
        # Simple check - not perfect but good enough
        $pattern = "interface $($field.Type)[\s\S]*?$($field.Field)"
        if ($content -notmatch $pattern) {
            $missingFields += "$($field.Type).$($field.Field)"
        }
    }

    if ($missingFields.Count -gt 0) {
        Write-Host "[WARNING] Missing type fields:" -ForegroundColor Yellow
        foreach ($field in $missingFields) {
            Write-Host "  - $field" -ForegroundColor Gray
        }
        Write-Host "  See INTEGRATION_FIX_GUIDE.md Fix 4 for details" -ForegroundColor Cyan
    } else {
        Write-Host "[OK] All required type fields present" -ForegroundColor Green
    }
} else {
    Write-Host "[ERROR] $typesFile not found" -ForegroundColor Red
    $ErrorCount++
}
Write-Host ""

# ============================================
# Fix 6: Run TypeScript Check
# ============================================
Write-Host "Fix 6: Running TypeScript check..." -ForegroundColor Yellow
Write-Host ""

if (-not $DryRun) {
    $tscOutput = npx tsc --noEmit 2>&1 | Out-String
    $errors = $tscOutput -split "`n" | Where-Object { $_ -match "error TS" }
    
    if ($errors.Count -eq 0) {
        Write-Host "[SUCCESS] No TypeScript errors!" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] $($errors.Count) TypeScript errors remaining" -ForegroundColor Yellow
        Write-Host "Run .\test-integration-issues.ps1 for detailed error analysis" -ForegroundColor Cyan
    }
} else {
    Write-Host "[DRY RUN] Would run: npx tsc --noEmit" -ForegroundColor Gray
}
Write-Host ""

# ============================================
# Summary
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fix Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Fixes Applied: $FixCount" -ForegroundColor $(if ($FixCount -gt 0) { "Green" } else { "Gray" })
Write-Host "Errors: $ErrorCount" -ForegroundColor $(if ($ErrorCount -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($DryRun) {
    Write-Host "This was a DRY RUN. Run without -DryRun to apply changes." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Install missing UI components (see recommendations above)" -ForegroundColor Gray
Write-Host "2. Update hook APIs manually (see INTEGRATION_FIX_GUIDE.md)" -ForegroundColor Gray
Write-Host "3. Update type definitions manually (see INTEGRATION_FIX_GUIDE.md)" -ForegroundColor Gray
Write-Host "4. Run: .\test-integration-issues.ps1" -ForegroundColor Gray
Write-Host "5. Run: pnpm build" -ForegroundColor Gray
Write-Host ""

# Return to root
Set-Location "..\..\"

Write-Host "Fix script complete!" -ForegroundColor Cyan
Write-Host ""

if ($ErrorCount -gt 0) {
    exit 1
}
exit 0
