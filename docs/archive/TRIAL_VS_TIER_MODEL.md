# Trial vs Tier Model - Clarified

> [!WARNING]
> **Deprecated — the canonical definition of trial vs tier behavior now lives in `TIER_MODEL_V2_SIMPLIFIED.md` (as of 2025‑11‑14).**
> This document captures an earlier framing and is retained only for historical context.

**Status:** ⚠️ DEPRECATED (see TIER_MODEL_V2_SIMPLIFIED.md)

## 🎯 Core Concept

**Trial is a STATUS, not a tier!**

- **Subscription Tier** = What features you get (google_only, starter, professional, etc.)
- **Subscription Status** = Payment state (trial, active, past_due, canceled, expired)

---

## 📊 How It Works

### **User Journey:**

1. **Sign Up** → User chooses a **tier** (google_only, starter, professional)
2. **Trial Period** → 14 days with **trial status** (limits to 1 location)
3. **Convert** → User pays → Status changes to **active** (full tier limits apply)

---

## 🏪 Location Limits

### **During Trial (14 days):**

| Tier | Trial Limit | After Trial |
|------|-------------|-------------|
| Google Only | 1 | 1 |
| Starter | 1 | 3 |
| Professional | 1 | 10 |
| Enterprise | 1 | 25 |
| Organization | 1 | ∞ |

**Key Rule:** Trial status **always** limits to 1 location, regardless of tier chosen.

---

## 💡 Examples

### **Example 1: Starter Trial**
```
User signs up for Starter tier
Status: trial (14 days)
Limit: 1 location (trial override)

After 14 days, user converts:
Status: active
Limit: 3 locations (full Starter tier)
```

### **Example 2: Professional Trial**
```
User signs up for Professional tier
Status: trial (14 days)
Limit: 1 location (trial override)

After 14 days, user converts:
Status: active
Limit: 10 locations (full Professional tier)
```

### **Example 3: Google Only (Always 1)**
```
User signs up for Google Only tier
Status: trial (14 days)
Limit: 1 location

After 14 days, user converts:
Status: active
Limit: 1 location (Google Only is always 1)
```

---

## 🔧 Implementation

### **Database Schema:**
```typescript
Tenant {
  subscriptionTier: 'google_only' | 'starter' | 'professional' | 'enterprise' | 'organization'
  subscriptionStatus: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired'
  trialEndsAt: DateTime?
}
```

### **Limit Logic:**
```typescript
function getTenantLimit(tier: string, status: string): number {
  // Trial status ALWAYS overrides tier limits
  if (status === 'trial') {
    return 1; // 14-day trial = 1 location max
  }
  
  // Paid subscriptions use tier limits
  const tierLimits = {
    google_only: 1,
    starter: 3,
    professional: 10,
    enterprise: 25,
    organization: Infinity,
  };
  
  return tierLimits[tier] ?? 1;
}
```

---

## 📋 User Messaging

### **Pricing Page:**

**Starter Tier Card:**
```
┌─────────────────────────────────┐
│ Starter - $29/mo                │
├─────────────────────────────────┤
│ ⭐ Up to 3 Locations            │
│                                 │
│ ✓ Public storefront             │
│ ✓ Directory listing             │
│ ✓ Google Business sync          │
│                                 │
│ [Start 14-Day Trial]            │
│                                 │
│ Trial includes 1 location       │
│ Full 3 locations after trial    │
└─────────────────────────────────┘
```

### **During Trial:**
```
┌─────────────────────────────────┐
│ 📍 1 / 1 location (Trial)       │
│                                 │
│ 7 days left in trial            │
│                                 │
│ Convert to unlock:              │
│ • 3 locations (Starter)         │
│ • Full feature access           │
│                                 │
│ [Convert to Paid]               │
└─────────────────────────────────┘
```

### **After Conversion:**
```
┌─────────────────────────────────┐
│ 📍 1 / 3 locations              │
│                                 │
│ Starter Plan                    │
│ 2 locations remaining           │
└─────────────────────────────────┘
```

---

## ⚠️ Edge Cases

### **Trial Expiration:**
```
Trial ends → Status changes to 'expired'
User cannot create new tenants
Existing tenant remains accessible (read-only)
User must convert to paid to continue
```

### **Downgrade:**
```
User has 5 locations on Professional (active)
User downgrades to Starter (active)
Limit: 3 locations

Result: User keeps all 5 locations (grandfathered)
But cannot create new ones until under limit
```

### **Multiple Tiers:**
```
User owns:
- Tenant A (Starter, active) 
- Tenant B (Professional, active)

Effective limit: Professional (10 locations)
Uses highest tier across all owned tenants
```

---

## 🎯 Benefits

✅ **Clear Value Proposition** - Users understand trial limitations
✅ **Upgrade Incentive** - Trial → Paid unlocks more locations
✅ **Flexible Onboarding** - Try any tier with 1 location
✅ **No Surprises** - Clear messaging about limits
✅ **Revenue Opportunity** - Natural conversion path

---

## 📞 FAQs

**Q: Can I test Professional features during trial?**
A: Yes! You get all Professional features, just limited to 1 location.

**Q: What happens after 14 days if I don't convert?**
A: Your account becomes read-only. Convert to paid to continue.

**Q: Can I upgrade my tier during trial?**
A: Yes! You can change tiers anytime. Trial limit stays at 1 location.

**Q: Do I get charged during trial?**
A: No. Billing starts after trial ends or when you convert early.

---

**This model provides clear expectations and a smooth conversion path!** 🎉
