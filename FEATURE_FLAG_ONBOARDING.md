# Feature Flags in Tenant Onboarding

## 📋 Feature Flag Inventory

### Legend
- ✅ **ACTIVE** - Currently implemented and in use
- 🚧 **PLANNED** - Documented but not yet implemented
- 🔮 **FUTURE** - Conceptual example for illustration
- 🎯 **PILOT** - In testing with select tenants
- ⚠️ **DEPRECATED** - Being phased out

---

## 🎯 Concept: Pre-Launch Feature Validation

Use feature flags as part of the tenant onboarding checklist to verify features work correctly before releasing the platform to the business owner.

### 🌟 Strategic Advantage: Business-Type Flexibility

**The Problem with "One Size Fits All":**
- Traditional platforms enable ALL features for ALL businesses
- Restaurants get e-commerce features they don't need
- Service businesses get inventory management they can't use
- Single locations get chain management that confuses them
- Result: Cluttered UI, confused users, poor adoption

**Your Platform's Advantage:**
- ✅ **Tailored Experience** - Each business type gets exactly what they need
- ✅ **Clean Interface** - No clutter from irrelevant features
- ✅ **Faster Onboarding** - Less to learn, quicker to value
- ✅ **Better Google Integration** - Only sync relevant data to GBP
- ✅ **Higher Success Rate** - Features that match business needs

**Real-World Impact:**

| Business Type | Traditional Platform | Your Platform |
|---------------|---------------------|---------------|
| **Restaurant** | 15 features (uses 5) | 5 features (uses 5) ✅ |
| **Retail Chain** | 15 features (uses 12) | 12 features (uses 12) ✅ |
| **Service Business** | 15 features (uses 3) | 3 features (uses 3) ✅ |
| **E-commerce** | 15 features (uses 10) | 10 features (uses 10) ✅ |

**Result:** 100% feature utilization vs. 33-80% on traditional platforms!

### 🔍 Google Integration Excellence

**Why This Matters for Google Business Profile:**

Traditional platforms sync EVERYTHING to Google, causing:
- ❌ Irrelevant data cluttering GBP
- ❌ Poor quality listings (too much noise)
- ❌ Confused customers (wrong information)
- ❌ Lower search rankings (Google penalizes bad data)

**Your Platform's Approach:**

| Business Type | What Syncs to Google | Result |
|---------------|---------------------|--------|
| **Restaurant** | Hours, Menu Categories, Photos | ✅ Perfect GBP listing |
| **Retail Store** | Hours, Products, Categories, Inventory | ✅ Accurate product info |
| **Service Business** | Hours, Services, Availability | ✅ Clean, focused listing |
| **Chain** | All locations, consistent data | ✅ Brand consistency |

**Google Loves This Because:**
- ✅ High-quality, relevant data only
- ✅ Accurate business information
- ✅ Better user experience
- ✅ Higher engagement rates
- ✅ Improved local search rankings

**Your Competitive Edge:**
> "We don't just integrate with Google - we optimize for Google. Each business type gets a perfectly tailored Google Business Profile that ranks higher and converts better."

## 💡 Benefits

### 1. **Risk Mitigation**
- Test features with real tenant data before going live
- Catch integration issues early
- Prevent bad first impressions

### 2. **Gradual Rollout**
- Enable features one-by-one as they're validated
- Easier troubleshooting if issues arise
- Controlled feature activation

### 3. **Custom Configurations**
- Different tenants get different feature sets
- Industry-specific features
- Subscription tier enforcement

### 4. **Quality Assurance**
- Verify Google Business Profile sync works
- Test product imports
- Validate payment integrations
- Check third-party APIs

## 📋 Proposed Onboarding Checklist

### **Step 1: Account Creation** ✅
- User registers
- Email verification
- Initial tenant created

### **Step 2: Store Identity** ✅ (Already exists)
- Business name
- Address
- Contact info
- Business hours

### **Step 3: Feature Configuration** 🆕 (NEW)
**Purpose:** Validate and enable features before launch

#### Core Features (Always On)
- ✅ Product Management
- ✅ Storefront
- ✅ QR Codes

#### Optional Features (Test & Enable)

**🟢 RECOMMENDED - Test & Enable for Most Tenants**

| Feature | Flag | Status | Priority | Test Checklist |
|---------|------|--------|----------|----------------|
| **Business Hours Sync** | `FF_TENANT_GBP_HOURS_SYNC` | ✅ ACTIVE | HIGH | ☐ Hours configured<br>☐ Sync to GBP works<br>☐ Real-time updates verified<br>☐ Special hours working |
| **Category Management** | `FF_CATEGORY_MANAGEMENT_PAGE` | ✅ ACTIVE | HIGH | ☐ Categories imported<br>☐ Products categorized<br>☐ Taxonomy aligned<br>☐ Search working |
| **Category Sync to GBP** | `FF_TENANT_GBP_CATEGORY_SYNC` | 🎯 PILOT | HIGH | ☐ Categories syncing<br>☐ GBP categories match<br>☐ Updates propagating<br>☐ No conflicts |
| **SKU Scanning** | `FF_SKU_SCANNING` | ✅ ACTIVE | MEDIUM | ☐ Barcode scanner working<br>☐ Product lookup successful<br>☐ Data enrichment verified<br>☐ Images loading |
| **Business Profile** | `FF_BUSINESS_PROFILE` | ✅ ACTIVE | HIGH | ☐ Profile complete<br>☐ Data accurate<br>☐ Public page working<br>☐ SEO optimized |

**🟡 OPTIONAL - Enable Based on Business Type**

| Feature | Flag | Status | Use Case | Test Checklist |
|---------|------|--------|----------|----------------|
| **Chain Management** | `FF_CHAIN_PROPAGATION` | ✅ ACTIVE | Multi-location only | ☐ Organization created<br>☐ Multiple locations added<br>☐ Test propagation works<br>☐ Hero location set |
| **Google Connect Suite** | `FF_GOOGLE_CONNECT_SUITE` | 🎯 PILOT | Google integration | ☐ OAuth working<br>☐ API connected<br>☐ Data syncing<br>☐ Permissions correct |
| **Category Mirroring** | `FF_CATEGORY_MIRRORING` | 🚧 PLANNED | Auto-sync categories | ☐ Mirroring enabled<br>☐ Changes sync both ways<br>☐ No conflicts<br>☐ History tracked |
| **Google Shopping Feed** | `FF_GOOGLE_SHOPPING_FEED` | 🚧 PLANNED | E-commerce focus | ☐ Merchant Center linked<br>☐ Feed generated<br>☐ Products approved<br>☐ Feed updating |
| **Advanced Analytics** | `FF_ADVANCED_ANALYTICS` | 🚧 PLANNED | Data-driven tenants | ☐ Tracking configured<br>☐ Data collecting<br>☐ Reports generating<br>☐ Dashboards loading |
| **Inventory Sync** | `FF_INVENTORY_SYNC` | 🚧 PLANNED | POS integration | ☐ POS connected<br>☐ Test sync successful<br>☐ Stock levels accurate<br>☐ Real-time updates |
| **Email Notifications** | `FF_EMAIL_NOTIFICATIONS` | 🚧 PLANNED | Customer engagement | ☐ SMTP configured<br>☐ Test email sent<br>☐ Templates working<br>☐ Unsubscribe working |

**🔴 AVOID FOR NOW - Not Ready for Production**

| Feature | Flag | Status | Reason to Avoid |
|---------|------|--------|-----------------|
| **AI Product Descriptions** | `FF_AI_DESCRIPTIONS` | 🔮 FUTURE | Example - API costs high, quality inconsistent |
| **Voice Search** | `FF_VOICE_SEARCH` | 🔮 FUTURE | Example - Browser compatibility issues |
| **AR Product Preview** | `FF_AR_PREVIEW` | 🔮 FUTURE | Example - Limited device support |
| **Blockchain Inventory** | `FF_BLOCKCHAIN_INVENTORY` | 🔮 FUTURE | Example - Performance issues, not production-ready |
| **Crypto Payments** | `FF_CRYPTO_PAYMENTS` | 🔮 FUTURE | Example - Regulatory concerns, security review needed |

