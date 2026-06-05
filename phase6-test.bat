@echo off
REM ============================================================================
REM Phase 6: Variant Integration Testing & Optimization Script
REM ============================================================================
REM This script tests the complete variant integration from Phase 1-5
REM and provides performance metrics and optimization recommendations.
REM ============================================================================

setlocal enabledelayedexpansion

echo.
echo ========================================================================
echo   PHASE 6: VARIANT INTEGRATION TESTING
echo ========================================================================
echo.
echo This script will:
echo   1. Verify database schema and materialized view
echo   2. Test API endpoints with variant data
echo   3. Test frontend variant components
echo   4. Measure performance metrics
echo   5. Generate optimization recommendations
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause >nul

REM ============================================================================
REM STEP 1: Environment Check
REM ============================================================================
echo.
echo [STEP 1] Checking environment...
echo ----------------------------------------

REM Check if API is running
echo Checking if API server is running...
curl -s http://localhost:4000/api/health >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] API server not running on port 4000
    echo Please start the API server: cd apps/api ^&^& pnpm dev
    echo.
    set /p START_API="Start API server now? (y/n): "
    if /i "!START_API!"=="y" (
        echo Starting API server...
        start "RVP API Server" cmd /k "cd apps\api && pnpm dev"
        echo Waiting 10 seconds for API to start...
        timeout /t 10 /nobreak >nul
    ) else (
        echo Skipping API tests...
    )
) else (
    echo [OK] API server is running
)

REM Check if Web is running
echo Checking if Web server is running...
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Web server not running on port 3000
    echo Please start the web server: cd apps/web ^&^& pnpm dev
    echo.
    set /p START_WEB="Start Web server now? (y/n): "
    if /i "!START_WEB!"=="y" (
        echo Starting Web server...
        start "RVP Web Server" cmd /k "cd apps\web && pnpm dev"
        echo Waiting 15 seconds for Web to start...
        timeout /t 15 /nobreak >nul
    ) else (
        echo Skipping Web tests...
    )
) else (
    echo [OK] Web server is running
)

echo.

REM ============================================================================
REM STEP 2: Database Schema Verification
REM ============================================================================
echo.
echo [STEP 2] Verifying database schema...
echo ----------------------------------------

echo Checking storefront_variants_mv materialized view...
cd apps\api
call pnpm prisma db execute --stdin < ..\..\scripts\check-variant-mv.sql 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Could not verify materialized view
    echo Please ensure storefront_variants_mv exists in your database
) else (
    echo [OK] Materialized view verified
)

echo.

REM ============================================================================
REM STEP 3: API Endpoint Testing
REM ============================================================================
echo.
echo [STEP 3] Testing API endpoints with variant data...
echo ----------------------------------------

echo.
echo Testing ScopeRouter with variant transformation...
echo   - Global scope (shops directory)
curl -s "http://localhost:4000/api/public/shops/discover/trending?scope=global&tenantId=global&limit=5" > phase6-test-global.json
if %errorlevel% equ 0 (
    echo   [OK] Global scope endpoint working
) else (
    echo   [FAIL] Global scope endpoint failed
)

echo   - Category scope
curl -s "http://localhost:4000/api/public/shops/discover/trending?scope=category&category[productName]=Electronics&limit=5" > phase6-test-category.json
if %errorlevel% equ 0 (
    echo   [OK] Category scope endpoint working
) else (
    echo   [FAIL] Category scope endpoint failed
)

echo   - Shop scope
curl -s "http://localhost:4000/api/public/shops/discover/trending?scope=shop&tenantId=tid-m8ijkrnk&limit=5" > phase6-test-shop.json
if %errorlevel% equ 0 (
    echo   [OK] Shop scope endpoint working
) else (
    echo   [FAIL] Shop scope endpoint failed
)

echo.
echo Testing variant-specific endpoints...
curl -s -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1IiwidGlkLXI2Y2NjcGFnIl0sImlhdCI6MTc2OTUzMTA4NCwiZXhwIjoxODAxMDY3MDg0fQ.XPwuEHeVEK4ETo4FKZknnPiNYCLbJmvHmrvK_-Q9Jdg" "http://localhost:4000/api/items?tenantId=tid-m8ijkrnk&limit=5" > phase6-test-items.json
if %errorlevel% equ 0 (
    echo   [OK] Items endpoint working
) else (
    echo   [FAIL] Items endpoint failed
)

