# Tier Offerings & Location Limits

> [!WARNING]
> **Deprecated — superseded by `TIER_MODEL_V2_SIMPLIFIED.md` (canonical tier model as of 2025‑11‑14).**
> This document describes an earlier iteration of the tier/pricing model and is kept only for historical reference. Do not use it for new implementations.

**Status:** ⚠️ DEPRECATED (see TIER_MODEL_V2_SIMPLIFIED.md)
**Last Updated:** November 2025

## 🎯 Core Principles

### **1. Trial is a STATUS, not a tier**
- Users choose a tier (Google Only, Starter, Professional, etc.)
- Trial status = 14 days, 1 location max (regardless of tier)
- After trial: Full tier limits unlock

### **2. One Location = One Digital Fingerprint**
- Each physical address = One tenant in the system
- No duplicate addresses allowed (enforced globally)
- Google Maps place_id ensures uniqueness

### **3. Tier = Features, Status = Payment State**
- **Tier** determines what features you get
- **Status** (trial/active) determines location limits

---

## 💰 Pricing Tiers

### **Google Only - $0/month**

**Perfect for:** Retailers who just want Google Shopping visibility

**Location Limits:**
- Trial: 1 location (14 days)
- Active: 1 location

**Features:**
- ✅ Google Merchant Center sync
- ✅ Google Shopping feed
- ✅ Manual product entry
- ✅ Manual barcode entry
- ✅ Basic analytics
- ❌ No storefront
- ❌ No directory listing
- ❌ No POS integration

**Use Case:** "I just want my products on Google Shopping, nothing else."

---

### **Starter - $29/month**

**Perfect for:** Small businesses with 1-3 locations

**Location Limits:**
- Trial: 1 location (14 days)
- Active: 3 locations

**Features:**
- ✅ Everything in Google Only
- ✅ **Public storefront** (your branded online store)
- ✅ **Directory listing** (get discovered locally)
- ✅ Barcode scanner
- ✅ Product enrichment
- ✅ QR code generation
- ✅ Basic reporting
- ❌ No POS integration
- ❌ No chain management

**Use Case:** "I have a few stores and want customers to find me online."

---

### **Professional - $99/month**

**Perfect for:** Growing businesses with up to 10 locations

**Location Limits:**
- Trial: 1 location (14 days)
- Active: 10 locations

**Features:**
- ✅ Everything in Starter
- ✅ **Clover POS integration**
- ✅ **Square POS integration**
- ✅ Advanced analytics
- ✅ Bulk operations
- ✅ CSV import/export
- ✅ Priority support
- ✅ Custom branding
- ❌ No chain management

**Use Case:** "I'm growing fast and need POS sync + better tools."

---

### **Enterprise - $249/month**

**Perfect for:** Established businesses with up to 25 locations

**Location Limits:**
- Trial: 1 location (14 days)
- Active: 25 locations

**Features:**
- ✅ Everything in Professional
- ✅ Dedicated account manager
- ✅ Custom integrations
- ✅ API access
- ✅ White-label options
- ✅ SLA guarantees
- ❌ No unlimited locations

**Use Case:** "We're serious about this and need enterprise support."

---

### **Organization - Custom Pricing**

**Perfect for:** Multi-location chains (25+ locations)

**Location Limits:**
- Trial: 1 location (14 days)
- Active: **Unlimited locations**

**Features:**
- ✅ Everything in Enterprise
- ✅ **Unlimited locations**
- ✅ **Chain management** (propagate changes to all locations)
- ✅ **Bulk operations** across all locations
- ✅ Organization-level billing
- ✅ Multi-user management
- ✅ Custom pricing based on location count

**Use Case:** "We're a chain with dozens of locations and need centralized management."

---

## 📊 Comparison Table

| Feature | Google Only | Starter | Professional | Enterprise | Organization |
|---------|-------------|---------|--------------|------------|--------------|
| **Price** | Free | $29/mo | $99/mo | $249/mo | Custom |
| **Trial Locations** | 1 | 1 | 1 | 1 | 1 |
| **Active Locations** | 1 | 3 | 10 | 25 | ∞ |
| **Google Shopping** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Storefront** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Directory** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Barcode Scanner** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **POS Integration** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Advanced Analytics** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Chain Management** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **API Access** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Support** | Email | Email | Priority | Dedicated | Dedicated |

---

## 🏪 Location Limits Explained

### **What is a "Location"?**

A location = One physical retail address (one tenant in the system)

**Examples:**
- ✅ "Joe's Pizza Downtown" at "123 Main St" = 1 location
- ✅ "Joe's Pizza Uptown" at "456 Oak Ave" = 1 location (different address)
- ✅ "Suite 101" vs "Suite 102" in same building = 2 locations (different suites)

