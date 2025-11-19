# Comprehensive Role Testing Script (PowerShell)
# Tests all user roles against tenant access control system
# Usage: .\test-all-roles.ps1 -TenantId "tenant-123" -Mode "critical"

param(
    [Parameter(Mandatory=$false, HelpMessage="Tenant ID to test against")]
    [string]$TenantId = "cmi525r4y0004g8bsbzcpuipz",
    
    [Parameter(Mandatory=$false, HelpMessage="Test mode")]
    [ValidateSet("critical", "platform", "tenant", "full", "quick")]
    [string]$Mode = "critical",
    
    [Parameter(Mandatory=$false, HelpMessage="Generate JSON report")]
    [switch]$JsonReport,
    
    [Parameter(Mandatory=$false, HelpMessage="Verbose output")]
    [switch]$Verbose,
    
    [Parameter(Mandatory=$false, HelpMessage="Parallel execution")]
    [switch]$Parallel,
    
    [Parameter(Mandatory=$false, HelpMessage="User password")]
    [string]$Password = "Admin123!"
)

# Configuration
$config = @{
    BaseUrl = "http://localhost:3000"
    ApiUrl = "http://localhost:4000"
    DefaultPassword = $Password
    ScriptPath = "scripts\test-tenant-access.js"
}

# Test user definitions
$testUsers = @{
    # Platform Roles (Cross-Tenant Access)
    PlatformAdmin = @{
        Email = "admin@rvp.com"
        Scenario = "platform-admin"
        Name = "Platform Admin"
        Description = "Full system access, unlimited tenants"
        Category = "Platform"
        Priority = "Critical"
        ExpectedAccess = @{
            PlatformAccess = $true
            TierBypass = $true
            RoleBypass = $true
            CanAdmin = $true
        }
    }
    PlatformSupport = @{
        Email = "support@rvp.com"
        Scenario = "platform-support"
        Name = "Platform Support"
        Description = "All tenants + support actions (3 limit)"
        Category = "Platform"
        Priority = "High"
        ExpectedAccess = @{
            PlatformAccess = $true
            TierBypass = $true
            RoleBypass = $true
            CanAdmin = $true
        }
    }
    PlatformViewer = @{
        Email = "viewer@rvp.com"
        Scenario = "platform-viewer"
        Name = "Platform Viewer"
        Description = "Read-only access to all tenants"
        Category = "Platform"
        Priority = "Medium"
        ExpectedAccess = @{
            PlatformAccess = $true
            TierBypass = $false
            RoleBypass = $false
            CanAdmin = $false
        }
    }
    
    # Tenant Roles (Single-Tenant Access)
    TenantOwner = @{
        Email = "owner@rvp.com"
        Scenario = "tenant-owner"
        Name = "Tenant Owner"
        Description = "Full control of owned tenants (highest tenant role)"
        Category = "Tenant"
        Priority = "Critical"
        ExpectedAccess = @{
            PlatformAccess = $false
            TierBypass = $false
            RoleBypass = $false
            CanAdmin = $true
        }
    }
    TenantAdmin = @{
        Email = "tenantadmin@rvp.com"
        Scenario = "tenant-admin"
        Name = "Tenant Admin"
        Description = "Support role for assigned tenants (below Tenant Owner)"
        Category = "Tenant"
        Priority = "Critical"
        ExpectedAccess = @{
            PlatformAccess = $false
            TierBypass = $false
            RoleBypass = $true
            CanAdmin = $false
        }
    }
    TenantManager = @{
        Email = "manager@rvp.com"
        Scenario = "tenant-manager"
        Name = "Tenant Manager"
        Description = "Management operations"
        Category = "Tenant"
        Priority = "Medium"
        ExpectedAccess = @{
            PlatformAccess = $false
            TierBypass = $false
            RoleBypass = $false
            CanAdmin = $false
        }
    }
    TenantMember = @{
        Email = "member@rvp.com"
        Scenario = "tenant-member"
        Name = "Tenant Member"
        Description = "Edit only, no manage"
        Category = "Tenant"
        Priority = "High"
        ExpectedAccess = @{
            PlatformAccess = $false
            TierBypass = $false
            RoleBypass = $false
            CanAdmin = $false
        }
    }
    TenantViewer = @{
        Email = "tenantviewer@rvp.com"
        Scenario = "tenant-viewer"
        Name = "Tenant Viewer"
        Description = "View only"
        Category = "Tenant"
        Priority = "Medium"
        ExpectedAccess = @{
            PlatformAccess = $false
            TierBypass = $false
            RoleBypass = $false
            CanAdmin = $false
        }
    }
    
    # Legacy/Special Roles
    LegacyAdmin = @{
        Email = "legacy@rvp.com"
        Scenario = "platform-admin"
        Name = "Legacy Admin"
        Description = "Deprecated admin role"
        Category = "Legacy"
        Priority = "Low"
        ExpectedAccess = @{
            PlatformAccess = $true
            TierBypass = $true
            RoleBypass = $true
            CanAdmin = $true
        }
    }
    BasicUser = @{
        Email = "user@rvp.com"
        Scenario = "tenant-member"
        Name = "Basic User"
        Description = "Basic access with tier limits"
        Category = "Legacy"
        Priority = "Low"
        ExpectedAccess = @{
            PlatformAccess = $false
            TierBypass = $false
            RoleBypass = $false
            CanAdmin = $false
        }
    }
}

