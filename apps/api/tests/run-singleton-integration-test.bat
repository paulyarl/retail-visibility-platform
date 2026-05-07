@echo off
echo ========================================
echo UniversalSingleton Integration Test
echo ========================================
echo.

set TEST_LOGS=logs
if not exist %TEST_LOGS% mkdir %TEST_LOGS%

echo Running UniversalSingleton Integration Test...
echo Testing integrated API endpoints with real authentication!
echo Testing Security Monitoring, Rate Limiting, Behavior Tracking, and Tenant Profile services
echo User: platform@rvp.com
echo Tenant: tid-m8ijkrnk
echo Role: PLATFORMFORM_ADMIN
echo.

node singelton-integration-test.js

if %errorlevel% equ 0 (
    echo ✅ Integration test completed!
    echo.
    echo Test Summary:
    type %TEST_LOGS%\singleton-integration-summary.txt
) else (
    echo ❌ Integration test failed!
    echo.
    echo Error Details:
    type %TEST_LOGS%\singleton-integration-summary.txt
)

echo.
echo.
echo 🚀 This test verifies the UniversalSingleton integration!
echo 📊 Results show if your services are properly connected to the API!
echo.
pause
