@echo off
setlocal enabledelayedexpansion

echo ============================================
echo PHASE 2 ^& 3: SHOPS DISCOVERY API TESTS
echo ============================================
echo Base URL: http://localhost:4000
echo Test Tenant: tid-m8ijkrnk
echo.
echo.

REM ====================
REM PHASE 2: CONVERSION-FOCUSED DISCOVERY
REM ====================

echo [TEST 1] GET /api/public/shops/global/sale (Global Scope)
echo Expected: Sale products with expiration handling
echo.
curl -s "http://localhost:4000/api/public/shops/global/sale?limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 2] GET /api/public/shops/shop/sale (Shop Scope)
echo Expected: Sale products for specific tenant
echo.
curl -s "http://localhost:4000/api/public/shops/shop/sale?tenantId=tid-m8ijkrnk&limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 3] GET /api/public/shops/global/seasonal (Global Scope)
echo Expected: Seasonal products with expiration handling
echo.
curl -s "http://localhost:4000/api/public/shops/global/seasonal?limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 4] GET /api/public/shops/shop/seasonal (Shop Scope)
echo Expected: Seasonal products for specific tenant
echo.
curl -s "http://localhost:4000/api/public/shops/shop/seasonal?tenantId=tid-m8ijkrnk&limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 5] GET /api/public/shops/global/staff (Global Scope)
echo Expected: Staff picks from all shops
echo.
curl -s "http://localhost:4000/api/public/shops/global/staff?limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 6] GET /api/public/shops/shop/staff (Shop Scope)
echo Expected: Staff picks for specific tenant
echo.
curl -s "http://localhost:4000/api/public/shops/shop/staff?tenantId=tid-m8ijkrnk&limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

REM ====================
REM PHASE 3: STORE SELECTIONS + TRENDING SHOPS
REM ====================

echo [TEST 7] GET /api/public/shops/global/selection (Global Scope)
echo Expected: Store selections from all shops
echo.
curl -s "http://localhost:4000/api/public/shops/global/selection?limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 8] GET /api/public/shops/shop/selection (Shop Scope)
echo Expected: Store selections for specific tenant
echo.
curl -s "http://localhost:4000/api/public/shops/shop/selection?tenantId=tid-m8ijkrnk&limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 9] GET /api/public/shops/trending-shops (Standalone Aggregation)
echo Expected: Aggregated trending shops with quality metrics
echo.
curl -s "http://localhost:4000/api/public/shops/trending-shops?limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 10] Verify Expiration Filtering (Sale Products)
echo Expected: Only active, non-expired sale items
echo.
curl -s "http://localhost:4000/api/public/shops/global/sale?limit=3"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 11] Verify Featured Type Filtering (Staff vs Selection)
echo Expected: Different products for staff picks vs store selections
echo.
echo Staff Picks:
curl -s "http://localhost:4000/api/public/shops/global/staff?limit=3"
echo.
echo.
echo Store Selections:
curl -s "http://localhost:4000/api/public/shops/global/selection?limit=3"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 12] Trending Shops - Quality Metrics (Standalone Endpoint)
echo Expected: Shops with min 3 products, quality completion rates
echo.
curl -s "http://localhost:4000/api/public/shops/trending-shops?limit=3"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo ============================================
echo PHASE 2 ^& 3 TESTING COMPLETE
echo ============================================
echo.
echo Tests Completed:
echo   [1] Sale Products - Global Scope
echo   [2] Sale Products - Shop Scope
echo   [3] Seasonal Products - Global Scope
echo   [4] Seasonal Products - Shop Scope
echo   [5] Staff Picks - Global Scope
echo   [6] Staff Picks - Shop Scope
echo   [7] Store Selections - Global Scope
echo   [8] Store Selections - Shop Scope
echo   [9] Trending Shops Aggregation
echo  [10] Expiration Filtering
echo  [11] Featured Type Filtering
echo  [12] Quality Metrics
echo.
echo Review the results above for any errors or unexpected behavior.
echo.
echo Next Steps:
echo   - Verify expiration handling works correctly
echo   - Check staff picks vs store selections are filtered correctly
echo   - Confirm trending shops have quality metrics
echo   - Validate minimum product threshold (3+) for shops
echo.
pause
