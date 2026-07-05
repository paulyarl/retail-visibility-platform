# BSaaS Bundle Implementation Plan — Customer Engagement Suite

**Date**: 2026-07-05  
**Bundle**: Customer Engagement Suite  
**Price**: $79/mo (14-day trial)  
**Components**: `chatbot_flexible` + `crm_flexible` + `faq_flexible`  
**Purpose**: Establish the pattern precedent for cross-domain bundle purchases in the BSaaS store.

**Pattern Precedent**: Directory Promotion's admin catalog (`/settings/admin/promotion-catalog`) is the first capability-aware automated catalog with admin control for level, duration, and price. This plan extends that pattern to the BSaaS store — making the feature catalog admin page the unified control panel for individual features, flexible toggles, feature bundles, and flexible bundles.

---

## Phase 0: Unified Admin Catalog (Pre-Bundle Foundation)

Before implementing bundle purchases, the admin catalog page must be upgraded to manage **all BSaaS product types** from a single interface. The existing `/settings/admin/bsaas-catalog` page handles individual features in `bsaas_catalog`. Phase 0 extends it with a bundle management tab and capability-awareness, establishing the standard pattern for all future BSaaS catalog types.

### Phase 0 Goals

1. **Unified admin page** — A tabbed interface at `/settings/admin/bsaas-catalog` with two tabs: "Features" (existing) and "Bundles" (new)
2. **Bundle CRUD** — Admin can create, edit, delete, and toggle bundles in `bsaas_bundles` + `bsaas_bundle_items`
3. **Capability-aware display** — Each feature/bundle row shows its capability type(s), making it clear which domain(s) it belongs to
4. **Admin service + API routes** — Backend CRUD for `bsaas_bundles` mirroring the existing `bsaas-catalog` admin routes
5. **Pattern standard** — The resulting admin page becomes the template for any future capability-aware catalog (promotions, featured placements, etc.)

### Phase 0 Step A: Database Migration (Bundles Table)

Same migration as Step 1 below (`085_bsaas_bundles.sql`) — creates `bsaas_bundles` + `bsaas_bundle_items` tables. Run this first so the admin CRUD has a table to manage.

### Phase 0 Step B: Prisma Schema

Same as Step 2 below — add `bsaas_bundles` + `bsaas_bundle_items` models to `schema.prisma`.

### Phase 0 Step C: Backend Admin Routes for Bundles

**File**: `apps/api/src/routes/admin/bsaas-bundles.ts` (NEW)

Mirrors the existing `admin/bsaas-catalog.ts` pattern:

```typescript
// GET    /api/admin/bsaas-bundles          — List all bundles (with items)
// POST   /api/admin/bsaas-bundles          — Create a bundle + items
// PUT    /api/admin/bsaas-bundles/:id      — Update bundle metadata + items
// DELETE /api/admin/bsaas-bundles/:id      — Delete a bundle (cascades items)
```

**Validation schemas**:

```typescript
const createBundleSchema = z.object({
  bundle_key: z.string().min(1),
  marketing_name: z.string().min(1),
  description: z.string().optional(),
  price_cents: z.number().int().positive(),
  billing_cycle: z.enum(['one_time', 'monthly', 'annual']).default('monthly'),
  trial_days: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  items: z.array(z.object({
    feature_key: z.string().min(1),
    sort_order: z.number().int().default(0),
  })).min(1),
});

const updateBundleSchema = z.object({
  marketing_name: z.string().optional(),
  description: z.string().optional(),
  price_cents: z.number().int().positive().optional(),
  billing_cycle: z.enum(['one_time', 'monthly', 'annual']).optional(),
  trial_days: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  items: z.array(z.object({
    feature_key: z.string().min(1),
    sort_order: z.number().int().default(0),
  })).optional(),
});
```

**Key route logic**:
- `POST` validates all `feature_key`s in `items` exist in `features_list` before creating
- `PUT` with `items` replaces all bundle items (delete + recreate) — atomic transaction
- `GET` includes `bsaas_bundle_items` ordered by `sort_order`
- All routes use `authenticateToken` + `requireAdmin` middleware
- Audit log entries: `bsaas_bundle.create`, `bsaas_bundle.update`, `bsaas_bundle.delete`

**Mount in** `apps/api/src/routes/mounts/admin-routes.ts`:
```typescript
import bsaasBundlesRouter from '../admin/bsaas-bundles';
router.use('/bsaas-bundles', bsaasBundlesRouter);
```

### Phase 0 Step D: Frontend Admin Service for Bundles

**File**: `apps/web/src/services/AdminBsaasBundleService.ts` (NEW)

Mirrors `AdminBsaasCatalogService.ts` pattern:

