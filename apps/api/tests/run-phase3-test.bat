@echo off
echo ========================================
echo Phase 3 UniversalSingleton Communication Test
echo ========================================
echo.
echo Running Phase 3 API communication test...
echo Testing Users and Tiers services with UniversalSingleton!
echo.
echo Testing:
echo - Users Service (user management, roles, activity)
echo - Tiers Service (subscription tiers, limits, features)
echo.
echo User: platform@rvp.com
echo Role: PLATFORMFORM_ADMIN
echo.

cd /d "%~dp0"

node phase3-communication-test.js

echo.
echo ========================================
echo ✅ Phase 3 communication test completed!
echo 📊 Results show Users and Tiers service functionality!
echo ========================================
echo.
pause
