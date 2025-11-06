# Tier-Based Feature Access Control
**Date**: November 6, 2024  
**Priority**: HIGH - Security & Revenue Protection  
**Status**: Analysis & Implementation Plan

---

## 🚨 CRITICAL ISSUE

**Current State**: All tiers can access all features!
- Starter ($49) can use Quick Start Wizard
- Starter ($49) can use Product Scanning
- Starter ($49) can use GBP Integration
- **No tier-based access control enforced**

**Risk**:
- Revenue leakage (customers don't upgrade)
- No incentive to move to higher tiers
- Pricing tiers become meaningless

---

## 🎯 FEATURE ACCESS BY TIER

### **Google-Only ($29/mo)**:
✅ **Allowed**:
- Google Shopping feeds
- Google Merchant Center sync
- Basic product pages
- 512px QR codes
- Performance analytics

❌ **Blocked**:
- Storefront
- Product search
- Quick Start Wizard
- Product Scanning
- GBP Integration
- Custom branding
- Image galleries
- Organization features

---

### **Starter ($49/mo)**:
✅ **Allowed**:
- Everything in Google-Only
- Complete storefront
- Product search
- Mobile-responsive design
- 512px QR codes
- Enhanced SEO

❌ **Blocked**:
- Quick Start Wizard ⚠️ (Currently allowed!)
- Product Scanning ⚠️ (Currently allowed!)
- GBP Integration
- Custom branding
- 1024px+ QR codes
- Image galleries (5+ photos)
- Organization features

---

### **Professional ($499/mo)**:
✅ **Allowed**:
- Everything in Starter
- **Quick Start Wizard** ✅
- **Product Scanning** ✅
- **GBP Integration** ✅
- Custom branding & logo
- 1024px QR codes (print-ready)
- Image galleries (5 photos)
- Interactive maps
- Privacy mode
- Custom marketing copy

❌ **Blocked**:
- White-label storefront
- Custom domain
- 2048px QR codes
- Image galleries (10 photos)
- API access
- Dedicated account manager
- Organization features (unless Organization tier)

---

### **Enterprise ($999/mo)**:
✅ **Allowed**:
- Everything in Professional
- Unlimited SKUs
- Complete white-label
- Custom domain
- 2048px QR codes (billboard-ready)
- Image galleries (10 photos)
- API access
- Dedicated account manager
- SLA guarantee

❌ **Blocked**:
- Organization features (unless Organization tier)
- Chain propagation

---

### **Organization ($999/mo)**:
✅ **Allowed**:
- Everything in Professional (per location)
- Unlimited locations
- 10K shared SKU pool
- **8 propagation types**
- Organization dashboard
- Hero location management
- Strategic testing (test on 1)
- Centralized control
- API access

---

### **Chain Tiers**:
Similar to individual tiers but with multi-location access:
- **Chain Starter ($199)**: Starter features × 5 locations
- **Chain Professional ($1,999)**: Professional features × 25 locations
- **Chain Enterprise ($4,999)**: Enterprise features × unlimited locations

---

## 🔒 IMPLEMENTATION STRATEGY

### **1. Create Centralized Tier Access Middleware**

**File**: `apps/api/src/middleware/tier-access.ts`

```typescript
// Tier-based feature access control
export const TIER_FEATURES = {
  google_only: [
    'google_shopping',
    'google_merchant_center',
    'basic_product_pages',
    'qr_codes_512',
    'performance_analytics',
  ],
  starter: [
    'storefront',
    'product_search',
    'mobile_responsive',
    'enhanced_seo',
  ],
  professional: [
    'quick_start_wizard',      // ⚠️ KEY FEATURE
    'product_scanning',         // ⚠️ KEY FEATURE
    'gbp_integration',          // ⚠️ KEY FEATURE
    'custom_branding',
    'qr_codes_1024',
    'image_gallery_5',
    'interactive_maps',
    'privacy_mode',
  ],
  enterprise: [
    'white_label',
    'custom_domain',
    'qr_codes_2048',
    'image_gallery_10',
    'api_access',
    'dedicated_support',
    'sla_guarantee',
  ],
  organization: [
    'propagation_products',
    'propagation_categories',
    'propagation_gbp_sync',
    'propagation_hours',
    'propagation_profile',
    'propagation_flags',
    'propagation_roles',
    'propagation_brand',
    'organization_dashboard',
    'hero_location',
    'strategic_testing',
  ],
};

// Middleware to check tier access
export function requireTierFeature(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.params.tenantId || req.body.tenantId;
    
    // Get tenant's subscription tier
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscriptionTier: true },
    });
    
    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }
    
    // Check if tier has access to feature
    const hasAccess = checkTierAccess(tenant.subscriptionTier, feature);
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'feature_not_available',
        message: `This feature requires ${getRequiredTier(feature)} tier or higher`,
        currentTier: tenant.subscriptionTier,
        requiredTier: getRequiredTier(feature),
        upgradeUrl: '/settings/subscription',
      });
    }
    
    next();
  };
}
```

---

### **2. Apply Middleware to Protected Routes**

**Quick Start Wizard** (Professional+):
```typescript
// apps/api/src/routes/quick-start.ts
router.post('/tenants/:tenantId/quick-start', 
  authenticateToken,
  requireTierFeature('quick_start_wizard'),  // ⚠️ ADD THIS
  validateSKULimits,
  async (req, res) => {
    // ... existing code
  }
);
```

**Product Scanning** (Professional+):
```typescript
// apps/api/src/routes/scan.ts
router.post('/api/scan/start', 
  authenticateToken,
  requireTierFeature('product_scanning'),  // ⚠️ ADD THIS
  async (req, res) => {
    // ... existing code
  }
);
```

**GBP Integration** (Professional+):
```typescript
// apps/api/src/routes/gbp.ts
router.post('/api/tenant/:tenantId/gbp/sync', 
  authenticateToken,
  requireTierFeature('gbp_integration'),  // ⚠️ ADD THIS
  async (req, res) => {
    // ... existing code
  }
);
```

**Organization Features** (Organization tier only):
```typescript
// apps/api/src/routes/organizations.ts
router.post('/organizations/:orgId/propagate', 
  authenticateToken,
  requireTierFeature('propagation_products'),  // ⚠️ ADD THIS
  async (req, res) => {
    // ... existing code
  }
);
```

---

### **3. Frontend Feature Gating**

**File**: `apps/web/src/hooks/useTierAccess.ts`

```typescript
export function useTierAccess() {
  const { tenant } = useTenant();
  
  const hasFeature = (feature: string) => {
    return checkTierAccess(tenant.subscriptionTier, feature);
  };
  
  const getUpgradeMessage = (feature: string) => {
    const requiredTier = getRequiredTier(feature);
    return `Upgrade to ${requiredTier} to unlock this feature`;
  };
  
  return { hasFeature, getUpgradeMessage };
}
```

**Usage in Components**:
```typescript
// Quick Start button
const { hasFeature } = useTierAccess();

if (!hasFeature('quick_start_wizard')) {
  return (
    <Button disabled>
      Quick Start (Requires Professional)
    </Button>
  );
}
```

---

## 📋 FEATURE MATRIX

| Feature | Google-Only | Starter | Professional | Enterprise | Organization |
|---------|-------------|---------|--------------|------------|--------------|
| **Google Shopping** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Storefront** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Product Search** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Quick Start Wizard** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Product Scanning** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **GBP Integration** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Custom Branding** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **1024px QR Codes** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Image Gallery (5)** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **White-Label** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Custom Domain** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **2048px QR Codes** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Image Gallery (10)** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **API Access** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **8 Propagation Types** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Organization Dashboard** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Strategic Testing** | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 🎯 CRITICAL FEATURES TO GATE

### **Priority 1** (Immediate):
1. ✅ **Quick Start Wizard** → Professional+
2. ✅ **Product Scanning** → Professional+
3. ✅ **GBP Integration** → Professional+

**Why**: These are the $950/mo value features that justify the $499 price!

### **Priority 2** (This Week):
4. ✅ **Custom Branding** → Professional+
5. ✅ **1024px QR Codes** → Professional+
6. ✅ **Image Galleries (5+)** → Professional+
7. ✅ **Organization Features** → Organization tier only

### **Priority 3** (This Month):
8. ✅ **White-Label** → Enterprise only
9. ✅ **Custom Domain** → Enterprise only
10. ✅ **2048px QR Codes** → Enterprise only
11. ✅ **API Access** → Enterprise/Organization only

---

## 🔧 IMPLEMENTATION PLAN

### **Phase 1: Create Middleware** (2 hours)
1. Create `apps/api/src/middleware/tier-access.ts`
2. Define `TIER_FEATURES` constant
3. Implement `requireTierFeature()` middleware
4. Implement `checkTierAccess()` utility
5. Implement `getRequiredTier()` utility

### **Phase 2: Apply to Critical Routes** (3 hours)
1. Quick Start Wizard route
2. Product Scanning routes
3. GBP Integration routes
4. Test with different tier accounts

### **Phase 3: Frontend Gating** (4 hours)
1. Create `useTierAccess()` hook
2. Update Quick Start button
3. Update Scanning button
4. Update GBP sync button
5. Add upgrade prompts

### **Phase 4: Apply to All Routes** (8 hours)
1. Custom branding routes
2. QR code generation routes
3. Image gallery routes
4. Organization routes
5. API access routes
6. Comprehensive testing

### **Phase 5: Testing & Validation** (4 hours)
1. Test each tier's access
2. Test upgrade flows
3. Test error messages
4. Test frontend gating
5. Load testing

**Total Estimated Time**: 21 hours (~3 days)

---

## 💰 REVENUE PROTECTION

### **Without Tier Gating**:
- Starter customers ($49) get Professional features ($499)
- **Revenue loss: $450/customer/month**
- 100 customers = **$45,000/month lost**

### **With Tier Gating**:
- Starter customers must upgrade to Professional
- **Revenue gain: $450/customer/month**
- 100 upgrades = **$45,000/month gained**

### **Annual Impact**:
- **$540,000/year** in protected revenue per 100 customers

---

## 🎯 UPGRADE INCENTIVES

### **Starter → Professional Upgrade Prompts**:

**Quick Start Wizard**:
```
🚀 Quick Start Wizard (Professional Feature)

Generate 50-100 products in 1 second and save 400+ hours!

This feature requires Professional tier ($499/mo).

[Upgrade to Professional] [Learn More]

Current tier: Starter ($49/mo)
Upgrade cost: +$450/mo
Value delivered: $950+/mo (2x ROI!)
```

**Product Scanning**:
```
📱 Product Intelligence (Professional Feature)

Scan barcodes to get nutrition facts, allergens, and rich product data
automatically - just like CVS and Walmart!

This feature requires Professional tier ($499/mo).

[Upgrade to Professional] [Learn More]
```

**GBP Integration**:
```
🗺️ Google Business Profile Integration (Professional Feature)

Sync your products to Google Business Profile and show up in local
searches. Worth $200-300/mo in manual management!

This feature requires Professional tier ($499/mo).

[Upgrade to Professional] [Learn More]
```

---

## ✅ SUCCESS CRITERIA

1. **Security**: No tier can access features above their level
2. **UX**: Clear upgrade prompts with value messaging
3. **Revenue**: Protected $450/customer/month in upgrades
4. **Testing**: All tiers tested and validated
5. **Performance**: No performance degradation
6. **Monitoring**: Track feature access attempts by tier

---

## 🚀 NEXT STEPS

1. ✅ Review and approve this plan
2. ✅ Create centralized tier access middleware
3. ✅ Apply to critical routes (Quick Start, Scanning, GBP)
4. ✅ Test with different tier accounts
5. ✅ Deploy to staging
6. ✅ Monitor and validate
7. ✅ Roll out to all routes

---

**This is CRITICAL for revenue protection and tier differentiation!** 🔒💰

---

**Document Version**: 1.0  
**Created**: 2024-11-06  
**Status**: Ready for Implementation  
**Priority**: HIGH - Revenue Protection
