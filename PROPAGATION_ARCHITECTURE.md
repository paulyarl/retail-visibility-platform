# Propagation Architecture: Multi-Scope Data Sync

## 🔄 Overview

The Retail Visibility Platform implements a sophisticated propagation system that operates at three distinct scopes: **Tenant**, **Organization**, and **Platform**. This document details the propagation architecture, strategies, and use cases.

---

## 📊 Propagation Scopes

### **Scope Hierarchy**

```
PLATFORM (Platform Admin)
├─ Manages: All organizations, all locations, all data
├─ Authority: Highest (can override everything)
└─ Use Case: Platform-wide operations
    │
    ├─── ORGANIZATION (Chain HQ)
    │    ├─ Manages: All locations in this organization
    │    ├─ Authority: Organization-level (within chain)
    │    └─ Use Case: Chain-wide consistency
    │        │
    │        ├─── TENANT (Individual Store)
    │             ├─ Manages: Own data
    │             ├─ Authority: Store-level (peer-to-peer)
    │             └─ Use Case: Sharing with siblings
```

---

## 🎯 Tenant-Level Propagation

### **Scope**: Peer-to-Peer (Sibling Sharing)

**Authority**: Voluntary, collaborative  
**Direction**: Horizontal (store-to-store)  
**Model**: "Hey siblings, here's my data if you want it"

### **Available Propagation Types**

#### **1. Items/Products**
```
Store A → Store B, C, D (same owner)
```

**Use Case**: Share product catalog with sibling stores

**Example Workflow**:
```
1. Downtown store creates seasonal menu
2. Clicks "Propagate to Siblings"
3. Selects which siblings (Airport, Mall)
4. Siblings receive products
5. Each sibling can accept/decline
```

**API Request**:
```json
{
  "scope": "tenant",
  "sourceTenantId": "tenant_downtown",
  "targetTenantIds": ["tenant_airport", "tenant_mall"],
  "dataType": "products",
  "strategy": "merge"
}
```

---

#### **2. Categories**
```
Store A → Store B, C, D (same owner)
```

**Use Case**: Share category structure with sibling stores

**Example Workflow**:
```
1. Flagship store reorganizes categories
2. New structure: Beverages > Hot > Coffee > Espresso
3. Propagates to sibling stores
4. Siblings adopt same structure
```

**API Request**:
```json
{
  "scope": "tenant",
  "sourceTenantId": "tenant_flagship",
  "targetTenantIds": ["tenant_store2", "tenant_store3"],
  "dataType": "categories",
  "strategy": "merge"
}
```

---

### **Tenant Propagation Characteristics**

| Aspect | Details |
|--------|---------|
| **Authority** | Voluntary (not forced) |
| **Direction** | Horizontal (peer-to-peer) |
| **Scope** | Within same owner's stores |
| **Control** | Each store decides what to accept |
| **Use Case** | Sharing best practices |
| **Conflict Resolution** | Target store decides |
| **Rollback** | Each store manages own data |

---

## 🏢 Organization-Level Propagation

### **Scope**: Centralized (HQ to All Locations)

**Authority**: Centralized, forced  
**Direction**: Vertical (top-down)  
**Model**: "All stores WILL have these updates"

### **Available Propagation Types** (8 Total)

---

### **Group 1: Product & Catalog Management**

#### **1. Categories** (Location-to-Location)
```
Hero Location → All Other Locations
```

**Use Case**: Propagate category structure from hero location

**Example Workflow**:
```
1. Hero location (flagship) has optimized categories
2. Organization admin clicks "Propagate Categories"
3. All 50 locations receive category structure
4. Chain-wide consistency achieved
```

**API Request**:
```json
{
  "scope": "organization",
  "organizationId": "org_mcdonalds",
  "sourceType": "hero_location",
  "dataType": "categories",
  "strategy": "overwrite"
}
```

---

#### **2. Products/SKUs** (Bulk Sync from Hero)
```
Hero Location → All Other Locations
```

**Use Case**: Sync entire product catalog from hero location

