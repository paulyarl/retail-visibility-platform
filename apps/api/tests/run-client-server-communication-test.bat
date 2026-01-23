@echo off
echo ========================================
echo Client-Server Singleton Communication Test
echo ========================================
echo.

set TEST_LOGS=logs
if not exist %TEST_LOGS% mkdir %TEST_LOGS%

echo Running Client-Server Singleton Communication Test...
echo Testing client singleton communication with server singletons!
echo Testing Security, Rate Limiting, Behavior Tracking, and Tenant Profile communication
echo User: platform@rvp.com
echo Tenant: tid-m8ijkrnk
echo Role: PLATFORMFORM_ADMIN
echo.

node client-server-communication-test.js

if %errorlevel% equ 0 (
    echo ✅ Communication test completed!
    echo.
    echo Test Summary:
    type %TEST_LOGS%\client-server-communication-summary.txt
) else (
    echo ❌ Communication test failed!
    echo.
    echo Error Details:
    type %TEST_LOGS%\client-server-communication-summary.txt
)

echo.
echo.
echo 🔗 This test verifies client-server singleton communication!
echo 📊 Results show if your singletons are properly communicating!
echo.
pause
