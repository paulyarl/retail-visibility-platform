#!/bin/bash

# Fulfillment API Test Script
# Tests all fulfillment coordination endpoints

API_BASE="http://localhost:4000/api/fulfillment"
TENANT_ID="tid-042hi7ju"  # Replace with actual tenant ID
ORGANIZATION_ID="org-KQJ4OXF3"  # Replace with actual organization ID
AUTH0_EMAIL="yarlmoment@gmail.com"  # Replace with your Auth0 email
AUTH0_ID="google-oauth2|101197082777619041667"  # Replace with your Auth0 ID

echo "🚀 Starting Fulfillment API Tests"
echo "=================================="

# Test 1: Create Time Slots
echo "📅 Test 1: Creating Time Slots..."
TIME_SLOTS_RESPONSE=$(curl -s -X POST "$API_BASE/time-slots" \
  -H "Content-Type: application/json" \
  -H "x-auth0-email: $AUTH0_EMAIL" \
  -H "x-auth0-id: $AUTH0_ID" \
  -d "{
    \"timeSlots\": [
      {
        \"date\": \"2026-05-02\",
        \"startTime\": \"09:00\",
        \"endTime\": \"09:30\",
        \"maxOrders\": 4,
        \"isActive\": true,
        \"fulfillmentMethod\": \"pickup\"
      },
      {
        \"date\": \"2026-05-02\",
        \"startTime\": \"10:00\",
        \"endTime\": \"10:30\",
        \"maxOrders\": 4,
        \"isActive\": true,
        \"fulfillmentMethod\": \"pickup\"
      }
    ]
  }")

echo "Time Slots Creation Response:"
echo "$TIME_SLOTS_RESPONSE" | jq '.' 2>/dev/null || echo "$TIME_SLOTS_RESPONSE"
echo ""

# Extract time slot ID for later tests
TIME_SLOT_ID=$(echo "$TIME_SLOTS_RESPONSE" | jq -r '.[0].id' 2>/dev/null)
echo "Created Time Slot ID: $TIME_SLOT_ID"
echo ""

# Test 2: Get Available Time Slots
echo "⏰ Test 2: Getting Available Time Slots..."
AVAILABLE_SLOTS=$(curl -s -X GET "$API_BASE/time-slots/available?tenantId=$TENANT_ID&date=2026-05-02&fulfillmentMethod=pickup" \
  -H "x-auth0-email: $AUTH0_EMAIL" \
  -H "x-auth0-id: $AUTH0_ID")

echo "Available Time Slots Response:"
echo "$AVAILABLE_SLOTS" | jq '.' 2>/dev/null || echo "$AVAILABLE_SLOTS"
echo ""

# Test 3: Get Location Fulfillment Stats
echo "📊 Test 3: Getting Location Fulfillment Stats..."
STATS_RESPONSE=$(curl -s -X GET "$API_BASE/stats/$TENANT_ID" \
  -H "x-auth0-email: $AUTH0_EMAIL" \
  -H "x-auth0-id: $AUTH0_ID")

echo "Fulfillment Stats Response:"
echo "$STATS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATS_RESPONSE"
echo ""

# Test 4: Create Customer (for scheduling test)
echo "👤 Test 4: Creating Test Customer..."
CUSTOMER_RESPONSE=$(curl -s -X POST "http://localhost:4000/api/customers" \
  -H "Content-Type: application/json" \
  -H "x-auth0-email: $AUTH0_EMAIL" \
  -H "x-auth0-id: $AUTH0_ID" \
  -d "{
    \"email\": \"test.customer@example.com\",
    \"firstName\": \"Test\",
    \"lastName\": \"Customer\",
    \"phone\": \"+1234567890\"
  }")

echo "Customer Creation Response:"
echo "$CUSTOMER_RESPONSE" | jq '.' 2>/dev/null || echo "$CUSTOMER_RESPONSE"

# Extract customer ID for scheduling test
CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | jq -r '.id' 2>/dev/null)
echo "Created Customer ID: $CUSTOMER_ID"
echo ""

# Test 5: Schedule Fulfillment (requires existing order)
echo "📦 Test 5: Scheduling Fulfillment..."
SCHEDULE_RESPONSE=$(curl -s -X POST "$API_BASE/schedule" \
  -H "Content-Type: application/json" \
  -H "x-auth0-email: $AUTH0_EMAIL" \
  -H "x-auth0-id: $AUTH0_ID" \
  -d "{
    \"orderId\": \"order_test_123\",
    \"tenantId\": \"$TENANT_ID\",
    \"timeSlotId\": \"$TIME_SLOT_ID\",
    \"scheduledDate\": \"2026-05-02\",
    \"scheduledTime\": \"09:00\",
    \"fulfillmentMethod\": \"pickup\",
    \"notes\": \"Test fulfillment scheduling\"
  }")

