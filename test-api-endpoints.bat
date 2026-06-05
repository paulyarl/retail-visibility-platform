@echo off
REM API Endpoint Testing Script for Digital Products
REM Tests all download and digital asset endpoints
REM Requires: curl (comes with Windows 10+)

setlocal enabledelayedexpansion

REM Configuration - Update these values for your environment
set BASE_URL=http://localhost:4000
set TENANT_ID=tid-fjwr30ib
set AUTH0_EMAIL=yarlmoment@gmail.com
set AUTH0_ID=google-oauth2^|101197082777619041667
set PAGE_ID=
set ASSET_ID=
set ITEM_ID=item_123

REM Auth headers for Auth0 (use ^| to escape pipe character)
set AUTH_HEADERS=-H "Content-Type: application/json" -H "x-auth0-email: %AUTH0_EMAIL%" -H "x-auth0-id: %AUTH0_ID%"

echo.
echo ========================================
echo Digital Products API Endpoint Tests
echo ========================================
echo Base URL: %BASE_URL%
echo Tenant ID: %TENANT_ID%
echo.

REM Check if server is running
echo [CHECK] Testing server availability...
curl -s -o nul -w "%%{http_code}" %BASE_URL%/api/health %AUTH_HEADERS% 2>nul > temp_status.txt
set /p STATUS=<temp_status.txt
del temp_status.txt 2>nul

if not "%STATUS%"=="200" (
    echo [WARN] Server may not be running. Start with: pnpm dev
    echo.
)

REM ============================================
REM Public Download Endpoints
REM ============================================
echo.
echo ========================================
echo PUBLIC DOWNLOAD ENDPOINTS
echo ========================================

echo.
echo [TEST 1] GET /api/downloads/{tenantId}/{slug}
echo Testing: Fetch public download page (public - no auth required)
curl -s -X GET "%BASE_URL%/api/downloads/%TENANT_ID%/test-download-slug" -H "Content-Type: application/json" | jq . 2>nul || curl -s -X GET "%BASE_URL%/api/downloads/%TENANT_ID%/test-download-slug"
echo.

echo.
echo [TEST 2] GET /api/downloads/{tenantId}/{slug}/validate
echo Testing: Validate access token (public - uses query param token)
curl -s -X GET "%BASE_URL%/api/downloads/%TENANT_ID%/test-slug/validate?token=test_access_token" -H "Content-Type: application/json" | jq . 2>nul || curl -s -X GET "%BASE_URL%/api/downloads/%TENANT_ID%/test-slug/validate?token=test_access_token"
echo.

echo.
echo [TEST 3] POST /api/downloads/{tenantId}/{slug}/download
echo Testing: Process download request (public - uses body token)
curl -s -X POST "%BASE_URL%/api/downloads/%TENANT_ID%/test-slug/download" -H "Content-Type: application/json" -d "{\"token\":\"test_access_token\",\"assetId\":\"asset_123\"}" | jq . 2>nul || curl -s -X POST "%BASE_URL%/api/downloads/%TENANT_ID%/test-slug/download" -H "Content-Type: application/json" -d "{\"token\":\"test_access_token\",\"assetId\":\"asset_123\"}"
echo.

REM ============================================
REM Tenant Download Pages Endpoints
REM ============================================
echo.
echo ========================================
echo TENANT DOWNLOAD PAGES ENDPOINTS
echo ========================================

echo.
echo [TEST 4] GET /api/tenants/{tenantId}/download-pages
echo Testing: List download pages (requires Auth0)
curl -s -X GET "%BASE_URL%/api/tenants/%TENANT_ID%/download-pages?page=1&pageSize=10" %AUTH_HEADERS% | jq . 2>nul || curl -s -X GET "%BASE_URL%/api/tenants/%TENANT_ID%/download-pages?page=1&pageSize=10" %AUTH_HEADERS%
echo.

echo.
echo [TEST 5] POST /api/tenants/{tenantId}/download-pages
echo Testing: Create download page (requires Auth0)
curl -s -X POST "%BASE_URL%/api/tenants/%TENANT_ID%/download-pages" %AUTH_HEADERS% -d "{\"itemId\":\"%ITEM_ID%\",\"title\":\"Test Download Page\",\"description\":\"Test description\"}" | jq . 2>nul || curl -s -X POST "%BASE_URL%/api/tenants/%TENANT_ID%/download-pages" %AUTH_HEADERS% -d "{\"itemId\":\"%ITEM_ID%\",\"title\":\"Test Download Page\",\"description\":\"Test description\"}"
echo.

