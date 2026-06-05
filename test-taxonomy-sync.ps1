param(
  [string]$ApiUrl = "http://localhost:4000"
)

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

Write-Host "`n🧪 Taxonomy Sync Test" -ForegroundColor Cyan
Write-Host ("=" * 60)
Write-Host "API: $ApiUrl`n" -ForegroundColor Gray

# 1) Run sync
Write-Host "1) Seeding google_taxonomy via /admin/taxonomy/sync..." -ForegroundColor Yellow
$resp = Invoke-SafeRest -Method Post -Url "$ApiUrl/admin/taxonomy/sync"
if (-not $resp -or -not $resp.success) { exit 1 }
Write-Host ("✅ Synced: total={0} insertedOrUpdated={1}" -f $resp.counts.total, $resp.counts.insertedOrUpdated) -ForegroundColor Green

# 2) Display sample entries
if ($resp.sample) {
  Write-Host "`nSample entries:"
  $resp.sample | ForEach-Object { Write-Host (" - {0}: {1}" -f $_.categoryId, $_.categoryPath) -ForegroundColor Gray }
}

Write-Host "`n$("="*60)" -ForegroundColor DarkGray
Write-Host "🎉 Taxonomy sync completed." -ForegroundColor Cyan
