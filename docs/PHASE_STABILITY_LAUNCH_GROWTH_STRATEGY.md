# Stability, Launch, Outreach & Growth Strategy

**Date:** 2025-11-14  
**Context:** Platform is entering a phase focused on **stability**, **launch**, **outreach**, and **growth**. This document connects the current system (7 pillars, three-pillar growth engines, tier/permission systems) to concrete strategies for this phase.

---

## 1. Platform Context

**Architecture:**
- Frontend: Next.js on **Vercel** (`apps/web`).
- Backend: **Express API** (`apps/api`) with Prisma, connected to **Supabase Postgres**.
- Auth: Custom JWT-based auth (email/password), evolving toward social auth.
- Multi-tenant: Tenant + organization tiers, multi-location support, rich RBAC.

**Core value proposition (Three Growth Pillars):**

From `THREE_PILLAR_GROWTH_STRATEGY.md`:

1. **🔍 Google Sync** – Store Traffic Engine (Discovery)
2. **🏪 Storefront** – Conversion Engine (Engagement)
3. **🔌 Clover Integration** – Adoption Engine (Onboarding)

**Structural product pillars (7 PLATFORM_PILLARS):**

From `feature-catalog.ts`:

1. 🏗️ **Foundation** – Get Your Products Online  
2. 🔍 **Visibility** – Make Sure People Can Find You  
3. 🧠 **Intelligence** – Understand What's Working  
4. 🚀 **Scale** – Grow Beyond One Location  
5. ⚡ **Automation** – Work Smarter, Not Harder  
6. 🔌 **Connection** – Connect Everything Together  
7. 📈 **Growth** – Take It to the Next Level  

This strategy doc assumes **current feature set** as described in `PILLAR_ALIGNMENT_REPORT.md` and focuses on: 
- Keeping what exists **stable**, 
- Making **launch** feel coherent and guided,
- Structuring **outreach** around the growth engines,
- Turning existing systems into **growth accelerants**.

---

## 2. Stability: Non-Negotiable Foundation

### 2.1 SLOs for Critical Flows

**Critical paths:**
- **Auth**: Email/password, future social login (Google/Microsoft first).
- **Clover & Square**: OAuth connections + inventory sync.
- **Google Sync & SWIS**: Product feeds and visibility.
- **Storefront & Directory**: Public product discovery.

**Actions:**
- Define simple SLO targets:
  - Auth success rate > 99.5%
  - Clover/Square sync success > 99.5%
  - Google feed generation success > 99%
  - Storefront/directory uptime > 99.9%
- Instrument and alert on:
  - Error rates for `/api/auth/*`, Clover/Square sync workers, Google feed jobs.
  - Storefront errors/latency (Vercel logs + any APM).

### 2.2 Feature Flags & Safe Rollouts

For all new high-impact features (e.g., social auth, custom domains, Square UI), use feature flags:

- **Flags examples:**
  - `social_auth_google_beta`
  - `square_ui_beta`
  - `custom_domains_beta`

**Rollout pattern:**
1. Internal team only.  
2. Small set of friendly tenants.  
3. Specific tiers (e.g., Professional/Organization).  
4. General availability.

### 2.3 Operational Runbooks

Create short runbooks for:

- **Google sync issues:**
  - How to check Merchant Center, how to re-queue feeds, how to temporarily disable problematic feeds.
- **Clover/Square sync issues:**
  - How to inspect logs, retry, and notify tenants; when to temporarily turn off sync and what messaging to show.
- **Storefront downtime:**
  - How to detect, mitigate (roll back, disable specific features), and communicate.
- **Auth issues:**
  - How to revoke sessions, rotate JWT secrets, temporarily disable social login flows if needed.

Runbooks should be easily accessible (e.g. `RUNBOOK_*` docs) and linked from admin dashboard if applicable.

---

## 3. Launch: Make the Product Narrative Frictionless

### 3.1 Lead with the Three Growth Pillars

Align marketing site, in-app messaging, and sales materials around:

1. **Clover Integration (Pillar 3)** – "Connect Clover, go live in 5 minutes"
2. **Google Sync (Pillar 1)** – "Get on Google Shopping & SWIS"
3. **Storefront (Pillar 2)** – "Beautiful storefront, no developer"

**Concrete actions:**
- Homepage hero and product tour structured around: Connect → Sync → Storefront.
- Sales deck sections: Adoption (Clover) → Traffic (Google) → Conversion (Storefront).

### 3.2 In-App Launch Checklist

Use the **Tenant Dashboard** as the canonical “launch guide” for new merchants.

