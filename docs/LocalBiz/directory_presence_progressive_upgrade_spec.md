# Spec: Entry Presence Ladder — Directory On-Ramp → Presence Modes

**Document Version:** 3.1  
**Date:** 2026-08-18  
**Status:** Draft — Product taxonomy locked; implementation phased  
**Supersedes:** v3.0 (revive `starter` key), v2.0 (one-time website/listing_plus ladder), v1.0  
**v3.1 change:** New tier key `presence` (not `starter`) to avoid 79-file legacy purge. Price locked at $19/mo. Migration 231. `google_only` stays inactive.  
**Prerequisite:** Directory Presence Seed & Claim (migrations 206–209); claim promotes OWNER; upgrade routes exist; light-tier contract in `docs/DIRECTORY_PRESENCE_LIGHT_TIER_SPRINT_PLAN.md`.

**Strategic references:**
- **`docs/PLATFORM_STRATEGY_V3.md`** — source of truth (Entry Presence + Commerce dual triads; supersedes V2)
- `docs/PLATFORM_STRATEGY_V2.md` — stub pointing at V3 only
- `.devin/skills/tier-hierarchy.md` — code/agent hierarchy aligned to V3
- `.devin/skills/directory-presence-seed-claim/SKILL.md` — update after land (gateway vs Presence)

---

## 0. Locked product taxonomy

### 0.1 Two commercial contexts (parallel design)

**Commerce context** (existing V2) — *how money moves*:

| SKU | Mode |
|-----|------|
| Commitment | Deposit only |
| Ecommerce | Full payment only |
| Omnichannel | Both |

**Entry Presence context** (this spec) — *where the business is visible*:

| SKU | Mode | Surface owner |
|-----|------|----------------|
| **Presence** | Directory presence | **Platform in-house directory** |
| **Discovery** | Google visibility | **Third-party (Google)** — platform sells integration onto Google’s wave |
| **Storefront** | Platform presence | **Platform in-house marketplace** |

Same layer of the product. Different **visibility surface**. Not “more features piled up” — **which rail is open**.

### 0.2 Directory Presence is not a fourth peer

```
Directory Presence          ← FREE on-ramp (foot-in-the-door / gateway to the castle)
  unclaimed seed → claim
  NAP shell, classic listing, SNAP when sourced
  no commitment to a paid presence mode yet
        │
        ▼
Entry Presence (PAID)       ← choose a surface mode
  ├── Presence    → directory surface (in-house directory)
  ├── Discovery   → Google surface (third-party integration)
  └── Storefront  → platform surface (in-house marketplace visitility)
        │
        ▼
Commerce (later)
  ├── Commitment / Ecommerce / Omnichannel
```

| Layer | Role | Billing |
|-------|------|---------|
| **Directory Presence** | Gateway. Market density. Claim funnel. Truth from public data. | Free / invite-only (`billing_type = none`) |
| **Entry Presence** | Owner pays for a chosen visibility *mode* | Subscription (primary) |
| **Commerce** | Owner pays for a chosen money *mode* | Subscription (unchanged) |

**One-line doctrine:**  
Directory Presence gets them **into the castle courtyard**. Presence / Discovery / Storefront are **which hall they rent**. Commerce is **whether they open a till**.

### 0.3 Surface definitions (precise)

| Mode | Definition | Pays for |
|------|------------|----------|
| **Presence** | Platform’s **in-house directory visibility surface** + the natural paid path from free/unclaimed directory | Owned, enriched directory listing the merchant controls |
| **Discovery** | Platform offering **visibility integration to a third-party surface (Google)** | Riding Google Search / Shopping / Maps / SWIS (+ supporting product/Google rails) |
| **Storefront** | Platform’s **in-house marketplace visibility surface** | Branded store presence + platform product browse on Visible Shelf |

### 0.4 Explicit non-goals of this taxonomy

- Directory Presence is **never** a paid SKU for acquisition cohorts (no “maybe price presence later”).
- Presence is **not** legacy `starter` feature bag (old clover+SEO+storefront muddle). New definition = **directory mode only**.
- Discovery is **not** “light storefront.” It is Google-centric third-party visibility.
- Storefront is **not** checkout. It remains presence/browse (V2): no purchase rails until Commerce tiers.
- One-time `$25 website` / `$50 listing_plus` are **not** peer presence modes. Optional later as Presence *setup packs*; not the ladder spine.

