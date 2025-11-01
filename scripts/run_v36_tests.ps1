# -------- Config --------
$BASE = "http://localhost:4000"
$TENANT = "cmhe0edxg0002g8s8bba4j2s0"
$ITEM_ID = "cmhe3safa0001g8ag5xguehpe"
$TOKEN = "$env:ACCESS_TOKEN"  # optional if your API requires Authorization

function Show-Section($t){Write-Host "`n=== $t ===" -ForegroundColor Cyan}

# Helpers
function Get-Csrf {
  param([string]$HealthUrl, [string]$Token)
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $headers = @{}
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }

  # Hit /health to get CSRF cookie issued (twice is fine; one is enough)
  Invoke-WebRequest -Uri $HealthUrl -WebSession $session -Headers $headers -Method GET | Out-Null
  $resp = Invoke-WebRequest -Uri $HealthUrl -WebSession $session -Headers $headers -Method GET

  $cookie = $session.Cookies.GetCookies($HealthUrl) | Where-Object { $_.Name -eq "csrf" }
  $csrf = $cookie.Value
  return @{ Session = $session; Csrf = $csrf }
}

function Invoke-PostJson {
  param(
    [string]$Url,
    [object]$BodyObject = $null,
    $Session,
    [string]$Csrf,
    [string]$Token
  )
  $headers = @{ "Content-Type" = "application/json"; "x-csrf-token" = $Csrf }
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  $body = $null
  if ($BodyObject -ne $null) { $body = ($BodyObject | ConvertTo-Json -Depth 6) }
  # Use Invoke-RestMethod for JSON responses; catch non-2xx
  try {
    return Invoke-RestMethod -Uri $Url -Method POST -Headers $headers -WebSession $Session -Body $body
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $status = [int]$resp.StatusCode
      $stream = $resp.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $text = $reader.ReadToEnd()
      Write-Host "POST $Url -> $status" -ForegroundColor Yellow
      Write-Host $text
    } else {
      Write-Host "POST $Url -> request failed"
      Write-Host $_.Exception.Message
    }
  }
}

function Invoke-PutJson {
  param(
    [string]$Url,
    [object]$BodyObject = $null,
    $Session,
    [string]$Csrf,
    [string]$Token
  )
  $headers = @{ "Content-Type" = "application/json"; "x-csrf-token" = $Csrf }
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  $body = $null
  if ($BodyObject -ne $null) { $body = ($BodyObject | ConvertTo-Json -Depth 6) }
  try {
    return Invoke-RestMethod -Uri $Url -Method PUT -Headers $headers -WebSession $Session -Body $body
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $status = [int]$resp.StatusCode
      $text = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd()
      Write-Host "PUT $Url -> $status" -ForegroundColor Yellow
      Write-Host $text
    } else {
      Write-Host "PUT $Url -> request failed"; Write-Host $_.Exception.Message
    }
  }
}

function Invoke-DeleteJson {
  param(
    [string]$Url,
    $Session,
    [string]$Csrf,
    [string]$Token
  )
  $headers = @{ "x-csrf-token" = $Csrf }
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  try {
    return Invoke-RestMethod -Uri $Url -Method DELETE -Headers $headers -WebSession $Session
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $status = [int]$resp.StatusCode
      $text = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd()
      Write-Host "DELETE $Url -> $status" -ForegroundColor Yellow
      Write-Host $text
    } else {
      Write-Host "DELETE $Url -> request failed"; Write-Host $_.Exception.Message
    }
  }
}

function Invoke-PatchJson {
  param(
    [string]$Url,
    [object]$BodyObject = $null,
    $Session,
    [string]$Csrf,
    [string]$Token
  )
  $headers = @{ "Content-Type" = "application/json"; "x-csrf-token" = $Csrf }
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  $body = $null
  if ($BodyObject -ne $null) { $body = ($BodyObject | ConvertTo-Json -Depth 6) }
  try {
    return Invoke-RestMethod -Uri $Url -Method PATCH -Headers $headers -WebSession $Session -Body $body
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $status = [int]$resp.StatusCode
      $text = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd()
      Write-Host "PATCH $Url -> $status" -ForegroundColor Yellow
      Write-Host $text
    } else {
      Write-Host "PATCH $Url -> request failed"; Write-Host $_.Exception.Message
    }
  }
}

