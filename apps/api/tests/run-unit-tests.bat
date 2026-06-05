@echo off
echo ========================================
echo Unit Tests - UniversalSingleton
echo ========================================
echo.

set TEST_LOGS=logs
if not exist %TEST_LOGS% mkdir %TEST_LOGS%

echo Running Unit Tests...
echo Testing core singleton functionality...

node test-runner.js --type=unit --output=%TEST_LOGS%\unit-test.log

if %errorlevel% equ 0 (
    echo ✅ Unit tests passed!
    echo.
    echo Test Summary:
    type %TEST_LOGS%\unit-test-summary.txt
) else (
    echo ❌ Unit tests failed!
    echo.
    echo Error Details:
    type %TEST_LOGS%\unit-test.log
)

echo.
pause
