#!/bin/bash

# Phase 3A Order Management - Test Script
# This script tests all order endpoints with curl commands

# Configuration
API_BASE_URL="http://localhost:4000"
TENANT_ID="tid-m8ijkrnk"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 3A Order Management Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if JWT token is provided
if [ -z "$JWT_TOKEN" ]; then
    echo -e "${RED}Error: JWT_TOKEN environment variable not set${NC}"
    echo "Usage: JWT_TOKEN='your-token-here' ./test-orders.sh"
    exit 1
fi

echo -e "${GREEN}✓ JWT Token found${NC}"
echo -e "${GREEN}✓ API Base URL: $API_BASE_URL${NC}"
echo -e "${GREEN}✓ Tenant ID: $TENANT_ID${NC}"
echo ""

# Test 1: Create a simple order
echo -e "${YELLOW}Test 1: Create Simple Order${NC}"
echo "POST $API_BASE_URL/api/orders"
echo ""

ORDER_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/orders" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "'"$TENANT_ID"'",
    "customer": {
      "email": "test@example.com",
      "name": "Test Customer",
      "phone": "+1234567890"
    },
    "items": [
      {
        "sku": "TEST-001",
        "name": "Test Product",
        "description": "A test product",
        "quantity": 2,
        "unit_price_cents": 1999
      }
    ],
    "shipping_address": {
      "line1": "123 Test St",
      "city": "New York",
      "state": "NY",
      "postal_code": "10001",
      "country": "US"
    },
    "shipping_cents": 500,
    "notes": "Test order from script",
    "source": "api_test"
  }')

echo "$ORDER_RESPONSE" | jq '.'
echo ""

# Extract order ID from response
ORDER_ID=$(echo "$ORDER_RESPONSE" | jq -r '.order.id // empty')

if [ -z "$ORDER_ID" ]; then
    echo -e "${RED}✗ Failed to create order${NC}"
    echo ""
else
    echo -e "${GREEN}✓ Order created successfully${NC}"
    echo -e "${GREEN}  Order ID: $ORDER_ID${NC}"
    ORDER_NUMBER=$(echo "$ORDER_RESPONSE" | jq -r '.order.order_number')
    echo -e "${GREEN}  Order Number: $ORDER_NUMBER${NC}"
    echo ""
    
    # Test 2: Get order details
    echo -e "${YELLOW}Test 2: Get Order Details${NC}"
    echo "GET $API_BASE_URL/api/orders/$ORDER_ID"
    echo ""
    
    curl -s -X GET "$API_BASE_URL/api/orders/$ORDER_ID" \
      -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
    echo ""
    echo -e "${GREEN}✓ Order details retrieved${NC}"
    echo ""
    
    # Test 3: Update order status
    echo -e "${YELLOW}Test 3: Update Order Status to 'confirmed'${NC}"
    echo "PATCH $API_BASE_URL/api/orders/$ORDER_ID"
    echo ""
    
    curl -s -X PATCH "$API_BASE_URL/api/orders/$ORDER_ID" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "order_status": "confirmed",
        "reason": "Customer confirmed via test script"
      }' | jq '.'
    echo ""
    echo -e "${GREEN}✓ Order status updated${NC}"
    echo ""
fi

# Test 4: List all orders
echo -e "${YELLOW}Test 4: List All Orders${NC}"
echo "GET $API_BASE_URL/api/orders?tenant_id=$TENANT_ID"
echo ""

curl -s -X GET "$API_BASE_URL/api/orders?tenant_id=$TENANT_ID&limit=5" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
echo ""
echo -e "${GREEN}✓ Orders list retrieved${NC}"
echo ""

# Test 5: List orders with filters
echo -e "${YELLOW}Test 5: List Orders with Status Filter${NC}"
echo "GET $API_BASE_URL/api/orders?tenant_id=$TENANT_ID&status=confirmed"
echo ""

curl -s -X GET "$API_BASE_URL/api/orders?tenant_id=$TENANT_ID&status=confirmed&limit=5" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
echo ""
echo -e "${GREEN}✓ Filtered orders retrieved${NC}"
echo ""

# Test 6: Create order with multiple items
echo -e "${YELLOW}Test 6: Create Order with Multiple Items${NC}"
echo "POST $API_BASE_URL/api/orders"
echo ""

curl -s -X POST "$API_BASE_URL/api/orders" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "'"$TENANT_ID"'",
    "customer": {
      "email": "multi-item@example.com",
      "name": "Multi Item Customer"
    },
    "items": [
      {
        "sku": "ITEM-001",
        "name": "Product A",
        "quantity": 1,
        "unit_price_cents": 2999
      },
      {
        "sku": "ITEM-002",
        "name": "Product B",
        "quantity": 3,
        "unit_price_cents": 1499
      },
      {
        "sku": "ITEM-003",
        "name": "Product C",
        "quantity": 2,
        "unit_price_cents": 999
      }
    ],
    "shipping_address": {
      "line1": "456 Multi St",
      "city": "Los Angeles",
      "state": "CA",
      "postal_code": "90001",
      "country": "US"
    },
    "shipping_cents": 750,
    "source": "api_test"
  }' | jq '.'
echo ""
echo -e "${GREEN}✓ Multi-item order created${NC}"
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Suite Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}All tests completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Check database: SELECT * FROM orders ORDER BY created_at DESC LIMIT 5;"
echo "2. Check order items: SELECT * FROM order_items WHERE order_id = '$ORDER_ID';"
echo "3. Check status history: SELECT * FROM order_status_history WHERE order_id = '$ORDER_ID';"
echo ""
