# Location Lifecycle E2E Test Runner with Doppler (PowerShell)
# Run with: .\test-lifecycle.ps1

Write-Host "🧪 Location Lifecycle Management - E2E Test Suite" -ForegroundColor Cyan
Write-Host ""
Write-Host "Running with Doppler config: prd" -ForegroundColor Yellow
Write-Host ""

# Check if Doppler is installed
$dopplerExists = Get-Command doppler -ErrorAction SilentlyContinue
if (-not $dopplerExists) {
    Write-Host "❌ Doppler CLI not found. Please install: https://docs.doppler.com/docs/install-cli" -ForegroundColor Red
    exit 1
}

# Check if logged in to Doppler
$dopplerMe = doppler me 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not logged in to Doppler. Run: doppler login" -ForegroundColor Red
    exit 1
}

# Prompt for test credentials
Write-Host "📝 Test Credentials Required:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Please provide the following for testing:"
Write-Host ""

$TEST_AUTH_TOKEN = Read-Host "Test Auth Token (JWT)"
$TEST_TENANT_ID = Read-Host "Test Tenant ID"
$TEST_USER_ID = Read-Host "Test User ID"

Write-Host ""

# Validate inputs
if ([string]::IsNullOrWhiteSpace($TEST_AUTH_TOKEN) -or 
    [string]::IsNullOrWhiteSpace($TEST_TENANT_ID) -or 
    [string]::IsNullOrWhiteSpace($TEST_USER_ID)) {
    Write-Host "❌ All test credentials are required" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Credentials provided" -ForegroundColor Green
Write-Host ""
Write-Host "Starting tests..." -ForegroundColor Yellow
Write-Host ""

# Set environment variables for test
$env:TEST_AUTH_TOKEN = $TEST_AUTH_TOKEN
$env:TEST_TENANT_ID = $TEST_TENANT_ID
$env:TEST_USER_ID = $TEST_USER_ID

# Run tests with Doppler
doppler run --config prd -- npm test -- src/tests/location-lifecycle.test.ts

# Capture exit code
$EXIT_CODE = $LASTEXITCODE

Write-Host ""
if ($EXIT_CODE -eq 0) {
    Write-Host "✅ All tests passed!" -ForegroundColor Green
} else {
    Write-Host "❌ Tests failed with exit code: $EXIT_CODE" -ForegroundColor Red
}

exit $EXIT_CODE
