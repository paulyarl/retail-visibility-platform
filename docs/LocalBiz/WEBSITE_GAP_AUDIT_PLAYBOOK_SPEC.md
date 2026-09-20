# Website Gap Playbook (PB-08) + Website Positioning Audit — Spec

> The website build is the platform's flagship sellable product, but triage has no website playbook: `WC_MISSING_WEBSITE` is a residue entry in PB-03's fallback `any` set, `WC_BROKEN_WEBSITE` matches no rule at all (it reaches PB-03 only through the code-level fallback), and the most common real-world website states — a Facebook page listed as "the website", a free Wix subdomain, a parked domain, a coming-soon page that never finished — have no signal codes at all. This spec adds a dedicated playbook (PB-08), a dedicated archetype (A7), nine new `WC_*` signals, and a **Website Positioning Audit** that benchmarks the business's web presence against the category's gold-standard positioning and frames every finding as a conversion implication.

**Status:** Spec only — not started. Gap sweep (§9) complete.
**Scope:** `database/migrations`, `apps/api` (triage, extractor, archetype surface, prompt seeds, deliverable mapping), `apps/web` (archetype UI surfaces).

---

## 1. Problem

### 1.1 Website gaps route to a fallback, not a playbook

Current cascade (post-migration-171):

| Rank | Code | Website-signal relationship |
|---|---|---|
| 1 | PB-05 | `WC_BROKEN_WEBSITE` in dual groupA — only fires when a review signal co-occurs |
| 2 | PB-04 | none |
| 3 | PB-01 | `WC_URL_MISMATCH` only |
| 4 | PB-02 | website codes in `none` guards |
| 5 | PB-07 | none |
| 6 | PB-06 | website codes in `none` guards |
| 7 | PB-03 | `WC_MISSING_WEBSITE` in `any` — the 0.70-confidence catch-all |

Consequences:

- A business with **no website** lands on "Conversion & Surface Friction" — a playbook whose FITD offer ("Website & Surface Conversion Fix") presumes a site exists to fix.
- A business with a **broken website alone** matches no rule; it reaches PB-03 through `CampaignTriageService`'s no-match fallback, so the triage reasoning reads as a fallback rather than a match.
- The opener archetype behind PB-03 is `A4_CTA_GAP` — its generated opener pitches "your site lacks a CTA" to a prospect who has no site.
- No signal exists for the states operators actually encounter: `social_media_only` websites, free builder subdomains, parked/for-sale domains, perpetually unfinished "coming soon" pages, stale content, legacy builder fingerprints, poor design quality, and category-mismatched content.

### 1.2 The business audit cannot carry positioning judgment

`business_analysis`'s `website` block is a breadth-first tri-state assessment (status enum + boolean-ish fields + `conversion_opportunities[]`). It can say *that* a site is missing or thin; it cannot say *what the site should be* — because "should" is category-relative. A grocery's website needs product browsing and availability inquiry; a restaurant's needs a menu and reservations; a contractor's needs project photos and a quote form. That expectation set already exists in the platform: the **Category Intelligence** profile and the **Gold Standard** benchmark injected into the V2 audit templates. The business audit spends its token budget on four-platform breadth; positioning judgment needs its own pass.

### 1.3 Decision: dedicated Website Positioning Audit (Option B)

| Option | Verdict |
|---|---|
| **A — amend the business audit's website section** | Rejected for depth. The tri-state block can emit the *existence* signals (and will — §6.3) but positioning vs. category expectations, conversion-implication framing, and issue amplification need dedicated prompt real estate and a dedicated output schema. |
| **B — dedicated `website_positioning` audit template** | **Adopted.** A new seeded `mpt-*` template (same `mkt_prompt_templates_list` + `resolvePrompt` machinery), run on demand for PB-08-routed campaigns. It consumes the same Category Intelligence / Gold Standard / Market Context injection blocks and the same accessibility + render-control discipline. |
| **C — extractor-only, no audit** | Rejected as the whole solution but kept as the floor: the three objective signals (`WC_THIRD_PARTY_DOMAIN`, `WC_BUILDER_SUBDOMAIN`, `WC_UNSECURED_WEBSITE`) are derivable server-side and do not depend on the audit existing. |

Note the extractor's precedence rule: when an audit emits `detected_signals[]`, that array is canonical and derived extraction does not run. The derived rules in §5 therefore serve legacy audits and the non-audit paths; the audit templates (business audit + the new website audit) are responsible for emitting the codes on new runs (§6).

---

## 2. PB-08 — Website Acquisition & Build

New `mkt_playbook_catalog` row:

