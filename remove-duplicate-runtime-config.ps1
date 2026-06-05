# Script to remove duplicate runtime configuration exports from TSX files

$webSrcPath = ".\apps\web\src"

# Counter for modified files
$modifiedCount = 0

Write-Host "Scanning for TSX files with duplicate runtime configs..." -ForegroundColor Cyan
Write-Host ""

# Find all .tsx files recursively
Get-ChildItem -Path $webSrcPath -Filter "*.tsx" -Recurse | ForEach-Object {
    $file = $_
    $content = Get-Content -Path $file.FullName -Raw
    
    # Check if file has "use client" directive
    if ($content -match '"use client";') {
        # Count occurrences of runtime and dynamic exports
        $runtimeCount = ([regex]::Matches($content, "export const runtime\s*=\s*'edge';")).Count
        $dynamicCount = ([regex]::Matches($content, "export const dynamic\s*=\s*'force-dynamic';")).Count
        
        if ($runtimeCount -gt 1 -or $dynamicCount -gt 1) {
            Write-Host "FIXING: $($file.FullName)" -ForegroundColor Green
            Write-Host "        runtime: $runtimeCount occurrences, dynamic: $dynamicCount occurrences" -ForegroundColor Gray
            
            # Read file line by line to preserve formatting
            $lines = Get-Content -Path $file.FullName
            $newLines = @()
            $runtimeSeen = $false
            $dynamicSeen = $false
            $skipNextLine = $false
            
            for ($i = 0; $i -lt $lines.Count; $i++) {
                $line = $lines[$i]
                
                # Skip if we're on a line to skip
                if ($skipNextLine) {
                    $skipNextLine = $false
                    continue
                }
                
                # Check for runtime export
                if ($line -match "^export const runtime\s*=\s*'edge';") {
                    if ($runtimeSeen) {
                        # Skip this duplicate and the comment before it if it exists
                        if ($i -gt 0 -and $newLines[-1] -match "Force edge runtime") {
                            $newLines = $newLines[0..($newLines.Count - 2)]
                        }
                        # Skip empty line before if it exists
                        if ($newLines.Count -gt 0 -and $newLines[-1] -match '^\s*$') {
                            $newLines = $newLines[0..($newLines.Count - 2)]
                        }
                        continue
                    }
                    $runtimeSeen = $true
                }
                
                # Check for dynamic export
                if ($line -match "^export const dynamic\s*=\s*'force-dynamic';") {
                    if ($dynamicSeen) {
                        # Skip this duplicate and the comment before it if it exists
                        if ($i -gt 0 -and $newLines[-1] -match "Force dynamic rendering") {
                            $newLines = $newLines[0..($newLines.Count - 2)]
                        }
                        # Skip empty line before if it exists
                        if ($newLines.Count -gt 0 -and $newLines[-1] -match '^\s*$') {
                            $newLines = $newLines[0..($newLines.Count - 2)]
                        }
                        continue
                    }
                    $dynamicSeen = $true
                }
                
                $newLines += $line
            }
            
            # Write back to file
            $newLines | Set-Content -Path $file.FullName
            $modifiedCount++
        }
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Fixed: $modifiedCount files with duplicates" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
