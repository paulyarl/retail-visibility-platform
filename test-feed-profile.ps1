param(
  [string]$TenantId = $env:TEST_TENANT_ID,
  [string]$ApiUrl = "http://localhost:4000"
)

if (-not $TenantId -or [string]::IsNullOrWhiteSpace($TenantId)) {
  Write-Host "`nUsage: .\test-feed-profile.ps1 -TenantId <tenant-id> [-ApiUrl http://localhost:4000]`n" -ForegroundColor Yellow
  exit 1
}

function Invoke-SafeRest {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Body
  )
  try {
    if ($PSBoundParameters.ContainsKey('Body') -and $Body) {
      $json = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 10 }
      return Invoke-RestMethod -Uri $Url -Method $Method -Body $json -ContentType "application/json"
    } else {
      return Invoke-RestMethod -Uri $Url -Method $Method
    }
  } catch {
    Write-Host "❌ Request failed: $Method $Url" -ForegroundColor Red
    if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $errorBody = $reader.ReadToEnd()
      Write-Host $errorBody -ForegroundColor DarkRed
    } else {
      Write-Host $_.Exception.Message -ForegroundColor DarkRed
    }
    return $null
  }
}

Write-Host "`n🧪 Feed Validation + Business Profile API Test" -ForegroundColor Cyan
Write-Host ("=" * 60)
Write-Host "API: $ApiUrl" -ForegroundColor Gray
Write-Host "Tenant: $TenantId`n" -ForegroundColor Gray

# 1) Feed Precheck
Write-Host "1) Feed Precheck..." -ForegroundColor Yellow
$precheck = Invoke-SafeRest -Method Post -Url "$ApiUrl/api/$TenantId/feed/precheck"
if ($precheck -and $precheck.success) {
  Write-Host ("✅ Total items: {0} | missingCategory: {1} | unmapped: {2}" -f $precheck.data.total, $precheck.data.missingCategory.Count, $precheck.data.unmapped.Count) -ForegroundColor Green
} else { Write-Host "⚠️  Precheck failed" -ForegroundColor Yellow }

# 2) Feed Validate
Write-Host "`n2) Feed Validate..." -ForegroundColor Yellow
$validate = Invoke-SafeRest -Method Get -Url "$ApiUrl/api/$TenantId/feed/validate"
if ($validate -and $validate.success) {
  Write-Host ("✅ Total items: {0} | errors: {1} | warnings: {2}" -f $validate.data.total, $validate.data.errors.Count, $validate.data.warnings.Count) -ForegroundColor Green
} else { Write-Host "⚠️  Validate failed" -ForegroundColor Yellow }

# 3) Feed Serialize
Write-Host "`n3) Feed Serialize..." -ForegroundColor Yellow
$serializeBody = @{ limit = 50; includeInactive = $false }
$serialize = Invoke-SafeRest -Method Post -Url "$ApiUrl/api/$TenantId/feed/serialize" -Body $serializeBody
if ($serialize -and $serialize.success) {
  Write-Host ("✅ Serialized items: {0}" -f $serialize.data.total) -ForegroundColor Green
  if ($serialize.data.items.Count -gt 0) {
    $first = $serialize.data.items[0]
    Write-Host "   Sample: offerId=$($first.offerId) gpc=$($first.googleProductCategory) title=$($first.title)" -ForegroundColor Gray
  }
} else { Write-Host "⚠️  Serialize failed" -ForegroundColor Yellow }

# 4) Business Profile - NAP Validate
Write-Host "`n4) Business Profile - NAP Validate..." -ForegroundColor Yellow
$nap = @{ 
  business_name = "Test Business";
  address_line1 = "123 Main St";
  city = "Exampleville";
  postal_code = "10001";
  country_code = "US";
  phone_number = "+12125550123";
  email = "owner@example.com";
  website = "https://example.com"
}
$napResp = Invoke-SafeRest -Method Post -Url "$ApiUrl/api/tenant/$TenantId/profile/validate" -Body $nap
if ($napResp -and $napResp.success) { Write-Host "✅ NAP valid" -ForegroundColor Green } else { Write-Host "⚠️  NAP validation failed" -ForegroundColor Yellow }

# 5) Business Profile - Completeness
Write-Host "`n5) Business Profile - Completeness..." -ForegroundColor Yellow
$comp = Invoke-SafeRest -Method Get -Url "$ApiUrl/api/tenant/$TenantId/profile/completeness"
if ($comp -and $comp.success) {
  Write-Host ("✅ Completeness: {0}% ({1})" -f $comp.data.score, $comp.data.grade) -ForegroundColor Green
} else {
  Write-Host "⚠️  Profile not found or completeness error (expected if not yet created)" -ForegroundColor Yellow
}

# 6) Business Profile - Geocode (mock)
Write-Host "`n6) Business Profile - Geocode (mock)..." -ForegroundColor Yellow
$geoBody = @{ address_line1 = "123 Main St"; city = "Exampleville"; postal_code = "10001"; country_code = "US" }
$geo = Invoke-SafeRest -Method Post -Url "$ApiUrl/api/tenant/$TenantId/profile/geocode" -Body $geoBody
if ($geo -and $geo.success) {
  Write-Host ("✅ Geocode → lat={0}, lng={1}" -f $geo.data.latitude, $geo.data.longitude) -ForegroundColor Green
} else { Write-Host "⚠️  Geocode failed" -ForegroundColor Yellow }

Write-Host "`n$("="*60)" -ForegroundColor DarkGray
Write-Host "🎉 Feed + Profile API test completed." -ForegroundColor Cyan
