@echo off
echo ========================================
echo Integration Tests - UniversalSingleton
echo ========================================
echo.

set TEST_LOGS=logs
if not exist %TEST_LOGS% mkdir %TEST_LOGS%

echo Running Integration Tests...
echo Testing real API endpoints with authentication...
echo Tenant: tid-m8ijkrnk
echo User: platform@rvp.com
echo Role: PLATFORMFORM_ADMIN
echo.

node integration-test.js

if %errorlevel% equ 0 (
    echo ✅ Integration tests passed!
    echo.
    echo Integration Test Summary:
    type %TEST_LOGS%\integration-test-summary.txt
) else (
    echo ❌ Integration tests failed!
    echo.
    echo Error Details:
    type %TEST_LOGS%\integration-test-report.json
)

echo.
pause
