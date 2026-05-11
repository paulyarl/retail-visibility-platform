# Customer Endpoints Test Script (PowerShell)
# Tests customer authentication and address management endpoints

param(
    [string]$BaseUrl = "http://localhost:4000",
    [string]$TenantId = "tid-jcvzufq2"
)

# Configuration
$ErrorActionPreference = "Continue"

# Colors
function Write-ColorOutput($ForegroundColor, [string]$Message) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    Write-Output $Message
    $host.UI.RawUI.ForegroundColor = $fc
}

# Test counters
$script:TestsPassed = 0
$script:TestsFailed = 0

# Cookie container for session management
$Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$CookieFile = "$env:TEMP\customer-test-cookies.json"

function Print-Header($Title) {
    Write-Output ""
    Write-ColorOutput Yellow "========================================"
    Write-ColorOutput Yellow $Title
    Write-ColorOutput Yellow "========================================"
}

function Print-Test($Description) {
    Write-Output ""
    Write-ColorOutput Green "TEST: $Description"
}

function Print-Result($Success) {
    if ($Success) {
        Write-ColorOutput Green "✓ PASSED"
        $script:TestsPassed++
    } else {
        Write-ColorOutput Red "✗ FAILED"
        $script:TestsFailed++
    }
}

function Invoke-ApiRequest {
    param(
        [string]$Method = "GET",
        [string]$Url,
        [object]$Body = $null,
        [bool]$UseCookies = $true
    )

    try {
        $Headers = @{
            "Content-Type" = "application/json"
        }

        $Params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            UseBasicParsing = $true
        }

        if ($UseCookies -and (Test-Path $CookieFile)) {
            $Cookies = Get-Content $CookieFile | ConvertFrom-Json
            $Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
            foreach ($Cookie in $Cookies) {
                $WebCookie = New-Object System.Net.Cookie
                $WebCookie.Name = $Cookie.Name
                $WebCookie.Value = $Cookie.Value
                $WebCookie.Domain = $Cookie.Domain
                $WebCookie.Path = $Cookie.Path
                $Session.Cookies.Add($WebCookie)
            }
            $Params.WebSession = $Session
        }

        if ($Body) {
            $Params.Body = ($Body | ConvertTo-Json -Depth 10)
        }

        $Response = Invoke-WebRequest @Params

        # Save cookies from response
        if ($Response.Headers.'Set-Cookie') {
            $Cookies = @()
            foreach ($CookieHeader in $Response.Headers.'Set-Cookie') {
                $Parts = $CookieHeader -split ';'
                $NameValue = $Parts[0] -split '=', 2
                $Cookies += [PSCustomObject]@{
                    Name = $NameValue[0].Trim()
                    Value = $NameValue[1].Trim()
                    Domain = "localhost"
                    Path = "/"
                }
            }
            $Cookies | ConvertTo-Json | Set-Content $CookieFile
        }

        return @{
            Success = $true
            StatusCode = $Response.StatusCode
            Body = $Response.Content
        }
    } catch {
        return @{
            Success = $false
            StatusCode = $_.Exception.Response.StatusCode.value__
            Body = $_.ErrorDetails.Message
            Error = $_.Exception.Message
        }
    }
}

# ========================================
# CUSTOMER AUTHENTICATION TESTS
# ========================================

Print-Header "CUSTOMER AUTHENTICATION ENDPOINTS"

# Test 1: Check current session (unauthenticated)
Print-Test "GET /api/customer-auth/me - Check session (unauthenticated)"
$Result = Invoke-ApiRequest -Url "$BaseUrl/api/customer-auth/me" -UseCookies $false
Write-Output "HTTP: $($Result.StatusCode)"
Write-Output "Response: $($Result.Body)"
Print-Result ($Result.StatusCode -eq 401 -or $Result.StatusCode -eq 200)

