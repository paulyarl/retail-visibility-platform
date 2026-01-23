@echo off
echo ========================================
echo Performance Tests - UniversalSingleton
echo ========================================
echo.

set TEST_LOGS=logs
if not exist %TEST_LOGS% mkdir %TEST_LOGS%

echo Running Performance Tests...
echo Testing performance under various load conditions...

node test-runner.js --type=performance --output=%TEST_LOGS%\performance-test.log

if %errorlevel% equ 0 (
    echo ✅ Performance tests passed!
    echo.
    echo Performance Summary:
    type %TEST_LOGS%\performance-test-summary.txt
) else (
    echo ❌ Performance tests failed!
    echo.
    echo Error Details:
    type %TEST_LOGS%\performance-test.log
)

echo.
pause
