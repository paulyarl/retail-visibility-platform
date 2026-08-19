# Platform Tier Hierarchy

> **Source of truth:** `docs/PLATFORM_STRATEGY_V3.md`
> **Supersedes:** V2 hierarchy (Discovery-first spine; starter as storefront-level legacy)
> **When to use:** Tier levels, ordering, upgrade paths, growth tips, capability gating, pricing, tier-aware UI.
> **v3.1 note:** Entry Presence directory tier uses key `presence` (display: "Starter"). Old `starter` tier stays inactive — no purge.

## Layer model (V3)

```
Gateway          directory_presence     FREE seed/claim on-ramp
Entry Presence   presence | discovery | storefront   visibility MODES (peer choice)
Commerce         commitment | ecommerce | omnichannel   money MODES
Scale            professional | organization | enterprise
```

### Entry Presence modes (same layer — different surface)

| Key | Surface | Owner of surface | Job |
|-----|---------|------------------|-----|
| `presence` | **Directory** | Platform in-house directory | Paid path from free listing; enriched directory (display: "Starter") |
| `discovery` | **Google** | Third-party (Google) | Visibility integration onto Google's wave |
| `storefront` | **Platform** | Platform in-house marketplace | Branded store + product browse |

### Commerce modes (unchanged spirit from V2)

| Key | Mode |
|-----|------|
| `commitment` | Deposit only |
| `ecommerce` | Full payment only |
| `omnichannel` | Both |

---

## Tier order (low → high for sort / compare)

| # | Key | Display | Price/mo | Layer | Notes |
|---|-----|---------|----------|-------|-------|
| 0 | `directory_presence` | Directory Presence | $0 | Gateway | Free; never paid acquisition SKU |
| 1 | `presence` | Starter | $19 | Entry Presence | **Directory mode only** (new key; old `starter` stays inactive) |
| 2 | `discovery` | Discovery | $29 | Entry Presence | Google third-party |
| 3 | `storefront` | Storefront | $59 | Entry Presence | Platform in-house (+ Google inherit) |
| 4 | `commitment` | Commitment | $79 | Commerce | Deposit |
| 5 | `ecommerce` | E-commerce | $99 | Commerce | Full pay |
| 6 | `omnichannel` | Omnichannel | $149 | Commerce | Both |
| 7 | `professional` | Professional | $199 | Scale | Advanced single-loc |
| 8 | `organization` | Organization | $499 | Scale | Org type |
| 9 | `enterprise` | Enterprise | $499 | Scale | Multi-loc |

**Aliases / maintenance (not primary GTM):**
- `google_only` → treat as discovery-class Google maintenance (inactive)
- `starter` → **inactive legacy tier**. Do NOT use. Use `presence` for directory mode.
- `custom` → escape hatch

**Chain tiers:**
- `chain_starter` → inactive legacy. Multi-loc directory mode would use a new `chain_presence` key if needed.
- `chain_professional` → professional level
- `chain_enterprise` → enterprise level

---

## Canonical TIER_ORDER array

Prefer this ordering for `tierIndex()`-style compares:

```
['directory_presence', 'google_only', 'presence', 'discovery', 'storefront',
 'commitment', 'ecommerce', 'omnichannel', 'professional', 'organization',
 'enterprise', 'starter', 'chain_starter', 'chain_professional', 'chain_enterprise', 'custom']
```

**Critical:** Include `ecommerce` between `commitment` and `omnichannel`, and `organization` between `professional` and `enterprise`. Missing either collapses index fallbacks and mis-gates capabilities.

Also include `directory_presence` **before** paid entry modes so gateway is never scored as discovery.

---

## Inheritance (capability spirit)

```
directory_presence:  []
presence:            [directory_presence]                 // directory mode ONLY (new key)
discovery:           [directory_presence]                 // Google mode; thin directory chrome
storefront:          [discovery, directory_presence]      // platform + Google combine-up
commitment:          [storefront, discovery, directory_presence]
ecommerce:           [storefront, discovery, directory_presence]
omnichannel:         [commitment, ecommerce, storefront, discovery, directory_presence]
professional+:       [omnichannel, ...]
```