### 0.5 Decisions locked

| # | Decision | Choice |
|---|----------|--------|
| T1 | Free on-ramp | `directory_presence` only; gateway forever for seed/claim |
| T2 | Entry Presence triad | `presence` (directory) · `discovery` (Google) · `storefront` (platform) |
| T3 | Mode relationship | **Peer choices** from claim for v1 primary UX; inheritance rules in §3 |
| T4 | Tier key | **New key `presence`** (not `starter`). Old `starter` code stays dormant — no 79-file legacy purge. Display name = "Starter". |
| T5 | Progressive v2 one-time spine | **Superseded.** Optional packs deferred (§10). |
| T6 | First paid default CTA after claim | **Presence** (directory) — lowest friction continuation of the gateway story |
| T7 | Discovery / Storefront CTAs | Explicit alternate modes: "Get found on Google" / "Open your platform store" |
| T8 | Commerce | Unchanged; only after Entry Presence (any paid presence mode) |
| T9 | Photo/logo on free claim | Claim may fix NAP; **public logo/about** are Presence+ (align light-tier invite copy) |
| T10 | Specialty line | Free provenance display if sourced; not a sold SKU |
| T11 | `sort_order` | INTEGER spaced ladder (see §2) |
| T12 | Payment for paid modes | Existing `subscribe()` + PM collection (fix upgrade UI) |
| T13 | Migration | **`231_entry_presence_tier.sql`** (next free after 230) |
| T14 | Presence price | **$19/mo** (locked for initial launch; adjustable via DB) |
| T15 | `google_only` tier | **Keep as inactive maintenance.** Platform driven by active tiers. No changes to its code. |
| T16 | Legacy `starter` tier | **Stays inactive.** 79 files referencing `'starter'` are dormant code paths. No purge required. Clean up incrementally if desired. |

---

## 1. Executive summary

Free Directory Presence lands owners on a courtyard: listed, claimable, not yet paying. Today’s upgrade CTA is a cliff into $29–$499/mo tiers framed as “sell online,” which mismatches both V2 and the Indy seed cohort.

This spec defines:

1. **Directory Presence** as the permanent free gateway.
2. **Entry Presence** as three peer paid modes — Presence (directory), Discovery (Google), Storefront (platform) — structurally analogous to Commitment / Ecommerce / Omnichannel.
3. **Claim → choose a presence surface** UX (not “cosmetics then Google”).
4. **Presence** as directory-mode only (new clean tier key, no legacy `starter` revival).
5. Implementation phases that stay honest about code debt (`|| 'starter'` fallbacks, tier-features maps, skill/docs).

---

## 2. Tier ladder

### 2.1 Proposed order (INTEGER `sort_order`)

| sort_order | tier_key | Price | billing_type | Layer | Surface |
|------------|----------|-------|--------------|-------|---------|
| 0 | `directory_presence` | $0 | `none` | Gateway | Free directory shell |
| **10** | **`presence`** | **$19/mo** | `subscription` | Entry Presence | **Directory** (in-house) |
| **20** | `discovery` | $29/mo | `subscription` | Entry Presence | **Google** (third-party) |
| **30** | `storefront` | $59/mo | `subscription` | Entry Presence | **Platform** (in-house) |
| 40+ | commitment → … | existing | `subscription` | Commerce+ | — |

> Presence price locked at $19/mo for launch. Discovery/Storefront keep V2 price points.

Migration renumbers existing subscription tiers onto this spacing without changing relative commerce order.

### 2.2 Feature / mode matrix (Entry Presence)

