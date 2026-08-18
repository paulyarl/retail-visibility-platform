# Directory Presence — Operator Guide

A practical guide for operators using the Directory Presence system to discover, seed, publish, claim, and grow underserved businesses across cities and niches.

---

## Table of Contents

1. [What Is Directory Presence?](#what-is-directory-presence)
2. [The Growth Loop](#the-growth-loop)
3. [Discovery & Seek](#discovery--seek)
4. [Prospect Queue](#prospect-queue)
5. [Seed Creation & Management](#seed-creation--management)
6. [Batch Operations (Multi-City)](#batch-operations-multi-city)
7. [Publishing & Inviting](#publishing--inviting)
8. [Claim Flow & Identity Verification](#claim-flow--identity-verification)
9. [Enrichment & Progressive Engagement](#enrichment--progressive-engagement)
10. [Public Directory & Search](#public-directory--search)
11. [Growth Engine Analytics](#growth-engine-analytics)
12. [Demand Signals & Next Seek Targets](#demand-signals--next-seek-targets)
13. [Quick Reference](#quick-reference)

---

## What Is Directory Presence?

Directory Presence is the platform's acquisition channel for underserved businesses — particularly emerging African grocery operators, halal butchers, and other niche local businesses that have customers but lack a stable public online identity.

The directory is **not** a standalone business directory. It is the **entry point** into the platform's complete retail-to-online-to-ecommerce ecosystem. Businesses start as unclaimed listings built from public information, get verified and claimed by their owners, and then upgrade into full platform tenants with retail and ecommerce capabilities.

### Key Principle

Other directories with unclaimed listings and a "claim" CTA are just directories. This platform is an entire retail-to-online-to-ecommerce visibility system. The directory is the top of the funnel — the acquisition channel — not the product itself.

---

## The Growth Loop

The system operates as a self-reinforcing loop:

```
Operator launches seek batch
  → Intelligence runs across cities
    → Prospects queued
      → Operator reviews & qualifies
        → Directory seed created
          → Seed published (unclaimed listing)
            → Owner invited to claim
              → Owner verifies identity & claims
                → Tenant promoted with dashboard
                  → Owner upgrades to retail/ecommerce
                    → Directory traffic & demand feed back into next seek
```

Each stage is tracked in the Growth Engine dashboard, and demand signals from the public directory feed back into seek recommendations — closing the loop.

---

## Discovery & Seek

### Running a Seek

Intelligence seeks discover businesses in a specific category and city. The results become prospects in the queue.

1. Navigate to **Settings → Admin → Directory Presence → Batch Operations**.
2. Click **"+ New Seek Batch"**.
3. Select an **intelligence profile** (defines the seek prompts and analysis scope).
4. Enter a **niche category** (e.g., "African Grocery", "Halal Butcher").
5. Enter **cities** (comma-separated, max 10 — e.g., "Indianapolis, Columbus, Cincinnati").
6. Optionally enter a **state** (e.g., "IN").
7. Click **"Create Batch"** — the batch is created in `draft` status.
8. Click **"Launch Now"** to start the intelligence runs across all cities, or launch later from the batch list.

Each city gets its own seek run, but they share a batch ID for tracking.

### Demand-Driven Seeks

Instead of guessing where to seek, use the **Growth Engine** (Settings → Admin → Directory Presence → Growth Engine) to see demand-driven recommendations:

- **Next Seek Targets** — prioritized category+city combinations scored by demand signals (zero-result searches, lead gen submissions, underserved areas).
- Click **"Launch Seek"** on any recommendation — this opens the Batch Seek Launcher with the category and city pre-filled.
- Review the pre-filled values, select an intelligence profile, and click **"Create Batch"** then **"Launch Now"**.

See [Demand Signals & Next Seek Targets](#demand-signals--next-seek-targets) below.

---

## Prospect Queue

### Reviewing Prospects

After a seek completes, prospects appear in the prospect queue.

1. Navigate to **Settings → Admin → Marketing Ops → Prospect Queue**.
2. Review each prospect's business snapshot, detected signals, and confidence score.
3. Prospects from seek runs show their source campaign and audit date.

### Lead Gen Prospects (Self-Identified)

Prospects with `source_kind: 'directory_lead_gen'` are **self-identified** — the business owner found the directory on their own and submitted a "Get Listed" request. These are the highest quality prospects because the owner raised their hand.

- Lead gen prospects appear with a **"Self-identified"** badge.
- Lead gen prospects are prioritized over seek-discovered prospects.
- For lead gen prospects, you can create a seed **directly** — no seek needed. The owner already wants to be listed.

### Qualifying Prospects

For each prospect, decide:

- **Route to campaign** — the business gets a marketing campaign (if they have signals of readiness).
- **Route to directory seed** — the business gets a directory listing (if they're a good fit for the directory but not yet ready for a campaign).
- **Reject** — the prospect is not a good fit.

---

## Seed Creation & Management

### Creating a Seed

A directory seed is an unclaimed listing built from public information (address, phone, business name).

1. From a prospect in the queue, select **"Create Seed"**.
2. The seed is created with status `draft` — it is not yet public.
3. Review the seed's information at **Settings → Admin → Directory Presence → Presence Seeds**.
4. Edit the seed to complete or correct any information (address, phone, category, hours, SNAP/EBT status).

### Seed Statuses

| Status | Meaning |
|--------|---------|
| `draft` | Created but not yet published — not visible to the public |
| `published` | Live on the public directory — visible and searchable |
| `invited` | Published and a claim invitation has been sent to the owner |
| `claimed` | Owner has verified identity and claimed the listing |
| `enrichment_pending_review` | Owner submitted enrichment data awaiting operator review |

### Seed Detail Page

At **Settings → Admin → Directory Presence → Presence Seeds → [Seed]**, you can:

- View the seed's full profile (business name, address, phone, category, city, state, SNAP/EBT status).
- Edit listing information.
- Publish the seed (moves from `draft` → `published`).
- Send a claim invitation (moves from `published` → `invited`).
- View claim status and claim history.
- Review enrichment submissions if the owner has submitted additional data.

---

## Batch Operations (Multi-City)

### Batch Seek

When you want to expand a niche across multiple cities at once, use **Batch Seek**.

1. Navigate to **Settings → Admin → Directory Presence → Batch Operations**.
2. Click **"+ New Seek Batch"**.
3. Select an **intelligence profile**, enter a **niche category**, and enter **cities** (comma-separated, max 10).
4. Click **"Create Batch"** — the batch is created in `draft` status.
5. Click **"Launch Now"** to start intelligence runs across all selected cities, or launch later from the batch detail page.
6. Each city gets its own seek run, but they share a batch ID for tracking.

### Batch Dashboard

The batch dashboard at **Settings → Admin → Directory Presence → Batch Operations** shows:

- All batches with their status (running, complete, partial).
- Per-batch metrics: prospects queued, seeds created, seeds published, seeds claimed.
- Batch ID for cross-referencing with campaigns and prospect queues.

### Bulk Publish & Bulk Invite

From the batch dashboard:

1. Select a batch.
2. Click **"Publish All"** to bulk-publish all draft seeds in the batch.
3. Click **"Invite All"** to bulk-send claim invitations to all published seeds in the batch.
4. Each seed is processed independently — partial successes and failures are collected and reported.

---

## Publishing & Inviting

### Publishing a Seed

Publishing makes a seed visible on the public directory at `/place/[slug]`.

- From the seed detail page, click **"Publish"**.
- The seed's status changes to `published`.
- The listing becomes searchable on `/place`, `/place/search`, `/place/category/[slug]`, and `/place/city/[slug]`.
- The listing is included in the sitemap at `/api/public/directory/places-sitemap.xml`.
- The listing page includes `LocalBusiness` JSON-LD structured data for SEO.

### Inviting the Owner to Claim

Once a seed is published, you can invite the owner to claim it:

- From the seed detail page, click **"Send Claim Invite"**.
- The system generates an identity-bound claim token and sends an invitation email to the owner's email (if known).
- The seed's status changes to `invited`.
- The claim link is token-gated and identity-bound — see [Claim Flow](#claim-flow--identity-verification) below.

### What the Owner Receives

The owner receives an email with a link to `/directory/claim/[token]`. The claim page shows:

- The business name and listing information.
- A "Claim This Business" call-to-action.
- Instructions for verifying their identity.

---

## Claim Flow & Identity Verification

### Security Model

Claim tokens are **not** sufficient by themselves for ownership. A bare token-gated URL would allow anyone who finds the link to claim the business. The system uses **identity-bound verification**:

1. **Token resolution** — the claim token is resolved to the seed.
2. **Identity check** — if the token was issued with a bound owner identity (email or phone), the system checks that identity.
3. **OTP verification** — a 6-digit OTP is generated and sent to the bound email or phone.
4. **OTP submission** — the owner enters the OTP to verify their identity.
5. **Operator approval fallback** — if the claim is unbound (self-discovered, no pre-bound identity), the claim requires operator approval before the listing is transferred.
6. **Token consumption** — the token is consumed only after verification/approval checks pass. The tenant is promoted only at this point.

### Operator's Role in Claims

- For **bound claims** (token was sent to a known email/phone): the owner verifies via OTP and the claim is processed automatically. You can monitor claims in the seed detail page.
- For **unbound/self-discovered claims** (the owner found the listing on their own and clicked "Claim"): the claim enters a **review queue**. You must approve or reject it at **Settings → Admin → Directory Presence → Presence Seeds → [Seed] → Claim Review**.

### After a Successful Claim

- The seed's status changes to `claimed`.
- The owner becomes a platform tenant.
- The tenant receives a **capability-filtered dashboard** — they see the features available to them based on their current tier (initially `directory_presence`).
- The owner can now enrich their listing, add business hours, upload a logo, and eventually upgrade to retail/ecommerce capabilities.

---

## Enrichment & Progressive Engagement

### Owner Enrichment

After claiming, the owner can enrich their listing through a token-gated enrichment flow at `/directory/enrich/[token]`:

- Update business hours.
- Add a logo or business description.
- Update SNAP/EBT status.
- Add social media links.
- Correct address or phone information.

### Operator Review of Enrichment

Enrichment submissions may require **operator review** before going live:

- Submissions that change critical information (address, phone, category) are flagged for review.
- The seed's status becomes `enrichment_pending_review`.
- Review the submission at **Settings → Admin → Directory Presence → Presence Seeds → [Seed]**.
- Approve to apply the changes, or reject to keep the existing information.

### Progressive Engagement

The goal is to move claimed owners from free directory visibility into paid capabilities:

1. **Directory Presence** (free) — listing is live, owner has a basic dashboard.
2. **Retail capabilities** — owner can manage inventory, process in-store sales, use the POS.
3. **Ecommerce capabilities** — owner can sell online, manage orders, process payments.
4. **Full platform** — owner uses the complete retail-to-online-to-ecommerce stack.

The upgrade path is available in the owner's dashboard. The Growth Engine dashboard tracks upgrade conversion rates.

---

## Public Directory & Search

### Public Pages

The directory is publicly accessible at:

| Page | URL | Purpose |
|------|-----|---------|
| Places index | `/place` | Browse all categories, search bar, total place count |
| Search | `/place/search` | Search by business name, city, category, SNAP/EBT status |
| Category | `/place/category/[slug]` | All listings in a category, paginated, sortable |
| City | `/place/city/[citySlug]` | All listings in a city, grouped by category |
| Individual listing | `/place/[slug]` | Full listing page with map, hours, contact, claim CTA |

### Search

The search page at `/place/search` supports:

- **Text search** — business name, city, category.
- **Filters** — category, city, SNAP/EBT only.
- **Sorting** — name A-Z, city, recently added, SNAP/EBT first.
- **Pagination** — 24 results per page, URL-based state (shareable/crawlable).

### SEO

- Every published listing has `LocalBusiness` JSON-LD structured data.
- The sitemap at `/api/public/directory/places-sitemap.xml` includes all published listings, category pages, and city pages.
- City pages have dynamic metadata (`Places in [City] — Directory`).
- Category and city pages use URL-based pagination and sorting for crawlability.

### Search Demand Tracking

When a user searches on `/place/search` and gets zero or very few results (< 5), the system logs a **search demand event**. These events are aggregated and surfaced as demand signals on the Growth Engine dashboard — see below.

---

## Growth Engine Analytics

### Dashboard

Navigate to **Settings → Admin → Directory Presence → Growth Engine**.

The dashboard shows the end-to-end growth funnel:

```
Seeks Run → Prospects Queued → Seeds Created → Seeds Published → Seeds Claimed → Seeds Upgraded
```

Each stage displays:

- **Count** for the last 90 days (configurable).
- **Conversion rate from previous stage** (e.g., 45% of published seeds were claimed).
- **Conversion rate from first stage** (overall funnel conversion).

### Per-Niche Breakdown

A table showing each category with:

- Total seeds, published, claimed, upgraded.
- **Claim rate** (claimed / published) — color-coded (green > 30%, red < 10%).
- **Upgrade rate** (upgraded / claimed).

Use this to decide which niches to expand (high claim rate) and which to deprioritize (low claim rate).

### Per-City Breakdown

A table showing each city with:

- Total niches, seeds, published, claimed, upgraded.
- Claim rate and upgrade rate.

Use this to decide which cities to focus on.

### Time Series

A chart showing seeds created per week (or month). Use this to see whether the growth engine is accelerating or decelerating.

### Expansion Recommendations

The dashboard shows actionable recommendation cards:

- **Expand [niche] to more cities** — high claim rate but low city coverage.
- **Add more niches in [city]** — high claim rate but low niche count.
- **Deprioritize [niche]** — low claim rate across multiple cities.

---

## Demand Signals & Next Seek Targets

### Demand Signals Panel

The Growth Engine dashboard includes a **Demand Signals** section showing:

| Signal Type | Meaning |
|-------------|---------|
| **Zero Results** | Users searched for "[category] in [city]" and got 0 listings — clear demand, no supply |
| **Underserved** | Users searched and got < 5 listings — demand exists but supply is thin |
| **Lead Gen** | Business owners submitted "Get Listed" requests for this category+city — self-identified demand |

Each signal shows the search count and a description.

### Next Seek Targets

The **Next Seek Targets** panel shows prioritized recommendations for where to run your next seek. Each target is scored by:

```
Score = (zero_result_searches × 3) + (lead_gen_submissions × 5) + (underserved_searches × 2)
```

Each target shows:

- Category and city.
- Score (higher = more demand).
- Zero-result searches, lead gen submissions, current listings.
- A **"Launch Seek"** button that pre-fills the batch seek launcher with the recommended category+city.

### How to Use Demand Signals

1. Open **Settings → Admin → Directory Presence → Growth Engine**.
2. Scroll to **Next Seek Targets**.
3. Review the top recommendations — these are the highest-demand, lowest-supply category+city combinations.
4. Click **"Launch Seek"** on a target you want to pursue.
5. The Batch Seek Launcher opens at **Settings → Admin → Directory Presence → Batch Operations** with the category and city pre-filled.
6. Select an intelligence profile and click **"Create Batch"** then **"Launch Now"**.
7. Prospects will be queued for that target.
7. After the seek, create seeds, publish, and invite owners to claim.
8. As listings go live, the demand signals for that category+city will decrease (users will find results instead of zero results).
9. The loop reinforces — more listings → more traffic → more lead gen → more demand signals → more seeks.

---

## Quick Reference

### Admin Pages

| Page | URL |
|------|-----|
| Growth Engine | `/settings/admin/growth-engine` |
| Batch Operations | `/settings/admin/directory/batches` |
| Presence Seeds | `/settings/admin/directory/presence-seeds` |
| Seed Detail | `/settings/admin/directory/presence-seeds/[id]` |
| Prospect Queue | `/settings/admin/marketing-ops/queue` |

### Public Pages

| Page | URL |
|------|-----|
| Places Index | `/place` |
| Search | `/place/search` |
| Category Page | `/place/category/[slug]` |
| City Page | `/place/city/[citySlug]` |
| Individual Listing | `/place/[slug]` |
| Claim Flow | `/directory/claim/[token]` |
| Enrichment Flow | `/directory/enrich/[token]` |
| Sitemap | `/api/public/directory/places-sitemap.xml` |

### API Endpoints (Admin)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/growth-engine/funnel` | Funnel metrics |
| GET | `/api/admin/growth-engine/by-niche` | Per-niche breakdown |
| GET | `/api/admin/growth-engine/by-city` | Per-city breakdown |
| GET | `/api/admin/growth-engine/time-series` | Time series chart data |
| GET | `/api/admin/growth-engine/recommendations` | Expansion recommendations |
| GET | `/api/admin/growth-engine/demand-signals` | Demand signals |
| GET | `/api/admin/growth-engine/next-seek-targets` | Prioritized seek targets |
| POST | `/api/admin/growth-engine/aggregate` | Trigger daily aggregation |

### API Endpoints (Public)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/public/directory/places` | List published places |
| GET | `/api/public/directory/places/search` | Search published places |
| GET | `/api/public/directory/places/city/[citySlug]` | City landing page data |
| GET | `/api/public/directory/places-sitemap.xml` | XML sitemap |
| POST | `/api/public/directory/search-demand` | Log search demand event |
| GET | `/api/public/directory/claim/[token]` | Resolve claim token |
| POST | `/api/public/directory/claim/[token]/initiate` | Initiate claim (sends OTP) |
| POST | `/api/public/directory/claim/[token]/accept` | Accept claim (verify OTP) |

### Seed Status Flow

```
draft → published → invited → claimed → (tenant promoted)
                                    ↗
              enrichment_pending_review (operator reviews enrichment)
```

### Typical Operator Workflow

1. **Check the Growth Engine dashboard** — review funnel, demand signals, and next seek targets.
2. **Launch a seek** — click "Launch Seek" on a recommended target (opens the Batch Seek Launcher with category+city pre-filled), or manually create a batch at **Settings → Admin → Directory Presence → Batch Operations**.
3. **Review prospects** — check the prospect queue, qualify prospects, route to seeds or campaigns.
4. **Create seeds** — create directory seeds from qualified prospects (or directly from lead gen prospects).
5. **Publish seeds** — bulk publish from the batch dashboard, or publish individually from seed detail pages.
6. **Send claim invitations** — bulk invite from the batch dashboard, or invite individually.
7. **Monitor claims** — watch for claims entering review (unbound/self-discovered claims need operator approval).
8. **Review enrichment** — approve or reject enrichment submissions from claimed owners.
9. **Watch upgrade conversion** — track how many claimed owners upgrade to retail/ecommerce capabilities.
10. **Repeat** — the loop reinforces as more listings go live and generate more demand signals.
