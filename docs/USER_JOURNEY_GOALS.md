# RVP User Journey & Goals - Cascading Impact Model

## Overview

This document organizes user journeys by **cascading impact** - measuring how many users and systems are affected by each role's actions. Impact flows from platform-level (affects all tenants) down to tenant-level (affects team and customers).

**Impact Hierarchy:**
1. **PLATFORM_ADMIN** → Entire platform, all tenants, all users
2. **PLATFORM_SUPPORT** → Individual customers, platform quality
3. **PLATFORM_VIEWER** → Platform insights, security audits
4. **TENANT_OWNER** → Their tenant(s), entire team, all customers
5. **TENANT_ADMIN** → Same as OWNER (no billing)
6. **TENANT_MANAGER** → Operations, team workflows
7. **TENANT_MEMBER** → Product data quality
8. **TENANT_VIEWER** → Observation, reporting

---

## 1. PLATFORM_ADMIN (Maximum Impact)

**Impact Scope:** All tenants, all users, entire platform  
**Cascade Multiplier:** 1000x (decisions affect thousands)

### Critical Goals

#### 1.1 Platform Health & Uptime
**Affected:** ALL users  
**Impact:** Platform down = everyone blocked

- Monitor system health, API performance, database
- Proactive issue detection and alerts
- Rapid resolution < 30 minutes
- **Cascade:** ✅ Stable → All work | ❌ Down → All blocked

#### 1.2 Feature Deployment
**Affected:** All users gaining new capabilities  
**Impact:** New features enable/block workflows

- Test across all tiers and roles
- Staged rollout with monitoring
- Track adoption and iterate
- **Cascade:** ✅ Good rollout → Smooth adoption | ❌ Bugs → Support overwhelmed

#### 1.3 Capacity & Infrastructure
**Affected:** All tenants approaching limits  
**Impact:** Growth blocked or enabled

- Monitor platform capacity
- Proactive scaling before limits
- Optimize performance
- **Cascade:** ✅ Proactive → Users never blocked | ❌ Reactive → Frustration

### High Impact Goals

#### 1.4 User Support & Enablement
**Affected:** Individual tenants and teams  
**Impact:** Customer success or churn

- Access any tenant (unlimited)
- Resolve complex issues
- Educate and empower
- **Cascade:** ✅ Fast support → Productive users | ❌ Slow → Churn

#### 1.5 Strategic Decisions
**Affected:** All users over time  
**Impact:** Platform direction

- Analyze platform data
- Feature prioritization
- Tier/pricing adjustments
- **Cascade:** ✅ Good decisions → Growth | ❌ Bad → Stagnation

---

## 2. PLATFORM_SUPPORT (High Impact)

**Impact Scope:** Individual customers, platform quality  
**Cascade Multiplier:** 10-100x (support affects customer teams)