```typescript
export interface BsaasBundleEntry {
  id: string;
  bundle_key: string;
  marketing_name: string;
  description: string | null;
  price_cents: number;
  billing_cycle: string;
  trial_days: number;
  is_active: boolean;
  sort_order: number;
  items: Array<{ id: string; feature_key: string; sort_order: number }>;
  created_at: string;
  updated_at: string;
}

export interface BsaasBundleInput {
  bundle_key: string;
  marketing_name: string;
  description?: string;
  price_cents: number;
  billing_cycle?: string;
  trial_days?: number;
  is_active?: boolean;
  sort_order?: number;
  items: Array<{ feature_key: string; sort_order?: number }>;
}

class AdminBsaasBundleService extends AdminApiSingleton {
  // list(), create(), update(), remove() — same pattern as AdminBsaasCatalogService
  // Calls /api/admin/bsaas-bundles
}
export const adminBsaasBundleService = AdminBsaasBundleService.getInstance();
```

### Phase 0 Step E: Unified Admin Catalog Page

**File**: `apps/web/src/admin/components/BsaasCatalogManagement.tsx` (MODIFY)

Add a tabbed interface with two tabs:

1. **"Features" tab** (existing functionality, enhanced):
   - Existing `bsaas_catalog` CRUD table
   - **New**: Capability type column — shows which capability type each feature belongs to (via `capability_features_list` join)
   - **New**: Feature type badge — "Individual", "Flexible", "Level" (based on feature key suffix: `_flexible`, `_level_*`, or plain)
   - Existing: price, billing cycle, trial days, sort order, active toggle, edit, delete
   - Existing: Complimentary access grant button

2. **"Bundles" tab** (new):
   - Bundle CRUD table with columns: Bundle Key, Name, Components (feature keys), Price, Cycle, Trial, Sort, Active, Actions
   - Create/Edit modal with:
     - Bundle key (auto-generated from name, or manual)
     - Marketing name
     - Description
     - Price (in cents or dollars with auto-conversion)
     - Billing cycle (monthly/annual/one-time)
     - Trial days
     - Sort order
     - **Component picker** — multi-select from `features_list` keys, with search/filter, showing capability type per feature
     - Sort order per component
   - Active toggle (same pattern as features tab)
   - Delete with confirmation
   - Show component count and sum-of-individual-prices vs bundle price (discount %)

**Tab implementation**:

