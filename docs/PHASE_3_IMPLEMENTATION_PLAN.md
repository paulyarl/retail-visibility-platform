# Phase 3: Database-Driven Feature Overrides - Implementation Plan

## Overview

Phase 3 adds the ability to **override tier-based feature access** for specific tenants, enabling custom deals, beta testing, and support exceptions without changing subscription tiers.

## Use Cases

### 1. Custom Deals 🎁
```
Scenario: Close a deal with a Starter customer
Action: Grant them 'product_scanning' (normally Professional)
Result: They get scanning without upgrading to $499/mo
Benefit: Win the deal, upsell later
```

### 2. Beta Testing 🧪
```
Scenario: Test new 'ai_product_descriptions' feature
Action: Grant to 10 selected tenants across all tiers
Result: Get feedback before general release
Benefit: Validate feature with real users
```

### 3. Partner Agreements 🤝
```
Scenario: Strategic partner gets custom feature set
Action: Grant Professional features at Starter price
Result: Custom pricing with full feature access
Benefit: Flexible business relationships
```

### 4. Support Exceptions 🆘
```
Scenario: Customer has billing issue, needs temporary access
Action: Grant features with 7-day expiration
Result: They can work while billing resolves
Benefit: Better customer experience
```

---

## Database Schema

### New Model: `TenantFeatureOverride`

```prisma
model TenantFeatureOverride {
  id          String    @id @default(cuid())
  tenantId    String    @map("tenant_id")
  feature     String    // e.g., 'quick_start_wizard', 'product_scanning'
  granted     Boolean   @default(true) // true = grant, false = revoke
  reason      String?   // e.g., 'Beta tester', 'Custom deal'
  expiresAt   DateTime? @map("expires_at") // Optional expiration
  grantedBy   String    @map("granted_by") // User ID who created override
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, feature])
  @@index([tenantId])
  @@index([feature])
  @@index([expiresAt])
  @@map("tenant_feature_overrides")
}
```

### Fields Explained

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `feature` | String | Feature to override | `'product_scanning'` |
| `granted` | Boolean | Grant (true) or revoke (false) | `true` |
| `reason` | String? | Why override was created | `'Beta tester for AI features'` |
| `expiresAt` | DateTime? | When override expires | `2024-12-31T23:59:59Z` |
| `grantedBy` | String | Admin who created it | `user_abc123` |

---

## Backend Implementation

### Step 1: Update Tier Access Middleware

```typescript
// apps/api/src/middleware/tier-access.ts

/**
 * Check if a tenant has access to a feature
 * Now includes override checking
 */
export async function checkTierAccessWithOverrides(
  tenantId: string,
  feature: string
): Promise<{ hasAccess: boolean; source: 'tier' | 'override' | 'none' }> {
  // 1. Get tenant's tier
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { 
      subscriptionTier: true,
      featureOverrides: {
        where: {
          feature,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      }
    },
  });

  if (!tenant) {
    return { hasAccess: false, source: 'none' };
  }

  // 2. Check for active override
  const override = tenant.featureOverrides[0];
  if (override) {
    return { 
      hasAccess: override.granted, 
      source: 'override' 
    };
  }

  // 3. Fall back to tier-based access
  const tier = tenant.subscriptionTier || 'trial';
  const tierAccess = checkTierAccess(tier, feature);
  
  return { 
    hasAccess: tierAccess, 
    source: tierAccess ? 'tier' : 'none' 
  };
}

/**
 * Middleware to require a feature (with override support)
 */
export function requireTierFeatureWithOverrides(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
      
      if (!tenantId) {
        return res.status(400).json({
          error: 'tenant_id_required',
          message: 'Tenant ID is required for feature access check',
        });
      }

      const access = await checkTierAccessWithOverrides(String(tenantId), feature);
      
      if (!access.hasAccess) {
        // ... return 403 with upgrade info ...
      }

      // Add access info to request for logging
      (req as any).featureAccess = {
        feature,
        source: access.source,
      };

      next();
    } catch (error) {
      console.error('[requireTierFeatureWithOverrides] Error:', error);
      return res.status(500).json({
        error: 'feature_check_failed',
        message: 'Failed to check feature access',
      });
    }
  };
}
```

### Step 2: Create Override Management API

