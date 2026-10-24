# Chain Signal Prospecting Feed — Spec

Status: **v0.1 (draft — insights captured, not yet built)**

Scope: turns the post-publish dedup surface into a prospecting feed.
Today a duplicate group resolves to a binary verdict — `same_entity` (merge
and suppress) or `distinct` (walk away). A third outcome is thrown away:
**distinct entities that are one business** — legitimate multi-location
operators (chains) surfaced by the same normalizers that flag true
duplicates. This spec (a) defines the chain signal and how it is caught,
(b) adds the chain entity + verdict that preserves it, (c) specs the
prospecting feed built on the cleanup report, and (d) defines the
seed → claim → organization bridge that makes the platform the growing
chain's path to digital presence.

**The motion:** *scan the market with discovery → flood the market with
seeds → cleanup the seeds — catch the chain candidates → pitch from the
signals.*

Related specs:

- `seed_funnel_benchmark_gates_and_analytics_spec.md` — §3.1 identity
  resolution at ingest; the verdict ledger this spec extends
- `directory_presence_claim_handoff_spec.md` — post-claim upgrade handoff
- `marketing_ops_multi_archetype_campaign_sprint_plan.md` — sibling
  campaigns under `business_prospect_id` (one prospect, many plays)
- `MULTI_LOCATION_IMPLEMENTATION_PLAN.md` — org/SKU-pool architecture
- `docs/LocalBiz/directory_presence_progressive_upgrade_spec.md` — tier
  ladder the chain bridge feeds into

Canonical example (observed 2026-10-24, Indianapolis batch):
*Victory Super Store African Foods LLC* (Indianapolis, IN) and *Victory
International Market Plainfield* (Plainfield, IN) — same normalized phone,
different names, different cities ~20 mi apart. A real two-location chain.

---

## §1 Why this exists

The dedup surface is currently a **cost center**: it exists to keep the
funnel's `duplicateSeedCount` gate clean. But every group it surfaces is
one of two things — a true duplicate (cleanup work) or **a pre-qualified
chain lead** (revenue work). The same-phone signal is especially strong:
a shared published phone across two addresses almost always means one
owner, and it doubles as the claim-channel binding (`inviteSeed` already
binds claim tokens to `owner_phone`).

Three platform assets make this a pipeline, not a project:

1. **The detector already exists** — `DirectorySeedCleanupService.getCleanupReport`
   computes `phoneGroups`/`addressGroups` with the same normalizers as the
   funnel detection. It just dead-ends at a binary verdict.
2. **The org model already exists** — `tenants.organization_id →
   organizations_list`, `user_organizations`, org-scoped
   `feature_overrides`, `org_standing_mode='inherited'` asymmetric
   standing inheritance (`org-standing-inheritance.ts`: org good standing
   lifts member tenants; tenant tier is never replaced).
3. **The pricing already exists** — `chain_*` tiers are in the tier
   contract as **mirrors** of their base tiers (`chain_mirrors` in
   `shared/tier-contract.json`); `apps/web/src/lib/chain-tiers.ts` has
   `calculateSavings()` producing the individual-vs-chain pitch artifact.

The missing pieces are connective: a verdict value that preserves the
relationship, a chain entity that groups the seeds, a feed surface, and
the claim→org bridge.

---

## §2 The chain signal

### §2.1 Signal taxonomy

A **chain candidate group** is a dedup group whose members are judged
*not* the same entity but plausibly the same operator. Signals, in
descending strength:

| Signal | Source | Strength | Notes |
|---|---|---|---|
| `same_phone` | `phoneGroups` (normalized digits ≥7) | **strong** | Shared published line = shared owner/manager in SMB retail. Also the OTP binding. |
| `name_token_overlap` | `dl.business_name` token intersection | medium-strong | "Victory Super Store African Foods" ∩ "Victory International Market" = `Victory`. Strip stopwords (`the`, `store`, `market`, `super`, `llc`, `inc`, city names) before scoring. |
| `same_as_overlap` | `directory_listings_list.same_as` URL domains | strong | Two listings pointing at the same Facebook/website are definitively linked. |
| `same_category` | `dps.category` | weak | Chains stay in-category; corroborating only. |
| `distinct_address_city` | `address_city` normalizer | required | Different addresses is what makes it a *chain* rather than a dup. Same-city chains still count — different address is the discriminator, not different city. |
| `owner_contact_match` | `dps.owner_email`/`owner_phone` | strong | When captured on the seed, identical owner contact is near-proof. |

