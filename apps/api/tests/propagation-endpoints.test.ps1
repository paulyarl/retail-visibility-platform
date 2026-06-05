# Propagation Endpoints Test Script (PowerShell)
# Tests all 7 propagation features in the Propagation Control Panel

param(
    [string]$ApiBaseUrl = "http://localhost:4000",
    [Parameter(Mandatory=$true)]
    [string]$TenantId,
    [Parameter(Mandatory=$true)]
    [string]$AuthToken
)

# Test results
$script:TestsPassed = 0
$script:TestsFailed = 0
$script:TestsTotal = 0

# Helper functions
function Write-Header {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Blue
    Write-Host $Message -ForegroundColor Blue
    Write-Host "========================================`n" -ForegroundColor Blue
}

function Write-TestName {
    param([string]$Message)
    Write-Host "Testing: " -NoNewline -ForegroundColor Yellow
    Write-Host $Message
}

function Write-Success {
    param([string]$Message, [string]$Details = "")
    Write-Host "✓ PASS: " -NoNewline -ForegroundColor Green
    Write-Host $Message
    if ($Details) {
        Write-Host "  Response: $Details" -ForegroundColor Gray
    }
    $script:TestsPassed++
    $script:TestsTotal++
}

function Write-Failure {
    param([string]$Message, [string]$Error)
    Write-Host "✗ FAIL: " -NoNewline -ForegroundColor Red
    Write-Host $Message
    Write-Host "  Error: $Error" -ForegroundColor Red
    $script:TestsFailed++
    $script:TestsTotal++
}

function Write-Summary {
    Write-Host "`n========================================" -ForegroundColor Blue
    Write-Host "Test Summary" -ForegroundColor Blue
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host "Total Tests: $script:TestsTotal"
    Write-Host "Passed: $script:TestsPassed" -ForegroundColor Green
    Write-Host "Failed: $script:TestsFailed" -ForegroundColor Red
    
    if ($script:TestsFailed -eq 0) {
        Write-Host "`nAll tests passed! 🎉`n" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "`nSome tests failed! ❌`n" -ForegroundColor Red
        exit 1
    }
}

function Test-Endpoint {
    param(
        [string]$TestName,
        [string]$Method,
        [string]$Endpoint,
        [string]$Body = "{}",
        [int]$ExpectedStatus = 200
    )
    
    Write-TestName $TestName
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
            "Authorization" = "Bearer $AuthToken"
        }
        
        $uri = "$ApiBaseUrl$Endpoint"
        
        if ($Method -eq "POST") {
            $response = Invoke-WebRequest -Uri $uri -Method Post -Headers $headers -Body $Body -UseBasicParsing -ErrorAction Stop
        } else {
            $response = Invoke-WebRequest -Uri $uri -Method Get -Headers $headers -UseBasicParsing -ErrorAction Stop
        }
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            $content = $response.Content | ConvertFrom-Json
            $message = if ($content.message) { $content.message } elseif ($content.error) { $content.error } else { "Success" }
            Write-Success "$TestName (HTTP $($response.StatusCode))" $message
        } else {
            Write-Failure $TestName "Expected HTTP $ExpectedStatus, got $($response.StatusCode)"
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq $ExpectedStatus) {
            Write-Success "$TestName (HTTP $statusCode)" "Expected error response"
        } else {
            Write-Failure $TestName "Expected HTTP $ExpectedStatus, got $statusCode - $($_.Exception.Message)"
        }
    }
}

