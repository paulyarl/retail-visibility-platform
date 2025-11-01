# Quick API Test Script
# Make sure the server is running: pnpm dev:local

$API_URL = "http://localhost:4000"
$TENANT_ID = "cmhe0edxg0002g8s8bba4j2s0"

Write-Host "`n🧪 Quick API Endpoint Tests`n" -ForegroundColor Cyan
Write-Host "=" * 50

# Test 1: Health Check
Write-Host "`n1. Testing Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/health" -Method Get
    Write-Host "✅ Health check passed: $($response.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Create Feed Job
Write-Host "`n2. Creating Feed Push Job..." -ForegroundColor Yellow
$jobBody = @{
    tenantId = $TENANT_ID
    sku = "TEST-SKU-$(Get-Date -Format 'yyyyMMddHHmmss')"
    payload = @{
        feedType = "full"
        itemCount = 25
    }
} | ConvertTo-Json

try {
    $jobResponse = Invoke-RestMethod -Uri "$API_URL/api/feed-jobs" -Method Post -Body $jobBody -ContentType "application/json"
    $jobId = $jobResponse.data.id
    Write-Host "✅ Job created: $jobId" -ForegroundColor Green
    Write-Host "   Status: $($jobResponse.data.jobStatus)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to create job: $_" -ForegroundColor Red
    exit 1
}

# Test 3: List Feed Jobs
Write-Host "`n3. Listing Feed Jobs..." -ForegroundColor Yellow
try {
    $listResponse = Invoke-RestMethod -Uri "$API_URL/api/feed-jobs?limit=5" -Method Get
    Write-Host "✅ Found $($listResponse.data.Count) jobs" -ForegroundColor Green
    Write-Host "   Total: $($listResponse.pagination.total)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to list jobs: $_" -ForegroundColor Red
}

# Test 4: Get Job Statistics
Write-Host "`n4. Getting Job Statistics..." -ForegroundColor Yellow
try {
    $statsResponse = Invoke-RestMethod -Uri "$API_URL/api/feed-jobs/stats/summary" -Method Get
    Write-Host "✅ Job Statistics:" -ForegroundColor Green
    Write-Host "   Total: $($statsResponse.data.total)" -ForegroundColor Gray
    Write-Host "   Queued: $($statsResponse.data.queued)" -ForegroundColor Gray
    Write-Host "   Success: $($statsResponse.data.success)" -ForegroundColor Gray
    Write-Host "   Failed: $($statsResponse.data.failed)" -ForegroundColor Gray
    Write-Host "   Success Rate: $($statsResponse.data.successRate)%" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to get stats: $_" -ForegroundColor Red
}

# Test 5: Submit Feedback
Write-Host "`n5. Submitting Feedback..." -ForegroundColor Yellow
$feedbackBody = @{
    tenantId = $TENANT_ID
    feedback = @{
        comment = "Testing the new API endpoints - they work great!"
        features_used = @("feed_jobs", "api_testing")
    }
    score = 5
    category = "usability"
    context = "api_testing"
} | ConvertTo-Json

try {
    $feedbackResponse = Invoke-RestMethod -Uri "$API_URL/api/feedback" -Method Post -Body $feedbackBody -ContentType "application/json"
    $feedbackId = $feedbackResponse.data.id
    Write-Host "✅ Feedback submitted: $feedbackId" -ForegroundColor Green
    Write-Host "   Score: $($feedbackResponse.data.score)/5" -ForegroundColor Gray
    Write-Host "   Message: $($feedbackResponse.message)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to submit feedback: $_" -ForegroundColor Red
}

# Test 6: Get Feedback Analytics
Write-Host "`n6. Getting Feedback Analytics..." -ForegroundColor Yellow
try {
    $analyticsResponse = Invoke-RestMethod -Uri "$API_URL/api/feedback/analytics/summary?days=30" -Method Get
    Write-Host "✅ Feedback Analytics:" -ForegroundColor Green
    Write-Host "   Total Feedback: $($analyticsResponse.data.summary.totalFeedback)" -ForegroundColor Gray
    Write-Host "   Avg Score: $($analyticsResponse.data.summary.avgScore)/5.0" -ForegroundColor Gray
    Write-Host "   Satisfaction Rate: $($analyticsResponse.data.summary.satisfactionRate)%" -ForegroundColor Gray
    Write-Host "   Positive: $($analyticsResponse.data.summary.positiveCount)" -ForegroundColor Gray
    Write-Host "   Negative: $($analyticsResponse.data.summary.negativeCount)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to get analytics: $_" -ForegroundColor Red
}

# Test 7: Get Pilot KPIs
Write-Host "`n7. Getting Pilot Program KPIs..." -ForegroundColor Yellow
try {
    $kpisResponse = Invoke-RestMethod -Uri "$API_URL/api/feedback/pilot/kpis" -Method Get
    Write-Host "✅ Pilot KPIs:" -ForegroundColor Green
    Write-Host "   Overall Status: $($kpisResponse.data.overallStatus)" -ForegroundColor Gray
    
    $kpis = $kpisResponse.data.kpis
    foreach ($kpiName in $kpis.PSObject.Properties.Name) {
        $kpi = $kpis.$kpiName
        $status = if ($kpi.status -eq "met") { "✅" } else { "❌" }
        Write-Host "   $status $kpiName`: $($kpi.current) (target: $($kpi.target))" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Failed to get KPIs: $_" -ForegroundColor Red
}

# Test 8: Update Job Status
Write-Host "`n8. Updating Job Status to Success..." -ForegroundColor Yellow
$updateBody = @{
    jobStatus = "success"
    result = @{
        itemsProcessed = 25
        successCount = 24
        errorCount = 1
    }
} | ConvertTo-Json

try {
    $updateResponse = Invoke-RestMethod -Uri "$API_URL/api/feed-jobs/$jobId/status" -Method Patch -Body $updateBody -ContentType "application/json"
    Write-Host "✅ Job updated: $($updateResponse.data.jobStatus)" -ForegroundColor Green
    Write-Host "   Completed at: $($updateResponse.data.completedAt)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to update job: $_" -ForegroundColor Red
}

# Cleanup
Write-Host "`n9. Cleaning up test data..." -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$API_URL/api/feed-jobs/$jobId" -Method Delete | Out-Null
    Write-Host "✅ Test job deleted" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not delete test job (may require admin auth)" -ForegroundColor Yellow
}

try {
    Invoke-RestMethod -Uri "$API_URL/api/feedback/$feedbackId" -Method Delete | Out-Null
    Write-Host "✅ Test feedback deleted" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not delete test feedback (may require admin auth)" -ForegroundColor Yellow
}

Write-Host "`n" + ("=" * 50)
Write-Host "`n🎉 All HTTP endpoint tests completed!`n" -ForegroundColor Cyan
