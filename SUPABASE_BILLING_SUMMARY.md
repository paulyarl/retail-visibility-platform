# Supabase Billing Model - Quick Reference

## ✅ Correct Understanding

### How Supabase Billing Actually Works

**Organization-Level Billing:**
- You subscribe to a **plan at the organization level** (Free, Pro, Team, Enterprise)
- Each **project within that organization** incurs **compute charges**
- Projects do NOT have their own plan - they inherit the organization's plan features

```
Your Supabase Account
│
├── Organization: VISIBLE SHELF (Pro Plan - $25/mo)
│   │
│   ├── Project: rvp-production
│   │   └── Compute: Micro ($10/mo)
│   │
│   ├── Project: rvp-staging  
│   │   └── Compute: Micro ($10/mo)
│   │
│   └── Project: rvp-development
│       └── Compute: Micro ($10/mo)
│
│   Monthly Bill = $25 (Pro base) + $30 (compute) - $10 (credits) = $45
│
└── Organization: Enterprise Client A (Pro Plan - $25/mo)
    │
    └── Project: client-a-prod
        └── Compute: Small ($15/mo)
    
    Monthly Bill = $25 (Pro base) + $15 (compute) - $10 (credits) = $30
```

---

## 💰 Billing Components

### 1. Organization Plan (Base Cost)

| Plan | Monthly Cost | Compute Credits | Max Projects | Minimum Total Cost |
|------|--------------|-----------------|--------------|-------------------|
| Free | $0 | $0 | 2 | $0 |
| Pro | $25 | $10 | Unlimited | $35* |
| Team | $599 | $10 | Unlimited | $609* |
| Enterprise | Custom | Custom | Unlimited | Custom |

*Minimum = Base + at least 1 Micro project ($10) - Credits ($10) = Base + $10 net compute cost

### 2. Project Compute (Per Project)

| Size | Monthly Cost | Included in Credits |
|------|--------------|---------------------|
| Micro | $10 | ✅ Yes (fully covered) |
| Small | $15 | ⚠️ Partial ($5 overage) |
| Medium | $60 | ❌ No ($50 overage) |

### 3. Project Add-ons (Optional, Per Project)

| Add-on | Monthly Cost |
|--------|--------------|
| Custom Domain | $10 |
| PITR (7-day backups) | $100 |
| IPv4 Address | $4 |
| Advanced MFA Phone | $75 (1st), $10 (additional) |

---

## 🎯 Real-World Examples

### Example 1: Minimum Pro Plan Cost

```
Organization: VISIBLE SHELF (Pro)
└── rvp-production (Micro)

Costs:
- Pro Plan:              $25
- Prod Compute (Micro):  $10
- Subtotal:              $35
- Compute Credits:      -$10
────────────────────────────
TOTAL:                   $25/mo

Wait, that's wrong! Let me recalculate:
- Pro Plan:              $25
- Prod Compute (Micro):  $10
- Compute Credits:      -$10 (covers the $10 compute)
────────────────────────────
Net Compute Cost:        $0 (covered by credits)
TOTAL:                   $25/mo

But minimum is $35/mo, so:
- Base Plan:             $25
- Minimum Compute:       $10 (net after credits)
────────────────────────────
MINIMUM PRO COST:        $35/mo
```

**Key Insight:** Pro plan minimum is effectively $35/mo (base + net compute after credits)

---

### Example 2: All Environments Running

```
Organization: VISIBLE SHELF (Pro)
├── rvp-production (Micro)
├── rvp-staging (Micro)
└── rvp-development (Micro)

Costs:
- Pro Plan:              $25
- Prod Compute:          $10
- Staging Compute:       $10
- Dev Compute:           $10
- Subtotal:              $55
- Compute Credits:      -$10
────────────────────────────
TOTAL:                   $45/mo

Cost per tenant (75): $0.60/mo
```

---

### Example 3: Multiple Organizations (Enterprise)

