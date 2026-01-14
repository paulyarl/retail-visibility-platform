# Phase 3B Payment Processing Test Suite
# PowerShell script to test payment API endpoints

$ErrorActionPreference = "Continue"

# Configuration
$API_BASE_URL = "http://localhost:4000"
$JWT_TOKEN = $env:JWT_TOKEN
$TENANT_ID = "tid-m8ijkrnk"

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Error { Write-Host $args -ForegroundColor Red }
function Write-Info { Write-Host $args -ForegroundColor Cyan }

Write-Host "========================================"
Write-Host "Phase 3B Payment Processing Test Suite"
Write-Host "========================================"
Write-Host ""

# Check JWT token
if (-not $JWT_TOKEN) {
    Write-Error "[ERROR] JWT_TOKEN environment variable not set"
    Write-Host "Set it with: `$env:JWT_TOKEN = 'your-token-here'"
    exit 1
}

Write-Success "[OK] JWT Token found"
Write-Success "[OK] API Base URL: $API_BASE_URL"
Write-Success "[OK] Tenant ID: $TENANT_ID"
Write-Host ""

# Helper function to make API calls
function Invoke-ApiCall {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Body
    )
    
    $headers = @{
        "Authorization" = "Bearer $JWT_TOKEN"
        "Content-Type" = "application/json"
    }
    
    $uri = "$API_BASE_URL$Endpoint"
    
    try {
        if ($Body) {
            $jsonBody = $Body | ConvertTo-Json -Depth 10
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $jsonBody
        } else {
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
        }
        return $response
    } catch {
        Write-Error "API call failed: $_"
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host $responseBody
        }
        return $null
    }
}

# Test 1: Create an order for payment testing
Write-Info "Test 1: Create Order for Payment Testing"
Write-Host "POST $API_BASE_URL/api/orders"
Write-Host ""

$orderData = @{
    tenant_id = $TENANT_ID
    customer = @{
        email = "payment-test@example.com"
        name = "Payment Test Customer"
    }
    items = @(
        @{
            sku = "TEST-PAY-001"
            name = "Payment Test Product"
            description = "Product for payment testing"
            quantity = 1
            unit_price_cents = 5000
        }
    )
    shipping_address = @{
        line1 = "123 Test St"
        city = "Test City"
        state = "CA"
        postal_code = "90210"
        country = "US"
    }
}

$order = Invoke-ApiCall -Method POST -Endpoint "/api/orders" -Body $orderData

if ($order -and $order.success) {
    Write-Success "[OK] Order created successfully"
    Write-Host "  Order ID: $($order.order.id)"
    Write-Host "  Order Number: $($order.order.order_number)"
    Write-Host "  Total: `$$($order.order.total_cents / 100)"
    $ORDER_ID = $order.order.id
} else {
    Write-Error "[FAIL] Failed to create order"
    exit 1
}

Write-Host ""
Start-Sleep -Seconds 1

# Test 2: Authorize Payment
Write-Info "Test 2: Authorize Payment (Hold Funds)"
Write-Host "POST $API_BASE_URL/api/orders/$ORDER_ID/payments/authorize"
Write-Host ""

$authorizeData = @{
    paymentMethod = @{
        type = "card"
        token = "pm_card_visa"
    }
    gatewayType = "stripe"
    metadata = @{
        customerEmail = "payment-test@example.com"
        testMode = $true
    }
}

$authPayment = Invoke-ApiCall -Method POST -Endpoint "/api/orders/$ORDER_ID/payments/authorize" -Body $authorizeData

if ($authPayment -and $authPayment.success) {
    Write-Success "[OK] Payment authorized successfully"
    Write-Host "  Payment ID: $($authPayment.payment.id)"
    Write-Host "  Status: $($authPayment.payment.payment_status)"
    Write-Host "  Amount: `$$($authPayment.payment.amount_cents / 100)"
    Write-Host "  Gateway Fee: `$$($authPayment.fees.gateway / 100)"
    Write-Host "  Platform Fee: `$$($authPayment.fees.platform / 100)"
    Write-Host "  Total Fees: `$$($authPayment.fees.total / 100)"
    Write-Host "  Net to Merchant: `$$($authPayment.fees.net / 100)"
    Write-Host "  Fee Waived: $($authPayment.fees.waived)"
    $PAYMENT_ID = $authPayment.payment.id
    $AUTH_ID = $authPayment.payment.gateway_authorization_id
} else {
    Write-Error "[FAIL] Payment authorization failed"
}

Write-Host ""
Start-Sleep -Seconds 2

# Test 3: Get Payment Details
Write-Info "Test 3: Get Payment Details"
Write-Host "GET $API_BASE_URL/api/payments/$PAYMENT_ID"
Write-Host ""

$paymentDetails = Invoke-ApiCall -Method GET -Endpoint "/api/payments/$PAYMENT_ID"

if ($paymentDetails -and $paymentDetails.success) {
    Write-Success "[OK] Payment details retrieved"
    Write-Host "  Status: $($paymentDetails.payment.payment_status)"
    Write-Host "  Gateway: $($paymentDetails.payment.gateway_type)"
    Write-Host "  Transaction ID: $($paymentDetails.payment.gateway_transaction_id)"
} else {
    Write-Error "[FAIL] Failed to get payment details"
}

Write-Host ""
Start-Sleep -Seconds 1

# Test 4: Capture Authorized Payment
Write-Info "Test 4: Capture Authorized Payment"
Write-Host "POST $API_BASE_URL/api/orders/$ORDER_ID/payments/capture"
Write-Host ""

$captureData = @{
    paymentId = $PAYMENT_ID
}

