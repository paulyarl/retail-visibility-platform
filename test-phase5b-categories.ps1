#!/usr/bin/env pwsh
# Phase 5B: Shop Category Enhancements Tests

$baseUrl = "http://localhost:4000"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "PHASE 5B: SHOP CATEGORY ENHANCEMENTS TESTS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl"
Write-Host ""

# Test 1: Get Trending Categories (Default)
Write-Host "[TEST 1] Get Trending Categories (Default: limit=20, minProducts=3)" -ForegroundColor Green
Write-Host "Expected: Top 20 shop categories sorted by product count"
Write-Host ""
$url = "$baseUrl/api/public/shops/categories"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.count) categories returned" -ForegroundColor Green
    Write-Host ""
    Write-Host "Top 10 Categories:" -ForegroundColor Yellow
    $response.data | Select-Object -First 10 | Format-Table category_name, product_count, shop_count, avg_trending_score, products_in_stock -AutoSize
    Write-Host ""
    Write-Host "Metadata:" -ForegroundColor Yellow
    $response.metadata | ConvertTo-Json
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 2: Get Trending Categories (Limited)
Write-Host "[TEST 2] Get Trending Categories (limit=5)" -ForegroundColor Green
Write-Host "Expected: Top 5 shop categories"
Write-Host ""
$url = "$baseUrl/api/public/shops/categories?limit=5"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.count) categories returned" -ForegroundColor Green
    Write-Host ""
    $response.data | Format-Table category_name, product_count, shop_count, avg_price_cents -AutoSize
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 3: Get Trending Categories (Higher Minimum)
Write-Host "[TEST 3] Get Trending Categories (minProducts=10)" -ForegroundColor Green
Write-Host "Expected: Categories with at least 10 products"
Write-Host ""
$url = "$baseUrl/api/public/shops/categories?limit=10&minProducts=10"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.count) categories returned" -ForegroundColor Green
    Write-Host ""
    $response.data | Format-Table category_name, product_count, shop_count, products_with_images -AutoSize
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 4: Verify Cache Headers
Write-Host "[TEST 4] Verify Cache Headers" -ForegroundColor Green
Write-Host "Expected: Cache-Control (1 hour), X-MV-Source headers"
Write-Host ""
$url = "$baseUrl/api/public/shops/categories?limit=5"
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

# Test 5: Category Metrics Analysis
Write-Host "[TEST 5] Category Metrics Analysis" -ForegroundColor Green
Write-Host "Expected: Detailed metrics for each category"
Write-Host ""
$url = "$baseUrl/api/public/shops/categories?limit=5"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: Analyzing category metrics" -ForegroundColor Green
    Write-Host ""
    
    foreach ($category in $response.data) {
        Write-Host "Category: $($category.category_name)" -ForegroundColor Cyan
        Write-Host "  Products: $($category.product_count)"
        Write-Host "  Shops: $($category.shop_count)"
        Write-Host "  Avg Trending Score: $($category.avg_trending_score)"
        Write-Host "  Products with Images: $($category.products_with_images)"
        Write-Host "  Products in Stock: $($category.products_in_stock)"
        Write-Host "  Price Range: `$$([math]::Round($category.min_price_cents/100, 2)) - `$$([math]::Round($category.max_price_cents/100, 2))"
        Write-Host "  Avg Price: `$$([math]::Round($category.avg_price_cents/100, 2))"
        Write-Host ""
    }
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 6: Compare with Trending Shops
Write-Host "[TEST 6] Compare Categories with Trending Shops" -ForegroundColor Green
Write-Host "Expected: Both endpoints return aggregated data"
Write-Host ""
try {
    Write-Host "Fetching trending categories..." -ForegroundColor Yellow
    $categories = Invoke-RestMethod -Uri "$baseUrl/api/public/shops/categories?limit=5" -Method Get
    
    Write-Host "Fetching trending shops..." -ForegroundColor Yellow
    $shops = Invoke-RestMethod -Uri "$baseUrl/api/public/shops/trending-shops?limit=5" -Method Get
    
    Write-Host "✓ Success: Both endpoints working" -ForegroundColor Green
    Write-Host ""
    Write-Host "Categories Count: $($categories.count)" -ForegroundColor Cyan
    Write-Host "Shops Count: $($shops.count)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Top Categories:" -ForegroundColor Yellow
    $categories.data | Select-Object -First 3 | Format-Table category_name, product_count -AutoSize
    Write-Host ""
    Write-Host "Top Shops:" -ForegroundColor Yellow
    $shops.data | Select-Object -First 3 | Format-Table tenant_name, product_count -AutoSize
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Press Enter to continue"

# Test 7: Category Browse Use Case
Write-Host "[TEST 7] Category Browse Use Case" -ForegroundColor Green
Write-Host "Expected: User can browse all available categories"
Write-Host ""
$url = "$baseUrl/api/public/shops/categories?limit=50&minProducts=1"
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✓ Success: $($response.count) total categories available" -ForegroundColor Green
    Write-Host ""
    Write-Host "Category Distribution:" -ForegroundColor Yellow
    
    $large = ($response.data | Where-Object { $_.product_count -ge 10 }).Count
    $medium = ($response.data | Where-Object { $_.product_count -ge 5 -and $_.product_count -lt 10 }).Count
    $small = ($response.data | Where-Object { $_.product_count -lt 5 }).Count
    
    Write-Host "  Large (10+ products): $large categories"
    Write-Host "  Medium (5-9 products): $medium categories"
    Write-Host "  Small (1-4 products): $small categories"
    Write-Host ""
    
    Write-Host "Sample Categories:" -ForegroundColor Yellow
    $response.data | Select-Object -First 10 | Format-Table category_name, product_count, shop_count -AutoSize
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "PHASE 5B TESTING COMPLETE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  - Category aggregation endpoint: /api/public/shops/categories"
Write-Host "  - Default: 20 categories, minimum 3 products"
Write-Host "  - Cache: 1 hour (3600 seconds)"
Write-Host "  - Metrics: product_count, shop_count, trending_score, price_range"
Write-Host ""
Write-Host "All tests completed. Review the results above for any errors." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit"