# Test 2: Register new customer
Print-Test "POST /api/customer-auth/register - Register new customer"
$TestEmail = "test-customer-$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
$RegisterBody = @{
    email = $TestEmail
    password = "TestPassword123!"
    firstName = "Test"
    lastName = "Customer"
}
$Result = Invoke-ApiRequest -Method POST -Url "$BaseUrl/api/customer-auth/register" -Body $RegisterBody
Write-Output "HTTP: $($Result.StatusCode)"
Write-Output "Response: $($Result.Body)"
Print-Result ($Result.StatusCode -eq 200 -or $Result.StatusCode -eq 201)

# Extract customer ID
$ResponseBody = $Result.Body | ConvertFrom-Json
$CustomerId = $ResponseBody.customer.id
Write-Output "Customer ID: $CustomerId"

# Test 3: Check session after registration
Print-Test "GET /api/customer-auth/me - Check session (authenticated)"
$Result = Invoke-ApiRequest -Url "$BaseUrl/api/customer-auth/me"
Write-Output "HTTP: $($Result.StatusCode)"
Write-Output "Response: $($Result.Body)"
Print-Result ($Result.StatusCode -eq 200)

# Test 4: Logout
Print-Test "POST /api/customer-auth/logout - Logout"
$Result = Invoke-ApiRequest -Method POST -Url "$BaseUrl/api/customer-auth/logout"
Write-Output "HTTP: $($Result.StatusCode)"
Write-Output "Response: $($Result.Body)"
Print-Result ($Result.StatusCode -eq 200)

# Test 5: Login
Print-Test "POST /api/customer-auth/login - Login"
$LoginBody = @{
    email = $TestEmail
    password = "TestPassword123!"
}
$Result = Invoke-ApiRequest -Method POST -Url "$BaseUrl/api/customer-auth/login" -Body $LoginBody
Write-Output "HTTP: $($Result.StatusCode)"
Write-Output "Response: $($Result.Body)"
Print-Result ($Result.StatusCode -eq 200)

# ========================================
# CUSTOMER ADDRESSES TESTS
# ========================================

Print-Header "CUSTOMER ADDRESSES ENDPOINTS"

# Test 6: List addresses
Print-Test "GET /api/customer-addresses - List addresses"
$Result = Invoke-ApiRequest -Url "$BaseUrl/api/customer-addresses"
Write-Output "HTTP: $($Result.StatusCode)"
Write-Output "Response: $($Result.Body)"
Print-Result ($Result.StatusCode -eq 200)

# Test 7: Create address
Print-Test "POST /api/customer-addresses - Create new address"
$CreateAddressBody = @{
    label = "Home"
    isDefault = $true
    isBilling = $true
    addressLine1 = "123 Main Street"
    addressLine2 = "Apt 4B"
    city = "New York"
    state = "NY"
    postalCode = "10001"
    country = "US"
    phone = "555-123-4567"
    recipientName = "Test Customer"
}
$Result = Invoke-ApiRequest -Method POST -Url "$BaseUrl/api/customer-addresses" -Body $CreateAddressBody
Write-Output "HTTP: $($Result.StatusCode)"
Write-Output "Response: $($Result.Body)"
Print-Result ($Result.StatusCode -eq 200 -or $Result.StatusCode -eq 201)

# Extract address ID
$ResponseBody = $Result.Body | ConvertFrom-Json
$AddressId = $ResponseBody.address.id
Write-Output "Address ID: $AddressId"

# Test 8: Get specific address
Print-Test "GET /api/customer-addresses/{id} - Get specific address"
if ($AddressId) {
    $Result = Invoke-ApiRequest -Url "$BaseUrl/api/customer-addresses/$AddressId"
    Write-Output "HTTP: $($Result.StatusCode)"
    Write-Output "Response: $($Result.Body)"
    Print-Result ($Result.StatusCode -eq 200)
} else {
    Write-Output "Skipping - no address ID"
    Print-Result $false
}

