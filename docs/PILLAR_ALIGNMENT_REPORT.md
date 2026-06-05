# Platform Pillar Alignment Report

**Date:** 2025-11-14  
**Context:** Based on `apps/web/src/lib/features/feature-catalog.ts` and current docs.

This report summarizes how the platform's current features align with the **7 platform pillars** and recommends next steps per pillar.

---

## 1. Canonical Platform Pillars (from Feature Catalog)

Source: `apps/web/src/lib/features/feature-catalog.ts`

```ts
pillar: 'foundation' | 'visibility' | 'intelligence' | 'scale' | 'automation' | 'connection' | 'growth';
```

`PLATFORM_PILLARS` defines the official pillars and their order:

1. **Foundation** – Get Your Products Online 🏗️  
2. **Visibility** – Make Sure People Can Find You 🔍  
3. **Intelligence** – Understand What's Working 🧠  
4. **Scale** – Grow Beyond One Location 🚀  
5. **Automation** – Work Smarter, Not Harder ⚡  
6. **Connection** – Connect Everything Together 🔌  
7. **Growth** – Take It to the Next Level 📈  

This report scores each pillar 1–10 based on **current implemented features** and recommends 1–3 concrete next steps per pillar.

---

## 2. Coverage Snapshot by Pillar (Current Features)

Counts derived from `FEATURE_CATALOG` (excluding `comingSoon`):

- **Foundation:** 9 live features
- **Visibility:** 4 live features
- **Intelligence:** 4 live features
- **Scale:** 4 live features
- **Automation:** 1 live feature (+1 comingSoon)
- **Connection:** 4 live features
- **Growth:** 3 live features

Total: **29 live features**, **1 planned** (`automated_ordering`).

---

## 3. Pillar Scores & Recommended Next Steps

### 3.1 Foundation – Get Your Products Online 🏗️

**Live features (examples):**
- `basic_inventory` – Product Catalog  
- `manual_entry` – Quick Add Products  
- `manual_barcode` – Manual Barcode Entry  
- `barcode_scan` – Smart Barcode Scanner (isNew)  
- `basic_search` – Find Anything Fast  
- `bulk_import` – Bulk Upload  
- `categories` – Smart Categories  
- `clover_sync`, `square_sync` – POS-based inventory sync

**Coverage:** 9 live features

**Score:** **9 / 10**

**Assessment:**
- Very strong foundation: manual, barcode, bulk import, and POS integrations.
- This pillar is deeply aligned with the mission of getting products online fast.

**Recommended next steps:**

- **[F1] Quality-of-life improvements in item workflows**  
  - Inline editing in items list/grid for quick tweaks (price/stock).  
  - Bulk edit tools (multi-select, bulk price changes, category assignment).

- **[F2] Better onboarding guidance in Foundation**  
  - A "Foundation Checklist" in the dashboard (e.g., "Add 10 products", "Upload a CSV", "Connect POS").  
  - Progress indicators to show how "ready" their catalog is.

- **[F3] Data hygiene tools**  
  - Simple health checks on the catalog (missing images, no categories, missing GTINs) with suggested fixes.

---

### 3.2 Visibility – Make Sure People Can Find You 🔍

**Live features:**
- `google_sync` – Google Business Sync  
- `swis` – See What's In Store (SWIS)  
- `storefront` – Your Own Storefront  
- `platform_directory` – Platform Directory Listing

**Coverage:** 4 live features

**Score:** **8 / 10**

**Assessment:**
- Strong visibility story: Google Shopping + SWIS + Storefront + Directory.
- This aligns tightly with the growth strategy pillars (Google + Storefront).

**Recommended next steps:**

- **[V1] Visibility analytics dashboard**  
  - Simple visibility panel: impressions, clicks, CTR for Google + storefront visitors.  
  - Clear "how many people saw your products" story.

- **[V2] SEO & social amplification utilities**  
  - Auto-generated social share images and copy for storefront.  
  - Surface structured data/SEO health in a simple way ("Your storefront SEO is Good/Fair").

- **[V3] Directory & storefront cross-linking**  
  - Highlight directory placement from within the storefront and vice-versa.  
  - Make sure QR flows and directory always respect custom domains (when present).

---

### 3.3 Intelligence – Understand What's Working 🧠

**Live features:**
- `basic_analytics` – Sales Insights  
- `advanced_analytics` – Deep Analytics  
- `ai_insights` – AI Recommendations (isNew)  
- `custom_reports` – Custom Reports

**Coverage:** 4 live features

**Score:** **6 / 10**

**Assessment:**
- Good analytics foundation with AI and custom reports.  
- Still room to push toward more decision-support and storytelling.

**Recommended next steps:**

- **[I1] Guided insights in plain language**  
  - Use `ai_insights` to surface 2–3 "headline" insights in the dashboard ("Top mover this week", "Most profitable category").

- **[I2] Multi-location comparative views**  
  - For tenants with multiple locations, add side-by-side views to understanding which location is over/under-performing.

- **[I3] Alerts tied to analytics**  
  - Not just static reports—set thresholds that trigger nudges (e.g., "Your Google impressions dropped 30% week over week").

---