### **Location Fingerprinting**

Each location is uniquely identified by:
1. **Google Maps place_id** (preferred)
2. **Normalized address** (fallback)

**No duplicates allowed:**
- ❌ Same owner can't create duplicate addresses
- ❌ Different owners can't share same address
- ✅ System prevents accidental duplicates

### **Trial Period**

**Duration:** 14 days
**Limit:** 1 location (regardless of tier chosen)

**What happens during trial:**
- ✅ Full access to all tier features
- ✅ Can test everything with 1 location
- ❌ Can't create additional locations

**After trial:**
- ✅ Convert to paid → Full location limits unlock
- ❌ Don't convert → Account becomes read-only

---

## 🎨 Feature Pillars

### **1. 🏗️ Foundation**
Get your products online
- Product catalog
- Manual entry
- Barcode entry
- Image management

### **2. 🔍 Visibility**
Make sure people can find you
- Google Shopping sync
- Public storefront
- Directory listing
- SEO optimization

### **3. 🧠 Intelligence**
Understand what's working
- Basic analytics
- Sales reports
- Performance tracking
- Inventory insights

### **4. 🚀 Scale**
Grow beyond one location
- Multi-location management
- Location switching
- Bulk operations
- Chain propagation (Org only)

### **5. ⚡ Automation**
Work smarter, not harder
- POS integration (Pro+)
- Auto-sync inventory
- Scheduled updates
- Webhook automation

### **6. 🔌 Connection**
Connect everything together
- Clover POS (Pro+)
- Square POS (Pro+)
- API access (Enterprise+)
- Custom integrations

### **7. 📈 Growth**
Take it to the next level
- Advanced analytics (Pro+)
- Custom branding (Pro+)
- White-label (Enterprise+)
- Dedicated support (Enterprise+)

---

## 💡 Upgrade Paths

### **From Google Only → Starter**
**Why upgrade:**
- Get a storefront (your own online store)
- Get listed in directory (local discovery)
- Add up to 3 locations
- Use barcode scanner

**Price:** $29/month

### **From Starter → Professional**
**Why upgrade:**
- Connect your POS (Clover or Square)
- Add up to 10 locations
- Advanced analytics
- Priority support

**Price:** $99/month (+$70)

### **From Professional → Enterprise**
**Why upgrade:**
- Add up to 25 locations
- Dedicated account manager
- API access
- Custom integrations

**Price:** $249/month (+$150)

### **From Enterprise → Organization**
**Why upgrade:**
- Unlimited locations
- Chain management (propagate to all)
- Organization-level billing
- Custom pricing

**Price:** Custom (contact sales)

---

## 🔒 Location Limit Enforcement

### **When Creating a Location:**

1. **Check current count** vs tier limit
2. **Validate address uniqueness** (no duplicates)
3. **Block if at limit** with upgrade message

**Error Message Example:**
```
Your Starter plan allows 3 locations. You currently have 3.
Upgrade to Professional to manage up to 10 locations.
```

### **When Downgrading:**

**Scenario:** User has 5 locations on Professional, downgrades to Starter (3 limit)

**Result:**
- ✅ All 5 locations remain active (grandfathered)
- ❌ Can't create new locations until under limit
- ⚠️ Warning shown: "You have 5 locations but your plan allows 3. Delete 2 locations or upgrade to create more."

---

## 📋 Messaging Examples

### **Pricing Page:**

**Starter Tier Card:**
```
Starter - $29/month

⭐ Up to 3 Locations

✓ Public storefront per location
✓ Directory listing
✓ Google Business sync
✓ Barcode scanner
✓ Email support

[Start 14-Day Trial]

Trial includes 1 location
Full 3 locations after trial
```

### **Dashboard Badge:**

**During Trial:**
```
📍 1 / 1 location (Trial)
7 days remaining

Convert to unlock:
• 3 locations (Starter)
• Full feature access

[Convert to Paid]
```

**After Conversion:**
```
📍 2 / 3 locations
Starter Plan
1 location remaining
```

### **Limit Reached:**
```
⚠️ Location Limit Reached

You've created 3/3 locations on your Starter plan.

Upgrade to Professional for:
• Up to 10 locations
• POS integration
• Advanced analytics

[Upgrade to Pro] [View All Plans]
```

---

## 🎯 Key Takeaways

1. **Trial = 14 days, 1 location** (test any tier)
2. **Location = Unique physical address** (no duplicates)
3. **Tier determines features** (what you can do)
4. **Status determines limits** (trial vs active)
5. **Upgrade anytime** (prorated billing)
6. **Grandfathered locations** (keep existing when downgrading)

---

**This is the official pricing model. All features and limits align with these tiers.** 🎉