# Test 9: Create second address
Print-Test "POST /api/customer-addresses - Create second address"
$CreateAddressBody2 = @{
    label = "Work"
    isDefault = $false
    isBilling = $false
    addressLine1 = "456 Office Park"
    city = "New York"
    state = "NY"
    postalCode = "10002"
    country = "US"
    phone = "555-987-6543"
    recipientName = "Test Customer"
}
$Result = Invoke-ApiRequest -Method POST -Url "$BaseUrl/api/customer-addresses" -Body $CreateAddressBody2
Write-Output "HTTP: $($Result.StatusCode)"
Write-Output "Response: $($Result.Body)"
Print-Result ($Result.StatusCode -eq 200 -or $Result.StatusCode -eq 201)

$ResponseBody = $Result.Body | ConvertFrom-Json
$AddressId2 = $ResponseBody.address.id

# Test 10: List all addresses
Print-Test "GET /api/customer-addresses - List all addresses"
$Result = Invoke-ApiRequest -Url "$BaseUrl/api/customer-addresses"
Write-Output "HTTP: $($Result.StatusCode)"
Write-Output "Response: $($Result.Body)"
Print-Result ($Result.StatusCode -eq 200)

# Test 11: Update address
Print-Test "PUT /api/customer-addresses/{id} - Update address"
if ($AddressId) {
    $UpdateAddressBody = @{
        label = "Home Updated"
        addressLine1 = "123 Main Street Updated"
    }
    $Result = Invoke-ApiRequest -Method PUT -Url "$BaseUrl/api/customer-addresses/$AddressId" -Body $UpdateAddressBody
    Write-Output "HTTP: $($Result.StatusCode)"
    Write-Output "Response: $($Result.Body)"
    Print-Result ($Result.StatusCode -eq 200)
} else {
    Write-Output "Skipping - no address ID"
    Print-Result $false
}

# Test 12: Set default address
Print-Test "PUT /api/customer-addresses/{id}/default - Set as default"
if ($AddressId2) {
    $Result = Invoke-ApiRequest -Method PUT -Url "$BaseUrl/api/customer-addresses/$AddressId2/default"
    Write-Output "HTTP: $($Result.StatusCode)"
    Write-Output "Response: $($Result.Body)"
    Print-Result ($Result.StatusCode -eq 200)
} else {
    Write-Output "Skipping - no second address ID"
    Print-Result $false
}

# Test 13: Delete address
Print-Test "DELETE /api/customer-addresses/{id} - Delete address"
if ($AddressId) {
    $Result = Invoke-ApiRequest -Method DELETE -Url "$BaseUrl/api/customer-addresses/$AddressId"
    Write-Output "HTTP: $($Result.StatusCode)"
    Write-Output "Response: $($Result.Body)"
    Print-Result ($Result.StatusCode -eq 200)
} else {
    Write-Output "Skipping - no address ID"
    Print-Result $false
}

# ========================================
# CLEANUP
# ========================================

Print-Header "CLEANUP"

# Final logout
Print-Test "POST /api/customer-auth/logout - Final logout"
$Result = Invoke-ApiRequest -Method POST -Url "$BaseUrl/api/customer-auth/logout"
Write-Output "HTTP: $($Result.StatusCode)"
Print-Result ($Result.StatusCode -eq 200)

# Clean up cookies
if (Test-Path $CookieFile) {
    Remove-Item $CookieFile
}

# ========================================
# SUMMARY
# ========================================

Print-Header "TEST SUMMARY"
Write-ColorOutput Green "Tests Passed: $script:TestsPassed"
Write-ColorOutput Red "Tests Failed: $script:TestsFailed"
Write-Output ""

if ($script:TestsFailed -eq 0) {
    Write-ColorOutput Green "All tests passed!"
    exit 0
} else {
    Write-ColorOutput Red "Some tests failed."
    exit 1
}