**Example Workflow**:
```
1. Hero location maintains master product catalog
2. Organization admin clicks "Sync All from Hero"
3. Confirmation: "Copy all products to 50 locations?"
4. All locations receive products
5. Result: "Synced 245 products to 50 locations"
```

**API Request**:
```json
{
  "scope": "organization",
  "organizationId": "org_mcdonalds",
  "sourceType": "hero_location",
  "heroTenantId": "tenant_flagship",
  "dataType": "products",
  "strategy": "bulk_copy"
}
```

**Result Display**:
```
✅ Bulk Sync Complete!
Hero Location: Flagship Store
Items Synced: 245 products
Summary:
  • Created: 180 new items
  • Skipped: 65 existing items
```

---

#### **3. GBP Category Sync** (Platform to Google Business Profile)
```
Platform Categories → Google Business Profile
```

**Unique Feature**: Multi-scope support (tenant/organization/platform)

**Scope Options**:

##### **Option A: Single Location** (Testing)
```
Platform Categories → 1 Specific Location's GBP
```

**Use Case**: Test new categories before chain-wide rollout

**Example Workflow**:
```
1. Organization admin adds "Seasonal Items" category
2. Clicks "Sync to GBP"
3. Modal opens: Select scope
4. Chooses "Single Location"
5. Selects "Flagship Store" from dropdown
6. Confirms sync
7. Only flagship store's GBP updated
8. Verifies it looks good
9. Then syncs to all locations
```

**API Request**:
```json
{
  "scope": "tenant",
  "tenantId": "tenant_flagship",
  "strategy": "platform_to_gbp",
  "dryRun": false
}
```

---

##### **Option B: All Locations** (Chain-Wide)
```
Platform Categories → All Locations' GBP
```

**Use Case**: Update all locations after testing

**Example Workflow**:
```
1. Testing confirmed categories work well
2. Clicks "Sync to GBP"
3. Chooses "All Locations"
4. Confirms: "Sync to all 50 locations?"
5. All locations' GBP updated
6. Chain-wide consistency
```

**API Request**:
```json
{
  "scope": "organization",
  "organizationId": "org_mcdonalds",
  "strategy": "platform_to_gbp",
  "dryRun": false
}
```

---

**GBP Sync Modal UI**:
```
┌──────────────────────────────────────────┐
│ Sync Categories to GBP                   │
├──────────────────────────────────────────┤
│ Sync Scope:                              │
│                                          │
│ ○ All Locations                         │
│   Sync to all 50 locations in org       │
│                                          │
│ ● Single Location                       │
│   Test on one location before rollout   │
│                                          │
│ Select Location:                         │
│ [Flagship Store (245 SKUs) ▼]          │
│                                          │
│ ℹ️ Use Case: Test new categories on    │
│   one location before chain-wide rollout│
│                                          │
│ [Cancel]  [Sync Now]                    │
└──────────────────────────────────────────┘
```

**Strategic Use Cases**:

1. **Testing New Categories**
   - Add category to platform
   - Test on 1 location
   - Verify GBP listing
   - Roll out to all

2. **Gradual Rollout**
   - Week 1: Sync to 3 pilot stores
   - Week 2: Sync to 15 regional stores
   - Week 3: Sync to all 50 stores

3. **Location-Specific Categories**
   - Airport store: "Travel Essentials"
   - Regular stores: Standard categories
   - Selective sync per location

---

### **Group 2: Business Information**

#### **4. Business Hours**
```
Organization → All Locations
```

**Use Case**: Standardize operating hours chain-wide

**Example Workflow**:
```
1. Organization sets standard hours
2. Mon-Fri: 7am-9pm
3. Sat-Sun: 8am-8pm
4. Propagates to all locations
5. All locations update GBP hours
```

---

#### **5. Business Profile**
```
Organization → All Locations
```

**Use Case**: Standardize company info, description, contact

**Example Workflow**:
```
1. Organization updates brand description
2. New tagline: "Fresh Coffee, Every Day"
3. Propagates to all locations
4. All locations show consistent branding
```

---

### **Group 3: Platform Configuration**

#### **6. Feature Flags**
```
Organization → All Locations
```

