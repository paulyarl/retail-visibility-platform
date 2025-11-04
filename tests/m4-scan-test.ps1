# M4 SKU Scanning Test Script (PowerShell)
# Tests all M4 endpoints with Doppler configuration

param(
    [string]$ApiUrl = $null,
    [string]$AuthToken = $null,
    [string]$TenantId = $null
)

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Cyan = "Cyan"

# Load from environment if not provided
if (-not $ApiUrl) {
    $ApiUrl = if ($env:API_BASE_URL) { $env:API_BASE_URL } else { "http://localhost:4000" }
}
if (-not $AuthToken) {
    $AuthToken = if ($env:TEST_AUTH_TOKEN) { $env:TEST_AUTH_TOKEN } else { $null }
}
if (-not $TenantId) {
    $TenantId = if ($env:TEST_TENANT_ID) { $env:TEST_TENANT_ID } else { $null }
}

Write-Host "`n=== M4 SKU Scanning Test Suite ===" -ForegroundColor $Cyan
Write-Host "API URL: $ApiUrl" -ForegroundColor $Cyan
Write-Host "Tenant ID: $TenantId" -ForegroundColor $Cyan
Write-Host ""

# Test counters
$script:PassCount = 0
$script:FailCount = 0
$script:SessionId = $null

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [int]$ExpectedStatus = 200
    )

    Write-Host "Testing: $Name" -ForegroundColor $Yellow
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            ContentType = "application/json"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-WebRequest @params -UseBasicParsing
        $statusCode = $response.StatusCode
        $content = $response.Content | ConvertFrom-Json
        
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "  ✓ PASS - Status: $statusCode" -ForegroundColor $Green
            $script:PassCount++
            return $content
        } else {
            Write-Host "  ✗ FAIL - Expected: $ExpectedStatus, Got: $statusCode" -ForegroundColor $Red
            $script:FailCount++
            return $null
        }
    }
    catch {
        $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { "N/A" }
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "  ✓ PASS - Status: $statusCode (expected error)" -ForegroundColor $Green
            $script:PassCount++
        } else {
            Write-Host "  ✗ FAIL - Error: $($_.Exception.Message)" -ForegroundColor $Red
            $script:FailCount++
        }
        return $null
    }
}

# Check prerequisites
if (-not $AuthToken) {
    Write-Host "ERROR: AUTH_TOKEN not provided. Set TEST_AUTH_TOKEN environment variable." -ForegroundColor $Red
    exit 1
}

if (-not $TenantId) {
    Write-Host "ERROR: TENANT_ID not provided. Set TEST_TENANT_ID environment variable." -ForegroundColor $Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $AuthToken"
}

Write-Host "`n--- Test 1: Start Scan Session ---" -ForegroundColor $Cyan
$sessionData = Test-Endpoint `
    -Name "POST /api/scan/start" `
    -Method "POST" `
    -Url "$ApiUrl/api/scan/start" `
    -Headers $headers `
    -Body @{
        tenantId = $TenantId
        deviceType = "usb"
        metadata = @{
            test = "automated"
            script = "powershell"
        }
    } `
    -ExpectedStatus 201

if ($sessionData -and $sessionData.session) {
    $script:SessionId = $sessionData.session.id
    Write-Host "  Session ID: $($script:SessionId)" -ForegroundColor $Green
}

if (-not $script:SessionId) {
    Write-Host "`nERROR: Failed to create session. Aborting tests." -ForegroundColor $Red
    exit 1
}

Write-Host "`n--- Test 2: Get Session Details ---" -ForegroundColor $Cyan
Test-Endpoint `
    -Name "GET /api/scan/$($script:SessionId)" `
    -Method "GET" `
    -Url "$ApiUrl/api/scan/$($script:SessionId)" `
    -Headers $headers

Write-Host "`n--- Test 3: Scan Barcodes ---" -ForegroundColor $Cyan
$barcodes = @("012345678905", "098765432109", "111222333444")

foreach ($barcode in $barcodes) {
    $result = Test-Endpoint `
        -Name "POST /api/scan/$($script:SessionId)/lookup-barcode ($barcode)" `
        -Method "POST" `
        -Url "$ApiUrl/api/scan/$($script:SessionId)/lookup-barcode" `
        -Headers $headers `
        -Body @{
            barcode = $barcode
        } `
        -ExpectedStatus 201
    
    Start-Sleep -Milliseconds 500
}