**Add a "Launch Checklist" card with steps like:**
- **Step 1:** Add products (via Clover/Square sync or manual/bulk upload).  
- **Step 2:** Turn on Google Sync (Merchant Center, SWIS).  
- **Step 3:** Customize your storefront (branding, photos, copy).  
- **Step 4:** Generate & place QR codes (storefront windows, receipts, flyers).  
- **Step 5:** Verify directory listing is live.

Each completed step updates a progress percentage. Use existing components (DashboardStats, WhatYouCanDo, tier-aware gating) where possible.

### 3.3 Tier-Aware "What You Can Do" as Launch Tour

Ensure `WhatYouCanDo` (pillars-based feature display) clearly shows:

- **Today you can:** foundation + visibility basics for current tier.  
- **Next tier unlocks:** scale, automation, growth features (with upgrade CTAs).

This turns the launch experience into a guided path across the 7 pillars, not just a blank dashboard.

---

## 4. Outreach: Pillar-Aware Acquisition

Use the **Three-Pillar Growth Strategy** segments and align messaging.

### 4.1 Landing Page Strategy Overview

Yes: the strategy here explicitly recommends **multiple landing pages**, each tailored to a primary pillar context and segment, rather than a single generic landing page. The goal is to:

- Lead with the **pillar that matters most** for that segment (Adoption, Traffic, or Conversion).
- Keep copy, proof points, and CTAs tightly aligned with the segment's dominant pain.
- Use cross-links and secondary messaging to show that all three growth pillars are included.

**Base set of landing pages (minimum viable):**

- `/clover` – Clover-first merchants (Pillar 3: Adoption engine).
- `/google-shopping` – Google-first merchants (Pillar 1: Traffic engine).
- `/storefront` – Storefront-first merchants (Pillar 2: Conversion engine).
- `/organization` – Multi-location chains (All three pillars + Scale).

**Cross-linking guidance:**

- Each landing page should:
  - Clearly lead with its primary pillar/value prop.  
  - Include a short section or visual that shows **"You also get"** the other two growth pillars.  
  - Offer a link to at least one other landing page, e.g.:
    - `/clover` → "Want to understand the Google side? See `/google-shopping`".  
    - `/google-shopping` → "Need a storefront too? See `/storefront`".  
    - `/storefront` → "Already on Clover? Skip manual work with `/clover`".

### 4.2 Segment 1: Clover Merchants (Pillar 3 First)

**Message:**
> "Connect Clover, go live in 5 minutes"

**Channels:**
- Clover app marketplace / partner directory.  
- Clover-focused agencies/consultants.  
- Communities and forums where Clover merchants gather.

**Landing page:** `/clover`
- Explain: 5-minute onboarding, auto-sync, Google + Storefront bundled.

### 4.3 Segment 2: Google-Focused Merchants (Pillar 1 First)

**Message:**
> "Get on Google Shopping in days, not months"

**Channels:**
- Agencies offering local SEO/SEM for local retailers.  
- Partner programs or communities for Google-certified professionals.

**Landing page:** `/google-shopping`
- Show: Merchant Center sync, SWIS, basic analytics.

### 4.4 Segment 3: Storefront-Focused Merchants (Pillar 2 First)

**Message:**
> "Beautiful storefront, no developer needed"

**Channels:**
- Web agencies serving local businesses.  
- Local business associations and chambers of commerce.

**Landing page:** `/storefront`
- Highlight: templates, QR flows, offline-to-online connection.

### 4.5 Segment 4: Multi-Location Chains (Pillars 1+2+3 + Scale)

**Message:**
> "Manage all locations from one dashboard"

**Channels:**
- Direct outreach to regional/chain retailers.  
- Partnerships with POS resellers/consultants.

**Landing page:** `/organization`
- Emphasize: multi-location, propagation, organization dashboard, high ROI vs custom dev.

---

## 5. Growth: Turn Systems into Growth Engines

### 5.1 Use Capacity & Tier Systems as Upgrade Levers

You already have:
- **Capacity badges** (SKU/location usage).  
- **Creation warnings** at high usage.  
- **Tier-aware dashboards** (`WhatYouCanDo`, `useTenantTier`, `getLockedFeatures`).

**Strategies:**
- When users approach SKU/location limits, show:
  - "You're at 80% of your [SKU/location] capacity. Upgrading to [next tier] unlocks more room + [pillar-aligned benefits]."
- Tie upgrade prompts to pillars:
  - **Scale:** more locations, propagation.  
  - **Automation:** access to upcoming automation rules.  
  - **Growth:** custom domains, white-label, priority support, dedicated AM.