| Capability | directory_presence | presence | discovery | storefront |
|------------|:---:|:---:|:---:|:---:|
| Directory listing (classic) | ✅ | ✅ | ✅ | ✅ |
| Hours / map / contact / QR | ✅ | ✅ | ✅ | ✅ |
| SNAP badge (sourced) | ✅ | ✅ | ✅ | ✅ |
| Claim / owner control of NAP | claim→ | ✅ | ✅ | ✅ |
| Logo + about on public listing | ❌ | ✅ | ✅ | ✅ |
| Gallery + editorial/immersive layouts + social | ❌ | ✅ | ✅* | ✅ |
| **Primary surface = directory enrichment** | gateway | **✅ core** | side | side |
| Google Search / Shopping / Maps SWIS | ❌ | ❌ | **✅ core** | ✅ inherit† |
| Clover + SEO product pages for Google path | ❌ | ❌ | **✅ core** | as needed |
| Branded **platform** storefront page | ❌ | ❌ | ❌ | **✅ core** |
| Platform product visibility / browse | ❌ | ❌ | ❌ | **✅ core** |
| Shopper inquiry | ❌ | ❌ | ❌ | ✅ |
| Catalog checkout / deposit / full pay | ❌ | ❌ | ❌ | ❌ (Commerce+) |

\* Discovery may keep thin directory chrome; full gallery/layout pack is Presence's differentiator — Discovery need not duplicate every directory polish if Google is the job. Prefer: Presence owns directory polish; Discovery owns Google; Storefront owns platform browse.  
† V2 Storefront includes Discovery (Google). Keep that **combine-up** unless product later splits pure platform-only. Documented as: Storefront = platform mode **plus** Google inheritance (like Omnichannel includes both pay modes).

### 2.3 Pure mode rules (do not smear)

| Mode | Must not become |
|------|-----------------|
| Presence | A quiet Google tier or full marketplace catalog |
| Discovery | "Light storefront" / platform product browse |
| Storefront | Checkout / commitment commerce |
| directory_presence | A paid SKU or Google ramp requiring card |

---

## 3. Inheritance and upgrade graph

### 3.1 Peer choice at Entry Presence (primary UX)

After claim, owner **picks a mode**:

```
        [Claimed: directory_presence]
                 │
     ┌───────────┼───────────┐
     ▼           ▼           ▼
  Presence   Discovery   Storefront
 (directory)  (Google)   (platform)
```

Not forced through Google to reach platform.

### 3.2 Later moves (secondary)

| From → To | Meaning |
|-----------|---------|
| presence → discovery | Add / switch emphasis to Google surface |
| presence → storefront | Move into platform marketplace presence (includes Google per V2) |
| discovery → storefront | Add in-house platform surface (V2 upgrade story) |
| discovery → presence | Downgrade/lateral — **operator only** v1 |
| storefront → discovery | Downgrade — **operator only** v1 |
| any Entry Presence → commitment+ | Enter Commerce context |

### 3.3 Capability inheritance (runtime)

Align `TIER_HIERARCHY` / effective features to:

```
directory_presence: []
presence:           [directory_presence]          // directory mode + gateway caps (NEW KEY)
discovery:          [directory_presence]          // Google mode; thin directory chrome
storefront:         [discovery, directory_presence] // platform + Google (V2) + gateway
commitment+:        [storefront, …]               // unchanged spirit
```

**Important:** Do **not** keep legacy:

```
starter: [google_only, directory_presence]  // OLD - pulls Google into Starter (dormant)
```

Presence must **not** inherit `google_only` or Discovery Google caps. It is a clean new entry.

### 3.4 Legacy `starter` code — no purge required (v3.1 decision)

The old `starter` tier is **inactive** in the DB and stays inactive. 79 files reference `'starter'` in code, but these are **dormant code paths**.

**v3.1 approach:** Do NOT modify old `starter` entries. Add **new clean entries** for `presence`. Clean up incrementally later.

This eliminates the largest risk of the v3.0 plan (reactivating the wrong product feature bag) and the largest scope (79-file purge).

---

## 4. Presence capability set (directory mode)

### 4.1 Baseline from gateway (already on directory_presence)

- `directory_entry_enabled`
- `directory_entry_layout_classic`
- `directory_entry_hours_on` / `map_on` / `contact_on` / `qr_on`
- `storefront_enabled` + `storefront_retail` (one-page presence shell, no catalog)
- `directory_visibility_snap_ebt`

### 4.2 Presence unlocks (paid directory surface)