**Access Limits:**
- ✅ **Unlimited tenant access** (can support any customer)
- ✅ **Read-only on customer tenants** (cannot modify customer data)
- ⚠️ **3 tenants per owner limit** (regardless of owner's tier)

### Critical Goals

#### 2.1 Customer Support
**Affected:** Individual tenant and their team  
**Impact:** Team productivity

- Access unlimited customer tenants (read-only)
- Diagnose and guide solutions
- Escalate complex issues
- Cannot modify customer data (security)
- **Cascade:** ✅ Fast support → Team productive | ❌ Slow → Team blocked

#### 2.2 Testing & QA
**Affected:** All users (bug prevention)  
**Impact:** Platform quality

- Create test tenants (up to 3 per owner)
- **Limited to 3 tenants per owner (regardless of tier)**
- Validate bug fixes
- Test new features
- Delete test tenants when done
- **Cascade:** ✅ Good testing → Fewer bugs | ❌ Poor → Customer issues

### Medium Impact Goals

#### 2.3 Documentation
**Affected:** Support team, self-service users  
**Impact:** Support efficiency

- Document solutions
- Update FAQs
- Enable self-service
- **Cascade:** ✅ Good docs → Self-service | ❌ Poor → More tickets

---

## 3. PLATFORM_VIEWER (Medium Impact)

**Impact Scope:** Platform insights, security  
**Cascade Multiplier:** Indirect (informs decisions)

### Medium Impact Goals

#### 3.1 Analysis & Reporting
**Affected:** Platform team, strategic decisions

- Generate reports and insights
- Identify trends and opportunities
- **Cascade:** ✅ Good analysis → Better decisions

#### 3.2 Audit & Compliance
**Affected:** All users (security)

- Review configurations
- Document findings
- Monitor compliance
- **Cascade:** ✅ Good audits → Secure platform

---

## 4. TENANT_OWNER (High Tenant Impact)

**Impact Scope:** Their tenant(s), entire team, all customers  
**Cascade Multiplier:** 10-50x (affects whole team)

### Critical Goals

#### 4.1 Subscription & Tier Management
**Affected:** ALL team members  
**Impact:** Defines team capabilities

- Choose appropriate tier
- Monitor capacity (80%+ warnings)
- Upgrade proactively
- **Cascade:** ✅ Right tier → Team productive | ❌ Wrong tier → Team limited

#### 4.2 Team Management & Permissions
**Affected:** All team members  
**Impact:** Who can do what

- Invite with appropriate roles
- VIEWER → MEMBER → MANAGER → ADMIN
- Match role to responsibilities
- **Cascade:** ✅ Good permissions → Efficient | ❌ Wrong → Blocked or insecure

#### 4.3 Get Products Online
**Affected:** Team and customers  
**Impact:** Core value delivery

- Choose integration (POS/Scanner/Manual/Bulk)
- Verify sync status
- Launch storefront
- **Cascade:** ✅ Products online → Revenue | ❌ Offline → No sales

### High Impact Goals

#### 4.4 Optimize Visibility
**Affected:** Customer discovery

- Assign Google categories
- Enhance product data
- Complete business profile
- **Cascade:** ✅ Optimized → More traffic | ❌ Poor → Invisible

#### 4.5 Monitor & Upgrade
**Affected:** Team growth

- Check capacity usage
- Understand tier limits
- Upgrade before 100%
- **Cascade:** ✅ Proactive → Smooth growth | ❌ Reactive → Emergency

---

## 5. TENANT_ADMIN (Same as OWNER)

**Impact Scope:** Same as OWNER  
**Differences:** Cannot manage billing or delete tenant

All goals identical to TENANT_OWNER except:
- ❌ Cannot access Settings → Subscription
- ❌ Cannot delete tenant
- ✅ All other capabilities identical

---

## 6. TENANT_MANAGER (Medium Tenant Impact)

**Impact Scope:** Operations, team workflows  
**Cascade Multiplier:** 5-20x (affects operational efficiency)

### Critical Goals

#### 6.1 Daily Inventory Management
**Affected:** Product accuracy, team efficiency

- Update products (`canEdit` ✓)
- Scan new products (`canEdit` ✓)
- Bulk operations (`canManage` ✓)
- Use Quick Start (`canManage` ✓)
- **Cascade:** ✅ Efficient → Team productive | ❌ Manual → Slow, errors

#### 6.2 Chain Propagation (Org Tier)
**Affected:** All locations

- Access Propagation Hub [ORG]
- Push products to all locations
- Monitor propagation status
- **Cascade:** ✅ Propagate → Consistency | ❌ Manual → Inconsistency

### High Impact Goals

#### 6.3 Category Management
**Affected:** Google sync quality

- Assign categories (bulk or Quick Start)
- Fix sync issues
- **Cascade:** ✅ Categorized → Google sync | ❌ Missing → Invisible

#### 6.4 Monitor Performance
**Affected:** Operational awareness

- Daily dashboard review
- Address issues quickly
- **Cascade:** ✅ Proactive → Issues caught early

---

## 7. TENANT_MEMBER (Low-Medium Impact)

**Impact Scope:** Product data quality  
**Cascade Multiplier:** 2-5x (affects data accuracy)

### High Impact Goals

#### 7.1 Update Individual Products
**Affected:** Product accuracy

- Edit products (`canEdit` ✓)
- Add photos (required for sync)
- Scan barcodes
- **Cascade:** ✅ Accurate → Good sync | ❌ Errors → Bad data

#### 7.2 Maintain Quality
**Affected:** Customer experience

- Review product data
- Fix sync issues
- Monitor indicators
- **Cascade:** ✅ Quality → Customer trust | ❌ Poor → Lost sales

### Medium Impact Goals

#### 7.3 Learn Platform
**Affected:** Personal growth

- Understand limitations
- See locked features (tooltips explain why)
- Request role upgrade
- **Cascade:** ✅ Learning → Career growth

---

## 8. TENANT_VIEWER (Minimal Impact)

**Impact Scope:** Observation, reporting  
**Cascade Multiplier:** 1x (read-only)

### Medium Impact Goals

#### 8.1 View Information
**Affected:** Personal awareness

- Browse inventory (read-only)
- Check sync status
- Preview storefront (`canView` ✓)
- **Cascade:** ✅ Informed → Better reporting

#### 8.2 Monitor & Report
**Affected:** Team awareness

- View dashboard stats
- Report issues to managers
- **Cascade:** ✅ Good reporting → Issues caught

### Low Impact Goals

#### 8.3 Learn Platform
**Affected:** Future preparation

- Explore interface
- Understand limitations
- Prepare for promotion
- **Cascade:** ✅ Learning → Ready for upgrade

---

## Cascade Effect Summary

### Platform Level (Affects All)
```
PLATFORM_ADMIN
    ↓ Platform stable/features deployed
ALL TENANTS ENABLED
    ↓ Support responsive
CUSTOMERS SUCCESSFUL
```

### Tenant Level (Affects Team)
```
TENANT_OWNER
    ↓ Right tier/permissions
TEAM ENABLED
    ↓ MANAGER uses bulk tools
OPERATIONS EFFICIENT
    ↓ MEMBER maintains quality
DATA ACCURATE
    ↓ VIEWER reports issues
PROBLEMS CAUGHT
```

### Impact Multipliers

| Role | Direct Impact | Cascade Multiplier | Affected Users |
|------|--------------|-------------------|----------------|
| PLATFORM_ADMIN | Platform-wide | 1000x | All users |
| PLATFORM_SUPPORT | Per-customer | 10-100x | Customer teams |
| PLATFORM_VIEWER | Insights | Indirect | Via decisions |
| TENANT_OWNER | Tenant-wide | 10-50x | Entire team |
| TENANT_ADMIN | Tenant-wide | 10-50x | Entire team |
| TENANT_MANAGER | Operations | 5-20x | Team workflows |
| TENANT_MEMBER | Data quality | 2-5x | Data accuracy |
| TENANT_VIEWER | Observation | 1x | Self only |

### Key Insights

**Platform Users:**
- Every action affects multiple tenants
- Decisions cascade to thousands of users
- Responsibility for platform health

**Tenant Owners:**
- Tier choice affects entire team
- Permission decisions enable/block workflows
- Strategic impact on team success

**Tenant Managers:**
- Bulk tools multiply efficiency
- Propagation affects all locations
- Operational decisions cascade down

**Tenant Members:**
- Data quality affects customer experience
- Individual actions accumulate
- Foundation for team success

**Tenant Viewers:**
- Minimal direct impact
- Important for reporting
- Learning for future roles

---

## Feature Access Matrix

| Feature           | VIEWER    | MEMBER    | MANAGER   | ADMIN | OWNER | PLATFORM  |
|---------  ----    |---------|---------|---------|-------|-------|----------|
| View Products     | ✓        | ✓      | ✓       | ✓     | ✓     | ✓        |
| Edit Products     | ✗        | ✓      | ✓       | ✓     | ✓     | ✓        |
| Scan Barcodes     | ✗        | ✓      | ✓       | ✓     | ✓     | ✓        |
| Bulk Upload       | ✗        | ✗      | ✓       | ✓     | ✓     | ✓        |
| Quick Start       | ✗        | ✗      | ✓       | ✓     | ✓     | ✓        |
| Propagation       | ✗        | ✗      | ✓       | ✓     | ✓     | ✓        |
| Team Management   | ✗        | ✗      | ✗       | ✓     | ✓     | ✓        |
| Billing           | ✗        | ✗      | ✗       | ✗     | ✓     | ✓        |
| Delete Tenant     | ✗        | ✗      | ✗       | ✗     | ✓     | ✓ (ADMIN) |
| Platform Admin    | ✗        | ✗      | ✗       | ✗     | ✗     | ✓ (ADMIN only) |

---

**Document Version:** 2.0 - Cascading Impact Model  
**Last Updated:** November 11, 2024  
**Maintained By:** Platform Team