### 5.2 Instrument Aha Moments by Pillar

Track key events per pillar:

- **Foundation:** first 10/20 products; first bulk import; first Clover/Square sync.  
- **Visibility:** Google sync activated; SWIS live; storefront first publish.  
- **Intelligence:** first analytics view; first AI insight used.  
- **Scale:** first additional location; first propagation run.  
- **Automation:** first alert; first automation rule (once available).  
- **Connection:** Clover/Square/API successfully connected.  
- **Growth:** upgrade to Pro/Org; enabling white-label; assigning dedicated AM.

Use these events to:
- Trigger in-app nudges and email sequences ("Now that you turned on Google, let’s customize your storefront").
- Inform which features to emphasize in onboarding and marketing.

### 5.3 Lighthouse Customers & Case Studies

Select 3–5 early customers and intentionally guide them through:

1. Clover/Storefront/Google setup.  
2. Multi-location / propagation (if applicable).  
3. Visibility + analytics / intelligence.

Capture:
- Time to first value (from sign-up to first Google impression or first storefront visit).  
- Changes in foot traffic/sales if possible.  
- Quotes about ease-of-use and speed.

Turn into:
- Case studies per segment (Clover-first, Google-first, Storefront-first).  
- Stories in dashboard and marketing ("From invisible to unstoppable in 5 minutes").

---

### 5.4 Landing Pages & Email Flows

Each public landing page should be treated as:
- A **segment-specific marketing surface** mapped to a primary growth pillar.  
- A **lead capture point** that records segment/pillar context.  
- An entry point into a **short, automated email flow** aligned with that pillar.

**Landing pages (public, unauthenticated):**
- `/clover` – Clover-first merchants (Adoption engine / Clover Integration).  
- `/google-shopping` – Google-first merchants (Traffic engine / Google Sync).  
- `/storefront` – Storefront-first merchants (Conversion engine / Storefront).  
- `/organization` – Multi-location chains (All three engines + Scale pillar).

**Lead capture pattern:**
- Each page includes:
  - Primary CTA: "Start free trial" or "Get started" (with `utm` or `entry_pillar` tagging).  
  - Secondary CTA: short lead form (name, email, business name, POS type, locations).  
  - Stored metadata: `source_page`, `primary_pillar`, and any qualifiers (e.g., `uses_clover`, `location_count`).

**Email flows per landing page:**

- `/clover` → Clover sequence (Adoption engine)
  - Email 1: "Connect Clover, go live in 5 minutes" (setup steps + GIF/video).  
  - Email 2: Clover merchant case study (before/after).  
  - Email 3: "Now that Clover is connected, turn on Google & Storefront next".

- `/google-shopping` → Google sequence (Traffic engine)
  - Email 1: "Get your products on Google Shopping" (benefits + quickstart).  
  - Email 2: SWIS + local intent story (how it drives foot traffic).  
  - Email 3: "Use Storefront to convert that traffic" (showcase storefront).

- `/storefront` → Storefront sequence (Conversion engine)
  - Email 1: "Beautiful storefront, no developer" (examples + screenshots).  
  - Email 2: "Connect Google & Clover to feed your storefront automatically".  
  - Email 3: QR ideas and offline → online usage (in-store signage, receipts).

- `/organization` → Organization/chain sequence (3 pillars + Scale)
  - Email 1: "Manage all locations from one dashboard" (org overview).  
  - Email 2: Propagation Hub + org-tier value (multi-location updates, chain analytics).  
  - Email 3: Demo invite / consultation CTA.

These flows can be implemented in your chosen email/CRM tool. The important part for the platform is that landing pages consistently annotate leads with **segment + pillar context**, so future engagement is always aligned to the story that brought them in.

---

## 6. Short-Term Execution Plan (3–6 Months)

**1. Stability & Observability**
- Implement basic SLOs and alerts for auth, Clover/Square sync, Google sync, storefront.
- Add runbooks for common failure modes.

**2. Launch Experience**
- Add in-app "Launch Checklist" card to Tenant Dashboard.  
- Ensure `WhatYouCanDo` is front-and-center and tier-aware.

**3. Outreach Foundations**
- Ship/refresh landing pages for `/clover`, `/google-shopping`, `/storefront`, `/organization` reflecting the three-pillar story.

**4. Growth Hooks**
- Wire capacity/tier information into upgrade prompts at key points (SKU/location limits, locked features).  
- Start tracking key aha events per pillar.

These steps build on existing systems and are designed to be achievable without large new infrastructure, while positioning the platform well for scale and growth.
