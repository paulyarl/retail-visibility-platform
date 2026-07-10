# extract-inline-routes.ps1
# Extracts remaining inline handlers from index.ts into dedicated route files,
# adds them to routeRegistry.ts, and replaces the route section with mountFromRegistry(app).

$ErrorActionPreference = 'Stop'

$root = 'c:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform'
$indexFile = Join-Path $root 'apps\api\src\index.ts'
$routesDir = Join-Path $root 'apps\api\src\routes'
$registryFile = Join-Path $routesDir 'routeRegistry.ts'

# Read index.ts lines (0-indexed array)
$lines = Get-Content $indexFile -Encoding UTF8
Write-Host "Read $($lines.Count) lines from index.ts"

# Helper: extract a range of lines (1-indexed) and transform app.X -> router.X
function Extract-Range($startLine, $endLine) {
    $slice = $lines[($startLine - 1)..($endLine - 1)]
    $text = $slice -join "`n"
    # Transform app.get/post/put/patch/delete/use -> router equivalents
    $text = $text -replace 'app\.get\(', 'router.get('
    $text = $text -replace 'app\.post\(', 'router.post('
    $text = $text -replace 'app\.put\(', 'router.put('
    $text = $text -replace 'app\.patch\(', 'router.patch('
    $text = $text -replace 'app\.delete\(', 'router.delete('
    $text = $text -replace 'app\.use\(', 'router.use('
    return $text
}

# ─────────────────────────────────────────────────────────────────────────────
# 1. Create inline-tenant-upload.ts
#    Lines 3625-4061: features-showcase-config + PATCH profile + logo/banner upload
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "Creating inline-tenant-upload.ts..."
$body3625_4061 = Extract-Range 3625 4061

$tenantUploadContent = @"
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { prisma, basePrisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { StorageBuckets } from '../storage-config';

const DEV = process.env.NODE_ENV !== 'production';
const router = Router();

// Re-declare tenantProfileSchema for PATCH (same as inline-tenant-profile.ts)
const tenantProfileSchema = z.object({
  tenant_id: z.string().min(1),
  business_name: z.string().min(1).optional(),
  slug: z.string().optional().nullable().transform(v => v || undefined),
  business_description: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country_code: z.string().optional(),
  phone_number: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().optional(),
  contact_person: z.string().optional(),
  logo_url: z.string().optional(),
  banner_url: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  display_map: z.boolean().optional(),
  map_privacy_mode: z.enum(["precise", "neighborhood"]).optional(),
  gbp_category_id: z.string().nullable().optional(),
  gbp_category_name: z.string().nullable().optional(),
  gbp_category_last_mirrored: z.string().datetime().nullable().optional(),
  gbp_category_sync_status: z.string().nullable().optional(),
});

$body3625_4061

export default router;
"@

Set-Content -Path (Join-Path $routesDir 'inline-tenant-upload.ts') -Value $tenantUploadContent -Encoding UTF8 -NoNewline
Write-Host "  Created inline-tenant-upload.ts"

# ─────────────────────────────────────────────────────────────────────────────
# 2. Create inline-items-crud.ts
#    Lines 4063-6024: photo upload + items CRUD (list, stats, get, create, update, delete, restore, purge, trash, sync)
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "Creating inline-items-crud.ts..."
$body4063_6024 = Extract-Range 4063 6024

$itemsCrudContent = @"
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { requireTenantAdmin } from '../middleware/permissions';
import { requireWritableSubscription } from '../middleware/subscription';
import { isPlatformAdmin } from '../utils/platform-admin';
import { getDirectPool } from '../utils/db-pool';
import { audit } from '../audit';
import { categoryService } from '../services/CategoryService';
import { FeaturedProductsService } from '../services/FeaturedProductsService';
import { generatePhotoId, generateTenantItemId, generateTenantVariantId, generateVariantSkuFromParent, generateSKU, generateTenantKey } from '../lib/id-generator';
import { migrateTempPhotos } from '../photos';
import { StorageBuckets } from '../storage-config';

const DEV = process.env.NODE_ENV !== 'production';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
const router = Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

$body4063_6024

export default router;
"@

Set-Content -Path (Join-Path $routesDir 'inline-items-crud.ts') -Value $itemsCrudContent -Encoding UTF8 -NoNewline
Write-Host "  Created inline-items-crud.ts"

# ─────────────────────────────────────────────────────────────────────────────
# 3. Add new entries to routeRegistry.ts
#    Insert imports after the inline-google-oauth import
#    Insert registry entries before the Misc entry
#    NOTE: inline-taxonomy, inline-gbp-categories, inline-auth-rbac already exist
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "Updating routeRegistry.ts..."
$registry = Get-Content $registryFile -Raw -Encoding UTF8

# Add imports after inline-google-oauth import
$importBlock = @"
import inlineTenantUploadRoutes from '../routes/inline-tenant-upload';
import inlineItemsCrudRoutes from '../routes/inline-items-crud';
"@

$registry = $registry -replace "(import inlineGoogleOAuthRoutes from '../routes/inline-google-oauth';)", "`${1}`n$importBlock"

# Add registry entries before the Misc entry
$entryBlock = @"

  // ── Tenant upload (inline) ─────────────────────────────────────────────
  {
    path: '/',
    router: inlineTenantUploadRoutes,
    domain: 'tenant',
    comment: 'Features showcase config, PATCH tenant profile, logo/banner upload',
  },

  // ── Items CRUD (inline) ────────────────────────────────────────────────
  {
    path: '/',
    router: inlineItemsCrudRoutes,
    domain: 'inventory',
    comment: 'Items list, stats, get, create, update, delete, restore, purge, photo upload',
  },
"@

$registry = $registry -replace "(// .* Misc \(health, ping, routes listing, jobs\) .*)", "$entryBlock`n  `${1}"

Set-Content -Path $registryFile -Value $registry -Encoding UTF8 -NoNewline
Write-Host "  Updated routeRegistry.ts with 2 new entries"

# ─────────────────────────────────────────────────────────────────────────────
# 4. Replace lines 407-8171 in index.ts with mountFromRegistry(app)
#    Keep line 405 (app.use("/uploads"...)) and line 406 (blank)
#    Replace from line 407 to line 8171 with:
#      /* ------------------------------ route registry ------------------------------ */
#      import { mountFromRegistry } from './routes/routeRegistry';
#      mountFromRegistry(app);
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "Replacing route section in index.ts..."

$beforeRoutes = $lines[0..405]  # Lines 1-406 (0-indexed 0-405)
$afterRoutes = $lines[8171..($lines.Count - 1)]  # Lines 8172+ (0-indexed 8171+)

$replacement = @(
  '/* ------------------------------ route registry ------------------------------ */'
  "import { mountFromRegistry } from './routes/routeRegistry';"
  'mountFromRegistry(app);'
  ''
)

$newLines = @()
$newLines += $beforeRoutes
$newLines += $replacement
$newLines += $afterRoutes

Set-Content -Path $indexFile -Value $newLines -Encoding UTF8
Write-Host "  Replaced lines 407-8171 with mountFromRegistry(app)"
Write-Host "  New file has $($newLines.Count) lines (was $($lines.Count))"

Write-Host ""
Write-Host "Done! Next steps:"
Write-Host "  1. Run 'pnpm checkapi' to verify compilation"
Write-Host "  2. Clean up unused imports in index.ts"
Write-Host "  3. Test smoke routes"