### §2.2 Confidence

| Confidence | Rule | Operator UX |
|---|---|---|
| `chain_confirmed` | `same_phone` AND (`name_token_overlap` OR `same_as_overlap` OR `owner_contact_match`) | Suggested action: "Link as chain" |
| `chain_probable` | `same_phone` alone, OR strong name overlap + same category | Suggested action: "Review — possible chain" |
| — | `address_city` matches only | Not a chain candidate; stays a merge/distinct review |

Address-city groups are excluded from chain candidacy — same address
means same storefront, which is merge territory. Phone groups are where
chains live.

### §2.3 The persona signal (pitch framing)

The chain candidate pattern is also a **persona read**: two locations +
one shared cell phone = an ambitious operator who is phone-first and
digitally underserved. Two storefronts is proof of aspiration; the
shared phone is proof the digital layer hasn't caught up. This drives
the outreach register in §7 — the pitch flatters the ambition ("you're
a two-location operation") and removes the homework ("your stores are
already listed — here's the key"). Never pitch this persona a website
to *build*; hand them a presence to *claim*.

---

## §3 Data model

### §3.1 Verdict vocabulary (migration required)

`mkt_prospect_dedup_verdicts.chk_mpdv_verdict` currently allows
`('same_entity','distinct')`. Add **`'distinct_chain'`**:

- Semantics: members are distinct entities (no merge, nothing suppressed)
  **and** are linked as one operator's locations.
- The funnel's exclusion join covers it automatically (it excludes all
  verdict-keyed groups), so the gate clears like `distinct`.
- `merge_into` stays NULL — there is no survivor.
- Upsert symmetry: `recordVerdict` already upserts on
  `(seed_ids, match_key)`, so an operator can correct `distinct` →
  `distinct_chain` later without a new row.

```sql
ALTER TABLE mkt_prospect_dedup_verdicts
  DROP CONSTRAINT chk_mpdv_verdict,
  ADD CONSTRAINT chk_mpdv_verdict
    CHECK (verdict IN ('same_entity','distinct','distinct_chain'));
```

### §3.2 Chain entity

The verdict answers "what did the operator decide about this group"; the
feed needs a durable entity answering "which seeds are one chain" — a
group must be joinable (a third location found next month attaches to
the *existing* chain, not a new group) and must survive individual
verdict rows.

```sql
CREATE TABLE directory_chain_groups (
  id              VARCHAR(255) PRIMARY KEY,          -- dcg-
  display_name    VARCHAR(255),                       -- canonical brand ("Victory International Market")
  status          VARCHAR(20) NOT NULL DEFAULT 'candidate'
                  CHECK (status IN ('candidate','confirmed','claimed','org_linked','dismissed')),
  confidence      VARCHAR(20) NOT NULL
                  CHECK (confidence IN ('chain_confirmed','chain_probable')),
  source_signals  JSONB NOT NULL,                     -- {match_keys, name_tokens, same_as_domains, owner_contact}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE directory_chain_group_members (
  chain_group_id  VARCHAR(255) NOT NULL REFERENCES directory_chain_groups(id),
  seed_id         VARCHAR(60)  NOT NULL REFERENCES directory_presence_seeds(id),
  tenant_id       VARCHAR(255),                       -- denormalized from the seed for claim/org queries
  added_by        VARCHAR(255),
  added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_group_id, seed_id)
);
```

Notes:

- Members reference **seeds**, not listings — the seed is the funnel
  unit and already joins to its listing + tenant.
- `status` lifecycle: `candidate` (verdict recorded) → `confirmed`
  (operator reviewed the chain read) → `claimed` (≥1 member claimed) →
  `org_linked` (claimed tenants bound to an `organizations_list` row) →
  `dismissed` (operator judged the chain read wrong; group is hidden but
  the verdict still protects the funnel gate).
- A suppressed seed stays a member (suppression is a listing decision,
  not an identity decision) but is excluded from feed counts.

### §3.3 Claim-token implication

No schema change to `directory_claim_tokens` — but the *chain claim*
path (§6.2) mints one token per member seed and binds them all to the
shared `owner_phone`. One OTP verifies the owner for the whole group.

---

## §4 Detection

### §4.1 Where it runs

`DirectorySeedCleanupService.getCleanupReport` — same pass that builds
`phoneGroups`/`addressGroups` today. For each `phone` group with ≥2
members, compute chain signals (§2.1) and attach:

```ts
interface CleanupDuplicateGroup {
  matchKey: 'phone' | 'address_city';
  seedIds: string[];
  seeds: CleanupSeedRef[];
  verdict: {...} | null;
  chain?: {                       // NEW
    confidence: 'chain_confirmed' | 'chain_probable';
    signals: string[];            // e.g. ['same_phone','name_token_overlap','same_category']
    sharedPhone: string | null;
    nameTokenOverlap: string[];   // shared tokens for display ("Victory")
    existingChainGroupId: string | null; // already-linked group, if any member is a member
  } | null;
}
```

### §4.2 Name-token overlap

Normalize each `business_name` → lowercase tokens → drop stopwords
(`the, store, market, super, shop, mart, llc, inc, co, grocery`, city
names present in member `city` fields) → intersect. Overlap ≥1
non-stopword token counts. The surviving shared tokens seed
`display_name` suggestions ("Victory").

### §4.3 Group continuity

When a verdict of `distinct_chain` is recorded, `recordVerdict` (or the
cleanup resolve route — see §5.1) upserts membership:

1. If any member already belongs to a `directory_chain_groups` row →
   attach the new members to it (third location joins the chain).
2. Else create a new group (`confidence` from §4.2 signals).

A `distinct` verdict on the same group later does **not** delete the
chain row — it sets group `status='dismissed'`, preserving history.

---

## §5 Surfaces

### §5.1 Cleanup panel — third action

`presence-seeds/cleanup` duplicate-group cards gain a third action for
`matchKey='phone'` groups carrying `chain` confidence:

```
[ Keep selected — suppress N other ]   (existing)
[ Not duplicates — mark distinct ]     (existing)
[ Same chain — link locations ]        (NEW — only when chain confidence present)
```

Clicking it records `verdict='distinct_chain'` via the existing
`recordDedupVerdict` route + creates/extends the chain group (§4.3) in
one admin endpoint (`POST /api/admin/directory-presence/chain-groups`
or folded into the verdict route with `{ verdict:'distinct_chain',
chainGroup: true }`). Card renders the signal chips
(`same phone · name overlap "Victory" · 2 cities`) so the operator sees
*why* it's a chain before clicking.

### §5.2 The prospecting feed

Resolved `distinct_chain` groups are the feed. New admin section —
`presence-seeds/chains` (or a "Chains" tab on cleanup; tab preferred —
the feed *is* the cleanup surface downstream):

| Column | Source |
|---|---|
| Chain | `display_name` + member count |
| Locations | member seed names + cities ("Rockville Rd, Indianapolis · Main St, Plainfield") |
| Status | group status + per-member seed status chips (published/invited/claimed) |
| Contact | shared phone / owner email — the pitch channel |
| Confidence | `chain_confirmed`/`chain_probable` |
| Pitch hooks | derived signal lines (§7.1) — copy-ready opener fragments |

Sort: `candidate` first (unworked leads), then `confirmed`, `claimed`,
`org_linked`. The feed answers "who owns multiple shelves and hasn't
been pitched the org story yet."

### §5.3 Public module — "Other locations"

When ≥2 members of a group have `dps.status IN
('published','invited','claimed')` and `is_published`, each member's
`/place/{slug}` (and post-claim `/directory/{slug}`) renders a compact
"Also visit:" strip linking sibling locations — city + name + distance
when coordinates exist. This is the platform *demonstrating* the chain
value prop for free: the seed pages cross-promote before the owner pays
a cent. Gate: same status gate as every public seed surface; suppressed
members never render.

---

## §6 The bridge: seed → claim → organization

```
DISCOVER ──> SEED (per location, free, provenance-carried)
    │
    │  dedup surfaces same-phone group
    ▼
CLEANUP ──> verdict 'distinct_chain' + chain group
    │
    │  pitch from signals (§7)
    ▼
CLAIM ──> one bound OTP → all member seeds claimed
    │
    │  "these stores are one business — link them?"
    ▼
ORG ──> organizations_list row + tenants.organization_id set
        org_standing_mode = 'inherited'
    │
    ▼
CHAIN TIER ──> capability-aware ladder (chain_* mirrors base tier grants)
```

### §6.0 Pitch order — ownership before the pitch

**The first owner-facing touch is the ordinary claim invitation, never
the chain story.** The signals in §2 are operator-internal intelligence —
they decide *who to invite first* and *how to frame the invite*, but they
are not opener copy:

- **The claim IS the chain verification.** A `chain_probable` group is
  still a guess (the shared phone could be an answering service). An
  owner who claims both seeds converts the inference into confirmed fact
  for free — pitching the chain before ownership risks asserting a
  relationship that turns out wrong, on the record.
- **"We already knew" reads surveillance; "now that you own both, here's
  the umbrella" reads service.** The chain reveal is a claim-page moment
  (§6.1 sibling step), not a cold-outreach line.
- **Post-claim, the pitch isn't a pitch.** Linking two claimed tenants
  under an org is a product affordance the owner is owed anyway — leading
  with it sells a feature they haven't earned context for yet.

So the motion is: signals pick the lead and arm the operator → invite
(all members, bound to the shared phone) → claim (sibling reveal
establishes group ownership through consent) → org link → chain tier.
The §7 pitch hooks belong to the post-claim register and operator
framing, not the first touch.

### §6.1 Chain claim

Today `POST /api/public/directory/claim/:token/accept` consumes one
token → claims one seed. Chain claim (new surface, opt-in):

- Operator issues claim tokens for **all live members** of the group,
  bound to the shared `owner_phone`/`owner_email`.
- The claim page renders the **group**: "Victory — 2 locations" with each
  store listed. One OTP verifies the owner.
- Accept claims the seeded token's seed first (existing flow, unchanged);
  a follow-on "claim your other location(s)" step consumes the sibling
  tokens in the same session — each still individually consented
  (migration-274 category/attribute gate applies per listing).
- Failure isolation: sibling-claim failures don't roll back the primary
  claim.

### §6.2 Organization linking

After ≥2 member tenants are claimed:

- Post-claim offer (and a settings affordance): "Link these stores under
  one business." Creates the `organizations_list` row, sets
  `tenants.organization_id` on each, flips `org_standing_mode` to
  `'inherited'`.
- `user_organizations` membership binds the claiming user at the org
  level — one login, both stores. (Verify at build: existing org
  membership route or new `POST /api/tenant/:id/organization/link`.)
- Org-scoped `feature_overrides` become the upgrade lever: capabilities
  granted once at org scope, inherited by every location.

### §6.3 Chain tier pitch

`chain_*` tiers already mirror base-tier grants (`chain_mirrors` in the
fixture) — the tier builder is capability-aware by contract. The pitch
math is `calculateSavings(locations, individualTier)`: for a 2-location
shop the dollar savings are modest, so the copy leads with **one brand,
one login, shared catalog, centralized billing** — consolidation, not
discount. The org also absorbs future locations for free up to the
tier's `maxLocations`, which is the real hook for an ambitious operator:
"when you open store #3, it's already covered."

---

## §7 Pitch from the signals

### §7.1 Signal → opener fragments

Every detected signal is a line of the outreach. The feed (§5.2)
generates copy-ready fragments per group:

| Signal | Opener line |
|---|---|
| `same_phone` | "We can tell both stores are yours." |
| `name_token_overlap` | "Victory Super Store vs Victory International Market — Google can't tell they're one brand." |
| `distinct cities` | "Indianapolis and Plainfield are different shelves — each store should be findable on its own." |
| `same_category` | "Both stores carry the same specialty — one brand story, two shelves." |
| the fix | "Claim once. Manage both. One brand." |

### §7.2 Campaign mechanics

