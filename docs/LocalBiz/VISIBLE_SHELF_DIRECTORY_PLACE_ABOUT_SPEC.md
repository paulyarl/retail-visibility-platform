# VisibleShelf Directory + Place About Page — Business Model Clarity Spec

**Status:** Draft — content and UX specification  
**Date:** 2026-09-23  
**Owner:** Product / Brand  
**Foundation:** `docs/PLATFORM_STRATEGY_V3.md`  
**Related:** `docs/PLATFORM_ROOT_COPY_ALIGNMENT_SPEC.md`, `docs/LocalBiz/directory_presence_progressive_upgrade_spec.md`

---

## 1. Purpose

Make the public About / How It Works experience explain VisibleShelf’s business model clearly to both shoppers and retail owners, and make that explanation easy to find from `/place` and `/directory`.

The central message is:

> **VisibleShelf helps local retailers get found by nearby shoppers—on VisibleShelf and on the external platforms shoppers already use. Owners can start with a free listing and a five-product starter shelf, then choose self-service visibility tools or hands-on Marketing Ops services to expand organic discovery. Commerce tools help turn that visibility into store visits and purchases. We sell software and services, not ad placements or paid traffic.**

This is a content and navigation spec. It does not itself change tier entitlements, billing, checkout, inventory synchronization, or the five-product limit.

## 2. Strategic foundation

`docs/PLATFORM_STRATEGY_V3.md` is the foundation for the product layers. The public explanation extends it with the common visibility-and-traffic capability thread:

- The target is the same local retailer; the problem is being hard to find, and the outcome is more qualified local discovery that can lead to visits and purchases.
- Visibility has multiple surfaces: VisibleShelf’s own directory/product storefront and external platforms shoppers already use.
- Software and Marketing Ops are two delivery modes for the same retailer visibility need: self-service capabilities and optional hands-on diagnosis/improvement across external platforms.
- **Directory Presence** is a free seed-and-claim gateway, not a paid tier.
- **Entry Presence** answers *where* the retailer is visible. Starter, Discovery, and Storefront are different visibility modes—not mandatory sequential upgrades.
- **Commerce** answers *how* a shopper commits money: Commitment (deposit), Ecommerce (full payment), or Omnichannel (both).
- Storefront is a browse/discovery surface, not checkout. Commerce capabilities are separate.
- The model is not ad-funded: do not confuse paid software or service work with purchasing ad placement or paid traffic.

### 2.1 Five free product slots: starter catalog scope

The requested public offer includes **five free product slots** with a claimed Directory Presence listing. Those five items are a **limited starter catalog**. Strategy wording such as “no catalog” should mean that the free gateway does not include a full catalog / broad product-browse experience; it must not imply that the five free product records do not exist. The strategy and the directory-presence entitlement documentation should use that distinction.

Before implementation, reconcile the strategy wording and entitlement configuration with the launch offer. The current implementation notes describe `max_skus: 0`, so verify that the free tier actually allows five slots before public copy promises them. The five slots do not by themselves include external-platform indexing, real-time inventory synchronization, an expanded catalog, or checkout.

## 3. Audiences and jobs

### Retail owner

Needs to understand:

1. Why a local directory listing can help shoppers find the store and its products.
2. What is free and what claiming the listing unlocks.
3. How paid plans expand visibility and commerce, without implying an owner must buy every tier.
4. Which plan or surface to explore next.

### Shopper

Needs to understand:

1. VisibleShelf helps find local businesses and products.
2. Product discovery can lead to a store visit, an inquiry/reservation, or an online purchase depending on the retailer’s enabled commerce setup.
3. VisibleShelf is a discovery and commerce platform—not a guarantee that every listed store supports checkout or live inventory.

## 4. Business-model truth and public claims

### 4.1 Free gateway: seed-first or owner-requested

The free offer applies through either entry path:

1. **Already listed:** The owner finds the public seed in the directory and claims it for free.
2. **Not listed:** The owner checks the directory, submits a request to add the business, and—after the required verification and review—has the business added as a free directory listing. The owner-request path must lead to the same free offer as a platform-seeded listing; it is not a paid submission.

For owner-requested listings, set expectations accurately: the current intake verifies anonymous submissions by email and routes the resulting draft seed for review before publication. Do not promise instant publication. Make the review/publishing step and the follow-up needed to access the listing clear in the live flow.

Once the owner has access to the accepted listing, the free offer includes five product slots to showcase selected products. Those slots do not imply a full catalog, paid Google indexing, real-time inventory sync, or checkout. The free gateway is a starter presence—not the paid full-catalog storefront or a checkout plan.

