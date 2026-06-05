# Script to add dynamic = 'force-dynamic' to all page.tsx files
# This prevents prerendering issues in Next.js

$webSrcPath = ".\apps\web\src\app"

# Counter for modified files
$modifiedCount = 0
$skippedCount = 0

Write-Host "Scanning for page.tsx files..." -ForegroundColor Cyan
Write-Host ""

# Find all page.tsx files recursively
Get-ChildItem -Path $webSrcPath -Filter "page.tsx" -Recurse | ForEach-Object {
    $file = $_
    
    # Skip if file doesn't exist (handle race conditions)
    if (-not (Test-Path $file.FullName)) {
        return
    }
    
    $content = Get-Content -Path $file.FullName -Raw
    
    # Check if it already has dynamic export
    if ($content -match "export const dynamic\s*=") {
        Write-Host "SKIP: $($file.FullName)" -ForegroundColor Yellow
        Write-Host "      (already has dynamic export)" -ForegroundColor Gray
        $skippedCount++
    }
    else {
        Write-Host "MODIFY: $($file.FullName)" -ForegroundColor Green
        
        # Find the position to insert (after imports, before first export)
        if ($content -match '(?m)^(import\s.+;\s*\n)+') {
            # Add after last import
            $newContent = $content -replace '(?m)(^import\s.+;\s*\n)((?!import\s).)', "`$1`n// Force dynamic rendering to prevent prerendering issues`nexport const dynamic = 'force-dynamic';`n`n`$2"
        }
        elseif ($content -match '(?m)^export\s') {
            # No imports, add before first export
            $newContent = $content -replace '(?m)(^export\s)', "// Force dynamic rendering to prevent prerendering issues`nexport const dynamic = 'force-dynamic';`n`n`$1"
        }
        else {
            # No imports or exports, add at the beginning
            $newContent = "// Force dynamic rendering to prevent prerendering issues`nexport const dynamic = 'force-dynamic';`n`n" + $content
        }
        
        # Write back to file
        Set-Content -Path $file.FullName -Value $newContent -NoNewline
        $modifiedCount++
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Modified: $modifiedCount files" -ForegroundColor Green
Write-Host "  Skipped:  $skippedCount files" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan
