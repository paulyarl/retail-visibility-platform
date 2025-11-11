# Offerings Page Refactor Plan

**Current File:** `apps/web/src/app/(platform)/settings/offerings/page.tsx`
**Current Size:** 1,034 lines (MASSIVE!)
**Status:** ⚠️ NEEDS REFACTOR

---

## 🚨 Current Problems

1. **Monolithic Component** - 1,034 lines in one file
2. **Hardcoded Data** - Pricing, features, tiers all inline
3. **Duplicate Code** - Similar card structures repeated
4. **Hard to Update** - Change pricing = edit 20+ places
5. **No Single Source of Truth** - Pricing scattered throughout
6. **Outdated Info** - Contains old pricing ($29, $49, $499, $999)

---

## ✅ Refactor Strategy (Middleware Pattern)

### **Phase 1: Extract Data Layer**

Create centralized data files:

```
apps/web/src/lib/offerings/
├── tier-data.ts          # Official tier definitions
├── feature-data.ts       # Feature descriptions
├── pricing-data.ts       # Pricing information
└── types.ts              # TypeScript types
```

### **Phase 2: Create Reusable Components**

```
apps/web/src/components/offerings/
├── TierCard.tsx          # Single tier pricing card
├── FeatureGrid.tsx       # Feature showcase grid
├── FeatureCard.tsx       # Individual feature card
├── TrialSection.tsx      # Trial information
├── ComparisonTable.tsx   # Tier comparison table
└── LocationLimitBadge.tsx # Location limit display
```

### **Phase 3: Simplify Page**

Reduce page to ~150 lines of orchestration:
- Import data from middleware
- Render components with data
- No hardcoded content

---

## 📊 Data Structure

### **`lib/offerings/tier-data.ts`**

```typescript
export interface TierDefinition {
  id: string;
  name: string;
  price: number | 'free' | 'custom';
  priceLabel: string;
  description: string;
  locationLimit: number | 'unlimited';
  locationLimitLabel: string;
  popular?: boolean;
  badge?: string;
  features: string[];
  excludedFeatures?: string[];
  color: {
    border: string;
    bg: string;
    badge: string;
  };
}

export const OFFICIAL_TIERS: TierDefinition[] = [
  {
    id: 'google_only',
    name: 'Google Only',
    price: 'free',
    priceLabel: 'FREE',
    description: 'Google Shopping only',
    locationLimit: 1,
    locationLimitLabel: '1 Location',
    features: [
      'Google Shopping feeds',
      'Merchant Center sync',
      'Basic analytics',
    ],
    excludedFeatures: [
      'No storefront',
      'No directory',
    ],
    color: {
      border: 'border-green-200',
      bg: 'bg-green-50',
      badge: 'bg-green-100 text-green-800',
    },
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    priceLabel: '$29/mo',
    description: 'Small businesses',
    locationLimit: 3,
    locationLimitLabel: 'Up to 3 Locations',
    features: [
      'Public storefront',
      'Directory listing',
      'Barcode scanner',
      'QR codes',
    ],
    excludedFeatures: [
      'No POS integration',
    ],
    color: {
      border: 'border-blue-200',
      bg: 'bg-blue-50',
      badge: 'bg-blue-100 text-blue-800',
    },
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 99,
    priceLabel: '$99/mo',
    description: 'Growing chains',
    locationLimit: 10,
    locationLimitLabel: 'Up to 10 Locations',
    popular: true,
    features: [
      'Clover POS',
      'Square POS',
      'Advanced analytics',
      'Bulk operations',
      'Priority support',
    ],
    color: {
      border: 'border-purple-500',
      bg: 'bg-purple-50',
      badge: 'bg-purple-100 text-purple-800',
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 249,
    priceLabel: '$249/mo',
    description: 'Established businesses',
    locationLimit: 25,
    locationLimitLabel: 'Up to 25 Locations',
    features: [
      'Dedicated manager',
      'API access',
      'Custom integrations',
      'White-label options',
      'SLA guarantees',
    ],
    color: {
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      badge: 'bg-amber-100 text-amber-800',
    },
  },
  {
    id: 'organization',
    name: 'Organization',
    price: 'custom',
    priceLabel: 'Custom',
    description: 'Multi-location chains',
    locationLimit: 'unlimited',
    locationLimitLabel: 'Unlimited Locations',
    badge: 'CHAINS',
    features: [
      'Chain management',
      'Bulk propagation',
      'Org-level billing',
      'Multi-user mgmt',
      'Custom pricing',
    ],
    color: {
      border: 'border-emerald-500',
      bg: 'bg-emerald-50',
      badge: 'bg-emerald-100 text-emerald-800',
    },
  },
];

export const TRIAL_INFO = {
  duration: 14,
  locationLimit: 1,
  features: [
    'Trial any tier (Starter, Professional, or Enterprise)',
    'Full access to all tier features',
    'Test with 1 location',
    'No credit card required',
  ],
  terms: [
    '14 days from account creation',
    'No credit card required to start',
    'Choose your tier at signup',
    'Add payment before trial ends to continue',
    'Cancel anytime with no charges',
  ],
};
```