### 4.2 Paid visibility subscriptions

Explain these as **choices of visibility surface**, not as an obligatory staircase:

| Mode | Shopper-facing job | Boundary to preserve |
|---|---|---|
| **Starter / Presence** | Owner-controlled, richer directory presence | No Google product integration or checkout implied |
| **Discovery** | Product visibility through Google surfaces | Visibility/integration; not a VisibleShelf checkout tier |
| **Storefront** | Branded VisibleShelf product-browse experience | Browse/discovery; no checkout unless a Commerce mode is enabled |

Use the live public display names and prices from the canonical tier configuration when prices are shown. The About page should link to `/features#pricing` instead of maintaining its own price table.

### 4.3 Marketing Ops visibility services

Explain Marketing Ops as a second delivery mode for the **same retailer visibility problem**, not as a second target market:

- **Self-service software:** retailers use VisibleShelf capabilities to publish and grow their visibility on the platform and selected external surfaces.
- **Hands-on services:** Marketing Ops can diagnose and help improve the retailer’s organic visibility on external platforms, using the platform’s audit, recommendation, and fulfillment architecture.
- Services complement the software; they are not automatically included in the free seed or a software subscription unless the relevant plan explicitly says so.
- Do not frame these services as buying ad inventory, sponsored ranking, or guaranteed traffic. External-platform access, policies, and results remain subject to those platforms.

Keep two different channel concepts distinct in copy and analytics:

- **Retailer acquisition channels** (QR, mail, email, text, phone/remote, walk-in, social) are ways VisibleShelf reaches owners.
- **Shopper visibility surfaces** (VisibleShelf directory/storefront and external search, maps, shopping, or business-profile surfaces) are where a retailer may be discovered.

### 4.4 Paid commerce subscriptions

Explain separately that retailers can add a way for shoppers to transact:

| Mode | Payment job | Boundary to preserve |
|---|---|---|
| **Commitment** | Deposits / reservations and in-store pickup flows | Do not describe as full-payment e-commerce or delivery by default |
| **Ecommerce** | Full online payment | Describe fulfillment only to the extent enabled by the selected plan |
| **Omnichannel** | Deposit and full-payment options | Do not imply all payment rails are included in lower tiers |

Use the current plan comparison as the source for tier names, prices, limits, fulfillment, integrations, and specific entitlements. In particular, do not imply Storefront browsing includes a cart or checkout.

### 4.5 Monetization wording

The page must state the model plainly:

- The commercial model comprises merchant software subscriptions and optional Marketing Ops service engagements—not revenue from selling directory ads, sponsored rankings, or paid shopper traffic.
- Do not describe Directory Presence as an ad-supported free listing.
- “0% marketplace commission” may be used only when scoped to the paid checkout offer that carries that promise. It must not be generalized to all tiers or used to imply there are no payment-processing costs.
- Do not imply that every shopper action or store listing is transactional, or that external visibility services guarantee ranking or traffic.

## 5. Information architecture and copy requirements

The shared About experience should use the following order.

### 5.1 Hero: the retailer visibility promise

Lead with the shared problem and outcome: local shoppers cannot find the retailer or the products on its shelves. Make clear that visibility can be built on VisibleShelf and across external platforms, with self-service software or hands-on services.

Suggested direction:

> **Help nearby shoppers find your store—and what’s on its shelves.**  
> Start with a free VisibleShelf listing and a five-product starter shelf. Use subscriptions to expand your on-platform visibility and commerce capabilities, or get hands-on Marketing Ops help to improve organic visibility on external platforms. No ad placements are required.

Primary owner CTA: **Find and claim your store**.  
Owner fallback CTA: **Can’t find your store? Request a free listing** → `/directory/add-business`.  
Service CTA: **Get help improving your visibility** → the public Marketing Ops service-intake destination (confirm route before implementation).  
Secondary shopper CTA: **Browse local stores**.

Do not state that Google, maps, or another platform has indexed a product unless the relevant plan and integration actually provide that surface. Do not imply that visibility requires buying ad inventory or guarantees a rank or amount of traffic.

### 5.2 The free starting point

Show both ways a business gets into the free program:

- **Already listed:** Find and claim the existing seed at no cost.
- **Not listed:** Request that the business be added at no cost; explain any verification, review, and publication steps before promising the listing is live.
- Once the owner has access to the accepted listing, the same offer applies: five free product slots.
- No checkout is included in the free gateway.

Suggested copy:

