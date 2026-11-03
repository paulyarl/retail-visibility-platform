# Connect Ladder Copy Spec

**Status:** DRAFT v0.1 (2026-11-03). Specifies the copy fix on both sides of the claim moment: the pre-claim "about the trio" surfaces and the post-claim trio.
**Companion:** `POS_INGESTION_PARTNER_PATH_SPEC.md` §11–§17 (the motion), `OWNERSHIP_PACKET_TEMPLATE.md` (the artifact), `directory_presence_claim_handoff_spec.md` (the screen being changed).

---

## 1. The change in one line

**Connection becomes the hinge of the ladder, and the trio stops being the first thing a merchant is asked to choose.**

Today the claim success screen opens with three paid modes and recommends commerce. That asks a merchant who has no catalog and no website to pick a surface before they have seen anything work. The fix is not a new tier and not a price change — it is a **state gate**: connect first, then choose a surface.

## 2. The canonical ladder

| Step | Merchant action | What they get | Effort |
| --- | --- | --- | --- |
| 1 | **Claim your page** | identity + their own web address | ~2 min |
| 2 | **Connect your inventory** | their real catalog on that page | mechanism-dependent |
| 3 | **See it live** | products on their page (minutes), then Google (days–weeks) | — |
| 4 | *Optional:* add commerce | checkout, fulfillment, payment | later |

**Step 3 is two moments, not one.** Page-live is minutes and under our control; Google-live is days to weeks and is not. Copy must never collapse them — a merchant who reads "live" as "on Google" will grade the pipeline on Google's latency.

**Step 4 is optional and must read as optional.** A grocery with steady walk-in traffic may never want checkout. A ladder that implies an unwanted destination is one the merchant stops climbing at step 3 — which is a valid outcome, not a failure.

## 3. Terminology contract

| Layer | Term | Rule |
| --- | --- | --- |
| Merchant-facing copy | **connect** | one verb for all three mechanisms: pricebook export, Clover authorization, manual entry |
| Mechanism description (sub-line) | "send your pricebook" · "approve the Clover connection" · "add your items" | names the *how*, never replaces the verb |
| Internal / spec / API | ingestion, import, `inventory-import` | **unchanged** — do not rename technical surfaces for copy reasons |

`connect` is the only word that appears on all three paths. That is the point: one script in the field, three pipes behind it.

## 4. Pre-claim surfaces — "about the trio"

These are the public surfaces where a merchant learns what the platform is, before any claim.

### 4.1 `GatewayStrip` (priority 0 — the free floor)

Per the tier contract the ladder must never start at a price, so the free floor is a destination, not a teaser. It also has a name now.

| Element | Copy |
| --- | --- |
| Headline | **A page that looks like a business.** |
| Body | Hours, address, phone, a photo and your category — the minimum a shopper needs before deciding to walk in. |
| CTA | **Claim your page** |
| Price | none. No cost line, no "from $X". |

**Why "looks like a business" rather than "get listed":** the buyer is a merchant with no website whose fear is absence, not obscurity. The floor answers that fear directly.

### 4.2 `TriadSection` (priority 1 — three peer modes)

Per `AGENTS.md` the triad is three **peer** modes rendered as a picker, not a ladder. It gains one connective sentence and keeps its three labels.

| Element | Copy |
| --- | --- |
| Connective line (new) | **All three start with connecting your inventory.** |
| Mode 1 — Storefront | Sell from your page — deposit checkout |
| Mode 2 — SWIS | Your products on Google |
| Mode 3 — Storefront+ | Your full catalog, browsable |

The connective line is the fix. The triad previously read as three unrelated purchases; it now reads as three destinations reached through one step.

### 4.3 `/features` and `/faq`

Anywhere the trio is described as a menu, prepend the ladder in one sentence: *claim your page → connect your inventory → see it live.* Do not add a fourth card; the ladder is a sentence, not a tier.

## 5. Post-claim surfaces — the state gate

The claim success screen (`ClaimUpgradeTeaser`) and the dashboard handoff (`TierUpgradeCard`) render from `presence-modes.ts`, which mirrors `DirectoryPresenceUpgradeOptionsService`.

### 5.1 State A — claimed, not connected

This is the default after a claim and the state almost every pioneer lands in.

| Element | Copy |
| --- | --- |
| Heading | **Your page is live.** |
| Body | Connect your inventory and it fills in — your products, prices and stock, on the page you now control. |
| Primary CTA | **Connect your inventory** → deep-links to the ingestion surface for their POS (or the manual sheet) |
| Secondary | "See what else is possible" — expands the triad |
| Triad cards | **collapsed by default.** Never the first thing shown. |

### 5.2 State B — connected

| Element | Copy |
| --- | --- |
| Heading | **Your inventory is connected.** |
| Body | Your products are on your page. Next: put them in front of people searching nearby. |
| Primary CTA | **Put your products on Google** (`discovery`) for catalog-bearing merchants |
| Triad cards | visible, ordered by the ladder |

### 5.3 What does **not** change

- `isPrimary` on `presence` stays as-is. The defect was never the mode ordering — it was that a *mode recommendation* appeared before connection. A state gate fixes it without touching pricing logic.
- No tier is renamed, added, or repriced by this spec.
- `FALLBACK_PRESENCE_MODES` prices and the "from $X/mo" rendering rule are unchanged.

## 6. Code touchpoints

| Surface | File | Note |
| --- | --- | --- |
| Mode copy + taglines | `apps/web/src/lib/presence-modes.ts` | mirrors the API module — **edit both** |
| Mode copy (API) | `apps/api/src/services/DirectoryPresenceUpgradeOptionsService.ts` | `ENTRY_PRESENCE_MODES` / `GATEWAY_UPGRADE_SOLUTIONS` |
| Public triad + gateway strip | `apps/web/src/components/FeaturesShowcase.tsx` | `GatewayStrip` (priority 0), `TriadSection` (priority 1) |
| Triad label pins | `apps/web/src/components/FeaturesShowcase.test.ts` | three surface labels are asserted — update together |
| Claim success screen | `apps/web/src/app/directory/claim/[token]/` + `ClaimUpgradeTeaser` | the state gate lives here |
| Dashboard handoff | `TierUpgradeCard` | same copy source |

**Contract guards:** `shared/tier-contract.json` lists every file declaring tier copy in `surface_files`; the `tier-*` and `mv-shape-lint` suites fail on drift. Copy edits that add or rename a declared surface must update the fixture first.

## 7. Open decisions

1. **Does the pioneer grant carry a custom domain?** If yes, the claim copy should say so — it is a materially larger gift than a subdomain. If no, current wording stands.
2. **Is `discovery` the paid rung for grocery merchants, or `presence`?** Two independent lines of reasoning (walk-in value vs transaction value; the packet's step 2 being products, not checkout) point at discovery. Needs the pilot's before/after screenshot before the pricing changes.
3. **Where does State A deep-link for a merchant with no POS?** The manual sheet is the honest default, but it is a bigger ask than "approve a connection" and the copy should not pretend otherwise.
