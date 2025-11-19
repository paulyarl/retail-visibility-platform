@echo off
REM Comprehensive Role Testing Script
REM Tests all user roles against tenant access control system
REM Usage: test-all-roles.bat [tenant-id] [mode]
REM Modes: critical, full, platform, tenant

setlocal

REM Set default values
set "BASE_URL=http://localhost:3000"
set "API_URL=http://localhost:4000"
set "DEFAULT_PASSWORD=Admin123!"
set "DEFAULT_TENANT=cmi525r4y0004g8bsbzcpuipz"

REM Parse command line arguments
set "TENANT_ID=%~1"
set "TEST_MODE=%~2"

REM Set default tenant if not provided
if "%TENANT_ID%"=="" set "TENANT_ID=%DEFAULT_TENANT%"

REM Set default mode if not provided
if "%TEST_MODE%"=="" set "TEST_MODE=critical"

REM Display banner
echo.
echo ================================================================
echo              COMPREHENSIVE ROLE ACCESS TESTING
echo ================================================================
echo.
echo 🎯 TEST CONFIGURATION:
echo    Tenant ID: %TENANT_ID%
echo    Test Mode: %TEST_MODE%
echo    Base URL: %BASE_URL%
echo    API URL: %API_URL%
echo    Password: %DEFAULT_PASSWORD%
echo.

REM Check if test script exists
if not exist "scripts\test-tenant-access.js" (
    echo ❌ ERROR: Test script not found at scripts\test-tenant-access.js
    echo Please ensure you're running this from the project root directory
    pause
    exit /b 1
)

REM Initialize counters
set /a TOTAL_TESTS=0
set /a PASSED_TESTS=0
set /a FAILED_TESTS=0

echo 🚀 Starting comprehensive role testing...
echo.

REM Define test users
if "%TEST_MODE%"=="critical" goto :critical_tests
if "%TEST_MODE%"=="platform" goto :platform_tests
if "%TEST_MODE%"=="tenant" goto :tenant_tests
if "%TEST_MODE%"=="full" goto :full_tests

:critical_tests
echo 🔥 RUNNING CRITICAL ACCESS TESTS (5 most important roles)
echo.
call :run_test "admin@rvp.com" "platform-admin" "Platform Admin" "Highest privilege - full system access"
call :run_test "owner@rvp.com" "tenant-owner" "Tenant Owner" "Highest tenant privilege - full tenant control"
call :run_test "tenantadmin@rvp.com" "tenant-admin" "Tenant Admin" "NEW ROLE - Support access below Tenant Owner"
call :run_test "member@rvp.com" "tenant-member" "Tenant Member" "Restricted access - edit only"
call :run_test "viewer@rvp.com" "platform-viewer" "Platform Viewer" "Read-only across platform"
goto :summary

:platform_tests
echo 🌐 RUNNING PLATFORM ROLE TESTS (Cross-tenant access)
echo.
call :run_test "admin@rvp.com" "platform-admin" "Platform Admin" "Full system access, unlimited tenants"
call :run_test "support@rvp.com" "platform-support" "Platform Support" "All tenants + support actions (3 limit)"
call :run_test "viewer@rvp.com" "platform-viewer" "Platform Viewer" "Read-only access to all tenants"
call :run_test "legacy@rvp.com" "platform-admin" "Legacy Admin" "Deprecated admin role"
goto :summary

:tenant_tests
echo 🏢 RUNNING TENANT ROLE TESTS (Single-tenant access)
echo.
call :run_test "owner@rvp.com" "tenant-owner" "Tenant Owner" "Full control of owned tenants"
call :run_test "tenantadmin@rvp.com" "tenant-admin" "Tenant Admin" "Support role for assigned tenants"
call :run_test "manager@rvp.com" "tenant-manager" "Tenant Manager" "Management operations"
call :run_test "member@rvp.com" "tenant-member" "Tenant Member" "Edit only, no manage"
call :run_test "tenantviewer@rvp.com" "tenant-viewer" "Tenant Viewer" "View only"
call :run_test "user@rvp.com" "tenant-member" "Basic User" "Basic access with tier limits"
goto :summary

