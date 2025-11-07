# Backend Implementation: Tier-Specific Feature Limits

## Current Gap

The backend tier middleware (`tier-access.ts`) currently:
- ✅ **Checks feature access** (has/doesn't have feature)
- ❌ **Does NOT enforce feature limits** (max products, rate limits, scenario restrictions)

## Problem

With the new Taste Test Strategy, we need **tier-specific limits**:

| Feature | Google-Only | Professional |
|---------|-------------|--------------|
| Max Products | 25 | 100 |
| Rate Limit | 7 days | 1 day |
| Scenarios | Grocery only | All 4 |

Currently, the backend allows **100 products for all tiers** that have `quick_start_wizard` access.

## Solution: Add TIER_FEATURE_LIMITS to Backend

### Step 1: Add Limits Configuration to `tier-access.ts`

```typescript
// apps/api/src/middleware/tier-access.ts

/**
 * Feature-specific limits per tier
 * Used to restrict "taste test" features for lower tiers
 */
export const TIER_FEATURE_LIMITS: Record<string, Record<string, any>> = {
  google_only: {
    quick_start_wizard: {
      maxProducts: 25,           // Limited to 25 products
      rateLimitDays: 7,          // Once per 7 days
      scenarios: ['grocery'],    // Only 1 scenario
      message: 'Google-Only tier includes a limited Quick Start to help you get started. Upgrade to Professional for unlimited access with up to 100 products and all scenarios.',
    },
  },
  starter: {
    quick_start_wizard: {
      maxProducts: 25,           // Starter also limited
      rateLimitDays: 7,
      scenarios: ['grocery'],
      message: 'Starter tier includes a limited Quick Start. Upgrade to Professional for full access.',
    },
  },
  professional: {
    quick_start_wizard: {
      maxProducts: 100,          // Full access
      rateLimitDays: 1,          // Daily usage
      scenarios: ['grocery', 'fashion', 'electronics', 'general'],
      message: null,
    },
  },
  enterprise: {
    quick_start_wizard: {
      maxProducts: 100,
      rateLimitDays: 1,
      scenarios: ['grocery', 'fashion', 'electronics', 'general'],
      message: null,
    },
  },
  chain_professional: {
    quick_start_wizard: {
      maxProducts: 100,
      rateLimitDays: 1,
      scenarios: ['grocery', 'fashion', 'electronics', 'general'],
      message: null,
    },
  },
  chain_enterprise: {
    quick_start_wizard: {
      maxProducts: 100,
      rateLimitDays: 1,
      scenarios: ['grocery', 'fashion', 'electronics', 'general'],
      message: null,
    },
  },
};

/**
 * Get feature limits for a specific tier and feature
 * Returns null if no limits apply (full access)
 */
export function getFeatureLimits(tier: string, feature: string): any | null {
  const tierLimits = TIER_FEATURE_LIMITS[tier];
  if (!tierLimits) return null;
  
  return tierLimits[feature] || null;
}
```

### Step 2: Update Quick Start Route to Enforce Limits

```typescript
// apps/api/src/routes/quick-start.ts

import { requireTierFeature, getFeatureLimits } from '../middleware/tier-access';

/**
 * Check rate limit for quick start (tier-aware)
 */
function checkRateLimit(tenantId: string, tier: string): { allowed: boolean; resetAt?: number; rateLimitDays?: number } {
  const now = Date.now();
  const key = `quick-start:${tenantId}`;
  const limit = rateLimitStore.get(key);

  // Get tier-specific rate limit
  const featureLimits = getFeatureLimits(tier, 'quick_start_wizard');
  const rateLimitDays = featureLimits?.rateLimitDays || 1; // Default to 1 day
  const rateLimitMs = rateLimitDays * 24 * 60 * 60 * 1000;

  if (limit && limit.resetAt > now) {
    return { 
      allowed: false, 
      resetAt: limit.resetAt,
      rateLimitDays,
    };
  }

  // Set new rate limit (tier-specific)
  const resetAt = now + rateLimitMs;
  rateLimitStore.set(key, { count: 1, resetAt });

  // Cleanup old entries
  for (const [k, v] of rateLimitStore.entries()) {
    if (v.resetAt <= now) {
      rateLimitStore.delete(k);
    }
  }

  return { allowed: true, rateLimitDays };
}

router.post('/tenants/:tenantId/quick-start', 
  authenticateToken, 
  requireTierFeature('quick_start_wizard'), 
  validateSKULimits, 
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      const userId = (req as any).user?.userId;

      // ... existing auth checks ...

      // Get tenant's tier
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { subscriptionTier: true },
      });

      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      const tier = tenant.subscriptionTier || 'trial';
      
      // Get tier-specific limits
      const featureLimits = getFeatureLimits(tier, 'quick_start_wizard');
      
      // Parse and validate request body
      const body = quickStartSchema.parse(req.body);
      
      // ENFORCE TIER-SPECIFIC PRODUCT LIMIT
      const maxProducts = featureLimits?.maxProducts || 100;
      if (body.productCount > maxProducts) {
        return res.status(400).json({
          error: 'product_limit_exceeded',
          message: featureLimits?.message || `Your tier allows up to ${maxProducts} products`,
          maxProducts,
          requestedProducts: body.productCount,
          tier,
          upgradeRequired: true,
          upgradeUrl: '/settings/subscription',
        });
      }
      
      // ENFORCE TIER-SPECIFIC SCENARIO RESTRICTION
      const allowedScenarios = featureLimits?.scenarios || ['grocery', 'fashion', 'electronics', 'general'];
      if (!allowedScenarios.includes(body.scenario)) {
        return res.status(400).json({
          error: 'scenario_not_available',
          message: featureLimits?.message || `This scenario is not available for your tier`,
          requestedScenario: body.scenario,
          allowedScenarios,
          tier,
          upgradeRequired: true,
          upgradeUrl: '/settings/subscription',
        });
      }
      
      // ENFORCE TIER-SPECIFIC RATE LIMIT
      const rateLimit = checkRateLimit(tenantId, tier);
      if (!rateLimit.allowed) {
        const hoursRemaining = Math.ceil((rateLimit.resetAt! - Date.now()) / (1000 * 60 * 60));
        return res.status(429).json({
          error: 'rate_limit_exceeded',
          message: `Quick Start can only be used once per ${rateLimit.rateLimitDays} days. Please try again in ${hoursRemaining} hours.`,
          resetAt: rateLimit.resetAt,
          rateLimitDays: rateLimit.rateLimitDays,
          tier,
          upgradeRequired: tier === 'google_only' || tier === 'starter',
          upgradeUrl: '/settings/subscription',
        });
      }

      // ... rest of the implementation ...
      
    } catch (error) {
      // ... error handling ...
    }
  }
);
```

### Step 3: Update Scenarios Endpoint (Tier-Aware)

```typescript
/**
 * GET /api/v1/tenants/:tenantId/quick-start/scenarios
 * Get available quick start scenarios (tier-aware)
 */
router.get('/tenants/:tenantId/scenarios', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Get tenant's tier
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscriptionTier: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tier = tenant.subscriptionTier || 'trial';
    const featureLimits = getFeatureLimits(tier, 'quick_start_wizard');
    const allowedScenarios = featureLimits?.scenarios || ['grocery', 'fashion', 'electronics', 'general'];
    
    // All scenarios
    const allScenarios = [
      { id: 'grocery', name: 'Grocery Store', description: 'Fresh produce, dairy, meat, and packaged goods' },
      { id: 'fashion', name: 'Fashion Retail', description: 'Clothing, accessories, and footwear' },
      { id: 'electronics', name: 'Electronics Store', description: 'Phones, computers, and tech accessories' },
      { id: 'general', name: 'General Retail', description: 'Mixed merchandise for general stores' },
    ];
    
    // Filter to allowed scenarios
    const scenarios = allScenarios
      .map(scenario => ({
        ...scenario,
        available: allowedScenarios.includes(scenario.id),
        locked: !allowedScenarios.includes(scenario.id),
      }));
    
    res.json({ 
      scenarios,
      tier,
      limits: featureLimits,
    });
  } catch (error: any) {
    console.error('[Quick Start] Error fetching scenarios:', error);
    res.status(500).json({ error: 'Failed to fetch scenarios', message: error.message });
  }
});
```

### Step 4: Add Eligibility Check Endpoint

```typescript
/**
 * GET /api/v1/tenants/:tenantId/quick-start/eligibility
 * Check if tenant can use Quick Start (with tier-specific info)
 */
router.get('/tenants/:tenantId/quick-start/eligibility', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const userId = (req as any).user?.userId;

    // Get tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { 
        id: true,
        subscriptionTier: true,
        subscriptionStatus: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tier = tenant.subscriptionTier || 'trial';
    
    // Check feature access
    const hasFeature = checkTierAccess(tier, 'quick_start_wizard');
    
    if (!hasFeature) {
      return res.json({
        eligible: false,
        reason: 'feature_not_available',
        message: 'Quick Start is not available for your tier',
        tier,
        upgradeRequired: true,
      });
    }
    
    // Get tier-specific limits
    const featureLimits = getFeatureLimits(tier, 'quick_start_wizard');
    
    // Check rate limit
    const rateLimit = checkRateLimit(tenantId, tier);
    
    // Count current products
    const productCount = await prisma.product.count({
      where: { tenantId },
    });
    
    // Get product limit from tier
    const productLimit = featureLimits?.maxProducts || 100;
    
    res.json({
      eligible: rateLimit.allowed && productCount < 500, // Overall limit
      productCount,
      productLimit,
      maxProducts: featureLimits?.maxProducts || 100,
      rateLimitDays: featureLimits?.rateLimitDays || 1,
      allowedScenarios: featureLimits?.scenarios || ['grocery', 'fashion', 'electronics', 'general'],
      rateLimitReached: !rateLimit.allowed,
      resetAt: rateLimit.resetAt,
      tier,
      limits: featureLimits,
      recommendation: productCount >= 500 
        ? 'You have reached the maximum product limit (500). Please delete some products to use Quick Start.'
        : !rateLimit.allowed
        ? `Quick Start can only be used once per ${rateLimit.rateLimitDays} days. Please try again later.`
        : 'You can use Quick Start now!',
    });
  } catch (error: any) {
    console.error('[Quick Start] Error checking eligibility:', error);
    res.status(500).json({ error: 'Failed to check eligibility', message: error.message });
  }
});
```

## Testing Checklist

### Google-Only Tier ($29/mo)
- [ ] Can access Quick Start (has feature)
- [ ] Limited to 25 products (enforced)
- [ ] Can only use Grocery scenario (enforced)
- [ ] Rate limited to once per 7 days (enforced)
- [ ] Gets upgrade prompt when hitting limits
- [ ] Eligibility endpoint returns correct limits

### Professional Tier ($499/mo)
- [ ] Can access Quick Start (has feature)
- [ ] Can generate up to 100 products (enforced)
- [ ] Can use all 4 scenarios (enforced)
- [ ] Rate limited to once per day (enforced)
- [ ] No upgrade prompts
- [ ] Eligibility endpoint returns correct limits

### Starter Tier ($49/mo)
- [ ] Cannot access Quick Start (no feature)
- [ ] Gets 403 error with upgrade info
- [ ] Redirected to upgrade page

## Security Considerations

1. **Rate Limit Storage**
   - Current: In-memory (lost on restart)
   - Production: Move to Redis for persistence
   - Add cleanup job for old entries

2. **Validation**
   - ✅ Validate product count against tier limits
   - ✅ Validate scenario against tier restrictions
   - ✅ Check rate limits before processing
   - ✅ Verify tenant ownership

3. **Error Messages**
   - ✅ Clear upgrade prompts
   - ✅ Show exact limits
   - ✅ Include pricing information
   - ✅ Link to subscription page

## Migration Path

1. **Phase 1: Add Limits (Non-Breaking)**
   - Add `TIER_FEATURE_LIMITS` to backend
   - Add `getFeatureLimits()` function
   - Keep existing behavior (no enforcement yet)

2. **Phase 2: Enforce Limits (Breaking)**
   - Update Quick Start route to enforce limits
   - Update scenarios endpoint to filter by tier
   - Update eligibility endpoint to return limits

3. **Phase 3: Frontend Updates**
   - Update Quick Start page to show limits
   - Add upgrade prompts when limits hit
   - Show "Limited" badges for restricted features

4. **Phase 4: Monitoring**
   - Track limit hits per tier
   - Monitor upgrade conversions
   - Adjust limits based on data

## Deployment Notes

- **Backend and Frontend must be deployed together**
- Backend changes are **backwards compatible** (won't break existing frontend)
- Frontend will show upgrade prompts once backend enforces limits
- Monitor error rates after deployment
- Have rollback plan ready

## Success Metrics

- Google-Only Quick Start usage rate
- Upgrade conversion rate after hitting limits
- Support ticket reduction
- User satisfaction scores
- Revenue impact from upgrades