```typescript
// apps/api/src/routes/admin/feature-overrides.ts

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';
import { requirePlatformAdmin } from '../../middleware/platform-admin';

const router = Router();

// Schema for creating/updating overrides
const overrideSchema = z.object({
  tenantId: z.string(),
  feature: z.string(),
  granted: z.boolean(),
  reason: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

/**
 * GET /api/v1/admin/feature-overrides
 * List all feature overrides
 */
router.get('/', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    const { tenantId, feature, active } = req.query;

    const where: any = {};
    
    if (tenantId) where.tenantId = String(tenantId);
    if (feature) where.feature = String(feature);
    if (active === 'true') {
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ];
    }

    const overrides = await prisma.tenantFeatureOverride.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ overrides });
  } catch (error: any) {
    console.error('[Feature Overrides] List error:', error);
    res.status(500).json({ error: 'Failed to list overrides', message: error.message });
  }
});

/**
 * POST /api/v1/admin/feature-overrides
 * Create a new feature override
 */
router.post('/', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const body = overrideSchema.parse(req.body);

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: body.tenantId },
      select: { id: true, name: true, subscriptionTier: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Create or update override
    const override = await prisma.tenantFeatureOverride.upsert({
      where: {
        tenantId_feature: {
          tenantId: body.tenantId,
          feature: body.feature,
        }
      },
      create: {
        tenantId: body.tenantId,
        feature: body.feature,
        granted: body.granted,
        reason: body.reason,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        grantedBy: userId,
      },
      update: {
        granted: body.granted,
        reason: body.reason,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        grantedBy: userId,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
          }
        }
      }
    });

    res.json({ override });
  } catch (error: any) {
    console.error('[Feature Overrides] Create error:', error);
    res.status(500).json({ error: 'Failed to create override', message: error.message });
  }
});

/**
 * DELETE /api/v1/admin/feature-overrides/:id
 * Delete a feature override
 */
router.delete('/:id', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.tenantFeatureOverride.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Feature Overrides] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete override', message: error.message });
  }
});

export default router;
```

### Step 3: Add Cleanup Job for Expired Overrides

```typescript
// apps/api/src/jobs/cleanup-expired-overrides.ts

import { prisma } from '../prisma';

/**
 * Cleanup expired feature overrides
 * Run this daily via cron
 */
export async function cleanupExpiredOverrides() {
  try {
    const result = await prisma.tenantFeatureOverride.deleteMany({
      where: {
        expiresAt: {
          lte: new Date(),
        }
      }
    });

    console.log(`[Cleanup] Removed ${result.count} expired feature overrides`);
    return result.count;
  } catch (error) {
    console.error('[Cleanup] Error removing expired overrides:', error);
    throw error;
  }
}

// Run daily at 2 AM
if (process.env.NODE_ENV === 'production') {
  setInterval(cleanupExpiredOverrides, 24 * 60 * 60 * 1000);
}
```

---

## Frontend Implementation

### Step 1: Update `useTierAccess` Hook

```typescript
// apps/web/src/lib/tiers/useTierAccess.ts

export interface TierAccessResult {
  tier: string | null;
  tierDisplay: string;
  tierPrice: number;
  hasFeature: (feature: string) => boolean;
  getFeatures: () => string[];
  requiresUpgrade: (feature: string) => UpgradeInfo;
  hasAllFeatures: (features: string[]) => boolean;
  hasAnyFeature: (features: string[]) => boolean;
  overrides?: FeatureOverride[]; // NEW: List of active overrides
  isOverridden: (feature: string) => boolean; // NEW: Check if feature is overridden
}

export interface FeatureOverride {
  feature: string;
  granted: boolean;
  reason?: string;
  expiresAt?: string;
  source: 'override';
}

export function useTierAccess(
  tier: string | null | undefined,
  tenantId?: string
): TierAccessResult {
  const [overrides, setOverrides] = useState<FeatureOverride[]>([]);

  // Fetch overrides if tenantId provided
  useEffect(() => {
    if (tenantId) {
      fetchOverrides(tenantId);
    }
  }, [tenantId]);

  const fetchOverrides = async (id: string) => {
    try {
      const res = await fetch(`/api/tenants/${id}/feature-overrides`);
      if (res.ok) {
        const data = await res.json();
        setOverrides(data.overrides || []);
      }
    } catch (error) {
      console.error('Failed to fetch feature overrides:', error);
    }
  };

  const isOverridden = (feature: string): boolean => {
    return overrides.some(o => o.feature === feature && o.granted);
  };

  const hasFeature = (feature: string): boolean => {
    // Check overrides first
    const override = overrides.find(o => o.feature === feature);
    if (override) {
      return override.granted;
    }

    // Fall back to tier-based check
    return checkTierFeature(tier || 'trial', feature);
  };

  // ... rest of implementation ...

  return {
    tier,
    tierDisplay,
    tierPrice,
    hasFeature,
    getFeatures,
    requiresUpgrade,
    hasAllFeatures,
    hasAnyFeature,
    overrides,
    isOverridden,
  };
}
```