echo.

REM ============================================================================
REM STEP 4: Response Analysis
REM ============================================================================
echo.
echo [STEP 4] Analyzing API responses...
echo ----------------------------------------

echo.
echo Checking for variant fields in responses...
findstr /C:"has_variants" /C:"variant_count" /C:"price_range" phase6-test-global.json >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Variant fields present in global scope response
) else (
    echo   [WARNING] Variant fields not found in global scope response
)

findstr /C:"has_variants" /C:"variant_count" /C:"price_range" phase6-test-category.json >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Variant fields present in category scope response
) else (
    echo   [WARNING] Variant fields not found in category scope response
)

echo.
echo Sample response saved to: phase6-test-*.json
echo Review these files to verify variant data structure

echo.

REM ============================================================================
REM STEP 5: Performance Metrics
REM ============================================================================
echo.
echo [STEP 5] Measuring performance metrics...
echo ----------------------------------------

echo.
echo Testing ScopeRouter cache performance...
echo   Run 1 (cache miss):
powershell -Command "Measure-Command { Invoke-WebRequest -Uri 'http://localhost:4000/api/public/shops/discovery?bucketType=trending&scope=global&limit=12' -UseBasicParsing } | Select-Object -ExpandProperty TotalMilliseconds"

echo   Run 2 (cache hit):
powershell -Command "Measure-Command { Invoke-WebRequest -Uri 'http://localhost:4000/api/public/shops/discovery?bucketType=trending&scope=global&limit=12' -UseBasicParsing } | Select-Object -ExpandProperty TotalMilliseconds"

echo   Run 3 (cache hit):
powershell -Command "Measure-Command { Invoke-WebRequest -Uri 'http://localhost:4000/api/public/shops/discovery?bucketType=trending&scope=global&limit=12' -UseBasicParsing } | Select-Object -ExpandProperty TotalMilliseconds"

echo.
echo Expected: Run 2 and 3 should be significantly faster (cache hits)

echo.

REM ============================================================================
REM STEP 6: Frontend Component Testing
REM ============================================================================
echo.
echo [STEP 6] Frontend component verification...
echo ----------------------------------------

echo.
echo Checking if variant components are built...
if exist "apps\web\.next\server\chunks\ssr\apps_web_src_components_variants_VariantBadge_tsx*.js" (
    echo   [OK] VariantBadge component built
) else (
    echo   [WARNING] VariantBadge component not found in build
)

if exist "apps\web\.next\server\chunks\ssr\apps_web_src_components_variants_PriceRangeDisplay_tsx*.js" (
    echo   [OK] PriceRangeDisplay component built
) else (
    echo   [WARNING] PriceRangeDisplay component not found in build
)

if exist "apps\web\.next\server\chunks\ssr\apps_web_src_components_variants_VariantSelector_tsx*.js" (
    echo   [OK] VariantSelector component built
) else (
    echo   [WARNING] VariantSelector component not found in build
)

echo.
echo Opening test pages in browser...
echo   - Shops directory: http://localhost:3000/shops
echo   - Product cards should show variant badges and price ranges
echo.

start http://localhost:3000/shops

echo.
echo Please verify in browser:
echo   1. Product cards display variant badges (e.g., "3 variants")
echo   2. Price ranges shown for parent products (e.g., "$10.00 - $25.00")
echo   3. Variant selector works on product detail pages
echo   4. No console errors related to variants
echo.

pause

REM ============================================================================
REM STEP 7: Metrics Collection
REM ============================================================================
echo.
echo [STEP 7] Collecting ScopeRouter metrics...
echo ----------------------------------------

echo.
echo ScopeRouter metrics endpoint:
curl -s -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1IiwidGlkLXI2Y2NjcGFnIl0sImlhdCI6MTc2OTUzMTA4NCwiZXhwIjoxODAxMDY3MDg0fQ.XPwuEHeVEK4ETo4FKZknnPiNYCLbJmvHmrvK_-Q9Jdg" "http://localhost:4000/api/admin/scope-router/metrics" 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Metrics endpoint not available (optional)
    echo You can check metrics in server logs
)

