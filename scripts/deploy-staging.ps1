# Deploy Staging to Vercel
# This script triggers a Vercel deployment for the staging branch

Write-Host "🚀 Triggering Vercel deployment for staging..." -ForegroundColor Cyan

# Check if VERCEL_DEPLOY_HOOK_STAGING is set
if (-not $env:VERCEL_DEPLOY_HOOK_STAGING) {
    Write-Host "❌ Error: VERCEL_DEPLOY_HOOK_STAGING environment variable not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "To set it up:"
    Write-Host "1. Go to Vercel Dashboard → Your Project → Settings → Git"
    Write-Host "2. Scroll to 'Deploy Hooks'"
    Write-Host "3. Create a new hook for 'staging' branch"
    Write-Host "4. Copy the URL and run:"
    Write-Host '   $env:VERCEL_DEPLOY_HOOK_STAGING="<your-hook-url>"'
    exit 1
}

# Trigger deployment
try {
    $response = Invoke-WebRequest -Uri $env:VERCEL_DEPLOY_HOOK_STAGING -Method POST -UseBasicParsing
    
    if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 201) {
        Write-Host "✅ Deployment triggered successfully!" -ForegroundColor Green
        Write-Host "📊 Check status at: https://vercel.com/dashboard" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Deployment trigger failed with HTTP $($response.StatusCode)" -ForegroundColor Red
        Write-Host $response.Content
        exit 1
    }
} catch {
    Write-Host "❌ Error triggering deployment: $_" -ForegroundColor Red
    exit 1
}
