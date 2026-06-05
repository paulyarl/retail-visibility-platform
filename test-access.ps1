# Tenant Access Test Runner - PowerShell Script
# Usage: .\test-access.ps1 -User "admin@example.com" -Tenant "tenant-123" -Scenario "platform-admin"

param(
    [Parameter(Mandatory=$true, HelpMessage="User email or username")]
    [string]$User,
    
    [Parameter(Mandatory=$true, HelpMessage="Tenant ID to test")]
    [string]$Tenant,
    
    [Parameter(Mandatory=$false, HelpMessage="Test scenario (optional, runs all if not specified)")]
    [ValidateSet("platform-admin", "platform-support", "platform-viewer", "tenant-owner", "tenant-admin", "tenant-manager", "tenant-member", "tenant-viewer")]
    [string]$Scenario,
    
    [Parameter(Mandatory=$false, HelpMessage="User password")]
    [string]$Password = "password",
    
    [Parameter(Mandatory=$false, HelpMessage="Base URL for the application")]
    [string]$BaseUrl = "http://localhost:3000",
    
    [Parameter(Mandatory=$false, HelpMessage="API URL")]
    [string]$ApiUrl = "http://localhost:3001",
    
    [Parameter(Mandatory=$false, HelpMessage="Run all critical scenarios")]
    [switch]$Critical,
    
    [Parameter(Mandatory=$false, HelpMessage="Verbose output")]
    [switch]$Verbose,
    
    [Parameter(Mandatory=$false, HelpMessage="Generate JSON report")]
    [switch]$JsonReport,
    
    [Parameter(Mandatory=$false, HelpMessage="Output file for JSON report")]
    [string]$OutputFile = "test-results.json"
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Display banner
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "                 TENANT ACCESS TEST RUNNER" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Display configuration
Write-Host "🔧 TEST CONFIGURATION:" -ForegroundColor Yellow
Write-Host "   User: $User" -ForegroundColor White
Write-Host "   Tenant: $Tenant" -ForegroundColor White
Write-Host "   Scenario: $(if ($Scenario) { $Scenario } else { 'All scenarios' })" -ForegroundColor White
Write-Host "   Base URL: $BaseUrl" -ForegroundColor White
Write-Host "   API URL: $ApiUrl" -ForegroundColor White
Write-Host "   Critical Mode: $Critical" -ForegroundColor White
Write-Host ""

# Check prerequisites
Write-Host "🔍 Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version 2>$null
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check test script
$scriptPath = "scripts\test-tenant-access.js"
if (-not (Test-Path $scriptPath)) {
    Write-Host "❌ ERROR: Test script not found at $scriptPath" -ForegroundColor Red
    Write-Host "Please ensure you're running this from the project root directory" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Test script found" -ForegroundColor Green

# Check if servers are running
Write-Host "🌐 Checking server availability..." -ForegroundColor Yellow

try {
    $webResponse = Invoke-WebRequest -Uri $BaseUrl -Method Head -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "✅ Web server responding at $BaseUrl" -ForegroundColor Green
} catch {
    Write-Host "⚠️  WARNING: Web server not responding at $BaseUrl" -ForegroundColor Yellow
}

try {
    $apiResponse = Invoke-WebRequest -Uri "$ApiUrl/health" -Method Get -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "✅ API server responding at $ApiUrl" -ForegroundColor Green
} catch {
    Write-Host "⚠️  WARNING: API server not responding at $ApiUrl" -ForegroundColor Yellow
}

Write-Host ""

# Set environment variables
$env:TEST_BASE_URL = $BaseUrl
$env:API_BASE_URL = $ApiUrl

# Build command arguments
$cmdArgs = @("--user=$User", "--tenant=$Tenant")

if ($Scenario) {
    $cmdArgs += "--scenario=$Scenario"
}

if ($Password -ne "password") {
    $cmdArgs += "--password=$Password"
}

# Define critical scenarios for quick testing
$criticalScenarios = @("platform-admin", "platform-support", "tenant-owner", "tenant-admin", "tenant-member", "platform-viewer")

if ($Critical) {
    Write-Host "🔥 RUNNING CRITICAL ACCESS TESTS" -ForegroundColor Red
    Write-Host "Testing the most important access scenarios..." -ForegroundColor Yellow
    Write-Host ""
    
    $allResults = @()
    $totalPassed = 0
    $totalFailed = 0
    
    foreach ($criticalScenario in $criticalScenarios) {
        Write-Host "🧪 Testing scenario: $criticalScenario" -ForegroundColor Cyan
        
        $scenarioArgs = $cmdArgs + @("--scenario=$criticalScenario")
        
        try {
            $result = & node $scriptPath $scenarioArgs
            $exitCode = $LASTEXITCODE
            
            if ($exitCode -eq 0) {
                Write-Host "✅ $criticalScenario: PASSED" -ForegroundColor Green
                $totalPassed++
            } else {
                Write-Host "❌ $criticalScenario: FAILED" -ForegroundColor Red
                $totalFailed++
            }
            
            if ($JsonReport) {
                $allResults += @{
                    scenario = $criticalScenario
                    status = if ($exitCode -eq 0) { "PASSED" } else { "FAILED" }
                    exitCode = $exitCode
                    output = $result
                }
            }
        } catch {
            Write-Host "❌ $criticalScenario: ERROR - $($_.Exception.Message)" -ForegroundColor Red
            $totalFailed++
        }
        
        Write-Host ""
    }
    
    # Critical test summary
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "🏁 CRITICAL TEST SUMMARY" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "Total Scenarios: $($criticalScenarios.Count)" -ForegroundColor White
    Write-Host "Passed: $totalPassed" -ForegroundColor Green
    Write-Host "Failed: $totalFailed" -ForegroundColor Red
    
    if ($totalFailed -eq 0) {
        Write-Host ""
        Write-Host "🎉 ALL CRITICAL TESTS PASSED!" -ForegroundColor Green
        Write-Host "✅ System is ready for deployment" -ForegroundColor Green
        $finalExitCode = 0
    } else {
        Write-Host ""
        Write-Host "🚨 CRITICAL TESTS FAILED!" -ForegroundColor Red
        Write-Host "❌ DO NOT DEPLOY - Fix issues first" -ForegroundColor Red
        $finalExitCode = 1
    }
    
    if ($JsonReport) {
        $reportData = @{
            timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
            mode = "critical"
            user = $User
            tenant = $Tenant
            totalScenarios = $criticalScenarios.Count
            passed = $totalPassed
            failed = $totalFailed
            results = $allResults
        }
        
        $reportData | ConvertTo-Json -Depth 10 | Out-File -FilePath $OutputFile -Encoding UTF8
        Write-Host "📊 JSON report saved to: $OutputFile" -ForegroundColor Cyan
    }
    
} else {
    # Run single test or all tests
    Write-Host "🚀 Starting test execution..." -ForegroundColor Yellow
    Write-Host ""
    
    if ($Verbose) {
        Write-Host "Command: node $scriptPath $($cmdArgs -join ' ')" -ForegroundColor Gray
        Write-Host ""
    }
    
    try {
        & node $scriptPath $cmdArgs
        $finalExitCode = $LASTEXITCODE
        
        Write-Host ""
        Write-Host "================================================================" -ForegroundColor Cyan
        
        if ($finalExitCode -eq 0) {
            Write-Host "✅ TESTS PASSED - System is ready for deployment" -ForegroundColor Green
        } else {
            Write-Host "❌ TESTS FAILED - Do not deploy" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
        $finalExitCode = 1
    }
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Exit with appropriate code
exit $finalExitCode