### **`lib/offerings/feature-data.ts`**

```typescript
export interface PlatformFeature {
  id: string;
  title: string;
  icon: string;
  description: string;
  highlights: string[];
  badge?: string;
  color: {
    bg: string;
    border: string;
    text: string;
  };
}

export const PLATFORM_FEATURES: PlatformFeature[] = [
  {
    id: 'quick_start',
    title: 'Quick Start Wizard',
    icon: '⚡',
    description: '50 products in 1 second!',
    highlights: [
      '360x faster than manual',
      'No scanning, no CSV',
      'Auto-categorized',
    ],
    badge: 'NEW!',
    color: {
      bg: 'from-blue-500 to-purple-600',
      border: 'border-blue-400',
      text: 'text-white',
    },
  },
  {
    id: 'organization_propagation',
    title: 'Organization Propagation Control',
    icon: '🔗',
    description: 'Chain-wide sync in one click',
    highlights: [
      '8 propagation types',
      'Test on 1 location first',
      'Save 400+ hours per rollout',
    ],
    badge: 'ENTERPRISE',
    color: {
      bg: 'from-emerald-500 to-teal-600',
      border: 'border-emerald-400',
      text: 'text-white',
    },
  },
  // ... more features
];
```

---

## 🎨 Component Examples

### **`components/offerings/TierCard.tsx`**

```typescript
'use client';

import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { Check, X } from 'lucide-react';
import type { TierDefinition } from '@/lib/offerings/tier-data';

interface TierCardProps {
  tier: TierDefinition;
}

export default function TierCard({ tier }: TierCardProps) {
  return (
    <Card className={`border-2 ${tier.color.border} ${tier.popular ? 'shadow-lg relative' : ''}`}>
      {tier.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-green-500 text-white">POPULAR</Badge>
        </div>
      )}
      
      {tier.badge && (
        <div className="absolute -top-2 -right-2">
          <Badge className={tier.color.badge}>{tier.badge}</Badge>
        </div>
      )}
      
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>{tier.name}</CardTitle>
          <Badge className={tier.color.badge}>{tier.priceLabel}</Badge>
        </div>
        
        <p className="text-sm text-neutral-600 mb-2">{tier.description}</p>
        
        <div className={`${tier.color.bg} border ${tier.color.border} rounded px-2 py-1 text-xs font-semibold`}>
          📍 {tier.locationLimitLabel}
        </div>
      </CardHeader>
      
      <CardContent>
        <ul className="space-y-2 text-sm">
          {tier.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
          
          {tier.excludedFeatures?.map((feature, index) => (
            <li key={`excluded-${index}`} className="flex items-start gap-2">
              <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <span className="text-neutral-400">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

### **`components/offerings/FeatureCard.tsx`**

```typescript
'use client';

import type { PlatformFeature } from '@/lib/offerings/feature-data';

interface FeatureCardProps {
  feature: PlatformFeature;
}

