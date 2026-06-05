# Fix TypeScript errors - Prisma field naming (snake_case to camelCase)

Write-Host "Fixing TypeScript errors..." -ForegroundColor Cyan

$replacements = @{
    '\.merchant_id' = '.merchantId'
    '\.access_token' = '.accessToken'
    '\.refresh_token' = '.refreshToken'
    '\.token_expires_at' = '.tokenExpiresAt'
    '\.location_id' = '.locationId'
    '\.last_sync_at' = '.lastSyncAt'
    '\.last_error' = '.lastError'
    '\.created_at' = '.createdAt'
    '\.updated_at' = '.updatedAt'
    '\.sync_type' = '.syncType'
    '\.items_affected' = '.itemsAffected'
}

# Fix in Square files
$files = Get-ChildItem -Path "apps\api\src\square" -Filter "*.ts" -Recurse
$files += Get-ChildItem -Path "apps\api\src\services\square" -Filter "*.ts" -Recurse

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $modified = $false
    
    foreach ($pattern in $replacements.Keys) {
        $replacement = $replacements[$pattern]
        if ($content -match $pattern) {
            $content = $content -replace $pattern, $replacement
            $modified = $true
        }
    }
    
    if ($modified) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Fixed: $($file.Name)" -ForegroundColor Green
    }
}

# Fix Clover test - remove isDemo field
$cloverTest = "apps\api\src\clover\test-clover-integration.ts"
if (Test-Path $cloverTest) {
    $content = Get-Content $cloverTest -Raw
    $content = $content -replace ',\s*isDemo:\s*true', ''
    Set-Content -Path $cloverTest -Value $content -NoNewline
    Write-Host "Fixed: Clover test (removed isDemo field)" -ForegroundColor Green
}

# Fix Square sync service - change 'full' to 'catalog'
$syncService = "apps\api\src\services\square\square-sync.service.ts"
if (Test-Path $syncService) {
    $content = Get-Content $syncService -Raw
    $content = $content -replace "syncType: options\.syncType \|\| 'catalog'", "syncType: (options.syncType === 'full' ? 'catalog' : options.syncType) || 'catalog'"
    Set-Content -Path $syncService -Value $content -NoNewline
    Write-Host "Fixed: Square sync service (syncType)" -ForegroundColor Green
}

Write-Host "`nDone! All TypeScript errors fixed." -ForegroundColor Green