```tsx
// Add tab state to BsaasCatalogManagement
const [activeTab, setActiveTab] = useState<'features' | 'bundles'>('features');

// Tab switcher in the header
<div className="flex gap-1 border-b">
  <button
    onClick={() => setActiveTab('features')}
    className={`px-4 py-2 text-sm font-medium ${activeTab === 'features' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
  >
    Features ({entries.length})
  </button>
  <button
    onClick={() => setActiveTab('bundles')}
    className={`px-4 py-2 text-sm font-medium ${activeTab === 'bundles' ? 'border-b-2 border border-blue-500 text-blue-600' : 'text-gray-500'}`}
  >
    Bundles ({bundles.length})
  </button>
</div>

{activeTab === 'features' ? <FeaturesTab /> : <BundlesTab />}
```

**Capability-awareness enhancement for Features tab**:

Add a capability type column by fetching the `capability_features_list` join. Two approaches:
- **Option A (preferred)**: Backend admin route returns capability type per feature (join in `GET /api/admin/bsaas-catalog`)
- **Option B**: Frontend fetches `capability_features_list` separately and joins client-side

Recommended: Option A — add `capability_type` to the admin catalog GET response:

```typescript
// In admin/bsaas-catalog.ts GET route:
const entries = await prisma.bsaas_catalog.findMany({
  where,
  orderBy: { sort_order: 'asc' },
  include: {
    features_list: {
      select: {
        capability_features_list: {
          include: { capability_type_list: { select: { key: true } } }
        }
      }
    }
  }
});
```

**Feature type badge logic**:
```typescript
function getFeatureTypeBadge(featureKey: string): { label: string; color: string } {
  if (featureKey.endsWith('_flexible')) return { label: 'Flexible', color: 'bg-purple-100 text-purple-800' };
  if (featureKey.includes('_level_')) return { label: 'Level', color: 'bg-blue-100 text-blue-800' };
  if (featureKey.endsWith('_disabled')) return { label: 'Gate', color: 'bg-red-100 text-red-800' };
  if (featureKey.endsWith('_enabled')) return { label: 'Gate', color: 'bg-green-100 text-green-800' };
  return { label: 'Individual', color: 'bg-gray-100 text-gray-800' };
}
```

### Phase 0 Step F: Admin Page Wrapper

**File**: `apps/web/src/app/(platform)/settings/admin/bsaas-catalog/page.tsx` (MODIFY)

Add a proper page header with back link and description, matching the promotion-catalog page pattern:

```tsx
import BsaasCatalogManagement from '@/admin/components/BsaasCatalogManagement';

export default function SettingsAdminBsaasCatalogPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <a href="/settings/admin" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </a>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            BSaaS Catalog
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage purchasable features and bundles — pricing, availability, and composition
          </p>
        </div>
        <BsaasCatalogManagement />
      </div>
    </div>
  );
}
```

### Phase 0 Step G: Seed Customer Engagement Suite via Admin UI

Once Phase 0 is complete, the Customer Engagement Suite bundle can be created **through the admin UI** instead of via SQL migration seed. This is the key advantage — admins can create and manage bundles without touching the database.

However, the migration (`085_bsaas_bundles.sql`) should still include the seed INSERT as a fallback/default. The admin UI will show it as an existing bundle that can be edited.

### Phase 0 Testing Checklist

- [ ] Migration `085_bsaas_bundles.sql` runs without errors
- [ ] `npx prisma generate` succeeds with new models
- [ ] `GET /api/admin/bsaas-bundles` returns empty array initially, then seeded bundle
- [ ] `POST /api/admin/bsaas-bundles` creates a bundle with items
- [ ] `PUT /api/admin/bsaas-bundles/:id` updates bundle metadata and replaces items
- [ ] `DELETE /api/admin/bsaas-bundles/:id` deletes bundle + cascades items
- [ ] Admin page shows two tabs (Features, Bundles)
- [ ] Features tab shows capability type column + feature type badge
- [ ] Bundles tab shows seeded Customer Engagement Suite with 3 components
- [ ] Bundle create modal has component picker with searchable feature keys
- [ ] Bundle edit modal pre-fills existing items
- [ ] Active toggle works for both features and bundles
- [ ] `npx tsc --noEmit --project apps/api` passes
- [ ] `npx tsc --noEmit --project apps/web` passes

### Phase 0 Pattern Standardization

The resulting admin page establishes the **standard pattern** for all future capability-aware catalogs:

| Element | Pattern | Reusable For |
|---|---|---|
| Tabbed interface | Features + Bundles tabs | Any catalog with multiple product types |
| Capability type column | Join via `capability_features_list` | Any feature-based catalog |
| Feature type badge | Classify by key suffix (`_flexible`, `_level_*`, `_enabled`, `_disabled`) | Any capability-aware listing |
| Component picker | Multi-select from `features_list` with capability grouping | Any composite product (bundles, packs) |
| CRUD with audit | `authenticateToken` + `requireAdmin` + `audit()` | All admin routes |
| Admin service singleton | `AdminApiSingleton` extension with cache invalidation | All admin frontend services |

This pattern directly mirrors the promotion-catalog admin page (`PromotionCatalogClient.tsx`) which established the precedent for:
- Level-based plan management (basic/premium/featured)
- Duration + price control
- Active/inactive toggle
- Create/edit modal with auto-generated keys

The BSaaS catalog extends this with **bundle composition** (multi-feature products) and **capability-awareness** (showing which domain each product belongs to).

---

## Phase 1: Bundle Purchase Implementation

### Bundle Definition

| Field | Value |
|---|---|
| Bundle Key | `customer_engagement_suite` |
| Marketing Name | Customer Engagement Suite |
| Description | Unlock full Chatbot, CRM, and FAQ capabilities in one bundle. Get all AI bot skills, dynamic GPT responses, RAG knowledge base, complete CRM with tickets/inquiries/templates, and full FAQ management with chatbot KB integration. |
| Price | $7,900 cents/mo |
| Billing Cycle | monthly |
| Trial Days | 14 |
| Sort Order | 200 (after individual features, before other bundles) |

### Component Features

| Feature Key | Individual Price | Capability Type | Parent Gate |
|---|---|---|---|
| `chatbot_flexible` | $49/mo | `chatbot_options` | `chatbot_enabled` |
| `crm_flexible` | $39/mo | `crm_options` | `crm_enabled` |
| `faq_flexible` | $19/mo | `faq_options` | `faq_enabled` |
| **Sum** | **$107/mo** | | |
| **Bundle Price** | **$79/mo** (26% savings) | | |

### Engagement Prerequisite

The merchant's tier must already have ≥1 enabled feature in **all three** capability types (`chatbot_options`, `crm_options`, `faq_options`). If any domain is not engaged, the bundle is blocked with an upgrade prompt naming the missing domain(s).

---

## Implementation Steps

### Step 1: Database Migration (shared with Phase 0)

**File**: `database/migrations/085_bsaas_bundles.sql`

```sql
-- 085_bsaas_bundles.sql
-- Creates bsaas_bundles + bsaas_bundle_items tables and seeds the
-- Customer Engagement Suite as the first cross-domain bundle.

-- ───────────────────────────────────────────────────────────
-- 1. Create bsaas_bundles table
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bsaas_bundles (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_key      TEXT        NOT NULL UNIQUE,
  marketing_name  TEXT        NOT NULL,
  description     TEXT,
  price_cents     INTEGER     NOT NULL CHECK (price_cents > 0),
  billing_cycle   VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('one_time', 'monthly', 'annual')),
  trial_days      INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bsaas_bundles_active ON bsaas_bundles (is_active, sort_order);

-- ───────────────────────────────────────────────────────────
-- 2. Create bsaas_bundle_items table
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bsaas_bundle_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id       UUID        NOT NULL REFERENCES bsaas_bundles(id) ON DELETE CASCADE,
  feature_key     TEXT        NOT NULL,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bundle_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_bsaas_bundle_items_bundle ON bsaas_bundle_items (bundle_id);
CREATE INDEX IF NOT EXISTS idx_bsaas_bundle_items_feature ON bsaas_bundle_items (feature_key);

-- ───────────────────────────────────────────────────────────
-- 3. Seed Customer Engagement Suite bundle
-- ───────────────────────────────────────────────────────────
INSERT INTO bsaas_bundles (bundle_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order)
VALUES (
  'customer_engagement_suite',
  'Customer Engagement Suite',
  'Unlock full Chatbot, CRM, and FAQ capabilities in one bundle. Get all AI bot skills, dynamic GPT responses, RAG knowledge base, complete CRM with tickets/inquiries/templates, and full FAQ management with chatbot KB integration.',
  7900,
  'monthly',
  14,
  true,
  200
)
ON CONFLICT (bundle_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description    = EXCLUDED.description,
  price_cents    = EXCLUDED.price_cents,
  billing_cycle  = EXCLUDED.billing_cycle,
  trial_days     = EXCLUDED.trial_days,
  is_active      = EXCLUDED.is_active,
  sort_order     = EXCLUDED.sort_order,
  updated_at     = NOW();

-- Seed bundle items
INSERT INTO bsaas_bundle_items (bundle_id, feature_key, sort_order)
SELECT b.id, f.feature_key, f.sort_order
FROM (VALUES
  ('chatbot_flexible', 1),
  ('crm_flexible', 2),
  ('faq_flexible', 3)
) AS f(feature_key, sort_order)
JOIN bsaas_bundles b ON b.bundle_key = 'customer_engagement_suite'
ON CONFLICT (bundle_id, feature_key) DO NOTHING;

-- ───────────────────────────────────────────────────────────
-- 4. Also add the three flexible keys to bsaas_catalog
--    (so they can be purchased individually too)
-- ───────────────────────────────────────────────────────────
INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order)
VALUES
  ('chatbot_flexible', 'Chatbot — Full Access', 'Unlock all chatbot features: AI responses, dedicated engine, RAG knowledge base, all skills, custom widget themes, and external embed.', 4900, 'monthly', 14, true, 100),
  ('crm_flexible', 'CRM — Full Access', 'Unlock all CRM features: contact import/sync, dashboard analytics, message templates, attachments, ticket management, inquiries, and requests hub.', 3900, 'monthly', 14, true, 101),
  ('faq_flexible', 'FAQ — Full Access', 'Unlock all FAQ features: knowledge base, management hub, CSV import, drag-and-drop reorder, bot preview, gap report, and templates.', 1900, 'monthly', 14, true, 102)
ON CONFLICT (feature_key) DO UPDATE SET
  marketing_name = EXCLUDED.marketing_name,
  description    = EXCLUDED.description,
  price_cents    = EXCLUDED.price_cents,
  billing_cycle  = EXCLUDED.billing_cycle,
  trial_days     = EXCLUDED.trial_days,
  is_active      = EXCLUDED.is_active,
  sort_order     = EXCLUDED.sort_order,
  updated_at     = NOW();
```

### Step 2: Prisma Schema (shared with Phase 0)

**File**: `apps/api/prisma/schema.prisma`

Add two new models after `bsaas_catalog` (around line 431):

```prisma
model bsaas_bundles {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  bundle_key     String   @unique
  marketing_name String
  description    String?
  price_cents    Int
  billing_cycle  String   @default("monthly") @db.VarChar(20)
  trial_days     Int      @default(0)
  is_active      Boolean  @default(true)
  sort_order     Int      @default(0)
  created_at     DateTime @default(now()) @db.Timestamptz(6)
  updated_at     DateTime @default(now()) @db.Timestamptz(6)
  bsaas_bundle_items bsaas_bundle_items[]

  @@index([is_active, sort_order], map: "idx_bsaas_bundles_active")
}

model bsaas_bundle_items {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  bundle_id    String   @db.Uuid
  feature_key  String
  sort_order   Int      @default(0)
  created_at   DateTime @default(now()) @db.Timestamptz(6)
  bsaas_bundles bsaas_bundles @relation(fields: [bundle_id], references: [id], onDelete: Cascade)

  @@unique([bundle_id, feature_key])
  @@index([bundle_id], map: "idx_bsaas_bundle_items_bundle")
  @@index([feature_key], map: "idx_bsaas_bundle_items_feature")
}
```

### Step 3: Backend — Bundle Purchase Endpoint (Phase 1)

**File**: `apps/api/src/routes/bsaas-purchases.ts`

#### 3a. Add `checkBundleEngagement` helper

After `checkCapabilityEngagement` (around line 287), add:

```typescript
/**
 * Check capability engagement for all features in a bundle.
 * Returns { eligible: true } if the tenant's tier has ≥1 feature in EVERY
 * capability type represented by the bundle's component features.
 */