**Hard rules**
- `presence` must **NOT** inherit `google_only` / Discovery Google caps
- `starter` (inactive legacy) — do not use; do not modify its hierarchy entry
- `discovery` must **NOT** grant platform product browse / branded marketplace storefront
- `storefront` does **NOT** grant checkout (commerce starts at commitment/ecommerce)
- `directory_presence` stays free gateway features only

---

## Upgrade / mode paths

### From gateway (`directory_presence`) — peer choice

```
presence    "Own your directory listing"
discovery   "Get found on Google"
storefront  "Open your platform store"
```

Primary CTA default: **presence**.

### From presence

```
discovery | storefront | (later commerce)
```

### From discovery

```
storefront → commitment | ecommerce | omnichannel
```

### Commerce (unchanged V2 spirit)

```
storefront → commitment | ecommerce
commitment → ecommerce | omnichannel
ecommerce  → omnichannel
omnichannel → professional / enterprise
```

**Key V2 insight retained:** Commitment vs Ecommerce are different **money modes**, not a pure feature stack. Omnichannel combines both.

**Key V3 insight:** Presence vs Discovery vs Storefront are different **presence modes**, not a pure feature stack.

---

## Capability matrix (simplified)

| Capability | DP | presence | discovery | storefront | commitment | ecommerce | omni |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Directory listing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Enriched directory (logo/about/gallery) | ❌ | ✅ | ◐ | ✅ | ✅ | ✅ | ✅ |
| Google SWIS / Shopping / Search | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Platform storefront + product browse | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Deposit checkout | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Full online payment | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Path choice | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Presence implementation checklist (V3.1)

When adding the `presence` tier:

1. Add `presence` to `TIER_FEATURES` with **directory-mode** keys only (do NOT modify old `starter` entry)
2. Add `presence` to `TIER_HIERARCHY` inheriting only `[directory_presence]` (no `google_only`)
3. Add `presence` to `FEATURE_TIER_MAP` for directory-mode feature keys
4. Add `presence` to `TIER_DISPLAY_NAMES` as "Starter"
5. Growth tips: gateway → presence primary; not "sell online"
6. Upgrade options API: from gateway return triad (`presence`, `discovery`, `storefront`), not only `sort_order > current`
7. Old `starter` entries in all maps stay as-is (dormant code for inactive tier)

Companion: `docs/LocalBiz/directory_presence_progressive_upgrade_spec.md`

---

## Files that MUST stay in sync

### Frontend (`apps/web/src/lib/`)
- `tiers/tier-resolver.ts` — levels, mapTierLevel, getHigherTierLevel, getUpgradeOptions
- `tiers/tier-features.ts` — TIER_HIERARCHY, DISPLAY_NAMES, PRICING, FEATURES, FEATURE_TIER_MAP
- `tiers/content-consistency.ts` — progressions
- `tiers/chain-pricing.ts`
- `growth-tips/tipEngine.ts` — TIER_ORDER, helpers, tips

### Backend (`apps/api/src/`)
- `services/GrowthTipService.ts`
- `utils/tier-limits.ts`
- `utils/trial-tier-transparency.ts`
- `services/TierService.ts`
- `routes/admin/tier-management.ts`
- `utils/featured-product-scoring.ts`
- `services/IntegrationOptionsService.ts`
- `routes/directory-presence-upgrade.ts` — gateway mode options

### Docs
- `docs/PLATFORM_STRATEGY_V3.md` — strategy SoT
- `docs/LocalBiz/directory_presence_progressive_upgrade_spec.md` — ladder/impl
- `docs/DIRECTORY_PRESENCE_LIGHT_TIER_SPRINT_PLAN.md` — free gateway

---

## Common bugs

1. **Using `starter` instead of `presence`** — `starter` is inactive legacy with wrong feature bag. Use `presence` for directory mode.
2. **Missing `directory_presence` in tier arrays** — gateway scored as paid discovery
3. **Missing `ecommerce` or `organization`** — index fallback → wrong tips/gates
4. **Presence inheriting Google** — smears Entry Presence modes
5. **Gateway CTA "Sell Online"** — skips presence mode choice
6. **Upgrade options `price_monthly > 0` only** — may hide free→paid gateway edges; use mode set for DP

---

## Skill status

**Status:** V3.1 — aligned to Entry Presence + Commerce dual triads; `presence` key replaces `starter`
**Update when:** Strategy V3 changes, presence feature set lands, sort_order renumber ships
