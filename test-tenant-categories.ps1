param(
  [string]$TenantId = $env:TEST_TENANT_ID,
  [string]$ApiUrl = "http://localhost:4000"
)

# Usage help
if (-not $TenantId -or [string]::IsNullOrWhiteSpace($TenantId)) {
  Write-Host "`nUsage: .\test-tenant-categories.ps1 -TenantId <tenant-id> [-ApiUrl http://localhost:4000]`n" -ForegroundColor Yellow
  Write-Host "Tip: set TEST_TENANT_ID env var to avoid passing -TenantId each time.`n" -ForegroundColor DarkGray
  exit 1
}

function Invoke-SafeRest {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Body,
    [switch]$Quiet
  )
  try {
    if ($PSBoundParameters.ContainsKey('Body') -and $Body) {
      $json = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 10 }
      $resp = Invoke-RestMethod -Uri $Url -Method $Method -Body $json -ContentType "application/json"
    } else {
      $resp = Invoke-RestMethod -Uri $Url -Method $Method
    }
    if (-not $Quiet) { return $resp } else { return $true }
  } catch {
    if (-not $Quiet) {
      Write-Host "❌ Request failed: $Method $Url" -ForegroundColor Red
      $statusCode = $null
      if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        $statusCode = [int]$_.Exception.Response.StatusCode
        Write-Host ("StatusCode: {0}" -f $statusCode) -ForegroundColor DarkRed
      }
      if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        if ($errorBody) { Write-Host $errorBody -ForegroundColor DarkRed }
      } else {
        Write-Host $_.Exception.Message -ForegroundColor DarkRed
      }
    }
    return $null
  }
}

Write-Host "`n🧪 Tenant Categories API Test" -ForegroundColor Cyan
Write-Host ("=" * 60)
Write-Host "API: $ApiUrl" -ForegroundColor Gray
Write-Host "Tenant: $TenantId`n" -ForegroundColor Gray

# 1) Create category (unique slug per run to avoid conflicts)
Write-Host "1) Creating category..." -ForegroundColor Yellow
# Use timestamp-based slug to avoid 409 duplicate conflicts across runs
$ts = Get-Date -Format "yyyyMMddHHmmss"
$slug = "electronics-$ts"
$createBody = @{ name = "Electronics"; slug = $slug }
$created = Invoke-SafeRest -Method Post -Url "$ApiUrl/api/v1/tenants/$TenantId/categories" -Body $createBody
if (-not $created) {
  # If we hit a 409 due to slug existing, try to find the existing category by listing
  Write-Host "Attempting to recover from error by listing categories..." -ForegroundColor DarkYellow
  $listTry = Invoke-SafeRest -Method Get -Url "$ApiUrl/api/v1/tenants/$TenantId/categories?search=$slug"
  if ($listTry -and $listTry.success -and $listTry.data.Count -gt 0) {
    $existing = $listTry.data | Where-Object { $_.slug -eq $slug } | Select-Object -First 1
    if ($existing) {
      $categoryId = $existing.id
      Write-Host "✅ Using existing category: $categoryId ($($existing.name))" -ForegroundColor Green
    } else {
      exit 1
    }
  } else {
    exit 1
  }
} else {
  $categoryId = $created.data.id
  Write-Host "✅ Created: $categoryId ($($created.data.name))" -ForegroundColor Green
}

# 2) List categories
Write-Host "`n2) Listing categories..." -ForegroundColor Yellow
$list = Invoke-SafeRest -Method Get -Url "$ApiUrl/api/v1/tenants/$TenantId/categories"
if (-not $list -or -not $list.success) { exit 1 }
Write-Host "✅ Found: $($list.data.Count) categories (mapped: $($list.stats.mapped)/$($list.stats.total))" -ForegroundColor Green

# 3) Get category details
Write-Host "`n3) Getting category details..." -ForegroundColor Yellow
$details = Invoke-SafeRest -Method Get -Url "$ApiUrl/api/v1/tenants/$TenantId/categories/$categoryId"
if (-not $details -or -not $details.success) { exit 1 }
Write-Host "✅ Details OK. Children: $($details.data.childCount) Products: $($details.data.productCount)" -ForegroundColor Green

# 4) Update category
Write-Host "`n4) Updating category..." -ForegroundColor Yellow
$updateBody = @{ name = "Electronics & Gadgets"; sortOrder = 1 }
$updated = Invoke-SafeRest -Method Put -Url "$ApiUrl/api/v1/tenants/$TenantId/categories/$categoryId" -Body $updateBody
if (-not $updated -or -not $updated.success) { exit 1 }
Write-Host "✅ Updated: $($updated.data.name) (sort: $($updated.data.sortOrder))" -ForegroundColor Green

# 5) Alignment status (pre)
Write-Host "`n5) Checking alignment status (pre)..." -ForegroundColor Yellow
$alignStatusPre = Invoke-SafeRest -Method Get -Url "$ApiUrl/api/v1/tenants/$TenantId/categories-alignment-status"
if (-not $alignStatusPre -or -not $alignStatusPre.success) { exit 1 }
Write-Host "✅ Status: mapped=$($alignStatusPre.data.mapped) unmapped=$($alignStatusPre.data.unmapped) coverage=$($alignStatusPre.data.mappingCoverage)%" -ForegroundColor Green

# 6) Align category (real align endpoint with a valid Google ID)
Write-Host "`n6) Aligning category via POST /align (googleCategoryId=632: Electronics)..." -ForegroundColor Yellow
$alignBody = @{ googleCategoryId = "632" }
$aligned = Invoke-SafeRest -Method Post -Url "$ApiUrl/api/v1/tenants/$TenantId/categories/$categoryId/align" -Body $alignBody
if (-not $aligned -or -not $aligned.success) { exit 1 }
Write-Host "✅ Aligned to GoogleCategoryId=$($aligned.data.googleCategoryId)" -ForegroundColor Green

# 7) Alignment status (post)
Write-Host "`n7) Checking alignment status (post)..." -ForegroundColor Yellow
$alignStatusPost = Invoke-SafeRest -Method Get -Url "$ApiUrl/api/v1/tenants/$TenantId/categories-alignment-status"
if (-not $alignStatusPost -or -not $alignStatusPost.success) { exit 1 }
Write-Host "✅ Status: mapped=$($alignStatusPost.data.mapped) unmapped=$($alignStatusPost.data.unmapped) coverage=$([math]::Round($alignStatusPost.data.mappingCoverage,2))%" -ForegroundColor Green

# 8) Unmapped list
Write-Host "`n8) Listing unmapped..." -ForegroundColor Yellow
$unmapped = Invoke-SafeRest -Method Get -Url "$ApiUrl/api/v1/tenants/$TenantId/categories-unmapped"
if (-not $unmapped -or -not $unmapped.success) { exit 1 }
Write-Host "✅ Unmapped count: $($unmapped.data.Count)" -ForegroundColor Green

# 9) Cleanup - delete category (soft)
Write-Host "`n9) Cleaning up (soft delete)..." -ForegroundColor Yellow
$deleted = Invoke-SafeRest -Method Delete -Url "$ApiUrl/api/v1/tenants/$TenantId/categories/$categoryId"
if ($deleted -and $deleted.success) {
  Write-Host "✅ Deleted category $categoryId" -ForegroundColor Green
} else {
  Write-Host "⚠️  Delete failed or blocked; see above." -ForegroundColor Yellow
}

Write-Host "`n$("="*60)" -ForegroundColor DarkGray
Write-Host "🎉 Tenant Categories API test completed." -ForegroundColor Cyan