### 3.4 Scale – Grow Beyond One Location 🚀

**Live features:**
- `multi_location` – Multiple Locations  
- `propagation` – Multi-Location Updates (Propagation Hub)  
- `team_access` – Team Collaboration  
- `advanced_permissions` – Advanced Permissions

**Coverage:** 4 live features

**Score:** **7 / 10**

**Assessment:**
- Strong multi-location support, especially with Propagation Hub and advanced permissions.
- This pillar is core to the Organization/chain experience.

**Recommended next steps:**

- **[S1] More propagation types**  
  - Extend Propagation Hub to cover more assets: promos, templates, business hours, theme/branding.

- **[S2] Chain-level analytics**  
  - Aggregated chain dashboards (top-performing locations, understocked locations, etc.).

- **[S3] Cross-tenant admin tooling**  
  - Tools for Organization admins to manage multiple tenants at once (bulk user management, bulk settings updates).

---

### 3.5 Automation – Work Smarter, Not Harder ⚡

**Live features:**
- `inventory_alerts` – Low Stock Alerts

**Planned:**
- `automated_ordering` – Auto-Reorder (comingSoon)

**Coverage:** 1 live feature, 1 planned

**Score:** **4 / 10**

**Assessment:**
- Automation is in its early stages (alerts).  
- Major upside once more "hands-off" workflows are delivered.

**Recommended next steps:**

- **[A1] Ship Auto-Reorder (automated_ordering)**  
  - Prioritize stabilizing and shipping the `automated_ordering` feature.  
  - Start with simple rules (min/max levels, supplier defaults) and iterate.

- **[A2] Rule-based automation framework**  
  - A basic automation rules engine: "When X happens, do Y" (e.g., low stock → send email/Slack, product added → auto-sync to Google).

- **[A3] Automation visibility & control**  
  - A "My Automations" page listing active rules, with toggles and logs (what fired when).

---

### 3.6 Connection – Connect Everything Together 🔌

**Live features:**
- `clover_pos` – Clover POS Integration  
- `square_pos` – Square POS Integration  
- `api_access` – API Integration  
- `custom_integrations` – Custom Integrations

**Coverage:** 4 live features

**Score:** **8 / 10**

**Assessment:**
- Strong story around POS integrations and APIs.  
- This pillar underpins your "Clover Integration" growth engine and future Square integration.

**Recommended next steps:**

- **[C1] Square UI integration completion**  
  - Finish UI integration for Square (settings, status, logs) to match Clover's experience.

- **[C2] Integration health dashboard**  
  - Central place to see integration status (connected, error, last sync) for Clover/Square/API.

- **[C3] Pre-built connectors**  
  - Identify 1–2 additional systems (e.g., accounting, marketing) for simple, high-value connectors using the existing API infrastructure.

---

### 3.7 Growth – Take It to the Next Level 📈

**Live features:**
- `priority_support` – Priority Support  
- `white_label` – White Label  
- `dedicated_account` – Dedicated Account Manager

**Coverage:** 3 live features

**Score:** **6 / 10**

**Assessment:**
- Focused on higher-tier value: support, branding, and account management.  
- Good base, but growth pillar can be expanded with more direct revenue/expansion levers.

**Recommended next steps:**

- **[G1] In-app upgrade nudges tied to usage**  
  - Contextual upgrade prompts when users hit limits (capacity, features) that map to Growth pillar offerings (e.g., priority support, white-label, custom domains).

- **[G2] Partner/agency tooling**  
  - Features that help agencies or multi-brand operators manage multiple tenants under white-label (reporting, templated rollouts).

- **[G3] Success playbooks & concierge workflows**  
  - For enterprise/organization tiers, formalize "playbooks" driven by the dedicated account manager (onboarding checklists, quarterly reviews, etc.) and surface their status in-app.

---

## 4. Overall Alignment Summary

**Pillar scores (1–10):**

| Pillar        | Score | Comment                                      |
|---------------|-------|----------------------------------------------|
| Foundation    | 9/10  | Deep, mission-critical coverage              |
| Visibility    | 8/10  | Strong Google + Storefront stack             |
| Intelligence  | 6/10  | Solid analytics, room for deeper insights    |
| Scale         | 7/10  | Multi-location + propagation well-developed  |
| Automation    | 4/10  | Early-stage; alerts live, more to come       |
| Connection    | 8/10  | Strong POS/API integration story             |
| Growth        | 6/10  | Good enterprise levers, room to expand       |

**Overall:** ~**7 / 10** alignment across pillars.

**Highest-impact next steps:**

- Short term (3–6 months):
  - Ship and polish **Automation** (`automated_ordering`, basic rules engine).  
  - Add **visibility + intelligence overlays** (visibility analytics panel, AI-driven insights in dashboard).  
  - Complete **Square UI integration** and integration health dashboards.

- Medium term (6–12 months):
  - Expand **Propagation** and **Scale** (more propagation types, chain analytics).  
  - Deepen **Growth** pillar with upgrade nudges and partner/agency tooling.

This document should serve as a living snapshot of pillar alignment and a guide for prioritizing future work in a way that keeps the product narrative coherent and mission-aligned.