# -------- Phase 1: CSRF + canonical (API portion only) --------
Show-Section "Phase 1 - CSRF"
$ctx = Get-Csrf -HealthUrl "$BASE/health" -Token $TOKEN
$session = $ctx.Session
$csrf = $ctx.Csrf
Write-Host "csrf=$csrf"

# Resolve a valid item id for this tenant (active + public)
try {
  $ih = @{}
  if ($TOKEN) { $ih["Authorization"] = "Bearer $TOKEN" }
  $itemsResp = Invoke-RestMethod -Uri "$BASE/items?tenantId=$TENANT&page=1&limit=1" -Method GET -Headers $ih
  # Try common shapes safely
  $candidate = $null
  if ($itemsResp.items -and $itemsResp.items.Count -gt 0) { $candidate = $itemsResp.items[0] }
  elseif ($itemsResp.data -and $itemsResp.data.items -and $itemsResp.data.items.Count -gt 0) { $candidate = $itemsResp.data.items[0] }
  elseif ($itemsResp.data -and $itemsResp.data[0]) { $candidate = $itemsResp.data[0] }

  if ($candidate -and $candidate.id) {
    $ITEM_ID = $candidate.id
    Write-Host "Resolved ITEM_ID for tenant: $ITEM_ID"
  } else {
    Write-Host "Could not resolve a valid ITEM_ID from /items response; using configured ITEM_ID=$ITEM_ID" -ForegroundColor Yellow
  }
} catch {
  Write-Host "Failed to fetch items for tenant; using configured ITEM_ID=$ITEM_ID" -ForegroundColor Yellow
}

$profileBody = @{ tenant_id=$TENANT; business_name="Batch Test Co" }
# Expect 403 if no CSRF header (uncomment to test)
# Invoke-RestMethod -Uri "$BASE/tenant/profile" -Method POST -Headers @{ "Content-Type"="application/json" } -Body ($profileBody | ConvertTo-Json) -WebSession $session

# Expect 200 with csrf header+cookie
Invoke-PostJson "$BASE/tenant/profile" $profileBody $session $csrf $TOKEN | Out-Host

# -------- Phase 2: Precheck / Validate / Push Feed (422) --------
Show-Section "Phase 2 - Precheck"
Invoke-PostJson "$BASE/api/$TENANT/feed/precheck" $null $session $csrf $TOKEN | Out-Host

Show-Section "Phase 2 - Validate"
try {
  $v = Invoke-RestMethod -Uri "$BASE/api/$TENANT/feed/validate" -Method GET
  $v | Out-Host
} catch { $_ | Out-Host }

Show-Section "Phase 2 - Push Feed (expect 422 if unmapped)"
Invoke-PostJson "$BASE/api/feed-jobs" @{ tenantId=$TENANT } $session $csrf $TOKEN | Out-Host

# -------- Phase 3: Audit Chain + Coverage --------
Show-Section "Phase 3 - Category lifecycle (audit)"
$slug = "batch-cat-" + [Guid]::NewGuid().ToString("N").Substring(0,8)
$create = Invoke-PostJson "$BASE/api/v1/tenants/$TENANT/categories" @{ name="Batch Cat"; slug=$slug } $session $csrf $TOKEN
$catId = $create.data.id

if ($catId) {
  # Use PUT to set googleCategoryId (works even if align route is not mounted)
  Invoke-PutJson "$BASE/api/v1/tenants/$TENANT/categories/$catId" @{ name="Batch Cat 2"; googleCategoryId="123" } $session $csrf $TOKEN | Out-Host
}

Show-Section "Phase 3 - Item category assignment (audit)"
if ($catId) {
  Invoke-PatchJson "$BASE/api/v1/tenants/$TENANT/items/$ITEM_ID/category" @{ tenantCategoryId=$catId } $session $csrf $TOKEN | Out-Host
} else {
  Write-Host "No catId; skipping item category assignment" -ForegroundColor Yellow
}

if ($catId) {
  Invoke-DeleteJson "$BASE/api/v1/tenants/$TENANT/categories/$catId" $session $csrf $TOKEN | Out-Host
}

# -------- Phase 4: View check --------
Show-Section "Phase 4 - View check (run via psql manually)"
Write-Host "SQL> SELECT * FROM v_feed_category_resolved WHERE tenant_id = '$TENANT' LIMIT 10;"