**Note:** The flags in the "AVOID FOR NOW" section are conceptual examples to illustrate what NOT to enable. They are not currently implemented in the codebase.

### **Step 4: Launch** ✅
- Review enabled features
- Final checks
- Go live!

## 🎨 UI Design

### Feature Configuration Step

```
┌─────────────────────────────────────────────────────────┐
│  Step 3: Feature Configuration                          │
│                                                          │
│  Enable and test features before launching your store   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Core Features (Always Enabled)                         │
│  ✅ Product Management                                   │
│  ✅ Storefront                                           │
│  ✅ QR Code Marketing                                    │
│                                                          │
│  Optional Features (Test & Enable)                      │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🔍 Google Business Profile Sync                 │   │
│  │                                                  │   │
│  │ Status: ⚠️ Not Configured                       │   │
│  │                                                  │   │
│  │ Pre-Launch Checklist:                           │   │
│  │ ☐ Connect GBP account                           │   │
│  │ ☐ Run test sync                                 │   │
│  │ ☐ Verify data accuracy                          │   │
│  │                                                  │   │
│  │ [Configure] [Skip]                              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ⏰ Business Hours Sync                          │   │
│  │                                                  │   │
│  │ Status: ✅ Ready                                │   │
│  │                                                  │   │
│  │ Pre-Launch Checklist:                           │   │
│  │ ✅ Hours configured                             │   │
│  │ ✅ Test sync successful                         │   │
│  │ ✅ Real-time updates verified                   │   │
│  │                                                  │   │
│  │ [Enabled ✓] [Test Again]                       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🔗 Chain Management                             │   │
│  │                                                  │   │
│  │ Status: ⏭️ Skipped (Single Location)            │   │
│  │                                                  │   │
│  │ Enable this if you have multiple locations      │   │
│  │                                                  │   │
│  │ [Enable Later]                                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  [← Back]                    [Skip All] [Continue →]    │
└─────────────────────────────────────────────────────────┘
```

## 🔧 Implementation Plan

### 1. Create FeatureConfigurationStep Component

**File:** `apps/web/src/components/onboarding/FeatureConfigurationStep.tsx`

```typescript
interface FeatureConfig {
  flag: string;
  name: string;
  description: string;
  icon: string;
  required: boolean;
  checklist: ChecklistItem[];
  testEndpoint?: string;
  configureUrl?: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  action?: () => void;
}
```

### 2. Add to OnboardingWizard

```typescript
const steps: Step[] = [
  { id: 'account', title: 'Account', description: 'Create your account' },
  { id: 'store', title: 'Store Identity', description: 'Business information' },
  { id: 'features', title: 'Feature Setup', description: 'Configure & test features' }, // NEW
  { id: 'complete', title: 'Complete', description: 'Launch your store' },
];
```

### 3. Backend: Onboarding Status API

**Endpoint:** `GET /api/tenants/:id/onboarding-status`

```json
{
  "tenantId": "...",
  "onboardingComplete": false,
  "currentStep": "features",
  "features": {
    "FF_TENANT_GBP_SYNC": {
      "enabled": false,
      "tested": false,
      "checklist": {
        "gbp_connected": false,
        "test_sync_run": false,
        "data_verified": false
      }
    },
    "FF_TENANT_GBP_HOURS_SYNC": {
      "enabled": true,
      "tested": true,
      "checklist": {
        "hours_configured": true,
        "sync_successful": true,
        "updates_verified": true
      }
    }
  }
}
```

### 4. Admin Dashboard: Onboarding Monitor

**New Page:** `/settings/admin/onboarding`

Shows all tenants in onboarding:
- Current step
- Features enabled
- Blockers
- Time in onboarding
- Quick actions (enable feature, skip step, complete onboarding)

## 🎯 User Flows

### Flow 1: Standard Onboarding (All Features)
1. User creates account
2. Enters store identity
3. **Feature Configuration:**
   - Admin enables all features
   - Runs tests for each
   - Verifies everything works
4. Launches store with all features enabled

### Flow 2: Minimal Onboarding (Core Only)
1. User creates account
2. Enters store identity
3. **Feature Configuration:**
   - Admin skips optional features
   - Only core features enabled
4. Launches with basic functionality
5. Features enabled later as needed

### Flow 3: Gradual Rollout
1. User creates account
2. Enters store identity
3. **Feature Configuration:**
   - Enable core features + 1-2 optional
   - Test thoroughly
4. Launch
5. Week 1: Enable Google sync
6. Week 2: Enable analytics
7. Week 3: Enable chain management

## 📊 Metrics to Track

### Onboarding Success Metrics
- Time to complete onboarding
- Features enabled per tenant
- Test success rate
- Issues caught before launch
- Support tickets (should decrease)

### Feature Adoption Metrics
- % tenants using each feature
- Time from onboarding to feature enablement
- Feature usage after enablement
- Feature disable rate (indicates issues)

## 🚀 Benefits Summary

### For Admins
- ✅ Catch issues before tenant goes live
- ✅ Systematic feature validation
- ✅ Reduced support burden
- ✅ Better quality control
- ✅ Data-driven feature decisions

### For Tenants
- ✅ Smoother onboarding experience
- ✅ Features work from day 1
- ✅ No surprises after launch
- ✅ Confidence in platform
- ✅ Faster time to value

### For Platform
- ✅ Higher tenant satisfaction
- ✅ Lower churn rate
- ✅ Better feature adoption
- ✅ Clearer usage patterns
- ✅ Easier troubleshooting

## 🎬 Next Steps

1. **Phase 1: Design** (1-2 days)
   - Finalize UI mockups
   - Define feature checklist items
   - Design admin monitoring dashboard

2. **Phase 2: Backend** (2-3 days)
   - Create onboarding status API
   - Add checklist tracking
   - Build test endpoints

3. **Phase 3: Frontend** (3-4 days)
   - Build FeatureConfigurationStep component
   - Integrate with OnboardingWizard
   - Create admin monitoring page

4. **Phase 4: Testing** (2-3 days)
   - Test with real tenant data
   - Verify all checklists work
   - Validate admin workflows

5. **Phase 5: Launch** (1 day)
   - Deploy to staging
   - Train support team
   - Roll out to new tenants

## 💡 Future Enhancements

### Automated Testing
- Auto-run feature tests
- AI-powered issue detection
- Predictive failure alerts

### Smart Recommendations
- "Tenants like you usually enable..."
- Industry-specific feature sets
- Usage-based suggestions

### Compliance Checks
- GDPR requirements
- Industry regulations
- Security validations

### Integration Marketplace
- Third-party integrations
- Plugin system
- Custom feature modules

---

## 📚 Quick Reference: Feature Flag Decision Tree

### For Single Location Retail Store
```
✅ ENABLE:
- FF_TENANT_GBP_SYNC (Google visibility)
- FF_TENANT_GBP_HOURS_SYNC (Keep hours updated)
- FF_CATEGORY_MANAGEMENT_PAGE (Organize products)
- FF_SKU_SCANNING (Quick product entry)
- FF_PHOTO_MANAGEMENT (Professional photos)

❌ SKIP:
- FF_CHAIN_PROPAGATION (Single location)
- FF_INVENTORY_SYNC (No POS)
```

### For Restaurant/Food Service
```
✅ ENABLE:
- FF_TENANT_GBP_SYNC (Critical for discovery)
- FF_TENANT_GBP_HOURS_SYNC (Hours change frequently)
- FF_CATEGORY_MANAGEMENT_PAGE (Menu organization)
- FF_PHOTO_MANAGEMENT (Food photos essential)

🟡 OPTIONAL:
- FF_EMAIL_NOTIFICATIONS (Promotions)

❌ SKIP:
- FF_GOOGLE_SHOPPING_FEED (Not selling products)
- FF_INVENTORY_SYNC (Not applicable)
```

### For Multi-Location Chain
```
✅ ENABLE:
- FF_TENANT_GBP_SYNC (All locations)
- FF_TENANT_GBP_HOURS_SYNC (All locations)
- FF_CATEGORY_MANAGEMENT_PAGE (Consistency)
- FF_CHAIN_PROPAGATION (Critical!)
- FF_ADVANCED_ANALYTICS (Track all locations)

🟡 OPTIONAL:
- FF_GOOGLE_SHOPPING_FEED (If e-commerce)
- FF_EMAIL_NOTIFICATIONS (Marketing)
```

### For E-Commerce Focused
```
✅ ENABLE:
- FF_TENANT_GBP_SYNC (Local visibility)
- FF_CATEGORY_MANAGEMENT_PAGE (Product organization)
- FF_GOOGLE_SHOPPING_FEED (Critical!)
- FF_SKU_SCANNING (Inventory management)
- FF_PHOTO_MANAGEMENT (Product photos)
- FF_ADVANCED_ANALYTICS (Track conversions)

🟡 OPTIONAL:
- FF_INVENTORY_SYNC (If using POS)
- FF_EMAIL_NOTIFICATIONS (Customer engagement)
```

### For Service Business (No Products)
```
✅ ENABLE:
- FF_TENANT_GBP_SYNC (Discovery)
- FF_TENANT_GBP_HOURS_SYNC (Availability)

❌ SKIP:
- FF_CATEGORY_MANAGEMENT_PAGE (No products)
- FF_SKU_SCANNING (No products)
- FF_GOOGLE_SHOPPING_FEED (No products)
- FF_INVENTORY_SYNC (No inventory)
- FF_CHAIN_PROPAGATION (Unless multi-location)
```

## 🎯 Onboarding Checklist Template

### Pre-Onboarding (Admin Prep)
- [ ] Review tenant business type
- [ ] Identify required features
- [ ] Prepare test data
- [ ] Check API credentials (GBP, etc.)

### During Onboarding (With Tenant)
- [ ] Complete store identity
- [ ] Configure recommended features
- [ ] Run all feature tests
- [ ] Verify data accuracy
- [ ] Enable validated features
- [ ] Document any issues

### Post-Onboarding (Follow-up)
- [ ] Monitor feature usage
- [ ] Check for errors
- [ ] Gather feedback
- [ ] Enable additional features as needed
- [ ] Schedule 1-week check-in

## 🚨 Red Flags to Watch For

### During Feature Testing
- ⚠️ **GBP Sync Fails** → Check API credentials, verify account ownership
- ⚠️ **Hours Not Syncing** → Verify timezone, check special hours format
- ⚠️ **Shopping Feed Rejected** → Review product data quality, check Merchant Center policies
- ⚠️ **Chain Propagation Errors** → Verify organization setup, check tenant relationships
- ⚠️ **Photos Not Uploading** → Check file size, verify cloud storage quota

### Signs to Delay Launch
- 🛑 Core features failing tests
- 🛑 Data not syncing to Google
- 🛑 Critical errors in logs
- 🛑 Tenant reporting confusion
- 🛑 Performance issues

### When to Skip Features
- ⏭️ Tenant doesn't need it
- ⏭️ External service not set up
- ⏭️ Feature in beta/experimental
- ⏭️ Tenant wants to add later
- ⏭️ Technical blockers present

---

## 📚 Complete Feature Flag Reference

### ✅ ACTIVE FLAGS (Currently Implemented)

| Flag | Description | Default | Location |
|------|-------------|---------|----------|
| `FF_BUSINESS_PROFILE` | Business profile page | ON | `featureFlags/index.ts` |
| `FF_CATEGORY_MANAGEMENT_PAGE` | Category management UI | ON | `featureFlags/index.ts` |
| `FF_TENANT_GBP_HOURS_SYNC` | Sync hours to Google Business Profile | DB | Platform flags |
| `FF_SKU_SCANNING` | Barcode scanning & enrichment | ENV | `lib/flags.ts` |
| `FF_SCAN_CAMERA` | Camera-based scanning | ENV | `lib/flags.ts` |
| `FF_SCAN_USB` | USB scanner support | ON | `lib/flags.ts` |
| `FF_SCAN_ENRICHMENT` | Product data enrichment | ENV | `lib/flags.ts` |
| `FF_SCAN_DUPLICATE_CHECK` | Duplicate SKU detection | ON | `lib/flags.ts` |
| `FF_CHAIN_PROPAGATION` | Chain product propagation | NEW | Just implemented! |

