@echo off
echo ========================================
echo Digital Download Pages API Test Script
echo ========================================
echo.

SET API_BASE=http://localhost:3001/api
SET TENANT_ID=test-tenant-id
SET TEST_ITEM_ID=test-item-id

echo Testing Digital Download Pages API...
echo.

:: Test 1: Get all download pages (should be empty initially)
echo [TEST 1] Get all download pages
curl -X GET "%API_BASE%/tenants/%TENANT_ID%/digital-download-pages" -H "Content-Type: application/json" -w "\nHTTP Status: %%{http_code}\n\n"

:: Test 2: Try to create download page without valid item (should fail)
echo [TEST 2] Create download page - Invalid item (should fail)
curl -X POST "%API_BASE%/tenants/%TENANT_ID%/digital-download-pages" ^
  -H "Content-Type: application/json" ^
  -d "{\"itemId\":\"invalid-item-id\",\"title\":\"Test Page\"}" ^
  -w "\nHTTP Status: %%{http_code}\n\n"

:: Test 3: Create download page with valid data (mock item exists)
echo [TEST 3] Create download page - Valid data
curl -X POST "%API_BASE%/tenants/%TENANT_ID%/digital-download-pages" ^
  -H "Content-Type: application/json" ^
  -d "{\"itemId\":\"%TEST_ITEM_ID%\",\"title\":\"Test Digital Download Page\",\"description\":\"Test description\",\"instructions\":\"Test instructions\",\"thankYouMessage\":\"Thank you for your purchase!\",\"supportEmail\":\"test@example.com\",\"brandColor\":\"#3B82F6\",\"requireAuthentication\":true,\"allowMultipleDownloads\":true,\"status\":\"draft\"}" ^
  -w "\nHTTP Status: %%{http_code}\n\n"

:: Test 4: Get all download pages (should show 1 page)
echo [TEST 4] Get all download pages (should show 1 page)
curl -X GET "%API_BASE%/tenants/%TENANT_ID%/digital-download-pages" -H "Content-Type: application/json" -w "\nHTTP Status: %%{http_code}\n\n"

:: Test 5: Get specific download page (using ID from previous test)
echo [TEST 5] Get specific download page
curl -X GET "%API_BASE%/tenants/%TENANT_ID%/digital-download-pages/test-page-id" -H "Content-Type: application/json" -w "\nHTTP Status: %%{http_code}\n\n"

:: Test 6: Update download page
echo [TEST 6] Update download page
curl -X PUT "%API_BASE%/tenants/%TENANT_ID%/digital-download-pages/test-page-id" ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"Updated Test Page\",\"description\":\"Updated description\",\"status\":\"published\"}" ^
  -w "\nHTTP Status: %%{http_code}\n\n"

:: Test 7: Generate preview token
echo [TEST 7] Generate preview token
curl -X POST "%API_BASE%/tenants/%TENANT_ID%/digital-download-pages/test-page-id/preview-token" ^
  -H "Content-Type: application/json" ^
  -d "{\"expiresInHours\":2}" ^
  -w "\nHTTP Status: %%{http_code}\n\n"

:: Test 8: Get page assets (should be empty initially)
echo [TEST 8] Get page assets (should be empty initially)
curl -X GET "%API_BASE%/tenants/%TENANT_ID%/digital-download-pages/test-page-id/assets" -H "Content-Type: application/json" -w "\nHTTP Status: %%{http_code}\n\n"

:: Test 9: Try to reorder assets with invalid data (should fail)
echo [TEST 9] Reorder assets - Invalid data (should fail)
curl -X PUT "%API_BASE%/tenants/%TENANT_ID%/digital-download-pages/test-page-id/assets/reorder" ^
  -H "Content-Type: application/json" ^
  -d "{\"assetIds\":[]}" ^
  -w "\nHTTP Status: %%{http_code}\n\n"

:: Test 10: Delete download page
echo [TEST 10] Delete download page
curl -X DELETE "%API_BASE%/tenants/%TENANT_ID%/digital-download-pages/test-page-id" -H "Content-Type: application/json" -w "\nHTTP Status: %%{http_code}\n\n"

:: Test 11: Verify deletion (should be empty again)
echo [TEST 11] Verify deletion (should be empty again)
curl -X GET "%API_BASE%/tenants/%TENANT_ID%/digital-download-pages" -H "Content-Type: application/json" -w "\nHTTP Status: %%{http_code}\n\n"

:: Test 12: Test pagination and search
echo [TEST 12] Test pagination and search
curl -X GET "%API_BASE%/tenants/%TENANT_ID%/digital-download-pages?page=1&limit=5&status=all&search=test" -H "Content-Type: application/json" -w "\nHTTP Status: %%{http_code}\n\n"

:: Test 13: Test validation errors
echo [TEST 13] Test validation errors - Missing required fields
curl -X POST "%API_BASE%/tenants/%TENANT_ID%/digital-download-pages" ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"\"}" ^
  -w "\nHTTP Status: %%{http_code}\n\n"

:: Test 14: Test validation errors - Invalid email
echo [TEST 14] Test validation errors - Invalid email
curl -X POST "%API_BASE%/tenants/%TENANT_ID%/digital-download-pages" ^
  -H "Content-Type: application/json" ^
  -d "{\"itemId\":\"%TEST_ITEM_ID%\",\"title\":\"Test\",\"supportEmail\":\"invalid-email\"}" ^
  -w "\nHTTP Status: %%{http_code}\n\n"

:: Test 15: Test validation errors - Invalid color
echo [TEST 15] Test validation errors - Invalid color
curl -X POST "%API_BASE%/tenants/%TENANT_ID%/digital-download-pages" ^
  -H "Content-Type: application/json" ^
  -d "{\"itemId\":\"%TEST_ITEM_ID%\",\"title\":\"Test\",\"brandColor\":\"invalid-color\"}" ^
  -w "\nHTTP Status: %%{http_code}\n\n"

echo ========================================
echo API Test Script Complete!
echo ========================================
echo.
echo Expected Results:
echo - TEST 1: 200 OK (empty array)
echo - TEST 2: 404 or 400 (item not found)
echo - TEST 3: 201 Created (if item exists) or 404/400 (if not)
echo - TEST 4: 200 OK (showing pages)
echo - TEST 5: 200 OK or 404 (depending on if page exists)
echo - TEST 6: 200 OK or 404 (depending on if page exists)
echo - TEST 7: 200 OK or 404 (depending on if page exists)
echo - TEST 8: 200 OK or 404 (depending on if page exists)
echo - TEST 9: 400 Bad Request (empty array)
echo - TEST 10: 200 OK or 404 (depending on if page exists)
echo - TEST 11: 200 OK (empty array)
echo - TEST 12: 200 OK (paginated results)
echo - TEST 13: 400 Bad Request (validation failed)
echo - TEST 14: 400 Bad Request (validation failed)
echo - TEST 15: 400 Bad Request (validation failed)
echo.
echo Check HTTP status codes above to verify API behavior.
echo.