| feature_key | Role |
|-------------|------|
| `directory_entry_logo_on` | Public logo (`logo_url`) |
| `directory_entry_about_on` | About/story (`business_description`) |
| `directory_entry_gallery_on` | Gallery (resolver already reads) |
| `directory_entry_layout_editorial` | Editorial layout |
| `directory_entry_layout_immersive` | Immersive layout |
| `directory_entry_social_on` | Social section |

Insert keys in SQL if missing; gate public render + settings on same sprint as billing.

### 4.3 Explicitly off Presence

- Google Search / Shopping / SWIS / Merchant Center push  
- Platform product visibility / marketplace browse rails  
- Checkout, deposit, coupons commerce  
- Legacy starter: clover_pos, category_quick_start, image_finder as *Starter* entitlements (those belong Discovery or higher / tools SKUs)

### 4.4 Invite / claim copy alignment

Light tier said: claim to fix hours/phone and add a photo.  
Under this taxonomy:

> Claim to take ownership and fix NAP.  
> **Presence** (Starter) unlocks your full directory presence (logo, story, photos, richer layouts).  
> This is not an online store and not Google ads.

Update operator invite templates accordingly.

---

## 5. Discovery & Storefront positioning (no capability strip)

### Discovery — third-party surface

- Job: **visibility integration onto Google**  
- Headline: “Get found on Google”  
- Remains paid because Google-centric work + ongoing integration value  
- Does **not** sell “your store on our marketplace” as the primary story  

### Storefront — in-house platform surface

- Job: **platform marketplace presence**  
- Headline: “Own your platform store”  
- Branded page + product visibility + browse (V2)  
- Inherits Google per V2 unless product later splits  

### Copy updates

| Surface | Avoid | Prefer |
|---------|-------|--------|
| Claim CTA | Upgrade to Sell Online | Choose your visibility / Start with Directory (Presence $19/mo) |
| Dashboard card on gateway | Sell online cliff | Three mode cards or Presence primary + alternates |
| Discovery description | Entry-level everything | Google visibility integration |
| Storefront description | Vague “presence” | In-house platform store & product browse |
| Presence description | Legacy starter blurbs | In-house directory visibility — paid path from free listing |

---

## 6. Progressive disclosure UX

### 6.1 Principle

Gateway shows **one recommended next step (Presence)** plus clear alternates for the other two modes — not a 10-tier comparison dump as the first screen.

### 6.2 Claim success

```
✓ Listing claimed — you’re in the courtyard.

Primary:
  [ Activate Directory Presence — Starter $19/mo ]
  Logo, story, photos, richer listing. Platform directory surface.

Also available:
  [ Get found on Google — Discovery $29/mo ]
  [ Open platform store — Storefront $59/mo ]

[ Go to dashboard ]  [ Back to directory ]
```

### 6.3 Dashboard `TierUpgradeCard`

| currentTier | Show |
|-------------|------|
| `directory_presence` | Primary Presence; links to Discovery & Storefront |
| `presence` | “Add Google” (Discovery) · “Open platform store” (Storefront) |
| `discovery` | “Open platform store” (Storefront); optional directory polish note if thin |
| `storefront`+ | Hide or commerce next-step (existing) |

### 6.4 Upgrade page = mode picker then commerce

```
── Entry Presence (pick a surface) ──
  Presence    Directory (in-house)     $19/mo
  Discovery   Google (third-party)     $29/mo
  Storefront  Platform (in-house)      $59/mo

── Commerce (after presence) ──
  Commitment / Ecommerce / Omnichannel / …
```

Only list targets with `sort_order > current` **or** explicit allowed peer graph (§3). Peer choice from gateway lists all three Entry Presence modes even if sort_order differs.

**Implementation note:** Gateway upgrade options must not use only `sort_order > current` if that hides peer modes incorrectly; for `directory_presence`, return the curated Entry Presence set (`presence`, `discovery`, `storefront`).

### 6.5 Subscription payment UX

All three modes use **subscription** subscribe path:

1. Collect `paymentMethodId` via Stripe Elements (upgrade page currently broken without PM — fix in scope).  
2. `POST /api/tenant/:tenantId/upgrade` with `{ targetTier, billingCycle, paymentMethodId }`.  
3. Handle SCA `requiresAction`.  
4. Invalidate capabilities; redirect dashboard.