| Field | Value |
|---|---|
| code | `PB-08` |
| name | Website Acquisition & Build |
| category | `profile_repair` (inside existing `chk_playbook_category` set — no constraint change) |
| archetype | `A7` / `A7_WEBSITE_GAP` |
| priority_rank | **7** — PB-03 renumbers to 8 and remains the code-level fallback |
| fitd_offer_title | One-Time Website Build & Launch Package |
| fitd_default_fee_cents | 49900 ($499) |
| retainer_pitch_title | Website Hosting & Care Plan |
| retainer_fee_cents | 9900 ($99/mo) |
| preview_deliverable_type | `website_mockup` (resolved OQ-2; migration 305 corrects 303's `seo_content` seed) |
| matching_rules | below |

```json
{
  "any": [
    "WC_MISSING_WEBSITE", "WC_THIRD_PARTY_DOMAIN", "WC_BUILDER_SUBDOMAIN",
    "WC_BROKEN_WEBSITE", "WC_PARKED_DOMAIN", "WC_UNFINISHED_SITE",
    "WC_UNSECURED_WEBSITE", "WC_LEGACY_BUILDER_SITE", "WC_STALE_WEBSITE",
    "WC_POOR_SITE_QUALITY", "WC_CATEGORY_MISMATCH"
  ],
  "all": [],
  "none": ["RA_BBB_GRADE_SUPPRESSION", "RA_UNANSWERED_COMPLAINTS"],
  "dual": null,
  "confidence": 0.88
}
```

Rationale for rank 7: pure website-gap prospects get a purpose-built pitch; co-occurrence with review signals still resolves upward (PB-05 dual at rank 2 for defect-class codes, PB-02 at rank 4 for absence-class co-occurrence). `WC_MISSING_WEBSITE` **stays** in PB-03's `any` as redundancy — first-match-wins means PB-08 claims it while active, and PB-03 still catches it if PB-08 is deactivated.

## 3. Signal taxonomy additions

Nine new codes, all `WC` family. Two classes:

- **Absence-class** — no real owned site exists. PB-08 only; deliberately *not* repair-class (mirroring `WC_MISSING_WEBSITE`, which is not in PB-05's dual either).
- **Defect-class** — a real site exists but is deficient. Repair-class semantics: added to PB-05's dual `groupA` and the PB-02/PB-06 `none` guards, exactly as `WC_BROKEN_WEBSITE` is today.

| Code | Class | Detection | Definition |
|---|---|---|---|
| `WC_MISSING_WEBSITE` | absence | existing | (claimed from registry) |
| `WC_BROKEN_WEBSITE` | defect | existing | (claimed from registry) |
| `WC_THIRD_PARTY_DOMAIN` | absence | derived + model | `website.url` host is a social/messaging/profile platform (facebook.com, instagram.com, wa.me, api.whatsapp.com, x.com/twitter.com, tiktok.com, linktr.ee, yelp.com, nextdoor.com, t.me, m.me, threads.net, snapchat.com) OR `status = 'social_media_only'` — "the website field is a social page" |
| `WC_BUILDER_SUBDOMAIN` | absence | derived + model | `website.url` host is a free builder subdomain: `*.wixsite.com`, `*.wordpress.com`, `*.godaddysites.com`, `*.weebly.com`, `*.square.site`, `*.business.site`, `*.blogspot.com`, `*.tripod.com`, `*.angelfire.com`, `*.homestead.com`, `*.webs.com`, `*.jimdo.com`, `*.site123.me`, `*.strikingly.com`, `*.webnode.com`, `*.myshopify.com`, `*.bigcartel.com` — a live page, but no owned domain |
| `WC_PARKED_DOMAIN` | absence | model | Domain resolves to a parked / for-sale / registrar placeholder page |
| `WC_UNFINISHED_SITE` | absence | model | "Coming soon" / "under construction" / template-default content that was never finished |
| `WC_UNSECURED_WEBSITE` | defect | derived + model | `website.https === false` — site serves plain HTTP or has an untrusted certificate |
| `WC_LEGACY_BUILDER_SITE` | defect | model | Owned domain fingerprinted as a legacy/low-cost builder (Wix assets, `wp-content`, GoDaddy generator meta, visible builder branding, table-layout-era markup) |
| `WC_STALE_WEBSITE` | defect | model | Stale content signals: old copyright year, expired promos, dated news posts, seasonal content out of season |
| `WC_POOR_SITE_QUALITY` | defect | model | Poorly designed / broken layout / unreadable / low-quality score per the audit rubric |
| `WC_CATEGORY_MISMATCH` | defect | model | Site content doesn't match the business's actual category — template leftovers, wrong-industry copy, or content for a different business |

Severity defaults (`DEFAULT_SEVERITY` in `signal-magnitude.ts`): `WC_THIRD_PARTY_DOMAIN`, `WC_BUILDER_SUBDOMAIN`, `WC_PARKED_DOMAIN`, `WC_UNFINISHED_SITE` → `material` (a pitchable gap, not a crisis — the business still has GBP); `WC_UNSECURED_WEBSITE`, `WC_LEGACY_BUILDER_SITE`, `WC_STALE_WEBSITE`, `WC_POOR_SITE_QUALITY`, `WC_CATEGORY_MISMATCH` → `borderline`…`material`; `WC_MISSING_WEBSITE`/`WC_BROKEN_WEBSITE` keep `crisis`.

`isRepairSignal()` gains the defect-class codes so triage reasoning groups them correctly.

## 4. Registry + cascade migration (303)

One numbered migration, additive-only, tandem `local` + `prd`:

1. `INSERT … ON CONFLICT DO NOTHING` the nine new `mkt_signal_registry` rows. `detection_source`: `derived` for the three host/https codes (with `derived_rule` JSONB documenting the rule), `model_emitted` for the rest.
2. `UPDATE mkt_playbook_catalog SET priority_rank = 8 WHERE code = 'PB-03'`.
3. `INSERT … ON CONFLICT (code) DO UPDATE` the PB-08 row (migration-158 re-seed convention).
4. Extend `matching_rules` JSONB (guarded `jsonb_set` + `?` idempotency pattern from migration 171):
   - PB-05 `dual.groupA` += defect-class codes (`WC_UNSECURED_WEBSITE`, `WC_LEGACY_BUILDER_SITE`, `WC_STALE_WEBSITE`, `WC_POOR_SITE_QUALITY`, `WC_CATEGORY_MISMATCH`).
   - PB-02 `none` += the same defect-class set.
   - PB-06 `none` += the same defect-class set.
   - Absence-class codes (`WC_THIRD_PARTY_DOMAIN`, `WC_BUILDER_SUBDOMAIN`, `WC_PARKED_DOMAIN`, `WC_UNFINISHED_SITE`) stay out of both the dual and the `none` guards — same treatment as `WC_MISSING_WEBSITE`. Rationale: PB-05's dual is "multiple repair problems"; a parked/unfinished domain is an acquisition problem (the domain exists but there is no usable site), and a `none`-guard would wrongly block PB-02/PB-06 when the correct sell is still the review/visual playbook with PB-08 as the sibling. (Gap-sweep fix: an earlier draft listed parked/unfinished as defect-class here while §3 classed them absence — absence-class wins for consistency with `WC_MISSING_WEBSITE`.)
5. Seed PB-08 starter checklist steps (`pbcs-pb08-*`, migration-174 `CROSS JOIN VALUES` + `NOT EXISTS` guard). Draft steps: confirm web-presence state → capture evidence for each fired signal → owner interview (domain ownership, existing assets, category content) → build the positioning report/mockup deliverable → build or hand off the site → point all profiles at the canonical domain → pitch care plan.

No `prisma db pull` needed (data-only), but the migration still requires the tandem staging+prd run per SOP.

## 5. Extractor derivation (`signal-extractor.ts`)

Runs in the legacy path (no `detected_signals[]`) and shapes the suppression rules:

1. Inside the `websiteExists` block, compute `host = hostname(website.url)`:
   - `WC_THIRD_PARTY_DOMAIN` — `status === 'social_media_only'` OR host ∈ social host set (suffix match, so `m.facebook.com`, `wa.me`, `api.whatsapp.com` all catch).
   - `WC_BUILDER_SUBDOMAIN` — host ∈ builder-subdomain suffix set.
   - `WC_UNSECURED_WEBSITE` — `website.https === false` (coerced boolean; only when a real owned site exists — not for third-party/builder hosts where https is the platform's).
2. **Friction suppression, extended.** The existing rule skips conversion-friction signals when no website exists. Extend the skip to `thirdParty || builderSubdomain` — `WC_MISSING_CTA`/`WC_MISSING_SERVICE_PAGES`/`WC_MOBILE_FRICTION`/`WC_MISSING_PRODUCT_BROWSING`/etc. describe defects on an *owned* site; on a Facebook page or free subdomain they're noise that dilutes the headline absence signal. (`WC_BROKEN_WEBSITE` still evaluates — a third-party URL can itself be dead.)
3. `WC_MISSING_WEBSITE` does **not** fire when `WC_THIRD_PARTY_DOMAIN`/`WC_BUILDER_SUBDOMAIN` fire — a URL exists; the gap is ownership, not discovery. (`websiteAbsent` already excludes these cases since `website.url` is set.)

## 6. Audit prompt contracts

### 6.1 Business audit V2 — signal definitions (seed amendment)

`seed-business-audit-v2-templates.ts` gains a bounded `insertAfter`/`replaceFirst` addition to the `detected_signals` code list in both variants (`mpt-j9bbem3l`, `mpt-6oeuiizo`) — same fingerprint-safe pattern as the `WC_BROKEN_WEBSITE` definition amendment — defining the nine codes and their emission criteria. `WC_THIRD_PARTY_DOMAIN`, `WC_BUILDER_SUBDOMAIN`, `WC_UNSECURED_WEBSITE` are judgment-free and emit on sight; the quality codes require the Website Accessibility Verification standard (emit only on verified page content, never `unable_to_verify`). Bump `SEED_VERSION_MARKER`; re-run `--config local` + `--config prd` per AGENTS.md.

### 6.2 Website Positioning Audit — new template (the §1.3 Option B deliverable)

A new seeded `mpt-*` template — prompt_type/output_schema distinct from `business_analysis`, stored as `audit_type = 'website_positioning'` in `mkt_audits_list`. Run **after** triage routes a campaign to PB-08 (operator-triggered from the Prompt Workspace initially; see OQ-1 for auto-wiring).

**Inputs / injected blocks** (same `resolvePrompt` machinery):
- The campaign's `website_url` + the prior `business_analysis` audit's `website` block and resolved category.
- **Category Intelligence block** — category terminology, evidence rules, prohibited inferences apply unchanged.
- **Gold Standard block** — the audit benchmarks *website positioning specifically* against the category's expected fields and exemplars: what a gold-standard `{category}` site must contain (service pages, product browsing, booking/ordering, menus, quote forms, category-specific trust signals) vs. what this business's presence actually does.
- **Market Context blocks** — category_profile / category_signals / market_density frame competitive position.
- **Website Accessibility Verification** directive — the four-state ladder (discovered / reachable / content verified / conversion verified) applies verbatim.
- **Render control** — gold-standard exemplar *websites* serve as the control set for the site itself: if the business's site fails to render but an exemplar site renders, the failure is attributable (broken), not a tooling limitation.
- **Interactive verification preamble** — via `resolvePrompt` (it prefixes `baseRendered` and composed `rendered`; no template-body declaration needed).

**Output contract** (new `website-positioning.schema.ts`):

- `presence_classification` — `no_presence | third_party_only | builder_subdomain | parked | unfinished | broken | present`
- `ownership` — `owned_domain | platform_hosted | none`
- `issues[]` — `{ issue, evidence, severity, conversion_implication }` — **every issue carries a conversion implication** ("customers can't browse the menu → they call or leave", "the site shows 2019 copyright → customers question whether you're still open"). This is the amplification the business audit lacks.
- `positioning_gaps[]` — same shape as `gap_analysis.gaps`, platform fixed to `website`, expected values from the gold standard's website/category expectations.
- `build_scope` — `{ recommended: 'new_build' | 'rebuild' | 'repair' | 'secure_and_refresh', scope_notes, must_have_pages[] }` — the seed of the FITD deliverable.
- `detected_signals[]` — emits the §3 codes (canonical set for the website dimension).
- `competitive_frame` — optional: how gold-standard exemplar sites position (one line each), used by the pitch.

**Consume-side wiring:**
- Register `website_positioning_audit` in `OUTPUT_SCHEMA_REGISTRY` (`validators/market-analysis.schema.ts:280`) with `auditPlatform: 'website_positioning'` — `importExternalResult` throws "does not declare a recognized output_schema" without it. Import persists raw JSON into `mkt_audits_list` with `platform = 'website_positioning'` (column is free-form `VARCHAR(50)`; no CHECK).
- **Signal union at triage (resolves OQ-5):** `CampaignTriageService.selectAuditForTriage` reads ONE audit — latest `business_analysis` preferred, then any audit with `detected_signals`. Website-audit signals do *not* merge automatically. `loadSignalsAndPlaybooks` gains a second fetch: latest `platform = 'website_positioning'` audit → union its `detected_signals` ∩ `WC_*` into the signal set. The website audit owns the `WC_*` family; the business audit owns the rest. (Bonus: a campaign whose only audit is a website audit already hits `selectAuditForTriage` priority 2 and triages on WC signals alone — desirable.)
- **Which campaign row gets the audit:** the A7/PB-08 campaign (the sibling). Sibling campaigns' triage reads `campaign_id`-scoped audits only and is frozen at creation anyway; deliverables/openers resolve on the sibling. The primary's Audits tab shows it via existing sibling-inheritance display (`MarketingCampaignService:1855`) only if it lives on the sibling — a website audit created on the *primary* would be invisible to the sibling's own audit reads. Create it on the PB-08 campaign.
- `build_scope` + `issues[].conversion_implication` feed the FITD deliverable sections (`seo_content` initially; `website_mockup` under OQ-2) and the A7 opener's `strongest_co_occurring` context.
- **Audits-tab rendering:** `BusinessAnalysisAuditCard` is keyed to the `business_analysis` shape. v1 lets the website audit render via the tab's generic fallback; a dedicated card is a follow-up (OQ-9).

## 7. A7 — Website Gap archetype

`ArchetypeCode` gains `'A7'`; `ARCHETYPE_LABELS.A7 = 'A7_WEBSITE_GAP'`. Touchpoints (the `Record<ArchetypeCode,…>` exhaustiveness makes `tsc` enumerate them):

| Surface | A7 behavior |
|---|---|
| `selectArchetype` (fallback path) | New branch **after A3, before A4**: no owned usable site (`status ∈ none_found/social_media_only`, or host third-party/builder, or `status = 'broken'`) → A7. Matches triage where website-gap (PB-08, rank 7) sits below repair (PB-01, rank 3) but feeds a different prompt than A4. **Ordering fix from the gap sweep:** the existing A6 branch fires on `!hasWebsite` for product/hybrid businesses *before* any A7 branch could run — split it: `!hasWebsite` (no site at all) → A7 even for product businesses; A6 keeps only the `noProductBrowsing` half (site exists but no browsing). |
| `field-extractors` | `A7Fields`: `presence_class` (same enum as the audit's `presence_classification`, derived), `website_url`, `third_party_host` (e.g. "Facebook"), `builder_host`, `issues` (defect-class labels), `category` |
| `archetype-prompts` | `A7_PROMPT` — hook = the presence verdict in plain language ("customers find a Facebook page, not a website" / "your site link is dead"); previews line references the positioning report + mockup, not CTA fixes; same anatomy + forbidden list as A6 |
| `signal-magnitude` | `computePrimarySignalSeverity`: `crisis` for `no_presence`/`third_party_only`/`broken`, `material` for `builder_subdomain`/`parked`/`unfinished`, else `borderline` |
| `followup-prompts` | `FOLLOWUP_TEMPLATES.A7` doing/telling pair |
| `GalleryArchetypeDefaults` | title "Web Presence Diagnostic", subtitle "Customers can't find a real website for your business.", CTA "See My Website Plan" |
| `GalleryMultiService` | `ARCHETYPE_PRIORITY.A7 = 5` region — website gap alongside A4 |
| `hook-library` | Extend `website_foundation` archetypes to `['A4','A7']`; add a `third_party_presence` hook (signals: `WC_THIRD_PARTY_DOMAIN`, `WC_BUILDER_SUBDOMAIN`, `WC_PARKED_DOMAIN`, `WC_UNFINISHED_SITE`) with the "your website is a Facebook page" angle; add the new defect codes to `website_repair.signals` |
| `CallScriptService` | hooks are archetype-tagged arrays — A7 picks them up via `HookTemplate.archetypes`; no service change beyond the type |
| `marketing-ops.ts` | `archetypeEnum` + `playbookCodeEnum` (`'A7'`, `'PB-08'`) |
| `triage/types.ts` | `PLAYBOOK_CODES`, `ArchetypeCodeWithA6` → add `'A7'` (rename to `ArchetypeCode` or keep the alias pattern) |

Web (`apps/web`): `OpenerArchetype` union + `PitchConstructionPanel` starters/`PREVIEW_SLOT_CONFIGS`/`ARCHETYPE_LABELS`, `ArchetypeBadge` label+color, `OpenerWorkspaceClient` label, `SiblingsTab` option, `MultiGalleryPage` color, `PlaybookCatalogClient.ARCHETYPES` (`'PB-08'` is already in its `PLAYBOOK_CODES`).

## 8. Downstream surface alignment (all archetype-keyed)

The archetype is the single alignment key — once `A7` exists and triage stamps it, every downstream surface resolves through `resolveCampaignArchetype` (triage-accepted → `selectArchetype` fallback) or archetype-keyed tables. The work is filling in A7's entries, not new plumbing.

### 8.1 Outreach pitch pipeline (`outreach-pitch/`)

- `prompts.ts`: add `HEADER_PROMPT_A7` (subject line references the web-presence gap, not reviews), `CLOSER_PROMPT_A7` (references the positioning report/mockup + remaining build pieces), and an A7 branch in `buildPreviewSlotPrompt` → `WEBSITE_BUILD_FIX_PROMPT` (evidence = current presence state per slot, fix = the corresponding page/feature of the proposed build). Mirrors the `A6` precedent one-for-one.
- `quality-gates.ts` `ARCHETYPE_KEYWORDS.A7`: itch = `/\bwebsite\b/i`, `/\bsite\b/i`, `/\bdomain\b/i`, `/\bweb presence\b/i`, `/\bonline\b/i`, `/\bmockup\b/i`, `/\bpage\b/i`; `offTopic` = `/\breviews?\b/i`, `/\breplies?\b/i` with label "reviews (this is a web-presence archetype, not a review problem)" — same pattern as A6's review/booking rejection.
- `HeaderService`/`CloserService`/`PitchService`: no changes — they call `resolveCampaignArchetype` and the `*ForArchetype` builders; A7 flows automatically.

### 8.2 Call scripts (`CallScriptService` + `hook-library`)

Covered in §7 — the assembled call script's hook stage ranks `HookTemplate`s by archetype affinity + detected signals. A7 campaigns get `website_foundation` / `website_repair` / the new `third_party_presence` hooks ranked top, and the new defect codes boost `website_repair`.

### 8.3 Deliverables

- `DeliverableSourceService.TYPE_GOVERNING_SIGNALS`: add the new WC codes to `seo_content` (all nine — the positioning report is content-shaped) and `lead_magnet` (`WC_MISSING_WEBSITE`, `WC_THIRD_PARTY_DOMAIN`, `WC_BUILDER_SUBDOMAIN`, `WC_UNSECURED_WEBSITE` — the "you need a web presence" teaser).
- `DeliverableSectionService.generateAllSections`: add an `archetype === 'A7'` bundle mirroring the A6 block — section list drawn from the website audit's `build_scope.must_have_pages[]` + `positioning_gaps[]` (e.g., `positioning_report`, `homepage_mockup`, `domain_migration_plan`). New `SectionType` members as needed; see OQ-2.
- **Resolved (OQ-2): two website deliverable types.** `website_mockup` is the FITD/preview artifact (fulfill `mpt-seed-fulfill-009`, landscape layout — the strongest visual the playbook can offer). `website_build_package` is the platform-centric delivery artifact (fulfill `mpt-seed-fulfill-010`, portrait) — the implementation-ready bundle the delivery platform ships: site map & page spec, navigation/CTA spec, domain & hosting direction, asset requirements (the intake checklist), platform implementation notes, QA/launch checklist, and the profile-cutover list. Both carry the full WC_* governing-signal set; the package is signal-gated like the mockup, not execution-imported like `citation_repair_package`.
- **A7 section audit source:** `DeliverableSectionService` prefers the `website_positioning` audit (`presence_classification`, `issues[].conversion_implication`, `positioning_gaps`, `build_scope`) for all three A7 sections; the business-audit website block + static `business_type` heuristic is the fallback when no positioning audit exists.
- **PB-08 has no repair track.** `repair_track` stays `null` on accept, override, and sibling creation — the `profile_repair` category is compatibility-only. This keeps PB-08 out of `RepairFulfillmentService` gates (repair access intake, repair read model, escalation) while leaving the manual track-switch escape hatch available.

### 8.4 Owner voice & sentiment

- `OwnerVoiceService` infers owner voice from **existing review responses** — an A7 prospect's GBP is often thin or unclaimed, so inference frequently has no material. The intake write-behind adapter `owner_voice_profile_upsert` already exists: the website-build intake (§8.5) captures the voice profile manually instead of relying on inference. No service change; the intake supplies the input.
- **Sentiment framing**: `business_analysis` already emits `alignment_breakdown.public_sentiment_score` / `delta`. The website audit prompt (§6.2) instructs the analyst to amplify the sharpest framing available — high public sentiment + no/low-quality website is the strongest possible hook ("customers love you and still can't find a real website"). That contrast is the A7 pitch's emotional core and should be a first-class input to the opener/pitch context, not buried in `data_quality`.

### 8.5 Intake

`IntakeDefinitionService` is not archetype-keyed — intake definitions are campaign-scoped forms with write-behind adapters. Alignment is a definition-level concern: a **website-build intake** collecting domain preference/ownership, business description, service/product list, photos/assets, hours, owner voice (writes via `owner_voice_profile_upsert`), and category-content specifics the audit flagged (`WC_CATEGORY_MISMATCH` evidence). Whether intake definitions need a playbook linkage mechanism or are assembled ad hoc per campaign is OQ-8.

**Gap-sweep correction:** `mkt_dispute_intake.intake_kind` is a **FK to `mkt_intake_definitions(intake_kind)`** (migration 173 — natural-key PK, no CHECK). A `website_build` intake therefore needs a `mkt_intake_definitions` row (label, description, driver, trigger_stages, submitted_stage, owner_copy) inserted in migration 303 — not just an adapter.

## 9. Gap sweep — findings & resolutions

Pre-implementation sweep of every surface PB-08/A7/website_positioning touches. Verified-clean assumptions first, then the real gaps.

### 9.1 Verified clean

- **No CHECK constraints block anything.** `mkt_playbook_catalog.archetype` (VARCHAR 20 — `'PB-08'` fits `code` VARCHAR 20), `mkt_campaigns_list.campaign_category` (VARCHAR 30), `mkt_prompt_templates_list.prompt_type` (VARCHAR 50), `mkt_audits_list.platform` (VARCHAR 50), `mkt_deliverable_sections.section_type` (VARCHAR 30), `mkt_outreach_openers_list.archetype` (VARCHAR 10) — all free-form. `chk_playbook_category` already includes `profile_repair` (migration 178). No constraint-sync migration needed.
- **`validateArchetype`** (`MarketingPlaybookCatalogService:103`) validates against `ARCHETYPE_LABELS` keys — adding `A7` to the labels map fixes it for free.
- **Acceptance/sibling paths are generic.** `acceptRecommendation`/`overrideTriage`/`createSibling` write `playbook.archetype` straight through — no hardcoded A1–A6 list on the write path.
- **Manual-play templates** (`manual-play-templates.ts`) are keyed by `template_key`, not archetype/playbook — no coupling.
- **Filtered audit readers** (already `platform`-scoped, unaffected): `BusinessContextService`, `OwnerVoiceService`, `GalleryEligibilityService`, `RepairFulfillmentService`, `IdentityPacketService`, `DirectorySeedCampaignLinkService`, `DirectoryPresenceSeedService`, `writeBehindAdapters`, `MarketIntelService`, `OutreachIntelligenceService`, `SeedOutreachTriggerService`, `MarketingProspectQueueService`.
- **Intentionally unfiltered** (correct as-is): `MarketingAuditService.getAuditsByCampaign` and `MarketingCampaignService` Audits-tab includes — they list all audits for display.
- **`interactive_verification` preamble** — a website audit rendered via `resolvePrompt` inherits it for free (prefixes `baseRendered` + composed `rendered`).
- **PG-01** — proving-ground playbooks are filtered out of business triage already; unaffected.
- **Fees** — `fitd_default_fee_cents = 49900` / `retainer_fee_cents = 9900` are plain integer columns; no validation floor on retainer fees.

### 9.2 G-1: `is_active` must be `false` at migration time (deployment-ordering bug)

Migration SOP lands 303 on staging+prod while prod still runs pre-A7 code. An *active* PB-08 row lets prod's old code: recommend PB-08 → stamp `archetype='A7'` on the triage result → `MarketingPlaybookCatalogService.validateArchetype` throws `Invalid archetype` on every subsequent catalog read, and `ARCHETYPE_LABELS`/`ARCHETYPE_KEYWORDS`/`FOLLOWUP_TEMPLATES` lookups return `undefined` downstream. **Seed `is_active = false`; flip with a one-line UPDATE once the A7 code is live in prod.** The new signal-registry rows and the PB-05/PB-02/PB-06 rule extensions are inert without emitters — safe to ship active.

### 9.3 G-2: Unfiltered "latest audit" readers would shadow `business_analysis`

`platform` is the audit-type discriminator. Seven call sites take the newest audit with no `platform` filter — once a `website_positioning` row exists it silently becomes `auditData` for the wrong consumers:

| Site | Consumer | Effect |
|---|---|---|
| `DeliverableSourceService.ts:116` | `resolveEligibleTypes` | website audit drives deliverable eligibility + snapshot hash |
| `DeliverableSourceService.ts:216` | source-material build | same |
| `MarketingExecutionService.ts:527` | `buildSeekVariables` input (`audits?.[0]` fallthrough + `findFirst`) | wrong `audit_data` shape → bad seek vars |
| `MarketingOutreachService.ts:415` | `buildFreshSnapshot` | reads audit *row columns* (review_count/rating/claimed) → website audit returns 0s |
| `RecoveryResolutionService.ts:81,756` | complaint context | wrong shape in recovery prompts |
| `ProfileRepairPromptService.ts:436,783,853` | repair seek/fulfill vars | same |

**Fix:** `where: { …, platform: 'business_analysis' }` on all seven (mirroring the filtered readers' pattern). Consider a shared `latestBusinessAnalysisAudit(campaignId)` helper — this bug class will recur with every new audit type.

### 9.4 G-3: `selectArchetype` A6 ordering (fixed in §7 table)

A6's `!hasWebsite` clause claims every product/hybrid no-site business before an A7 branch placed after it could run. Resolution: A7 claims `!hasWebsite`/third-party/broken; A6 retains `noProductBrowsing` only.

### 9.5 G-4: Web `PlaybookCatalogClient` category list is already broken for this category

`PlaybookCatalogClient.tsx:26` — `CATEGORIES` lacks `profile_repair` (pre-existing: seeded PB-01/03/06/07 can't be edited via the UI without the category field going invalid). Add `'profile_repair'` (+ `CATEGORY_COLORS` entry) as part of this work — PB-08 makes the gap load-bearing. `ARCHETYPES` (line 25) gains `'A7'`.

### 9.6 G-5: Second `ARCHETYPE_PRIORITY` map

Two exhaustive priority maps exist: `BusinessProspectService.ts:69` (`Record<ArchetypeCodeWithA6>` — sibling ordering) and `GalleryMultiService.ts:89`. §7 listed only the gallery one; both need `A7` (tsc will catch them anyway — the point is they're both load-bearing, not dead code).

### 9.7 G-6: `intake_kind` is FK'd, not free-form

`mkt_intake_definitions` row required (see §8.5).

### 9.8 G-7: `OUTPUT_SCHEMA_REGISTRY` registration is mandatory

`validators/market-analysis.schema.ts:280` — the import path resolves `output_schema->>'name'` through this registry. Missing entry = hard throw on import (see §6.2 wiring).

### 9.9 G-8: Stale `field-extractors.ts:116` comment

Claims PB-01 fires for `WC_BROKEN_WEBSITE` — wrong today, wronger post-PB-08. Fix the comment while editing the file for A7.

### 9.10 G-9: Audit-card rendering

Audits tab needs a render path for `platform='website_positioning'` (generic fallback acceptable for v1 — OQ-9).

### 9.11 G-10: V1/seed templates not amended

The §6.1 signal definitions go to the two V2 variants (`mpt-j9bbem3l`, `mpt-6oeuiizo`) only. `mpt-je6m7ru6` (V1) and `mpt-seed-seek-001` are legacy — leave them; their audits use the derived-extractor path anyway, which §5 covers.

## 10. Files touched (implementation plan)

- `database/migrations/303_mkt_playbook_pb08_website_gap.sql` — §4 + `mkt_intake_definitions.website_build` row (§8.5) — PB-08 seeded `is_active=false` (§9.2)
- `apps/api/src/services/triage/signal-taxonomy.ts` — codes, labels, `isRepairSignal`
- `apps/api/src/services/triage/signal-extractor.ts` — §5
- `apps/api/src/services/triage/types.ts` — PB-08, A7
- `apps/api/src/services/CampaignTriageService.ts` — website-audit signal union in `loadSignalsAndPlaybooks` (§6.2)
- `apps/api/src/routes/marketing-ops.ts` — enums
- `apps/api/src/services/outreach-openers/{archetype-selection,field-extractors,archetype-prompts,signal-magnitude,hook-library,index}.ts`
- `apps/api/src/services/outreach-pitch/{prompts,quality-gates}.ts` — A7 header/closer/slot prompts + itch keywords
- `apps/api/src/services/outreach-followups/followup-prompts.ts`
- `apps/api/src/services/marketing/{GalleryArchetypeDefaults,GalleryMultiService}.ts`
- `apps/api/src/services/BusinessProspectService.ts` — `ARCHETYPE_PRIORITY.A7`
- `apps/api/src/services/deliverable/{DeliverableSourceService,DeliverableSectionService}.ts`
- `apps/api/src/validators/website-positioning.schema.ts` (new) + `OUTPUT_SCHEMA_REGISTRY` entry in `market-analysis.schema.ts`
- `apps/api/src/scripts/seed-website-positioning-audit-template.ts` (new, `mpt-*` row)
- `apps/api/src/scripts/seed-business-audit-v2-templates.ts` — §6.1 amendment + marker bump
- G-2 platform filters: `DeliverableSourceService`, `MarketingExecutionService`, `MarketingOutreachService`, `RecoveryResolutionService`, `ProfileRepairPromptService`
- Web surfaces per §7 table + `PlaybookCatalogClient` CATEGORIES/ARCHETYPES (G-4)
- Tests: cascade (PB-08 claims each signal, PB-05 dual still wins defect+review, PB-03 fallback intact), extractor derivation + suppression, A7 dispatch/selection/severity, signal-union, platform-filter parity, checklist steps seeded — no CHECK-constraint parity tests needed (none touched)

## 11. Ops checklist

1. Apply `303_*.sql`, `304_*.sql`, and `305_*.sql` against `local` **and** `prd` (`psql $DATABASE_URL -f …` under each Doppler config) — additive-only; PB-08 lands `is_active=false` (§9.2). 305 corrects `preview_deliverable_type` to `website_mockup`.
2. Re-run `seed-business-audit-v2-templates.ts`, `seed-deliverable-source-material-templates.ts`, and `seed-deliverable-layout-templates.ts` under `--config local` + `--config prd` (marker bumps force re-sync; the deliverable seeds add `mpt-seed-fulfill-010` + the build-package layout).
3. Run the new `seed-website-positioning-audit-template.ts` under both configs.
4. Verify live: `SELECT code, priority_rank, is_active FROM mkt_playbook_catalog ORDER BY priority_rank` shows PB-08 at 7 (inactive), PB-03 at 8; `mkt_signal_registry` holds the 9 new codes; `mkt_intake_definitions` holds `website_build`; template `updated_at` newer than the seed commit.
5. **After the A7 code is deployed to prod:** `UPDATE mkt_playbook_catalog SET is_active = true WHERE code = 'PB-08'` against `local` + `prd`.

## 12. Open questions

- **OQ-1 — Audit trigger.** Operator-triggered from Prompt Workspace (recommended for v1 — audits cost money, acceptance should gate them) vs. auto-run on PB-08 accept. Auto-wiring means a transition hook + execution-id plumbing.
- **OQ-2 — `website_mockup` DeliverableType.** ~~Open~~ **Resolved:** implemented as a real type end-to-end, plus `website_build_package` as the platform-centric delivery tier (see §8.3).
- **OQ-3 — Absence-class in dual.** Should `WC_THIRD_PARTY_DOMAIN`/`WC_BUILDER_SUBDOMAIN` join PB-05's `groupA`? Current spec keeps them absence-class (like `WC_MISSING_WEBSITE`); a Facebook-page + review-drought business routes to PB-02. Cheap to revisit — pure JSONB edit.
- **OQ-4 — Host list governance.** The social/builder host sets live in extractor code. Moving them to a registry `derived_rule` payload would make them admin-editable; not worth it until a second consumer exists.
- **OQ-5 — Website-audit signal union.** ~~Open~~ **Resolved in §6.2** (gap sweep): union per family — website audit owns `WC_*`, business audit owns the rest; implemented as a second fetch in `loadSignalsAndPlaybooks`.
- **OQ-6 — `WC_CATEGORY_MISMATCH` vs. category identification.** The category-identification audit also judges category fit. The WC signal is scoped to *site content* mismatch (wrong-industry copy on the website); keep the boundary explicit in both prompts.
- **OQ-7 — Sibling suppression.** PB-08 and PB-03 share `WC_MISSING_WEBSITE`-adjacent territory; multi-archetype will offer PB-03 as an alternative sibling whenever a website-gap campaign also has CTA-type findings. Confirm that's desired (probably yes — friction fix is a legit second engagement post-build).
- **OQ-8 — Website-build intake definition.** Whether intake definitions get a playbook/archetype linkage (so a PB-08 campaign auto-offers the website-build intake) or stay campaign-ad-hoc. §8.5 assumes ad hoc for v1.
- **OQ-9 — Website-positioning audit card.** Whether the Audits tab gets a dedicated `WebsitePositioningAuditCard` (presence_classification, issues+conversion_implication, build_scope rendering) or the generic fallback suffices for v1.