async function checkBundleEngagement(
  tenantId: string,
  featureKeys: string[]
): Promise<{ eligible: boolean; failedDomains: Array<{ capabilityKey: string; reason: string }> }> {
  const results = await Promise.all(
    featureKeys.map(fk => checkCapabilityEngagement(tenantId, fk))
  );
  const failedDomains = results
    .filter(r => !r.eligible && r.capabilityKey)
    .map(r => ({ capabilityKey: r.capabilityKey!, reason: r.reason! }));
  return { eligible: failedDomains.length === 0, failedDomains };
}
```

#### 3b. Add `GET /bundle-catalog` endpoint

After the `GET /feature-catalog` route (around line 459), add:

```typescript
// GET /api/subscription/bundle-catalog
router.get('/bundle-catalog', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID is required' });
    }

    const bundles = await prisma.bsaas_bundles.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
      include: { bsaas_bundle_items: { orderBy: { sort_order: 'asc' } } },
    });

    // Fetch tenant's current purchases
    const purchases = await prisma.tenant_feature_purchases.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: ['active', 'past_due', 'trial', 'suspended'] },
      },
      select: { feature_key: true, status: true, source: true },
    });
    const purchaseKeys = new Set(purchases.map(p => p.feature_key));

    const bundleData = await Promise.all(
      bundles.map(async (bundle) => {
        const featureKeys = bundle.bsaas_bundle_items.map(i => i.feature_key);
        const engagement = await checkBundleEngagement(tenantId, featureKeys);

        // Check if all components are already active
        const allActive = featureKeys.every(fk => purchaseKeys.has(fk));

        // Check tier status for each component
        const tierStatuses = await Promise.all(
          featureKeys.map(fk => checkTierFeatureStatus(tenantId, fk))
        );
        const allInTier = tierStatuses.every(ts => ts.inTier);

        return {
          bundleKey: bundle.bundle_key,
          name: bundle.marketing_name,
          description: bundle.description || '',
          priceCents: bundle.price_cents,
          billingCycle: bundle.billing_cycle as 'one_time' | 'monthly' | 'annual',
          trialDays: bundle.trial_days,
          items: featureKeys.map((fk, i) => ({
            featureKey: fk,
            name: bundle.bsaas_bundle_items[i]?.feature_key || fk,
            inTier: tierStatuses[i].inTier,
            alreadyPurchased: purchaseKeys.has(fk),
          })),
          tierEligible: engagement.eligible,
          ineligibleReason: engagement.eligible
            ? null
            : engagement.failedDomains.map(d =>
                d.reason
              ).join(' '),
          ineligibleDomains: engagement.failedDomains.map(d => d.capabilityKey),
          allActive,
          allInTier,
        };
      })
    );

    res.json({ success: true, data: bundleData });
  } catch (error: any) {
    logger.error('[BSaaS] Error fetching bundle catalog:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch bundle catalog' });
  }
});
```

#### 3c. Add `POST /bundle-purchase` endpoint

After the `POST /feature-purchase` route (around line 873), add:

```typescript
// ====================
// Purchase a Bundle
// ====================

const bundlePurchaseSchema = z.object({
  bundleKey: z.string().min(1),
  paymentMethodId: z.string().optional(),
  promotionCode: z.string().optional(),
  tenantId: z.string().optional(),
});

