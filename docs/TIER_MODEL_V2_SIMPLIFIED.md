# Simplified Tier Model (V2) – No Free Plan, 4 Tiers

**Status:** Draft strategy (not yet official)
**Context:** Infrastructure and support costs require that every active tenant be a paying customer after trial. This document proposes a simplified, sustainable tier model with **no recurring free tier**, a maximum of **4 standard tiers**, and **location count + SKU count** as primary gates, with premium features layered up the ladder.

---

## 1. Design Principles

1. **No recurring free plan**
   - 14-day trial remains the only way to use the platform for $0.
   - After trial, tenants must choose a paid tier or become read-only.

2. **Four standard tiers max**
   - **Starter**, **Professional**, **Enterprise**, **Organization**.
   - Names reuse the current model to minimize churn in messaging.

3. **Location count and SKU count as core gates**
   - Each tier defines:
     - **Max locations** (per account).
     - **Max SKUs per location** (catalog size).
   - These are visible in-product (badges, warnings, upgrade prompts).

4. **Premium features ladder up the tiers**
   - Higher tiers add capabilities, not just higher limits:
     - POS integration, advanced analytics, automation, white-label, API, chain management.

5. **Align with platform pillars & growth engines**
   - Early tiers: lean into **Foundation** + **Visibility** (Storefront + Google).
   - Mid tiers: add **Connection** + **Intelligence** (POS + analytics).
   - Top tiers: emphasize **Scale** + **Growth** (multi-location, org dashboard, API, white-label).

6. **Sustainable economics**
   - No tier should have negative unit economics at scale.
   - POS integrations and high-touch support are reserved for higher tiers.

---

## 2. Tier Overview (Proposed)

> **Note:** Prices are suggested starting points based on prior docs. Final pricing should be validated against CAC/LTV and competitor benchmarks.

### 2.1 Starter – Visibility for Small Retailers

**Target:** 1–3-location retailers getting online presence + Google visibility.

- **Proposed price:** `$29/month`
- **Max locations:** `3`
- **Max SKUs per location:** `500`

**Pillars emphasized:**
- 🏗️ **Foundation** – Product catalog, manual entry, images.
- 🔍 **Visibility** – Storefront + Google Shopping + directory.

**Included capabilities:**
- Google Merchant Center sync & Shopping feed.
- Public storefront per location.
- Directory listing.
- Basic multi-location management – up to 3 locations with simple product and user role propagation.
- Manual product + barcode entry.
- Basic barcode scanner (camera/USB) – limited usage.
- Basic product enrichment (limited lookups/month).
- QR code generation.
- Basic analytics & reporting.
- Email support.

**Excluded / gated to higher tiers:**
- POS integration (Clover/Square).
- Advanced analytics.
- Bulk operations at scale.
- API access.
- White-label options.
- Chain management / org dashboard.

---

### 2.2 Professional – Connected & Growing

**Target:** Growing retailers that need POS sync, better analytics, and more capacity.

- **Proposed price:** `$99/month`
- **Max locations:** `10`
- **Max SKUs per location:** `5,000`

**Pillars emphasized:**
- 🏗️ **Foundation** – Larger catalogs.
- 🔍 **Visibility** – Strong storefront + Google + directory.
- 🧠 **Intelligence** – Advanced analytics.
- 🔌 **Connection** – POS integrations.

**Included capabilities (everything in Starter, plus):**
- Quick Start Wizard – generate realistic seed catalogs (e.g., 50–100 products) in seconds for new locations.
- SKU scanning + inventory intelligence (nutrition facts, allergens, specifications, environmental data, images).
- Google Integration Suite / full Google Business Profile sync (categories, hours, photos, products, SWIS).
- Enhanced multi-location management – products, hours, categories, GBP settings, and feature flags for up to 10 locations.
- **Clover POS integration.**
- **Square POS integration.**
- Advanced analytics & reporting (per product, per channel).
- Bulk operations (bulk price changes, bulk publish/unpublish, etc.).
- CSV import/export at meaningful scale.
- Higher product enrichment quotas.
- Priority support.
- Custom branding on storefront.

**Excluded / reserved for higher tiers:**
- API access.
- White-label storefront (no platform branding).
- SLA guarantees.
- Chain-wide propagation & organization-level billing.

---

### 2.3 Enterprise – Full Connector + AI Automation

**Target:** Established businesses (up to ~25 locations) that want the **entire connector story** in one product: shelf → scanning → POS → Google/GBP → storefront → directory → AI-assisted operations.

- **Proposed price:** `$499/month` (list)
- **Max locations:** `25`
- **Max SKUs per location:** `10,000+` (or effectively unlimited for most SMBs).

