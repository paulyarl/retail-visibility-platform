# Supabase Billing - Final Clarification

## ✅ Confirmed Facts

### Organization Plans

| Plan | Base Cost | Compute Credits | Max Projects | Minimum Monthly Cost |
|------|-----------|-----------------|--------------|---------------------|
| **Free** | $0 | $0 | **2** | $0 |
| **Pro** | $25 | $10 | **Unlimited** | **$35** |
| **Team** | $599 | $10 | Unlimited | $609 |
| **Enterprise** | Custom | Custom | Unlimited | Custom |

### Key Facts

1. **Free Tier:**
   - Max 2 projects per organization
   - $0 cost
   - Projects auto-pause after 7 days inactivity
   - Perfect for dev + staging (non-production)

2. **Pro Plan:**
   - Minimum cost: **$35/month**
   - Base: $25 + Minimum compute: $10 (net after $10 credits)
   - Unlimited projects
   - No auto-pause
   - Required for production

3. **Compute Credits:**
   - $10/month per Pro organization
   - Applied to compute charges
   - Effectively covers 1 Micro instance
   - But minimum bill is still $35/mo

---

## 💰 Real Cost Breakdown

### Free Tier Strategy (Development Only)

```
Organization: VISIBLE SHELF (Free)
├── Project 1: rvp-dev (Micro, auto-pauses)
└── Project 2: rvp-staging (Micro, auto-pauses)

Monthly Cost: $0

Limitations:
✗ Max 2 projects (no room for production)
✗ Auto-pauses after 7 days inactivity
✗ 500MB database limit
✗ 1GB storage limit
✗ Not suitable for production workloads

Use Case: Perfect for testing before going to production
```

---

### Pro Plan - Minimum Cost (Production)

```
Organization: VISIBLE SHELF (Pro)
└── rvp-production (Micro)

Billing:
- Pro Plan base:         $25
- Compute (Micro):       $10
- Subtotal:              $35
- Compute Credits:      -$10
────────────────────────────
Effective Cost:          $25

But Supabase minimum is: $35/mo

So actual bill:          $35/mo
```

**Why $35 minimum?**
- Pro plan requires at least one running project
- Base ($25) + Net compute ($10 after credits) = $35

---

### Pro Plan - Multiple Projects

```
Organization: VISIBLE SHELF (Pro)
├── rvp-production (Micro)
├── rvp-staging (Micro)
└── rvp-development (Micro)

Billing:
- Pro Plan base:         $25
- Prod Compute:          $10
- Staging Compute:       $10
- Dev Compute:           $10
- Subtotal:              $55
- Compute Credits:      -$10
────────────────────────────
TOTAL:                   $45/mo

Cost breakdown:
- First project: $35 (base + net compute)
- Additional projects: $10 each
```

---

### Pro Plan - With Paused Projects (Recommended)

```
Organization: VISIBLE SHELF (Pro)
├── rvp-production (Micro - always running)
├── rvp-staging (Micro - paused when not in use)
└── rvp-development (Micro - paused when not in use)

Billing (staging & dev paused):
- Pro Plan base:         $25
- Prod Compute:          $10
- Staging Compute:       $0 (paused)
- Dev Compute:           $0 (paused)
- Subtotal:              $35
- Compute Credits:      -$10
────────────────────────────
TOTAL:                   $35/mo

Billing (all running):
- Pro Plan base:         $25
- All 3 projects:        $30
- Subtotal:              $55
- Compute Credits:      -$10
────────────────────────────
TOTAL:                   $45/mo

Cost range: $35-45/mo depending on usage
```

**Best Practice:** Pause staging/dev when not actively testing!

---

## 🎯 Recommended Strategies

### Strategy 1: Free Tier for Learning (Pre-Production)

```
Organization: VISIBLE SHELF (Free)
├── dev-project (for development)
└── staging-project (for testing)

Cost: $0/mo
Use: Learn Supabase, test features, develop locally
Limitation: Not for production (auto-pauses, limited resources)
```

**When to use:**
- You're still building the platform
- Not ready for production yet
- Want to test Supabase features
- Need dev + staging environments

---

### Strategy 2: Pro Plan - Production Only (Minimum Cost)

```
Organization: VISIBLE SHELF (Pro)
└── rvp-production (Micro)

Cost: $35/mo
Use: Production workload only
Dev/Staging: Use local database or separate free org
```

**When to use:**
- Production is ready
- Want minimum Supabase cost
- Can use local dev environment
- Don't need cloud staging

---

### Strategy 3: Pro Plan - Full Environments (Recommended)

```
Organization: VISIBLE SHELF (Pro)
├── rvp-production (Micro - always on)
├── rvp-staging (Micro - pause when idle)
└── rvp-development (Micro - pause when idle)

Cost: $35-45/mo (depending on staging/dev usage)
Use: Complete cloud-based development workflow
```

**When to use:**
- Production is live
- Need cloud staging for testing
- Team needs shared dev environment
- Want CI/CD integration

---

### Strategy 4: Hybrid (Free + Pro)

```
Organization 1: VISIBLE SHELF (Pro)
└── rvp-production (Micro)
    Cost: $35/mo

Organization 2: VISIBLE SHELF Dev (Free)
├── rvp-dev (Micro)
└── rvp-staging (Micro)
    Cost: $0/mo

TOTAL: $35/mo
```

**When to use:**
- Want to minimize costs
- Production needs Pro features
- Dev/staging can tolerate auto-pause
- Okay with managing 2 organizations

**Limitation:** Dev/staging will auto-pause after 7 days

---

## 📊 Cost Comparison Table

