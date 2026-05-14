# Digital Download Pages API Test Script (PowerShell)
# Tests all endpoints with various scenarios

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Digital Download Pages API Test Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ApiBase = "http://localhost:3001/api"
$TenantId = "test-tenant-id"
$TestId = "test-item-id"

function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Url,
        [string]$Body = $null,
        [string]$Description
    )
    
    Write-Host "[$Method] $Description" -ForegroundColor Yellow
    
    try {
        $Headers = @{
            "Content-Type" = "application/json"
        }
        
        if ($Body) {
            $Response = Invoke-RestMethod -Uri $Url -Method $Method -Headers $Headers -Body $Body -ErrorAction Stop
        } else {
            $Response = Invoke-RestMethod -Uri $Url -Method $Method -Headers $Headers -ErrorAction Stop
        }
        
        Write-Host "✅ Success: $($Response | ConvertTo-Json -Depth 3)" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            Write-Host "   Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
}

# Test 1: Get all download pages (should be empty initially)
Test-Endpoint -Method "GET" -Url "$ApiBase/tenants/$TenantId/digital-download-pages" -Description "Get all download pages (initially empty)"

# Test 2: Try to create download page without valid item (should fail)
$InvalidBody = @{
    itemId = "invalid-item-id"
    title = "Test Page"
} | ConvertTo-Json -Depth 3

Test-Endpoint -Method "POST" -Url "$ApiBase/tenants/$TenantId/digital-download-pages" -Body $InvalidBody -Description "Create download page - Invalid item (should fail)"

# Test 3: Create download page with valid data
$ValidBody = @{
    itemId = $TestId
    title = "Test Digital Download Page"
    description = "Test description"
    instructions = "Test instructions"
    thankYouMessage = "Thank you for your purchase!"
    supportEmail = "test@example.com"
    brandColor = "#3B82F6"
    requireAuthentication = $true
    allowMultipleDownloads = $true
    status = "draft"
} | ConvertTo-Json -Depth 3

Test-Endpoint -Method "POST" -Url "$ApiBase/tenants/$TenantId/digital-download-pages" -Body $ValidBody -Description "Create download page - Valid data"

# Test 4: Get all download pages (should show created page)
Test-Endpoint -Method "GET" -Url "$ApiBase/tenants/$TenantId/digital-download-pages" -Description "Get all download pages (should show 1 page)"

# Test 5: Get specific download page
Test-Endpoint -Method "GET" -Url "$ApiBase/tenants/$TenantId/digital-download-pages/test-page-id" -Description "Get specific download page"

# Test 6: Update download page
$UpdateBody = @{
    title = "Updated Test Page"
    description = "Updated description"
    status = "published"
} | ConvertTo-Json -Depth 3

Test-Endpoint -Method "PUT" -Url "$ApiBase/tenants/$TenantId/digital-download-pages/test-page-id" -Body $UpdateBody -Description "Update download page"

# Test 7: Generate preview token
$PreviewBody = @{
    expiresInHours = 2
} | ConvertTo-Json -Depth 3

Test-Endpoint -Method "POST" -Url "$ApiBase/tenants/$TenantId/digital-download-pages/test-page-id/preview-token" -Body $PreviewBody -Description "Generate preview token"

# Test 8: Get page assets (should be empty initially)
Test-Endpoint -Method "GET" -Url "$ApiBase/tenants/$TenantId/digital-download-pages/test-page-id/assets" -Description "Get page assets (initially empty)"

# Test 9: Try to reorder assets with invalid data (should fail)
$InvalidReorder = @{
    assetIds = @()
} | ConvertTo-Json -Depth 3

Test-Endpoint -Method "PUT" -Url "$ApiBase/tenants/$TenantId/digital-download-pages/test-page-id/assets/reorder" -Body $InvalidReorder -Description "Reorder assets - Invalid data (should fail)"

# Test 10: Delete download page
Test-Endpoint -Method "DELETE" -Url "$ApiBase/tenants/$TenantId/digital-download-pages/test-page-id" -Description "Delete download page"

# Test 11: Verify deletion (should be empty again)
Test-Endpoint -Method "GET" -Url "$ApiBase/tenants/$TenantId/digital-download-pages" -Description "Verify deletion (should be empty)"

# Test 12: Test pagination and search
Test-Endpoint -Method "GET" -Url "$ApiBase/tenants/$TenantId/digital-download-pages?page=1&limit=5&status=all&search=test" -Description "Test pagination and search"

# Test 13: Test validation errors - Missing required fields
$MissingFields = @{
    title = ""
} | ConvertTo-Json -Depth 3

Test-Endpoint -Method "POST" -Url "$ApiBase/tenants/$TenantId/digital-download-pages" -Body $MissingFields -Description "Validation test - Missing required fields"

# Test 14: Test validation errors - Invalid email
$InvalidEmail = @{
    itemId = $TestId
    title = "Test"
    supportEmail = "invalid-email"
} | ConvertTo-Json -Depth 3

Test-Endpoint -Method "POST" -Url "$ApiBase/tenants/$TenantId/digital-download-pages" -Body $InvalidEmail -Description "Validation test - Invalid email"

# Test 15: Test validation errors - Invalid color
$InvalidColor = @{
    itemId = $TestId
    title = "Test"
    brandColor = "invalid-color"
} | ConvertTo-Json -Depth 3

Test-Endpoint -Method "POST" -Url "$ApiBase/tenants/$TenantId/digital-download-pages" -Body $InvalidColor -Description "Validation test - Invalid color"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "API Test Script Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Expected Results:" -ForegroundColor Yellow
Write-Host "- TEST 1: 200 OK (empty array)" -ForegroundColor Gray
Write-Host "- TEST 2: 404 or 400 (item not found)" -ForegroundColor Gray
Write-Host "- TEST 3: 201 Created (if item exists) or 404/400 (if not)" -ForegroundColor Gray
Write-Host "- TEST 4: 200 OK (showing pages)" -ForegroundColor Gray
Write-Host "- TEST 5: 200 OK or 404 (depending on if page exists)" -ForegroundColor Gray
Write-Host "- TEST 6: 200 OK or 404 (depending on if page exists)" -ForegroundColor Gray
Write-Host "- TEST 7: 200 OK or 404 (depending on if page exists)" -ForegroundColor Gray
Write-Host "- TEST 8: 200 OK or 404 (depending on if page exists)" -ForegroundColor Gray
Write-Host "- TEST 9: 400 Bad Request (empty array)" -ForegroundColor Gray
Write-Host "- TEST 10: 200 OK or 404 (depending on if page exists)" -ForegroundColor Gray
Write-Host "- TEST 11: 200 OK (empty array)" -ForegroundColor Gray
Write-Host "- TEST 12: 200 OK (paginated results)" -ForegroundColor Gray
Write-Host "- TEST 13: 400 Bad Request (validation failed)" -ForegroundColor Gray
Write-Host "- TEST 14: 400 Bad Request (validation failed)" -ForegroundColor Gray
Write-Host "- TEST 15: 400 Bad Request (validation failed)" -ForegroundColor Gray
Write-Host ""
Write-Host "Check the results above to verify API behavior." -ForegroundColor Yellow
