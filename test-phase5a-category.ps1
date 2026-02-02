#!/usr/bin/env pwsh
# Phase 5A: Product + Shop Category Scope Tests

$baseUrl = "http://localhost:4000"
$testTenant = "tid-m8ijkrnk"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "PHASE 5A: PRODUCT + SHOP CATEGORY SCOPE TESTS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl"
Write-Host "Test Tenant: $testTenant"
Write-Host ""
Write-Host "NOTE: Run refresh_mvs_phase5a.sql first to add product category fields!" -ForegroundColor Yellow
Write-Host ""

# Test 1: Product Category - Trending (Electronics)
Write-Host "[TEST 1] Product Category - Trending (Electronics)" -ForegroundColor Green
Write-Host "Expected: Trending products from Electronics category"
Write-Host ""
$url = "$baseUrl/api/public/shops/category/trending?category[productName]=Electronics&limit=5"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.data.Count) products returned" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 2: Product Category - Sale (Skincare)
Write-Host "[TEST 2] Product Category - Sale (Skincare)" -ForegroundColor Green
Write-Host "Expected: Sale products from Skincare category"
Write-Host ""
$url = "$baseUrl/api/public/shops/category/sale?category[productName]=Skincare&limit=5"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.data.Count) products returned" -ForegroundColor Green
    $response.data | Select-Object product_name, product_category, current_price_cents | Format-Table
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 3: Product Category - New Arrivals (Fashion)
Write-Host "[TEST 3] Product Category - New Arrivals (Fashion)" -ForegroundColor Green
Write-Host "Expected: New arrival products from Fashion category"
Write-Host ""
$url = "$baseUrl/api/public/shops/category/new?category[productName]=Fashion&limit=5"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.data.Count) products returned" -ForegroundColor Green
    $response.data | Select-Object product_name, product_category, featured_type | Format-Table
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 4: Shop Category - Trending (Grocery Store)
Write-Host "[TEST 4] Shop Category - Trending (Grocery Store)" -ForegroundColor Green
Write-Host "Expected: Trending products from Grocery Store shops"
Write-Host ""
$url = "$baseUrl/api/public/shops/category/trending?category[shopCategoryName]=Grocery Store&limit=5"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.data.Count) products returned" -ForegroundColor Green
    $response.data | Select-Object product_name, shop_category, tenant_name | Format-Table
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 5: Shop Category - Sale (Restaurant)
Write-Host "[TEST 5] Shop Category - Sale (Restaurant)" -ForegroundColor Green
Write-Host "Expected: Sale products from Restaurant shops"
Write-Host ""
$url = "$baseUrl/api/public/shops/category/sale?category[shopCategoryName]=Restaurant&limit=5"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.data.Count) products returned" -ForegroundColor Green
    $response.data | Select-Object product_name, shop_category | Format-Table
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 6: Shop Category - Random (Market)
Write-Host "[TEST 6] Shop Category - Random (Market)" -ForegroundColor Green
Write-Host "Expected: Random products from Market shops (includes secondary categories)"
Write-Host ""
$url = "$baseUrl/api/public/shops/category/random?category[shopCategoryName]=Market&limit=5"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.data.Count) products returned" -ForegroundColor Green
    $response.data | Select-Object product_name, shop_category | Format-Table
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 7: Shop Category - Staff Picks (Grocery)
Write-Host "[TEST 7] Shop Category - Staff Picks (Grocery)" -ForegroundColor Green
Write-Host "Expected: Staff pick products from Grocery-related shops"
Write-Host ""
$url = "$baseUrl/api/public/shops/category/staff?category[shopCategoryName]=Grocery&limit=5"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.data.Count) products returned" -ForegroundColor Green
    $response.data | Select-Object product_name, shop_category, featured_type | Format-Table
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 8: Product Category - Random Weighted (Electronics)
Write-Host "[TEST 8] Product Category - Random Weighted (Electronics)" -ForegroundColor Green
Write-Host "Expected: Trending-weighted random products from Electronics category"
Write-Host ""
$url = "$baseUrl/api/public/shops/category/random-weighted?category[productName]=Electronics&limit=5"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.data.Count) products returned" -ForegroundColor Green
    $response.data | Select-Object product_name, product_category, trending_score | Format-Table
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 9: Verify MV Cache Headers (Product Category)
Write-Host "[TEST 9] Verify MV Cache Headers (Product Category)" -ForegroundColor Green
Write-Host "Expected: X-MV-Refreshed-At, Cache-Control, X-MV-Source headers"
Write-Host ""
$url = "$baseUrl/api/public/shops/category/trending?category[productName]=Electronics&limit=3"
try {
    $response = Invoke-WebRequest -Uri $url -Method Get
    Write-Host "✓ Headers found:" -ForegroundColor Green
    Write-Host "  X-MV-Refreshed-At: $($response.Headers['X-MV-Refreshed-At'])"
    Write-Host "  Cache-Control: $($response.Headers['Cache-Control'])"
    Write-Host "  X-MV-Source: $($response.Headers['X-MV-Source'])"
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 10: Verify MV Cache Headers (Shop Category)
Write-Host "[TEST 10] Verify MV Cache Headers (Shop Category)" -ForegroundColor Green
Write-Host "Expected: X-MV-Refreshed-At, Cache-Control, X-MV-Source headers"
Write-Host ""
$url = "$baseUrl/api/public/shops/category/sale?category[shopCategoryName]=Grocery Store&limit=3"
try {
    $response = Invoke-WebRequest -Uri $url -Method Get
    Write-Host "✓ Headers found:" -ForegroundColor Green
    Write-Host "  X-MV-Refreshed-At: $($response.Headers['X-MV-Refreshed-At'])"
    Write-Host "  Cache-Control: $($response.Headers['Cache-Control'])"
    Write-Host "  X-MV-Source: $($response.Headers['X-MV-Source'])"
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 11: Product Category with Slug
Write-Host "[TEST 11] Product Category with Slug (electronics)" -ForegroundColor Green
Write-Host "Expected: Products filtered by exact product category slug"
Write-Host ""
$url = "$baseUrl/api/public/shops/category/trending?category[productId]=electronics&limit=5"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.data.Count) products returned" -ForegroundColor Green
    $response.data | Select-Object product_name, product_category_slug | Format-Table
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 12: Shop Category with ID
Write-Host "[TEST 12] Shop Category with ID (gcid:grocery-store)" -ForegroundColor Green
Write-Host "Expected: Products filtered by exact shop category ID"
Write-Host ""
$url = "$baseUrl/api/public/shops/category/trending?category[shopCategoryId]=gcid:grocery-store&limit=5"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.data.Count) products returned" -ForegroundColor Green
    $response.data | Select-Object product_name, shop_category | Format-Table
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "PHASE 5A TESTING COMPLETE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "All tests completed. Review the results above for any errors." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit"
