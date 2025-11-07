# Supabase Billing Model Clarification

## 🎯 Key Finding: Organization-Level Billing

**IMPORTANT:** Supabase billing works at the **organization level**, NOT the project level.

### How It Actually Works

```
Organization: VISIBLE SHELF (Pro Plan - $25/mo base)
├── Project 1: rvp-production
│   ├── Compute: Micro (744 hours × $0.01344 = $10/mo)
│   └── Add-ons: Custom domain ($10/mo), PITR, etc.
│
├── Project 2: rvp-staging  
│   ├── Compute: Micro (744 hours × $0.01344 = $10/mo)
│   └── Add-ons: None
│
└── Project 3: rvp-development
    ├── Compute: Micro (744 hours × $0.01344 = $10/mo)
    └── Add-ons: None

Total Bill = $25 (Pro Plan) + $30 (3 × Micro Compute) - $10 (Compute Credits) = $45/mo
```

---

## 💡 Critical Clarifications

### ❌ INCORRECT Understanding (What I Initially Thought)

> "Each project is either Free or Pro plan ($25/mo each)"

**This is WRONG!**

### ✅ CORRECT Understanding

> "The **organization** has a plan (Free/Pro/Team/Enterprise). Each **project** within that organization incurs **compute charges** that are added to the organization's bill."

---

## 📊 Billing Breakdown

### Organization Plan (One-Time Base Cost)

| Plan | Base Cost/Month | Compute Credits | Features |
|------|----------------|-----------------|----------|
| Free | $0 | $0 | Limited resources, 2 projects max |
| Pro | $25 | $10 | Unlimited projects, better support |
| Team | $599 | $10 | Team features, SSO |
| Enterprise | Custom | Custom | Dedicated support, SLA |

### Project Compute Costs (Per Project, Per Hour)

| Compute Size | Hourly Cost | Monthly Cost (~744 hours) |
|--------------|-------------|---------------------------|
| Nano | $0 (Free tier only) | $0 |
| Micro | $0.01344 | ~$10 |
| Small | $0.0206 | ~$15 |
| Medium | $0.0822 | ~$60 |
| Large | $0.1517 | ~$110 |
| XL | $0.2877 | ~$210 |
| 2XL | $0.562 | ~$410 |

**Note:** In paid organizations, Nano instances are billed at Micro rates ($10/mo).

### Project Add-ons (Per Project, Per Hour)

| Add-on | Cost/Month | Notes |
|--------|------------|-------|
| Custom Domain | $10 | Per domain |
| PITR (Point-in-Time Recovery) | $100 | 7-day backup retention |
| IPv4 Address | $4 | Dedicated IPv4 |
| Log Drains | Varies | Based on volume |
| Advanced MFA Phone | $75 (1st project), $10 (additional) | SMS/WhatsApp |

---

## 🧮 Real Cost Examples

### Example 1: Single Production Project

```
Organization: VISIBLE SHELF (Pro Plan)
└── rvp-production (Micro compute)

Monthly Bill:
- Pro Plan base:        $25
- Compute (Micro):      $10
- Subtotal:             $35
- Compute Credits:     -$10
─────────────────────────────
TOTAL:                  $25/mo
```

**Key Insight:** The $10 compute credit covers one Micro instance completely!

---

### Example 2: Production + Staging + Development

```
Organization: VISIBLE SHELF (Pro Plan)
├── rvp-production (Micro)
├── rvp-staging (Micro)
└── rvp-development (Micro)

Monthly Bill:
- Pro Plan base:        $25
- Compute Project 1:    $10
- Compute Project 2:    $10
- Compute Project 3:    $10
- Subtotal:             $55
- Compute Credits:     -$10
─────────────────────────────
TOTAL:                  $45/mo
```

**Cost per project:** $15/mo (after credits applied to first project)

---

### Example 3: Production (Small) + Staging + Dev