### 🎯 PILOT FLAGS (Testing with Select Tenants)

| Flag | Description | Pilot Tenants | Status |
|------|-------------|---------------|--------|
| `FF_TENANT_GBP_CATEGORY_SYNC` | Sync categories to GBP | `cmhhzd64m0008g8b47ui6ivnd` | Testing |
| `FF_GOOGLE_CONNECT_SUITE` | Google OAuth & API suite | US East region | Pilot |

### 🚧 PLANNED FLAGS (Documented but Not Implemented)

| Flag | Description | Target Date | Notes |
|------|-------------|-------------|-------|
| `FF_CATEGORY_MIRRORING` | Bi-directional category sync | TBD | After M3 testing |
| `FF_GOOGLE_SHOPPING_FEED` | Google Shopping product feed | TBD | Requires Merchant Center |
| `FF_ADVANCED_ANALYTICS` | Enhanced analytics dashboard | TBD | Data pipeline needed |
| `FF_INVENTORY_SYNC` | POS inventory synchronization | TBD | POS integration required |
| `FF_EMAIL_NOTIFICATIONS` | Customer email campaigns | TBD | SMTP setup needed |

### 🔮 FUTURE/EXAMPLE FLAGS (Conceptual Only)

These are illustrative examples, not actual implementations:
- `FF_AI_DESCRIPTIONS` - AI-generated product descriptions
- `FF_VOICE_SEARCH` - Voice-activated search
- `FF_AR_PREVIEW` - Augmented reality product preview
- `FF_BLOCKCHAIN_INVENTORY` - Blockchain-based inventory
- `FF_CRYPTO_PAYMENTS` - Cryptocurrency payment processing

### 🔄 DEPRECATED/DISABLED FLAGS

| Flag | Description | Deprecated | Replacement |
|------|-------------|------------|-------------|
| `FF_ITEMS_V2_GRID` | Old grid view | OFF | Replaced by default grid |
| `FF_CATEGORY_QUICK_ACTIONS` | Quick action buttons | OFF | Integrated into main UI |
| `FF_APP_SHELL_NAV` | Alternative navigation | OFF | Standard nav preferred |
| `FF_TENANT_URLS` | Tenant-specific URLs | OFF | Standard routing used |
| `FF_MAP_CARD` | Map display card | OFF | Integrated elsewhere |
| `FF_SWIS_PREVIEW` | SWIS preview feature | OFF | Not pursued |
| `FF_DARK_MODE` | Dark theme | OFF | Future consideration |

### 📝 Flag Management Best Practices

**When to Create a New Flag:**
- ✅ Feature is experimental or risky
- ✅ Gradual rollout needed
- ✅ A/B testing required
- ✅ Tenant-specific customization
- ✅ External dependency (API, service)

**When NOT to Create a Flag:**
- ❌ Simple UI change
- ❌ Bug fix
- ❌ Performance optimization
- ❌ Refactoring
- ❌ Already stable feature

**Flag Lifecycle:**
1. **Create** → Add to codebase with default OFF
2. **Test** → Enable for pilot tenants
3. **Rollout** → Gradually increase percentage
4. **Stabilize** → Monitor for issues
5. **Default ON** → Make it standard
6. **Remove** → Clean up flag code

**Flag Naming Convention:**
- Prefix: `FF_` (Feature Flag)
- Scope: `TENANT_` or `PLATFORM_`
- Feature: Descriptive name
- Example: `FF_TENANT_GBP_HOURS_SYNC`

---

**This approach transforms feature flags from a technical tool into a business enabler, ensuring every tenant launches successfully with the right features enabled and validated.** 🚀
