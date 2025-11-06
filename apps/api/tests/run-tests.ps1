# Simple Propagation Test Runner
param(
    [string]$ApiBaseUrl = "https://visibleshelfstaging.up.railway.app",
    [string]$TenantId = "cmhm7fruk0002g8l401pm9nbq",
    [string]$AuthToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWhnenFtaWIwMDAwZzhhZzlrMnVoaDhlIiwiZW1haWwiOiJhZG1pbkBkZW1vLmxvY2FsIiwicm9sZSI6IkFETUlOIiwidGVuYW50SWRzIjpbXSwiaWF0IjoxNzYyMzk1NDYwLCJleHAiOjE3OTM5MzE0NjB9.Iq_wRnVxnpQXXMo9k34X8TLZhkFYR6cgWh0FbDiVq4A"
)

$passed = 0
$failed = 0

Write-Host "`n=========================================================`n" -ForegroundColor Cyan
Write-Host "  Propagation Control Panel - Test Suite" -ForegroundColor Cyan
Write-Host "`n=========================================================`n" -ForegroundColor Cyan

Write-Host "API URL: $ApiBaseUrl" -ForegroundColor Gray
Write-Host "Tenant: $TenantId`n" -ForegroundColor Gray

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $AuthToken"
}

function Test-API {
    param($Name, $Endpoint, $Body = "{}")
    
    Write-Host "Testing: $Name..." -NoNewline
    
    try {
        $response = Invoke-RestMethod -Uri "$ApiBaseUrl$Endpoint" -Method Post -Headers $headers -Body $Body -ErrorAction Stop
        Write-Host " PASS" -ForegroundColor Green
        if ($response.message) {
            Write-Host "  -> $($response.message)" -ForegroundColor Gray
        }
        if ($response.data) {
            Write-Host "  -> Locations: $($response.data.totalLocations), Created: $($response.data.created), Updated: $($response.data.updated)" -ForegroundColor Gray
        }
        $script:passed++
        return $true
    } catch {
        Write-Host " FAIL" -ForegroundColor Red
        Write-Host "  -> $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
        return $false
    }
}

Write-Host "`n=== Categories Propagation ===" -ForegroundColor Yellow
Test-API "Categories (create_or_update)" "/api/v1/tenants/$TenantId/categories/propagate" '{"mode":"create_or_update"}'
Test-API "Categories (create_only)" "/api/v1/tenants/$TenantId/categories/propagate" '{"mode":"create_only"}'
Test-API "Categories (update_only)" "/api/v1/tenants/$TenantId/categories/propagate" '{"mode":"update_only"}'

Write-Host "`n=== Business Hours Propagation ===" -ForegroundColor Yellow
Test-API "Business Hours (with special)" "/api/v1/tenants/$TenantId/business-hours/propagate" '{"includeSpecialHours":true}'
Test-API "Business Hours (without special)" "/api/v1/tenants/$TenantId/business-hours/propagate" '{"includeSpecialHours":false}'

Write-Host "`n=== Feature Flags Propagation ===" -ForegroundColor Yellow
Test-API "Feature Flags (create_or_update)" "/api/v1/tenants/$TenantId/feature-flags/propagate" '{"mode":"create_or_update"}'
Test-API "Feature Flags (create_only)" "/api/v1/tenants/$TenantId/feature-flags/propagate" '{"mode":"create_only"}'
Test-API "Feature Flags (update_only)" "/api/v1/tenants/$TenantId/feature-flags/propagate" '{"mode":"update_only"}'

Write-Host "`n=== User Roles Propagation ===" -ForegroundColor Yellow
Test-API "User Roles (create_or_update)" "/api/v1/tenants/$TenantId/user-roles/propagate" '{"mode":"create_or_update"}'
Test-API "User Roles (create_only)" "/api/v1/tenants/$TenantId/user-roles/propagate" '{"mode":"create_only"}'
Test-API "User Roles (update_only)" "/api/v1/tenants/$TenantId/user-roles/propagate" '{"mode":"update_only"}'

Write-Host "`n=== Brand Assets Propagation ===" -ForegroundColor Yellow
Test-API "Brand Assets" "/api/v1/tenants/$TenantId/brand-assets/propagate" '{}'

Write-Host "`n=== Business Profile Propagation ===" -ForegroundColor Yellow
Test-API "Business Profile" "/api/v1/tenants/$TenantId/business-profile/propagate" '{}'

Write-Host "`n=========================================================`n" -ForegroundColor Cyan
Write-Host "Test Results:" -ForegroundColor Cyan
Write-Host "  Passed: $passed" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "`n=========================================================`n" -ForegroundColor Cyan

if ($failed -eq 0) {
    Write-Host "All tests passed! 🎉`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests failed!`n" -ForegroundColor Red
    exit 1
}
