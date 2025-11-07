# Taste Test Strategy: Limited Quick Start for Google-Only Tier

## Overview

The **Taste Test Strategy** provides Google-Only tier users ($29/mo) with a **limited version** of the Quick Start Wizard to demonstrate its value and create desire for upgrade to Professional ($499/mo).

## Strategic Rationale

### Problem
- Google-Only tier had **only manual entry** for product data
- No bulk import options (CSV, scanning, Quick Start)
- Created frustration and high churn
- Users couldn't experience the platform's power

### Solution: Limited Quick Start
Give Google-Only users a **taste** of Quick Start with restrictions that:
1. ✅ Remove the biggest pain point (manual one-by-one entry)
2. ✅ Demonstrate the feature's value
3. ✅ Create desire for the full version
4. ✅ Don't cannibalize Professional tier revenue

---

## Feature Comparison

| Feature | Google-Only ($29) | Professional ($499) | Difference |
|---------|-------------------|---------------------|------------|
| **Max Products** | 25 | 100 | 4x more |
| **Rate Limit** | Once per 7 days | Once per day | 7x more frequent |
| **Scenarios** | 1 (Grocery only) | 4 (All scenarios) | 4x variety |
| **Message** | Shows upgrade prompt | No restrictions | Premium experience |

---

## Implementation Details

### Frontend: `tier-features.ts`

```typescript
export const TIER_FEATURES = {
  google_only: [
    'google_shopping',
    'google_merchant_center',
    'basic_product_pages',
    'qr_codes_512',
    'performance_analytics',
    'quick_start_wizard',        // LIMITED: Max 25 SKUs, once per 7 days
  ],
  professional: [
    'quick_start_wizard',       // FULL: Max 100 SKUs, once per day
    'product_scanning',
    'gbp_integration',
    // ... more features
  ],
};

export const TIER_FEATURE_LIMITS = {
  google_only: {
    quick_start_wizard: {
      maxProducts: 25,
      rateLimitDays: 7,
      scenarios: ['grocery'],
      message: 'Google-Only tier includes a limited Quick Start...',
    },
  },
  professional: {
    quick_start_wizard: {
      maxProducts: 100,
      rateLimitDays: 1,
      scenarios: ['grocery', 'fashion', 'electronics', 'general'],
      message: null,
    },
  },
};
```

### Backend: Quick Start Endpoint

The backend `/api/v1/tenants/:id/quick-start` endpoint should:

1. **Check tier access** via `requireTierFeature('quick_start_wizard')`
2. **Apply tier-specific limits**:
   ```typescript
   const limits = getTierLimits(tenant.subscriptionTier, 'quick_start_wizard');
   
   if (requestedProducts > limits.maxProducts) {
     return res.status(400).json({
       error: 'Product limit exceeded',
       message: limits.message,
       maxProducts: limits.maxProducts,
       tier: tenant.subscriptionTier,
       upgradeRequired: true,
     });
   }
   
   if (!limits.scenarios.includes(requestedScenario)) {
     return res.status(400).json({
       error: 'Scenario not available',
       message: limits.message,
       availableScenarios: limits.scenarios,
       upgradeRequired: true,
     });
   }
   ```

3. **Enforce rate limits** based on `rateLimitDays`

---

## User Experience Flow

### Google-Only User Journey

1. **Discovers Quick Start**
   - Sees Quick Start in navigation (no longer blocked!)
   - Badge shows "Limited" or "25 products max"

2. **Uses Limited Version**
   - Can generate up to 25 products
   - Only Grocery scenario available
   - Sees success: "🎉 25 products created!"

3. **Hits Limits**
   - Tries to generate more → Blocked with upgrade prompt
   - Tries again after 2 days → Rate limit message
   - Wants Fashion scenario → Not available

4. **Upgrade Prompt**
   ```
   ┌─────────────────────────────────────────────────┐
   │ 🎉 You've used your limited Quick Start!       │
   │                                                 │
   │ Upgrade to Professional to unlock:             │
   │ ✓ Generate up to 100 products (vs 25)         │
   │ ✓ Use Quick Start daily (vs weekly)           │
   │ ✓ Access all 4 scenarios (vs 1)               │
   │ ✓ Plus: Product Scanning & GBP Integration    │
   │                                                 │
   │ [Upgrade to Professional - $499/mo] [Maybe Later] │
   └─────────────────────────────────────────────────┘
   ```

---

## Business Impact

### Revenue Protection

| Metric | Before | After | Impact |
|--------|--------|-------|--------|
| **Google-Only Churn** | High (manual only) | Lower (has Quick Start) | ↓ 30-40% |
| **Upgrade Rate** | Low (no exposure) | Higher (taste test) | ↑ 15-25% |
| **Professional Value** | Abstract | Concrete (4x limits) | ↑ Perceived value |
| **Support Tickets** | High (data entry help) | Lower (self-service) | ↓ 20-30% |