$capturePayment = Invoke-ApiCall -Method POST -Endpoint "/api/orders/$ORDER_ID/payments/capture" -Body $captureData

if ($capturePayment -and $capturePayment.success) {
    Write-Success "[OK] Payment captured successfully"
    Write-Host "  Payment ID: $($capturePayment.payment.id)"
    Write-Host "  Status: $($capturePayment.payment.payment_status)"
    Write-Host "  Captured Amount: `$$($capturePayment.captured_amount / 100)"
} else {
    Write-Error "[FAIL] Payment capture failed"
}

Write-Host ""
Start-Sleep -Seconds 2

# Test 5: Create another order for direct charge test
Write-Info "Test 5: Create Order for Direct Charge Test"
Write-Host "POST $API_BASE_URL/api/orders"
Write-Host ""

$order2Data = @{
    tenant_id = $TENANT_ID
    customer = @{
        email = "charge-test@example.com"
        name = "Direct Charge Test"
    }
    items = @(
        @{
            sku = "TEST-CHARGE-001"
            name = "Direct Charge Product"
            quantity = 2
            unit_price_cents = 2500
        }
    )
}

$order2 = Invoke-ApiCall -Method POST -Endpoint "/api/orders" -Body $order2Data

if ($order2 -and $order2.success) {
    Write-Success "[OK] Second order created"
    Write-Host "  Order ID: $($order2.order.id)"
    Write-Host "  Total: `$$($order2.order.total_cents / 100)"
    $ORDER_ID_2 = $order2.order.id
} else {
    Write-Error "[FAIL] Failed to create second order"
}

Write-Host ""
Start-Sleep -Seconds 1

# Test 6: Direct Charge (Authorize + Capture)
Write-Info "Test 6: Direct Charge Payment"
Write-Host "POST $API_BASE_URL/api/orders/$ORDER_ID_2/payments/charge"
Write-Host ""

$chargeData = @{
    paymentMethod = @{
        type = "card"
        token = "pm_card_visa"
    }
    gatewayType = "stripe"
}

$chargePayment = Invoke-ApiCall -Method POST -Endpoint "/api/orders/$ORDER_ID_2/payments/charge" -Body $chargeData

if ($chargePayment -and $chargePayment.success) {
    Write-Success "[OK] Direct charge successful"
    Write-Host "  Payment ID: $($chargePayment.payment.id)"
    Write-Host "  Status: $($chargePayment.payment.payment_status)"
    Write-Host "  Amount: `$$($chargePayment.payment.amount_cents / 100)"
    Write-Host "  Gateway Fee: `$$($chargePayment.fees.gateway / 100)"
    Write-Host "  Platform Fee: `$$($chargePayment.fees.platform / 100)"
    Write-Host "  Net to Merchant: `$$($chargePayment.fees.net / 100)"
    $PAYMENT_ID_2 = $chargePayment.payment.id
} else {
    Write-Error "[FAIL] Direct charge failed"
}

Write-Host ""
Start-Sleep -Seconds 2

# Test 7: Partial Refund
Write-Info "Test 7: Process Partial Refund"
Write-Host "POST $API_BASE_URL/api/payments/$PAYMENT_ID_2/refund"
Write-Host ""

$refundData = @{
    amount = 2500
    reason = "requested_by_customer"
}

$refund = Invoke-ApiCall -Method POST -Endpoint "/api/payments/$PAYMENT_ID_2/refund" -Body $refundData

if ($refund -and $refund.success) {
    Write-Success "[OK] Partial refund processed"
    Write-Host "  Refund ID: $($refund.refund.id)"
    Write-Host "  Amount: `$$($refund.refund.amount / 100)"
    Write-Host "  Status: $($refund.refund.status)"
    Write-Host "  Is Partial: $($refund.refund.is_partial)"
    Write-Host "  Payment Status: $($refund.payment.payment_status)"
} else {
    Write-Error "[FAIL] Refund failed"
}

Write-Host ""
Start-Sleep -Seconds 1

# Test 8: Get All Payments for Order
Write-Info "Test 8: Get All Payments for Order"
Write-Host "GET $API_BASE_URL/api/orders/$ORDER_ID/payments"
Write-Host ""

$orderPayments = Invoke-ApiCall -Method GET -Endpoint "/api/orders/$ORDER_ID/payments"

if ($orderPayments -and $orderPayments.success) {
    Write-Success "[OK] Order payments retrieved"
    Write-Host "  Total Payments: $($orderPayments.payments.Count)"
    foreach ($payment in $orderPayments.payments) {
        Write-Host "    - $($payment.id): $($payment.payment_status) - `$$($payment.amount_cents / 100)"
    }
} else {
    Write-Error "[FAIL] Failed to get order payments"
}

Write-Host ""
Write-Host "========================================"
Write-Host "Test Suite Complete"
Write-Host "========================================"
Write-Host ""
Write-Success "All payment tests completed!"
Write-Host ""
Write-Host "Summary:"
Write-Host "  - Order 1 ID: $ORDER_ID"
Write-Host "  - Payment 1 ID: $PAYMENT_ID (authorized then captured)"
Write-Host "  - Order 2 ID: $ORDER_ID_2"
Write-Host "  - Payment 2 ID: $PAYMENT_ID_2 (direct charge, partial refund)"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Check database: SELECT * FROM payments ORDER BY created_at DESC LIMIT 5;"
Write-Host "2. Check orders: SELECT id, order_number, payment_status FROM orders WHERE id IN ('$ORDER_ID', '$ORDER_ID_2');"
Write-Host "3. Verify fees: SELECT id, gateway_fee_cents, platform_fee_cents, total_fees_cents, net_amount_cents FROM payments;"
Write-Host ""