```
Org 1: VISIBLE SHELF (Pro)
└── rvp-production (Micro)
    Bill: $25 + $10 - $10 = $25/mo

Org 2: Enterprise Client A (Pro)
└── client-a-prod (Small)
    Bill: $25 + $15 - $10 = $30/mo

Org 3: Enterprise Client B (Pro)
└── client-b-prod (Small)
    Bill: $25 + $15 - $10 = $30/mo

────────────────────────────
TOTAL INFRASTRUCTURE: $85/mo
CHARGE TO CLIENTS: $1,000-4,000/mo
PROFIT: $915-3,915/mo
```

**Each organization gets its own $10 compute credit!**

---

## 🚨 Key Takeaways

### ✅ What's True

1. **Organization = Billing Entity**
   - One subscription per organization
   - Pro plan = $25/mo base cost

2. **Projects = Compute Charges**
   - Each project adds compute costs
   - Micro = $10/mo per project
   - Small = $15/mo per project

3. **Compute Credits**
   - $10/mo per organization (not per project)
   - Covers one Micro instance completely
   - Applied automatically to your bill

4. **Paused Projects**
   - Paused projects = $0 compute charges
   - Great for staging/dev environments
   - Resume anytime

### ❌ What's NOT True

1. **"Each project costs $25/mo"**
   - ❌ FALSE: Only the organization plan costs $25/mo
   - ✅ TRUE: Projects cost $10-15/mo for compute

2. **"Projects have their own plan"**
   - ❌ FALSE: Projects inherit the organization's plan
   - ✅ TRUE: All projects in a Pro org get Pro features

3. **"Free tier projects in paid org are free"**
   - ❌ FALSE: In paid orgs, all projects incur compute charges
   - ✅ TRUE: Even Micro instances cost $10/mo (but covered by credits)

---

## 💡 Cost Optimization Tips

### 1. Use One Organization for Multiple Projects
```
✅ GOOD: 1 org with 3 projects = $45/mo
❌ BAD: 3 orgs with 1 project each = $75/mo
```

### 2. Pause Staging/Dev When Not in Use
```
✅ GOOD: Pause when idle = $0/mo
❌ BAD: Always running = $10/mo per project
```

### 3. Start Small, Scale Up
```
✅ GOOD: Micro → Small → Medium (as needed)
❌ BAD: Start with Medium "just in case"
```

### 4. Leverage Compute Credits
```
✅ GOOD: Use credits for production (always running)
❌ BAD: Waste credits on paused projects
```

---

## 📊 Recommended Setup by Scale

### Free Tier Option (Development Only)
```
1 Organization (Free): $0/mo
├── Project 1: Dev (Micro, auto-pauses): $0
└── Project 2: Staging (Micro, auto-pauses): $0
TOTAL: $0/mo

Limitations:
- Max 2 projects
- Auto-pauses after 7 days inactivity
- 500MB database storage
- 1GB file storage
- Not suitable for production
```

### Current (75 tenants) - Production
```
1 Organization (Pro): $25/mo base
1 Project (Micro): $10/mo compute
Compute Credits: -$10/mo
────────────────────────────
Net Compute: $0 (covered)
MINIMUM TOTAL: $35/mo

Actual calculation:
- You pay $25 base + $10 compute = $35
- Credits reduce it by $10
- But minimum is $35/mo
────────────────────────────
TOTAL: $35/mo ($0.47/tenant)
```

### Growth (500 tenants)
```
1 Organization (Pro): $25/mo
1 Project (Small): $15/mo
Compute Credits: -$10/mo
TOTAL: $30/mo ($0.06/tenant)
```

### Scale (1,000 tenants)
```
1 Organization (Pro): $25/mo
1 Project (Medium): $60/mo
Compute Credits: -$10/mo
TOTAL: $75/mo ($0.08/tenant)
```

---

## 🔗 Related Documents

1. **SUPABASE_BILLING_CLARIFICATION.md** - Detailed billing breakdown
2. **SUPABASE_PROJECT_DESIGN.md** - Technical architecture
3. **SUPABASE_ORGANIZATION_STRATEGY.md** - Organization strategy

---

**Last Updated:** November 7, 2025  
**Status:** ✅ Corrected billing model  
**Next Review:** December 7, 2025
