@echo off
REM Tenant Access Test Runner - Windows Batch Script
REM Usage: test-access.bat [user] [tenant] [scenario] [password]
REM Example: test-access.bat admin@example.com tenant-123 platform-admin mypassword

setlocal

REM Set default values
set "BASE_URL=http://localhost:3000"
set "API_URL=http://localhost:4000"
set "DEFAULT_PASSWORD=Admin123!"

REM Parse command line arguments
set "USER_EMAIL=%~1"
set "TENANT_ID=%~2"
set "SCENARIO=%~3"
set "PASSWORD=%~4"

REM Set default password if not provided
if "%PASSWORD%"=="" set "PASSWORD=%DEFAULT_PASSWORD%"

REM Display banner
echo.
echo ================================================================
echo                 TENANT ACCESS TEST RUNNER
echo ================================================================
echo.

REM Validate required parameters
if "%USER_EMAIL%"=="" (
    echo ❌ ERROR: User email is required
    goto :usage
)

if "%TENANT_ID%"=="" (
    echo ❌ ERROR: Tenant ID is required
    goto :usage
)

REM Display test configuration
echo 🔧 TEST CONFIGURATION:
echo    User: %USER_EMAIL%
echo    Tenant: %TENANT_ID%
echo    Scenario: %SCENARIO%
echo    Base URL: %BASE_URL%
echo    API URL: %API_URL%
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if test script exists
if not exist "scripts\test-tenant-access.js" (
    echo ❌ ERROR: Test script not found at scripts\test-tenant-access.js
    echo Please ensure you're running this from the project root directory
    pause
    exit /b 1
)

REM Build command line arguments
set "CMD_ARGS=--user=%USER_EMAIL% --tenant=%TENANT_ID% --password=%PASSWORD%"
if not "%SCENARIO%"=="" set "CMD_ARGS=%CMD_ARGS% --scenario=%SCENARIO%"

REM Set environment variables for Node.js script
set "TEST_BASE_URL=%BASE_URL%"
set "API_BASE_URL=%API_URL%"

REM Run the test
echo 🚀 Starting test execution...
echo.
node scripts\test-tenant-access.js %CMD_ARGS%

REM Capture exit code
set "TEST_RESULT=%ERRORLEVEL%"

echo.
echo ================================================================

REM Display result
if %TEST_RESULT%==0 (
    echo ✅ TESTS PASSED - System is ready for deployment
    echo.
    echo 🎉 All access controls are working correctly!
) else (
    echo ❌ TESTS FAILED - Do not deploy
    echo.
    echo 🚨 Critical access issues detected. Please review the output above.
    echo    Fix all issues before proceeding with deployment.
)

echo ================================================================
echo.

REM Pause if running interactively
echo Press any key to exit...
pause >nul

exit /b %TEST_RESULT%

:usage
echo.
echo USAGE:
echo    test-access.bat [user] [tenant] [scenario] [password]
echo.
echo PARAMETERS:
echo    user      - User email or username (required)
echo    tenant    - Tenant ID to test (required)
echo    scenario  - Test scenario (optional, runs all if not specified)
echo    password  - User password (optional, defaults to 'password')
echo.
echo AVAILABLE SCENARIOS:
echo    platform-admin    - Test platform administrator access
echo    platform-support  - Test platform support access
echo    platform-viewer   - Test platform viewer access
echo    tenant-owner      - Test tenant owner access
echo    tenant-admin      - Test tenant admin access
echo    tenant-manager    - Test tenant manager access
echo    tenant-member     - Test tenant member access
echo    tenant-viewer     - Test tenant viewer access
echo.
echo EXAMPLES:
echo    test-access.bat admin@example.com tenant-123
echo    test-access.bat admin@example.com tenant-123 platform-admin
echo    test-access.bat user@example.com tenant-456 tenant-member mypassword
echo    test-access.bat support@example.com tenant-789 platform-support
echo.
echo QUICK TESTS:
echo    test-access.bat admin@example.com tenant-123 platform-admin
echo    test-access.bat owner@example.com tenant-123 tenant-owner
echo    test-access.bat member@example.com tenant-123 tenant-member
echo.
pause
exit /b 1