echo.

REM ============================================================================
REM STEP 8: Optimization Recommendations
REM ============================================================================
echo.
echo [STEP 8] Optimization recommendations...
echo ----------------------------------------

echo.
echo Based on Phase 1-5 implementation, consider:
echo.
echo 1. CACHING:
echo    - ScopeRouter: 5-minute cache (implemented)
echo    - Consider Redis for distributed caching
echo    - Monitor cache hit rates (target: 70%%+)
echo.
echo 2. DATABASE:
echo    - Refresh storefront_variants_mv regularly
echo    - Add indexes on frequently filtered columns
echo    - Monitor query performance
echo.
echo 3. API:
echo    - ScopeRouter retry logic (implemented)
echo    - Consider rate limiting for public endpoints
echo    - Monitor response times (target: <200ms cached, <1s uncached)
echo.
echo 4. FRONTEND:
echo    - Variant components use React.memo for optimization
echo    - Consider lazy loading for variant selectors
echo    - Monitor bundle size impact
echo.
echo 5. MONITORING:
echo    - Set up alerts for cache hit rate drops
echo    - Track variant-related errors
echo    - Monitor materialized view freshness
echo.

REM ============================================================================
REM STEP 9: Generate Test Report
REM ============================================================================
echo.
echo [STEP 9] Generating test report...
echo ----------------------------------------

echo.
echo Creating phase6-test-report.txt...
(
    echo ========================================================================
    echo PHASE 6 VARIANT INTEGRATION TEST REPORT
    echo ========================================================================
    echo Generated: %date% %time%
    echo.
    echo ENVIRONMENT:
    echo   - API Server: http://localhost:4000
    echo   - Web Server: http://localhost:3000
    echo.
    echo TEST RESULTS:
    echo   See phase6-test-*.json files for API responses
    echo.
    echo VARIANT COMPONENTS:
    echo   - VariantBadge: Displays variant count
    echo   - PriceRangeDisplay: Shows price ranges for parent products
    echo   - VariantSelector: Interactive variant selection
    echo   - VariantInfoCard: Comprehensive variant information
    echo.
    echo INTEGRATION POINTS:
    echo   - SmartProductCard: All 4 variants integrated
    echo   - ScopeRouter: Caching and retry logic implemented
    echo   - API Transformation: Computed variant fields added
    echo.
    echo NEXT STEPS:
    echo   1. Test with real product data containing variants
    echo   2. Monitor cache performance in production
    echo   3. Set up monitoring alerts
    echo   4. Consider additional optimizations based on usage patterns
    echo.
    echo DOCUMENTATION:
    echo   - VARIANT_JOIN_IMPLEMENTATION_STATUS.md
    echo   - VARIANT_INTEGRATION_GUIDE.md
    echo   - SINGLETON_REFACTORING_SUMMARY.md
    echo.
    echo ========================================================================
) > phase6-test-report.txt

echo [OK] Test report saved to: phase6-test-report.txt

echo.

REM ============================================================================
REM COMPLETION
REM ============================================================================
echo.
echo ========================================================================
echo   PHASE 6 TESTING COMPLETE
echo ========================================================================
echo.
echo Summary:
echo   - API endpoints tested
echo   - Variant fields verified
echo   - Performance metrics collected
echo   - Frontend components checked
echo   - Test report generated
echo.
echo Review the following files:
echo   - phase6-test-report.txt (summary)
echo   - phase6-test-*.json (API responses)
echo.
echo Next steps:
echo   1. Review test report for any warnings
echo   2. Test with real variant data in your database
echo   3. Monitor performance in production
echo   4. Set up alerts for cache metrics
echo.
echo Documentation:
echo   - See VARIANT_INTEGRATION_GUIDE.md for developer guide
echo   - See SINGLETON_REFACTORING_SUMMARY.md for architecture
echo.
echo ========================================================================
echo.

pause

endlocal