One `business_prospect_id` per chain group; a sibling campaign per
member location (existing `POST /:campaignId/siblings` machinery — no
new pipeline). The multi-gallery token then shows the owner *both of
their stores* side by side — the single most persuasive artifact this
platform can produce for a chain lead. Chain groups get their own
prospect-queue tag so cohort reporting separates chain leads from
singletons.

### §7.3 Register (the persona rules — §2.3)

- Outcome language only. "Customers see the right hours," never "NAP
  consistency." "Show up when someone searches African grocery near
  them," never "SEO."
- Frame the owner as already-a-chain: "you're a two-location operation —
  your online presence should look like it."
- SMS/phone-first channel: the shared number that flagged the group is
  the pitch channel *and* the claim binding. Operator-assisted claim
  ("text us and we'll set it up together") is the primary CTA for
  `chain_probable` groups where digital confidence is lowest.
- Zero-maintenance promise: the platform seeds and maintains; the owner
  confirms changes by text. Photo-first enrichment ("send us a picture
  of your storefront") is the one ask.

---

## §8 Funnel & analytics

- `distinct_chain` verdicts clear `duplicateSeedCount` like `distinct`
  (exclusion join already covers all verdicts — verify at build that
  `getCohortFunnel` doesn't special-case the two known values).
- New feed metrics (stored queries, same discipline as the funnel spec):
  `chain_groups_detected`, `chain_members_claimed`,
  `chain_orgs_created`, `chain_tier_conversions`.
- Cohort attribution: chain groups inherit cohort identity from member
  seeds' `directory_seed_campaign_links` — chain conversion rate is
  reportable per city/category cohort.

---

## §9 Non-goals

- **No auto-linking.** Chain groups are created only by operator verdict.
  Detection suggests; it never writes.
- **No merging.** `distinct_chain` suppresses nothing — every member
  keeps its own listing, NAP, and claim path.
- **No forced org.** Org linking is post-claim and owner-consented;
  seeds are never pre-bound to an org they didn't create.
- **No inferred identity.** A `chain_probable` group is a lead, not a
  fact — the feed labels confidence, never asserts it publicly.
- **No public "chain" branding** before claim — the "Other locations"
  strip says "Also visit," never "owned by the same company" (the
  inference stays backstage until the owner confirms it).

---

## §10 Build phases

| Phase | Deliverable | Depends on |
|---|---|---|
| 1 | Verdict value migration + `directory_chain_groups`/members tables + `getCleanupReport` chain detection + third card action | none |
| 2 | Chains feed tab (§5.2) + pitch-hook generation (§7.1) | 1 |
| 3 | "Other locations" public strip (§5.3) | 1 |
| 4 | Chain claim — bound tokens across members, grouped claim page, sibling-accept step | 1 |
| 5 | Org linking UX + `org_linked` status + chain-tier upgrade path (§6.2–6.3) | 4 |
| 6 | Feed metrics + cohort reporting (§8) | 5 |

Phases 1–3 ship independently of 4–6 — the feed has prospecting value
before any claim mechanics exist.

---

## §11 Open questions

1. **Group splitting** — if a member is later judged not-a-location
   (e.g., a warehouse sharing the phone), is removal a member delete or
   a new verdict? Leaning: member removal endpoint + audit note; the
   verdict row stays.
2. **Chain claim UX for `chain_probable`** — do we mint sibling tokens
   before the operator confirms the chain? Leaning: no — tokens mint
   only on `confirmed`, probable groups stay single-seed invites.
3. **`distinct_chain` vs. `distinct` + link write** — spec chooses one
   verdict value (simpler query surface, self-documenting ledger) over
   verdict-plus-side-write. Revisit if the verdict table ever needs to
   answer non-chain queries.
4. **Owner-contact provenance** — when `owner_phone` wasn't captured at
   seed time, is the listing's *published* phone a legal/appropriate OTP
   binding? Probably yes (it's already the public contact), but the OTP
   copy should say so.
5. **Tier contract** — `chain_*` tiers are fixture-declared but dormant
   in the doc table (see `tier-contract.json` `$comment` 0.4); Phase 5
   needs the org-tier doc generation unblocked, not new tier work.
