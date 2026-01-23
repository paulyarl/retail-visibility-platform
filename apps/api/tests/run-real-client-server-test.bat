@echo off
echo ========================================
echo Real Client-Server Singleton Communication Test
echo ========================================
echo.
echo Running REAL API communication test...
echo Testing actual HTTP requests to UniversalSingleton endpoints!
echo.
echo Testing Security, Rate Limiting, Behavior Tracking, and Tenant Profile
echo User: platform@rvp.com
echo Tenant: tid-m8ijkrnk
echo Role: PLATFORMFORM_ADMIN
echo.

cd /d "%~dp0"

node real-client-server-test.js

echo.
echo ========================================
echo ✅ Real communication test completed!
echo 📊 Results show actual API endpoint functionality!
echo ========================================
echo.
pause
