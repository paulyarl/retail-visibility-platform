@echo off
REM ============================================
REM Phase 1 Shops Discovery API Test Script
REM ============================================
REM Tests basic shop discovery endpoints with scope-aware routing
REM Base URL: http://localhost:3001 (adjust if needed)
REM ============================================

setlocal enabledelayedexpansion

REM Configuration
set BASE_URL=http://localhost:4000
set TEST_TENANT_ID=tid-m8ijkrnk

echo.
echo ============================================
echo PHASE 1: SHOPS DISCOVERY API TESTS
echo ============================================
echo Base URL: %BASE_URL%
echo Test Tenant: %TEST_TENANT_ID%
echo.

REM ============================================
REM TEST 1: Trending Shops (Public)
REM ============================================
echo.
echo [TEST 1] GET /api/public/shops/trending
echo Expected: List of trending shops with mock data
echo.
curl -X GET "%BASE_URL%/api/public/shops/trending?limit=8" ^
  -H "Content-Type: application/json" ^
  -w "\nStatus: %%{http_code}\n" ^
  -s
echo.
pause

REM ============================================
REM TEST 2: Trending Products - Global Scope
REM ============================================
echo.
echo [TEST 2] GET /api/public/shops/global/trending (Global Scope)
echo Expected: Trending products from mv_trending_products MV
echo.
curl -X GET "%BASE_URL%/api/public/shops/global/trending?limit=12" ^
  -H "Content-Type: application/json" ^
  -w "\nStatus: %%{http_code}\n" ^
  -s
echo.
pause

REM ============================================
REM TEST 3: Trending Products - Shop Scope
REM ============================================
echo.
echo [TEST 3] GET /api/public/shops/shop/trending (Shop Scope)
echo Expected: Trending products for specific tenant
echo.
curl -X GET "%BASE_URL%/api/public/shops/shop/trending?tenantId=%TEST_TENANT_ID%&limit=12" ^
  -H "Content-Type: application/json" ^
  -w "\nStatus: %%{http_code}\n" ^
  -s
echo.
pause

REM ============================================
REM TEST 4: New Products - Global Scope
REM ============================================
echo.
echo [TEST 4] GET /api/public/shops/global/new (Global Scope)
echo Expected: New arrival products from mv_new_products MV
echo.
curl -X GET "%BASE_URL%/api/public/shops/global/new?limit=12" ^
  -H "Content-Type: application/json" ^
  -w "\nStatus: %%{http_code}\n" ^
  -s
echo.
pause

REM ============================================
REM TEST 5: New Products - Shop Scope
REM ============================================
echo.
echo [TEST 5] GET /api/public/shops/shop/new (Shop Scope)
echo Expected: New products for specific tenant
echo.
curl -X GET "%BASE_URL%/api/public/shops/shop/new?tenantId=%TEST_TENANT_ID%&limit=12" ^
  -H "Content-Type: application/json" ^
  -w "\nStatus: %%{http_code}\n" ^
  -s
echo.
pause

REM ============================================
REM TEST 6: Random Featured Shops
REM ============================================
echo.
echo [TEST 6] GET /api/public/shops/global/random
echo Expected: Random featured products (global scope)
echo.
curl -X GET "%BASE_URL%/api/public/shops/global/random?limit=10" ^
  -H "Content-Type: application/json" ^
  -w "\nStatus: %%{http_code}\n" ^
  -s
echo.
pause

REM ============================================
REM TEST 7: MV Cache Headers Check (Trending)
REM ============================================
echo.
echo [TEST 7] Check MV Cache Headers (Trending Products)
echo Expected: X-MV-Refreshed-At, Cache-Control, X-MV-Source headers
echo.
curl -X GET "%BASE_URL%/api/public/shops/global/trending?limit=5" ^
  -H "Content-Type: application/json" ^
  -i ^
  -s | findstr /C:"X-MV-" /C:"Cache-Control"
echo.
pause

REM ============================================
REM TEST 8: MV Cache Headers Check (New Products)
REM ============================================
echo.
echo [TEST 8] Check MV Cache Headers (New Products)
echo Expected: X-MV-Refreshed-At, Cache-Control, X-MV-Source headers
echo.
curl -X GET "%BASE_URL%/api/public/shops/global/new?limit=5" ^
  -H "Content-Type: application/json" ^
  -i ^
  -s | findstr /C:"X-MV-" /C:"Cache-Control"
echo.
pause

REM ============================================
REM TEST 9: Scope Parameter Validation
REM ============================================
echo.
echo [TEST 9] Test scope parameter (global scope default)
echo Expected: Global scope results
echo.
curl -X GET "%BASE_URL%/api/public/shops/global/trending?limit=5" ^
  -H "Content-Type: application/json" ^
  -w "\nStatus: %%{http_code}\n" ^
  -s
echo.
pause

REM ============================================
REM TEST 10: Rich Data Metadata Check
REM ============================================
echo.
echo [TEST 10] Verify Rich Data Metadata in Response
echo Expected: metadata.richDataIncluded with variants, imageGallery, etc.
echo.
curl -X GET "%BASE_URL%/api/public/shops/global/trending?limit=3" ^
  -H "Content-Type: application/json" ^
  -s
echo.
pause

REM ============================================
REM TEST 11: Error Handling - Invalid Tenant
REM ============================================
echo.
echo [TEST 11] Error Handling - Invalid Tenant ID
echo Expected: Graceful error or empty results
echo.
curl -X GET "%BASE_URL%/api/public/shops/shop/trending?tenantId=invalid-tenant-id&limit=5" ^
  -H "Content-Type: application/json" ^
  -w "\nStatus: %%{http_code}\n" ^
  -s
echo.
pause

REM ============================================
REM TEST 12: Limit Parameter Validation
REM ============================================
echo.
echo [TEST 12] Test Limit Parameter (request 3 items)
echo Expected: Exactly 3 items returned
echo.
curl -X GET "%BASE_URL%/api/public/shops/global/trending?limit=3" ^
  -H "Content-Type: application/json" ^
  -s
echo.
pause

REM ============================================
REM SUMMARY
REM ============================================
echo.
echo ============================================
echo PHASE 1 TESTING COMPLETE
echo ============================================
echo.
echo Tests Completed:
echo   [1] Trending Shops (Public)
echo   [2] Trending Products - Global Scope
echo   [3] Trending Products - Shop Scope
echo   [4] New Products - Global Scope
echo   [5] New Products - Shop Scope
echo   [6] Random Featured Shops
echo   [7] MV Cache Headers - Trending
echo   [8] MV Cache Headers - New Products
echo   [9] Scope Parameter Validation
echo  [10] Rich Data Metadata Check
echo  [11] Error Handling - Invalid Tenant
echo  [12] Limit Parameter Validation
echo.
echo Review the results above for any errors or unexpected behavior.
echo.
echo Next Steps:
echo   - Verify all endpoints return 200 status
echo   - Check MV cache headers are present
echo   - Confirm rich data metadata is included
echo   - Validate scope routing works correctly
echo.
pause