> **Start with a free listing and five products.** If your store is already here, claim it and check the details. Can’t find it? Request a free listing. After your request is verified and approved, you can use the same five product slots to show shoppers what’s on your shelves. Add broader discovery or selling capabilities only if and when you need them.

The exact confirmation and follow-up copy must match the submission experience; do not imply an unreviewed request is already a live public listing.

### 5.3 Explain how the business model works

Show a simple progression from being found to converting shopper intent:

1. **Find or request a listing** — VisibleShelf seeds businesses from public information. If a store is missing, its owner can request a free addition.
2. **Claim and create a starter shelf** — Owners claim an existing listing, or complete the verification/review steps for an owner-requested listing. Once accepted and accessible, both paths lead to the same free five-product starter catalog.
3. **Grow visibility** — Retailers can build their presence on VisibleShelf, improve organic visibility across external platforms, or use both. They can manage this through software or choose hands-on Marketing Ops services.
4. **Convert discovery** — Add the appropriate commerce capabilities when the retailer is ready to support reservations, pickup, or online payment.

Pair the sequence with direct model copy:

> **No paid ads or purchased placement.** Start with a free listing and five products. Use VisibleShelf software to build your visibility, or get hands-on help improving your presence on external platforms. Paid subscriptions and optional services fund the work—not ads competing for directory rank.

Do not say “no ads anywhere on the platform” unless that broader advertising policy is confirmed. Do not promise external rankings or traffic outcomes controlled by third-party platforms.

### 5.4 One visibility need, multiple surfaces and delivery modes

Avoid presenting VisibleShelf software and Marketing Ops as separate audiences or unrelated product lines. Keep the same retailer and the same outcome visible: **more qualified local shoppers can find the store and its products.**

**Visibility surfaces:**

- **On VisibleShelf:** directory listing, starter product shelf, and—on the relevant paid tiers—a broader branded product-browse surface.
- **On external platforms:** organic visibility improvements delivered through supported integrations and/or Marketing Ops services.

**Ways the retailer can get help:**

- **Self-service software:** the retailer uses subscriptions and platform capabilities to manage presence and commerce.
- **Hands-on services:** Marketing Ops diagnoses visibility gaps and supports work to improve the retailer’s external presence.

**Commerce is the conversion layer**, not another visibility surface:

- Commitment: deposits and reservation/pickup flows.
- Ecommerce: full online payment.
- Omnichannel: deposit and full-payment options.

A retailer can use one or both visibility surfaces and choose self-service or assisted delivery. Explain the appropriate paid subscription or service separately; do not imply every capability or service is bundled into the free listing, or that every retailer must buy every tier.

### 5.5 Commerce explanation

Explain that “e-commerce” is a real product capability, not merely a visual product catalog. Use accurate examples: add-to-cart and checkout where enabled; payment mode and fulfillment vary by commerce tier.

Suggested copy:

> **When you’re ready to sell online, choose a checkout model that fits your store.** Offer a deposit to secure a pickup, accept full payment online, or enable both through the appropriate commerce plan. Your store remains the local fulfillment destination where the selected plan supports pickup.

Keep delivery, shipping, POS sync, deposits, refunds, payment methods, and other detailed limits linked to the feature comparison rather than overloading this summary page.

### 5.6 Close with clear next steps

- Retailer CTA: **Find and claim your store** → directory search / existing claim journey.
- Missing-store CTA: **Request a free listing** → `/directory/add-business`; explain verification, review, publication, and owner follow-up accurately.
- Self-service CTA: **Compare plans and capabilities** → `/features#pricing` (or the canonical pricing anchor if it changes).
- Assisted-service CTA: **Get help improving your visibility** → the public Marketing Ops service-intake destination (confirm route and scope before implementation).
- Shopper CTA: **Browse the directory** → `/directory` or `/place`, according to the entry surface.

## 6. Navigation and route behavior

### 6.1 Shared content

Use one shared public About/How It Works content source so the `/place` and `/directory` entry points cannot drift into different business-model explanations.

- Preferred canonical route: `/place/about`, which currently carries the more complete retailer-facing explanation and is already linked from place listings and claim flows.
- Keep `/directory/about` working for existing links and search results. It must no longer render the separate “zero-effort / pure automation” narrative. It should either redirect to `/place/about` or render the shared page with canonical metadata pointing to `/place/about`.
- Preserve all existing inbound claim and place-page links; do not strand visitors during route consolidation.

### 6.2 Entry links

