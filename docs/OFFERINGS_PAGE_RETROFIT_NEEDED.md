# Offerings Page Retrofit Required

**Current Page:** `/settings/offerings`
**Status:** ⚠️ NEEDS COMPLETE REWRITE
**Priority:** HIGH - Contains outdated pricing

---

## 🚨 Current Issues

1. **Wrong Pricing:**
   - Shows $29, $49, $499, $999 (old prices)
   - Should be: FREE, $29, $99, $249, Custom

2. **Missing Location Limits:**
   - No mention of location limits per tier
   - This is a KEY differentiator

3. **No Trial Messaging:**
   - Doesn't explain 14-day trial = 1 location
   - Doesn't explain trial vs active status

4. **Outdated Tier Names:**
   - Missing "Google Only" free tier
   - Missing "Organization" unlimited tier

---

## ✅ Official Pricing (from TIER_OFFERINGS.md)

### **Google Only - FREE**
- 📍 1 Location
- Google Shopping only
- No storefront, no directory

### **Starter - $29/month**
- 📍 Up to 3 Locations
- Storefront + Directory
- Barcode scanner
- QR codes

### **Professional - $99/month** ⭐ POPULAR
- 📍 Up to 10 Locations
- Clover POS + Square POS
- Advanced analytics
- Priority support

### **Enterprise - $249/month**
- 📍 Up to 25 Locations
- Dedicated manager
- API access
- White-label options

### **Organization - Custom** 🏢 CHAINS
- 📍 Unlimited Locations
- Chain management
- Bulk propagation
- Custom pricing

---

## 📋 Required Changes

### **1. Update Pricing Cards**
Replace entire "Individual Location Subscriptions" section with official 5-tier model.

### **2. Add Location Limit Badges**
Each card needs prominent location limit display:
```tsx
<div className="bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs font-semibold text-blue-800">
  📍 Up to 3 Locations
</div>
```

### **3. Update Trial Section**
Change from "14-Day Free Trial" generic to:
- **Trial = 14 days, 1 location** (test any tier)
- After trial: Full location limits unlock
- No credit card required

### **4. Add Location Fingerprint Callout**
New section explaining:
- One location = One unique address
- No duplicates allowed
- Google Maps verification

### **5. Update Feature Lists**
Align features with official tier model:
- Google Only: No storefront/directory
- Starter: Adds storefront + directory
- Professional: Adds POS integration
- Enterprise: Adds API + white-label
- Organization: Adds chain management

---

## 🎨 Recommended Layout

```
1. Hero Section (existing - keep)
2. What You Get Overview (existing - keep)
3. Feature Progression by Tier (existing - keep)
4. 14-Day Trial Section (update messaging)
5. **Official Pricing Tiers** ⭐ NEW SECTION
   - 5 cards side-by-side
   - Location limits prominent
   - Clear feature lists
6. Location Limits Explained ⭐ NEW SECTION
   - What is a location?
   - Location fingerprinting
   - Trial vs active limits
7. Managed Services (existing - keep)
8. Chain Tiers (existing - keep)
```

---

## 💡 Key Messaging

### **Trial Period:**
> **14-day trial includes 1 location** (test any tier with full features)
> 
> After trial, convert to paid and unlock full location limits for your tier.

### **Location Limits:**
> Each tier includes a specific number of locations (unique physical addresses).
> 
> - Trial: 1 location (14 days)
> - Google Only: 1 location
> - Starter: Up to 3 locations
> - Professional: Up to 10 locations
> - Enterprise: Up to 25 locations
> - Organization: Unlimited locations

### **Upgrade Path:**
> Start with any tier during your trial. Upgrade anytime to add more locations and unlock advanced features.

---

## 🔧 Implementation Steps

1. **Backup current page** (it has good content, just wrong pricing)
2. **Create new pricing section** with official 5 tiers
3. **Add location limit badges** to each card
4. **Update trial messaging** throughout
5. **Add "Location Limits Explained" section**
6. **Test on mobile** (5 cards need to stack properly)
7. **Deploy and verify**

---

## 📍 Reference Documents

- `docs/TIER_OFFERINGS.md` - Official pricing model
- `docs/TRIAL_VS_TIER_MODEL.md` - Trial status explained
- `docs/LOCATION_FINGERPRINT_MODEL.md` - Location uniqueness

---

**This page is customer-facing and needs to match official pricing ASAP!** 🚨