**Use Case**: Enable/disable features chain-wide

**Example Workflow**:
```
1. Organization enables "Online Ordering"
2. Propagates to all locations
3. All locations now have online ordering
4. Consistent feature set
```

---

#### **7. User Roles**
```
Organization → All Locations
```

**Use Case**: Standardize permissions and roles

**Example Workflow**:
```
1. Organization defines "Store Manager" role
2. Permissions: Manage products, view reports
3. Propagates to all locations
4. All locations use same role structure
```

---

### **Group 4: Brand & Marketing**

#### **8. Brand Assets**
```
Organization → All Locations
```

**Use Case**: Distribute logos, colors, marketing materials

**Example Workflow**:
```
1. Organization uploads new logo
2. Updates brand colors
3. Propagates to all locations
4. All locations use consistent branding
```

---

### **Organization Propagation Characteristics**

| Aspect | Details |
|--------|---------|
| **Authority** | Centralized (forced) |
| **Direction** | Vertical (top-down) |
| **Scope** | All locations in organization |
| **Control** | HQ decides, locations comply |
| **Use Case** | Chain-wide consistency |
| **Conflict Resolution** | HQ wins |
| **Rollback** | HQ can rollback |

---

## 🌐 Platform-Level Propagation

### **Scope**: Platform-Wide (All Organizations)

**Authority**: Highest (platform admin)  
**Direction**: Platform → Organizations → Locations  
**Model**: "Platform-wide operations"

### **Available Operations**

#### **1. Organization Management**
```
Platform → All Organizations
```

**Use Case**: Manage all organizations on platform

**Operations**:
- Create organizations
- Update organization settings
- Manage organization tiers
- View organization analytics

---

#### **2. Location Management**
```
Platform → All Locations (across all orgs)
```

**Use Case**: Platform-wide location operations

**Operations**:
- View all locations
- Manage location settings
- Platform-wide analytics
- Cross-organization reporting

---

#### **3. Item Management**
```
Platform → All Items (across all orgs)
```

**Use Case**: Platform-wide product operations

**Operations**:
- View all products
- Platform-wide product analytics
- Cross-organization insights

---

#### **4. Category Management**
```
Platform → All Categories (across all orgs)
```

**Use Case**: Platform-wide category operations

**Operations**:
- Manage platform categories
- Category templates
- Cross-organization category analytics

---

#### **5. GBP Sync (Multi-Scope)**
```
Platform → Tenant/Organization/Platform-Wide
```

**Unique Feature**: Platform admin can choose scope

**Scope Options**:

##### **Tenant Scope**
```json
{
  "scope": "tenant",
  "tenantId": "tenant_specific",
  "strategy": "platform_to_gbp"
}
```

##### **Organization Scope**
```json
{
  "scope": "organization",
  "organizationId": "org_specific",
  "strategy": "platform_to_gbp"
}
```

##### **Platform Scope** (⚠️ Use with caution)
```json
{
  "scope": "platform",
  "strategy": "platform_to_gbp",
  "dryRun": true  // Recommended first
}
```

---

### **Platform Propagation Characteristics**

| Aspect | Details |
|--------|---------|
| **Authority** | Highest (overrides all) |
| **Direction** | Platform-wide |
| **Scope** | All organizations and locations |
| **Control** | Platform admin decides |
| **Use Case** | Platform-wide operations |
| **Conflict Resolution** | Platform wins |
| **Rollback** | Platform can rollback |

---

## 🔐 Access Control Matrix

| Propagation Type | Tenant | Organization Admin | Platform Admin |
|------------------|--------|-------------------|----------------|
| **Items (Sibling)** | ✅ | ✅ | ✅ |
| **Categories (Sibling)** | ✅ | ✅ | ✅ |
| **Categories (Org)** | ❌ | ✅ | ✅ |
| **Products/SKUs (Org)** | ❌ | ✅ | ✅ |
| **GBP Sync (Single)** | ❌ | ✅ | ✅ |
| **GBP Sync (All)** | ❌ | ✅ | ✅ |
| **Business Hours** | ❌ | ✅ | ✅ |
| **Business Profile** | ❌ | ✅ | ✅ |
| **Feature Flags** | ❌ | ✅ | ✅ |
| **User Roles** | ❌ | ✅ | ✅ |
| **Brand Assets** | ❌ | ✅ | ✅ |
| **GBP Sync (Platform)** | ❌ | ❌ | ✅ |
| **Org Management** | ❌ | ❌ | ✅ |