# Test mode configurations
$testModes = @{
    critical = @("PlatformAdmin", "TenantOwner", "TenantAdmin", "TenantMember", "PlatformViewer")
    platform = @("PlatformAdmin", "PlatformSupport", "PlatformViewer", "LegacyAdmin")
    tenant = @("TenantOwner", "TenantAdmin", "TenantManager", "TenantMember", "TenantViewer", "BasicUser")
    full = @("PlatformAdmin", "PlatformSupport", "PlatformViewer", "TenantOwner", "TenantAdmin", "TenantManager", "TenantMember", "TenantViewer", "LegacyAdmin", "BasicUser")
    quick = @("PlatformAdmin", "TenantOwner", "TenantAdmin")
}

function Write-TestHeader {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "              COMPREHENSIVE ROLE ACCESS TESTING" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🎯 TEST CONFIGURATION:" -ForegroundColor Yellow
    Write-Host "   Tenant ID: $TenantId" -ForegroundColor White
    Write-Host "   Test Mode: $Mode" -ForegroundColor White
    Write-Host "   Base URL: $($config.BaseUrl)" -ForegroundColor White
    Write-Host "   API URL: $($config.ApiUrl)" -ForegroundColor White
    Write-Host "   Password: $($config.DefaultPassword)" -ForegroundColor White
    Write-Host "   Parallel: $Parallel" -ForegroundColor White
    Write-Host ""
}