### Step 2: Create Admin UI Component

```typescript
// apps/web/src/app/(platform)/settings/admin/feature-overrides/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useAccessControl } from '@/lib/auth/useAccessControl';

export default function FeatureOverridesPage() {
  const { user, isPlatformAdmin } = useAccessControl(null);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchOverrides();
    }
  }, [isPlatformAdmin]);

  const fetchOverrides = async () => {
    try {
      const res = await fetch('/api/admin/feature-overrides');
      const data = await res.json();
      setOverrides(data.overrides);
    } catch (error) {
      console.error('Failed to fetch overrides:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isPlatformAdmin) {
    return <div>Access denied</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Feature Overrides</h1>
      
      {/* Create Override Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Create Override</h2>
        {/* Form fields */}
      </div>

      {/* Overrides List */}
      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4">Tenant</th>
              <th className="text-left p-4">Feature</th>
              <th className="text-left p-4">Granted</th>
              <th className="text-left p-4">Reason</th>
              <th className="text-left p-4">Expires</th>
              <th className="text-left p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {overrides.map((override: any) => (
              <tr key={override.id} className="border-b">
                <td className="p-4">{override.tenant.name}</td>
                <td className="p-4">{override.feature}</td>
                <td className="p-4">
                  {override.granted ? '✅ Yes' : '❌ No'}
                </td>
                <td className="p-4">{override.reason || '-'}</td>
                <td className="p-4">
                  {override.expiresAt 
                    ? new Date(override.expiresAt).toLocaleDateString()
                    : 'Never'}
                </td>
                <td className="p-4">
                  <button onClick={() => deleteOverride(override.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## Migration Steps

### 1. Create Database Migration

```bash
cd apps/api
npx prisma migrate dev --name add_tenant_feature_overrides
```

### 2. Update Backend

- [ ] Add `checkTierAccessWithOverrides()` to `tier-access.ts`
- [ ] Create `/api/v1/admin/feature-overrides` routes
- [ ] Add cleanup job for expired overrides
- [ ] Update existing `requireTierFeature` to use overrides

### 3. Update Frontend

- [ ] Update `useTierAccess` hook to fetch overrides
- [ ] Create admin UI for managing overrides
- [ ] Add override indicators to feature lists
- [ ] Update documentation

### 4. Testing

- [ ] Test override grants access
- [ ] Test override revokes access
- [ ] Test expiration works
- [ ] Test cleanup job
- [ ] Test admin UI

---

## Security Considerations

1. **Admin Only**
   - Only Platform Admins can create/delete overrides
   - Audit log all override changes
   - Require reason for all overrides

2. **Expiration**
   - Always set expiration for temporary access
   - Cleanup job runs daily
   - Notify before expiration

3. **Validation**
   - Validate feature names against known features
   - Prevent circular dependencies
   - Check tenant exists

---

## Monitoring & Alerts

### Metrics to Track

1. **Override Usage**
   - Number of active overrides
   - Most overridden features
   - Overrides by reason type

2. **Business Impact**
   - Revenue from custom deals
   - Beta tester feedback
   - Support exception frequency

3. **Expiration**
   - Overrides expiring soon
   - Expired overrides cleaned up
   - Manual renewals needed

---

## Next Steps

After Phase 3 is complete:
- **Phase 4**: Admin UI polish and bulk operations
- **Phase 5**: Automated override suggestions based on usage
- **Phase 6**: Self-service upgrade paths with override previews

---

## Success Criteria

Phase 3 is successful when:
- ✅ Overrides can be created via admin UI
- ✅ Overrides correctly grant/revoke access
- ✅ Expiration works automatically
- ✅ Audit trail is complete
- ✅ No security vulnerabilities
- ✅ Documentation is comprehensive
