@echo off
setlocal enabledelayedexpansion

echo ============================================
echo PHASE 4: RANDOM DISCOVERY + MV CACHE TESTS
echo ============================================
echo Base URL: http://localhost:4000
echo Test Tenant: tid-m8ijkrnk
echo.
echo.

echo [TEST 1] GET /api/public/shops/global/random (Pure Random)
echo Expected: Random products with images and prices
echo.
curl -i "http://localhost:4000/api/public/shops/global/random?limit=5" 2>&1 | findstr /C:"X-MV-Refreshed-At" /C:"Cache-Control" /C:"X-MV-Source"
echo.
curl -s "http://localhost:4000/api/public/shops/global/random?limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 2] GET /api/public/shops/shop/random (Shop-Scoped Random)
echo Expected: Random products from specific tenant
echo.
curl -i "http://localhost:4000/api/public/shops/shop/random?tenantId=tid-m8ijkrnk&limit=5" 2>&1 | findstr /C:"X-MV-Refreshed-At" /C:"Cache-Control" /C:"X-MV-Source"
echo.
curl -s "http://localhost:4000/api/public/shops/shop/random?tenantId=tid-m8ijkrnk&limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 3] GET /api/public/shops/global/random-weighted (Trending-Weighted Random)
echo Expected: Random products weighted by trending score
echo.
curl -i "http://localhost:4000/api/public/shops/global/random-weighted?limit=5" 2>&1 | findstr /C:"X-MV-Refreshed-At" /C:"Cache-Control" /C:"X-MV-Source"
echo.
curl -s "http://localhost:4000/api/public/shops/global/random-weighted?limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 4] GET /api/public/shops/shop/random-weighted (Shop-Scoped Weighted)
echo Expected: Trending-weighted random from specific tenant
echo.
curl -i "http://localhost:4000/api/public/shops/shop/random-weighted?tenantId=tid-m8ijkrnk&limit=5" 2>&1 | findstr /C:"X-MV-Refreshed-At" /C:"Cache-Control" /C:"X-MV-Source"
echo.
curl -s "http://localhost:4000/api/public/shops/shop/random-weighted?tenantId=tid-m8ijkrnk&limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 5] Verify MV Cache Headers (Sale Products)
echo Expected: X-MV-Refreshed-At, Cache-Control, X-MV-Source headers
echo.
curl -i "http://localhost:4000/api/public/shops/global/sale?limit=3" 2>&1 | findstr /C:"X-MV-Refreshed-At" /C:"Cache-Control" /C:"X-MV-Source"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 6] Verify MV Cache Headers (Trending Shops)
echo Expected: X-MV-Refreshed-At, Cache-Control, X-MV-Source headers
echo.
curl -i "http://localhost:4000/api/public/shops/trending-shops?limit=3" 2>&1 | findstr /C:"X-MV-Refreshed-At" /C:"Cache-Control" /C:"X-MV-Source"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 7] Random Discovery - Quality Filters
echo Expected: All products have images, prices, and are in stock
echo.
curl -s "http://localhost:4000/api/public/shops/global/random?limit=10"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 8] Random vs Weighted Comparison
echo Expected: Different product sets (random vs trending-weighted)
echo.
echo Pure Random:
curl -s "http://localhost:4000/api/public/shops/global/random?limit=3"
echo.
echo.
echo Trending-Weighted Random:
curl -s "http://localhost:4000/api/public/shops/global/random-weighted?limit=3"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo ============================================
echo PHASE 4 TESTING COMPLETE
echo ============================================
echo.
echo Tests Completed:
echo   [1] Pure Random Discovery - Global Scope
echo   [2] Pure Random Discovery - Shop Scope
echo   [3] Trending-Weighted Random - Global Scope
echo   [4] Trending-Weighted Random - Shop Scope
echo   [5] MV Cache Headers - Sale Products
echo   [6] MV Cache Headers - Trending Shops
echo   [7] Quality Filters Verification
echo   [8] Random vs Weighted Comparison
echo.
echo Review the results above for any errors or unexpected behavior.
echo.
echo Next Steps:
echo   - Verify X-MV-Refreshed-At header matches MV refresh timestamp
echo   - Confirm Cache-Control is set to 900 seconds (15 min)
echo   - Check that random products have images and prices
echo   - Compare weighted random favors higher trending scores
echo.
pause