# Check prerequisites
function Test-Prerequisites {
    Write-Header "Checking Prerequisites"
    
    if (-not $TenantId) {
        Write-Host "Error: TenantId parameter is required" -ForegroundColor Red
        exit 1
    }
    
    if (-not $AuthToken) {
        Write-Host "Error: AuthToken parameter is required" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ API Base URL: $ApiBaseUrl" -ForegroundColor Green
    Write-Host "✓ Tenant ID: $TenantId" -ForegroundColor Green
    Write-Host "✓ Auth Token: $($AuthToken.Substring(0, [Math]::Min(20, $AuthToken.Length)))..." -ForegroundColor Green
}

# Test 1: Categories Propagation
function Test-CategoriesPropagation {
    Write-Header "Test 1: Categories Propagation"
    
    Test-Endpoint `
        -TestName "Categories Propagation (create_or_update)" `
        -Method "POST" `
        -Endpoint "/api/v1/tenants/$TenantId/categories/propagate" `
        -Body '{"mode":"create_or_update"}'
    
    Test-Endpoint `
        -TestName "Categories Propagation (create_only)" `
        -Method "POST" `
        -Endpoint "/api/v1/tenants/$TenantId/categories/propagate" `
        -Body '{"mode":"create_only"}'
    
    Test-Endpoint `
        -TestName "Categories Propagation (update_only)" `
        -Method "POST" `
        -Endpoint "/api/v1/tenants/$TenantId/categories/propagate" `
        -Body '{"mode":"update_only"}'
}

# Test 2: Business Hours Propagation
function Test-BusinessHoursPropagation {
    Write-Header "Test 2: Business Hours Propagation"
    
    Test-Endpoint `
        -TestName "Business Hours Propagation (with special hours)" `
        -Method "POST" `
        -Endpoint "/api/v1/tenants/$TenantId/business-hours/propagate" `
        -Body '{"includeSpecialHours":true}'
    
    Test-Endpoint `
        -TestName "Business Hours Propagation (without special hours)" `
        -Method "POST" `
        -Endpoint "/api/v1/tenants/$TenantId/business-hours/propagate" `
        -Body '{"includeSpecialHours":false}'
}

# Test 3: Feature Flags Propagation
function Test-FeatureFlagsPropagation {
    Write-Header "Test 3: Feature Flags Propagation"
    
    Test-Endpoint `
        -TestName "Feature Flags Propagation (create_or_update)" `
        -Method "POST" `
        -Endpoint "/api/v1/tenants/$TenantId/feature-flags/propagate" `
        -Body '{"mode":"create_or_update"}'
    
    Test-Endpoint `
        -TestName "Feature Flags Propagation (create_only)" `
        -Method "POST" `
        -Endpoint "/api/v1/tenants/$TenantId/feature-flags/propagate" `
        -Body '{"mode":"create_only"}'
    
    Test-Endpoint `
        -TestName "Feature Flags Propagation (update_only)" `
        -Method "POST" `
        -Endpoint "/api/v1/tenants/$TenantId/feature-flags/propagate" `
        -Body '{"mode":"update_only"}'
}

# Test 4: User Roles Propagation
function Test-UserRolesPropagation {
    Write-Header "Test 4: User Roles Propagation"
    
    Test-Endpoint `
        -TestName "User Roles Propagation (create_or_update)" `
        -Method "POST" `
        -Endpoint "/api/v1/tenants/$TenantId/user-roles/propagate" `
        -Body '{"mode":"create_or_update"}'
    
    Test-Endpoint `
        -TestName "User Roles Propagation (create_only)" `
        -Method "POST" `
        -Endpoint "/api/v1/tenants/$TenantId/user-roles/propagate" `
        -Body '{"mode":"create_only"}'
    
    Test-Endpoint `
        -TestName "User Roles Propagation (update_only)" `
        -Method "POST" `
        -Endpoint "/api/v1/tenants/$TenantId/user-roles/propagate" `
        -Body '{"mode":"update_only"}'
}

# Test 5: Brand Assets Propagation
function Test-BrandAssetsPropagation {
    Write-Header "Test 5: Brand Assets Propagation"
    
    Test-Endpoint `
        -TestName "Brand Assets Propagation" `
        -Method "POST" `
        -Endpoint "/api/v1/tenants/$TenantId/brand-assets/propagate" `
        -Body '{}'
}

# Test 6: Business Profile Propagation
function Test-BusinessProfilePropagation {
    Write-Header "Test 6: Business Profile Propagation"
    
    Test-Endpoint `
        -TestName "Business Profile Propagation" `
        -Method "POST" `
        -Endpoint "/api/v1/tenants/$TenantId/business-profile/propagate" `
        -Body '{}'
}

# Test 7: Error Handling
function Test-ErrorHandling {
    Write-Header "Test 7: Error Handling"
    
    Test-Endpoint `
        -TestName "Invalid Tenant ID" `
        -Method "POST" `
        -Endpoint "/api/v1/tenants/invalid-tenant-id/categories/propagate" `
        -Body '{"mode":"create_or_update"}' `
        -ExpectedStatus 404
    
    Test-Endpoint `
        -TestName "Invalid Mode Parameter" `
        -Method "POST" `
        -Endpoint "/api/v1/tenants/$TenantId/categories/propagate" `
        -Body '{"mode":"invalid_mode"}' `
        -ExpectedStatus 400
}

# Test 8: Performance Test
function Test-Performance {
    Write-Header "Test 8: Performance Test"
    
    Write-TestName "Categories Propagation Performance"
    
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
            "Authorization" = "Bearer $AuthToken"
        }
        
        $response = Invoke-WebRequest `
            -Uri "$ApiBaseUrl/api/v1/tenants/$TenantId/categories/propagate" `
            -Method Post `
            -Headers $headers `
            -Body '{"mode":"create_or_update"}' `
            -UseBasicParsing `
            -ErrorAction Stop
        
        $stopwatch.Stop()
        $duration = $stopwatch.ElapsedMilliseconds
        
        if ($duration -lt 5000) {
            Write-Success "Performance test (${duration}ms)"
        } else {
            Write-Failure "Performance test" "Took ${duration}ms (expected < 5000ms)"
        }
    } catch {
        $stopwatch.Stop()
        Write-Failure "Performance test" $_.Exception.Message
    }
}

# Main execution
function Main {
    Write-Host ""
    Write-Host "=========================================================" -ForegroundColor Green
    Write-Host "   Propagation Control Panel - Endpoint Test Suite      " -ForegroundColor Green
    Write-Host "=========================================================" -ForegroundColor Green
    Write-Host ""
    
    Test-Prerequisites
    
    # Run all tests
    Test-CategoriesPropagation
    Test-BusinessHoursPropagation
    Test-FeatureFlagsPropagation
    Test-UserRolesPropagation
    Test-BrandAssetsPropagation
    Test-BusinessProfilePropagation
    Test-ErrorHandling
    Test-Performance
    
    # Print summary
    Write-Summary
}

# Run main function
Main