**Pillars emphasized:**
- 🚀 **Scale** – Multi-location management.
- ⚡ **Automation** – AI-assisted workflows and operational tooling.
- 📈 **Growth** – White-label, advanced analytics, and upsell systems.
- 🔌 **Connection** – API access & custom integrations.

**Included capabilities (everything in Professional, plus):**
- API access (programmatic control over catalog, locations, and visibility).
- Advanced chain management for up to 25 locations – richer propagation across products, pricing, copy, categories, GBP data and more, with hero-location testing before full rollout.
- White-label options for storefront (reduced or no platform branding).
- Dedicated account manager.
- SLA-backed support (response/uptime targets).
- Custom integrations (within scope) and onboarding assistance.
- Access to **AI/automation features** as they are rolled out (e.g. product enrichment at scale, AI-generated copy/assets, automated ops checks and alerts).

**Excluded / reserved for Organization:**
- Unlimited locations.
- Full chain management / propagation across dozens+ locations.
- Organization-level billing at scale with custom pricing.

---

### 2.4 Organization – Chains & Franchises (Custom)

**Target:** Chains, franchises, and organizations with 25+ locations.

- **Pricing:** Custom (location-based, volume-discounted).
- **Max locations:** Unlimited.
- **Max SKUs per location:** Unlimited (bounded by technical constraints only).

**Pillars emphasized:**
- 🚀 **Scale** – Chain-level propagation, location groups.
- ⚡ **Automation** – Org-wide rules & sync.
- 📈 **Growth** – White-label, dedicated CSM/AM, strategic support.

**Included capabilities (everything in Enterprise, plus):**
- Unlimited locations.
- Full chain management & propagation tools – support for multiple propagation types (products, pricing, content, categories, GBP settings, media, feature flags, etc.), selective targeting, scheduling, and rollback across unlimited locations.
- Organization-level dashboard & reporting.
- Organization-level billing.
- Custom pricing and contract terms.

---

## 3. Trial Model (Unchanged Core Idea)

**Trial = Status, Not Tier**

- Duration: **14 days**.
- Limit: **1 location**.
- Access: Full feature set of the **selected tier** (Starter, Pro, Enterprise, or Org pilot).

**After trial:**
- Convert to paid → full location + SKU limits unlock.
- Do not convert → account becomes read-only or significantly limited (no new syncs/updates).

No tenant should remain on an active, syncing plan at $0/month beyond the trial.

### 3.1 Read-Only Google Visibility Fallback (Internal State)

To balance sustainability with long-term platform reach, we keep a **non-marketed, internal fallback state** that reuses the legacy `google_only` tier configuration. This is **not** a recurring free plan – it is a controlled, time-bounded maintenance mode.

- **Not a public/marketed tier anymore**
  - Does **not** appear on `/features`, `/settings/offerings`, `/settings/subscription`, or any public pricing page.
  - No signups can directly choose "Google Only" as a plan.

- **When it is used**
  - Trial expires **and** tenant does not upgrade to a paid tier.
  - Tenant explicitly chooses to **stay on the platform in limited visibility mode** instead of closing the account.
  - System sets something like:
    - `subscriptionTier = 'google_only'`
    - `subscriptionStatus` + `trialEndsAt` are used internally to distinguish between:
      - **Maintenance window (soft delete)** – limited product maintenance allowed.
      - **Full freeze (hard block)** – visibility only, no edits.

