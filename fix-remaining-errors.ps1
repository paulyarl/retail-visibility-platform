# Fix remaining TypeScript errors

Write-Host "Fixing remaining TypeScript errors..." -ForegroundColor Cyan

# Fix square-sync.service.ts - syncLog.id type issue (it returns number, not object)
$syncService = "apps\api\src\services\square\square-sync.service.ts"
if (Test-Path $syncService) {
    $content = Get-Content $syncService -Raw
    # Change syncLog.id to just syncLog (since createSyncLog returns the ID directly)
    $content = $content -replace 'syncLogId: syncLog\.id,', 'syncLogId: syncLog,'
    Set-Content -Path $syncService -Value $content -NoNewline
    Write-Host "Fixed: square-sync.service.ts (syncLog.id)" -ForegroundColor Green
}

# Fix square.routes.ts - add null check
$routes = "apps\api\src\square\square.routes.ts"
if (Test-Path $routes) {
    $content = Get-Content $routes -Raw
    
    # Find the section and add null check
    $oldPattern = '    const integration = await squareIntegrationService\.connectTenant\(\s+tenantId,\s+code\s+\);\s+res\.status\(200\)\.json\(\{'
    $newPattern = @'
    const integration = await squareIntegrationService.connectTenant(
      tenantId,
      code
    );

    if (!integration) {
      return res.status(500).json({
        error: 'integration_failed',
        message: 'Failed to create Square integration',
      });
    }

    res.status(200).json({
'@
    
    $content = $content -replace $oldPattern, $newPattern
    Set-Content -Path $routes -Value $content -NoNewline
    Write-Host "Fixed: square.routes.ts (null check)" -ForegroundColor Green
}

Write-Host "`nDone! Remaining errors fixed." -ForegroundColor Green
