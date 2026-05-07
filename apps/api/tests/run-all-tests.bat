@echo off
echo ========================================
echo UniversalSingleton Test Suite
echo ========================================
echo.

REM Set environment variables
set TEST_ENV=staging
set TEST_DB=test_rvp_db
set TEST_REDIS=test_rvp_redis
set TEST_LOGS=logs
set TEST_REPORTS=reports

REM Create directories if they don't exist
if not exist %TEST_LOGS% mkdir %TEST_LOGS%
if not exist %TEST_REPORTS% mkdir %TEST_REPORTS%

echo Starting UniversalSingleton Test Suite...
echo Environment: %TEST_ENV%
echo Timestamp: %date% %time%
echo.

REM Run test phases
call :run_unit_tests
call :run_integration_tests
call :run_performance_tests
call :run_security_tests
call :run_stress_tests
call :generate_report

echo.
echo ========================================
echo Test Suite Complete!
echo ========================================
pause
goto :eof

:run_unit_tests
echo [PHASE 1] Running Unit Tests...
echo Testing core singleton functionality...
node test-runner.js --type=unit --output=%TEST_LOGS%\unit-test.log
if %errorlevel% neq 0 (
    echo ❌ Unit tests failed!
    echo Check %TEST_LOGS%\unit-test.log for details
) else (
    echo ✅ Unit tests passed!
)
echo.

:run_integration_tests
echo [PHASE 2] Running Integration Tests...
echo Testing service integration...
node test-runner.js --type=integration --output=%TEST_LOGS%\integration-test.log
if %errorlevel% neq 0 (
    echo ❌ Integration tests failed!
    echo Check %TEST_LOGS%\integration-test.log for details
) else (
    echo ✅ Integration tests passed!
)
echo.

:run_performance_tests
echo [PHASE 3] Running Performance Tests...
echo Testing performance under load...
node test-runner.js --type=performance --output=%TEST_LOGS%\performance-test.log
if %errorlevel% neq 0 (
    echo ❌ Performance tests failed!
    echo Check %TEST_LOGS%\performance-test.log for details
) else (
    echo ✅ Performance tests passed!
)
echo.

:run_security_tests
echo [PHASE 4] Running Security Tests...
echo Testing security features...
node test-runner.js --type=security --output=%TEST_LOGS%\security-test.log
if %errorlevel% neq 0 (
    echo ❌ Security tests failed!
    echo Check %TEST_LOGS%\security-test.log for details
) else (
    echo ✅ Security tests passed!
)
echo.

:run_stress_tests
echo [PHASE 5] Running Stress Tests...
echo Testing breaking points...
node test-runner.js --type=stress --output=%TEST_LOGS%\stress-test.log
if %errorlevel% neq 0 (
    echo ❌ Stress tests failed!
    echo Check %TEST_LOGS%\stress-test.log for details
) else (
    echo ✅ Stress tests passed!
)
echo.

:generate_report
echo [PHASE 6] Generating Test Report...
node report-generator.js --input=%TEST_LOGS% --output=%TEST_REPORTS%\test-report.html
echo 📊 Test report generated: %TEST_REPORTS%\test-report.html
echo.