| Setup | Org Plan | Projects | Monthly Cost | Best For |
|-------|----------|----------|--------------|----------|
| **Free Tier** | Free | 2 (dev + staging) | $0 | Pre-production, learning |
| **Pro Minimum** | Pro | 1 (production) | $35 | Production only, local dev |
| **Pro Full** | Pro | 3 (prod + staging + dev) | $45 | Full cloud workflow |
| **Pro Optimized** | Pro | 3 (prod always, others paused) | $35-45 | Cost-conscious production |
| **Hybrid** | Pro + Free | 1 prod + 2 dev/staging | $35 | Maximum cost savings |

---

## 💡 Recommendations for Your Platform

### Current State (75 Tenants)

**Recommended: Pro Plan - Optimized**

```
Organization: VISIBLE SHELF (Pro)
├── rvp-production (Micro - always running)
│   └── 75 tenants, growing
├── rvp-staging (Micro - pause when not testing)
└── rvp-development (Micro - pause when not developing)

Monthly Cost: $35-45
Cost per tenant: $0.47-0.60
```

**Why this setup:**
- ✅ Production always available (no auto-pause)
- ✅ Unlimited projects (room to grow)
- ✅ Staging/dev available when needed
- ✅ Pause staging/dev to save $10-20/mo
- ✅ Only $35/mo when staging/dev paused

---

### Growth Phase (500 Tenants)

**Recommended: Pro Plan - Upgraded Compute**

```
Organization: VISIBLE SHELF (Pro)
├── rvp-production (Small - $15/mo)
│   └── 500 tenants
├── rvp-staging (Micro - paused)
└── rvp-development (Micro - paused)

Monthly Cost:
- Base: $25
- Prod (Small): $15
- Staging: $0 (paused)
- Dev: $0 (paused)
- Subtotal: $40
- Credits: -$10
────────────────────
TOTAL: $30/mo

Cost per tenant: $0.06
```

---

### Scale Phase (1,000+ Tenants)

**Option A: Single Large Project**
```
Organization: VISIBLE SHELF (Pro)
└── rvp-production (Medium - $60/mo)

Cost: $25 + $60 - $10 = $75/mo
Cost per tenant: $0.08
```

**Option B: Geographic Distribution**
```
Organization: VISIBLE SHELF (Pro)
├── rvp-us-east (Small - $15)
├── rvp-us-west (Small - $15)
├── rvp-europe (Small - $15)
└── rvp-asia (Small - $15)

Cost: $25 + $60 - $10 = $75/mo
Cost per tenant: $0.08 (250 per region)
Benefits: Lower latency, GDPR compliance
```

---

## 🚨 Important Clarifications

### ❌ Common Misconceptions

1. **"Free tier projects in Pro org are free"**
   - FALSE: All projects in Pro org incur compute charges
   - Even if you don't use them, running projects cost money

2. **"Compute credits make first project free"**
   - PARTIALLY TRUE: Credits offset compute cost
   - BUT: Minimum Pro bill is still $35/mo

3. **"I can have unlimited projects on Free tier"**
   - FALSE: Free tier = max 2 projects
   - Pro tier = unlimited projects

4. **"Paused projects still cost money"**
   - FALSE: Paused projects = $0 compute charges
   - Great for staging/dev environments

### ✅ Key Facts to Remember

1. **Free Tier:**
   - Max 2 projects
   - $0 cost
   - Auto-pauses after 7 days
   - Good for: dev + staging (non-production)

2. **Pro Plan:**
   - Minimum $35/mo
   - Unlimited projects
   - No auto-pause
   - Required for: production

3. **Pausing Projects:**
   - Paused = $0 compute charges
   - Can pause/resume anytime
   - Great for: staging, dev, demo environments

4. **Compute Credits:**
   - $10/mo per organization
   - Applied automatically
   - Covers 1 Micro instance worth of compute

---

## 📋 Decision Matrix

### Should I Use Free Tier?

✅ **Yes, if:**
- Still building/testing the platform
- Not ready for production
- Need dev + staging only
- Want to learn Supabase first
- Okay with auto-pause after 7 days

❌ **No, if:**
- Production is ready
- Need 24/7 availability
- Need more than 2 projects
- Need > 500MB database
- Need > 1GB storage

---

### Should I Upgrade to Pro?

✅ **Yes, if:**
- Production is live or ready
- Need 24/7 availability
- Need more than 2 projects
- Need better support
- Want no auto-pause

❌ **No, if:**
- Still in development phase
- Can tolerate auto-pause
- Only need 2 projects max
- Want to minimize costs

---

## 🎯 Final Recommendation

### For Your Current State (75 Tenants, Production Ready)

**Go with Pro Plan - Optimized Setup:**

```
Organization: VISIBLE SHELF (Pro - $35/mo minimum)
├── rvp-production (Micro - always running)
│   └── All 75 tenants
│   └── Railway API connects here
│   └── Vercel frontend connects here
│
├── rvp-staging (Micro - pause when not testing)
│   └── For testing new features
│   └── Resume before deployments
│
└── rvp-development (Micro - pause when not developing)
    └── For local development
    └── Resume when needed

Monthly Cost: $35-45
- Production always on: $35/mo
- Staging/dev active: +$10 each
- Pause staging/dev when idle: save $20/mo

Cost per tenant: $0.47-0.60
```

**Why this is optimal:**
- ✅ Production never pauses (reliable)
- ✅ Room for 3 environments
- ✅ Can pause staging/dev to save money
- ✅ Only $35/mo when optimized
- ✅ Unlimited projects (room to grow)

---

**Document Version:** 2.0 (Final)  
**Last Updated:** November 7, 2025  
**Status:** ✅ Confirmed with user  
**Next Review:** December 7, 2025
