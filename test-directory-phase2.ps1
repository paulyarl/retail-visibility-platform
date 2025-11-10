# Directory Phase 2 - Comprehensive Testing Script
# Tests store detail pages, SEO features, structured data, and sitemap

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Directory Phase 2 - Testing Suite" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$API_BASE_URL = if ($env:NEXT_PUBLIC_API_BASE_URL) { $env:NEXT_PUBLIC_API_BASE_URL } else { "http://localhost:4000" }
$WEB_BASE_URL = if ($env:NEXT_PUBLIC_WEB_URL) { $env:NEXT_PUBLIC_WEB_URL } else { "http://localhost:3000" }

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  API Base URL: $API_BASE_URL" -ForegroundColor Gray
Write-Host "  Web Base URL: $WEB_BASE_URL" -ForegroundColor Gray
Write-Host ""

# Test counters
$totalTests = 0
$passedTests = 0
$failedTests = 0
$warnings = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$ExpectedContent = $null
    )
    
    $script:totalTests++
    Write-Host "Testing: $Name" -ForegroundColor Yellow
    Write-Host "  URL: $Url" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -ErrorAction Stop
        
        if ($ExpectedContent -and $response.Content -notlike "*$ExpectedContent*") {
            Write-Host "  [WARN] - Expected content not found: $ExpectedContent" -ForegroundColor Yellow
            $script:warnings++
        } else {
            Write-Host "  [PASS]" -ForegroundColor Green
            $script:passedTests++
        }
        return $response
    }
    catch {
        Write-Host "  [FAIL] - $($_.Exception.Message)" -ForegroundColor Red
        $script:failedTests++
        return $null
    }
    finally {
        Write-Host ""
    }
}