- **Time-based behavior: maintenance window vs full freeze**

  - The platform treats `trialEndsAt` as the **current maintenance boundary**:
    - At the end of the initial trial, `trialEndsAt` marks when post-trial maintenance should be re-evaluated.
    - On each 6-month "anniversary" where `now >= trialEndsAt`:
      - If the tenant is on an **active paid subscription**, the system **extends** `trialEndsAt` by another 6 months (extends the maintenance boundary).
      - If the tenant is **not active** at that anniversary, the boundary is **not** extended and the tenant is treated as fully frozen after that point.

  - **Phase A – Maintenance window (soft delete)**
    - Applies when:
      - `subscriptionTier = 'google_only'`, and
      - `subscriptionStatus` is considered active (not canceled/expired), and
      - `now < trialEndsAt` (within the current 6‑month window).
    - In this phase the tenant can **maintain** but not grow their catalog:
      - **Allowed:**
        - Edit existing products (names, descriptions, prices, metadata).
        - Align and update categories for existing products.
        - Add or update images/photos for existing products.
        - Run product-enrichment and maintenance workflows that improve Google alignment.
        - Trigger **feed/jobs to Google / GMC / GBP** for existing products to keep listings up to date.
        - Update storefront + directory profile (business info, hours, logo, copy).
      - **Blocked:**
        - Creating new products or locations.
        - Quick Start catalog generation.
        - Barcode scan sessions that create net-new inventory items.
        - Bulk imports or bulk operations that increase total SKU count.

  - **Phase B – Full freeze (hard block)**
    - Applies when:
      - `subscriptionStatus` is **canceled** or **expired`, or
      - `subscriptionTier = 'google_only'` **and** the tenant is **outside** the maintenance window (`now >= trialEndsAt` and the window was not extended at the last anniversary).
    - In this phase the tenant effectively has **visibility only**:
      - Storefront, directory listing, and already-synced Google/GBP surfaces remain online.
      - **No edits** to products, prices, images, metadata, or profile.
      - **No new feed jobs** or sync runs to Google / GBP / Shopping.
      - **No Quick Start, scans, AI enrichment, or bulk operations.**
      - Tenant must upgrade to a paid tier (or contact support) to re-enable maintenance capabilities.

- **In-app UX expectations**
  - Clear **"Limited maintenance – trial ended"** or **"Read-only mode"** banner on login:
    - Maintenance window: emphasize "You can keep your existing products aligned and visible, but cannot create new products or locations without upgrading."
    - Full freeze: emphasize "Your existing visibility remains, but you can’t make changes or sync updates until you upgrade."
  - Primary CTA: **Upgrade to Starter / Professional / Enterprise / Organization**.
  - Secondary CTA: **Delete my data / close my account**.

- **Strategic role**
  - Keeps the **platform directory and ecosystem growing** with minimal marginal cost.
  - Maintains a pool of **warm leads** whose products are already live on Google, the storefront, and the directory.
  - Uses **Google sync and visibility** as the primary conversion lever in two stages:
    - During the maintenance window (soft delete): "You can keep your products accurate on Google and your storefront, but you can’t grow your catalog without upgrading."
    - After full freeze (hard block): "Your visibility is frozen in place. Upgrade to keep products fresh, add new SKUs, and continue syncing to Google/GBP."

---

## 4. Location & SKU Gating – UX & Messaging

### 4.1 In-App Badges & Warnings

- Show current usage vs limits:
  - `Locations: 2 / 3` (Starter).
  - `SKUs: 420 / 500 per location`.
- When approaching limits (e.g. 80%+), show soft warnings with upgrade CTAs.

**Example messages:**
- "You're at 400/500 SKUs on Starter. Upgrade to Professional for up to 5,000 SKUs per location and POS integration."
- "You've created 3/3 locations on Starter. Upgrade to Professional to manage up to 10 locations."

### 4.2 Enforcement Rules

- On create location:
  - If `current_locations >= tier_max_locations` → block, show upgrade dialog.
- On create product/SKU:
  - If `current_skus >= tier_max_skus_per_location` → block, show upgrade dialog or suggest archiving.

Grandfathering rules can mirror current model (e.g., existing locations remain, but no new ones until under limit or upgraded).

---

## 5. Feature Distribution vs Pillars

This model keeps the **7 pillars** and **3 growth engines** coherent across tiers:

- **Starter:**
  - Foundation + Visibility for small retailers. Storefront + Google + directory as the core story.
- **Professional:**
  - Adds Connection + Intelligence. POS integration + advanced analytics as the main upgrades.
- **Enterprise:**
  - Adds Scale + Growth via API, white-label, and dedicated support.
- **Organization:**
  - Maximizes Scale, Automation, and Growth for chains.

This aligns with the three growth engines:
- Google Sync & SWIS.
- Storefront.
- Clover/Square integration.

---

## 6. Migration Path from Current Model

**Current official doc:** `TIER_OFFERINGS.md` (with a free Google Only tier).  
**Proposed V2:** This document (no recurring free plan, 4 tiers only).

Migration steps when adopting V2:

1. **Stop offering new signups to Google Only (free)**
   - Hide Google Only from pricing page and signup.
   - Existing free tenants can be:
     - Grandfathered for a period, or
     - Migrated to time-limited trial + Starter offer.

2. **Add SKU limits per tier** in code & UI
   - Implement `max_skus_per_location` per tier.
   - Add UX for SKU capacity badges and upgrade prompts.

3. **Align pricing page & in-app messaging**
   - Update pricing page to show Starter → Pro → Enterprise → Org only.
   - Highlight location + SKU limits clearly.

4. **Update internal docs**
   - Mark `TIER_OFFERINGS.md` as superseded by this V2 model when adopted.
   - Keep a short “pricing history” note for context.

---

## 7. Open Questions / To Decide

- Final price points per tier (especially Professional & Enterprise) based on:
  - Target gross margin per tenant.
  - Expected support load (POS integrations are expensive to support).
  - Competitive moves.
- Exact SKU caps per tier (500 / 5,000 / 10,000+ are starting points, can be tuned).
- Whether Organization is always sales-led, or if a self-serve "Talk to Sales" flow can pre-qualify chains.

Once these are decided, this V2 model can be promoted from "Draft" to "Official" and implemented across pricing page, in-app gating, and internal ops.
