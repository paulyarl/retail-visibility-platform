# Check Tenant Status for Propagation
param(
    [string]$ApiBaseUrl = "https://aps.visibleshelf.store",
    [string]$TenantId = "cmhm7fsm9000cg8l4m72gcfqb",
    [string]$AuthToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWhnenFtaWIwMDAwZzhhZzlrMnVoaDhlIiwiZW1haWwiOiJhZG1pbkBkZW1vLmxvY2FsIiwicm9sZSI6IkFETUlOIiwidGVuYW50SWRzIjpbXSwiaWF0IjoxNzYyMzk1NDYwLCJleHAiOjE3OTM5MzE0NjB9.Iq_wRnVxnpQXXMo9k34X8TLZhkFYR6cgWh0FbDiVq4A"
)

Write-Host "`n=== Checking Tenant Status ===`n" -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $AuthToken"
}

try {
    Write-Host "Fetching tenant information..." -ForegroundColor Yellow
    $tenant = Invoke-RestMethod -Uri "$ApiBaseUrl/tenants/$TenantId" -Method Get -Headers $headers
    
    Write-Host "`nTenant Details:" -ForegroundColor Green
    Write-Host "  ID: $($tenant.id)"
    Write-Host "  Name: $($tenant.name)"
    Write-Host "  Organization ID: $($tenant.organizationId)"
    
    if ($tenant.metadata) {
        Write-Host "`nMetadata:" -ForegroundColor Green
        Write-Host "  Is Hero Location: $($tenant.metadata.isHeroLocation)"
        Write-Host "  Full Metadata: $($tenant.metadata | ConvertTo-Json -Depth 3)"
    }
    
    if ($tenant.organizationId) {
        Write-Host "`nFetching organization information..." -ForegroundColor Yellow
        $org = Invoke-RestMethod -Uri "$ApiBaseUrl/organizations/$($tenant.organizationId)" -Method Get -Headers $headers
        
        Write-Host "`nOrganization Details:" -ForegroundColor Green
        Write-Host "  ID: $($org.id)"
        Write-Host "  Name: $($org.name)"
        Write-Host "  Total Tenants: $($org.tenants.Count)"
        
        Write-Host "`nLocations in Organization:" -ForegroundColor Green
        foreach ($t in $org.tenants) {
            $isHero = if ($t.metadata.isHeroLocation) { " [HERO]" } else { "" }
            Write-Host "  - $($t.name)$isHero (ID: $($t.id))"
        }
        
        # Check for hero location
        $heroCount = ($org.tenants | Where-Object { $_.metadata.isHeroLocation -eq $true }).Count
        
        Write-Host "`n=== Propagation Readiness ===" -ForegroundColor Cyan
        if ($heroCount -eq 0) {
            Write-Host "  ❌ NO HERO LOCATION SET" -ForegroundColor Red
            Write-Host "  Action: Set a hero location in Organization Settings" -ForegroundColor Yellow
        } elseif ($tenant.metadata.isHeroLocation) {
            Write-Host "  ✅ This tenant IS the hero location" -ForegroundColor Green
            Write-Host "  ✅ Organization has $($org.tenants.Count) locations" -ForegroundColor Green
            Write-Host "  ✅ Ready for propagation!" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  This tenant is NOT the hero location" -ForegroundColor Yellow
            $hero = $org.tenants | Where-Object { $_.metadata.isHeroLocation -eq $true } | Select-Object -First 1
            Write-Host "  Hero Location: $($hero.name) (ID: $($hero.id))" -ForegroundColor Yellow
            Write-Host "  Action: Use the hero tenant ID for propagation tests" -ForegroundColor Yellow
        }
        
    } else {
        Write-Host "`n❌ Tenant is NOT part of an organization" -ForegroundColor Red
        Write-Host "Action: Create or join an organization first" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "`n❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
}

Write-Host ""