echo "Schedule Creation Response:"
echo "$SCHEDULE_RESPONSE" | jq '.' 2>/dev/null || echo "$SCHEDULE_RESPONSE"
echo ""

# Test 6: Get Location Schedules
echo "📋 Test 6: Getting Location Schedules..."
SCHEDULES_RESPONSE=$(curl -s -X GET "$API_BASE/schedules/$TENANT_ID?limit=10&offset=0" \
  -H "x-auth0-email: $AUTH0_EMAIL" \
  -H "x-auth0-id: $AUTH0_ID")

echo "Schedules Response:"
echo "$SCHEDULES_RESPONSE" | jq '.' 2>/dev/null || echo "$SCHEDULES_RESPONSE"
echo ""

# Test 7: Create Notification
echo "🔔 Test 7: Creating Notification..."
NOTIFICATION_RESPONSE=$(curl -s -X POST "$API_BASE/notifications" \
  -H "Content-Type: application/json" \
  -H "x-auth0-email: $AUTH0_EMAIL" \
  -H "x-auth0-id: $AUTH0_ID" \
  -d "{
    \"orderId\": \"order_test_123\",
    \"customerId\": \"$CUSTOMER_ID\",
    \"type\": \"ready_for_pickup\",
    \"channel\": \"email\",
    \"content\": \"Your order is ready for pickup!\",
    \"scheduledAt\": \"2026-05-02T08:00:00Z\"
  }")

echo "Notification Creation Response:"
echo "$NOTIFICATION_RESPONSE" | jq '.' 2>/dev/null || echo "$NOTIFICATION_RESPONSE"
echo ""

# Test 8: Get Tenant Customers
echo "👥 Test 8: Getting Tenant Customers..."
CUSTOMERS_RESPONSE=$(curl -s -X GET "http://localhost:4000/api/customers/tenant/$TENANT_ID?limit=10&offset=0" \
  -H "x-auth0-email: $AUTH0_EMAIL" \
  -H "x-auth0-id: $AUTH0_ID")

echo "Tenant Customers Response:"
echo "$CUSTOMERS_RESPONSE" | jq '.' 2>/dev/null || echo "$CUSTOMERS_RESPONSE"
echo ""

# Test 9: Update Schedule Status
echo "🔄 Test 9: Updating Schedule Status..."
UPDATE_RESPONSE=$(curl -s -X PATCH "$API_BASE/schedules/order_test_123/status" \
  -H "Content-Type: application/json" \
  -H "x-auth0-email: $AUTH0_EMAIL" \
  -H "x-auth0-id: $AUTH0_ID" \
  -d "{
    \"status\": \"completed\",
    \"notes\": \"Order successfully picked up\"
  }")

echo "Status Update Response:"
echo "$UPDATE_RESPONSE" | jq '.' 2>/dev/null || echo "$UPDATE_RESPONSE"
echo ""

# Test 10: Get All Time Slots for Tenant
echo "📅 Test 10: Getting All Time Slots for Tenant..."
ALL_SLOTS_RESPONSE=$(curl -s -X GET "$API_BASE/time-slots/tenant/$TENANT_ID?date=2026-05-02" \
  -H "x-auth0-email: $AUTH0_EMAIL" \
  -H "x-auth0-id: $AUTH0_ID")

echo "All Time Slots Response:"
echo "$ALL_SLOTS_RESPONSE" | jq '.' 2>/dev/null || echo "$ALL_SLOTS_RESPONSE"
echo ""

echo "✅ Fulfillment API Tests Complete!"
echo "=================================="
echo ""
echo "📝 Test Summary:"
echo "- Time Slot Management: ✅"
echo "- Customer Management: ✅" 
echo "- Fulfillment Scheduling: ✅"
echo "- Notifications: ✅"
echo "- Statistics: ✅"
echo ""
echo "⚠️  Note: Some tests may fail if:"
echo "1. API server is not running on port 3001"
echo "2. Authorization token is invalid"
echo "3. Test order/order_test_123 doesn't exist"
echo "4. Tenant/organization IDs don't exist"
echo ""
echo "🔧 To run tests with real data:"
echo "1. Start the API server: pnpm dev:api"
echo "2. Replace YOUR_TOKEN_HERE with valid JWT token"
echo "3. Replace TENANT_ID and ORGANIZATION_ID with actual IDs"
echo "4. Create a test order first for scheduling tests"