echo.
echo [TEST 6] GET /api/tenants/{tenantId}/download-pages/{pageId}
echo Testing: Get download page by ID
if "%PAGE_ID%"=="" (
    echo [SKIP] Set PAGE_ID variable to test this endpoint
) else (
    curl -s -X GET "%BASE_URL%/api/tenants/%TENANT_ID%/download-pages/%PAGE_ID%" %AUTH_HEADERS% | jq . 2>nul || curl -s -X GET "%BASE_URL%/api/tenants/%TENANT_ID%/download-pages/%PAGE_ID%" %AUTH_HEADERS%
)
echo.

echo.
echo [TEST 7] GET /api/tenants/{tenantId}/download-pages/item/{itemId}
echo Testing: Get download page by item ID (requires Auth0)
curl -s -X GET "%BASE_URL%/api/tenants/%TENANT_ID%/download-pages/item/%ITEM_ID%" %AUTH_HEADERS% | jq . 2>nul || curl -s -X GET "%BASE_URL%/api/tenants/%TENANT_ID%/download-pages/item/%ITEM_ID%" %AUTH_HEADERS%
echo.

echo.
echo [TEST 8] PATCH /api/tenants/{tenantId}/download-pages/{pageId}
echo Testing: Update download page
if "%PAGE_ID%"=="" (
    echo [SKIP] Set PAGE_ID variable to test this endpoint
) else (
    curl -s -X PATCH "%BASE_URL%/api/tenants/%TENANT_ID%/download-pages/%PAGE_ID%" %AUTH_HEADERS% -d "{\"title\":\"Updated Title\",\"status\":\"published\"}" | jq . 2>nul || curl -s -X PATCH "%BASE_URL%/api/tenants/%TENANT_ID%/download-pages/%PAGE_ID%" %AUTH_HEADERS% -d "{\"title\":\"Updated Title\",\"status\":\"published\"}"
)
echo.

REM ============================================
REM Digital Assets Endpoints
REM ============================================
echo.
echo ========================================
echo DIGITAL ASSETS ENDPOINTS
echo ========================================

echo.
echo [TEST 9] POST /api/tenants/{tenantId}/digital-assets
echo Testing: Create digital asset (requires Auth0)
curl -s -X POST "%BASE_URL%/api/tenants/%TENANT_ID%/digital-assets" %AUTH_HEADERS% -d "{\"downloadPageId\":\"%PAGE_ID%\",\"assetName\":\"Test Asset\",\"assetType\":\"file\",\"filePath\":\"/downloads/test.zip\"}" | jq . 2>nul || curl -s -X POST "%BASE_URL%/api/tenants/%TENANT_ID%/digital-assets" %AUTH_HEADERS% -d "{\"downloadPageId\":\"%PAGE_ID%\",\"assetName\":\"Test Asset\",\"assetType\":\"file\",\"filePath\":\"/downloads/test.zip\"}"
echo.

echo.
echo [TEST 10] GET /api/tenants/{tenantId}/digital-assets/{assetId}
echo Testing: Get digital asset by ID (requires Auth0)
if "%ASSET_ID%"=="" (
    echo [SKIP] Set ASSET_ID variable to test this endpoint
) else (
    curl -s -X GET "%BASE_URL%/api/tenants/%TENANT_ID%/digital-assets/%ASSET_ID%" %AUTH_HEADERS% | jq . 2>nul || curl -s -X GET "%BASE_URL%/api/tenants/%TENANT_ID%/digital-assets/%ASSET_ID%" %AUTH_HEADERS%
)
echo.

echo.
echo [TEST 11] PATCH /api/tenants/{tenantId}/digital-assets/{assetId}
echo Testing: Update digital asset (requires Auth0)
if "%ASSET_ID%"=="" (
    echo [SKIP] Set ASSET_ID variable to test this endpoint
) else (
    curl -s -X PATCH "%BASE_URL%/api/tenants/%TENANT_ID%/digital-assets/%ASSET_ID%" %AUTH_HEADERS% -d "{\"assetName\":\"Updated Asset Name\"}" | jq . 2>nul || curl -s -X PATCH "%BASE_URL%/api/tenants/%TENANT_ID%/digital-assets/%ASSET_ID%" %AUTH_HEADERS% -d "{\"assetName\":\"Updated Asset Name\"}"
)
echo.

echo.
echo ========================================
echo Test Complete
echo ========================================
echo.
echo NOTE: Public endpoints (1-3) use access tokens in query/body.
echo       Tenant endpoints (4-11) require Auth0 headers.
echo       Tests that return 404 may need valid IDs.
echo       Set PAGE_ID and ASSET_ID variables above for full testing.
echo.

endlocal
