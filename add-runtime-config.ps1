# Script to add edge runtime configuration to "use client" TSX files
# that don't already have it

$webSrcPath = ".\apps\web\src"
$targetMarker = '"use client";'
$runtimeConfig = @"

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';
"@

# Counter for modified files
$modifiedCount = 0
$skippedCount = 0

Write-Host "Scanning for TSX files with 'use client' directive..." -ForegroundColor Cyan
Write-Host ""

# Find all .tsx files recursively
Get-ChildItem -Path $webSrcPath -Filter "*.tsx" -Recurse | ForEach-Object {
    $file = $_
    $content = Get-Content -Path $file.FullName -Raw
    
    # Check if file has "use client" directive
    if ($content -match $targetMarker) {
        # Check if it already has the runtime configuration (check for either keyword)
        if ($content -match "export const runtime\s*=" -or $content -match "export const dynamic\s*=") {
            Write-Host "SKIP: $($file.FullName)" -ForegroundColor Yellow
            Write-Host "      (already has runtime config)" -ForegroundColor Gray
            $skippedCount++
        }
        else {
            Write-Host "MODIFY: $($file.FullName)" -ForegroundColor Green
            
            # Find the first export statement
            if ($content -match '(?m)^export\s') {
                # Add the runtime config before the first export
                $newContent = $content -replace '(?m)(^export\s)', "$runtimeConfig`n`n`$1"
            }
            else {
                # If no export found, add after "use client";
                $newContent = $content -replace '("use client";)', "`$1$runtimeConfig"
            }
            
            # Write back to file
            Set-Content -Path $file.FullName -Value $newContent -NoNewline
            $modifiedCount++
        }
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Modified: $modifiedCount files" -ForegroundColor Green
Write-Host "  Skipped:  $skippedCount files" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan
