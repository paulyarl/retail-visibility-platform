@echo off
echo ========================================
echo Stress Tests - UniversalSingleton
echo ========================================
echo.

set TEST_LOGS=logs
if not exist %TEST_LOGS% mkdir %TEST_LOGS%

echo Running Stress Tests...
echo Testing breaking points and failure scenarios...

node test-runner.js --type=stress --output=%TEST_LOGS%\stress-test.log

if %errorlevel% equ 0 (
    echo ✅ Stress tests passed!
    echo.
    echo Stress Test Summary:
    type %TEST_LOGS%\stress-test-summary.txt
) else (
    echo ❌ Stress tests failed!
    echo.
    echo Error Details:
    type %TEST_LOGS%\stress-test.log
)

echo.
pause