// POST /api/subscription/bundle-purchase
router.post('/bundle-purchase', async (req: Request, res: Response) => {
  try {
    const validation = bundlePurchaseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid request', details: validation.error.issues });
    }

    const tenantId = validation.data.tenantId || (req as any).user?.tenantId || req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID is required' });
    }

    const { bundleKey, paymentMethodId, promotionCode } = validation.data;

    // 1. Verify bundle exists and is active
    const bundle = await prisma.bsaas_bundles.findUnique({
      where: { bundle_key: bundleKey },
      include: { bsaas_bundle_items: { orderBy: { sort_order: 'asc' } } },
    });
    if (!bundle || !bundle.is_active) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Bundle not found' });
    }

    const featureKeys = bundle.bsaas_bundle_items.map(i => i.feature_key);
    const priceCents = bundle.price_cents;
    const billingCycle = bundle.billing_cycle;
    const trialDays = bundle.trial_days || 0;

    // 2. Check for existing active purchases of ALL components
    const existingPurchases = await prisma.tenant_feature_purchases.findMany({
      where: {
        tenant_id: tenantId,
        feature_key: { in: featureKeys },
        status: { in: ['active', 'past_due', 'trial'] },
      },
    });
    if (existingPurchases.length === featureKeys.length) {
      return res.status(409).json({ success: false, error: 'already_active', message: 'All components of this bundle are already active for your tenant' });
    }

    // 3. Check capability engagement for ALL components
    const engagement = await checkBundleEngagement(tenantId, featureKeys);
    if (!engagement.eligible) {
      const reasons = engagement.failedDomains.map(d => d.reason).join(' ');
      return res.status(403).json({
        success: false,
        error: 'upgrade_required',
        message: reasons || 'Your current plan does not support purchasing this bundle. Please upgrade your plan.',
        failedDomains: engagement.failedDomains.map(d => d.capabilityKey),
      });
    }

    // 4. Trial branch
    if (trialDays > 0 && billingCycle !== 'one_time') {
      const trialExpiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

      // Create trial purchase for each component feature
      const purchases = await Promise.all(
        featureKeys.map(fk =>
          prisma.tenant_feature_purchases.upsert({
            where: { tenant_id_feature_key: { tenant_id: tenantId, feature_key: fk } },
            update: {
              source: 'bsaas_bundle',
              status: 'trial',
              expires_at: trialExpiresAt,
              metadata: {
                bundle_key: bundleKey,
                bundle_name: bundle.marketing_name,
                price_cents: priceCents,
                billing_cycle: billingCycle,
                trial_days: trialDays,
                trial_started_at: new Date().toISOString(),
                payment_method_id: paymentMethodId || null,
              },
              updated_at: new Date(),
            },
            create: {
              tenant_id: tenantId,
              feature_key: fk,
              source: 'bsaas_bundle',
              status: 'trial',
              expires_at: trialExpiresAt,
              metadata: {
                bundle_key: bundleKey,
                bundle_name: bundle.marketing_name,
                price_cents: priceCents,
                billing_cycle: billingCycle,
                trial_days: trialDays,
                trial_started_at: new Date().toISOString(),
                payment_method_id: paymentMethodId || null,
              },
            },
          })
        )
      );

      // Ensure companion purchases for each component's parent gate
      for (const fk of featureKeys) {
        const tierStatus = await checkTierFeatureStatus(tenantId, fk);
        await ensureCompanionPurchase(tenantId, tierStatus.capabilityKey, fk);
      }

      invalidateEffectiveCapabilities(tenantId);

      await audit({
        tenantId,
        actor: (req as any).user?.id || null,
        action: 'bundle_purchase.trial_start',
        payload: {
          entity_type: 'other',
          bundle_key: bundleKey,
          bundle_name: bundle.marketing_name,
          feature_keys: featureKeys,
          trial_days: trialDays,
          expires_at: trialExpiresAt.toISOString(),
        },
      });

      return res.json({
        success: true,
        data: {
          bundle_key: bundleKey,
          status: 'trial',
          price_cents: priceCents,
          billing_cycle: billingCycle,
          trial_days: trialDays,
          expires_at: trialExpiresAt,
          purchase_ids: purchases.map(p => p.id),
        },
      });
    }

    // 5. Normal purchase: charge via Stripe
    if (!paymentMethodId) {
      return res.status(400).json({ success: false, error: 'payment_required', message: 'Payment method is required for non-trial purchases' });
    }

    const billingService = getSubscriptionBillingService();
    const chargeResult = await billingService.chargePaymentMethod(
      tenantId,
      paymentMethodId,
      priceCents,
      `BSaaS Bundle: ${bundle.marketing_name}`
    );

    if (!chargeResult.success) {
      return res.status(402).json({ success: false, error: 'payment_failed', message: chargeResult.error || 'Payment failed' });
    }

    // 6. Create purchase records for each component
    const expiresAt = billingCycle === 'monthly'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : billingCycle === 'annual'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        : null;

    const purchases = await Promise.all(
      featureKeys.map(fk =>
        prisma.tenant_feature_purchases.upsert({
          where: { tenant_id_feature_key: { tenant_id: tenantId, feature_key: fk } },
          update: {
            source: 'bsaas_bundle',
            status: 'active',
            expires_at: expiresAt,
            metadata: {
              bundle_key: bundleKey,
              bundle_name: bundle.marketing_name,
              price_cents: priceCents,
              billing_cycle: billingCycle,
              transaction_id: chargeResult.transactionId,
              payment_method_id: paymentMethodId,
              purchased_at: new Date().toISOString(),
            },
            updated_at: new Date(),
          },
          create: {
            tenant_id: tenantId,
            feature_key: fk,
            source: 'bsaas_bundle',
            status: 'active',
            expires_at: expiresAt,
            metadata: {
              bundle_key: bundleKey,
              bundle_name: bundle.marketing_name,
              price_cents: priceCents,
              billing_cycle: billingCycle,
              transaction_id: chargeResult.transactionId,
              payment_method_id: paymentMethodId,
              purchased_at: new Date().toISOString(),
            },
          },
        })
      )
    );

    // 7. Ensure companion purchases for each component's parent gate
    for (const fk of featureKeys) {
      const tierStatus = await checkTierFeatureStatus(tenantId, fk);
      await ensureCompanionPurchase(tenantId, tierStatus.capabilityKey, fk);
    }

    // 8. Invalidate capability cache
    invalidateEffectiveCapabilities(tenantId);

    // 9. Audit log
    await audit({
      tenantId,
      actor: (req as any).user?.id || null,
      action: 'bundle_purchase.create',
      payload: {
        entity_type: 'other',
        bundle_key: bundleKey,
        bundle_name: bundle.marketing_name,
        feature_keys: featureKeys,
        price_cents: priceCents,
        billing_cycle: billingCycle,
        transaction_id: chargeResult.transactionId,
        purchase_ids: purchases.map(p => p.id),
      },
    });

    // 10. Send notification
    const notificationService = getBillingNotificationService();
    notificationService.sendNotification({
      tenantId,
      type: 'bsaas_purchase_success',
      amount: priceCents,
      billingCycle: billingCycle as 'monthly' | 'annual',
      metadata: { bundleKey, bundleName: bundle.marketing_name, featureKeys },
    }).catch(err => console.error('[BSaaS] Failed to send bundle notification:', err));

    res.json({
      success: true,
      data: {
        bundle_key: bundleKey,
        status: 'active',
        price_cents: priceCents,
        billing_cycle: billingCycle,
        transaction_id: chargeResult.transactionId,
        expires_at: expiresAt,
        purchase_ids: purchases.map(p => p.id),
      },
    });
  } catch (error: any) {
    console.error('[BSaaS] Error purchasing bundle:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to purchase bundle' });
  }
});
```

### Step 4: Frontend Service

**File**: `apps/web/src/services/BsaasPurchaseService.ts`

Add types and methods:

```typescript
export interface BsaasBundleItem {
  featureKey: string;
  name: string;
  inTier: boolean;
  alreadyPurchased: boolean;
}