---

## 📊 Propagation Summary

### **By Scope**

```
TENANT SCOPE:
├─ Items/Products (to siblings)
└─ Categories (to siblings)

ORGANIZATION SCOPE:
├─ Categories (location-to-location)
├─ Products/SKUs (bulk from hero)
├─ GBP Category Sync (single or all)
├─ Business Hours
├─ Business Profile
├─ Feature Flags
├─ User Roles
└─ Brand Assets

PLATFORM SCOPE:
├─ Organizations (manage all)
├─ Locations (across all orgs)
├─ Items (across all orgs)
├─ Categories (across all orgs)
└─ GBP Sync (tenant/org/platform)
```

---

### **By Authority**

```
VOLUNTARY (Peer-to-Peer):
└─ Tenant propagation to siblings

CENTRALIZED (Top-Down):
└─ Organization propagation to locations

PLATFORM-WIDE (Highest Authority):
└─ Platform operations across all orgs
```

---

### **By Direction**

```
HORIZONTAL (Peer-to-Peer):
Store A ←→ Store B, C, D

VERTICAL (Top-Down):
Organization HQ
    ↓
All Locations

PLATFORM-WIDE:
Platform
    ↓
All Organizations
    ↓
All Locations
```

---

## 🎯 Strategic Use Cases

### **Use Case 1: New Product Rollout**

**Scenario**: McDonald's launches new burger

**Strategy**: Gradual rollout with testing

```
Week 1: Testing Phase
├─ Add product to platform
├─ Sync to hero location (flagship)
├─ Test with customers
└─ Gather feedback

Week 2: Pilot Phase
├─ Sync to 5 pilot locations
├─ Monitor sales and feedback
└─ Refine product if needed

Week 3: Regional Phase
├─ Sync to 20 regional locations
├─ Continue monitoring
└─ Confirm success

Week 4: Chain-Wide Rollout
├─ Sync to all 50 locations
├─ Chain-wide launch
└─ Marketing campaign
```

**Propagation Flow**:
```
1. Platform → Hero Location (testing)
2. Hero → 5 Pilots (pilot phase)
3. Organization → 20 Regional (regional phase)
4. Organization → All 50 (chain-wide)
```

---

### **Use Case 2: Category Restructure**

**Scenario**: Reorganizing product categories

**Strategy**: Test on one location first

```
Phase 1: Design
├─ Create new category structure
├─ Beverages > Hot > Coffee > Espresso
└─ Add to platform

Phase 2: Testing
├─ Sync to flagship store only
├─ GBP sync to flagship's GBP
├─ Verify GBP listing looks good
└─ Test for 1 week

Phase 3: Rollout
├─ Confirmed it works
├─ Sync categories to all locations
├─ GBP sync to all locations
└─ Chain-wide consistency
```

**Propagation Flow**:
```
1. Platform → Flagship (GBP sync: single location)
2. Verify success
3. Platform → All Locations (GBP sync: all locations)
```

---

### **Use Case 3: Seasonal Menu**

**Scenario**: Holiday specials for coffee shops

**Strategy**: Independent stores share ideas

```
Store A (Downtown):
├─ Creates "Holiday Specials" category
├─ Adds pumpkin spice latte, gingerbread cookie
└─ Propagates to siblings

Store B (Airport):
├─ Receives propagation
├─ Accepts pumpkin spice latte
├─ Declines gingerbread cookie (different customer base)
└─ Adds own items

Store C (Mall):
├─ Receives propagation
├─ Accepts all items
└─ Adds own variations
```

**Propagation Flow**:
```
Store A → Store B, C (voluntary, peer-to-peer)
Each store customizes based on needs
```

