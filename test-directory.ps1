# Directory Phase 1 - Batch Testing Script
# Tests database, API endpoints, and provides manual testing checklist

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
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$ExpectedFields = @{}
    )
    
    $script:totalTests++
    Write-Host "Testing: $Name" -ForegroundColor Yellow
    Write-Host "  URL: $Url" -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri $Url -Method $Method -ErrorAction Stop
        
        # Check if response has expected fields
        $allFieldsPresent = $true
        foreach ($field in $ExpectedFields.Keys) {
            if (-not $response.PSObject.Properties.Name -contains $field) {
                Write-Host "  ❌ Missing field: $field" -ForegroundColor Red
                $allFieldsPresent = $false
            }
        }
        
        if ($allFieldsPresent) {
            Write-Host "  ✅ PASS" -ForegroundColor Green
            $script:passedTests++
            return $true
        } else {
            Write-Host "  ❌ FAIL - Missing expected fields" -ForegroundColor Red
            $script:failedTests++
            return $false
        }
    }
    catch {
        Write-Host "  ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
        $script:failedTests++
        return $false
    }
    finally {
        Write-Host ""
    }
}

function Test-DatabaseTable {
    param(
        [string]$TableName
    )
    
    $script:totalTests++
    Write-Host "Testing: Database table '$TableName'" -ForegroundColor Yellow
    
    try {
        # This would require database connection - placeholder for now
        Write-Host "  ℹ️  Manual verification required" -ForegroundColor Cyan
        Write-Host "  Run: SELECT COUNT(*) FROM $TableName;" -ForegroundColor Gray
        $script:totalTests--  # Don't count as automated test
    }
    catch {
        Write-Host "  ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
        $script:failedTests++
    }
    finally {
        Write-Host ""
    }
}

# ============================================
# SECTION 1: Database Tests
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SECTION 1: Database Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Manual Database Checks Required:" -ForegroundColor Yellow
Write-Host "  1. Run migration:" -ForegroundColor Gray
Write-Host "     cd apps/api" -ForegroundColor Gray
Write-Host "     npx prisma migrate deploy" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Verify table exists:" -ForegroundColor Gray
Write-Host "     SELECT COUNT(*) FROM directory_listings;" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Check auto-sync trigger:" -ForegroundColor Gray
Write-Host "     SELECT * FROM directory_listings LIMIT 5;" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Verify indexes:" -ForegroundColor Gray
Write-Host "     \d directory_listings" -ForegroundColor Gray
Write-Host ""

# ============================================
# SECTION 2: API Endpoint Tests
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SECTION 2: API Endpoint Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Search endpoint (no filters)
Test-Endpoint `
    -Name "Search endpoint (no filters)" `
    -Url "$API_BASE_URL/api/directory/search" `
    -ExpectedFields @{
        listings = $null
        pagination = $null
    }

# Test 2: Search with query
Test-Endpoint `
    -Name "Search with query parameter" `
    -Url "$API_BASE_URL/api/directory/search?q=store" `
    -ExpectedFields @{
        listings = $null
        pagination = $null
    }

# Test 3: Search with pagination
Test-Endpoint `
    -Name "Search with pagination" `
    -Url "$API_BASE_URL/api/directory/search?page=1&limit=12" `
    -ExpectedFields @{
        listings = $null
        pagination = $null
    }

# Test 4: Search with category filter
Test-Endpoint `
    -Name "Search with category filter" `
    -Url "$API_BASE_URL/api/directory/search?category=retail" `
    -ExpectedFields @{
        listings = $null
        pagination = $null
    }

# Test 5: Search with location filter
Test-Endpoint `
    -Name "Search with city filter" `
    -Url "$API_BASE_URL/api/directory/search?city=Brooklyn" `
    -ExpectedFields @{
        listings = $null
        pagination = $null
    }

# Test 6: Search with sorting
Test-Endpoint `
    -Name "Search with rating sort" `
    -Url "$API_BASE_URL/api/directory/search?sort=rating" `
    -ExpectedFields @{
        listings = $null
        pagination = $null
    }

