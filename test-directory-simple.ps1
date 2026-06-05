# Directory Phase 1 - Simple Testing Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Directory Phase 1 - Testing Suite" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$API_BASE_URL = if ($env:NEXT_PUBLIC_API_BASE_URL) { $env:NEXT_PUBLIC_API_BASE_URL } else { "http://localhost:4000" }
$WEB_BASE_URL = "http://localhost:3000"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  API Base URL: $API_BASE_URL" -ForegroundColor Gray
Write-Host "  Web Base URL: $WEB_BASE_URL" -ForegroundColor Gray
Write-Host ""

# Test counters
$totalTests = 0
$passedTests = 0
$failedTests = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url
    )
    
    $script:totalTests++
    Write-Host "Testing: $Name" -ForegroundColor Yellow
    Write-Host "  URL: $Url" -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri $Url -Method GET -ErrorAction Stop
        Write-Host "  [PASS]" -ForegroundColor Green
        $script:passedTests++
        return $true
    }
    catch {
        Write-Host "  [FAIL] - $($_.Exception.Message)" -ForegroundColor Red
        $script:failedTests++
        return $false
    }
    finally {
        Write-Host ""
    }
}

# ============================================
# API Endpoint Tests
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  API Endpoint Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Search endpoint (no filters)
Test-Endpoint -Name "Search endpoint (no filters)" -Url "$API_BASE_URL/api/directory/search"

# Test 2: Search with query
Test-Endpoint -Name "Search with query parameter" -Url "$API_BASE_URL/api/directory/search?q=store"

# Test 3: Search with pagination
$paginationUrl = "$API_BASE_URL/api/directory/search?page=1" + "&" + "limit=12"
Test-Endpoint -Name "Search with pagination" -Url $paginationUrl

# Test 4: Categories endpoint
Test-Endpoint -Name "Categories list endpoint" -Url "$API_BASE_URL/api/directory/categories"

# Test 5: Locations endpoint
Test-Endpoint -Name "Locations list endpoint" -Url "$API_BASE_URL/api/directory/locations"

# ============================================
# Test Summary
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Automated Tests:" -ForegroundColor Yellow
Write-Host "  Total:  $totalTests" -ForegroundColor Gray
Write-Host "  Passed: $passedTests" -ForegroundColor Green
Write-Host "  Failed: $failedTests" -ForegroundColor Red
Write-Host ""

if ($failedTests -eq 0 -and $totalTests -gt 0) {
    Write-Host "[SUCCESS] All automated tests passed!" -ForegroundColor Green
} elseif ($failedTests -gt 0) {
    Write-Host "[FAILURE] Some tests failed. Please review the output above." -ForegroundColor Red
} else {
    Write-Host "[INFO] No automated tests were run." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Manual Testing Checklist" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Database Verification:" -ForegroundColor Yellow
Write-Host "   - Check table exists: SELECT COUNT(*) FROM directory_listings;" -ForegroundColor Gray
Write-Host "   - View sample data: SELECT * FROM directory_listings LIMIT 5;" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Frontend Testing:" -ForegroundColor Yellow
Write-Host "   - Visit: $WEB_BASE_URL/directory" -ForegroundColor Gray
Write-Host "   - Test search functionality" -ForegroundColor Gray
Write-Host "   - Verify store cards display" -ForegroundColor Gray
Write-Host "   - Check pagination works" -ForegroundColor Gray
Write-Host "   - Test responsive design" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Integration Testing:" -ForegroundColor Yellow
Write-Host "   - Create a new tenant with business profile" -ForegroundColor Gray
Write-Host "   - Verify it appears in directory_listings" -ForegroundColor Gray
Write-Host "   - Update business profile" -ForegroundColor Gray
Write-Host "   - Verify directory listing updates" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Testing Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
