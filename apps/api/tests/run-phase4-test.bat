@echo off
echo ========================================
echo Phase 4 UniversalSingleton Communication Test
echo ========================================
echo.
echo Running Phase 4 API communication test...
echo Testing Inventory and Categories services with UniversalSingleton!
echo.
echo Testing:
echo - Inventory Service (product management, stock tracking, analytics)
echo - Categories Service (hierarchical categories, tree structure)
echo.
echo User: platform@rvp.com
echo Role: PLATFORM_ADMIN
echo.

cd /d "%~dp0"

node phase4-communication-test.js

echo.
echo ========================================
echo ✅ Phase 4 communication test completed!
echo 📊 Results show Inventory and Categories service functionality!
echo ========================================
echo.
pause