Write-Host "`n--- Test 4: Scan Duplicate Barcode ---" -ForegroundColor $Cyan
Test-Endpoint `
    -Name "POST /api/scan/$($script:SessionId)/lookup-barcode (duplicate)" `
    -Method "POST" `
    -Url "$ApiUrl/api/scan/$($script:SessionId)/lookup-barcode" `
    -Headers $headers `
    -Body @{
        barcode = "012345678905"
    } `
    -ExpectedStatus 409

Write-Host "`n--- Test 5: Get Scan Results ---" -ForegroundColor $Cyan
$results = Test-Endpoint `
    -Name "GET /api/scan/$($script:SessionId)/results" `
    -Method "GET" `
    -Url "$ApiUrl/api/scan/$($script:SessionId)/results" `
    -Headers $headers

if ($results -and $results.results) {
    Write-Host "  Found $($results.count) scan results" -ForegroundColor $Green
    
    if ($results.results.Count -gt 0) {
        $firstResultId = $results.results[0].id
        
        Write-Host "`n--- Test 6: Remove Scan Result ---" -ForegroundColor $Cyan
        Test-Endpoint `
            -Name "DELETE /api/scan/$($script:SessionId)/results/$firstResultId" `
            -Method "DELETE" `
            -Url "$ApiUrl/api/scan/$($script:SessionId)/results/$firstResultId" `
            -Headers $headers
    }
}

Write-Host "`n--- Test 7: Commit Session ---" -ForegroundColor $Cyan
Test-Endpoint `
    -Name "POST /api/scan/$($script:SessionId)/commit" `
    -Method "POST" `
    -Url "$ApiUrl/api/scan/$($script:SessionId)/commit" `
    -Headers $headers `
    -Body @{
        skipValidation = $false
    }

Write-Host "`n--- Test 8: Start Another Session for Cancellation ---" -ForegroundColor $Cyan
$cancelSessionData = Test-Endpoint `
    -Name "POST /api/scan/start (for cancel)" `
    -Method "POST" `
    -Url "$ApiUrl/api/scan/start" `
    -Headers $headers `
    -Body @{
        tenantId = $TenantId
        deviceType = "manual"
    } `
    -ExpectedStatus 201

if ($cancelSessionData -and $cancelSessionData.session) {
    $cancelSessionId = $cancelSessionData.session.id
    
    Write-Host "`n--- Test 9: Cancel Session ---" -ForegroundColor $Cyan
    Test-Endpoint `
        -Name "DELETE /api/scan/$cancelSessionId" `
        -Method "DELETE" `
        -Url "$ApiUrl/api/scan/$cancelSessionId" `
        -Headers $headers
}

Write-Host "`n--- Test 10: Admin - Enrichment Cache Stats ---" -ForegroundColor $Cyan
Test-Endpoint `
    -Name "GET /api/admin/enrichment/cache-stats" `
    -Method "GET" `
    -Url "$ApiUrl/api/admin/enrichment/cache-stats" `
    -Headers $headers

Write-Host "`n--- Test 11: Admin - Enrichment Rate Limits ---" -ForegroundColor $Cyan
Test-Endpoint `
    -Name "GET /api/admin/enrichment/rate-limits" `
    -Method "GET" `
    -Url "$ApiUrl/api/admin/enrichment/rate-limits" `
    -Headers $headers

Write-Host "`n--- Test 12: Admin - Scan Metrics ---" -ForegroundColor $Cyan
Test-Endpoint `
    -Name "GET /api/admin/scan-metrics?timeRange=24h" `
    -Method "GET" `
    -Url "$ApiUrl/api/admin/scan-metrics?timeRange=24h" `
    -Headers $headers

Write-Host "`n--- Test 13: Admin - Scan Metrics Timeseries ---" -ForegroundColor $Cyan
Test-Endpoint `
    -Name "GET /api/admin/scan-metrics/timeseries?timeRange=24h" `
    -Method "GET" `
    -Url "$ApiUrl/api/admin/scan-metrics/timeseries?timeRange=24h" `
    -Headers $headers

# Summary
Write-Host "`n=== Test Summary ===" -ForegroundColor $Cyan
Write-Host "Passed: $($script:PassCount)" -ForegroundColor $Green
Write-Host "Failed: $($script:FailCount)" -ForegroundColor $Red
$total = $script:PassCount + $script:FailCount
$successRate = if ($total -gt 0) { [math]::Round(($script:PassCount / $total) * 100, 1) } else { 0 }
Write-Host "Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 90) { $Green } else { $Red })

if ($script:FailCount -eq 0) {
    Write-Host "`n✓ All tests passed!" -ForegroundColor $Green
    exit 0
} else {
    Write-Host "`n✗ Some tests failed." -ForegroundColor $Red
    exit 1
}