# Test 7: Categories endpoint
Test-Endpoint `
    -Name "Categories list endpoint" `
    -Url "$API_BASE_URL/api/directory/categories" `
    -ExpectedFields @{
        categories = $null
    }

# Test 8: Locations endpoint
Test-Endpoint `
    -Name "Locations list endpoint" `
    -Url "$API_BASE_URL/api/directory/locations" `
    -ExpectedFields @{
        locations = $null
    }

# Test 9: Single listing by slug (if you have a test slug)
Write-Host "Testing: Single listing by slug" -ForegroundColor Yellow
Write-Host "  ℹ️  Requires a valid slug - test manually" -ForegroundColor Cyan
Write-Host "  Example: $API_BASE_URL/api/directory/test-store" -ForegroundColor Gray
Write-Host ""

# ============================================
# SECTION 3: Response Structure Tests
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SECTION 3: Response Structure Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$script:totalTests++
Write-Host "Testing: Search response structure" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/api/directory/search?limit=1" -Method GET -ErrorAction Stop
    
    # Check pagination structure
    $paginationValid = $true
    $requiredPaginationFields = @('page', 'limit', 'totalItems', 'totalPages')
    foreach ($field in $requiredPaginationFields) {
        if (-not $response.pagination.PSObject.Properties.Name -contains $field) {
            Write-Host "  ❌ Missing pagination field: $field" -ForegroundColor Red
            $paginationValid = $false
        }
    }
    
    # Check listings structure (if any exist)
    if ($response.listings -and $response.listings.Count -gt 0) {
        $listing = $response.listings[0]
        $requiredListingFields = @('id', 'tenantId', 'businessName', 'slug')
        $listingValid = $true
        foreach ($field in $requiredListingFields) {
            if (-not $listing.PSObject.Properties.Name -contains $field) {
                Write-Host "  ❌ Missing listing field: $field" -ForegroundColor Red
                $listingValid = $false
            }
        }
        
        if ($listingValid -and $paginationValid) {
            Write-Host "  ✅ PASS - Response structure valid" -ForegroundColor Green
            $script:passedTests++
        } else {
            Write-Host "  ❌ FAIL - Invalid response structure" -ForegroundColor Red
            $script:failedTests++
        }
    } else {
        if ($paginationValid) {
            Write-Host "  ✅ PASS - Pagination structure valid (no listings to check)" -ForegroundColor Green
            $script:passedTests++
        } else {
            Write-Host "  ❌ FAIL - Invalid pagination structure" -ForegroundColor Red
            $script:failedTests++
        }
    }
}
catch {
    Write-Host "  ❌ FAIL - $($_.Exception.Message)" -ForegroundColor Red
    $script:failedTests++
}
Write-Host ""

# ============================================
# SECTION 4: Frontend Manual Tests
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SECTION 4: Frontend Manual Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Manual Frontend Testing Checklist:" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. Directory Homepage ($WEB_BASE_URL/directory)" -ForegroundColor Cyan
Write-Host "   [ ] Hero section displays" -ForegroundColor Gray
Write-Host "   [ ] Search bar is functional" -ForegroundColor Gray
Write-Host "   [ ] Store cards display in grid" -ForegroundColor Gray
Write-Host "   [ ] Pagination works" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Search Functionality" -ForegroundColor Cyan
Write-Host "   [ ] Search by store name works" -ForegroundColor Gray
Write-Host "   [ ] Search by category works" -ForegroundColor Gray
Write-Host "   [ ] Search by location works" -ForegroundColor Gray
Write-Host "   [ ] Clear button works" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Store Cards" -ForegroundColor Cyan
Write-Host "   [ ] Logo displays (or fallback icon)" -ForegroundColor Gray
Write-Host "   [ ] Business name displays" -ForegroundColor Gray
Write-Host "   [ ] Category displays" -ForegroundColor Gray
Write-Host "   [ ] Location displays" -ForegroundColor Gray
Write-Host "   [ ] Product count displays" -ForegroundColor Gray
Write-Host "   [ ] Rating displays (if available)" -ForegroundColor Gray
Write-Host "   [ ] CTA button works" -ForegroundColor Gray
Write-Host "   [ ] Hover effects work" -ForegroundColor Gray
Write-Host ""

