@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   BACKEND SERVICES READINESS TEST
echo ========================================
echo.

REM Configuration
set API_BASE_URL=http://localhost:4000
set TEST_TIMEOUT=10
set TOTAL_TESTS=0
set PASSED_TESTS=0
set FAILED_TESTS=0

REM Authentication
set AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1IiwidGlkLXI2Y2NjcGFnIl0sImlhdCI6MTc2ODkxODMwOCwiZXhwIjoxODAwNDU0MzA4fQ.-Swkbx8_UOF_4rpBKhs5XvJauNgu0ef6IR_buNbYz64
set TENANT_ID=tid-m8ijkrnk

echo Testing API at: %API_BASE_URL%
echo Timeout per test: %TEST_TIMEOUT% seconds
echo.

REM Function to test an endpoint
:test_endpoint
set "TEST_NAME=%~1"
set "ENDPOINT=%~2"
set "EXPECTED_STATUS=%~3"

set /a TOTAL_TESTS+=1
echo  Testing %TEST_NAME%...

REM Use curl to test the endpoint
curl -s -w "%%{http_code}" -o "temp_response_%TOTAL_TESTS%.txt" "%API_BASE_URL%%ENDPOINT%" --max-time %TEST_TIMEOUT%

REM Get the HTTP status code
set /p HTTP_STATUS=<temp_response_%TOTAL_TESTS%.txt

REM Check if the test passed
if "%HTTP_STATUS%"=="%EXPECTED_STATUS%" (
    echo    ✅ %TEST_NAME% - %HTTP_STATUS%
    set /a PASSED_TESTS+=1
) else (
    echo    ❌ %TEST_NAME% - %HTTP_STATUS%
    echo    📄 Error response saved to temp_response_%TOTAL_TESTS%.txt
    set /a FAILED_TESTS+=1
)

REM Clean up temp file
if exist temp_response_%TOTAL_TESTS%.txt del temp_response_%TOTAL_TESTS%.txt
goto :eof

echo.
echo ========================================
echo   CORE SERVICES TESTS
echo ========================================
echo.

call :test_endpoint "Health Check" "/api/health" "200"
call :test_endpoint "Public API Status" "/api/public/status" "200"
call :test_endpoint "Featured Products" "/api/featured-products" "200"
call :test_endpoint "Items API" "/api/items" "200"
call :test_endpoint "Tenants API" "/api/tenants" "200"

echo.
echo ========================================
echo   SHOPS FEATURED SERVICE TESTS
echo ========================================
echo.

call :test_endpoint "Random Products" "/api/shops/featured/random" "200"
call :test_endpoint "Trending Products" "/api/shops/featured/trending" "200"
call :test_endpoint "New Products" "/api/shops/featured/new" "200"
call :test_endpoint "Sale Products" "/api/shops/featured/sale" "200"
call :test_endpoint "Seasonal Products" "/api/shops/featured/seasonal" "200"
call :test_endpoint "Staff Pick Products" "/api/shops/featured/staff-pick" "200"
call :test_endpoint "Store Selection Products" "/api/shops/featured/store-selection" "200"
call :test_endpoint "Trending Shops" "/api/shops/trending" "200"

echo.
echo ========================================
echo   CAPACITY & LIMITS SERVICES TESTS
echo ========================================
echo.

call :test_endpoint "Tenant Limits Status" "/api/tenant-limits/status" "200"
call :test_endpoint "Tenant Limits Tiers" "/api/tenant-limits/tiers" "200"
call :test_endpoint "Subscription Usage" "/api/subscription-usage" "200"

echo.
echo ========================================
echo   AUTHENTICATION SERVICES TESTS
echo ========================================
echo.

call :test_endpoint "Auth Status" "/api/auth/status" "200"
call :test_endpoint "User Profile" "/api/user/profile" "401"

echo.
echo ========================================
echo   DIRECTORY SERVICES TESTS
echo ========================================
echo.

call :test_endpoint "Directory Search" "/api/directory/search" "200"
call :test_endpoint "Directory Categories" "/api/directory/categories" "200"

echo.
echo ========================================
echo   READINESS TEST SUMMARY
echo ========================================
echo.

set /a SUCCESS_RATE=!PASSED_TESTS!*100/!TOTAL_TESTS!

echo Total Tests: !TOTAL_TESTS!
echo Passed: !PASSED_TESTS!
echo Failed: !FAILED_TESTS!
echo Success Rate: !SUCCESS_RATE!%%
echo.

if !FAILED_TESTS! EQU 0 (
    echo 🎉 ALL TESTS PASSED! Backend is ready for shops pages development.
    echo ✅ All backend services are ready
    echo 🚀 Proceed with shops pages development
) else if !SUCCESS_RATE! GEQ 80 (
    echo ⚠️  MOST TESTS PASSED. Backend is mostly ready for shops pages development.
    echo 🔧 Fix failed endpoints before proceeding
    echo 📝 Check API routes and database connections
) else (
    echo ❌ MANY TESTS FAILED. Backend needs fixes before shops pages development.
    echo 🔧 Fix failed endpoints before proceeding
    echo 📝 Check API routes and database connections
    echo 🧪 Run individual endpoint tests for debugging
)

echo.
echo RECOMMENDATIONS:
if !FAILED_TESTS! EQU 0 (
    echo ✅ All backend services are ready - proceed with shops pages development
) else (
    echo ❌ Backend needs fixes - address failed tests first
    echo 💡 Check if API server is running at %API_BASE_URL%
    echo 💡 Verify database connectivity
    echo 💡 Check API route configurations
)

echo.
echo Press any key to exit...
pause >nul

REM Exit with appropriate code
if !FAILED_TESTS! GTR 0 (
    exit /b 1
) else (
    exit /b 0
)