No one-time PI spine required for v3 core.

---

## 7. Backend / data (implementation contract)

### 7.1 `billing_type` on tiers

```sql
ALTER TABLE subscription_tiers_list
  ADD COLUMN IF NOT EXISTS billing_type TEXT NOT NULL DEFAULT 'subscription';
-- 'none' | 'subscription'  (one_time reserved if packs return later)
```

- `directory_presence` → `none`  
- presence / discovery / storefront / commerce → `subscription`

### 7.2 Presence tier row

- **INSERT** new `presence` tier row (no existing row in DB — `starter` is inactive and stays inactive)
- `tier_key = 'presence'`, `display_name = 'Starter'`, `price_monthly = 19.00`, `sort_order = 10`
- `max_skus`: 0 (directory mode purity — no catalog)
- `max_locations`: 1
- `tier_type`: 'individual'
- `billing_type`: 'subscription'  

### 7.3 Upgrade options API

Special-case current tier `directory_presence`:

```ts
upgradeOptions = [presence, discovery, storefront] // active only
// each with billingType, priceMonthly, mode: 'directory' | 'google' | 'platform'
```

From `presence`, options = discovery + storefront (+ commerce if desired later).  
From `discovery`, options = storefront + commerce.  
Do **not** use naked `price_monthly > 0 && sort_order > current` alone for gateway.

### 7.4 Upgrade POST

- OWNER/ADMIN only  
- Reject free short-circuit for paid targets  
- `billing_type === 'none'` not self-serve upgrade target  
- `subscribe()` for all Entry Presence paid modes  
- Branch free instant flip **removed** for anything with price > 0  

### 7.5 Capability invalidation

On successful subscribe / tier flip: `invalidateEffectiveCapabilities(tenantId)`.

### 7.6 One-time packs (deferred)

If later product wants $25 logo pack without full Presence sub:

- Add under Presence as `tenant_tier_purchases` or feature purchase  
- Must not reintroduce packs as peer modes on the Entry Presence chooser  

---

## 8. Frontend files (indicative)

| File | Change |
|------|--------|
| `DirectoryClaimClient.tsx` | Mode picker CTAs; kill “Sell Online” |
| `TierUpgradeCard.tsx` | Gateway → Presence primary + alternates |
| `upgrade/page.tsx` | Entry Presence section + commerce section; **PM collection** |
| `DirectoryPresenceUpgradeService.ts` | Mode-aware options types |
| `tier-features.ts` / tier-resolver / growth tips | Add `presence` clean entries (no purge) |
| Public place layouts | Logo/about/gallery gates for Presence+ |
| Light-tier invite copy / operator guide | Align photo promise |

---

## 9. Migration sketch — `231_entry_presence_tier.sql`

1. Add `billing_type` if missing; set `directory_presence = none`.
2. Renumber `sort_order` (0 / 10 / 20 / 30 / 40+).
3. **INSERT** new `presence` tier row (`tier_key='presence'`, `display_name='Starter'`, `price_monthly=19.00`, `sort_order=10`, `billing_type='subscription'`).
4. Insert `tier_features_list` rows for `presence` with directory-mode set (§4). Do NOT touch old `starter` feature rows.
5. Ensure discovery/storefront feature rows still match V2 jobs. Add logo/about/gallery features to discovery+ so upgrades never strip presence features.
6. Add logo/about feature keys + public gating prerequisites.
7. Update display names/descriptions for triad.
8. **No** `website` / `listing_plus` tier inserts. **No** `starter` tier activation.

Post: `prisma db pull` → generate → `pnpm checkapi` / `pnpm checkweb`.

---

## 10. Deferred / open

| Item | Notes |
|------|-------|
| Exact Presence price | **Locked: $19/mo** (adjustable via DB) |
| Storefront without Google | Optional pure platform SKU later |
| Multi-surface combine SKU | “Presence Omnichannel” later (dir+Google+platform) |
| One-time directory packs | Optional under Presence |
| No-card trial | Separate subscribe change |
| Pre-claim purchase | Out of scope |
| Specialty lines as SKU | Out of scope |
| Full V2 doc rewrite | Follow-on once hierarchy ships |