```
Organization: VISIBLE SHELF (Pro Plan)
├── rvp-production (Small compute - upgraded for performance)
├── rvp-staging (Micro)
└── rvp-development (Micro)

Monthly Bill:
- Pro Plan base:        $25
- Compute Project 1:    $15 (Small)
- Compute Project 2:    $10 (Micro)
- Compute Project 3:    $10 (Micro)
- Subtotal:             $60
- Compute Credits:     -$10
─────────────────────────────
TOTAL:                  $50/mo
```

---

### Example 4: Multiple Organizations (Enterprise Clients)

```
Account: paul@visibleshelf.com

Organization 1: VISIBLE SHELF (Pro - $25/mo)
├── rvp-production (Micro): $10
├── rvp-staging (Micro): $10
└── rvp-development (Micro): $10
Subtotal: $55 - $10 credits = $45/mo

Organization 2: Enterprise Client A (Pro - $25/mo)
└── client-a-production (Small): $15
Subtotal: $40 - $10 credits = $30/mo

Organization 3: Enterprise Client B (Pro - $25/mo)
└── client-b-production (Small): $15
Subtotal: $40 - $10 credits = $30/mo

─────────────────────────────
TOTAL MONTHLY BILL: $105/mo
```

**Key Insight:** Each organization gets its own $10 compute credit!

---

## 🎯 Updated Recommendations

### For Current Scale (75 tenants)

**Recommended Setup:**

```
Organization: VISIBLE SHELF (Pro Plan - $25/mo)
├── rvp-production (Micro compute)
│   └── All 75 tenants in single database
├── rvp-staging (Micro compute) 
│   └── Testing & demos
└── rvp-development (Micro compute)
    └── Feature development

Monthly Cost: $45/mo
Cost per tenant: $0.60/mo
```

**Alternative (Cost-Optimized):**

```
Organization: VISIBLE SHELF (Pro Plan - $25/mo)
├── rvp-production (Micro compute)
│   └── All 75 tenants
└── rvp-staging (Micro compute, paused when not in use)
    └── Testing only

Monthly Cost: $25-35/mo (depending on staging usage)
Cost per tenant: $0.33-0.47/mo
```

**Note:** Paused projects don't incur compute charges!

---

### For Growth (100-1,000 tenants)

**Recommended Setup:**

```
Organization: VISIBLE SHELF (Pro Plan - $25/mo)
├── rvp-production (Small compute - $15/mo)
│   └── 1,000 tenants
├── rvp-staging (Micro, paused when not in use)
└── rvp-development (Micro, paused when not in use)

Monthly Cost: $30-50/mo (depending on staging/dev usage)
Cost per tenant: $0.03-0.05/mo
```

---

### For Enterprise Clients

**White-Label Strategy:**

```
Organization: VISIBLE SHELF (Pro - $25/mo)
└── rvp-production (Micro): $10
    └── Shared SaaS tenants
    Monthly: $25/mo

Organization: Enterprise Client A (Pro - $25/mo)
└── client-a-dedicated (Small): $15
    └── Dedicated infrastructure
    Monthly: $30/mo
    Charge client: $500-2,000/mo
    Profit: $470-1,970/mo

Organization: Enterprise Client B (Pro - $25/mo)
└── client-b-dedicated (Small): $15
    Monthly: $30/mo
    Charge client: $500-2,000/mo
    Profit: $470-1,970/mo
```

**Total Infrastructure Cost:** $85/mo  
**Total Revenue (2 enterprise clients):** $1,000-4,000/mo  
**Profit Margin:** 91-98%

---

## 💰 Cost Optimization Strategies

### 1. Pause Unused Projects

**Paused projects = $0 compute charges**

```bash
# Pause staging when not in use
supabase projects pause rvp-staging

# Resume when needed
supabase projects resume rvp-staging
```

**Savings:** $10/mo per paused project

---

### 2. Use Compute Credits Wisely

The $10/mo compute credit covers:
- 1 Micro instance completely ($10)
- OR 2/3 of a Small instance ($15)
- OR 1/6 of a Medium instance ($60)

**Strategy:** Keep production on Micro as long as possible, upgrade only when needed.

---

### 3. Consolidate Development Environments

Instead of separate staging + development projects:

