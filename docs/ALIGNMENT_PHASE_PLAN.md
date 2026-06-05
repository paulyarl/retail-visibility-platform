# Phase Plan: Align /settings/offerings with /features

## Overview
Align the internal admin offerings page (`/settings/offerings`) with the public marketing features page (`/features`) using the tier strategy from `PLATFORM_STRATEGY.md` as the single source of truth.

## Current State Analysis

### `/features` Page (Marketing)
- **Structure**: 5 feature categories aligned with Connected Layer Stack
- **Tiers**: Discovery ($29), Storefront ($59), Commitment ($99), Professional ($199), Enterprise ($499)
- **Focus**: Customer acquisition, clear value propositions, tier progression story
- **Content**: Feature benefits, upgrade triggers, tier identities

### `/settings/offerings` Page (Admin)
- **Structure**: Feature cards, tier comparison tables
- **Tiers**: Starter ($29), Professional ($99), Enterprise ($499), Organization (Custom)
- **Focus**: Internal feature breakdown, technical capabilities
- **Content**: Detailed feature lists, limitations, pricing

### `PLATFORM_STRATEGY.md` (Reference)
- **Structure**: Feature matrix by tier
- **Tiers**: Discovery → Storefront → Commitment → Professional → Enterprise
- **Focus**: Complete feature mapping, tier progression logic
- **Content**: Precise feature availability per tier

## Alignment Issues

### 1. **Tier Naming Mismatch**
- Marketing: Discovery, Storefront, Commitment, Professional, Enterprise
- Admin: Starter, Professional, Enterprise, Organization
- **Missing**: Storefront and Commitment tiers in admin
- **Extra**: Organization tier (should be chain pricing)

### 2. **Tier Structure Mismatch**
- Marketing: 5 distinct tiers with clear progression
- Admin: 4 tiers with different feature groupings
- **Missing**: Storefront tier (platform presence without commerce)
- **Missing**: Commitment tier (commerce with holding deposits)

### 3. **Feature Mapping Gaps**
- Marketing shows tier progression story
- Admin shows technical feature breakdown
- **Gap**: No clear mapping between marketing benefits and admin features

## Phase Plan

### Phase 1: Standardize Tier Structure (Week 1)
**Goal**: Align both pages with the 5-tier structure from PLATFORM_STRATEGY.md

**Tasks**:
1. Update `/settings/offerings` to use 5 tiers:
   - Discovery ($29)
   - Storefront ($59) 
   - Commitment ($99)
   - Professional ($199)
   - Enterprise ($499)

2. Add missing tiers to admin page:
   - Create Storefront tier section
   - Create Commitment tier section
   - Move features to appropriate tiers

3. Update pricing tables to match marketing page

**Deliverables**:
- Updated tier structure in offerings page
- Consistent pricing across both pages
- Clear tier progression in admin view

### Phase 2: Feature Mapping Alignment (Week 1-2)
**Goal**: Map every marketing benefit to specific admin features

**Tasks**:
1. Create feature mapping matrix:
   ```
   Marketing Benefit → Admin Feature(s)
   "Get Found on Google" → [Google Search, Google Shopping, Google Maps]
   "Own Your Platform Presence" → [Branded Storefront, Directory Listing, Categories]
   "Capture Intent & Drive Foot Traffic" → [Add to Cart, Holding Deposits, BOPIS]
   ```

2. Update admin page to show marketing benefits alongside technical features

3. Add tier progression indicators to admin page

**Deliverables**:
- Feature mapping matrix
- Updated admin page with marketing context
- Clear benefit-to-feature mapping

### Phase 3: Content Consistency (Week 2)
**Goal**: Ensure consistent messaging and terminology

**Tasks**:
1. Standardize feature names across both pages
2. Align feature descriptions and benefits
3. Ensure consistent tier identities and upgrade triggers
4. Add tier progression logic to admin page

**Deliverables**:
- Consistent terminology dictionary
- Updated content on both pages
- Tier progression story in admin view

### Phase 4: Chain Pricing Integration (Week 2-3)
**Goal**: Properly separate individual subscriptions from chain pricing

**Tasks**:
1. Move Organization tier to separate "Chain Pricing" section
2. Create chain pricing structure:
   - Chain Discovery
   - Chain Storefront  
   - Chain Commitment
   - Chain Professional
   - Chain Enterprise

3. Update admin page to show both individual and chain pricing

**Deliverables**:
- Separate chain pricing section
- Clear individual vs chain distinction
- Updated pricing structure