---

## 11. Implementation phases

### Phase 0 — Taxonomy commit (docs/skills)

- This doc v3.1
- Patch light-tier invite photo language
- Note in operator guide: gateway vs Presence

### Phase 1 — Presence capability truth

- Logo/about/gallery gates on public + settings
- SQL feature assignment for `presence` directory mode
- Free gateway lacks polish features

### Phase 2 — Clean hierarchy entries (no purge)

- Add `presence` to `TIER_FEATURES`, `TIER_HIERARCHY`, `FEATURE_TIER_MAP`, `TIER_DISPLAY_NAMES`
- Do NOT modify old `starter` entries (dormant code)
- Growth tips / next-steps aware of triad

### Phase 3 — Billing + upgrade UX

- Options API mode set from gateway  
- Upgrade page PM + triad  
- Claim success + dashboard cards  
- subscribe path only  

### Phase 4 — Verify

- Tests: gateway options = three modes; presence has no Google caps; discovery has no platform browse; storefront has platform browse; free has no logo  
- checkapi / checkweb  
- Skill updates: tier-hierarchy, directory-presence-seed-claim, AGENTS.md pointer  

---

## 12. Tests (required)

- Gateway `GET upgrade/options` returns presence + discovery + storefront with mode labels
- Presence effective caps: logo/about/gallery/layouts; **not** Google SWIS; **not** platform product visibility
- Discovery: Google-related caps on; platform product visibility off  
- Storefront: platform storefront + product visibility on  
- Claim CTA does not say “Sell Online”  
- Upgrade without PM → 400 for paid modes  
- Free `directory_presence` cannot self-serve flip to itself as paid  
- Legacy `starter` tier remains inactive; `presence` is the active directory-mode tier  

---

## 13. Acceptance criteria

- [ ] Taxonomy documented and skills updated: gateway vs triad  
- [ ] `directory_presence` remains free on-ramp only  
- [ ] Presence is paid **directory** surface from claim
- [ ] Discovery sold as **Google third-party integration**
- [ ] Storefront sold as **platform in-house surface**
- [ ] Claim/dashboard present mode choice (Presence default)
- [ ] Legacy `starter` tier stays inactive; no old feature bag resurrection
- [ ] Public logo/about require Presence+
- [ ] Subscription checkout works with PM on upgrade page  
- [ ] Typechecks clean  

---

## 14. Risk register

| Risk | Mitigation |
|------|------------|
| Reviving `starter` key reloads old features | **Eliminated in v3.1**: new `presence` key, old `starter` stays dormant |
| `'starter'` code defaults mis-tier tenants | **Eliminated in v3.1**: no tenant is on `starter`; defaults are dead code |
| Mode smear (Presence gets Google “for free”) | Hierarchy without google_only under starter; tests |
| Owners confused by three choices | Presence primary CTA; Discovery/Storefront secondary |
| Progressive v2 one-time already half-built | Stop; do not ship website/listing_plus as peers |
| Light-tier photo promise | Align invite copy (T9) |
| V2 doc lag | Ship product; update V2 in follow-on |

---

## 15. Summary vs prior versions

| Version | Spine | Verdict |
|---------|-------|---------|
| v1 | One-time website → directory_entry → Discovery | Gap-ridden; decimal sort; phantom features |
| v2 | Safer one-time directory cosmetics → Discovery | Technically tighter; **wrong product spine** |
| **v3.1** | **Gateway → Entry Presence triad (`presence` / Discovery / Storefront)** | New `presence` key avoids legacy debt; $19/mo; matches commerce dual-pattern |

---

## 16. One-paragraph north star

**Directory Presence is the foot-in-the-door** — free, seedable, claimable, courtyard of the castle.  
**Presence** (Starter) is the first paid room: the platform’s **own directory visibility surface**, the honest paid continuation of that listing.  
**Discovery** is paid **Google-surface integration** — third-party wave, not platform storefront.  
**Storefront** is paid **in-house marketplace visibility**.  
Together they mirror commerce’s Commitment / Ecommerce / Omnichannel: **same context, different mode**.  
Everything after is commerce and scale.

---

**End of spec v3.1**