```
Organization: VISIBLE SHELF (Pro - $25/mo)
├── rvp-production (Micro): $10
└── rvp-dev-staging (Micro, paused when not in use): $0-10

Monthly: $25-35/mo (vs $45/mo with 3 projects)
Savings: $10-20/mo
```

---

### 4. Monitor Compute Usage

**Set up alerts:**
- CPU > 80% → Consider upgrading compute size
- Memory > 80% → Consider upgrading compute size
- Connections > 80 → Enable connection pooling

**Avoid over-provisioning:** Start small, upgrade based on metrics.

---

## 📊 Revised Cost Projections

### Current Scale (75 tenants)

| Setup | Monthly Cost | Cost/Tenant | Notes |
|-------|--------------|-------------|-------|
| Prod only | $25 | $0.33 | Minimal, no staging |
| Prod + Staging (paused) | $25-35 | $0.33-0.47 | Staging on-demand |
| Prod + Staging + Dev | $45 | $0.60 | Full environments |

**Recommended:** Prod + Staging (paused) = $25-35/mo

---

### Growth (500 tenants)

| Setup | Monthly Cost | Cost/Tenant | Notes |
|-------|--------------|-------------|-------|
| Prod (Micro) + Staging (paused) | $25-35 | $0.05-0.07 | Cost-optimized |
| Prod (Small) + Staging (paused) | $30-40 | $0.06-0.08 | Better performance |
| Prod (Small) + Staging + Dev | $50 | $0.10 | Full environments |

**Recommended:** Prod (Small) + Staging (paused) = $30-40/mo

---

### Scale (1,000 tenants)

| Setup | Monthly Cost | Cost/Tenant | Notes |
|-------|--------------|-------------|-------|
| Prod (Small) + Staging (paused) | $30-40 | $0.03-0.04 | Cost-optimized |
| Prod (Medium) + Staging (paused) | $75-85 | $0.08 | High performance |
| Prod (Medium) + Staging + Dev | $95 | $0.10 | Full environments |

**Recommended:** Prod (Small) + Staging (paused) = $30-40/mo

---

## 🚨 Key Takeaways

### 1. Organization = Billing Entity
- One subscription per organization
- All projects in that org share the subscription
- Each org gets $10/mo compute credits

### 2. Projects = Compute Charges
- Each project incurs hourly compute charges
- Paused projects = $0 charges
- Add-ons are per-project

### 3. Free Tier Limitations
- Free organizations can have max 2 projects
- Projects auto-pause after 7 days inactivity
- Limited compute resources

### 4. Pro Plan Benefits
- $25/mo base + compute charges
- $10/mo compute credits (covers 1 Micro instance)
- Unlimited projects
- No auto-pause
- Better support

### 5. Cost Optimization
- Pause staging/dev when not in use
- Start with Micro, upgrade based on metrics
- Use compute credits strategically
- Monitor usage regularly

---

## 📋 Updated Action Items

### Immediate

1. **Verify current organization plan:**
   - Check Supabase Dashboard → Organization → Billing
   - Confirm if on Free or Pro plan
   - Check current compute size

2. **Assess current project:**
   - Is it production or development?
   - What compute size is it running?
   - Is it being billed?

3. **Optimize current setup:**
   - If on Free tier, consider upgrading to Pro
   - If on Nano, upgrade to Micro (same cost on Pro)
   - Enable connection pooling

### Short-term

1. **Create staging project:**
   - Same organization
   - Micro compute
   - Pause when not in use

2. **Set up monitoring:**
   - CPU/memory alerts
   - Connection pool alerts
   - Cost alerts

3. **Document billing:**
   - Track monthly costs
   - Monitor compute usage
   - Optimize based on metrics

---

## 🔗 Related Documentation

- `SUPABASE_PROJECT_DESIGN.md` - Overall project design
- `SUPABASE_ORGANIZATION_STRATEGY.md` - Organization strategy
- [Supabase Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)
- [Manage Compute Usage](https://supabase.com/docs/guides/platform/manage-your-usage/compute)

---

**Document Version:** 1.0  
**Last Updated:** November 7, 2025  
**Correction:** Organization-level billing clarified  
**Review Date:** December 7, 2025