Write-Host "4. Responsive Design" -ForegroundColor Cyan
Write-Host "   [ ] Mobile view (1 column)" -ForegroundColor Gray
Write-Host "   [ ] Tablet view (2 columns)" -ForegroundColor Gray
Write-Host "   [ ] Desktop view (3 columns)" -ForegroundColor Gray
Write-Host "   [ ] Wide view (4 columns)" -ForegroundColor Gray
Write-Host ""

Write-Host "5. Loading States" -ForegroundColor Cyan
Write-Host "   [ ] Skeleton loading displays" -ForegroundColor Gray
Write-Host "   [ ] Search loading indicator" -ForegroundColor Gray
Write-Host ""

Write-Host "6. Empty States" -ForegroundColor Cyan
Write-Host "   [ ] No results message displays" -ForegroundColor Gray
Write-Host "   [ ] Empty state icon displays" -ForegroundColor Gray
Write-Host ""

Write-Host "7. Error Handling" -ForegroundColor Cyan
Write-Host "   [ ] API error displays message" -ForegroundColor Gray
Write-Host "   [ ] Network error handled gracefully" -ForegroundColor Gray
Write-Host ""

Write-Host "8. Dark Mode" -ForegroundColor Cyan
Write-Host "   [ ] All components support dark mode" -ForegroundColor Gray
Write-Host "   [ ] Colors are readable" -ForegroundColor Gray
Write-Host ""

# ============================================
# SECTION 5: Performance Tests
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SECTION 5: Performance Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Performance Testing Checklist:" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. API Response Time" -ForegroundColor Cyan
Write-Host "   [ ] Search endpoint < 500ms" -ForegroundColor Gray
Write-Host "   [ ] Categories endpoint < 200ms" -ForegroundColor Gray
Write-Host "   [ ] Locations endpoint < 200ms" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Page Load Time" -ForegroundColor Cyan
Write-Host "   [ ] Directory page loads < 2s" -ForegroundColor Gray
Write-Host "   [ ] Images load progressively" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Lighthouse Scores" -ForegroundColor Cyan
Write-Host "   [ ] Performance > 90" -ForegroundColor Gray
Write-Host "   [ ] Accessibility > 90" -ForegroundColor Gray
Write-Host "   [ ] Best Practices > 90" -ForegroundColor Gray
Write-Host "   [ ] SEO > 90" -ForegroundColor Gray
Write-Host ""

# ============================================
# SECTION 6: Integration Tests
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SECTION 6: Integration Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Integration Testing Checklist:" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. Auto-Sync Verification" -ForegroundColor Cyan
Write-Host "   [ ] Create new tenant with storefront enabled" -ForegroundColor Gray
Write-Host "   [ ] Verify appears in directory_listings table" -ForegroundColor Gray
Write-Host "   [ ] Update tenant business profile" -ForegroundColor Gray
Write-Host "   [ ] Verify directory listing updates" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Tier-Based Features" -ForegroundColor Cyan
Write-Host "   [ ] Starter tier: Links to storefront" -ForegroundColor Gray
Write-Host "   [ ] Pro+ tier: Can use custom website URL" -ForegroundColor Gray
Write-Host "   [ ] Featured listings display correctly" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Data Consistency" -ForegroundColor Cyan
Write-Host "   [ ] Product count matches items table" -ForegroundColor Gray
Write-Host "   [ ] Business info matches tenant_business_profile" -ForegroundColor Gray
Write-Host "   [ ] Categories sync correctly" -ForegroundColor Gray
Write-Host ""

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
    Write-Host "✅ All automated tests passed!" -ForegroundColor Green
} elseif ($failedTests -gt 0) {
    Write-Host "❌ Some tests failed. Please review the output above." -ForegroundColor Red
} else {
    Write-Host "ℹ️  No automated tests were run." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Complete manual database checks" -ForegroundColor Gray
Write-Host "  2. Complete frontend testing checklist" -ForegroundColor Gray
Write-Host "  3. Run performance tests" -ForegroundColor Gray
Write-Host "  4. Verify integration tests" -ForegroundColor Gray
Write-Host "  5. Deploy to staging" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Testing Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
