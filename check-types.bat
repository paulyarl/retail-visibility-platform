@echo off
REM Type checking script for API and Web apps
REM Usage: check-types.bat [api|web|all]

setlocal enabledelayedexpansion

if "%1"=="" goto all
if "%1"=="api" goto api
if "%1"=="web" goto web
if "%1"=="all" goto all
goto usage

:api
echo.
echo ========================================
echo Checking API TypeScript...
echo ========================================
call pnpm checkapi
goto end

:web
echo.
echo ========================================
echo Checking Web TypeScript...
echo ========================================
call pnpm checkweb
goto end

:all
echo.
echo ========================================
echo Checking API TypeScript...
echo ========================================
call pnpm checkapi
if errorlevel 1 (
    echo.
    echo [ERROR] API type check failed!
    set API_FAILED=1
)

echo.
echo ========================================
echo Checking Web TypeScript...
echo ========================================
call pnpm checkweb
if errorlevel 1 (
    echo.
    echo [ERROR] Web type check failed!
    set WEB_FAILED=1
)

echo.
echo ========================================
echo Summary
echo ========================================
if defined API_FAILED (
    echo [FAIL] API type check
) else (
    echo [PASS] API type check
)
if defined WEB_FAILED (
    echo [FAIL] Web type check
) else (
    echo [PASS] Web type check
)

if defined API_FAILED exit /b 1
if defined WEB_FAILED exit /b 1
goto end

:usage
echo.
echo Usage: check-types.bat [api^|web^|all]
echo   api  - Check API TypeScript only
echo   web  - Check Web TypeScript only
echo   all  - Check both API and Web (default)
echo.

:end
endlocal