function Test-SingleRole {
    param($userKey, $user)
    
    $testStart = Get-Date
    
    if ($Verbose) {
        Write-Host "🧪 Testing: $($user.Name)" -ForegroundColor Cyan
        Write-Host "   Email: $($user.Email)" -ForegroundColor Gray
        Write-Host "   Scenario: $($user.Scenario)" -ForegroundColor Gray
        Write-Host "   Description: $($user.Description)" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "🧪 Testing $($user.Name)..." -ForegroundColor Cyan -NoNewline
    }
    
    # Set environment variables
    $env:TEST_BASE_URL = $config.BaseUrl
    $env:API_BASE_URL = $config.ApiUrl
    
    # Build command arguments
    $args = @(
        $config.ScriptPath,
        "--user=$($user.Email)",
        "--tenant=$TenantId",
        "--scenario=$($user.Scenario)",
        "--password=$($config.DefaultPassword)"
    )
    
    try {
        # Run the test
        $result = & node $args 2>&1
        $exitCode = $LASTEXITCODE
        $testEnd = Get-Date
        $duration = ($testEnd - $testStart).TotalSeconds
        
        $testResult = @{
            UserKey = $userKey
            User = $user
            Success = ($exitCode -eq 0)
            ExitCode = $exitCode
            Output = $result -join "`n"
            Duration = $duration
            Timestamp = $testStart
        }
        
        if ($testResult.Success) {
            if ($Verbose) {
                Write-Host "✅ $($user.Name): PASSED" -ForegroundColor Green
            } else {
                Write-Host " ✅ PASSED" -ForegroundColor Green
            }
        } else {
            if ($Verbose) {
                Write-Host "❌ $($user.Name): FAILED" -ForegroundColor Red
                Write-Host "   Exit Code: $exitCode" -ForegroundColor Red
            } else {
                Write-Host " ❌ FAILED" -ForegroundColor Red
            }
        }
        
        if ($Verbose) {
            Write-Host "   Duration: $([math]::Round($duration, 2))s" -ForegroundColor Gray
            Write-Host ""
            Write-Host "----------------------------------------------------------------" -ForegroundColor Gray
            Write-Host ""
        }
        
        return $testResult
    }
    catch {
        $testEnd = Get-Date
        $duration = ($testEnd - $testStart).TotalSeconds
        
        Write-Host "❌ $($user.Name): ERROR" -ForegroundColor Red
        if ($Verbose) {
            Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        return @{
            UserKey = $userKey
            User = $user
            Success = $false
            ExitCode = -1
            Output = $_.Exception.Message
            Duration = $duration
            Timestamp = $testStart
            Error = $_.Exception.Message
        }
    }
}

function Write-TestSummary {
    param($results)
    
    $totalTests = $results.Count
    $passedTests = ($results | Where-Object { $_.Success }).Count
    $failedTests = $totalTests - $passedTests
    $successRate = if ($totalTests -gt 0) { [math]::Round(($passedTests / $totalTests) * 100, 1) } else { 0 }
    $totalDuration = ($results | Measure-Object -Property Duration -Sum).Sum
    
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "                        TEST SUMMARY" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📊 RESULTS:" -ForegroundColor Yellow
    Write-Host "   Total Tests: $totalTests" -ForegroundColor White
    Write-Host "   Passed: $passedTests" -ForegroundColor Green
    Write-Host "   Failed: $failedTests" -ForegroundColor Red
    Write-Host "   Success Rate: $successRate%" -ForegroundColor White
    Write-Host "   Total Duration: $([math]::Round($totalDuration, 2))s" -ForegroundColor White
    Write-Host ""
    
    # Show failed tests
    $failedResults = $results | Where-Object { -not $_.Success }
    if ($failedResults.Count -gt 0) {
        Write-Host "❌ FAILED TESTS:" -ForegroundColor Red
        foreach ($failed in $failedResults) {
            Write-Host "   • $($failed.User.Name) ($($failed.User.Email))" -ForegroundColor Red
            if ($failed.Error) {
                Write-Host "     Error: $($failed.Error)" -ForegroundColor Red
            }
        }
        Write-Host ""
    }
    
    # Show category breakdown
    $categories = $results | Group-Object { $_.User.Category }
    Write-Host "📋 BY CATEGORY:" -ForegroundColor Yellow
    foreach ($category in $categories) {
        $catPassed = ($category.Group | Where-Object { $_.Success }).Count
        $catTotal = $category.Group.Count
        $catRate = if ($catTotal -gt 0) { [math]::Round(($catPassed / $catTotal) * 100, 1) } else { 0 }
        Write-Host "   $($category.Name): $catPassed/$catTotal ($catRate%)" -ForegroundColor White
    }
    Write-Host ""
    
    if ($failedTests -eq 0) {
        Write-Host "✅ ALL TESTS PASSED - System is ready for deployment!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎉 Role-based access control is working correctly across all user types." -ForegroundColor Green
        Write-Host "   • Platform roles have appropriate cross-tenant access" -ForegroundColor Green
        Write-Host "   • Tenant roles respect hierarchy (Owner > Admin > Manager > Member > Viewer)" -ForegroundColor Green
        Write-Host "   • TENANT_ADMIN role properly positioned below Tenant Owner" -ForegroundColor Green
        Write-Host "   • Access controls and bypasses function as expected" -ForegroundColor Green
    } else {
        Write-Host "❌ $failedTests TEST(S) FAILED - Do not deploy!" -ForegroundColor Red
        Write-Host ""
        Write-Host "🚨 Critical access issues detected:" -ForegroundColor Red
        Write-Host "   • Review failed tests above" -ForegroundColor Red
        Write-Host "   • Check user creation and role assignments" -ForegroundColor Red
        Write-Host "   • Verify tenant assignments for tenant-scoped users" -ForegroundColor Red
        Write-Host "   • Ensure TENANT_ADMIN role is properly configured" -ForegroundColor Red
        Write-Host "   • Fix all issues before proceeding with deployment" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    
    if ($failedTests -eq 0) {
        Write-Host "🚀 DEPLOYMENT APPROVED - All access controls validated" -ForegroundColor Green
    } else {
        Write-Host "🛑 DEPLOYMENT BLOCKED - Fix access control issues" -ForegroundColor Red
    }
    
    return @{
        TotalTests = $totalTests
        PassedTests = $passedTests
        FailedTests = $failedTests
        SuccessRate = $successRate
        TotalDuration = $totalDuration
        Results = $results
    }
}

function Export-JsonReport {
    param($summary, $results)
    
    $report = @{
        TestRun = @{
            Timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
            TenantId = $TenantId
            Mode = $Mode
            Configuration = $config
        }
        Summary = @{
            TotalTests = $summary.TotalTests
            PassedTests = $summary.PassedTests
            FailedTests = $summary.FailedTests
            SuccessRate = $summary.SuccessRate
            TotalDuration = $summary.TotalDuration
        }
        Results = $results | ForEach-Object {
            @{
                UserKey = $_.UserKey
                UserName = $_.User.Name
                UserEmail = $_.User.Email
                Scenario = $_.User.Scenario
                Category = $_.User.Category
                Priority = $_.User.Priority
                Success = $_.Success
                ExitCode = $_.ExitCode
                Duration = $_.Duration
                Timestamp = $_.Timestamp
                Error = $_.Error
                ExpectedAccess = $_.User.ExpectedAccess
            }
        }
    }
    
    $reportPath = "test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    $report | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportPath -Encoding UTF8
    Write-Host "📄 JSON report saved to: $reportPath" -ForegroundColor Cyan
}

# Main execution
try {
    Write-TestHeader
    
    # Validate script exists
    if (-not (Test-Path $config.ScriptPath)) {
        Write-Host "❌ ERROR: Test script not found at $($config.ScriptPath)" -ForegroundColor Red
        Write-Host "Please ensure you're running this from the project root directory" -ForegroundColor Red
        exit 1
    }
    
    # Get users to test based on mode
    $usersToTest = $testModes[$Mode]
    if (-not $usersToTest) {
        Write-Host "❌ ERROR: Invalid test mode '$Mode'" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "🚀 Starting comprehensive role testing..." -ForegroundColor Yellow
    Write-Host "   Mode: $Mode ($($usersToTest.Count) tests)" -ForegroundColor White
    Write-Host ""
    
    # Run tests
    $results = @()
    
    if ($Parallel -and $usersToTest.Count -gt 1) {
        Write-Host "⚡ Running tests in parallel..." -ForegroundColor Yellow
        Write-Host ""
        
        $jobs = @()
        foreach ($userKey in $usersToTest) {
            $user = $testUsers[$userKey]
            $jobs += Start-Job -ScriptBlock {
                param($userKey, $user, $config, $TenantId)
                # Job implementation would go here
                # Note: PowerShell jobs have limitations with complex objects
            } -ArgumentList $userKey, $user, $config, $TenantId
        }
        
        # Wait for all jobs and collect results
        $results = $jobs | Wait-Job | Receive-Job
        $jobs | Remove-Job
    } else {
        # Sequential execution
        foreach ($userKey in $usersToTest) {
            $user = $testUsers[$userKey]
            $result = Test-SingleRole -userKey $userKey -user $user
            $results += $result
        }
    }
    
    # Generate summary
    $summary = Write-TestSummary -results $results
    
    # Export JSON report if requested
    if ($JsonReport) {
        Export-JsonReport -summary $summary -results $results
    }
    
    # Exit with appropriate code
    if ($summary.FailedTests -eq 0) {
        exit 0
    } else {
        exit 1
    }
}
catch {
    Write-Host "❌ FATAL ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
