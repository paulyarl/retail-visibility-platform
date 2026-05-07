# Complete Integration Fix Script
# Installs dependencies and fixes all remaining issues

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Complete Integration Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "apps\web"

# Step 1: Install Radix UI dependencies
Write-Host "Step 1: Installing Radix UI dependencies..." -ForegroundColor Yellow
Write-Host ""

$radixPackages = @(
    "@radix-ui/react-switch",
    "@radix-ui/react-checkbox",
    "@radix-ui/react-dialog",
    "@radix-ui/react-radio-group",
    "@radix-ui/react-progress"
)

foreach ($package in $radixPackages) {
    Write-Host "Installing $package..." -ForegroundColor Green
    pnpm add $package
}

Write-Host ""
Write-Host "Step 2: Radix UI dependencies installed!" -ForegroundColor Green
Write-Host ""

# Return to root
Set-Location "..\..\"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next: Run .\fix-remaining-errors.ps1 to fix code issues" -ForegroundColor Yellow
Write-Host ""
