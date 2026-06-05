#!/usr/bin/env pwsh
# Phase 5C: Location Scope Tests

$baseUrl = "http://localhost:4000"

# Test coordinates (based on your tenant location)
# You can get these from the Edit Business Profile modal
$testLat = 40.7128  # Example: New York City
$testLng = -74.0060

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "PHASE 5C: LOCATION SCOPE TESTS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl"
Write-Host "Test Location: Lat $testLat, Lng $testLng"
Write-Host ""
Write-Host "NOTE: Run enable_earthdistance_phase5c.sql and refresh_mvs_phase5c.sql first!" -ForegroundColor Yellow
Write-Host ""

# Test 1: Get Nearby Shops (Default 25 mile radius)
Write-Host "[TEST 1] Get Nearby Shops (Default: 25 miles)" -ForegroundColor Green
Write-Host "Expected: Shops within 25 miles sorted by distance"
Write-Host ""
$url = "$baseUrl/api/public/shops/nearby?latitude=$testLat&longitude=$testLng"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.count) shops found" -ForegroundColor Green
    Write-Host ""
    if ($response.count -gt 0) {
        Write-Host "Nearby Shops:" -ForegroundColor Yellow
        $response.data | Select-Object -First 5 | Format-Table tenant_name, tenant_city, tenant_state, distance_miles, product_count -AutoSize
    } else {
        Write-Host "⚠ No shops found within 25 miles. Try increasing radius or check if tenants have location data." -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Metadata:" -ForegroundColor Yellow
    $response.metadata | ConvertTo-Json
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 2: Get Nearby Shops (10 mile radius)
Write-Host "[TEST 2] Get Nearby Shops (10 miles)" -ForegroundColor Green
Write-Host "Expected: Shops within 10 miles"
Write-Host ""
$url = "$baseUrl/api/public/shops/nearby?latitude=$testLat&longitude=$testLng&radius=10"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.count) shops found within 10 miles" -ForegroundColor Green
    Write-Host ""
    $response.data | Format-Table tenant_name, distance_miles, product_count, products_in_stock -AutoSize
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 3: Get Nearby Shops (50 mile radius)
Write-Host "[TEST 3] Get Nearby Shops (50 miles)" -ForegroundColor Green
Write-Host "Expected: More shops within larger radius"
Write-Host ""
$url = "$baseUrl/api/public/shops/nearby?latitude=$testLat&longitude=$testLng&radius=50&limit=10"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.count) shops found within 50 miles" -ForegroundColor Green
    Write-Host ""
    $response.data | Format-Table tenant_name, tenant_city, distance_miles, product_count -AutoSize
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 4: Location Scope - Trending Products
Write-Host "[TEST 4] Location Scope - Trending Products" -ForegroundColor Green
Write-Host "Expected: Trending products from nearby shops"
Write-Host ""
$url = "$baseUrl/api/public/shops/location/trending?location[latitude]=$testLat&location[longitude]=$testLng&location[radius]=25&limit=5"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.data.Count) products returned" -ForegroundColor Green
    Write-Host ""
    if ($response.data.Count -gt 0) {
        $response.data | Format-Table product_name, tenant_name, tenant_city, distance_miles, trending_score -AutoSize
    } else {
        Write-Host "⚠ No products found. Check if tenants have location data and products." -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 5: Location Scope - Sale Products
Write-Host "[TEST 5] Location Scope - Sale Products" -ForegroundColor Green
Write-Host "Expected: Sale products from nearby shops"
Write-Host ""
$url = "$baseUrl/api/public/shops/location/sale?location[latitude]=$testLat&location[longitude]=$testLng&location[radius]=25&limit=5"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.data.Count) sale products returned" -ForegroundColor Green
    Write-Host ""
    if ($response.data.Count -gt 0) {
        $response.data | Format-Table product_name, tenant_name, distance_miles, current_price_cents -AutoSize
    }
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 6: Location Scope - New Arrivals
Write-Host "[TEST 6] Location Scope - New Arrivals" -ForegroundColor Green
Write-Host "Expected: New arrival products from nearby shops"
Write-Host ""
$url = "$baseUrl/api/public/shops/location/new?location[latitude]=$testLat&location[longitude]=$testLng&location[radius]=25&limit=5"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.data.Count) new products returned" -ForegroundColor Green
    Write-Host ""
    if ($response.data.Count -gt 0) {
        $response.data | Format-Table product_name, tenant_name, distance_miles, created_at -AutoSize
    }
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 7: Verify Cache Headers
Write-Host "[TEST 7] Verify Cache Headers (Location Scope)" -ForegroundColor Green
Write-Host "Expected: Cache-Control, X-MV-Source headers"
Write-Host ""
$url = "$baseUrl/api/public/shops/location/trending?location[latitude]=$testLat&location[longitude]=$testLng&location[radius]=25&limit=3"
try {
    $response = Invoke-WebRequest -Uri $url -Method Get
    Write-Host "✓ Headers found:" -ForegroundColor Green
    Write-Host "  Cache-Control: $($response.Headers['Cache-Control'])"
    Write-Host "  X-MV-Source: $($response.Headers['X-MV-Source'])"
    Write-Host ""
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Response metadata:" -ForegroundColor Yellow
    $data.metadata | ConvertTo-Json
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 8: Distance Calculation Verification
Write-Host "[TEST 8] Distance Calculation Verification" -ForegroundColor Green
Write-Host "Expected: Products sorted by distance with accurate distance_miles"
Write-Host ""
$url = "$baseUrl/api/public/shops/location/trending?location[latitude]=$testLat&location[longitude]=$testLng&location[radius]=50&limit=10"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: Analyzing distance calculations" -ForegroundColor Green
    Write-Host ""
    
    if ($response.data.Count -gt 0) {
        Write-Host "Products sorted by distance:" -ForegroundColor Yellow
        foreach ($product in $response.data) {
            Write-Host "  $($product.product_name) - $($product.tenant_name)"
            Write-Host "    Location: $($product.tenant_city), $($product.tenant_state)"
            Write-Host "    Distance: $([math]::Round($product.distance_miles, 2)) miles"
            Write-Host "    Coordinates: ($($product.tenant_latitude), $($product.tenant_longitude))"
            Write-Host ""
        }
    } else {
        Write-Host "⚠ No products found for distance verification" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 9: Nearby Shops with High Minimum Products
Write-Host "[TEST 9] Nearby Shops (minProducts=10)" -ForegroundColor Green
Write-Host "Expected: Only shops with at least 10 products"
Write-Host ""
$url = "$baseUrl/api/public/shops/nearby?latitude=$testLat&longitude=$testLng&radius=50&minProducts=10"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.count) shops with 10+ products" -ForegroundColor Green
    Write-Host ""
    $response.data | Format-Table tenant_name, product_count, products_in_stock, distance_miles -AutoSize
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 10: Location Data Coverage Check
Write-Host "[TEST 10] Location Data Coverage Check" -ForegroundColor Green
Write-Host "Expected: Statistics on location data availability"
Write-Host ""
Write-Host "Checking MV for location data coverage..." -ForegroundColor Yellow
Write-Host ""
Write-Host "To check location coverage, run this SQL query:" -ForegroundColor Cyan
Write-Host @"
SELECT 
  COUNT(*) as total_products,
  COUNT(tenant_latitude) as products_with_coords,
  ROUND((COUNT(tenant_latitude)::numeric / COUNT(*)::numeric) * 100, 2) as coverage_percent
FROM mv_global_discovery;
"@ -ForegroundColor White
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "PHASE 5C TESTING COMPLETE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  - Location scope endpoint: /api/public/shops/location/:bucketType"
Write-Host "  - Nearby shops endpoint: /api/public/shops/nearby"
Write-Host "  - Default radius: 25 miles"
Write-Host "  - Cache: 15 minutes (900 seconds)"
Write-Host "  - Requires: latitude, longitude coordinates"
Write-Host "  - Uses: PostgreSQL earthdistance extension"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Ensure all tenants have location data in tenant_business_profiles_list"
Write-Host "  2. Use 'Get Coordinates' button in Edit Business Profile modal"
Write-Host "  3. Run refresh_mvs_phase5c.sql to update materialized views"
Write-Host ""
Write-Host "All tests completed. Review the results above for any errors." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit"