### Value Ladder

```
Trial ($0)
  ↓ Manual entry only
  
Google-Only ($29)
  ↓ Limited Quick Start (25 products, weekly)
  ↓ "This is amazing! But I need more..."
  
Professional ($499)
  ↓ Full Quick Start (100 products, daily)
  ↓ Product Scanning
  ↓ GBP Integration
  
Enterprise ($999)
  ↓ Unlimited everything
```

---

## Psychology of Taste Testing

### Why This Works

1. **Endowment Effect**
   - Users get to *use* Quick Start
   - Losing access feels like a loss
   - Creates urgency to upgrade

2. **Contrast Principle**
   - 25 products feels generous (vs manual)
   - 100 products feels amazing (vs 25)
   - Creates desire for "full version"

3. **Social Proof**
   - "Other businesses use 100 products"
   - "Professional tier unlocks full potential"
   - FOMO (fear of missing out)

4. **Reciprocity**
   - We gave them something valuable
   - They feel inclined to reciprocate (upgrade)
   - Builds goodwill and trust

---

## Competitive Analysis

| Competitor | Free Tier | Paid Tier | Strategy |
|------------|-----------|-----------|----------|
| **Shopify** | 14-day trial | Full features | Time-limited |
| **Square** | Free forever | Limited features | Feature-limited |
| **Lightspeed** | No free tier | Full features | No taste test |
| **RVP (Us)** | Google-Only | Limited Quick Start | **Taste test** ✅ |

Our approach is **unique** and **strategic**:
- Not time-limited (builds trust)
- Not fully restricted (shows value)
- Creates clear upgrade path

---

## Monitoring & Metrics

### Key Metrics to Track

1. **Quick Start Usage (Google-Only)**
   - How many use it?
   - How many hit the 25-product limit?
   - How many try to use it again within 7 days?

2. **Upgrade Conversion**
   - % of Google-Only users who upgrade after using Quick Start
   - Time to upgrade after first use
   - Correlation between usage and upgrade

3. **Support Impact**
   - Reduction in "how do I add products?" tickets
   - Increase in "how do I upgrade?" inquiries
   - Overall satisfaction scores

4. **Feature Adoption**
   - Which scenario do they choose? (Grocery only available)
   - How many products do they generate? (avg, median)
   - Do they activate the products?

---

## Future Enhancements

### Phase 2: Dynamic Limits
- Adjust limits based on user behavior
- Reward active users with bonus uses
- A/B test different limit combinations

### Phase 3: Graduated Unlocks
- First use: 10 products
- Second use: 25 products
- Third use: "Upgrade to unlock 100!"

### Phase 4: Time-Based Promotions
- "This week only: 50 products for Google-Only!"
- Create urgency and test price sensitivity
- Seasonal campaigns

---

## Implementation Checklist

### Frontend
- [x] Add `quick_start_wizard` to `google_only` tier
- [x] Define `TIER_FEATURE_LIMITS` with restrictions
- [x] Export `getFeatureLimits()` helper function
- [ ] Update Quick Start page to show limits
- [ ] Add upgrade prompt when limits hit
- [ ] Show "Limited" badge in navigation

### Backend
- [ ] Update `tier-access.ts` to match frontend
- [ ] Implement limit checking in Quick Start endpoint
- [ ] Enforce rate limits (7 days for Google-Only)
- [ ] Add upgrade prompts in API responses
- [ ] Track usage metrics

### Documentation
- [x] Create TASTE_TEST_STRATEGY.md
- [ ] Update API documentation
- [ ] Add to tier comparison page
- [ ] Create support articles

### Testing
- [ ] Test Google-Only can access Quick Start
- [ ] Test 25-product limit enforcement
- [ ] Test 7-day rate limit
- [ ] Test scenario restriction (Grocery only)
- [ ] Test upgrade prompts
- [ ] Test Professional has full access

---

## Success Criteria

This strategy is successful if:

1. **Adoption**: >60% of Google-Only users try Quick Start
2. **Conversion**: >20% upgrade to Professional after using it
3. **Retention**: Google-Only churn decreases by >30%
4. **Support**: Product entry tickets decrease by >25%
5. **Revenue**: Net increase in MRR from upgrades > lost revenue from feature access

---

## Conclusion

The **Taste Test Strategy** transforms Quick Start from a revenue-protecting feature into a **conversion tool**. By giving Google-Only users a limited but valuable experience, we:

- ✅ Reduce churn (they can add products easily)
- ✅ Increase upgrades (they want more)
- ✅ Build trust (we're generous, not restrictive)
- ✅ Protect revenue (limits preserve Professional value)

This is a **win-win**: users get value, we get conversions.