- On `/directory`, replace **“See how this directory works its magic”** with **“How VisibleShelf works”** or **“How free listings grow into product discovery and checkout”**, linked to the canonical About page.
- On `/place`, add **“How VisibleShelf works”** near the existing “About These Listings” seeded-list explanation, linked to the same canonical page.
- Keep the existing “Learn what VisibleShelf offers” and five-product teaser links from individual place pages, updating their visible copy only as needed to match the shared narrative.
- Ensure the link is visible and keyboard accessible on mobile and desktop; do not rely on hover-only disclosure.

## 7. Copy and accuracy guardrails

- Use **VisibleShelf** consistently (one word, exact casing).
- Keep the retailer promise grounded in physical shelves, local product discovery, and retailer-controlled commerce.
- Distinguish *listing*, *product slots*, *product indexing*, *storefront browsing*, and *checkout*. They are not synonyms.
- Label free vs paid capabilities and identify the relevant layer wherever a capability is mentioned.
- Do not promise real-time inventory or in-stock accuracy unless the relevant product data is connected and current.
- Do not promise Google visibility from the free five slots.
- Do not imply the free directory listing has checkout, or that Storefront browsing alone has checkout.
- Avoid “zero effort,” “always current,” “fully automatic,” or similar absolute operational promises unless substantiated for the exact flow.
- Prices, product limits, and entitlement statements must come from one maintained source, not independent hard-coded About-page copy.

## 8. Out of scope

- Changing tier prices, names, billing, or entitlement behavior.
- Implementing or changing e-commerce checkout, payment processing, fulfillment, inventory synchronization, or marketplace commission rules.
- Redesigning directory search, individual business listings, product pages, or the full `/features` page.
- Making broad claims about third-party display advertising beyond the directory’s core business model.

## 9. Acceptance criteria

1. A first-time retailer can answer, without navigating away:
   - Is the listing free, and what does the five-product starter catalog include?
   - How does VisibleShelf help shoppers find the retailer on-platform and externally?
   - Can the retailer use self-service software, hands-on services, or both?
   - How does VisibleShelf make money?
   - Which plan layer enables checkout?
2. The page explains both free entry paths: claim an existing seed, or request a missing business be added. Both lead to the same free starter catalog.
3. The missing-business path describes any owner verification, review, publication, and follow-up steps accurately; it does not present a pending request as an already-live listing.
4. The page describes one target audience (local retailers) and one visibility problem, with VisibleShelf software and Marketing Ops services as complementary delivery modes.
5. It distinguishes retailer acquisition channels from shopper visibility surfaces, and describes organic external visibility without implying purchased ad placement.
6. The commercial model is clear: merchant subscriptions and optional Marketing Ops service engagements, not directory ads or paid shopper traffic.
7. The free five-product starter catalog is clearly separated from paid discovery, expanded browsing, and checkout capabilities.
8. Entry Presence modes and Commerce modes are presented as distinct choices, consistent with `PLATFORM_STRATEGY_V3.md`.
9. `/place` and `/directory` both provide a clear, accessible path to the same About explanation.
10. `/directory/about` no longer contradicts `/place/about`; existing links continue to resolve.
11. No copy promises checkout, Google visibility, real-time stock, guaranteed external ranking/traffic, or 0% commission outside the tier/service that actually provides it.
12. Prices, names, and plan limits shown on the page match the canonical tier/pricing source; otherwise the About page links to the plan comparison instead of duplicating them.
13. The five-slot starter catalog entitlement and strategy wording in §2.1 are reconciled before launch copy claims the feature is live.
14. The page remains readable and usable at mobile, tablet, and desktop sizes, with keyboard-visible focus on all navigation and CTA links.

## 10. Verification sources

- `docs/PLATFORM_STRATEGY_V3.md` — strategic mission, Gateway / Entry Presence / Commerce / Scale layers, and mode taxonomy.
- `docs/PLATFORM_ROOT_COPY_ALIGNMENT_SPEC.md` — public-copy framing and the directory How It Works surface.
- `docs/LocalBiz/directory_presence_progressive_upgrade_spec.md` — gateway and peer Entry Presence model; Storefront is browse, not checkout.
- `docs/LocalBiz/PLATFORM_OFFERING_ARCHITECTURE.md` — Marketing Ops diagnostic and fulfillment architecture for visibility work across external platforms.
- `apps/web/src/app/features/page.tsx` — current public feature and pricing claims to reconcile against canonical tier data.
- `apps/web/src/app/place/about/PlaceAboutClient.tsx` and `apps/web/src/app/directory/about/AboutDirectoryClient.tsx` — existing About-page content to consolidate.
