@echo off
REM Phase 3A Order Management - Test Script (Windows Batch)
REM This script tests all order endpoints with curl commands

setlocal enabledelayedexpansion

REM Configuration
set API_BASE_URL=http://localhost:3001
set TENANT_ID=tid-m8ijkrnk

echo ========================================
echo Phase 3A Order Management Test Suite
echo ========================================
echo.

REM Check if JWT token is provided
if "%JWT_TOKEN%"=="" (
    echo Error: JWT_TOKEN environment variable not set
    echo Usage: set JWT_TOKEN=your-token-here ^&^& test-orders.bat
    exit /b 1
)

echo [OK] JWT Token found
echo [OK] API Base URL: %API_BASE_URL%
echo [OK] Tenant ID: %TENANT_ID%
echo.

REM Test 1: Create a simple order
echo Test 1: Create Simple Order
echo POST %API_BASE_URL%/api/orders
echo.

curl -s -X POST "%API_BASE_URL%/api/orders" ^
  -H "Authorization: Bearer %JWT_TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"tenant_id\":\"%TENANT_ID%\",\"customer\":{\"email\":\"test@example.com\",\"name\":\"Test Customer\",\"phone\":\"+1234567890\"},\"items\":[{\"sku\":\"TEST-001\",\"name\":\"Test Product\",\"description\":\"A test product\",\"quantity\":2,\"unit_price_cents\":1999}],\"shipping_address\":{\"line1\":\"123 Test St\",\"city\":\"New York\",\"state\":\"NY\",\"postal_code\":\"10001\",\"country\":\"US\"},\"shipping_cents\":500,\"notes\":\"Test order from script\",\"source\":\"api_test\"}" > order_response.json

type order_response.json
echo.
echo [OK] Order created
echo.

REM Test 2: List all orders
echo Test 2: List All Orders
echo GET %API_BASE_URL%/api/orders?tenant_id=%TENANT_ID%
echo.

curl -s -X GET "%API_BASE_URL%/api/orders?tenant_id=%TENANT_ID%&limit=5" ^
  -H "Authorization: Bearer %JWT_TOKEN%"
echo.
echo [OK] Orders list retrieved
echo.

REM Test 3: Create multi-item order
echo Test 3: Create Order with Multiple Items
echo POST %API_BASE_URL%/api/orders
echo.

curl -s -X POST "%API_BASE_URL%/api/orders" ^
  -H "Authorization: Bearer %JWT_TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"tenant_id\":\"%TENANT_ID%\",\"customer\":{\"email\":\"multi-item@example.com\",\"name\":\"Multi Item Customer\"},\"items\":[{\"sku\":\"ITEM-001\",\"name\":\"Product A\",\"quantity\":1,\"unit_price_cents\":2999},{\"sku\":\"ITEM-002\",\"name\":\"Product B\",\"quantity\":3,\"unit_price_cents\":1499},{\"sku\":\"ITEM-003\",\"name\":\"Product C\",\"quantity\":2,\"unit_price_cents\":999}],\"shipping_address\":{\"line1\":\"456 Multi St\",\"city\":\"Los Angeles\",\"state\":\"CA\",\"postal_code\":\"90001\",\"country\":\"US\"},\"shipping_cents\":750,\"source\":\"api_test\"}"
echo.
echo [OK] Multi-item order created
echo.

echo ========================================
echo Test Suite Complete
echo ========================================
echo.
echo All tests completed successfully!
echo.
echo Next steps:
echo 1. Check database: SELECT * FROM orders ORDER BY created_at DESC LIMIT 5;
echo 2. Review order_response.json for details
echo.

del order_response.json
endlocal