function Test-JsonLD {
    param(
        [string]$Name,
        [string]$Content,
        [string]$SchemaType
    )
    
    $script:totalTests++
    Write-Host "Testing: $Name" -ForegroundColor Yellow
    
    try {
        # Check for JSON-LD script tag
        if ($Content -match '<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>') {
            $jsonContent = $matches[1]
            
            # Try to parse as JSON
            $jsonObj = $jsonContent | ConvertFrom-Json
            
            # Check for expected schema type
            if ($jsonObj.'@type' -eq $SchemaType) {
                Write-Host "  [PASS] - Found $SchemaType schema" -ForegroundColor Green
                $script:passedTests++
                return $true
            } else {
                Write-Host "  [WARN] - Found schema but type is: $($jsonObj.'@type')" -ForegroundColor Yellow
                $script:warnings++
                return $false
            }
        } else {
            Write-Host "  [FAIL] - No JSON-LD script tag found" -ForegroundColor Red
            $script:failedTests++
            return $false
        }
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

function Test-MetaTags {
    param(
        [string]$Content
    )
    
    $tags = @{
        "Title" = '<title>'
        "Description" = '<meta name="description"'
        "Open Graph Title" = '<meta property="og:title"'
        "Open Graph Description" = '<meta property="og:description"'
        "Twitter Card" = '<meta name="twitter:card"'
    }
    
    Write-Host "Checking Meta Tags:" -ForegroundColor Yellow
    $allFound = $true
    
    foreach ($tag in $tags.GetEnumerator()) {
        $script:totalTests++
        if ($Content -like "*$($tag.Value)*") {
            Write-Host "  [PASS] - $($tag.Key)" -ForegroundColor Green
            $script:passedTests++
        } else {
            Write-Host "  [FAIL] - $($tag.Key) not found" -ForegroundColor Red
            $script:failedTests++
            $allFound = $false
        }
    }
    
    Write-Host ""
    return $allFound
}

# ============================================
# SECTION 1: Get Sample Store Slug
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SECTION 1: Get Sample Store" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Fetching sample store from directory..." -ForegroundColor Yellow
try {
    $searchResponse = Invoke-RestMethod -Uri "$API_BASE_URL/api/directory/search?limit=1" -Method GET
    $sampleStore = $searchResponse.listings[0]
    
    if ($sampleStore -and $sampleStore.slug) {
        Write-Host "  [SUCCESS] Found store: $($sampleStore.business_name)" -ForegroundColor Green
        Write-Host "  Slug: $($sampleStore.slug)" -ForegroundColor Gray
        $storeSlug = $sampleStore.slug
    } else {
        Write-Host "  [ERROR] No stores found in directory" -ForegroundColor Red
        Write-Host "  Please ensure database has at least one published listing" -ForegroundColor Yellow
        exit 1
    }
}
catch {
    Write-Host "  [ERROR] Failed to fetch sample store: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# ============================================
# SECTION 2: Store Detail Page Tests
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SECTION 2: Store Detail Page" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$storeUrl = "$WEB_BASE_URL/directory/$storeSlug"
$storeResponse = Test-Endpoint -Name "Store detail page loads" -Url $storeUrl -ExpectedContent $sampleStore.business_name

if ($storeResponse) {
    $storeContent = $storeResponse.Content
    
    # Test for key elements
    Write-Host "Checking page elements:" -ForegroundColor Yellow
    
    $elements = @{
        "Business Name" = $sampleStore.business_name
        "Back to Directory" = "Back to Directory"
        "Contact Information" = "Contact Information"
    }
    
    foreach ($element in $elements.GetEnumerator()) {
        $script:totalTests++
        if ($storeContent -like "*$($element.Value)*") {
            Write-Host "  [PASS] - $($element.Key)" -ForegroundColor Green
            $script:passedTests++
        } else {
            Write-Host "  [WARN] - $($element.Key) not found" -ForegroundColor Yellow
            $script:warnings++
        }
    }
    Write-Host ""
}

# ============================================
# SECTION 3: SEO Meta Tags
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SECTION 3: SEO Meta Tags" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($storeResponse) {
    Test-MetaTags -Content $storeResponse.Content
}

# ============================================
# SECTION 4: Structured Data (JSON-LD)
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SECTION 4: Structured Data" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($storeResponse) {
    Test-JsonLD -Name "LocalBusiness schema" -Content $storeResponse.Content -SchemaType "LocalBusiness"
    Test-JsonLD -Name "BreadcrumbList schema" -Content $storeResponse.Content -SchemaType "BreadcrumbList"
}

# ============================================
# SECTION 5: XML Sitemap
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SECTION 5: XML Sitemap" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$sitemapUrl = "$WEB_BASE_URL/directory/sitemap.xml"
$sitemapResponse = Test-Endpoint -Name "Sitemap generation" -Url $sitemapUrl -ExpectedContent '<?xml version="1.0"'

if ($sitemapResponse) {
    $sitemapContent = $sitemapResponse.Content
    
    # Validate XML structure
    Write-Host "Validating sitemap structure:" -ForegroundColor Yellow
    
    $sitemapChecks = @{
        "XML Declaration" = '<?xml version="1.0"'
        "URLset Tag" = '<urlset'
        "Directory Homepage" = "$WEB_BASE_URL/directory</loc>"
        "Store URL" = "$WEB_BASE_URL/directory/$storeSlug</loc>"
        "Change Frequency" = '<changefreq>'
        "Priority" = '<priority>'
    }
    
    foreach ($check in $sitemapChecks.GetEnumerator()) {
        $script:totalTests++
        if ($sitemapContent -like "*$($check.Value)*") {
            Write-Host "  [PASS] - $($check.Key)" -ForegroundColor Green
            $script:passedTests++
        } else {
            Write-Host "  [FAIL] - $($check.Key)" -ForegroundColor Red
            $script:failedTests++
        }
    }
    Write-Host ""
    
    # Count URLs in sitemap
    $urlCount = ([regex]::Matches($sitemapContent, '<loc>')).Count
    Write-Host "  Sitemap contains $urlCount URLs" -ForegroundColor Cyan
    Write-Host ""
}

# ============================================
# SECTION 6: SEO Validation Tools
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SECTION 6: External Validation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Manual validation recommended:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Structured Data Validation:" -ForegroundColor White
Write-Host "   https://validator.schema.org/" -ForegroundColor Gray
Write-Host "   Paste: $storeUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Google Rich Results Test:" -ForegroundColor White
Write-Host "   https://search.google.com/test/rich-results" -ForegroundColor Gray
Write-Host "   Test URL: $storeUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "3. XML Sitemap Validator:" -ForegroundColor White
Write-Host "   https://www.xml-sitemaps.com/validate-xml-sitemap.html" -ForegroundColor Gray
Write-Host "   Test URL: $sitemapUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Open Graph Debugger:" -ForegroundColor White
Write-Host "   https://developers.facebook.com/tools/debug/" -ForegroundColor Gray
Write-Host "   Test URL: $storeUrl" -ForegroundColor Gray
Write-Host ""

# ============================================
# Test Summary
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Automated Tests:" -ForegroundColor Yellow
Write-Host "  Total:    $totalTests" -ForegroundColor Gray
Write-Host "  Passed:   $passedTests" -ForegroundColor Green
Write-Host "  Failed:   $failedTests" -ForegroundColor Red
Write-Host "  Warnings: $warnings" -ForegroundColor Yellow
Write-Host ""

$successRate = if ($totalTests -gt 0) { [math]::Round(($passedTests / $totalTests) * 100, 1) } else { 0 }
Write-Host "Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 90) { "Green" } elseif ($successRate -ge 70) { "Yellow" } else { "Red" })
Write-Host ""

if ($failedTests -eq 0 -and $warnings -eq 0) {
    Write-Host "[SUCCESS] All tests passed! Phase 2 is ready for production." -ForegroundColor Green
} elseif ($failedTests -eq 0) {
    Write-Host "[SUCCESS] All critical tests passed. Review warnings above." -ForegroundColor Yellow
} else {
    Write-Host "[FAILURE] Some tests failed. Please review the output above." -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Next Steps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Manual Testing:" -ForegroundColor Yellow
Write-Host "   - Visit: $storeUrl" -ForegroundColor Gray
Write-Host "   - Test all interactive elements" -ForegroundColor Gray
Write-Host "   - Verify responsive design (mobile/tablet/desktop)" -ForegroundColor Gray
Write-Host ""

Write-Host "2. SEO Validation:" -ForegroundColor Yellow
Write-Host "   - Run external validators (links above)" -ForegroundColor Gray
Write-Host "   - Fix any validation errors" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Google Search Console:" -ForegroundColor Yellow
Write-Host "   - Submit sitemap: $sitemapUrl" -ForegroundColor Gray
Write-Host "   - Monitor indexing status" -ForegroundColor Gray
Write-Host "   - Check for rich results" -ForegroundColor Gray
Write-Host ""

Write-Host "4. Production Deployment:" -ForegroundColor Yellow
Write-Host "   - Deploy to staging first" -ForegroundColor Gray
Write-Host "   - Run tests again on staging" -ForegroundColor Gray
Write-Host "   - Deploy to production" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Testing Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
