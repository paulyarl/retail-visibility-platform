@echo off
setlocal enabledelayedexpansion

echo ============================================
echo PHASE 5A: PRODUCT + SHOP CATEGORY SCOPE TESTS
echo ============================================
echo Base URL: http://localhost:4000
echo Test Tenant: tid-m8ijkrnk
echo.
echo NOTE: Run refresh_mvs_phase5a.sql first to add product category fields!
echo.
pause

echo [TEST 1] Product Category - Trending (Electronics)
echo Expected: Trending products from Electronics category
echo.
curl -i "http://localhost:4000/api/public/shops/category/trending?category[productName]=Electronics&limit=5" 2>&1 | findstr /C:"X-MV-Refreshed-At" /C:"Cache-Control" /C:"X-MV-Source"
echo.
curl -s "http://localhost:4000/api/public/shops/category/trending?category[productName]=Electronics&limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 2] Product Category - Sale (Skincare)
echo Expected: Sale products from Skincare category
echo.
curl -s "http://localhost:4000/api/public/shops/category/sale?category[productName]=Skincare&limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 3] Product Category - New Arrivals (Fashion)
echo Expected: New arrival products from Fashion category
echo.
curl -s "http://localhost:4000/api/public/shops/category/new?category[productName]=Fashion&limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 4] Shop Category - Trending (Grocery Store)
echo Expected: Trending products from Grocery Store shops
echo.
curl -i "http://localhost:4000/api/public/shops/category/trending?category[shopCategoryName]=Grocery Store&limit=5" 2>&1 | findstr /C:"X-MV-Refreshed-At" /C:"Cache-Control" /C:"X-MV-Source"
echo.
curl -s "http://localhost:4000/api/public/shops/category/trending?category[shopCategoryName]=Grocery Store&limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 5] Shop Category - Sale (Restaurant)
echo Expected: Sale products from Restaurant shops
echo.
curl -s "http://localhost:4000/api/public/shops/category/sale?category[shopCategoryName]=Restaurant&limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 6] Shop Category - Random (Market)
echo Expected: Random products from Market shops (includes secondary categories)
echo.
curl -s "http://localhost:4000/api/public/shops/category/random?category[shopCategoryName]=Market&limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 7] Shop Category - Staff Picks (Grocery)
echo Expected: Staff pick products from Grocery-related shops
echo.
curl -s "http://localhost:4000/api/public/shops/category/staff?category[shopCategoryName]=Grocery&limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 8] Product Category - Random Weighted (Electronics)
echo Expected: Trending-weighted random products from Electronics category
echo.
curl -s "http://localhost:4000/api/public/shops/category/random-weighted?category[productName]=Electronics&limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 9] Verify MV Cache Headers (Product Category)
echo Expected: X-MV-Refreshed-At, Cache-Control, X-MV-Source headers
echo.
curl -i "http://localhost:4000/api/public/shops/category/trending?category[productName]=Electronics&limit=3" 2>&1 | findstr /C:"X-MV-Refreshed-At" /C:"Cache-Control" /C:"X-MV-Source"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 10] Verify MV Cache Headers (Shop Category)
echo Expected: X-MV-Refreshed-At, Cache-Control, X-MV-Source headers
echo.
curl -i "http://localhost:4000/api/public/shops/category/sale?category[shopCategoryName]=Grocery Store&limit=3" 2>&1 | findstr /C:"X-MV-Refreshed-At" /C:"Cache-Control" /C:"X-MV-Source"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 11] Product Category with ID (using slug)
echo Expected: Products filtered by exact product category slug
echo.
curl -s "http://localhost:4000/api/public/shops/category/trending?category[productId]=electronics&limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo [TEST 12] Shop Category with ID
echo Expected: Products filtered by exact shop category ID
echo.
curl -s "http://localhost:4000/api/public/shops/category/trending?category[shopCategoryId]=gcid:grocery-store&limit=5"
echo.
echo Status: %ERRORLEVEL%
echo.
pause

echo ============================================
echo PHASE 5A TESTING COMPLETE
echo ============================================
echo.
echo Tests Completed:
echo   [1] Product Category - Trending (Electronics)
echo   [2] Product Category - Sale (Skincare)
echo   [3] Product Category - New Arrivals (Fashion)
echo   [4] Shop Category - Trending (Grocery Store)
echo   [5] Shop Category - Sale (Restaurant)
echo   [6] Shop Category - Random (Market)
echo   [7] Shop Category - Staff Picks (Grocery)
echo   [8] Product Category - Random Weighted (Electronics)
echo   [9] MV Cache Headers - Product Category
echo   [10] MV Cache Headers - Shop Category
echo   [11] Product Category with Slug (electronics)
echo   [12] Shop Category with ID (gcid:grocery-store)
echo.
echo Review the results above for any errors or unexpected behavior.
echo.
echo Next Steps:
echo   - Verify product_category_name field is populated
echo   - Confirm category filtering works correctly
echo   - Check that shop category includes secondary categories
echo   - Verify MV cache headers are present
echo.
pause