:full_tests
echo 🎯 RUNNING FULL ROLE MATRIX TESTS (All roles)
echo.
echo 📊 Platform Roles:
call :run_test "admin@rvp.com" "platform-admin" "Platform Admin" "Full system access"
call :run_test "support@rvp.com" "platform-support" "Platform Support" "Support access with bypasses"
call :run_test "viewer@rvp.com" "platform-viewer" "Platform Viewer" "Read-only across platform"
echo.
echo 📊 Tenant Roles:
call :run_test "owner@rvp.com" "tenant-owner" "Tenant Owner" "Full tenant control"
call :run_test "tenantadmin@rvp.com" "tenant-admin" "Tenant Admin" "Support access (below owner)"
call :run_test "manager@rvp.com" "tenant-manager" "Tenant Manager" "Management operations"
call :run_test "member@rvp.com" "tenant-member" "Tenant Member" "Edit only"
call :run_test "tenantviewer@rvp.com" "tenant-viewer" "Tenant Viewer" "View only"
echo.
echo 📊 Legacy/Special Roles:
call :run_test "legacy@rvp.com" "platform-admin" "Legacy Admin" "Deprecated admin"
call :run_test "user@rvp.com" "tenant-member" "Basic User" "Basic access"
goto :summary

:run_test
set "TEST_EMAIL=%~1"
set "TEST_SCENARIO=%~2"
set "TEST_NAME=%~3"
set "TEST_DESC=%~4"

set /a TOTAL_TESTS+=1

echo 🧪 Testing: %TEST_NAME%
echo    Email: %TEST_EMAIL%
echo    Scenario: %TEST_SCENARIO%
echo    Description: %TEST_DESC%
echo.

REM Set environment variables for Node.js script
set "TEST_BASE_URL=%BASE_URL%"
set "API_BASE_URL=%API_URL%"

REM Run the test
node scripts\test-tenant-access.js --user=%TEST_EMAIL% --tenant=%TENANT_ID% --scenario=%TEST_SCENARIO% --password=%DEFAULT_PASSWORD%

REM Check result
if %ERRORLEVEL%==0 (
    echo ✅ %TEST_NAME%: PASSED
    set /a PASSED_TESTS+=1
) else (
    echo ❌ %TEST_NAME%: FAILED
    set /a FAILED_TESTS+=1
)

echo.
echo ----------------------------------------------------------------
echo.
goto :eof

:summary
echo.
echo ================================================================
echo                        TEST SUMMARY
echo ================================================================
echo.
echo 📊 RESULTS:
echo    Total Tests: %TOTAL_TESTS%
echo    Passed: %PASSED_TESTS%
echo    Failed: %FAILED_TESTS%

if %FAILED_TESTS%==0 (
    echo.
    echo ✅ ALL TESTS PASSED - System is ready for deployment!
    echo.
    echo 🎉 Role-based access control is working correctly across all user types.
    echo    • Platform roles have appropriate cross-tenant access
    echo    • Tenant roles respect hierarchy (Owner > Admin > Manager > Member > Viewer)
    echo    • TENANT_ADMIN role properly positioned below Tenant Owner
    echo    • Access controls and bypasses function as expected
) else (
    echo.
    echo ❌ %FAILED_TESTS% TEST(S) FAILED - Do not deploy!
    echo.
    echo 🚨 Critical access issues detected:
    echo    • Review failed tests above
    echo    • Check user creation and role assignments
    echo    • Verify tenant assignments for tenant-scoped users
    echo    • Ensure TENANT_ADMIN role is properly configured
    echo    • Fix all issues before proceeding with deployment
)

echo.
echo ================================================================
echo.

REM Calculate success rate
set /a SUCCESS_RATE=(%PASSED_TESTS% * 100) / %TOTAL_TESTS%
echo 📈 Success Rate: %SUCCESS_RATE%%%

if %FAILED_TESTS%==0 (
    echo.
    echo 🚀 DEPLOYMENT APPROVED - All access controls validated
    exit /b 0
) else (
    echo.
    echo 🛑 DEPLOYMENT BLOCKED - Fix access control issues
    exit /b 1
)

:usage
echo.
echo USAGE:
echo    test-all-roles.bat [tenant-id] [mode]
echo.
echo PARAMETERS:
echo    tenant-id  - Tenant ID to test against (optional)
echo                 Default: %DEFAULT_TENANT%
echo    mode       - Test mode (optional, default: critical)
echo.
echo TEST MODES:
echo    critical   - Test 5 most important roles (5 minutes)
echo    platform   - Test platform roles only (3 minutes)
echo    tenant     - Test tenant roles only (5 minutes)
echo    full       - Test all roles (10 minutes)
echo.
echo EXAMPLES:
echo    test-all-roles.bat
echo    test-all-roles.bat cmi525r4y0004g8bsbzcpuipz critical
echo    test-all-roles.bat tenant-123 full
echo    test-all-roles.bat tenant-456 platform
echo.
echo CRITICAL TESTS (Recommended for pre-deployment):
echo    test-all-roles.bat [tenant-id] critical
echo.
echo FULL VALIDATION (Recommended for major releases):
echo    test-all-roles.bat [tenant-id] full
echo.
echo Press any key to continue . . .
pause >nul
goto :eof