export default function FeatureCard({ feature }: FeatureCardProps) {
  return (
    <div className={`bg-gradient-to-br ${feature.color.bg} border-2 ${feature.color.border} rounded-lg p-6 ${feature.color.text} relative shadow-xl`}>
      {feature.badge && (
        <div className="absolute -top-2 -right-2 bg-yellow-400 text-purple-900 text-xs px-3 py-1 rounded-full font-bold">
          {feature.badge}
        </div>
      )}
      
      <div className="text-4xl mb-3">{feature.icon}</div>
      <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
      
      <ul className="space-y-1 text-sm">
        {feature.highlights.map((highlight, index) => (
          <li key={index}>• {highlight}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 📄 Refactored Page Structure

### **`page.tsx` (150 lines instead of 1,034)**

```typescript
'use client';

import PageHeader, { Icons } from '@/components/PageHeader';
import { OFFICIAL_TIERS, TRIAL_INFO } from '@/lib/offerings/tier-data';
import { PLATFORM_FEATURES } from '@/lib/offerings/feature-data';
import TierCard from '@/components/offerings/TierCard';
import FeatureCard from '@/components/offerings/FeatureCard';
import TrialSection from '@/components/offerings/TrialSection';

export default function OfferingsPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <PageHeader
        title="Platform Offerings & Benefits"
        description="Explore all our subscription tiers, managed services, and features"
        icon={Icons.Settings}
        backLink={{
          href: '/settings',
          label: 'Back to Settings'
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        
        {/* Platform Features Overview */}
        <section>
          <h2 className="text-3xl font-bold text-neutral-900 mb-6 text-center">
            Complete Online Presence Solution
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLATFORM_FEATURES.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
          </div>
        </section>
        
        {/* Trial Information */}
        <TrialSection trial={TRIAL_INFO} />
        
        {/* Official Pricing Tiers */}
        <section>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">
            Subscription Tiers & Location Limits
          </h2>
          <p className="text-neutral-600 mb-6">
            <strong>14-day trial includes 1 location</strong> (test any tier). 
            After trial, full location limits unlock.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {OFFICIAL_TIERS.map((tier) => (
              <TierCard key={tier.id} tier={tier} />
            ))}
          </div>
        </section>
        
        {/* Managed Services (existing) */}
        {/* ... keep existing managed services section ... */}
        
        {/* Chain Tiers (existing) */}
        {/* ... keep existing chain tiers section ... */}
      </div>
    </div>
  );
}
```

---

## 📊 Benefits of Refactor

### **Before:**
- ❌ 1,034 lines in one file
- ❌ Pricing hardcoded in 20+ places
- ❌ Change price = edit entire file
- ❌ Duplicate card structures
- ❌ Hard to maintain

### **After:**
- ✅ ~150 lines in page file
- ✅ Pricing in one data file
- ✅ Change price = edit one line
- ✅ Reusable components
- ✅ Easy to maintain

### **Update Pricing Example:**

**Before (edit 20+ places):**
```typescript
// Line 542
<Badge>$29/mo</Badge>
// Line 584
<Badge>$49/mo</Badge>
// Line 630
<Badge>$499/mo</Badge>
// ... 17 more places
```

**After (edit one line):**
```typescript
// lib/offerings/tier-data.ts
{
  id: 'starter',
  price: 29,  // ← Change here, updates everywhere
  priceLabel: '$29/mo',
}
```

---

## 🚀 Implementation Plan

### **Day 1: Data Layer**
1. Create `lib/offerings/` folder
2. Extract tier data to `tier-data.ts`
3. Extract feature data to `feature-data.ts`
4. Create TypeScript types

### **Day 2: Components**
1. Create `components/offerings/` folder
2. Build `TierCard.tsx`
3. Build `FeatureCard.tsx`
4. Build `TrialSection.tsx`

### **Day 3: Page Refactor**
1. Backup current page
2. Rewrite page using new components
3. Import data from middleware
4. Remove hardcoded content

### **Day 4: Testing**
1. Visual regression testing
2. Mobile responsiveness
3. Content accuracy
4. Link functionality

### **Day 5: Deploy**
1. Code review
2. Merge to main
3. Deploy to production
4. Monitor for issues

---

## 📈 Metrics

**Code Reduction:**
- Page: 1,034 → 150 lines (85% reduction)
- Maintainability: 10x improvement
- Update time: 20 minutes → 2 minutes

**Reusability:**
- TierCard: Used 5 times
- FeatureCard: Used 10+ times
- Data: Single source of truth

---

## 🎯 Success Criteria

- [ ] Page under 200 lines
- [ ] All pricing in data files
- [ ] Components reusable
- [ ] No hardcoded content
- [ ] Easy to update pricing
- [ ] Mobile responsive
- [ ] Visually identical to current

---

**This refactor will make the offerings page 10x easier to maintain and update!** 🚀