export interface BsaasBundleCatalogItem {
  bundleKey: string;
  name: string;
  description: string;
  priceCents: number;
  billingCycle: 'one_time' | 'monthly' | 'annual';
  trialDays: number;
  items: BsaasBundleItem[];
  tierEligible: boolean;
  ineligibleReason: string | null;
  ineligibleDomains: string[];
  allActive: boolean;
  allInTier: boolean;
}

export interface BsaasBundlePurchaseResult {
  success: boolean;
  data?: {
    bundle_key: string;
    status: string;
    price_cents: number;
    billing_cycle: string;
    expires_at: string | null;
    purchase_ids: string[];
  };
  error?: string;
  message?: string;
}
```

Add methods to `BsaasPurchaseService` class:

```typescript
async getBundleCatalog(): Promise<BsaasBundleCatalogItem[]> {
  const response = await this.makeDefaultRequest<BsaasBundleCatalogItem[]>(
    '/api/subscription/bundle-catalog',
    { method: 'GET' },
    'bsaas-bundle-catalog'
  );
  if (!response.success) throw new Error('Failed to fetch bundle catalog');
  const data = response.data;
  const actualData = Array.isArray(data) ? data : (data as any)?.data;
  return Array.isArray(actualData) ? actualData : [];
}

async purchaseBundle(
  bundleKey: string,
  paymentMethodId: string,
  promotionCode?: string
): Promise<BsaasBundlePurchaseResult> {
  const response = await this.makeDefaultRequest<BsaasBundlePurchaseResult>(
    '/api/subscription/bundle-purchase',
    {
      method: 'POST',
      body: JSON.stringify({ bundleKey, paymentMethodId, ...(promotionCode ? { promotionCode } : {}) }),
    },
    'bsaas-bundle-purchase'
  );
  if (!response.success) {
    const errorData = response.error as any;
    return {
      success: false,
      error: typeof errorData === 'string' ? errorData : errorData?.error || 'purchase_failed',
      message: typeof errorData === 'string' ? errorData : errorData?.message || 'Failed to purchase bundle',
    };
  }
  const innerData = (response.data as any)?.data || response.data;
  return { success: true, data: innerData };
}
```

### Step 5: Frontend UI

**File**: `apps/web/src/app/(platform)/settings/feature-store/page.tsx`

Add a "Bundles" section above the individual features grid:

1. Fetch `getBundleCatalog()` alongside `getFeatureCatalog()`
2. Render bundle cards with:
   - Bundle name + "Bundle" badge
   - Description
   - Component list with checkmarks for already-purchased/in-tier items
   - Price with "Save 26%" badge
   - Locked state if `tierEligible === false` (same pattern as individual features)
   - Purchase button → confirmation modal → `purchaseBundle()`
   - Trial badge if `trialDays > 0`
3. Filter out bundles where `allActive === true` (all components already owned)

### Step 6: Renewal Job

**File**: `apps/api/src/jobs/bsaas-renewal.ts`

The existing renewal job already re-charges `tenant_feature_purchases` where `status='active'` and `expires_at < NOW()`. Since bundle purchases create individual `tenant_feature_purchases` rows with `source: 'bsaas_bundle'`, the renewal job will re-charge each component individually.

**Problem**: This would charge 3 separate Stripe charges instead of 1 bundle charge.

**Fix**: Update the renewal job to group purchases by `metadata.bundle_key` and charge once per bundle:

```typescript
// Group expiring purchases by bundle_key
const bundleGroups = new Map<string, typeof expiring>();
for (const p of expiring) {
  const bundleKey = (p.metadata as any)?.bundle_key;
  if (bundleKey) {
    if (!bundleGroups.has(bundleKey)) bundleGroups.set(bundleKey, []);
    bundleGroups.get(bundleKey)!.push(p);
  }
}

