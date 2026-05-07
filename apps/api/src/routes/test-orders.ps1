# Phase 3A Order Management - Test Script (PowerShell)
# This script tests all order endpoints with curl commands

# Configuration
$API_BASE_URL = "http://localhost:4000"
$TENANT_ID = "tid-m8ijkrnk"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "Phase 3A Order Management Test Suite" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Check if JWT token is provided
if (-not $env:JWT_TOKEN) {
    Write-Host "Error: JWT_TOKEN environment variable not set" -ForegroundColor Red
    Write-Host "Usage: `$env:JWT_TOKEN='your-token-here'; .\test-orders.ps1"
    exit 1
}

Write-Host "[OK] JWT Token found" -ForegroundColor Green
Write-Host "[OK] API Base URL: $API_BASE_URL" -ForegroundColor Green
Write-Host "[OK] Tenant ID: $TENANT_ID" -ForegroundColor Green
Write-Host ""

# Test 1: Create a simple order
Write-Host "Test 1: Create Simple Order" -ForegroundColor Yellow
Write-Host "POST $API_BASE_URL/api/orders"
Write-Host ""

$orderPayload = @{
    tenant_id = $TENANT_ID
    customer = @{
        email = "test@example.com"
        name = "Test Customer"
        phone = "+1234567890"
    }
    items = @(
        @{
            sku = "TEST-001"
            name = "Test Product"
            description = "A test product"
            quantity = 2
            unit_price_cents = 1999
        }
    )
    shipping_address = @{
        line1 = "123 Test St"
        city = "New York"
        state = "NY"
        postal_code = "10001"
        country = "US"
    }
    shipping_cents = 500
    notes = "Test order from PowerShell script"
    source = "api_test"
} | ConvertTo-Json -Depth 10

$headers = @{
    "Authorization" = "Bearer $env:JWT_TOKEN"
    "Content-Type" = "application/json"
}

try {
    $orderResponse = Invoke-RestMethod -Uri "$API_BASE_URL/api/orders" -Method Post -Headers $headers -Body $orderPayload
    $orderResponse | ConvertTo-Json -Depth 10 | Write-Host
    Write-Host ""
    Write-Host "[OK] Order created successfully" -ForegroundColor Green
    Write-Host "  Order ID: $($orderResponse.order.id)" -ForegroundColor Green
    Write-Host "  Order Number: $($orderResponse.order.order_number)" -ForegroundColor Green
    Write-Host ""
    
    $ORDER_ID = $orderResponse.order.id
    
    # Test 2: Get order details
    Write-Host "Test 2: Get Order Details" -ForegroundColor Yellow
    Write-Host "GET $API_BASE_URL/api/orders/$ORDER_ID"
    Write-Host ""
    
    $orderDetails = Invoke-RestMethod -Uri "$API_BASE_URL/api/orders/$ORDER_ID" -Method Get -Headers $headers
    $orderDetails | ConvertTo-Json -Depth 10 | Write-Host
    Write-Host ""
    Write-Host "[OK] Order details retrieved" -ForegroundColor Green
    Write-Host ""
    
    # Test 3: Update order status
    Write-Host "Test 3: Update Order Status to 'confirmed'" -ForegroundColor Yellow
    Write-Host "PATCH $API_BASE_URL/api/orders/$ORDER_ID"
    Write-Host ""
    
    $updatePayload = @{
        order_status = "confirmed"
        reason = "Customer confirmed via PowerShell test script"
    } | ConvertTo-Json
    
    $updatedOrder = Invoke-RestMethod -Uri "$API_BASE_URL/api/orders/$ORDER_ID" -Method Patch -Headers $headers -Body $updatePayload
    $updatedOrder | ConvertTo-Json -Depth 10 | Write-Host
    Write-Host ""
    Write-Host "[OK] Order status updated" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host "Error creating order: $_" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Test 4: List all orders
Write-Host "Test 4: List All Orders" -ForegroundColor Yellow
Write-Host "GET $API_BASE_URL/api/orders?tenant_id=$TENANT_ID"
Write-Host ""

try {
    $ordersList = Invoke-RestMethod -Uri "$API_BASE_URL/api/orders?tenant_id=$TENANT_ID&limit=5" -Method Get -Headers $headers
    $ordersList | ConvertTo-Json -Depth 10 | Write-Host
    Write-Host ""
    Write-Host "[OK] Orders list retrieved" -ForegroundColor Green
    Write-Host "  Total orders: $($ordersList.pagination.total)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Error listing orders: $_" -ForegroundColor Red
}

# Test 5: List orders with filters
Write-Host "Test 5: List Orders with Status Filter" -ForegroundColor Yellow
Write-Host "GET $API_BASE_URL/api/orders?tenant_id=$TENANT_ID&status=confirmed"
Write-Host ""

try {
    $filteredOrders = Invoke-RestMethod -Uri "$API_BASE_URL/api/orders?tenant_id=$TENANT_ID&status=confirmed&limit=5" -Method Get -Headers $headers
    $filteredOrders | ConvertTo-Json -Depth 10 | Write-Host
    Write-Host ""
    Write-Host "[OK] Filtered orders retrieved" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Error filtering orders: $_" -ForegroundColor Red
}

# Test 6: Create order with multiple items
Write-Host "Test 6: Create Order with Multiple Items" -ForegroundColor Yellow
Write-Host "POST $API_BASE_URL/api/orders"
Write-Host ""

$multiItemPayload = @{
    tenant_id = $TENANT_ID
    customer = @{
        email = "multi-item@example.com"
        name = "Multi Item Customer"
    }
    items = @(
        @{
            sku = "ITEM-001"
            name = "Product A"
            quantity = 1
            unit_price_cents = 2999
        },
        @{
            sku = "ITEM-002"
            name = "Product B"
            quantity = 3
            unit_price_cents = 1499
        },
        @{
            sku = "ITEM-003"
            name = "Product C"
            quantity = 2
            unit_price_cents = 999
        }
    )
    shipping_address = @{
        line1 = "456 Multi St"
        city = "Los Angeles"
        state = "CA"
        postal_code = "90001"
        country = "US"
    }
    shipping_cents = 750
    source = "api_test"
} | ConvertTo-Json -Depth 10

try {
    $multiItemOrder = Invoke-RestMethod -Uri "$API_BASE_URL/api/orders" -Method Post -Headers $headers -Body $multiItemPayload
    $multiItemOrder | ConvertTo-Json -Depth 10 | Write-Host
    Write-Host ""
    Write-Host "[OK] Multi-item order created" -ForegroundColor Green
    Write-Host "  Order ID: $($multiItemOrder.order.id)" -ForegroundColor Green
    Write-Host "  Total items: $($multiItemOrder.order.order_items.Count)" -ForegroundColor Green
    Write-Host "  Total amount: `$$($multiItemOrder.order.total_cents / 100)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Error creating multi-item order: $_" -ForegroundColor Red
}

# Summary
Write-Host "========================================" -ForegroundColor Blue
Write-Host "Test Suite Complete" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""
Write-Host "All tests completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Check database: SELECT * FROM orders ORDER BY created_at DESC LIMIT 5;"
Write-Host "2. Check order items: SELECT * FROM order_items WHERE order_id = '$ORDER_ID';"
Write-Host "3. Check status history: SELECT * FROM order_status_history WHERE order_id = '$ORDER_ID';"
Write-Host ""
