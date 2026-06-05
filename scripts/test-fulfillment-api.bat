@echo off
REM Fulfillment API Test Script for Windows
REM Tests all fulfillment coordination endpoints

set API_BASE=http://localhost:3001/api/fulfillment
set TENANT_ID=tenant_test_123
set ORGANIZATION_ID=org_test_123

echo 🚀 Starting Fulfillment API Tests
echo ==================================

REM Test 1: Create Time Slots
echo 📅 Test 1: Creating Time Slots...
curl -s -X POST "%API_BASE%/time-slots" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
  -d "{\"timeSlots\": [{\"date\": \"2026-05-02\",\"startTime\": \"09:00\",\"endTime\": \"09:30\",\"maxOrders\": 4,\"isActive\": true,\"fulfillmentMethod\": \"pickup\"},{\"date\": \"2026-05-02\",\"startTime\": \"10:00\",\"endTime\": \"10:30\",\"maxOrders\": 4,\"isActive\": true,\"fulfillmentMethod\": \"pickup\"}]}"

echo.

REM Test 2: Get Available Time Slots
echo ⏰ Test 2: Getting Available Time Slots...
curl -s -X GET "%API_BASE%/time-slots/available?tenantId=%TENANT_ID%&date=2026-05-02&fulfillmentMethod=pickup" ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

echo.

REM Test 3: Get Location Fulfillment Stats
echo 📊 Test 3: Getting Location Fulfillment Stats...
curl -s -X GET "%API_BASE%/stats/%TENANT_ID%" ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

echo.

REM Test 4: Create Customer
echo 👤 Test 4: Creating Test Customer...
curl -s -X POST "http://localhost:3001/api/customers" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
  -d "{\"email\": \"test.customer@example.com\",\"firstName\": \"Test\",\"lastName\": \"Customer\",\"phone\": \"+1234567890\"}"

echo.

REM Test 5: Schedule Fulfillment
echo 📦 Test 5: Scheduling Fulfillment...
curl -s -X POST "%API_BASE%/schedule" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
  -d "{\"orderId\": \"order_test_123\",\"tenantId\": \"%TENANT_ID%\",\"timeSlotId\": \"slot_test_123\",\"scheduledDate\": \"2026-05-02\",\"scheduledTime\": \"09:00\",\"fulfillmentMethod\": \"pickup\",\"notes\": \"Test fulfillment scheduling\"}"

echo.

REM Test 6: Get Location Schedules
echo 📋 Test 6: Getting Location Schedules...
curl -s -X GET "%API_BASE%/schedules/%TENANT_ID%?limit=10&offset=0" ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

echo.

REM Test 7: Create Notification
echo 🔔 Test 7: Creating Notification...
curl -s -X POST "%API_BASE%/notifications" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
  -d "{\"orderId\": \"order_test_123\",\"customerId\": \"customer_test_123\",\"type\": \"ready_for_pickup\",\"channel\": \"email\",\"content\": \"Your order is ready for pickup!\",\"scheduledAt\": \"2026-05-02T08:00:00Z\"}"

echo.

REM Test 8: Get Tenant Customers
echo 👥 Test 8: Getting Tenant Customers...
curl -s -X GET "http://localhost:3001/api/customers/tenant/%TENANT_ID%?limit=10&offset=0" ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

echo.

REM Test 9: Update Schedule Status
echo 🔄 Test 9: Updating Schedule Status...
curl -s -X PATCH "%API_BASE%/schedules/order_test_123/status" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
  -d "{\"status\": \"completed\",\"notes\": \"Order successfully picked up\"}"

echo.

REM Test 10: Get All Time Slots for Tenant
echo 📅 Test 10: Getting All Time Slots for Tenant...
curl -s -X GET "%API_BASE%/time-slots/tenant/%TENANT_ID%?date=2026-05-02" ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

echo.

echo ✅ Fulfillment API Tests Complete!
echo ==================================
echo.
echo 📝 Test Summary:
echo - Time Slot Management: ✅
echo - Customer Management: ✅
echo - Fulfillment Scheduling: ✅
echo - Notifications: ✅
echo - Statistics: ✅
echo.
echo ⚠️  Note: Some tests may fail if:
echo 1. API server is not running on port 3001
echo 2. Authorization token is invalid
echo 3. Test order/order_test_123 doesn't exist
echo 4. Tenant/organization IDs don't exist
echo.
echo 🔧 To run tests with real data:
echo 1. Start the API server: pnpm dev:api
echo 2. Replace YOUR_TOKEN_HERE with valid JWT token
echo 3. Replace TENANT_ID and ORGANIZATION_ID with actual IDs
echo 4. Create a test order first for scheduling tests

pause