// Charge once per bundle, then renew all components
for (const [bundleKey, purchases] of bundleGroups) {
  const bundlePrice = (purchases[0].metadata as any).price_cents;
  const chargeResult = await billingService.chargePaymentMethod(
    tenantId, paymentMethodId, bundlePrice, `BSaaS Bundle renewal: ${bundleKey}`
  );
  if (chargeResult.success) {
    await Promise.all(purchases.map(p => renewPurchase(p)));
  }
}

// Charge individual (non-bundle) purchases as before
for (const p of individualExpiring) { /* existing logic */ }
```

### Step 7: Cancellation

**File**: `apps/api/src/routes/bsaas-purchases.ts`

Update the existing `POST /feature-purchase/:id/cancel` endpoint to handle bundle-sourced purchases:

- When cancelling a `bsaas_bundle` purchase, check `metadata.bundle_key`
- Find all other purchases with the same `bundle_key` for the tenant
- Cancel all of them (bundle = all-or-nothing)
- Call `maybeCancelCompanionPurchase` for each component
- `invalidateEffectiveCapabilities` once after all cancellations

### Step 8: Phase 1 Testing Checklist

- [ ] Migration `085_bsaas_bundles.sql` runs without errors
- [ ] `npx prisma generate` succeeds with new models
- [ ] `GET /api/subscription/bundle-catalog` returns the Customer Engagement Suite
- [ ] `GET /api/subscription/bundle-catalog` returns `tierEligible: false` for tenants not engaged in all 3 domains
- [ ] `POST /api/subscription/bundle-purchase` with trial creates 3 `tenant_feature_purchases` rows with `source: 'bsaas_bundle'`
- [ ] `POST /api/subscription/bundle-purchase` with payment creates 3 active purchases + 3 companion purchases
- [ ] `invalidateEffectiveCapabilities` is called once after bundle purchase
- [ ] `EffectiveCapabilityResolver` merges all 3 flexible keys → all chatbot/CRM/FAQ sub-features unlocked
- [ ] Cancellation of one bundle component cancels all components
- [ ] Renewal job charges once per bundle (not 3 separate charges)
- [ ] Frontend shows bundle card with "Save 26%" badge and component list
- [ ] Frontend shows locked state for ineligible tenants
- [ ] `npx tsc --noEmit --project apps/api` passes
- [ ] `npx tsc --noEmit --project apps/web` passes

### Step 9: Skill Doc Update

**File**: `.devin/skills/bsaas-purchase-flow.md`

Add a "Bundle Purchase Flow" section documenting:
- `bsaas_bundles` + `bsaas_bundle_items` schema
- `checkBundleEngagement()` — checks all component domains
- `POST /bundle-purchase` — single charge, multiple `tenant_feature_purchases` rows
- Renewal grouping by `metadata.bundle_key`
- Cancellation cascades to all components
- `source: 'bsaas_bundle'` distinguishes bundle purchases from individual

---

## Architecture Decisions

### Why `source: 'bsaas_bundle'` instead of a separate table?

Using `tenant_feature_purchases` with `source: 'bsaas_bundle'` and `metadata.bundle_key` means:
- **No resolver changes** — `EffectiveCapabilityResolver` already reads `tenant_feature_purchases` regardless of source
- **No companion purchase changes** — `ensureCompanionPurchase` works per feature key
- **Existing cancellation/expiration logic works** — just needs the cascade for bundle_key grouping
- **Audit trail** — each component has its own purchase record with full metadata

### Why charge once instead of per-component?

- **Stripe fees** — 3 charges = 3x transaction fees
- **Atomicity** — if one charge fails, the merchant gets partial bundle
- **Simplicity** — one charge, one transaction ID, one receipt

### Why not use `bsaas_catalog` for bundles?

Bundles are a different product type — they have multiple feature keys, not one. A separate `bsaas_bundles` table keeps the schema clean and allows bundles to have their own metadata (component list, bundle-specific pricing) without overloading `bsaas_catalog`.

---

## Future Bundles (After Pattern Established)

Once the Customer Engagement Suite is live, adding new bundles requires only:
1. `INSERT INTO bsaas_bundles` + `INSERT INTO bsaas_bundle_items`
2. No code changes (the endpoints are generic)
3. Frontend automatically renders new bundles from the catalog API

The next bundles to add (from the audit):
1. Commerce Power Pack — $69/mo
2. Operations Bundle — $49/mo
3. Growth Bundle — $39/mo
4. Everything Pack — $299/mo