### Phase 5: Visual and UX Alignment (Week 3)
**Goal**: Create consistent visual experience between pages

**Tasks**:
1. Align color schemes and visual hierarchy
2. Use consistent component styles
3. Add interactive elements to admin page (tier comparison, feature highlights)
4. Ensure responsive design consistency

**Deliverables**:
- Consistent visual design
- Interactive tier comparison tools
- Improved UX on admin page

### Phase 6: Validation and Testing (Week 3-4)
**Goal**: Ensure alignment accuracy and functionality

**Tasks**:
1. Cross-validate feature availability per tier
2. Test tier upgrade flows
3. Validate pricing accuracy
4. User acceptance testing

**Deliverables**:
- Validation report
- Bug fixes and adjustments
- Final aligned pages

## Implementation Details

### File Changes Required

#### `/app/(platform)/settings/offerings/page.tsx`
- Add Storefront and Commitment tier sections
- Reorganize feature cards by tier
- Add marketing benefit context
- Create separate chain pricing section
- Update pricing tables

#### `/app/features/page.tsx` (Minimal changes)
- Ensure consistency with PLATFORM_STRATEGY.md
- Verify all features are properly mapped

#### New Components
- `TierComparisonTable.tsx` - Interactive tier comparison
- `FeatureMapping.tsx` - Benefit to feature mapping display
- `ChainPricingSection.tsx` - Dedicated chain pricing display

### Data Structure Updates

#### Tier Configuration
```typescript
export const TIERS = {
  discovery: {
    name: 'Discovery',
    price: 29,
    identity: 'I exist online',
    realization: 'People are finding my products on Google',
    upgradeTrigger: 'Now I want them to find my whole store',
    features: [/* mapped from PLATFORM_STRATEGY.md */]
  },
  storefront: {
    name: 'Storefront', 
    price: 59,
    identity: 'I have a store online',
    realization: 'Shoppers are browsing — but can\'t act on it',
    upgradeTrigger: 'I want shoppers to commit to buying',
    features: [/* mapped from PLATFORM_STRATEGY.md */]
  },
  // ... continue for all tiers
}
```

#### Feature Mapping
```typescript
export const FEATURE_MAPPING = {
  marketingBenefits: {
    'Get Found on Google': {
      adminFeatures: ['googleSearchIndexing', 'googleShoppingFeeds', 'googleMapsSWIS'],
      tier: 'discovery'
    },
    'Own Your Platform Presence': {
      adminFeatures: ['brandedStorefront', 'platformProductVisibility', 'directoryListing'],
      tier: 'storefront'
    },
    // ... map all benefits
  }
}
```

## Success Criteria

### Alignment Metrics
- [ ] 100% tier name consistency between pages
- [ ] All marketing benefits mapped to admin features
- [ ] Consistent pricing across all pages
- [ ] Clear tier progression story in admin view
- [ ] Proper separation of individual vs chain pricing

### User Experience
- [ ] Admin can easily understand what each tier includes
- [ ] Marketing team can update features in one place
- [ ] Customers see consistent messaging across pages
- [ ] Sales team can clearly explain tier differences

### Technical
- [ ] Single source of truth (PLATFORM_STRATEGY.md) maintained
- [ ] Component reusability between pages
- [ ] Maintainable feature mapping system
- [ ] Responsive design consistency

## Risks and Mitigations

### Risk 1: Feature Complexity
- **Issue**: Admin page becomes too complex with 5 tiers
- **Mitigation**: Use collapsible sections and progressive disclosure

### Risk 2: Content Drift
- **Issue**: Pages become misaligned over time
- **Mitigation**: Create shared configuration and validation scripts

### Risk 3: Customer Confusion
- **Issue**: Too many tiers overwhelm customers
- **Mitigation**: Clear tier progression story and upgrade triggers

## Timeline

| Week | Phase | Key Deliverables |
|------|-------|------------------|
| 1 | Phase 1-2 | Tier structure, feature mapping |
| 2 | Phase 3-4 | Content alignment, chain pricing |
| 3 | Phase 5 | Visual/UX alignment |
| 4 | Phase 6 | Validation and launch |

## Next Steps

1. **Immediate**: Review PLATFORM_STRATEGY.md for latest tier definitions
2. **Week 1**: Begin Phase 1 - Standardize tier structure
3. **Ongoing**: Weekly sync with marketing team for alignment validation
4. **Launch**: End of Week 4 with full alignment completed