---

## 🔄 Conflict Resolution

### **Tenant-Level Conflicts**

**Scenario**: Store A propagates to Store B, but Store B already has the item

**Resolution**:
```
1. Store B receives propagation request
2. System detects conflict
3. Store B chooses:
   ├─ Accept (overwrite local)
   ├─ Decline (keep local)
   └─ Merge (combine both)
```

**Authority**: Target store decides

---

### **Organization-Level Conflicts**

**Scenario**: Organization propagates to all locations, some have local changes

**Resolution**:
```
1. Organization initiates propagation
2. System detects conflicts
3. Organization setting determines behavior:
   ├─ Overwrite (HQ wins)
   ├─ Merge (combine)
   └─ Skip (keep local)
```

**Authority**: Organization decides policy

---

### **Platform-Level Conflicts**

**Scenario**: Platform admin propagates, conflicts with organization settings

**Resolution**:
```
1. Platform initiates propagation
2. Platform admin chooses:
   ├─ Force (platform wins)
   ├─ Respect local (skip conflicts)
   └─ Dry run (preview only)
```

**Authority**: Platform admin decides

---

## 🛡️ Safety Features

### **Confirmation Dialogs**

**Tenant Propagation**:
```
"Share products with sibling stores?"
[Cancel] [Share]
```

**Organization Propagation**:
```
"This will update ALL 50 locations. Continue?"
[Cancel] [Confirm]
```

**Platform Propagation**:
```
"⚠️ PLATFORM-WIDE OPERATION
This will affect ALL organizations and locations.
Are you absolutely sure?"
[Cancel] [I Understand, Proceed]
```

---

### **Dry Run Mode**

**Purpose**: Preview changes before applying

**Example**:
```json
{
  "scope": "organization",
  "organizationId": "org_mcdonalds",
  "strategy": "platform_to_gbp",
  "dryRun": true  // Preview only
}
```

**Response**:
```json
{
  "dryRun": true,
  "preview": {
    "locationsAffected": 50,
    "categoriesAdded": 5,
    "categoriesUpdated": 12,
    "categoriesRemoved": 0
  },
  "message": "Preview only - no changes made"
}
```

---

### **Rollback Capability**

**Organization Level**:
```
1. Propagation creates backup
2. If issues occur, rollback available
3. Restore previous state
4. All locations revert
```

**Platform Level**:
```
1. Platform operations are logged
2. Rollback available for 30 days
3. Can restore to any previous state
4. Audit trail maintained
```

---

## 📈 Monitoring & Analytics

### **Propagation Metrics**

**Tenant Level**:
- Propagations initiated
- Acceptance rate
- Most shared items
- Sibling collaboration stats

**Organization Level**:
- Propagations per type
- Locations affected
- Success rate
- Time to propagate
- Conflict rate

**Platform Level**:
- Platform-wide propagations
- Organizations affected
- Total locations impacted
- System performance

---

### **Propagation Dashboard**

**Organization Dashboard Shows**:
```
Propagation Activity (Last 30 Days)
├─ Products/SKUs: 12 propagations
├─ Categories: 5 propagations
├─ GBP Sync: 8 propagations
├─ Business Hours: 2 propagations
└─ Total Locations Affected: 50

Success Rate: 98.5%
Average Time: 2.3 minutes
```

---

## ✅ Summary

### **Propagation Architecture Strengths**

1. **Multi-Scope**: Tenant, Organization, Platform
2. **Flexible Authority**: Voluntary to Forced
3. **Strategic Control**: Test before rollout
4. **Safety Features**: Confirmations, dry run, rollback
5. **Conflict Resolution**: Clear authority hierarchy
6. **Monitoring**: Comprehensive analytics
7. **Scalability**: Works for 1 or 1,000 locations

### **Core Principle**

> "Right tool for the right scope. Voluntary sharing for peers, centralized control for chains, platform-wide power for admins."

This propagation architecture provides **enterprise-class control** with **next-level flexibility**! 🎉

---

**Document Version**: 1.0  
**Last Updated**: 2024-11-06  
**Status**: Production Architecture
