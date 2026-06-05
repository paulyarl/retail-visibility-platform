@echo off
echo ========================================
echo Quick Test Runner - UniversalSingleton
echo ========================================
echo.

echo Choose test type:
echo 1. Unit Tests (Simulated)
echo 2. Integration Tests (Simulated)
echo 3. Performance Tests (Simulated)
echo 4. Stress Tests (Simulated)
echo 5. All Tests (Simulated)
echo 6. Quick Integration Test Only (Simulated)
echo 7. Real Implementation Tests (NEW!)
echo 8. High Concurrency Test - 500 Users (VIRAL TRAFFIC!)
echo.
set /p choice="Enter your choice (1-8): "

if "%choice%"=="1" (
    call run-unit-tests.bat
) else if "%choice%"=="2" (
    call run-integration-tests.bat
) else if "%choice%"=="3" (
    call run-performance-tests.bat
) else if "%choice%"=="4" (
    call run-stress-tests.bat
) else if "%choice%"=="5" (
    call run-all-tests.bat
) else if "%choice%"=="6" (
    echo Running quick integration test...
    node integration-test.js
) else if "%choice%"=="7" (
    call run-real-implementation-tests.bat
) else if "%choice%"=="8" (
    call run-high-concurrency-test.bat
) else (
    echo Invalid choice!
)

echo.
pause
