@echo off
echo ========================================
echo High Concurrency Test - 500 Users
echo ========================================
echo.

set TEST_LOGS=logs
if not exist %TEST_LOGS% mkdir %TEST_LOGS%

echo Running High Concurrency Test...
echo Testing UniversalSingleton with 500 concurrent users!
echo Each user makes 10 requests = 5000 total requests
echo Using real authentication data...
echo Tenant: tid-m8ijkrnk
echo User: platform@rvp.com
echo Role: PLATFORMFORM_ADMIN
echo.

node high-concurrency-test.js

if %errorlevel% equ 0 (
    echo ✅ High concurrency test completed!
    echo.
    echo Test Summary:
    type %TEST_LOGS%\high-concurrency-summary.txt
) else (
    echo ❌ High concurrency test failed!
    echo.
    echo Error Details:
    type %TEST_LOGS%\high-concurrency-summary.txt
)

echo.
echo.
echo 🚀 This test simulates VIRAL TRAFFIC scenarios!
echo 📊 Results show if your platform is ready for massive success!
echo.
pause
