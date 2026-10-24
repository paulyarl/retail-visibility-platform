# AGENTS.md — Project Conventions

## Build & Typecheck Commands

- `pnpm checkapi` — TypeScript check for `apps/api` (`tsc --noEmit --project apps/api`)
- `pnpm checkweb` — TypeScript check for `apps/web` (`tsc --noEmit --project apps/web`)
- `pnpm prisma:generate` — Regenerate Prisma Client (run after schema changes)
- `doppler run --config local -- pnpm prisma db pull` — Pull DB schema into `prisma/schema.prisma` (run from `apps/api`)
- `doppler run --config local -- pnpm prisma generate` — Regenerate client with Doppler secrets
- `cd apps/web && npx vitest run` — web unit tests (vitest, node environment, `src/**/*.test.ts`). Run a single file by path.
- `pnpm test` — both app vitest suites (`pnpm -r test`); `pnpm test:watch` for watch mode
- `pnpm build` — `pnpm -r build` (api → shared → web). Both app builds must exit 0 before a deploy.

### `pnpm build` — the two failure modes it used to have (fixed 2026-10-23)

- **API: `tsc` OOM, empty stdout.** `build-with-selective-errors.js` now runs `tsc` with `NODE_OPTIONS=--max-old-space-size=8192` (merged with any existing `NODE_OPTIONS`, so the Dockerfile's value still wins). Without it tsc dies at Node's ~4 GB default and the script reports `Total errors: 0` / `tsc produced no dist output` — that is the OOM, not a clean build.
- **Web: `/_global-error` prerender dies with `InvariantError: Expected workStore to be initialized` (Next E1068).** Upstream bug: `resolveMetadata` reads `workAsyncStorage.getStore()` *after* `await resolveMetadataItems(...)`, so the ALS context is lost when segment modules are cold-loaded — intermittent, and it poisons `.next` so the next build fails too. Unfixed in next 16.3.6→16.3.8, 16.4.3 and canary 16.5.0-canary.25. Fixed here by `patches/next@16.3.6.patch` (moves the `getStore()` call above the await; applied to both `dist/esm` and `dist/lib`), wired through `patchedDependencies` in `pnpm-workspace.yaml`. **Drop the patch when Next ships the fix upstream** — it pins to the exact version, so a Next bump fails the install loudly until the patch is regenerated or deleted. Note `apps/web` builds with 16.3.6 while the repo root pins 16.3.7; only the app copy is patched, so `npx next build` from the root is not protected — use `pnpm build`.

### Tier/capability contract (`shared/tier-contract.json`)

**The fixture is the source of truth for tier order, pricing, display names, inheritance edges, trial maps, tier classes, capability modules, and the surface inventory.** The DB is a witness, not the generator. Rules:

- Adding a tier or capability key means **editing the fixture first**, then the code — contract suites in `apps/api/src/services/__tests__/` (`tier-*`, `mv-shape-lint`, `tier-doc-generation`) fail on drift.
- `surface_files` in the fixture is the contract-surface manifest: any file under `apps/api/src`/`apps/web/src` declaring a `TIER_*` map / `DEFAULT_TIER` / `*_TRIAL_BASE_TIERS` / tier enum must be listed (`asserted`/`covered`/`derived`/`documented`/`exempt`) or the guard fails.
- `capability_modules` is generated — regenerate via `node apps/api/scripts/sync-fixture-modules.cjs` after re-dumping the DB witness (`cd apps/api && doppler run --config prd -- node scripts/dump-tier-contract.cjs` → `shared/tier-contract-db-witness.json`).
- Doc blocks between `<!-- BEGIN/END tier-contract:* -->` markers are generated — regenerate via `node apps/api/scripts/gen-tier-doc-blocks.cjs --write` (`--check` diffs without writing).
- Sprint plan + decision log: `docs/LocalBiz/TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md`.

### DB rescue utility (`apps/api/scripts/db-rescue.cjs`)

Emergency DB diagnostics/cleanup for Supabase quota incidents — plain Node + `pg` (no build step, simple query protocol so it survives pgbouncer transaction mode and can run VACUUM; no psql needed). Run via `cd apps/api && doppler run --config <local|prd> -- node scripts/db-rescue.cjs <cmd>` (or `pnpm db:rescue` under doppler). Key commands: `report` (size/top tables/slots/error-log volume/cron dupes — run first), `errors top|purge --days N [--like 'pat%']`, `guard install --like 'pat%'|status|drop` (BEFORE INSERT circuit-breaker that silently drops spam rows), `cron list|dupes|trim|retention|unschedule`, `errors dedupe [--minutes N]` (generic trigger dropping repeat inserts of an identical message within the window — prod+stg have it at 60m; app-side dedupe also lives in `DatabaseTransport`, `LOG_DB_DEDUPE=false` to disable). The dedupe/guard triggers suppress rows via `RETURN NULL`, which makes `prisma.application_error_log.create()` panic ("Could not figure out an ID in create" — `INSERT…RETURNING` gets no row): every writer to this table must use `createMany` and treat `count: 0` as a quiet deduped drop (`DatabaseTransport.persist`, `client-errors` route), `vacuum <table> [--full]` (FULL returns disk space, brief lock), `sql "select …"`. Nightly retention jobs exist on both envs: `purge-cron-run-history` (3d), `purge-application-error-log` (14d), `purge-scheduled-job-runs` (7d — migration `315`, keeps the Scheduled Jobs run-history glanceable without storage clutter). Added 2026-10-06 after the `application_error_log` spam incident (old `monthly-fee-summary` self-scheduling loop → 717K rows / 400MB); Supabase dashboard "Database Size" lags and counts WAL — verify with `pg_database_size`.

### Web component render tests (no jsdom needed)

`apps/web` has no jsdom/testing-library, but Mantine 9 ships **pre-compiled CSS modules** (`.module.mjs` are plain JS class-name maps, no CSS imports), so a component can be server-rendered in the existing node-environment vitest project:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';

const html = renderToStaticMarkup(
  createElement(MantineProvider, null, createElement(SomeView, { profile })),
);
expect(html).toContain('…');
```

Wrap in `MantineProvider` or Mantine throws `MantineProvider was not found in component tree`. Pattern: `apps/web/src/components/marketing-ops/BronzeStandardProfileView.test.ts`. Note `Accordion` panels are unmounted while collapsed (`keepMounted` defaults to false), so assert collapsed-panel copy only after expanding.

Non-Mantine components need **no provider** — plain elements + Radix wrappers (`@/components/ui/Tabs`) + lucide icons all render bare (`ResolveVerificationModal.test.ts`, `BusinessContactCard.test.ts`). Rules of thumb learned wiring the marketing-ops tests (2026-09-23):

- **Radix `TabsContent` unmounts inactive panels** (same trap as `Accordion`). The static render only produces the active tab's markup. Preferred workaround: give the component an optional `initialTab` prop (see `ResolveVerificationModal`) and render the test with `initialTab: 'enrichment'` — do NOT mock `@/components/ui/Tabs`; keep tests on real primitives. The same trick works for *state-gated* panels: `ResolveVerificationModal`'s `initialOutcome` prop lets a test render the non-operational gate notice / blocked next-action without interaction. Export pure helpers the component relies on (`snapshotWebsite`) so edge-case coercion is unit-testable too.
- **`useEffect` never runs** in `renderToStaticMarkup`. Data-loading components (`IdentityPacketCard`) can only render their loading state, so test the *data contract* instead: extract the pure bridge/mapper into a named export (`buildVerificationEntryFromPacket` in `IdentityPacketCard.tsx`) and unit-test it + integration-test the presentational child (`ResolveVerificationModal`) it feeds.
- **Service singletons import cleanly.** `MarketingOpsService.getInstance()` is instantiated at module load but its browser globals (`window`, `localStorage`, `navigator.sendBeacon`, `document.cookie`) are all `typeof window !== 'undefined'`-guarded, so a client component importing the service renders in node — its methods only run inside event handlers that never fire in SSR.
- **`.test.ts`, not `.tsx`.** `vitest.config.ts` includes only `src/**/*.test.ts` and JSX needs a `.tsx` filename — use `createElement`, and cast partial fixtures (`as unknown as Campaign`) rather than filling every field of the big service types.
- **Assert on `value="…"` attributes.** Controlled inputs serialize their prefilled state into markup, so `expect(html).toContain('value="MapQuest"')` pins the prefill — the exact assertion that would have caught the snapshot-prefill regression.
- **Async server pages are testable as elements.** `await PlacesIndexPage()` returns the fragment element without rendering, so band order can be pinned by type: `Children.toArray(page.props.children)` → `types[0] === PlacesIndexHero`. Mock the service with `vi.mock('@/services/PlacesBrowsePublicService', async (importOriginal) => ({ ...await importOriginal(), default: { …vi.fn()s } }))` — the `importOriginal` spread keeps named/type-ish exports resolvable. Pattern: `apps/web/src/app/place/place-index-order.test.ts`.

### `/place` home — header leads, national coverage copy follows (added 2026-09-23)

`PlacesIndexHero` (server) renders the breadcrumb + H1 + browse copy + search entry + shelf counts, then `PlaceNationalPanel` renders the national packet narrative/coverage band, then the category grid. The panel originally rendered *above* the client index, so the title trailed the copy. The header is server-rendered because the old client-owned header only existed after hydration (the client returns its loading branch during SSR, so the H1 was absent from the HTML) — the hero must stay above the panel and outside the client's loading gate. Counts come from the server-side `getCategories()` read in `page.tsx`, passed down as `initialCategories`; `PlacesIndexClient` keeps its fetch only as the fallback for when that read returns null.

### Enrichment prompts — platform category vocabulary injection (added 2026-09-24)

Every `prompt_type='enrichment'` render (`resolvePrompt` in `MarketingExecutionService`) now appends a `PLATFORM CATEGORY VOCABULARY` block — the same `CategoryVocabularyService.loadVocabulary()` union (platform_categories `is_active` + `mkt_service_categories_list` registered labels) the category-identification scan gets via `formatKnownCategoryVocabulary`. The formatter is `formatEnrichmentCategoryVocabulary` (`MarketContextBindingFormatters.ts`), which shares the `partitionCategoryVocabulary` dedupe/partition helper with the cat-id formatter. Framing differs: the enrichment block carries an explicit `DIRECTIVE — emit names verbatim from the KNOWN CATEGORIES list` split per packet kind — category packets (`secondary_categories`/`adjacent_categories`/`super_categories`) and location packets (`secondary_categories`/`top_categories`/`context.market_gaps[].category`/`area_breakdown[].strong_categories`), because the public pages resolve chips to live shelves by exact label match (`apps/web/src/lib/place-shelves.ts` `resolveShelfForLabel` — trimmed lowercase equality, `count > 0` gate; a near-miss degrades to a plain-text chip). The block opens with a compact `PLATFORM GOAL` preamble (physical shelves of independent brick-and-mortar retailers, mirroring the bronze scan's `PLATFORM_GOAL_SECTION` mission framing) so the analyst understands why the vocabulary is shelf-shaped — non-shelf businesses have no canonical label and are legitimate unlisted picks that simply can't hot-link. `sub_categories` are exempt (intra-category specializations, not shelves), and `super_categories` get dedicated framing: PLATFORM parents — the listed shelf a shopper drills up to (e.g., a specialty grocery rolls up to the listed grocery shelf), never external market-framing buckets like "Retail"/"Consumer Services" that aren't shelves (`platform_categories` is flat — `parent_id`/`level` exist but no sync populates them; both taxonomy sync services write `google_taxonomy_list`, a different table — so there is no canonical parent data to inject, only the wording). The block is appended on ALL enrichment return paths (category-set sweep, national `__all__` location/category, city geography-grid, city category, and the no-context passthrough), after the other context blocks and before the output-schema suffix. Load failure or empty vocabulary → `''`, byte-identical render. `loadVocabulary` also returns `supplementLabels` — a third source queried across the enrichment ecosystem (`mkt_campaigns_list.category` + `secondary_categories` unnested, `directory_category_enrichment.category_name`, `mkt_intelligence_profiles.category_name`). Sentinels are excluded by key AND by name — location packets reuse `directory_category_enrichment` with `category_key='__location__'` and the location label (e.g. `"Milwaukee, WI"`) in `category_name`, so the filter is `category_key !~ '^__'` on the enrichment/profile tables plus a name-level `!~ '^__'` net; profiles are additionally gated to `status='active'` (retired/draft don't establish a live category page). These are operator-typed labels created off-list at campaign creation (e.g. `Middle Eastern Grocery Store`) that already name live enriched pages — `GET /api/public/directory/places` LEFT JOINs `platform_categories` and falls back to a name-derived slug, so supplements can hot-link on `/place` even without a `platform_categories` row. The enrichment block renders them as a third `ENRICHED CATEGORIES` section (the cat-id `formatKnownCategoryVocabulary` keeps the two-list union); the directive tells the analyst to emit from KNOWN + ENRICHED verbatim. Render-time injection — no seed re-run needed (V13 was seeded 2026-09-24 for template-body example fixes; supplement coverage needs none).

### Category identification — same vocabulary alignment (added 2026-09-26)

The cat-id `KNOWN CATEGORY VOCABULARY` block (`formatKnownCategoryVocabulary`) caught up with the enrichment treatment: it now takes `supplementLabels` as a third arg (the cat-id call site was dropping them — a supplement label naming a live enriched page would have been wrongly judged `is_known_category = false`; `isKnownLabel` already counted them), renders an `ENRICHED CATEGORIES` section between KNOWN and REGISTERED via the shared `partitionCategoryVocabulary` helper, opens with the same `PLATFORM GOAL` physical-shelves preamble, and frames the candidate list as propagating ONE prospect across shelves (primary = canonical shelf, each accepted secondary = another public shelf). `is_known_category` is judged against ANY of the three lists. The seed template (`mpt-seed-category-identification-001`) got matching copy: `KNOWN CATEGORIES` names all three lists and `DIRECTORY HOSTING CONTEXT` opens with the mission + propagation framing — **re-run `seed:category-identification-template` against local and prd** for the body update to take effect.

The audit card's `Promote` action (`destination='primary'` → `MarketingCampaignService.promoteIdentifiedCategory`, added 2026-09-26) performs the recommended-primary swap: the candidate becomes `campaign.category` and the incumbent primary demotes to the FRONT of `secondary_categories` (the promoted label is removed from secondaries). Nothing is dropped — PG keeps every shelf + its enrichments for sweep engagement. Refuses when secondaries are at the 9-cap and the label isn't already among them (would need an 11th slot); business-scope only — the route 400s on aggregate scan campaigns where `category` is the scan context. The card renders the swap instantly from the returned campaign payload (local state) plus `onSynced` refetch; button hidden when the candidate already IS the primary.

**Post-seed propagation is retire-and-replace — one live seed per campaign** (added 2026-09-26): a seed is a child of its campaign, but exactly ONE child is visible/claimable at a time so seed claim has a single source (an owner must never face two claimable seeds for the same business). When Promote runs on an already-seeded campaign, the route calls `createFromCampaign` to birth the successor seed under the new primary, then suppresses the prior primary-linked children (`updateStatus` → `'suppressed'` — terminal in outreach sync, off every public surface since all shelf queries gate `dps.status IN ('published','invited','claimed')`, still campaign-linked for audit). Mechanics:

- `createFromCampaign`'s idempotency is now **shelf-aware**: a live (`status IS DISTINCT FROM 'suppressed'`) primary-linked seed only short-circuits when its listing's `primary_category` equals the campaign's CURRENT primary; a linked seed filed under a different (pre-swap) shelf no longer blocks creation. Consequence: post-swap "Add to place listing" births a successor too — same semantics as the promote path.
- The successor's `secondary_categories` mirror the campaign's list verbatim — the demoted incumbent primary sits among them, so the ONE visible seed still covers both shelves (primary card on the new shelf, secondary filing on the old). The suppressed child is untouched — it keeps its seed-time filing as the audit record.
- **Publish-state mirror**: the successor is created with `publish: true` when the outgoing seed was `published` (public card never blinks — note this fires the courtesy outreach trigger once for the new seed/claim URL); a draft predecessor's successor stays parked in draft.
- Route guards: replacement only fires when the campaign has ≥1 primary-linked seed (pre-seed promote is a category-only rearrangement) and NONE are `claimed` or `invited` — owner-facing seeds are left entirely alone (a claimed listing has an owner; an invited one has a live claim token in the wild). Failure is non-fatal — the promotion already committed; "Add to place listing" is the manual path. Response carries `replacement_seed` + `retired_seed_ids`; the card appends "replacement seed created · N prior seed(s) retired".
- "Spawned Place Listings" on the campaign overview lists every linked seed (`listSeedsForCampaign`) including suppressed ones — the audit trail stays visible to operators.

**One seed per PROSPECT — only the primary sibling graduates** (added 2026-09-28): sibling campaigns share a `business_prospect_id`, but only the primary sibling (`is_primary_sibling = true`) may graduate to a seed — a second seed would duplicate the same business's listing and split the claim surface. The secondary sibling's shelf coverage rides the primary's seed via `secondary_categories` (cat-id Promote expansion), and the sibling attaches to the primary's seed with `link_role='sibling'` ("Find matching seed" / LinkedCampaignsPanel). Enforcement is server-side at both write edges: `createFromCampaign` throws `non_primary_sibling` (409, payload carries `primaryCampaignId`/`primaryCampaignDisplayId` resolved via `BusinessProspectService.getPrimarySibling` — fallback oldest business-scope sibling when none is flagged) on `business_prospect_id && is_primary_sibling === false`, firing before audit/NAP/gate evaluation so both lanes ("Add to place listing", Identity-tab Push) and the post-Promote successor path (non-fatal catch there) are covered; `DirectorySeedCampaignLinkService.linkCampaign` refuses `role='primary'` on a non-primary sibling (`sibling`/`recovery` roles unaffected — that's the designed attach path). UI mirrors the rule: the audit card's "Add to place listing" and the Identity packet's Push disable with a sibling explanation on `campaign.isPrimarySibling === false && businessProspectId`, and the Create Seed form's Campaign Prospect picker disables non-primary sibling rows (a `sibling` badge marks them). Legacy campaigns (`business_prospect_id = null`, unflagged) are each their own group and seed freely.

**Sibling audit inheritance is a per-platform merge** (fixed 2026-10-06): `getCampaign` merges the primary sibling's audits into a non-primary sibling's `audits` array for every platform the sibling lacks — the sibling's own audit wins per platform, and a `business_analysis` stub does NOT count as coverage. Previously the merge only fired on `audits.length === 0`, a stale assumption — a PB-08 sibling generates its own `website_positioning` audit, which blocked inheritance and 400'd every `business_analysis`-gated reader (opener/header/closer/follow-up resolve, `resolvePrompt`). Merged rows are tagged `inherited: true` (Audits tab shows an "inherited" chip + mixed-list banner) and the array is sorted `created_at` desc so `.find(platform)` readers get the freshest. `BusinessContextService.getLatestAuditData` — the second audit reader (`resolveCampaignArchetype` fallback, deliverables, call scripts, hook severity) — does its own prisma read and got the same sibling fallback (missing-or-stub BA → primary sibling's latest real BA). `hasAudit`/`siblingHasAudit` still read pre-merge `mkt_audits_list` — an inherited audit never marks a sibling as having "its own" audit.

### Public narrative — mutual fallback, cat-primary on cat surfaces (added 2026-09-26)

Both the `business_analysis` and `category_identification` analysts emit `audit_data.public_narrative`. Surfaces that emit a narrative treat the two as mutual fallbacks with surface-dependent precedence: **cat surfaces get the cat-id narrative as PRIMARY** (the analyst that filed the business onto its shelves wrote the canonical shelf copy) and the BA narrative as fallback; non-cat surfaces keep BA primary with cat-id as fallback. Reachability: the cat-id audit often lives on the *scan* campaign, not the seeded business campaign — both derive lanes stamp `mkt_campaigns_list.parent_campaign_id` (`deriveBusinessCampaign` directly; the queue lane via the queue entry's `source_campaign_id`), so a one-hop parent walk resolves it. `apps/api/src/services/intelligence/auditPublicNarrative.ts` (`resolveCatIdPublicNarrative` / `resolveAuditPublicNarrative`) is the shared resolver — takes the prisma client + campaign id(s).

Wire-up per surface:

- **Listing description (cat-primary):** `DirectoryPresenceSeedService.composeCampaignSeoPacket` resolves the cat-id audit on `campaign.id` + `parent_campaign_id` via `resolveCatIdAudit` and passes `extractCatIdSeoFields(...)` to the composer as `categoryIdAudit`; `composeDescription` prefers the cat narrative over `audit.publicNarrative`, so `directory_listings_list.description` carries cat-id copy for new/re-composed seeds (covers `createFromCampaign`, the Create Seed form's `seo-preview`, and `backfill-seed-seo.ts`). Renders on `/place/category/[slug]` cards (`place.description`, already wired) and now `/directory/categories/[slug]` cards (`DirectoryGrid.transformListing` maps `listing.description` → `StoreCard`; `UnifiedStoreCard` renders it in list + grid views — the MV categories endpoint already returned `description`, only the card transform dropped it).
- **`/place/[slug]` About (BA-primary):** `MarketIntelService.getTeaserSummary` keeps the BA narrative primary and falls back to the cat-id narrative — including the `hasAudit: false` branch via `resolveLinkedCampaignId` (the §8.4 chain up to the campaign link, no BA row required).
- **Seed report (BA-primary):** `SeedReportEvidenceService.getSeedReportContext` already did `baData ?? catData` fallback; its audit query now spans the linked campaign AND `parent_campaign_id` so the fallback actually fires for derived campaigns. Two-step read — do NOT fold the parent into a `mkt_campaigns_list` subquery: test mocks dispatch `$queryRaw` by `FROM <table>` matching, and a query touching both tables silently misroutes.

**Full vs partial SEO (added 2026-09-26):** the seed SEO packet has two lanes — a `business_analysis` audit produces the FULL packet; a reachable `category_identification` audit alone produces the PARTIAL packet (the fast path: seed + cat-id scan, no BA audit yet). Partial is deterministic extraction, not a new analyst task — `extractCatIdSeoFields` (SeedSeoComposer) pulls `public_narrative`, `nap.directory_profile_urls` + `digital_footprint.platforms_found`/`social_profiles` URLs → `sameAs`, and `candidate_categories[].category` → keywords (verbatim vocab, same trust tier as google `additional_categories`, through the same prohibited-keyword filter and 15-cap). Unaccepted candidates do NOT become `secondary_categories` — assigned shelves still come only from `campaign.secondary_categories`. The packet records `inputs.category_identification_audit_id`; `previewCampaignSeo` returns `hasCategoryIdAudit` and sends `seoEnrichment` when either audit exists (the Create Seed form labels the lane "full SEO" / "partial SEO" / "Tier A"). The composer input boundary is unchanged — callers extract explicit fields, the raw blob never enters the composer.

**Post-audit sharpen (added 2026-09-27):** the packet upgrade is now automatic — when a real (non-stub, `isStubBusinessAnalysisAudit` — `derived_from_city_scan` stubs are not yet in that source list) narrative-bearing audit (`business_analysis` or `category_identification`) is persisted, `DirectoryPresenceSeedService.resharpenSeedsForCampaign` recomposes every LIVE primary-linked seed on the campaign AND its `parent_campaign_id` children through `composeCampaignSeoPacket` (the campaign packet path). Rewrites `dll.description/keywords/same_as` + `dps.seo_enrichment` + `directory_field_provenance` upserts (ON CONFLICT preserves `override_by`/`override_at`). Guards: `claimed`/`suppressed` seeds skipped, seeds with `override_by` on description/keywords/same_as provenance skipped — hand edits outrank audit copy. Wired at all three real-audit write sites (internal run `MarketingExecutionService.applyEnrichmentFromOutput`, external import `MarketingPromptService.importExternalResult`, manual `MarketingAuditService.createAudit`), all best-effort try/catch — a sharpen failure never fails the audit. So the intended cadence cat-id → BA audit auto-upgrades a partial seed to the full packet the moment the audit lands.

Existing seeds otherwise keep their old descriptions until re-seeded, re-composed (seed-edit description reset), or a `backfill-seed-seo` re-run — the backfill idempotency marker (`seo_enrichment.composer_version`) skips enriched seeds, so re-running only touches un-enriched ones; cat-id-only campaigns now backfill as `partial` rather than `degraded`.

**Campaign-aware composed enrichment (updated 2026-10-08):** `getComposedEnrichment` (the seed page's "Composed enrichment" panel) and `resetEnrichment` ("Reset to composed") are now campaign-aware — a seed with a primary `directory_seed_campaign_links` row composes through `composeCampaignSeoPacket` on the linked campaign's latest BA audit (non-stub preferred, stub fallback; cat-id audit reachable via self+parent inside the composer), so the panel/reset carry the analyst `public_narrative` instead of the `audit: null` market template that used to strip it. Unlinked seeds keep the market lane. `resetEnrichment` stamps the lane the packet actually came from (`business_analysis_audit` / `linked_campaign` / `market_enrichment`, never a blanket `market_enrichment`) at `high`/`medium` confidence respectively, and `composedAt` reflects any automated compose-lane stamp (`COMPOSED_PROVENANCE_SOURCES`). The market sweep's campaign-content guard was widened the same day — it now skips seeds whose description/keywords provenance is ANY campaign-path stamp (`CAMPAIGN_SOURCED_PROVENANCE`: `linked_campaign`, `business_analysis_audit`, `seed_seo_composer`, `intelligence_profile`), not only `linked_campaign`, so a category sweep can't clobber audit/birth copy. Tests: `DirectoryPresenceSeedService.composed.test.ts`.

### Business audit directives — platform-goal alignment (added 2026-09-25)

The audit templates now carry the same mission framing the enrichment prompts and bronze scans got. `seed-business-audit-v2-templates.ts` (marker `business-audit-v2-2026-09-25-platform-goal-7`) inserts a headingless `=== PLATFORM GOAL: PHYSICAL SHELVES, WALK-IN CUSTOMERS ===` section right after the business-identity block — before the CI/GS/MC bindings — in all four audit transforms (both V2 variants, V1, and the seed-minimal `mpt-seed-seek-001`, which gets it prepended since it has no identity block). The section states the audit is the evidence engine (seeds the public shelf listing, powers seed-and-claim outreach), gives two audit-level consequences (publishable-standard evidence; gaps framed as walk-in customers lost), the **platform-fit rule** (a non-storefront subject — online-only, delivery-app-only/ghost kitchen, mobile-only — or a chain/franchise is recorded explicitly in `store_format`/`summary`/`data_quality` as information, never a disqualification; outreach rules untouched), and the canonical-label rule (emit `{{category}}` verbatim in `matched_business.category`/`public_narrative` when it fits — it names the shelf the listing files under). Like the bindings it is insert-once via fingerprint — future edits go through `replaceFirst` pairs, NOT `removeSection` (it is headingless by design).

Two `replaceFirst` pairs apply the same alignment to the Signal-Aligned-only instruction sections (applied in both V2 transforms since the sentences can exist natively in either body): `store_format`'s "compare like-for-like" gains the non-storefront consequence, and the competitive benchmark's "high mainstream visibility" line gains the shelf-vs-shelf comparator preference (chain flagship / online-only seller is not like-for-like). The `public_narrative` directive's category bullet now prefers `{{category}}` verbatim — it self-refreshes via `removeSection`+`insertAfter`, no `replaceFirst` needed. `seed-website-positioning-audit-template.ts` gets its own variant, `=== PLATFORM GOAL: THE DIGITAL SHELF ===` (the website as the storefront's digital extension — browse online, buy at the counter, never a shipping operation), inserted between `{{prior_website_findings}}` and `=== OBJECTIVE ===`.

### Default business audit — parity rewrite (added 2026-09-26)

`mpt-seed-seek-001` ("Seek: Business Audit", `is_default: true`) was the minimal legacy body (~8.8k chars: platform goal + 13-item provide list + outreach directive) with NO embedded schema, no bindings, and no section instructions — and because `business_analysis` sits in `LEGACY_NO_SUFFIX_SCHEMAS` (`MarketingExecutionService.resolvePrompt`), the render path appends no output contract either, so the executed prompt's only output instruction was "Format as structured JSON." Every conditional field downstream surfaces consume (`public_narrative` → listings/About, `market_opportunities`/`signal_checklist` → sidebar cards, `render_controls` → tier-suppression coverage gate, `outreach_problems`/`recommended_attributes`/`primary_outreach_hook` → outreach surfaces) had no defined home in the default audit.

The transform now replaces the body wholesale from a canonical asset: `apps/api/src/scripts/business-audit-default-body.md` (~74k chars), read via `readFileSync` in `transformSeedBusinessAudit` (marker `business-audit-default-2026-09-26-parity-5` — the asset IS the source of truth; edit it and bump `DEFAULT_AUDIT_MARKER` to re-apply). parity-1 → parity-2 deduped the inherited V2 corruption that slipped through extraction (a 12× `business_specific_failure` Exception sentence, a redundant `## Business` identity block duplicating the identity table, and four run-on clause joins); parity-2 → parity-3 added the missing `summary`-field instruction (the `## Summary` heading carried only the public-narrative directive, leaving a required schema field with no guidance); parity-3 → parity-4 fixed the one skeleton/schema disagreement (`matched_business.business_name` was `null` in the skeleton but is a required non-nullable `z.string()` — now `"<string>"`; the full skeleton was safeParse'd clean against `businessAnalysisSchema`, every schema-declared key present); parity-4 → parity-5 corrected the three context-binding position claims (blocks actually render after the embedded schema, not before it) and swapped the two identity enum placeholders to `|`-lists (pre-filled `confirmed`/`high` read as echoable defaults). Composition: the Signal-Aligned (`mpt-6oeuiizo`) instruction set — the superset of both V2 bodies — PLUS coverage no `business_analysis` body had: `### Business type classification` (`business_type`), `### Photo & Holiday-Hours Inventory` (`google.photo_count`/`photo_types`/`special_hours_present`), `### Product Visibility & Ordering` (`website.has_product_browsing`/`has_availability_inquiry`/`has_pickup_ordering`/`has_delivery_option`/`product_categories_visible`), plus two Output Rules additions (bare-array-element rule, conditional-omit-not-empty-array rule) and a clean embedded schema carrying every contract field the V2 skeletons omit (`outreach_problems`, `recommended_attributes`, `business_type`, product-visibility fields, `platforms.{p}.attributes`, `canonical_city`/`state`/`zip`). Variables widened 3→7 (`FULL_BUSINESS_VARIABLES`). The workspace preview suffix (`OUTPUT_SCHEMA_PROMPT_SUFFIXES.business_analysis` in `PromptWorkspaceClient.tsx`) was synced to the full key list — it had drifted 8 fields behind the schema.

**The two V2 bodies + V1 are retired, not repaired (2026-09-26):** `mpt-6oeuiizo`, `mpt-j9bbem3l`, and `mpt-je6m7ru6` are set `is_active=false, is_default=false` by the seed's `RETIRED_BUSINESS_AUDIT_IDS` pass — the business_analysis job now has exactly ONE live template (`mpt-seed-seek-001`), matching the single-template convention of cat-id/discovery/establishment. Retired rather than deleted because `mkt_executions_list.template_id` references them (FK NoAction) and past executions keep `template_body_snapshot`. Their bodies carried heavy duplication damage (schema keys ×16–29, 12×/13× repeated sentences, ~28 trailing seed comments) and their "variant" differentiation had converged to nominal anyway — the default's canonical asset now surpasses both. Their transform functions remain in the seed file for reference but are no longer invoked. To revive one, reactivate in DB AND remove its id from `RETIRED_BUSINESS_AUDIT_IDS` (otherwise the next seed run re-retires it).

### Related-category chips hot-link on both public surfaces (added 2026-09-24)

Both category surfaces resolve enrichment taxonomy labels to hot links: `/place/category/[slug]` uses `ShelfChip` + `resolveShelfForLabel` (market-aware shelf index from `/api/public/directory/places`), and `/directory/categories/[slug]` (`CategoryViewClient`) uses `DirectoryShelfChip` + `resolveDirectoryShelfForLabel` (`apps/web/src/lib/directory-shelves.ts` — same trimmed/lowercase exact-name match + `storeCount > 0` gate, href `/directory/categories/{slug}`).

**Test-data hygiene (learned 2026-09-25):** run category/profile experiments against `local` only — the supplement union means a test artifact seeded into prd (`auto_repair_us`, a hand-seeded profile-repair test profile for the auto-repair niche) lands in every live enrichment prompt's ENRICHED CATEGORIES list. Production rows only for genuine production categories. A stale profile id can also shadow a future real establishment run for the same `category_key`.

All four related-category fields render as chips in the same order on both surfaces — `sub_categories` ("Browse … by Type"), `adjacent_categories` ("Related Categories"), `secondary_categories` ("Also Filed Under", from `effective.secondaryCategories`), `super_categories` ("Broader Categories", from `context.super_categories`).

Location pages do the same for the packet's category fields: `/place/city/[citySlug]` (`PlaceCityHero` + `PlaceCityEnrichmentContent`, server-rendered — `page.tsx` fetches `getCategories()` and passes `shelfIndex`, optional prop defaulting to `[]` so legacy/test renders degrade to inert chips) hot-links `topCategories` and `area_breakdown[].strong_categories` with market-scoped hrefs; `/directory/location/[location]` (`page.tsx`, server-rendered — fetches `getDirectoryMVCategories()` inline) hot-links the same two fields against the MV index.

Two directory-surface specifics:

- **Shelf index:** `getDirectoryMVCategories()` → `GET /api/directory/mv/categories` — `platform_categories` INNER JOINed to `directory_listings_list` counts, so it only ever carries shelves holding ≥1 published listing (hotness is structural). Entries are `{name, slug, storeCount}`.
- **Page keying:** the directory category page itself is `platform_categories`-keyed — its store list comes from `GET /api/directory/mv/categories/:idOrSlug` (resolves `pc.id OR pc.slug`, listings matched on `dll.primary_category = pc.name OR pc.name = ANY(dll.secondary_categories)`), so platform-category slugs are always valid link targets.

### Intelligence profile view dispatch (3 shapes, 2 surfaces)

`configuration_json` has three shapes and each needs its own view — a mismatch renders a header-only shell:

| Shape | Detection | View |
|---|---|---|
| `gold_standard_scan` (`expected_fields`, `candidates`) | `isGoldStandardProfile` (colocated in `GoldStandardProfileView.tsx`) | `GoldStandardProfileView` |
| `bronze_standard_scan` (`reason_coverage`, `catalog_snapshot`, `vector_execution_log`, `scope_mix`) | `isBronzeStandardProfile` (`apps/web/src/lib/bronze-standard-profile.ts`) | `BronzeStandardProfileView` |
| §10 Category Intelligence Profile (`terminology`, `specialized_sources`, `category_signals`) | fallback | `CategoryProfileView` |

Both surfaces must dispatch: `IntelligenceProfilesClient` (View modal) and `IntelligenceEstablishmentPanel` (campaign Overview tab). The panel renders `activeProfile ?? bestMatchingDraft` — a draft shows as a labeled preview, so an establishment campaign's overview renders the scan output **before** activation too.

### Bronze discovery — reason-slot fill pattern (added 2026-09-23)

Bronze discovery campaigns (`scope=intelligence`, `focus=bronze_standards`, `kind=discovery`) mirror gold discovery: the ACTIVE profile owns a slot board of per-reason exemplar slots (cap 2, `MAX_SLOTS_PER_REASON`), and the imported city scan's draft is the candidate pool. `BronzeStandardDiscoveryPanel` renders on the campaign Overview tab (after the establishment branch in `CampaignDetailClient`) — the slot board, discovered candidates (`bronzeDiscoveryFillCandidates` in `lib/bronze-standard-profile.ts` diffs draft vs active on name+address), and click-to-fill/remove.

Fill/unfill commit DIRECTLY to the active profile — retire old active + new active version in one transaction, one version bump per action, mirroring `addGoldStandardCandidate`/`removeGoldStandardCandidate`. Endpoints: `POST/DELETE /intelligence-profiles/:id/bronze-slots` → `IntelligenceProfileService.addBronzeReasonFill`/`removeBronzeReasonFill`. Distinct from the draft-gated `POST /:id/bronze-fill` (§7.3 out-of-loop writes). Removing a reason's last slot reverts the entry to `empty_unproven`. With no active profile the imported draft shows as proposed coverage — activating it establishes the board.

The **discovery prompt itself is slot-fill framed** (seed `seed-bronze-standard-scan-template.ts`, re-run after edits): the injected `serializeBronzeStandard(profile, 'establishment_reference')` block renders a `Slot board:` summary plus per-reason occupancy headers (`[reason_key] n/2 filled — AT CAP | — N slot(s) open`, occupants indented below) and an `--- Empty Slots — Hunt Targets ---` report — NOT the old flat `[key] name` lines (a test asserting `'[key] Name [scope: …]'` was updated for the header-line format). The directive tells the model to carry filled occupants verbatim (preserve `discovered_by`) and hunt only open capacity — with two carve-outs: (1) when the injected profile's scope is NOT the scan's market (national/other-market cascade), filled slots are proof-of-reason, never occupants to copy (an out-of-market business can't fill a market slot); (2) incidental qualifying finds for an already-full reason ARE reported — appended after carried occupants as reserve candidates (the draft's `slots` array has no schema max; the 2-cap applies to the committed board, and the panel renders overflow finds as `slotFull` candidates).

### Bronze catalog snapshot — DB truth, not the model's echo

A bronze profile's `catalog_snapshot` is documented as a verbatim embedding of the scope-applicable catalog rows (§4), but the model re-echoes ~17 rows by hand and **the injected block is its only source**. Two consequences to keep in mind when touching either side:

- `BronzeReasonCatalogService.serializeCatalogBlock` must emit each reason's `Scope:` line (`formatBronzeReasonScope`) — without it the model can only fill `scope_*` with nulls, so a category-scoped reason (`trade_manifest_only`, `wholesale_or_hybrid_role` in migration 291) comes back reading as `universal` and `scope_mix` is wrong. The block is injected at render time, so fixing it needs **no seed re-run**.
- The bronze import hook (`MarketingPromptService`, `schemaName === 'bronze_standard_scan'`) rebuilds `catalog_snapshot` + `scope_mix` + `catalog_revision` from `mkt_bronze_reason_catalog` via `buildBronzeCatalogSnapshot(applicableReasons(scope))` whenever the payload carried a snapshot. `scope_mix` counts by geographic level AND counts platform-scoped reasons separately in `platform_bound` (independent axis, §3.6.5) — a platform-only reason is `universal` + `platform_bound`.

Live profiles scanned before this fix keep the all-`universal` snapshot; the next establishment scan re-imports a correct one (no backfill script).

### Bronze scans — catchment footprint + cascading national proof (added 2026-09-22)

Two behaviors widen what a city bronze scan covers and what context it sees:

- **Catchment footprint.** Bronze scans (stage-1 market-scoped establishment, stage-2 standalone city scan, and the folded city scan inside emerging establishment) inject the same `GEOGRAPHY GRID` retail-catchment block stage-3 discovery uses — campaign `intelligence_zip_codes` / `intelligence_search_radius_miles` > `mkt_geography_grids` cache > AI derivation. `renderBronzeRegionDirective`'s coverage boundary is the **catchment**, not the administrative city line, so a state-line-split metro (Kansas City, MO/KS) fills slots on both sides. The profile still anchors to campaign `city`/`state` (resolution + catalog-predicate key); fills record their real municipality via `observed_city`/`observed_state` on the slot schema. Location-scoped catalog rows remain anchor-bound — the `applicableReasons` predicate was not widened to catchment municipalities.
- **Cascading national proof.** When `resolveBronzeStandard` returns a market-scoped profile (city/state set), `resolveBronzeNationalProofBlock` also resolves the nationwide row and injects `serializeBronzeStandard(profile, 'national_proof')` — a compact proven/unproven record (one exemplar name per reason, no vector log, no drift expansion). It grounds `empty_proven_elsewhere` classification and exemplar evidence depth that a thin city profile can't supply. Skipped when the resolved profile IS national or no distinct national row exists. Applies at all three bronze injection sites: stage-2 standalone, stage-3 emerging calibration, and the folded city scan.
- **Reason-pattern digest (stage-3 calibration).** The `discovery` role block emits a `--- Reason Patterns (hunt instruments) ---` digest — one `[reason_key] label — vectors: … — signals: …` line per catalog_snapshot row — because the `bronze_attribution` directive asks the analyst to credit expected_vectors it otherwise cannot see (the snapshot's full definitions are only emitted in `establishment_reference`). Profiles without a snapshot carry no digest; exemplar `discovered_via` + the vector log still carry partial signal.

### Bronze consumer write-back — attribution is the fill gate (added 2026-09-22)

`importExternalResult` (`MarketingPromptService`) has two post-import hooks that extend §7.3's out-of-loop fill path to bronze's consumers — the establishment scan may miss a business its consumers reach:

- **Discovery lane (§7.4):** `intelligence_discovery` imports write each attributed candidate's reasons to the market's resolved bronze profile as `discovered_by: 'emerging_scan'|'competitive_scan'` slots — confirmatory, dropped on re-scan unless re-found. Only in-market, non-`benchmark_only` candidates write; one new draft version per import via `IntelligenceProfileService.recordBronzeExternalFills` (batch — N fills produce ONE draft).
- **Audit lane (§7.3):** a `business_analysis` import on a campaign carrying `discovery_context.bronze_attribution` writes `business_audit` slots — but ONLY when the audit confirms low digital quality (≥1 failed `non_negotiable` quality gate, or a `non_negotiable` gap when gate results are absent). These are ground truth and survive re-scans via `mergeBronzeCoverage`.

No active bronze profile at the campaign's scope → fills are noted, not written (never fabricate a profile). Un-attributed candidates never write — attribution must be causal, not resemblance. `POST /intelligence-profiles/:id/bronze-fill` remains restricted to operator/audit provenance.

**Vocabulary suggestions ride the same draft.** `recordBronzeExternalFills` accepts `extras.suggestedReasons`/`suggestedSignals` and merges them into the draft's `suggested_reasons`/`suggested_signals` config keys (deduped by key, `seen_count` bumped on recurrence). Three channels feed it: the scan's explicit `suggested_reasons`/`suggested_signals` top-level arrays (same shape as `bronze_standard_scan`'s suggestion contract — a `bronze_attribution` reason_key must be verbatim from the injected catalog block; anything else goes in `suggested_reasons`), dropped fills whose `reason_key` isn't on the profile board become `source: 'unmatched_attribution'` suggestions, and non-registry `INT_*` codes in `discovery_signals` are swept into `source: 'unmatched_signal'` suggestions. `mkt_signal_registry` IS the signal catalog — no second table; a suggestion never evaluates in triage until an operator registers it from the overview ("Suggested Discovery Signals" section in `BronzeStandardProfileView` → `POST /signals`).

**Registered signals enter triage pre-wired (migration 308).** `mkt_signal_registry` carries `primary_playbook`/`secondary_playbook` (playbook codes, nullable) so a promoted signal is plug-and-play — no `matching_rules` edit required:

- `primary_playbook` — at evaluation time `applySignalPlaybookPreferences` (TriageEngineService) appends the detected signal to that playbook's `any` evidence pool. The playbook's own `all`/`none`/`dual` guards still apply — a preference adds evidence, never bypasses a veto. Only non-empty `any` clauses are augmented: injecting into an empty `any` would make the signal a hard requirement and hijack conjunctive playbooks (dual-only PB-05, empty-rules fallbacks). A preference-driven match discloses itself in `triage_reasoning` ("registry-wired signal(s) … via primary_playbook preference").
- `secondary_playbook` — the declared fallback. When NO playbook's rules match, `preferenceFallbackRecommendation` routes to the highest-weighted declared target (primary weight 2, secondary 1; ties → priority_rank) instead of blind PB-03. Eligibility: target is active + in the evaluated set, its `none` guard passes, and it has no `all`/`dual` conjunction a lone signal can't satisfy.
- Both playbooks are validated to exist in `mkt_playbook_catalog` on create/update (existence, not activity — an inactive-but-real playbook is a valid pref; the engine's is_active gate applies at eval). Primary ≠ secondary enforced against the effective pair.
- Discovery scans see a `TRIAGE PLAYBOOK ROSTER` block (active playbooks, proving_ground excluded) injected at render time so `suggested_signals[].primary_playbook`/`secondary_playbook` proposals name real codes; the register modal pre-fills them only when they match the live roster.

## Railway Builds & Deploys (added 2026-09-30)

**`pnpm checkapi` does not typecheck what the image build typechecks.** `pnpm checkapi` runs `tsc --noEmit --project apps/api` → `apps/api/tsconfig.json` (**strict**). The image build runs `tsc -p tsconfig.build.json --skipLibCheck` (inside `apps/api/build-with-selective-errors.js`) → `apps/api/tsconfig.build.json`, which *extends* the strict config and turns strictness **off** (`strict: false`, `strictNullChecks: false`, `noUncheckedIndexedAccess: false`, …) plus excludes a few paths. The two disagree, and only the build's config gates the image: on 2026-09-30 the strict check reported **0 errors** while the build reported **41**. Reproduce the build's view with `node scripts/tsc-check.js --noEmit -p apps/api/tsconfig.build.json --skipLibCheck` — the wrapper adds `--max-old-space-size=8192` (the Dockerfile sets `NODE_OPTIONS` to the same). Running tsc directly without it OOMs at ~4 GB with **empty stdout**, which is why a bare `pnpm build` locally can print `Total errors: 0` — that's the OOM, not a clean build.

**`?? {}` is only harmful with `strictNullChecks` off.** Under strict null checks TS knows a required field can't be nullish and types `a ?? b` as just `typeof a`. With the flag off it types the expression `A | B`, so a `?? {}` guard on a **required** schema field silently widens the value to `A | {}` — two failure modes, both fixed 2026-09-30 in `ProspectReportService` (28 errors → 0): `keyof (A | {})` = `keyof A & keyof {}` = **`never`** (7 × TS2322 `Type 'string' is not assignable to type 'never'` in `buildCtaChapter`'s `flags` array, typed `key: keyof typeof site`), and property reads narrow to the `{}` member (21 × TS2339 `Property 'x' does not exist on type '{}'`). Dropping `?? {}` on a required field is behavior-preserving — `schema.parse` already throws when it's absent. Three sites, all required in their schema: `audit.website ?? {}` (×2 — `buildCtaChapter` + `buildProductsChapter`) and `audit.data_quality ?? {}` (in `buildChapterDataQuality`'s `business_analysis` branch). **Do not apply the same deletion to `pitch-renderer.ts`'s `reviewPairs[0] ?? {}`** — `noUncheckedIndexedAccess` is off so TS types the element as non-nullable, but an empty array really is `undefined` at runtime; that guard is load-bearing, and the fix there is to annotate the fallback, not delete it.

**The build ships the image with type errors.** `apps/api`'s `pnpm build` = `prisma generate` + the tsc above, and never fails on type errors: `build-with-selective-errors.js` sorts tsc output into `SAFE_ERROR_PATTERNS` (property-access / Prisma-model / object-literal-shape — "handled by middleware"), `CRITICAL_ERROR_PATTERNS` (syntax, missing module/export, arity — these `exit 1`), and everything else is printed as `UNKNOWN ERRORS` then ignored anyway (`exit 0`). So `Critical errors: 0` in a green build is normal, and the `UNKNOWN ERRORS` block is the one worth reading. After the 2026-09-30 fix the count is **41 → 13**, all 13 safe / 0 unknown: `directory-featured-stats.ts` (6), `pitch-renderer.ts` (5), `quality-gate.ts` (1, `never` narrowing), `cache-service.ts` (1).

**`failed to fetch snapshot` on a Metal builder is Railway-side infra, not the repo.** The builder failed to pull the uploaded snapshot back out of Railway's object store — after upload succeeded, before any build step ran. The tell is the same failure across *different* builders in one deploy (`builder-idcuaf` → `builder-fgbbwa` → `builder-puswxg` → `builder-zhsogp`); a repo/config problem fails consistently on one builder and succeeds on another. Railway staff confirm it is transient build infrastructure and warn that **redeploys compound the queue** — cancel queued builds and retry once rather than looping. Staging succeeding while production fails is expected (builder assignment is per-deploy), not evidence of a repo difference; the 2026-09-30 outage cleared with no repo change.

**Three ignore scopes, easy to conflate.** `.railwayignore` is documented for `railway up` only (`docs.railway.com/cli/up`: it respects `.gitignore` + `.railwayignore` and always skips `.git`/`node_modules`) — it does not govern the snapshot of a GitHub-connected service. `.dockerignore` (root) trims the Docker **build context**, i.e. what `COPY . .` sees, which happens *after* the snapshot is uploaded. Neither is the snapshot the Metal builder fetches. Commit `c7c940ee3` ("Slim Railway build context") touched the latter two and neither caused nor fixed the outage.

**Tip cleanup ≠ smaller clone.** `c7c940ee3` untracked ~175 MB (`scripts/storage_migration/supabase` 91.9 MB, `scripts/migration_exports/data/audit_log.csv` 65.4 MB, + 3 more CSVs) and took the HEAD tree from ~275 MB to 99.8 MB — but `git count-objects` still reports `size-pack: 126.65 MiB`, since deleting from the tip doesn't drop blobs. Whether that still matters depends on how Railway sources the repo (commit tree/archive vs full clone); the deploy log prints a byte size next to `fetching snapshot` (single-digit MB ⇒ the tip is what counts; ~100 MB+ ⇒ history is). None of the 2026-09-30 logs printed it, so this is **unresolved**; `git filter-repo` is the remaining lever and is pointless if Railway shallow-clones.

## Fly Deploys — serialize with the GitHub Actions (added 2026-10-23)

**The optimal pattern:** commit + push to both `staging` and `main` → wait for the GitHub Action deploys to finish (up to ~15 min) → then run `pnpm deployapi:promote`. Both `deploy-staging.yml` (push→staging) and `deploy-production.yml` (push→main) run a full API `fly deploy` themselves — they compile on the 16 GB runner and ship `dist/` — so a local `deployapi:promote` fired while an Action run is in flight races it for the machine lease and dies with `failed to get lease on VM <id>: … lease currently held by …@tokens.fly.io` (observed 2026-10-23: both machines failed lease acquisition mid-rolling-update; retry after the Action finished cleared the leases and rolled cleanly). The workflows serialize *themselves* via `concurrency: fly-deploy-staging|production` — the only conflict is a local deploy racing a workflow run. A stale lease also self-clears at its `expires at` timestamp, so a plain retry after a few minutes is the recovery path, not `fly machines` surgery.

## Seed Scripts — Re-run Discipline

Seed scripts in `apps/api/src/scripts/seed-*.ts` are idempotent (update-in-place) but are **not** run automatically. After editing any seed file, you MUST re-run it against both `local` and `prd` Doppler configs, or the DB row will be stale and the rendered prompt will silently use the old body.

**Run from `apps/api`:**
```powershell
# Intelligence cluster (has package.json script entries)
doppler run --config local -- pnpm seed:intelligence-fragments
doppler run --config local -- pnpm seed:intelligence-discovery-templates
doppler run --config local -- pnpm seed:intelligence-discovery-signals
doppler run --config local -- pnpm seed:intelligence-profile-establishment-template
doppler run --config local -- pnpm seed:intelligence-profile-auto-repair

# Directory enrichment templates — category/location/category-set packet bodies,
# including the national ('__all__') variants consumed by national enrichment +
# discovery framing.
doppler run --config local -- pnpm seed:directory-enrichment-templates

# Profile repair + marketing ops + gold standard (use npx tsx directly)
doppler run --config local -- npx tsx src/scripts/seed-profile-repair-signals.ts
doppler run --config local -- npx tsx src/scripts/seed-profile-repair-issue-briefings.ts
doppler run --config local -- npx tsx src/scripts/seed-profile-repair-triage-briefing.ts
doppler run --config local -- npx tsx src/scripts/seed-marketing-ops-templates.ts
doppler run --config local -- npx tsx src/scripts/seed-gold-standard-scan-template.ts

# Deliverable source material (spec: docs/LocalBiz/marketing_ops_deliverable_source_material_spec.md)
# Seeds 7 prompt templates: mpt-review-intake, mpt-deliverable-source-material,
# mpt-seed-fulfill-004..008. Data-only — NO migration. Bump SEED_VERSION_MARKER
# in the script to force a body re-sync.
doppler run --config local -- npx tsx src/scripts/seed-deliverable-source-material-templates.ts

# Deliverable layout templates (G-8) — one default jsPDF layout_spec per
# deliverable type in mkt_deliverable_templates_list, so the Generate
# Deliverable modal's Template dropdown has a designed layout per type.
doppler run --config local -- npx tsx src/scripts/seed-deliverable-layout-templates.ts

# Business Audit V2 (Category-Integrated mpt-j9bbem3l + Signal-Aligned mpt-6oeuiizo)
# — wires Category Intelligence + Gold Standard + Website Accessibility Verification
#   directive into both variants. Bump SEED_VERSION_MARKER in the script to re-apply.
doppler run --config local -- npx tsx src/scripts/seed-business-audit-v2-templates.ts

# Website Positioning audit template (PB-08 / A7 website gap, spec:
# docs/LocalBiz/WEBSITE_GAP_AUDIT_PLAYBOOK_SPEC.md) — seeds the
# platform='website_positioning' audit template row.
doppler run --config local -- npx tsx src/scripts/seed-website-positioning-audit-template.ts
```
Repeat each command with `--config prd` for production.

**Verify after re-running:** query the live DB (or regenerate the `docs/api-response/seek-prompt-templates.md` dump) and confirm each template's `updated_at` is newer than the seed file's last git commit. A stale `updated_at` means the seed was not re-run after an edit.

**Idempotency check pattern:** seed scripts must check for the **presence of the new marker** (e.g. `BRIEFING_MARKER`), NOT the absence of an old section (e.g. `!body.includes('## Output')`). The absence-of-old pattern is unsafe because old bodies may never have had the old section either, causing the seed to skip every time.

**Two subtler failure modes (bit us 2026-09-14, seed-business-audit-v2-templates):**
- **`insertAfter` fingerprints only the first 80 chars of the insertion.** Never combine multiple bindings into one `insertAfter` call — if the first chunk is already present, the whole insertion is skipped and the later chunks are silently dropped while the version marker still gets appended.
- **`removeSection` deletes up to the next `##`/`###` heading and swallows headingless content.** A binding inserted between a removable directive and the next heading gets eaten on the next run. Insert headingless bindings (e.g. `MARKET_CONTEXT_BINDING`) AFTER all `removeSection` calls in the transform so each run self-heals.

**Third failure mode (bit us 2026-09-20, same seed): the two V2 variants use DIFFERENT signal-list formats.** `mpt-6oeuiizo` (Signal-Aligned) uses markdown bullets — `` * `WC_BROKEN_WEBSITE`: ... `` — while `mpt-j9bbem3l` (Category-Integrated / "Cohesive") uses plain lines — `WC_BROKEN_WEBSITE: ...` (no bullet, no backticks). A transform that anchors on only one form **throws** `Anchor not found` on the other (and the whole template update is aborted). Two lessons:
- An `insertAfter` anchor that may be absent must be guarded (`if (out.includes(anchor))`) or replaced with a format-aware helper. `replaceFirst` no-ops silently when the `from` is missing; `insertAfter` throws — so a pre-existing silent no-op can become a hard failure the moment you add an `insertAfter` on the same anchor.
- When amending a signal-definition list, handle BOTH formats (`broadenWcBrokenWebsite` / `appendWebsiteGapDefinitions` in the seed are the reference pattern).

## Business Audit — Platform Availability Control (render controls)

Spec: `docs/LocalBiz/AUDIT_PLATFORM_AVAILABILITY_CONTROL_SPEC.md` (status block is current as of 2026-09-18).

The audit could not previously distinguish "this business is not discoverable on Google" from "the analyst could not render Google" — both produced `unable_to_verify`, emitted no signal, and scored zero, so unverifiability was scored as health. A **render control** (a gold-standard exemplar on the same platform) makes the failure attributable. `signal-extractor.ts` fires `DS_MISSING_PROFILE` only on a `business_specific_failure` determination, falling back to the legacy `!google` rule when `render_controls` is absent.

**Scoring amendments (shipped 2026-09-18):**
- `action_classification` is `nullable().optional()` — the model emits `null` (not `BALANCED_HEALTHY`) when no rating/sentiment could be verified.
- `recommended_tier` is `tierEnum.nullable().optional()`. `applyRenderControlCoverageGate()` (in `business-analysis.schema.ts`) computes `controls_rendered / controls_attempted` from `render_controls`, and when the rate is below `MIN_RENDER_CONTROL_COVERAGE_FOR_TIER` (0.5) it nulls the tier, deletes `estimated_monthly_service_fee`, and stamps `render_control_coverage`. Audits with no `render_controls` are untouched (legacy behaviour preserved).
- **Apply the gate in the import path, not the validator.** `MarketingPromptService.importExternalResult` persists the **raw** parsed JSON (`audit_data: parsedJson`), not the Zod output — a Zod `.transform()` would never reach the stored audit.
- `google_profile_maintenance` rubric split: control-confirmed absence scores 2; verified-maintained scores 0; `unable_to_verify` is excluded from the denominator rather than scored 0.

**Prompt amendments** (all in `seed-business-audit-v2-templates.ts`, each its own fingerprint-safe `insertAfter`/`replaceFirst`, marker `business-audit-v2-2026-09-18-availability-scoring-4`): rubric split, `PLATFORM_GAP_CASCADE_DIRECTIVE` (one `profile_presence` gap + one gate entry per non_negotiable gate — no per-field fan-out), `ACTION_CLASSIFICATION_NULL_DIRECTIVE`, `PLATFORM_SYNDICATION_CLAUSE` (a platform captured via a syndication path is `partial`, not `unable_to_verify`), `DATA_QUALITY_CONFLICTS_CLAUSE` (`conflicts` is for conflicting evidence about the business, not prompt-block provenance).

**Audit card:** `BusinessAnalysisAuditCard.tsx` renders a "Platform Availability (render control)" section + coverage badge, and shows "Tier suppressed" instead of a bare tier when the gate fired.

**Interactive verification (spec §12, shipped 2026-09-19):** an optional caller-supplied `interactive_verification` variable puts the external analyst on notice that an operator is attending the run and may be asked to render blocked platforms (Facebook/Yelp login walls) and paste back observables. `interactive-verification-directive.ts` (services root — universal, scope-agnostic) exports the directive + `buildInteractiveVerificationPreamble`; `resolvePrompt` prefixes it onto `baseRendered` AND the composed-path `rendered` — the only two render sites. The variable is **never body-declared**, so no `SCOPE_VARIABLES` entries and no seed changes are needed; blank/`'off'` is byte-identical to a solo run. Opt-in UI is the "Interactive verification — operator present" checkbox in the Prompt Workspace Variables panel (+ `operator_observations` textarea for the re-render path). New render surfaces that bypass `resolvePrompt` must prefix `buildInteractiveVerificationPreamble(variables)` themselves — fulfill-type paths (recovery resolution, openers, deliverables, bronze test-scan) intentionally skip it since they don't browse platforms.

**Operator profile evidence file (added 2026-09-29; NOT-IN-FILE rule added 2026-11, v3; HIDDEN≠MISSING rule v4):** a second caller-supplied variable, `operator_profile_evidence_file`, carries a workstation path to an operator-prepared markdown/text file containing page copies of the prospect's directory profiles (Google/Yelp/Facebook — profile fields + review text). `operator-profile-evidence-directive.ts` exports `buildOperatorProfileEvidencePreamble` + `OPERATOR_PROFILE_EVIDENCE_DIRECTIVE_VERSION`; `resolvePrompt` concatenates it with `interactivePreamble` into `runPreamble`, prefixed at the same two render sites (`baseRendered` + composed-path `rendered`). The block carries READ-FIRST framing (file is the intended primary evidence source for the profiles it covers — sidesteps login walls, feeds sentiment/narrative fields), the **NOT IN FILE = MISSING rule** (the operator's capture sweep substitutes for the live-render attempt: a platform profile the audit is expected to verify that is absent from the file is recorded `business_specific_failure` / verified absent + the missing-profile signal — NOT `unable_to_verify`; bounded to the audit's verification scope, never extended to the open web), provenance rules (operator-supplied, `attempted_by: operator`, `visibility_condition: unknown` when unstated), a live-render-wins conflict rule, and a never-block fallback (absent/unreadable file or no file access → solo run). Same transport contract as `interactive_verification`: never body-declared, no whitelist/seed changes, blank = byte-identical. UI is the "Directory profile evidence — operator file" input in the Variables panel, independent of the interactive toggle; it is cleared on campaign switch so a stale path can't point at the previous prospect's file.

## Diagnostic Gallery — Eligibility, Rendering & the `preview_built` Gate

Spec: `docs/LocalBiz/MARKETING_OPS_DIAGNOSTIC_GALLERY_SPEC.md`.

- **Storage:** diagnostic screenshots live in the private Supabase **`disputes`** bucket (`StorageBuckets.DISPUTES`), created by migration **299** (`INSERT INTO storage.buckets … ON CONFLICT DO NOTHING`). Service-role key bypasses RLS, so no storage policies are needed. A missing bucket surfaces as `500 upload_failed: Bucket not found`.
- **Admin read path:** `GET /api/admin/marketing-ops/:campaignId/files/diagnostic-screenshots` returns `signed_url` + `download_url` (5-min TTL). The web fallback degrades to `listFiles` if the endpoint 404s, so a web-before-API deploy does not break the tab.
- **Eligibility precheck:** `GET /api/admin/marketing-ops/campaigns/:id/gallery-eligibility` (`GalleryEligibilityService`) returns `{ eligible, reason, action, archetype, hasBusinessAnalysisAudit, hasAcceptedTriage, … }`. `reason` ∈ `invalid_stage | no_screenshots | no_business_analysis_audit | archetype_unresolved`. The Gallery tab shows an amber banner + disables Generate from this.
- **Archetype source:** the chain (openers, headers, closers, gallery defaults, deliverable sections) derives from an **operator-accepted triage** or a real (non-stub) `business_analysis` audit. Stub audits (`manual_queue` / `queue_promotion` / `derived_from_parent`) do **not** satisfy it.
- **Hard gate:** `POST /api/admin/marketing-ops/:id/transition` returns `409 business_analysis_required` when `to_stage === 'preview_built'` and no archetype resolves. There is **no acknowledge override** — `preview_built` has no back-edge to `seed` (`REVIEW_TRANSITIONS` is one-way), so entering it without an audit strands the campaign. Fix forward by running the seek-stage business analysis.
- **Stage is not editable via the generic update.** `PUT /api/admin/marketing-ops/:id` returns `400 stage_not_editable` if `stage` is present; the edit form's Stage field is read-only. Previously the field was accepted and then silently dropped by `updateCampaign`, making the dropdown a no-op.

## DB CHECK Constraints — Enum Sync Discipline

`mkt_prospect_queue` (and other mkt_* tables) carry Postgres CHECK constraints that are **not** managed by Prisma (schema.prisma is db-pulled and ignores them). When you add a value to an app-layer enum, you MUST also ship a numbered migration that drops + re-adds the CHECK with the full value set, or inserts with the new value fail with `23514 check constraint violated` (500 `internal_error` at runtime).

Known constraint ↔ enum pairs (drift history: migrations 256, 264, 270 — this has bitten three times):

- `chk_prospect_queue_source_kind` ↔ `ProspectSourceKind` in `MarketingProspectQueueService.ts` + `prospectQueueAddSchema` in `marketing-ops.ts`
- `chk_prospect_queue_status` ↔ `ProspectStatus` (same file)
- `chk_prospect_queue_source_scope` ↔ `ProspectCampaignScope` (same file)
- `directory_seed_outreach_touches_channel_check` ↔ seed-touch channels (`TouchChannel` in `ProvingGroundCadenceService.ts`, `DirectoryPresenceSeedService.ts`, `touchLogSchema` in `directory-presence-admin.ts`). Current set (migration 273): `call, email, sms, mail, form, referral, visit, other`.
- `directory_seed_outreach_touches_outcome_check` ↔ seed-touch outcomes (`TouchOutcome` in `ProvingGroundCadenceService.ts` + report-delivery outcomes in `SeedReportDeliveryService.ts`). Current set (migration 289): 262's set + `report_delivered, report_viewed, report_claimed, report_declined, claim_qr_generated`.

**Silent-drop hazard:** a writer whose value is not in the CHECK fails with `23514`, and if the insert sits inside a best-effort `try/catch` (e.g. `SeedReportDeliveryService.recordDeliveryEvent`), the row is silently dropped with only a `logger.error` — no test failure if the test only asserts SQL *text*. Migrations 259/262/273/289 fixed one such case. When touching a CHECK-guarded table, add a **constraint-parity test** that parses the effective CHECK value set from `database/migrations/*.sql` and asserts the writer's emitted values are members (pattern: `apps/api/src/services/__tests__/SeedReportDeliveryService.test.ts`). Note there is a decoy `apps/api/database/migrations` (13 unrelated legacy files) — resolve the real migrations dir by walking ancestors and picking the candidate with the most numbered files.

When adding an enum value, grep the table name for `chk_` constraints and sync every one the enum touches. Migrations are applied manually: `psql $DATABASE_URL -f database/migrations/<n>_<name>.sql` (Doppler-provided URL), against both `local` and `prd`.

**Migration SOP (team convention):** migrations are always applied **in tandem — staging + prod** — never one environment without the other. Source code and schema therefore travel separately: the DB is migrated when the work lands on `staging`, and the feature only becomes *reachable* once the code reaches `main` (which is what deploys prod). Consequences to design around:

- A DB-only defect (e.g. the `42804` text→date cast on `mkt_identity_evidence`, migration 297/298) is invisible until the endpoint exists in prod, so the **real-DB smoke check on a new table's write path is the guardrail** — not the mocked unit tests, and not `prisma db pull`.
- Never ship a numbered migration file without telling the user it needs the tandem run; a file committed but unapplied leaves `schema.prisma` (db-pulled) describing a table that does not exist.
- Because prod's schema can lead prod's code, additive-only migrations (nullable columns, new tables, `ADD COLUMN IF NOT EXISTS`) are the safe default — a destructive change would hit prod before any code depends on it.

## Seed Intelligence Report — Schema Additions (migrations 271–272)

Spec: `docs/LocalBiz/AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md`

- `271_directory_field_provenance_evidence_state.sql` — adds `evidence_state` (varchar 40, CHECK-constrained to the 9-state taxonomy) + `notes` (text) to `directory_field_provenance`. Backfills existing rows: `owner_confirmed` when `override_by IS NOT NULL`, else `observed`. Run against `local` + `prd`.
- `272_mkt_outreach_log_anchor_columns.sql` — adds `anchor_id` (varchar 255), `anchor_snapshot` (jsonb), `verification_results` (jsonb) to `mkt_outreach_log`. All nullable; existing rows unaffected. Run against `local` + `prd`.
- `273_mkt_seed_intelligence_reports.sql` — creates `mkt_seed_intelligence_reports` table for immutable versioned report snapshots (§12.2). `report_data` is the SeedIntelligenceReport DTO; `evidence_refs` references existing provenance/audit/signal/outreach/claim IDs (NOT a duplicate observation store). Run against `local` + `prd`.
- `274_mkt_outreach_anchors.sql` — creates `mkt_outreach_anchors` (§12.4): operator outreach theses scoped to `seed_id` / `campaign_id` / `business_prospect_id` (at least one required), lifecycle `draft → active → used → retired`. Anchor contact events snapshot the anchor into `mkt_outreach_log.anchor_snapshot` + `verification_results`; `fact_confirmed`/`fact_corrected` results also write `directory_seed_nap_verifications` rows (`owner_corrected` FALSE/TRUE respectively). Run against `local` + `prd`.
- `287_mkt_campaign_manual_scripts.sql` — creates `mkt_campaign_manual_scripts` for the openers workspace **Manual tab** (operator playground / producer lane; guide: `docs/LocalBiz/marketing_ops_manual_play_lane_guide.md`). `UNIQUE(campaign_id, template_key)` upsert semantics, `fields` jsonb + `script_body` merge-resolved at read by `ManualOutreachScriptService`, `promoted_opener_id`/`promoted_anchor_id`/`promoted_header_id`/`promoted_closer_id` stamp the shared pipeline rows each doc produced. **No CHECK constraints** — `template_key` is validated in code against `manual-play-templates.ts`; adding a template is a catalog-only change. Run against `local` + `prd` (applied).
- `288_mkt_manual_play_templates.sql` — creates `mkt_manual_play_templates` for operator-authored **Save-as-template** plays (spec: `docs/LocalBiz/MANUAL_PLAY_TEMPLATE_AUTHORING_SPEC.md`). `ManualOutreachScriptService` resolves templates catalog-first, DB-fallback (`resolveTemplate`); `listTemplatesForCampaign` merges `catalog ++ operator(active ∪ saved)`. **No CHECK constraints** — `anchor_type`/`status`/field roles validated in code. Keys are `op_<slug>` (immutable); DELETE is soft archive — docs under archived keys stay resolvable. `GET/POST /manual-script-templates`, `PUT/DELETE /manual-script-templates/:key`, plus `GET /:campaignId/manual-script-merge-context` (Construction Variables panel). Run against `local` + `prd`.
- `seed:intelligence-discovery-signals` — seeds the 11 `INT_*` discovery signal codes into `mkt_signal_registry` as a new `INT` family. Idempotent update-in-place. Run against `local` + `prd`:
  ```powershell
  doppler run --config local -- pnpm seed:intelligence-discovery-signals
  doppler run --config prd --    pnpm seed:intelligence-discovery-signals
  ```
  Bump `SEED_VERSION_MARKER` in `src/scripts/seed-intelligence-discovery-signals.ts` to force label/description re-sync on already-registered rows.

Report pipeline notes:
- **Shared prompt directives (§6.1, §6.10)** live in `apps/api/src/services/intelligence/report-directives.ts` and are composed ONCE by `PromptComposerService.composeIntelligencePrompt` — never copy them into fragment bodies or seed transforms. Bump `REPORT_DIRECTIVES_VERSION` on text changes.
- **Report generation:** `SeedIntelligenceReportService.refreshReport(seedId)` builds from `SeedReportEvidenceService.buildSubstrateEvidence` (legacy seeds need no prompt output) and is idempotent via an `evidence_snapshot_hash` in `generated_from`. Triggered best-effort after anchor verification results, claim completion (both claim paths), and owner NAP corrections. Admin: `POST .../presence-seeds/:id/report/refresh`, `GET .../report/versions`, `GET .../report-pdf?version=`.
- **Claim-token minting is publish-gated (added 2026-09-29):** `dps.status='invited'` means "a live claim token exists" — minting must never fire on a draft. The §13.5 claim handoff in `SeedIntelligenceReportService.buildReport` and `DeliverableSourceService.ensureClaimUrl` only mint when `dps.status IN ('published','invited')`; a draft seed (Push/park creates `status='draft'` + `is_published=false`, so `/place/{slug}` 404s until the operator publishes) stays draft. The mint's home is the publish boundary: `SeedOutreachTriggerService.onSeedCreated` mints when courtesy outreach resolves no active claim URL, landing the seed in 'invited' at the moment a claim link actually goes out.
- **Report enrichment (audit fragments):** `SeedReportEvidenceService.getSeedReportContext(seedId, dims)` resolves the seed's linked campaign (`directory_seed_campaign_links` primary-first → `mkt_campaigns_list.discovery_context` → latest `business_analysis` + `category_identification` audits) plus `MarketContextLoader` enrichment. It feeds: `narrative` (Tier-C `public_narrative` + location `market_summary` / `metro_context` / `notable_areas` — the descriptive location fragments only; `market_gaps` / `metro_dynamics` / `city_profile` stay paid-side), `market_classification.category_profile_context`/`operational_signals`/`recommended_categories` (category enrichment + the audit's `candidate_categories` minus the resolved category), `source_summary.discovery_attribution` (`discovery_context.bronze_attribution`, queue `business_snapshot` fallback — each entry's `label` is resolved from `mkt_bronze_reason_catalog` so the report shows "Trade / import-only visibility", never a raw `reason_key`; renderers prefer `label`, then `basis`, then a humanized key), and `platform_presence` (BA `platforms` + cat-id `digital_footprint.platforms_found`; `unable_to_verify` is skipped — never an absence finding). `source_summary.source_types[].label` is a business-facing name via `sourceDisplayLabel` (`business_analysis_audit` → "Business presence review") — internal source keys never render raw. All narrative fields pass `vetReportText` (lintNarrativeText + peer-language guard) at build time — unsafe copy is dropped, never lint-blocking. Tone contract (enrichment seed V12): `context.market_summary` / `metro_context` / `category_summary` / `category_signals` are declared shopper-facing in the template TONE sections — existing enrichment rows keep pre-V12 register until the next enrichment run. The context rides `NormalizedEvidence.report_context` and is inside the `evidence_snapshot_hash` (`substrate_template: 'substrate-2'`), so a new audit/enrichment run produces a new report version. Free/paid split: the seed report carries context + presence only — `market_opportunities`/`gap_analysis`/`signal_checklist`/`recommended_services`/`competitive_weaknesses` stay behind `MarketIntelAccessService.canAccessFull` (paid or claimed-owner via `recordUnlock('owner_claim')`).
- **Public surface:** `GET /api/public/marketing/seed/:seedId/report` (+ `/preview`, `/report/pdf`); claimed-owner: `GET /api/customer/marketing/seed/:seedId/report` (verifies approved `directory_claim_requests` row).
- **§13.4:** `POST /api/admin/marketing-ops/:id/outreach` accepts `anchor_id` + `verification_results` — validated before the log row is created, then `attachAnchorToOutreachLog` back-fills snapshot + seed touch + NAP write-back + report refresh.
- **Connected-contact gate (§20.4):** `fact_confirmed`/`fact_corrected` only write NAP verification rows when `callResult` is a connected outcome; no-answer/voicemail/wrong-number cannot produce verified facts.
- **Identity-sync contract (Report QR Kit staleness fix):** `business_identity` is rendered from the resolved record (`getResolvedSeedState` LEFT JOINs `directory_listings_list` for name/address/phone/website/email/owner_name) PLUS `directory_field_provenance` — NOT from `dps`/seed columns alone, and the resolved identity fields are inside the `evidence_snapshot_hash` (`substrate-3`), so any identity write path that (a) changes `directory_listings_list` or (b) writes provenance produces a new version on refresh. Every identity mutation edge is expected to fire a best-effort `SeedIntelligenceReportService.refreshReport` AND leave provenance current: `updateFields` auto-upserts `operator_override` provenance for changed NAP/category fields the caller didn't already supply (caller rows win by field_key) and refreshes for ALL seed statuses (was claimed-only); `resolveCampaignVerification` and `ManualOutreachAnchorService.writeOwnerField` mirror corrected values to `dps`/`tenants`/`tenant_business_profiles_list` in addition to the listing + provenance + refresh; `DirectorySeedCampaignLinkService.syncFromCampaign` refreshes after projecting campaign fields. New write paths to `directory_listings_list`/seed identity must follow the same pattern or the minted report goes stale.

After applying migrations 271–272, run `pnpm prisma:generate` (or `doppler run --config local -- pnpm prisma db pull && pnpm prisma generate`) so the Prisma Client picks up the new columns.

## Directory Presence Traffic Surface (Layer 1 + 2)

Spec: `docs/LocalBiz/directory_presence_traffic_surface_sprint_plan.md`

Page-view traffic for `/place/[slug]` (unclaimed seeds) and `/directory/[slug]` (claimed tenants) is captured by `StoreViewTracker` into `user_behavior_simple` (`entity_type='store'`, `page_type='directory_detail'`, `entity_id=<tenantId>`).

- **Layer 1 readout:** `apps/api/src/services/DirectoryPresenceTrafficService.ts` aggregates those rows, scoped to seeds via join on `directory_presence_seeds.tenant_id`. Admin routes (in `directory-presence-admin.ts`, mount `/api/admin/directory-presence`): `GET /traffic` (cross-seed rollup) and `GET /presence-seeds/:id/traffic` (per-seed). Both require `requirePlatformStaff`.
- **Admin page:** `/settings/admin/directory/traffic` (`apps/web/src/app/(platform)/settings/admin/directory/traffic/page.tsx`). Card on `/settings/admin` ("Directory Traffic"), plus Directory Panel and admin-nav entries.
- **Layer 2 tagging:** `StoreViewTracker` accepts `listingOrigin` + `surface` props and stamps them into `context`. **Canonical vocabulary:**
  - `listing_origin` = `directory_seed` (`/place` layouts) | `claimed` (the four `/directory` layouts) — mirrors `directory_listings_list.listing_origin`.
  - `surface` = `place` (`/place`) | `directory` (`/directory`) — matches the `CategoryBrowseTracker` / `LocationBrowseTracker` vocabulary already in `context`.

  **Do NOT use the sprint spec's `surface: 'directory_seed' | 'directory_claimed'`** — it collides with the pre-existing ecosystem `surface` axis written into the same `user_behavior_simple.context` JSON. The readout exposes an optional `surface` filter (bound param) and always reports a `surfaceBreakdown` (untagged historical rows appear as `untagged`).
- **Migration `294_directory_presence_surface_vocabulary.sql`** — rewrites any rows written under the old spec vocabulary (`surface` `directory_seed`→`place`, `directory_claimed`→`directory`; `listing_origin` `directory_claimed`→`claimed`). Idempotent. Applied manually to `local` + `prd`.
- **Migration `295_directory_presence_events_surface_scope.sql`** — makes `directory_presence_events` surface-scoped: `tenant_id`/`listing_id` become NULLABLE and `surface` / `entity_ref` / `detail` are added (+ `idx_dpe_surface_created`). Entry events carry tenant+listing and `surface` ∈ `place_entry|directory_entry`; shelf events carry neither and `surface` ∈ `place_category|place_city|directory_category|directory_location|directory_store_type|directory_home`. Safe (table was empty). Idempotent.

**Directory surface taxonomy (`user_behavior_simple` — single source of truth):**

| Surface | Route | Tracker | `page_type` | `entity_type` | `entity_id` | `context.surface` |
|---|---|---|---|---|---|---|
| Seed entry | `/place/[slug]` | `StoreViewTracker` | `directory_detail` | `store` | `tenantId` | `place` |
| Claimed entry | `/directory/[slug]` | `StoreViewTracker` | `directory_detail` | `store` | `tenantId` | `directory` |
| Seed category shelf | `/place/category/[slug]` | `CategoryBrowseTracker` | `directory_category` | `category` | `place/category/<slug>` | `place` |
| Claimed category shelf | `/directory/categories/[slug]` | `CategoryBrowseTracker` | `directory_category` | `category` | `directory/categories/<slug>` | `directory` |
| Seed city shelf | `/place/city/[citySlug]` | `LocationBrowseTracker` | `directory_location` | `location` | `place/city/<slug>` | `place` |
| Claimed location shelf | `/directory/location/[location]` | `LocationBrowseTracker` | `directory_location` | `location` | `directory/location/<slug>` | `directory` |
| Store-type shelf | `/directory/stores/[storeTypeSlug]` | `StoreTypeViewClient` | `directory_store_type` | `category` | `<storeTypeSlug>` | `directory` |
| Directory home | `/directory` | `DirectoryClient` | `directory_home` | — | — | — |
| Directory search | `/directory` | `DirectoryClient` | `search_results` | `search` | — | — |

Rules:
- `context.surface` is **`place | directory`** (the ecosystem axis). Never `directory_seed` / `directory_claimed`.
- `context.listing_origin` is **`directory_seed | claimed`** — mirrors `directory_listings_list.listing_origin` (column default `claimed`).
- `entity_id` is a raw id for entries and a path for shelves — do not assume it is a tenant id.
- Entry CTA/engagement events live in `directory_presence_events` (Layer 3). **QR scans live in `qr_scan_events`** (redirect tracking is authoritative) — do not emit `qr_scanned` into `directory_presence_events`; that event type is reserved for forward compatibility only.
- The `Directory Traffic` readout shows entry rows (seed-joined) plus a **Shelf Traffic** table (`directory_category` / `directory_location` / `directory_store_type` / `directory_home`). Shelf rows are not seed-scoped, so the entry filters do not apply to them.
- **Shelf→entry attribution:** shelf cards append `?shelf=<surface>/<type>/<slug>` (e.g. `place/category/indian-grocery`, `directory/location/madison-wi`) to their entry links. `StoreViewTracker` reads the param and stamps `context.referrer_shelf` on the Layer 1 entry view; the readout exposes it as `shelfReferrals` (the **Referring Shelves** section). The `shelfRef` prop is threaded through `StoreCard` → `StoreList` → `DirectoryGrid`/`DirectoryList` and through `UnifiedStoreCard`; all are optional and default to `undefined` (no behavior change elsewhere). Attribution only applies to shelf→entry navigation captured after this shipped.
- **Entry source attribution:** `StoreViewTracker` also stamps `context.entry_source` from `?utm_source=` (verbatim) / `?source=` / `'shelf'` when `?shelf=` is present. Precedence: `utm_source` → `source` → `shelf` → absent. Known `?source=` values:
  - `qr` — a QR code printed for a listing encodes that listing's URL with `?source=qr`; the entry view is attributed to QR while the scan itself stays authoritative in `qr_scan_events`.
  - `related` (`RelatedStores`), `recent` (`LastViewed`), `recommendation` (`StoreTypeRecommendations` + the directory-home "Trending Nearby" list), `promoted` (`PromotedStoresCarousel`).
  - `search` — `/place/search` result cards.
  - `storefront` — storefront/product → directory links (`StorefrontHeader`, `StorefrontFooter`, `StorefrontClientWrapper`, `ProductHeaderSection`, `StorefrontActions`, `ProductNavigation`, `BackToInventoryButton`, `SmartProductCard`, `LocationAvailabilitySection`).

  These are **not shelf browse** — they emit no `shelf_viewed`/`listing_clicked` and do not affect shelf CTR; they only contribute an entry **source**. `UnifiedStoreCard` takes `sourceRef` for this (`RelatedStores`/`LastViewed` both render through it). The readout exposes `entrySources` (the **Entry Sources** section); organic/direct views are unattributed and not listed.
  - Caveat: param-based attribution is sticky — a reload/refresh keeps the query string, so the same view can be re-counted under the same source. Treat these as directional, not exact.
  - Known pre-existing bug (not fixed): `components/directory/DirectoryMap.tsx` writes `<a href="/directory/${listing.slug}">` as a **plain string** (not a template literal), so that legacy map renders a literal `${listing.slug}` URL. The live map is `DirectoryMapGoogle`.
- **Shelf engagement (Layer 3, migration 295):** shelves now emit engagement events too — `shelf_viewed`, `listing_clicked`, `filter_applied`, plus `session_heartbeat`/`session_end` for dwell. Capture is via `useDirectoryShelfTracking` (`apps/web/src/hooks/`), wired at the two existing browse trackers (`CategoryBrowseTracker` → `place_category`/`directory_category`; `LocationBrowseTracker` → `place_city`/`directory_location`) and directly in `StoreTypeViewClient` (`directory_store_type`). `filter_applied` fires from a `filterSignature` prop diff (serialized filter/sort state). `listing_clicked` is **self-reported by the cards** via `reportShelfListingClick(shelfRef)` — no callback plumbing. Card coverage (all shelf renderers now report):
  - `components/stores/StoreCard` (via `StoreList` → `DirectoryGrid`) and `components/directory/UnifiedStoreCard` (via `DirectoryList`) — directory category / location / store-type shelves.
  - `components/directory/redesign/StoreCardV2` (via `StoreResults`, `shelfRef="directory/home"`) — **directory home**, all three layout variants.
  - Inline `PlaceCard` in `PlaceCategoryClient` and the inline cards in `PlaceCityClient` — place category / city shelves.
  - `DirectoryMapGoogle` InfoWindow `?shelf=` (prop `shelfRef`) — map view on category / store-type / home.
  - `shelfRefToSurface` accepts a slug-less `directory/home` (ref falls back to the sentinel `home`).
  - **Instrumented as entry SOURCES, not shelves:** `RelatedStores` (`?source=related`), `LastViewed` (`?source=recent`), `StoreTypeRecommendations` (`?source=recommendation`) — they load entry pages but are cross-sell/recency, so they must not pollute shelf CTR. `PromotedStoresCarousel` uses the separate `DirectoryPromotionService` impression/click pipeline (featured-placement billing), which is NOT wired to the traffic readout.
  - **Dead code (no importers):** `components/directory/UniversalDirectoryGrid` + `components/stores/UniversalStoreCard`, and the third `components/directory/StoreCard.tsx`.
  - Public route: `POST /api/public/directory/surfaces/:surface/:ref/events` + `/events/batch` — surface enum-validated, ref slug-validated, rate-limited, no DB lookup.
  - Readout: `GET /api/admin/directory-presence/surface-engagement` → `getSurfaceEngagement` → the **Surface Engagement** table (views / sessions / avg dwell / click-throughs / CTR / filters / CTA clicks) spanning entries **and** shelves in one grid.
  - Entry events stamp `surface` server-side (derived from `listing_origin`), so no client change was needed for entry surfaces.
- **Layer 3 serves BOTH entry surfaces.** `POST /api/public/directory/places/:slug/events` resolves published listings of either origin (`directory_seed` **or** `claimed`), so `/directory/[slug]` (claimed) fires events too — `storefront_clicked` (Visit Storefront) and `call_clicked` (phone) in addition to the automatic view/heartbeat/session_end. The four `/directory` layouts call `useDirectoryPresenceTracking` from `@/hooks/useDirectoryPresenceTracking` (shared with `/place`).
- **Two distinct claim funnels — do not conflate:**
  - `DirectoryPresenceAnalyticsService.getClaimFunnel` = **on-page CTA conversion** (`listing_viewed` → `claim_clicked` → accepted), per-seed/aggregate. Shown on the Directory Traffic page + seed detail panel.
  - `SeedFunnelAnalyticsService.getCohortFunnel` = **GTM/cohort funnel** (seeds → contactable → invited → claimed, per-channel invite-scan + report-scan rates, benchmark gates), campaign-scoped. Shown on `/settings/admin/directory/funnel`.
  - They share only the `claims accepted` terminus. Invite/QR-driven conversion belongs to the cohort funnel; on-page CTA conversion belongs here.
- **Migration `292_backfill_directory_seed_event_context.sql`** — tags historical `directory_detail` rows for seed tenants with `listing_origin`/`surface = 'directory_seed'` (idempotent: only rows where `context->>'surface' IS NULL`) and adds the partial expression index `idx_ubs_directory_detail_surface`. Applied manually to `local` + `prd`; no `schema.prisma` change, so no `prisma generate` needed for it.
- **Layer 3 (engagement):** `directory_presence_events` (migration `293_directory_presence_events.sql` — slug-scoped, mirrors `mkt_gallery_events`; migration `295` makes it surface-scoped). `DirectoryPresenceAnalyticsService` tracks `listing_viewed | shelf_viewed | listing_clicked | filter_applied | claim_clicked | call_clicked | directions_clicked | storefront_clicked | qr_scanned | session_heartbeat | session_end` (fire-and-forget; 60/min/IP limiter) and exposes `getListingEngagement`, `getRecentEvents`, `getClaimFunnel`, `getDashboardEngagement`, `getSurfaceEngagement`, plus seed-scoped `getSeedEngagement` / `getSeedClaimFunnel`. **Uses raw SQL (`$executeRawUnsafe` / `$queryRawUnsafe`) instead of a Prisma model** — deliberately avoids a `prisma db pull` + client regeneration dependency for the events table.
  - Public capture: `POST /api/public/directory/places/:slug/events` + `/events/batch` (slug-gated to published listings of either origin — `directory_seed` or `claimed` — rate-limited, always 200 on a resolved slug).
  - Admin: `GET /api/admin/directory-presence/engagement`, `GET /presence-seeds/:id/engagement`, `GET /presence-seeds/:id/funnel` (all `requirePlatformStaff`).
  - Web: `DirectoryPresencePublicService` (`ttl: 0`) + `useDirectoryPresenceTracking` (`apps/web/src/hooks/useDirectoryPresenceTracking.ts` — shared by `/place` and `/directory`). Wired into `PlaceEntryEditorialLayout` (seed: `claim_clicked` on both claim CTAs) and all four `/directory` entry layouts (claimed: `storefront_clicked` on Visit Storefront, `call_clicked` via the optional `onPhoneClick` prop on `ContactInformationCollapsible`). `PlaceEntryEditorialLayout` requires a `slug` prop (passed by `PlacePageClient` and the retail preview page).
  - UI: `TrafficEngagementPanel` mounted on the seed detail page (funnel + counts + recent feed); the Directory Traffic page shows Layer 3 summary cards, an aggregate claim funnel, and a Claim CTR column.
  - **`qr_scanned` is schema/Zod-only** — QR codes are images with no click target (spec §14.6). `directions_clicked` has no dedicated link yet (no directions CTA exists).

**Windows `prisma generate` EPERM:** regenerating while a dev watcher (`pnpm dev:local-vercel` / `tsx watch`) is running fails with `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`. Stop the node/dev processes first, then re-run `pnpm prisma generate`.

## Identity Packet — Operator Evidence (migration 297)

Campaign detail → **Identity** tab (`IdentityPacketCard`, `apps/web/src/components/marketing-ops/IdentityPacketCard.tsx`).

The packet (`IdentityPacketService.buildForCampaign`, `GET /api/admin/directory-presence/presence-seeds/identity-packet?campaignId=`) is a **derived view**: every ledger row comes from the latest non-stub `business_analysis` audit (platform blocks, owner website, `audit_metadata.identity_corroboration_sources`), scan-audit attribute chips, or `directory_field_provenance`. A business with no audit therefore renders an empty ledger and **0 on both axes** — the normal state right after a prospect call, and the reason the tab reads "Blocked".

- **Write path:** `apps/api/src/services/IdentityEvidenceService.ts` (`mkt_identity_evidence`, migration 297). `POST /presence-seeds/identity-evidence` + `DELETE /presence-seeds/identity-evidence/:id` (`requirePlatformStaff`, declared before `/presence-seeds/:id`). Both return the **re-assembled packet** so the tab re-renders scores without a second round trip.
- **Scope = business prospect, not campaign.** Rows are stamped with `business_prospect_id` when the campaign has one, else `campaign_id`; reads union the prospect group, so one verification call covers every sibling archetype. The UI tags rows captured on a sibling as `shared from sibling`.
- **Scoring:** manual rows are pushed into `assembleIdentityPacket` as ordinary `IdentitySourceRef`s with `agrees: true` (the operator asserts corroboration — there is no competing value to compare). `evidenceState`/`tier` are validated; an omitted tier falls back to `inferSourceTier`.
- **Echo discount is the subtle part:** the independence group is derived from the source **name**, and `sourceGroupSlug` maps platform names onto the audit's own platform keys (`Google Business Profile` → `google`, not `google-business-profile`). Without that mapping a hand-entered GBP row would count as a second independent corroboration of the same platform. Do not "simplify" `sourceGroupSlug` back to a plain slug.
- **`inferSourceTier` lives in `directory/identityScoring.ts`** (re-exported from `IdentityPacketService` for existing callers). It moved there because `IdentityEvidenceService` needs it and importing it from the packet service would form a cycle (packet → evidence → packet).
- **Owner identity rides on the same row** (`owner_name`/`owner_phone`/`owner_email`). It is **not** an identity-scoring field — it is the source for owner outreach, captured once per prospect and reused: the packet returns the newest `ownerContact`, and `IdentityEvidenceService.reuseOwnerContact` back-fills the prospect group's campaign records (`owner_names` / `phones` / `email` / `phone`) **fill-if-empty, never overwriting**. That is the surface outreach tooling already reads (opener merge context, campaign form, sibling creation copy in `BusinessProspectService.createSiblingCampaign`).
- **Provenance mirror:** when the campaign has a linked `primary` seed, corroborated fields are mirrored into `directory_field_provenance` with `ON CONFLICT (seed_id, field_key) DO NOTHING` (never clobbers audit/owner evidence) and `show_on_public = false` (publishing stays deliberate). Mirrored rows carry `notes = EVIDENCE_PROVENANCE_NOTE`, which is what makes delete able to retract **exactly** what it wrote — an upsert by another writer changes `source_name`, so the retraction skips it.
- **Vocabulary single source:** `IDENTITY_SOURCE_TIERS` / `IDENTITY_EVIDENCE_STATES` / `IDENTITY_FIELD_KEYS` + `is*` guards in `directory/identityScoring.ts` drive route Zod validation, the CHECK constraints, and the web labels (`apps/web/src/lib/identity-evidence.ts` — labels, presets, `todayISODate`). Adding a member means updating the array **and** the CHECK in migration 297 (drop + re-add inside the guarded `DO` block).
- **Migration 297 is self-healing:** the `CREATE TABLE IF NOT EXISTS` is followed by `ADD COLUMN IF NOT EXISTS` for every column and guarded `DO` blocks for each constraint, so re-running the file repairs a table created by an earlier revision of it. Run it against `local` + `prd`, then `pnpm prisma:generate` (the model is in `schema.prisma`; the service itself uses raw SQL).
- **Migration 298 repairs the content guard** — run it too. Two defects in 297's: (a) the first revision created `chk_identity_evidence_corroborates_nonempty` with **no owner-contact escape**, which rejects the supported owner-contact-only row, and 297's guarded `DO` block can never remove it (it is a different constraint name), so 298 drops it explicitly; (b) the replacement `chk_identity_evidence_content` tested `array_length(corroborates, 1) >= 1`, but Postgres returns **NULL** for an empty array, `NULL >= 1` is NULL, and **a NULL CHECK passes** — the guard never bit. 298 re-adds it as `COALESCE(array_length(corroborates, 1), 0) >= 1`. General rule: never write `array_length(...) >= n` in a CHECK without `COALESCE`.
- **Raw-query param casting:** Prisma binds a JS **string** parameter as `text`, and `text` → `date`/`jsonb`/`text[]` are **not** implicit casts in Postgres — the insert fails with `42804` (`column "x" is of type date but expression is of type text`). Every placeholder targeting a non-text column needs an explicit cast in the SQL: `${value}::date`, `${json}::jsonb`, `${array}::text[]`. Mocked unit tests cannot catch this (it is a type-binding requirement, not a value problem), so a new table's write path must be exercised against a real DB once — a throwaway script that creates a row and deletes it is enough, and it also confirms the CHECK constraints actually accept the writer's values.
- **Tests:** `apps/api/src/services/__tests__/IdentityEvidenceService.test.ts` (scope, tier inference, empty-payload rejection, owner back-fill, mirror + retraction, and the CHECK **constraint-parity** suite that parses the effective value sets out of `database/migrations`) and the `manualEvidence` cases in `IdentityPacketService.test.ts` (unaudited zero-state → scored, echo discount, owner contact, retraction).
- **Persisted "Wait" (migration 300):** `mkt_campaigns_list.seed_decision` / `seed_decision_at` / `seed_decision_by` (all nullable, additive) store the operator's seed decision so the Identity tab's Wait survives reloads. `POST /presence-seeds/identity-packet/decision` (`{campaignId, decision: 'wait'|'clear'}`) writes via `IdentityPacketService.setSeedDecision` and returns the rebuilt packet; the packet read is a **non-fatal side query** (`$queryRaw` in try/catch) so an unmigrated DB renders `seedDecision: null` instead of a 500. Advisory only — Wait never disables Push. Apply to `local` + `prd`.
- **Verification → seed back-fill:** `MarketingCampaignService.resolveCampaignVerification` also mirrors connected-call verified facts into the **primary-linked seed** (`directory_seed_campaign_links.link_role='primary'`): `directory_seed_nap_verifications` rows (`owner_corrected` FALSE for confirms / TRUE for corrections, split against current `directory_field_provenance`), `nap_verified_at` / `nap_owner_corrected` stamps, provenance upsert (`owner_confirmed`/`owner_corrected`), `directory_listings_list` sync for corrected core fields (tenant-scoped, like the anchor path), and a best-effort `SeedIntelligenceReportService.refreshReport`. The whole block is non-fatal and gated on `outcome ∉ {unreachable, wrong_business}` — the §20.4 connected-contact rule.
- **Verify record modal prefill contract (campaign mode):** `ResolveVerificationModal` initializes from `entry.business_snapshot`, but campaign mode has no snapshot — `IdentityPacketCard` synthesizes one from the packet (`verificationEntry`). The packet therefore carries campaign columns that exist solely for this prefill (`addressCity/State/Zip`, `businessHours`, `email`, `socialProfiles`, `directoryProfiles`, `ownerContact`). This is load-bearing, not convenience: `resolveCampaignVerification` writes `socialProfiles`/`directoryProfiles` as **wholesale column replaces**, so any stored row the modal didn't render is silently deleted on the next save. When adding a modal field that maps to a campaign column, thread it through `buildForCampaign`'s select → `AssembleInput.campaign` → the packet → `verificationEntry.business_snapshot`.

**Outreach Prep worksheet prefill (identity → worksheet).** The Outreach Prep tab's worksheet (`mkt_outreach_intelligence`, `OutreachIntelligenceService`) is a *curated, business-published-only* artifact whose banner forbids personal phone numbers and guessing email formats, and whose API rejects `confirmed` without a source citation (Zod `superRefine`). The identity ledger is raw evidence. They meet through a **prefill, never an auto-write**: `GET /:campaignId/outreach-intelligence/identity-prefill` (`mapEvidenceToWorksheetPrefill`, pure, exported next to `resolveSalutation`) returns suggestions the operator reviews before hitting the existing Save — that keeps the human gate and the primary-sibling 409 rule intact.

- Maps **owner/contact name** and **business-published email**, each from the NEWEST usable ledger row carrying it, with citation `"{source_name} ({accessed_at})"` and confidence from `confidenceForEvidence` (owner-confirmed/owner-corrected or `first_party`/`authoritative` → `confirmed`; aggregator → `inferred_low_risk`).
- **Derives `preferred_contact_channel`** (email beats phone) and marks it `inferred_low_risk` with a `"Derived from …"` citation — a channel is our inference, not a published fact.
- **Never maps `owner_phone`.** The worksheet has no phone field by design; the owner's cell belongs on the campaign record (`phones`/`phone`), which the evidence write already back-fills. Team signal stays entirely operator-entered (it is a judgement read from published About copy).
- Rows in `UNUSABLE_EVIDENCE_STATES` (`conflicting`, `owner_disputed`, `not_checked`, `not_found_during_discovery`) may not supply a value — the newest *usable* row wins. Prefilled `unavailable` fields must never overwrite an existing operator entry (the tab applies a suggestion only when its confidence ≠ `unavailable`).
- Invariants the mapper must preserve (unit-tested): `confirmed` ⇒ non-empty citation, and `unavailable` ⇒ `value`/`source` both null — otherwise the operator cannot save what the prefill produced.

### Identity packet — partial qualification lane (added 2026-09-26)

The packet now has the same two-lane model as triage's partial/full verdict: `packet.lane` is `'full'` when a real (non-stub) `business_analysis` audit drives the evidence model, `'partial'` when it deliberates on the campaign's `discovery_context` instead. A promoted queue prospect can therefore qualify for Push to draft **before a full audit** — the accelerated seed path — while `business_analysis` remains the lane for questionable cases and for the `guaranteed` ceiling.

- **Testimony gate:** `computeSeedConfidence` (the queue's seed-confidence meter) is recomputed on `discovery_context` inside `assembleIdentityPacket`; only when the score clears `SEED_CONFIDENCE_TESTIMONY_BAR` (40 = `medium`) do `discovery_provenance` rows corroborate `name` + `address` + `primary_category` — as ordinary `IdentitySourceRef`s (`evidenceState: 'observed'`, `discovery: true`, inferred tier + `sourceGroupSlug` groups, so a discovery "Google" discounts against a later audit's Google block). Below the bar they corroborate nothing — the packet renders `partial_lane_below_bar` and stays blocked, exactly like a context-free campaign.
- **Equivalent scoring, capped ceiling:** provenance sources feed the same dimension gate (`guaranteed` allowed when depth is met), BUT `discoveryDoubtMarkers` — `nap_drift`/`category_drift` weaknesses, `alternate_identity` bronze reasons (alias-resolved), `INT_POSSIBLE_CATEGORY_MISALIGNMENT`, `INT_SINGLE_SOURCE`, `identity_confidence: low`, `category_fit: insufficient`, `outside_market`, `seek hold` — cap a depth-qualified decision at `'earned'` (`gate.doubtCapped`, band `review`) and emit `discovery_doubt_*` QC warns. `INT_ACTIVE_OPERATIONAL_EVIDENCE`/`INT_RECENT_BUSINESS_EVIDENCE` lift `operationalStatus` to `likely_active` (70) when the audit axis would otherwise be `unable_to_verify`.
- **New context carry:** `discoveryContextSchema` gained `ownership_type` + `verification_outcome`, populated at promotion (`createCampaignFromQueue`) from `snapshot.ownership_type` + `entry.verification.outcome`, feeding the meter's chain exclusion and human-verification override.
- **`createFromCampaign` partial lane:** no longer requires a non-stub audit on the **guarded** lane — the gate evaluation is the arbiter (`pushRecommended` over discovery evidence, or owner-confirmed rescue). The **manual** lane is discovery-aware: it seeds without an audit when the campaign carries a valid `discovery_context` (re-validated via `validateDiscoveryContext` at read), but still throws `business_analysis_audit_not_found` for a campaign with neither audit nor discovery evidence. Partial seeds cite the stub's `audit_metadata.source` (`discovery_scan`/`queue_promotion`/…) in provenance `source_name`, derive `identityConfidence`/`categoryFit` from `discovery_context`, default `provenanceConfidence` to `'medium'`, and degrade SEO to the composer's existing Tier A path (`composeCampaignSeoPacket` runs on the stub blob + campaign facts).
- **Registry playbook wiring (added 2026-09-27):** the partial lane reads the same `mkt_signal_registry` declarations triage does. `loadSignalSeedWiring` (`discovery-verdict.ts`) resolves each detected signal's `primary_playbook`/`secondary_playbook` to the routed playbook's `mkt_playbook_catalog.archetype`; `seedTiltForSignal` maps the archetype to a seed tilt — **visibility** (A4 CTA gap / A6 product visibility / A7 website gap) adds `+5` ("a visibility problem is what a seed fixes"), **doubt** (A3 listing drift — primary *or* secondary route) adds `−5` and a `route_{code}` doubt marker, **neutral** (A1/A2/A5) contributes nothing. Declared wiring **overrides** that code's canonical confidence term but never un-flags canonical doubt (doubt stays additive-only); signals with no declared prefs fall back to the hardcoded canonical semantics. Wiring is loaded once per call site — `buildForCampaign` (packet) and `listDecorated` (queue `seed_confidence`) prefetch the union of detected codes — so a newly registered signal evaluates immediately, exactly like triage's `applySignalPlaybookPreferences`. No schema change: `primary_playbook`/`secondary_playbook` and `archetype` already exist.
- **Web:** `IdentityPacket` carries `lane` + `seedConfidence`; `IdentityPacketCard` shows a `partial lane · {band} confidence` badge in the header. New QC codes (`partial_lane`, `partial_lane_below_bar`, `discovery_doubt_*`, `discovery_doubt_cap`) render through the generic signal list — no per-code label map needed.

## WhatsApp Channel Integration

Spec: `docs/LocalBiz/WHATSAPP_CHANNEL_INTEGRATION_SPEC.md`

- `275_whatsapp_channels.sql` — creates `whatsapp_channels` (platform-owned WABA channel registry; `wac-{tenantKey}-{nanoid}` ids, `access_token_encrypted`, CHECK on `status`) + `bot_messages.wa_message_id` with a partial unique dedupe index (`WHERE wa_message_id IS NOT NULL`). Applied to staging + prod.
- `286_directory_entry_whatsapp.sql` — seeds `directory_entry_whatsapp_on` + `directory_entry_whatsapp_enabled` feature keys (granted to `presence` + `directory_presence` tiers), adds `whatsapp_display`/`whatsapp_number` columns to `tenant_directory_entry_settings`, and syncs `chk_whatsapp_channels_status` to the app enum (`active|inactive|disabled|revoked` — 275 shipped a stale 2-value set). Run against `local` + `prd`, then `prisma db pull && pnpm prisma generate`.
- Shared pipeline: `services/bot/BotTurnPipeline.ts` (`preprocessTurn`/`completeTurn`/`persistAssistantTurn`) — one engine, widget + WhatsApp transports. Widget contract pinned by `src/tests/bot-public-pipeline.test.ts` (13 tests) — must stay green.
- Meta webhooks mount in `bootstrap.ts` §6 pre-middleware (path-scoped `express.json({verify})` raw-body capture); `routeRegistry`'s `preMiddleware` flag is NOT a true pre-parser mount. Signature verification fails closed on missing secret/signature/rawBody.
- WhatsApp session ids are `wa-{phone_number_id}-{wa_id}`; multiple rows per session are intentional (archive + recreate). Do NOT add a unique index on `bot_conversations.session_id`.
- `OAUTH_ENCRYPTION_KEY` assertion is WhatsApp-scoped (`services/whatsapp/crypto.ts`) — Meta/Google OAuth consumers keep the existing random-fallback behavior. Do not globalize.
- `directory_entry_whatsapp_on` is an explicit-key exception to flexible-grants: `directory_entry_flexible` does NOT unlock it (decision D5). CTA number provenance: merchant `whatsapp_number` pref → active channel `display_phone_number`; never the NAP phone; never a Meta test number.

## Architecture

- **Campaign structural-duplicate guardrail:** `MarketingCampaignService.createCampaign` blocks creation of a second *active* campaign with the same structural signature. Re-run the existing campaign to produce a versioned output instead. Inactive stages (`lost`, `dead`, `closed`, `resolved_and_closed`) do NOT block — a fresh campaign can be created after the prior one was killed. The check is keyed on structural attributes (NOT campaign id):
  - **intelligence scope** → `scope + category + intelligence_campaign_kind + intelligence_focus + intelligence_platform + city + state` (null/empty/`all` platform + null city/state = nationwide; the "Indian Grocery / Establishment / Gold_standards / All Platforms" case)
  - **business scope** → `scope + campaign_category + business_name + category + city + state`
  - **category / city scope** → `scope + campaign_category + category + city + state`
  - Implementation: `findDuplicateCampaign` in `apps/api/src/services/MarketingCampaignService.ts`; throws `ConflictError` (409 `conflict`) with the existing campaign's id + stage. Best-effort on lookup failure (logs + allows create). Tests: `apps/api/src/services/__tests__/marketingCampaign.recovery.test.ts` → "createCampaign structural-duplicate guardrail" (7 tests).

- **Backend:** Node.js + Express + TypeScript in `apps/api`
  - Routes in `apps/api/src/routes/` (registered via `routeRegistry.ts`)
  - Services in `apps/api/src/services/`
  - Prisma ORM; schema at `apps/api/prisma/schema.prisma`
  - Migrations in `database/migrations/` (numbered, e.g. `161_*.sql`)
  - `RequestCtx` type lives in `apps/api/src/context.ts` (NOT `middleware/auth.ts`)
  - Config via `unifiedConfig` from `apps/api/src/config/unifiedConfig.ts` (NOT `config.ts`)
  - `audit()` helper in `apps/api/src/audit.ts` accepts optional `actorType: 'user' | 'system' | 'integration' | 'customer'`
- **Frontend:** Next.js (App Router) + TypeScript in `apps/web`
  - Pages in `apps/web/src/app/`
  - Services in `apps/web/src/services/` (extend `PublicApiSingleton` or `CustomerApiSingleton`)
  - Customer auth context: `apps/web/src/contexts/CustomerAuthContext.tsx`
  - Customer auth service: `apps/web/src/services/CustomerAuthService.ts` (singleton; `applyExternalAuth()` persists tokens from external auth flows)

## Conventions

- Platform sentinel: use `'platform'` (the `tenants.id = 'platform'` row). Do NOT use `'_platform_'`.
- `PLATFORM_SCOPE` constant: `apps/api/src/lib/platform-scope.ts`
- Marketing Ops public routes mount at `/api` (so routes are `/api/public/marketing/*`)
- Marketing Ops admin routes mount at `/api/admin/marketing-ops`
- Customer auth routes mount at `/api/customer-auth`
- Frontend public services extend `PublicApiSingleton` with `ttl: 0` for no caching
- Double-wrap response contract: unwrap with `result.data?.data ?? result.data`
- Mantine UI is used on marketing public pages (`@mantine/core`); customer account pages use Tailwind + `@/components/ui/*`
- Tabler icons: use `IconLogin` (not `IconLogIn`)
- **Tracked link + QR variables:** never hand-build a claim/report URL in a script, pitch, or merge context. Resolve `{{report_url}}` / `{{claim_url}}` / `{{claim_short_url}}` / `{{qr_url_*}}` through `apps/api/src/services/outreach-openers/outreach-link-vars.ts` (`buildOutreachLinkVars`, `resolveClaimUrlForCampaign`). Canonical claim path is `/place/claim/{token}` (`/directory/claim/{token}` is a legacy web redirect only). The kit services are imported lazily there because `ClaimInviteQrKitService` evaluates `unifiedConfig.get()` at module load.

## Marketing Ops Customer Portal (Phase 1)

Spec: `docs/LocalBiz/MARKETING_OPS_CUSTOMER_PORTAL_SPEC.md`

Key files:
- `apps/api/src/services/MarketingCustomerService.ts` — claim service (`claimAllEligible`, `issueClaimToken`, `getClaimTokenSummary`, `consumeClaimToken`, `registrationClaimSweep`)
- `apps/api/src/services/marketing/MarketingReceiptPdfService.ts` — shared receipt PDF generator
- `apps/api/src/services/marketing/MarketingReceiptEmailService.ts` — receipt + claim invite emails
- `apps/api/src/routes/marketing-ops-public.ts` — public pay + claim endpoints (§6.1)
- `apps/api/src/routes/marketing-ops.ts` — admin pay-link + send-claim-invite endpoints (§8.1, §8.2)
- `apps/web/src/services/MarketingClaimPublicService.ts` — frontend claim service
- `apps/web/src/app/marketing/claim/` — public claim pages (Path B)
- `apps/web/src/app/marketing/pay/PayPageClient.tsx` — pay page with email field + account CTA

Three claim paths, one claim service:
- **Path A** (at payment): pay page success screen → register/login → `claimViaPayRegister` / `claimViaPayLogin`
- **Path B** (email awareness): `/marketing/claim` → email → claim link → `/marketing/claim/[token]` → register/login
- **Path C** (registration sweep): `CustomerAuthService.verifyEmail` / `oauthLogin` → `registrationClaimSweep` (fire-and-forget)

## Marketing Ops Customer Portal (Phase 2 — Authenticated Portal)

Context signals (§4.2):
- `CustomerAuthService.computeContexts(customerId)` returns `{ storefront, platform }` booleans
- `contexts` field on `/me` and all auth responses (login, register, oauth, claim)
- Frontend `CustomerAuthContext` exposes `contexts` and refreshes after claim/purchase events

Portal backend (§6.2, §6.4, §6.5, §7.3, §7.4, §7.7, §7.9):
- `apps/api/src/routes/marketing-customer.ts` — authenticated portal routes at `/api/customer/marketing/*`
  - All routes require customer JWT + `requirePlatformContext` gate (403 `context_required`)
  - Endpoints: overview, campaigns, purchases, receipts (view + PDF), branding, support tickets, alerts
- `apps/api/src/services/MarketingCustomerProjection.ts` — customer-safe projection:
  - `projectCampaign` / `projectCampaigns` — whitelists fields, hides internal stages
  - `mapCustomerStatus` — maps internal stages to customer-legible statuses (§7.3)
  - `buildPortalOverview` — aggregates total spent, active engagements, deliverables ready
  - `buildReceiptViewModel` — receipt DTO with QR destination + branding resolution (§7.4)

Portal frontend (§7.2, §7.4, §7.7, §7.9):
- `apps/web/src/services/MarketingCustomerService.ts` — extends `CustomerApiSingleton`, wraps all portal endpoints
- `apps/web/src/app/account/marketing/` — portal pages:
  - `page.tsx` — overview (summary cards + campaigns + recent purchases)
  - `purchases/page.tsx` — full payment history table
  - `campaigns/[id]/page.tsx` — campaign detail with progress timeline + deliverables + receipts
  - `receipts/[revenueId]/page.tsx` — HTML receipt view with QR
  - `settings/page.tsx` — branding settings with live QR preview
  - `support/page.tsx` + `support/[ticketId]/page.tsx` — support tickets
  - `alerts/page.tsx` — platform alerts with mark-read/dismiss
- `apps/web/src/components/customer/CustomerSidebar.tsx` — signal-gated nav groups:
  - "Shopping" group (storefront context)
  - "My Services" group (platform context)
  - "Account" group (context-agnostic, §7.8)
  - Unread alert badge on Notifications (refreshes every 60s when platform context active)

Migrations:
- `162_mkt_customer_branding.sql` — per-customer branding (logo, asset URL, brand color)
- `163_crm_tickets_campaign_id.sql` — additive `campaign_id` on `crm_support_tickets`
- `164_crm_customer_alert_states.sql` — per-customer alert read/dismiss state

## Marketing Ops Customer Portal (Phase 3 — Card on File + Repeat Purchase)

Saved-card plumbing (§6.3):
- `CustomerPaymentMethodsService.savePaymentMethodFromIntent(customerId, pi)` — attaches a PI's payment_method to the customer's platform-scoped Stripe customer
- `CustomerPaymentMethodsService.getOrCreateStripeCustomer` is now public (was private)
- `SubscriptionBillingService.createOneTimePaymentIntent` accepts `setupFutureUsage` + `customer` params
- `SubscriptionBillingService.stripeInstance` getter (public accessor for the private Stripe instance)
- `ConversionSource` type extended with `'portal_checkout'`
- Pay page (`/marketing/pay`) passes `saveCard` → `setup_future_usage: 'off_session'` on the PI; post-confirmation, if authenticated + opted in, calls `savePaymentMethodFromIntent`

Portal checkout (§7.6, §7.5):
- `POST /api/customer/marketing/checkout` — repeat-purchase checkout:
  - Off-session charge with `useSavedMethodId` (customer + payment_method + off_session: true)
  - SCA failure → 402 `authentication_required` with clientSecret for frontend fallback
  - Interactive checkout → PI with `setup_future_usage: 'off_session'` + platform Stripe customer
  - Coupon redemption: `savedCouponId` (wallet) or `couponCode` (ad-hoc) → validates + applies discount → flips wallet row to `redeemed`
- `POST /api/customer/marketing/checkout/confirm` — confirms interactive checkout, marks campaign paid, flips coupon, sends receipt email
- `GET /api/customer/marketing/coupons/applicable?campaignId=` — wallet coupons valid for the campaign's price (§7.5)
- `POST /api/customer/marketing/payment-methods/save-from-payment` — attaches PI's PM to platform scope

Frontend checkout:
- `apps/web/src/app/account/marketing/campaigns/[id]/checkout/page.tsx` — portal checkout page:
  - Saved card selection (platform-scope payment methods)
  - Applicable coupon list (one-click apply) + ad-hoc coupon code entry
  - Off-session charge for saved cards; Stripe Elements fallback for new cards
  - Order summary with discount + total
- Campaign detail page gains "Purchase again / Upgrade" button (§7.6)
- `MarketingCustomerService` (frontend) gains `savePaymentMethodFromIntent`, `getApplicableCoupons`, `createCheckout`, `confirmCheckout`
- `MarketingPayPublicService.createCheckout` accepts `saveCard` param
- Pay page shows "Save this card" checkbox when customer is authenticated

## Marketing Ops Customer Portal — Tests (§11)

- `apps/api/src/services/__tests__/MarketingCustomerProjection.test.ts` (24 tests):
  - Status mapper: every internal stage maps to a customer status or is hidden
  - Hidden stages (seek, seed, preview_built, shown, lost, dead) return null
  - Active subscription overrides stage
  - `projectCampaign` whitelists fields (no notes, pain_score, estimated_*, assigned_to)
  - `projectCampaigns` filters out hidden-stage campaigns
- `apps/api/src/tests/marketing-customer-routes.test.ts` (7 tests):
  - JWT required: no auth → 401, invalid token → 401
  - Context gating: storefront-only → 403 context_required, zero-context → 403, platform → 200
  - Cross-customer isolation: customer A gets 404 on customer B's campaign + receipt

## Marketing Ops Customer Portal — Alert Composer (§8.3)

Operator composer for sending alerts to marketing customers (platform-context only).

Backend endpoints (in `marketing-ops.ts`):
- `GET  /api/admin/marketing-ops/alerts/customers` — list marketing customers for recipient picker
- `GET  /api/admin/marketing-ops/alerts/recipient-count` — pre-send recipient estimate
- `POST /api/admin/marketing-ops/alerts` — create targeted / broadcast / campaign-scoped alert
- `GET  /api/admin/marketing-ops/alerts` — sent alerts history with read/dismissed counts

Frontend:
- `/settings/admin/crm/broadcast/marketing` — dedicated marketing broadcast page (mirrors tenant broadcast)
- Campaign detail "Customer Account" section — "Send Alert" link + "Send Claim Invite" button
- `MarketingOpsService` gains `listMarketingAlertCustomers`, `getAlertRecipientCount`, `createMarketingAlert`, `listMarketingAlerts`, `sendClaimInvite`

Alert targeting (stored in `crm_alerts.metadata`):
- `mkt_broadcast` — no metadata, visible to all platform-context customers
- `mkt_direct` — `metadata.customer_id`, visible to one customer
- `mkt_campaign` — `metadata.campaign_id`, visible to customers who claimed that campaign

All alerts use `tenant_id = PLATFORM_SCOPE`. Customer-side reader is in `marketing-customer.ts` (`GET /alerts`, `POST /alerts/:id/read`, etc.).

## Intake Portal Generalization (Registry-Driven Intake Forms)

Spec: `docs/LocalBiz/INTAKE_PORTAL_GENERALIZATION_PLAN.md`

Generalizes the token-gated "owner data collection" framework to support multiple intake types (dispute, profile_repair, gbp_optimization, review_response_setup, ...) via a registry-driven architecture.

### Schema (Migration 173)
- `mkt_intake_definitions` table — declarative `form_schema`, `field_mappings`, `owner_copy`, `niche_overrides` in JSONB
- `mkt_dispute_intake` — `campaign_id` UNIQUE relaxed to `@@unique([campaign_id, intake_kind])` (1:N relation)
- FK from `mkt_dispute_intake.intake_kind` → `mkt_intake_definitions.intake_kind`

### Backend Services
- `apps/api/src/services/intake/IntakeDefinitionService.ts` — loads + caches definitions, builds dynamic Zod schemas from `form_schema`, resolves niche overrides, runs custom validators
- `apps/api/src/services/intake/writeBehindAdapters.ts` — maps evidence_payload to existing backend domain models (business_hours_list, review_response_settings, etc.)
- `apps/api/src/services/DisputeIntakeService.ts` — extended with `submitRegistryIntake` (kind-aware idempotency, dynamic Zod validation, write-behind adapters, downstream agent enqueue stub)
- `apps/api/src/services/MarketingCampaignService.ts` — registry-driven auto-gen hook: checks `getDefinitionsForTrigger(stage)` on non-recovery transitions; `REVIEW_TRANSITIONS` extended with `gbp_intake_submitted` + `review_setup_submitted` stages
- `apps/api/src/services/RecoveryResolutionService.ts` — updated for 1:N relation (uses `find` on `mkt_dispute_intake` array, `findFirst` for `findByCampaign`)

### Routes
- `apps/api/src/routes/recovery-intake-public.ts` — dispatches to `submitRegistryIntake` for registry kinds; `GET /options` endpoint for dynamic option sources; `reissue` accepts `intakeKind`
- `apps/api/src/routes/marketing-ops.ts` — `GET /recovery/:campaignId/intake` accepts `intakeKind` query param (returns single intake) or returns all intakes (array); `reissue-link` + `attachments/:id` accept `intakeKind`

### Frontend
- `apps/web/src/app/recovery/intake/IntakeFormRenderer.tsx` — generic, registry-driven form renderer (text, url, email, phone, textarea, select, radio, multiselect, checkbox, chips, hours_grid, attachments, number, date, object/nested)
- `apps/web/src/app/recovery/intake/IntakePageClient.tsx` — registry render path: detects `context.definition` and renders `IntakeFormRenderer` instead of hardcoded form fields
- `apps/web/src/services/RecoveryIntakePublicService.ts` — `submitRegistryIntake`, `getOptions`, `reissueLink(campaignId, intakeKind)`
- `apps/web/src/services/RecoveryOpsService.ts` — `getIntake(campaignId, intakeKind)`, `reissueLink(campaignId, intakeKind)`, `downloadAttachment(campaignId, attachmentId, fileName, intakeKind)`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/recovery/[campaignId]/RecoveryDetailClient.tsx` — generic evidence payload renderer for registry kinds (JSON display + downstream action panel)

### Tests
- `apps/api/src/services/__tests__/IntakeDefinitionService.test.ts` (15 tests) — getByKind, getDefinitionsForTrigger, resolve (niche overrides), buildSubmitSchema (dynamic Zod), cache invalidation
- `apps/api/src/services/__tests__/DisputeIntakeService.test.ts` (21 tests) — existing dispute tests + 6 new submitRegistryIntake tests (success, idempotency, expired/invalid token, missing definition, Zod validation failure)

### Key Patterns
- **Code-defined kinds** (`dispute`, `profile_repair`): hardcoded form fields in `IntakePageClient`, validated by `recovery-intake.schema.ts`
- **Registry-driven kinds** (`gbp_optimization`, `review_response_setup`): dynamic form fields from `mkt_intake_definitions.form_schema`, validated by `IntakeDefinitionService.buildSubmitSchema`
- **Niche overrides**: `niche_overrides[category]` can add fields, override field labels/help, and override owner copy per business category
- **Downstream handoff**: stubbed enqueue with manual import path (plan §7.4)

## Gallery Short URLs (SMS-friendly prospect links)

Mirrors the coupon `/s/{autoId}` short URL pattern for diagnostic gallery tokens. The 32-char `/preview/{token}` URL is too long for SMS outreach to phone-only prospects; the short `/g/{shortCode}` form (6 chars) makes text-message gallery links practical.

### Schema (Migration 183)
- `mkt_deliverable_preview_tokens.short_code` — nullable `VARCHAR(8)`, unique partial index `idx_mkt_preview_tokens_short_code` (WHERE NOT NULL)
- 6-char codes from curated 32-char alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — no 0/O/1/I), ~1B combinations
- Legacy tokens have `short_code = null` and keep working via the long URL; `ensureShortCode()` lazily backfills on next admin access

### Backend
- `apps/api/src/lib/id-generator.ts` — `generateGalleryShortCode()` (6-char nanoid from curated alphabet)
- `apps/api/src/services/MarketingDeliverableService.ts`:
  - `generateCampaignToken()` now mints a unique `short_code` (with 3-retry collision handling) for `diagnostic_gallery` + `multi_diagnostic_gallery` token types
  - `resolveShortCode(shortCode)` — public lookup, returns `{ token, tokenType }`; expired tokens return null
  - `ensureShortCode(tokenId, tokenType)` — lazy backfill for legacy tokens
- `apps/api/src/routes/gallery-code.ts` — `GET /api/gallery-code/:shortCode` (public, no auth) → `{ token, tokenType, isMultiGallery }`
- `apps/api/src/routes/routeRegistry.ts` — registers `/api/gallery-code` at `authLevel: 'public'`
- `apps/api/src/routes/marketing-ops.ts`:
  - Single gallery token response includes `shortUrl` + `shortCode` alongside `galleryUrl`
  - Multi-gallery token response includes `galleryUrl` (`?prospect=true`), `shortUrl`, `shortCode`
  - Pay-links list (`GET /campaigns/:id/pay-links`) includes `shortCode` + `shortUrl` per token (powers `listGalleryTokens`)

### Frontend
- `apps/web/src/services/GalleryShortCodeService.ts` — `resolveShortCode()` (extends `PublicApiSingleton`, `ttl: 0`)
- `apps/web/src/app/g/[shortCode]/page.tsx` — server redirect page: resolves short code → redirects to `/preview/{token}` (or `?prospect=true` for multi-gallery)
- `apps/web/src/services/MarketingOpsService.ts` — `GalleryToken` interface extended with `short_code?` + `shortUrl?`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/GalleryPanel.tsx` — "Use short URLs" toggle (default on); prefers `/g/{shortCode}` when available
- `apps/web/src/components/marketing-ops/LogContactModal.tsx` — "Insert gallery link" prefers short URL for SMS-friendly message body
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/SiblingsTab.tsx` — multi-gallery hint mentions SMS-friendly short URL

### Key Patterns
- **Resolution flow**: `/g/{shortCode}` (server page) → `GET /api/gallery-code/:shortCode` → `redirect(/preview/{token}[?prospect=true])`
- **Multi-gallery detection**: `tokenType === 'multi_diagnostic_gallery'` → append `?prospect=true` so `preview/[token]/page.tsx` renders `MultiGalleryPage`
- **Collision handling**: 3 retries on unique-index conflict; falls back to no short code (long URL still works) if exhausted
- **Lazy backfill**: legacy tokens without `short_code` are not broken; `ensureShortCode()` can backfill them on demand

## Deliverable PDF Branding — platform-logo fallback (added 2026-10-09)

`mkt_branding_config` (managed at /settings/admin/marketing-ops/branding; one `is_active` row, enforced by `deactivateAllConfigs` + partial unique index) is consumed only by `MarketingDeliverableService.generateDeliverable` via `MarketingBrandingService.applyBrandingToDoc` — an async static that resolves the header logo from `operator_logo_url` with three scenarios: a URL = custom logo; the `'__none__'` sentinel (`NO_LOGO_URL` / web-side `BRANDING_NO_LOGO_URL`, same `__` convention as `__all__`) = no logo, operator-name text header; empty/null = platform logo via `loadPlatformBranding()` (same `platform_settings_list.logo_url` source the claim-invite QR postcard, receipts, mailers, and seed/prospect report PDFs use). Logos are embedded by fetch → base64 data URI → `getImageProperties` → aspect-ratio `addImage` — jsPDF cannot resolve a remote URL itself, so never pass a stored URL straight into `addImage` (the old code did, which is why the operator logo never actually rendered). `data:` URIs are embedded directly; failed embed falls back to the operator-name text header. The branding form exposes the three scenarios as a Logo select (platform default / custom URL / none), previews the probed platform logo, and keeps a separate `logoSource` state because an empty custom URL is indistinguishable from the platform choice.

## Intelligence Campaign Prompts — Focus + Kind Awareness

Makes prompt templates focus- and kind-aware so the campaign workspace Prompts tab surfaces only the templates matching the campaign's intelligence type. Previously focus was inferred from the template NAME (regex `/competitive/i`) and kind was inferred from `output_schema.name` — both were artifacts, not queryable data.

### Schema (Migration 203)
- `mkt_prompt_templates_list.intelligence_focus` — nullable `VARCHAR(20)` (`'emerging'` | `'competitive'`); NULL for non-intelligence templates + composition fragments
- `mkt_prompt_templates_list.intelligence_campaign_kind` — nullable `VARCHAR(20)` (`'discovery'` | `'establishment'`); NULL for non-intelligence templates + fragments
- Index `idx_mkt_prompt_templates_intelligence` on `(intelligence_focus, intelligence_campaign_kind, is_active)`
- Backfill sets the 3 known seeded templates: emerging discovery, competitive discovery, establishment

### Backend
- `apps/api/src/services/MarketingPromptService.ts`:
  - `PromptTemplateInput` gains `intelligenceFocus` + `intelligenceCampaignKind` (nullable)
  - `createTemplate` / `updateTemplate` persist both fields
  - `listTemplates` accepts `intelligenceFocus`, `intelligenceCampaignKind`, and `includeNullFocusKind` filters — when `includeNullFocusKind` is set, returns templates matching the focus+kind OR templates with NULL focus/kind (legacy fallback)
  - `cloneTemplate` copies both fields
  - `clearDefaultForType` includes focus+kind in the default-uniqueness key (so emerging + competitive can each have their own default)
- `apps/api/src/routes/marketing-ops.ts`:
  - `promptTemplateCreateSchema` accepts `intelligence_focus` + `intelligence_campaign_kind` (nullable enums)
  - `GET /prompts/templates` accepts `intelligence_focus`, `intelligence_campaign_kind`, `include_null_focus_kind` query params
  - `POST` / `PUT /prompts/templates/:id` pass the new fields through
- Seed scripts updated to set the new fields:
  - `apps/api/src/scripts/seed-intelligence-discovery-templates.ts` — sets `intelligenceFocus` + `intelligenceCampaignKind: 'discovery'` on both templates
  - `apps/api/src/scripts/seed-intelligence-profile-establishment-template.ts` — sets `intelligenceCampaignKind: 'establishment'`
  - `apps/api/src/scripts/seed-intelligence-fragments.ts` — unchanged (fragments identified by `fragment_kind`, focus/kind stay NULL)

### Frontend
- `apps/web/src/services/MarketingOpsService.ts`:
  - `IntelligenceCampaignKind` type added (next to existing `IntelligenceFocus`)
  - `PromptTemplate` + `PromptTemplateCreateInput` gain `intelligence_focus?` + `intelligence_campaign_kind?`
  - `listPromptTemplates` accepts + passes the new filters
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` — Prompts tab:
  - For intelligence-scope campaigns, passes `intelligence_focus` + `intelligence_campaign_kind` + `include_null_focus_kind: true` so only matching templates (plus legacy untyped ones) are fetched
  - Header text shows the active focus + kind when intelligence-scope
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/PromptLibraryClient.tsx`:
  - `PromptTemplateModal` shows Focus + Kind selectors only when `scope = 'intelligence'`; clears them when scope leaves intelligence
  - `intelligenceDiscoveryTemplateIds` memo uses stored fields with name-based fallback for legacy templates
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/[id]/PromptWorkspaceClient.tsx`:
  - `templateFocus` reads `template.intelligence_focus` first, falls back to name regex for legacy templates
  - `isIntelligenceDiscovery` / `isIntelligenceEstablishment` read `template.intelligence_campaign_kind` first, fall back to `output_schema.name`

### Key Patterns
- **Match + fallback**: the campaign Prompts tab query uses `(focus AND kind match) OR (focus AND kind are NULL)` so legacy/untyped templates remain visible alongside focus-matched ones
- **Backward compatibility**: all focus/kind inference sites retain a name-based or output_schema-based fallback so templates that haven't been re-seeded still work
- **Fragments excluded**: composition fragments (`prompt_type = 'fragment'`) keep NULL focus/kind — they're identified by `fragment_kind` and assembled by `PromptComposerService`

## Compatible Prompts Tab — Organization + Triage Recommendations

The Prompts tab on the campaign detail page (`CampaignDetailClient.tsx`) surfaces prompt templates filtered by the campaign's `scope` and current `stage`. Two organizational layers help the operator pick the right workspace quickly:

### Category Grouping
- Prompts are grouped by `category` (e.g., `profile_repair`, `Digital Audit`, `Review Response`), with an "Uncategorized" bucket sorted last
- Within each group: `is_default` prompts pinned first, then sorted by `output_schema` name, then by name
- Each card shows badges: **Default** (blue), **Intelligence-aware** (violet — all business-scope seek prompts), **output_schema** (gray)

### Triage Recommendations
- When triage is decided (`isOperatorAccepted === true` OR `overriddenPlaybook != null`), a green **"Recommended by Triage"** section appears at the top
- `computeTriageRecommendations()` matches prompts via two layers:
  - **Signal-based** (higher rank): `SIGNAL_PROMPT_MATCHERS` maps signal code patterns to prompt name patterns (e.g., `CP_NAP_*` → "NAP Drift Audit", `DS_CLAIMED_STATUS` → "Unclaimed Profile Audit", `WC_*` → "Business Audit", review signals → "Business Audit")
  - **Playbook category-based** (broader fallback): `PLAYBOOK_CATEGORY_TO_PROMPT_CATEGORIES` maps the effective playbook's category to prompt template categories (e.g., `profile_repair` → `profile_repair`, `review_management` → `Digital Audit` + `Review Response`)
- Each recommended card carries green reason badges explaining why it was recommended
- Recommended prompts are excluded from the "All Prompts" section below to avoid duplication
- All computation is client-side (no new API endpoint); triage result is fetched via `getTriage(campaignId)` in parallel with `listPromptTemplates`

## Business Origin (Diaspora / Heritage Categorization)

Captures the international country/region of origin for diaspora-niche campaigns (e.g. "African Grocery Store" → country: Gambia, region: West Africa). The continent-level qualifier in the `category` field is too coarse for prompt composition, niche overrides, and outreach targeting — a Gambian, Ethiopian, and Nigerian grocery store serve very different diaspora communities.

### Schema (Migration 204)
- `mkt_campaigns_list.business_origin_country` — nullable `VARCHAR(100)`, free-text country name (not ISO code, since prompt-facing)
- `mkt_campaigns_list.business_origin_region` — nullable `VARCHAR(100)`, free-text region (absorbs the multi-country case, e.g. "West Africa" spans Gambia, Senegal, Nigeria)
- Both nullable; no backfill required. Legacy campaigns have NULL and keep working.

### Backend
- `apps/api/src/routes/marketing-ops.ts`:
  - `campaignBaseSchema` accepts `business_origin_country` + `business_origin_region` (optional strings, max 100)
  - POST + PUT handlers pass `businessOriginCountry` / `businessOriginRegion` through to the service
- `apps/api/src/services/MarketingCampaignService.ts`:
  - `CampaignInput` + `CampaignUpdateInput` gain `businessOriginCountry?` + `businessOriginRegion?`
  - `createCampaign` writes both fields (null when absent)
  - `updateCampaign` writes both fields when present in the input (`!== undefined` guard)
- `apps/api/src/services/BusinessProspectService.ts` — `createSiblingCampaign` copies both origin fields from the source campaign (origin travels with the business identity, like `tone` + `attributes`)
- `apps/api/src/services/scope-utils.ts` — `business_origin` added to `business`, `category`, and `intelligence` scope variable lists (origin is niche-level context, not business-name-specific)
- `apps/api/src/services/MarketingExecutionService.ts` — `renderTemplate` candidate map builds `business_origin` as `country, region` joined string (empty when both null)
- `apps/api/src/services/deliverable/prompts.ts`:
  - `BusinessContextFields` gains `businessOrigin: string | null`
  - All 9 deliverable prompt templates (review response, recovery playbook, listing corrections, CTA fixes, mobile catalog, GBP photo, availability inquiry, fulfillment pathway, hours sync) inject `{{business_origin}}` (fallback: `'unspecified'`)
- `apps/api/src/services/deliverable/BusinessContextService.ts` — `getBusinessContext` populates `businessOrigin` from `[country, region].filter(Boolean).join(', ')`

### Frontend
- `apps/web/src/services/MarketingOpsService.ts`:
  - `Campaign` interface gains `business_origin_country?` + `business_origin_region?`
  - `CampaignCreateInput` gains both fields
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx`:
  - `FormState` + `EMPTY_FORM` include both fields (default `''`)
  - `fetchCampaign` loads both fields
  - Create submit sends `strOrUndef(form.business_origin_country)` + `strOrUndef(form.business_origin_region)`
  - Edit submit sends raw values (so cleared state persists)
  - Two `SuggestiveSelect` fields ("Origin Country" + "Origin Region") placed after the Category field, with vocabulary sourced from existing campaign records via `distinctValues`
  - Helper text explains the diaspora-niche use case + that non-diaspora categories should leave them blank

### Key Patterns
- **Country name, not ISO code**: these fields are prompt-facing (interpolated into deliverable prompts as `{{business_origin}}`), not join keys. "Gambia" reads naturally in a prompt; "GM" does not.
- **Region absorbs multi-country**: most grocery stores are regional rather than single-country. A single region field ("West Africa") handles the case where a store serves multiple country communities without requiring an array.
- **Scope placement**: `business_origin` is in `business`, `category`, and `intelligence` scope variable lists — origin is niche-level context tied to the category, not the specific business name, so category-scope and intelligence-scope prompts can reference it too.

## Log Contact Modal — Per-Channel Result Options + Other Subtype

Extends the "Log contact" modal so every channel has a tailored result dropdown (mirroring the Phone channel's "Call result" pattern), and the "Other" channel gains a subtype selector (DM / Text / Email / Fax-Mail).

### Behavior
- **Phone** — unchanged: "Call result" (Connected / Voicemail / No Answer / Wrong Number / Disconnected) auto-maps to `outcome`.
- **Email** — Contact result: Replied / Sent-no-reply / Bounced / Unsubscribed / Marked as spam / Failed to send.
- **Website** — Contact result: Form submitted / Awaiting response / Form error / No contact form / Page not found.
- **Social** — Contact result: Replied / Sent-no-reply / Comment left / Profile not found / No DM access.
- **In Person** — Contact result: Met owner / Met staff / Not available / Left message with staff / Refused / Closed permanently / Wrong location.
- **Other** — Contact result: Replied / Sent-no-reply / Bad contact info / Refused / Failed to send. Plus an "Other type" subtype selector: DM / Text-SMS / Email / Fax-Mail.
- Selecting a contact result auto-sets the `outcome` field (operator can still override after, but backend enforces the mapping).

### Storage
- Reuses the existing `mkt_outreach_log.call_details` JSON column — no migration required.
- `call_details.call_result` is phone-only; `call_details.contact_result` is non-phone-only; `call_details.other_subtype` is `other`-channel-only. Backend Zod validation enforces these gates plus the per-channel allowed result set and the result→outcome mapping.

### Backend
- `apps/api/src/services/MarketingOutreachService.ts` — `CallDetails` extended with optional `contact_result` + `other_subtype`; new `ContactResult` + `OtherSubtype` union types.
- `apps/api/src/routes/marketing-ops.ts`:
  - `contactResultEnum` + `otherSubtypeEnum` Zod enums
  - `CONTACT_RESULT_TO_OUTCOME` map (result → required outcome)
  - `CHANNEL_CONTACT_RESULTS` map (channel → allowed result values)
  - `callDetailsSchema` extended with optional `call_result` / `contact_result` / `other_subtype`
  - `outreachLogSchema.superRefine` rewritten to handle both phone (`call_result` path) and non-phone (`contact_result` path) coherence checks

### Frontend
- `apps/web/src/services/MarketingOpsService.ts` — `CallDetails` + `ContactResult` + `OtherSubtype` types mirror backend; `LogContactInput` extended with optional `call_details` + `update_worksheet`.
- `apps/web/src/components/marketing-ops/LogContactModal.tsx`:
  - Per-channel result option arrays (`EMAIL_RESULT_OPTIONS`, `WEBSITE_RESULT_OPTIONS`, `SOCIAL_RESULT_OPTIONS`, `IN_PERSON_RESULT_OPTIONS`, `OTHER_RESULT_OPTIONS`) each with `outcome` mapping
  - `OTHER_SUBTYPE_OPTIONS` for the Other subtype selector
  - `contactResultOptionsForChannel(channel)` helper
  - `contactResult` + `otherSubtype` state; `useEffect` on `channel` resets result to first option of new channel + auto-maps outcome
  - Non-phone section renders "Contact result" dropdown + (when `other`) "Other type" dropdown
  - Submit sends `call_details: { contact_result, other_subtype }` for non-phone channels via `logContact`

## Outreach Checklist Bridge (Sprint 1)

Spec: `docs/LocalBiz/marketing_ops_outreach_checklist_bridge_sprint_plan.md`

Bridges the campaign execution layer (Openers, Follow-Ups, Pitch Construction, Contact Log) to the planning layer (Checklist Builder). Closes the gap where `outreach` checklist steps were hollow labels with no artifact detection or auto-completion.

### Migrations (apply in order)
- `185a_mkt_checklist_internal_link_step_type.sql` — DDL: adds `internal_link` to `chk_checklist_step_type` check constraint
- `185_mkt_outreach_checklist_bridge_backfill.sql` — Data-only: backfills `outreach_kind` + `auto_complete` on existing outreach starter steps; adds `internal_link` steps for Openers Workspace + Deliverables deep-links
- `186_mkt_outreach_state_signal_registry.sql` — Data-only: seeds `OX_*` signal rows in `mkt_signal_registry` under new `OX` family

### Backend
- `apps/api/src/services/OutreachChecklistBridgeService.ts` — bridge service:
  - `getOutreachState(campaignId)` — counts + derived flags from outreach tables
  - `checkStepSatisfaction(campaignId, step)` — checks if an outreach step's artifact exists
  - `onOutreachArtifactCreated(campaignId, kind, actor)` — auto-completes steps with `auto_complete=true` (fire-and-forget, called after opener/follow-up/pitch/contact-log creation)
  - `resolveStepDeepLink(campaignId, step)` — resolves internal URL for outreach + internal_link steps
  - `enrichStepViews(campaignId, stepViews)` — enriches checklist view with `outreachStatus` + `internalLink`
- `apps/api/src/services/triage/outreach-state-extractor.ts` — derives `OX_*` signals from outreach tables (openers, follow-ups, pitches, contact logs)
- `apps/api/src/services/triage/signal-taxonomy.ts` — `OX` family + 6 codes + `isOutreachStateSignal()` predicate
- `apps/api/src/services/triage/TriageEngineService.ts` — `evaluateTriage` + `evaluateAllMatchingPlaybooks` filter out `OX_*` signals (display-only, don't influence playbook selection)
- `apps/api/src/services/PlaybookChecklistService.ts`:
  - `internal_link` added to `CHECKLIST_STEP_TYPES`
  - `validateInternalLinkConfig` — validates named target against registry
  - `INTERNAL_LINK_TARGETS` — named target registry: `openers_workspace | deliverables | gallery | campaign_tab | recovery_detail | intake_form`
  - `getCampaignChecklist` enriches step views with `outreachStatus` + `internalLink` via bridge service (lazy import, best-effort)
  - `CampaignChecklistStepView` extended with `outreachStatus?` + `internalLink?`
- `apps/api/src/services/OutreachOpenerService.ts` — `fireBridgeAutoComplete` after execute/import (fire-and-forget)
- `apps/api/src/services/OutreachFollowUpService.ts` — `fireBridgeAutoComplete` after execute/import
- `apps/api/src/services/outreach-pitch/PitchService.ts` — fire-and-forget bridge call after `assemblePitch`
- `apps/api/src/services/MarketingOutreachService.ts` — fire-and-forget bridge call after `logContact`
- `apps/api/src/routes/marketing-ops.ts` — `GET /:id/outreach-state` endpoint

### Frontend
- `apps/web/src/services/MarketingOpsService.ts`:
  - `CHECKLIST_STEP_TYPES` includes `internal_link`
  - `INTERNAL_LINK_TARGETS` + `INTERNAL_LINK_TARGET_LABELS` — named target registry (mirrors backend)
  - `OUTREACH_KINDS` + `OUTREACH_KIND_LABELS` — outreach kind enum + labels
  - `ChecklistStepView` extended with `outreachStatus?` + `internalLink?`
  - `OutreachState` interface + `getOutreachState(campaignId)` method
- `apps/web/src/app/.../CampaignChecklistTab.tsx`:
  - Outreach steps render channel badge + kind label + satisfaction indicator (detected/not yet) + deep-link button + one-click "mark complete"
  - `internal_link` steps render "Open →" button with resolved URL
  - `SuggestionFormModal` captures `stepType` + type-specific `actionConfig` (URL for `url_check`, target for `internal_link`, channel+kind for `outreach`, credential_ref for `credentials`)
- `apps/web/src/app/.../ChecklistBuilderTab.tsx`:
  - `internal_link` in step type dropdown with indigo color
  - `internal_link` target selector + params JSON input
  - `outreach` kind selector + auto-complete checkbox + min follow-up # input
- `apps/web/src/components/marketing-ops/OutreachFollowUpCard.tsx` — checklist cross-link footer ("X/Y outreach steps complete →")
- `apps/web/src/app/.../OpenerWorkspaceClient.tsx` — checklist badge in campaign selector ("Checklist: X/Y outreach steps done →")

### Key Patterns
- **OX signals are display-only**: `isOutreachStateSignal()` predicate; triage engine filters them out of rule evaluation
- **Fire-and-forget bridge calls**: `import('./OutreachChecklistBridgeService').then(...)` pattern — checklist auto-completion never breaks the outreach flow
- **Named target registry**: `internal_link` steps use named targets (not raw URLs) — keeps step templates portable across campaigns; `{campaignId}` resolved at render time
- **Lazy import for circular dep avoidance**: `PlaybookChecklistService` lazy-imports `OutreachChecklistBridgeService` (bridge imports checklist service for step lookups)
- **Best-effort enrichment**: bridge enrichment failures are logged + swallowed — checklist renders without enrichment if bridge has issues

## Intelligence Profile City Scoping (Migration 205)

Closes the city-contamination gap: an intelligence profile established from a city-A establishment campaign was being applied to a city-B discovery campaign for the same `(category, focus)`, injecting city-A-specific discovery patterns, supplier names, and business examples into the city-B prompt. The discovery AI then returned city-A businesses.

### Schema (Migration 205)
- `mkt_intelligence_profiles.reference_city` — nullable `VARCHAR(100)`. NULL = city-agnostic (legacy/backfill sentinel).
- `idx_mkt_intel_profiles_active_category_city_focus` — partial unique index on `(category_key, reference_city, intelligence_focus) WHERE status = 'active' AND reference_city IS NOT NULL` — one active profile per (category, city, focus) triple.
- `idx_mkt_intel_profiles_active_category_focus_nullcity` — partial unique index on `(category_key, intelligence_focus) WHERE status = 'active' AND reference_city IS NULL` — preserves one-city-agnostic-profile-per-(category, focus) invariant.
- Backfill: `reference_city` populated from the most recent establishment campaign matching each profile's category_key. Profiles whose category has no establishment campaign remain NULL (city-agnostic).

### Resolution Semantics
`IntelligenceProfileService.resolve(category, focus?, city?, ctx?)`:
1. If `city` is provided: try exact `(category_key, reference_city, focus)` match (primary path).
2. Fall back to city-agnostic `(category_key, reference_city=NULL, focus)` match — logged warning.
3. Fall back to `(category_key, focus)` match ignoring city — logged warning (cross-city contamination possible).
4. If `focus` is omitted (business-scope §1B path): city is still honored; focus filter is dropped.

### Render-Time City Mismatch Guard
`renderProfileBlock(profile, targetCity?)` and `renderBusinessProfileBlock(profile, targetCity?)`:
- Emit a `CITY RETARGETING DIRECTIVE` when the profile's `reference_city` differs from the campaign's target city — instructs the AI to apply category-level knowledge but re-derive concrete discovery queries, supplier lists, and business examples for the target city.
- Emit a `CITY APPLICATION DIRECTIVE` when a city-agnostic profile is applied to a city-specific campaign.

### Establishment Import
`MarketingPromptService.importExternalResult` now reads the establishment campaign's `city` and stamps it onto the imported draft via `importAsDraft({ referenceCity })`. This is the key fix: the establishment campaign's city flows end-to-end into the profile's reference_city.

### Key Files
- `apps/api/src/services/intelligence/IntelligenceProfileService.ts` — `resolve`, `createProfile`, `importAsDraft`, `activateDraft`, `publishVersion`, `renderProfileBlock`, `renderBusinessProfileBlock`, `normalizeReferenceCity`
- `apps/api/src/services/intelligence/PromptComposerService.ts` — `composeIntelligencePrompt({ category, focus, city })`
- `apps/api/src/services/MarketingExecutionService.ts` — passes `input.campaign.city` to composer + business-scope resolver
- `apps/api/src/services/MarketingPromptService.ts` — stamps establishment campaign city onto imported draft
- `apps/api/src/routes/marketing-ops.ts` — `resolve` route accepts `?city=` query; `create` route accepts `referenceCity` body field
- `apps/web/src/services/MarketingOpsService.ts` — `resolveIntelligenceProfile(category, focus?, city?)`, `createIntelligenceProfile({ referenceCity })`, `IntelligenceProfile.reference_city`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/intelligence-profiles/IntelligenceProfilesClient.tsx` — displays reference_city badge (cyan for city-scoped, gray for city-agnostic)
- `apps/api/src/scripts/seed-intelligence-profile-establishment-template.ts` — establishment template now instructs the AI to produce city-specific concrete examples

### Tests
- `apps/api/src/services/__tests__/IntelligenceProfileService.focus-alignment.test.ts` — 24 tests (existing focus tests updated for `reference_city: null` filter + 13 new city-scoped tests)
- `apps/api/src/services/__tests__/PromptComposerService.test.ts` — 5 tests (city pass-through test added)
- `apps/api/src/services/__tests__/ResolvePrompt.test.ts` — 9 tests (business-scope city pass-through assertion updated)

## Directory Seed ↔ Campaign Link (Migration 230)

Bridges `directory_presence_seeds` (unclaimed public listings) with `mkt_campaigns_list` (operator-validated prospect campaigns) so campaign signals can enrich the seed's public SEO surface. One physical business may have many sibling campaigns (multi-archetype), so this is a join table — not a 1:1 FK on the seed.

### Schema (Migration 230)
- `directory_seed_campaign_links` — join table (`seed_id`, `campaign_id`, `tenant_id`, `link_role`, `nap_match_confidence`, `nap_match_summary` JSONB, `last_synced_at`, `last_sync_fields[]`)
- `link_role` CHECK: `primary` (one per seed, enforced by partial unique index) / `sibling` / `recovery`
- `nap_match_confidence` CHECK: `high` / `medium` / `low` / `none`
- Unique on `(seed_id, campaign_id)` regardless of role

### Backend
- `apps/api/src/services/DirectorySeedCampaignLinkService.ts`:
  - `computeNapMatch(seedId, campaignId)` — normalized business name + address + phone + city comparison; high = name match AND (address OR phone match) AND city match
  - `linkCampaign(seedId, campaignId, role)` — creates link, computes NAP match, **auto-projects campaign signals only when NAP confidence is high**
  - `unlinkCampaign(seedId, campaignId)` — removes link; does NOT roll back projected fields (provenance rows remain as audit trail)
  - `listLinks(seedId)` — returns links with campaign summary
  - `buildDiff(seedId, campaignId)` — per-field diff (campaign value vs current seed value) for operator review
  - `syncFromCampaign(seedId, campaignId, fields[])` — projects selected fields onto listing + writes `directory_field_provenance` rows with `source_name = 'linked_campaign'`, `confidence = 'high'`, `show_on_public = true`
  - `findCandidateCampaigns(seedId, query?)` — searches unlinked campaigns by business name similarity or city+category match
- `apps/api/src/routes/directory-presence-admin.ts` — 6 new endpoints under `/api/admin/directory-presence/presence-seeds/:id/campaign-links`:
  - `GET  /campaign-links` — list linked campaigns
  - `GET  /campaign-candidates?query=` — search unlinked campaigns
  - `GET  /campaign-links/:campaignId/diff` — per-field diff
  - `POST /campaign-links` — link a campaign (body: `{ campaignId, role }`)
  - `DELETE /campaign-links/:campaignId` — unlink
  - `POST /campaign-links/:campaignId/sync` — project fields (body: `{ fields[] }`)
- `apps/api/src/lib/id-generator.ts` — `generateDirectorySeedCampaignLinkId(tenantId)` (`dscl-` prefix)

### Projection policy
- **Auto-projection on link**: only when `nap_match_confidence = 'high'`. Default projected fields: name, address, hours, phone, website, primaryCategory, secondaryCategories, originCountry, originRegion, neighborhood.
- **Manual sync**: operator opens diff modal, picks fields explicitly. Overwrites operator-entered seed values; provenance row preserves the audit trail.
- **Name/address/hours** (operator-verified on the campaign via Verify Record → `business_name`, `address_line1/2`, `address_city/state/zip`, `business_hours`) resolve through `resolveCampaignNap` (lib/canonical-nap) — the same contract `createFromCampaign` uses, so the diff shows exactly what "Add to place listing" would write. No market-scope fallback. Name also mirrors to `tenants.name`, `tenant_business_profiles_list.business_name`, and prepends into `dps.name_variants` (superseded name stays as a variant). Address mirrors to `dps.city/state` and the business profile's structured columns; only resolved components write (a missing campaign zip never nulls seed data). Hours mirror to `business_hours_list` + legacy profile hours exactly like `updateFields` (public hours endpoints read that table, not `dl.business_hours`).
- **Origin country/region/neighborhood** → merged into `directory_listings_list.keywords[]` as prefixed tokens (`origin_country:Senegal`, `neighborhood:Broad Ripple`) for SEO.
- **Primary category** projection also mirrors to `directory_presence_seeds.category` so `/place` browse pages stay consistent.
- **Directory profiles** (JSON) → provenance row only (not flattened onto listing).

### Frontend
- `apps/web/src/services/DirectoryPresenceAdminService.ts` — `listCampaignLinks`, `findCampaignCandidates`, `getCampaignDiff`, `linkCampaign`, `unlinkCampaign`, `syncFromCampaign` + types `DirectorySeedCampaignLink`, `DirectoryCampaignCandidate`, `DirectoryCampaignDiffEntry`
- `apps/web/src/app/(platform)/settings/admin/directory/presence-seeds/[id]/LinkedCampaignsPanel.tsx` — panel with:
  - Linked campaign cards (role badge, NAP confidence badge, last sync metadata, expandable NAP match details)
  - "Link Campaign" picker modal (search + role selector + candidate list with already-linked state)
  - "Sync" diff modal (per-field campaign-vs-seed comparison, checkbox select, project button)
  - "Unlink" with confirm (warns that projected fields stay)
- Mounted on seed detail page after the Outreach & Enrichment section

### Provenance field keys (new, campaign-sourced)
- `origin_country`, `origin_region`, `neighborhood`, `description`, `directory_profile`, plus the shared NAP keys `name`, `address`, `hours` when projected via sync
- All campaign-sourced provenance: `source_name = 'linked_campaign'`, `source_url = /settings/admin/marketing-ops/recovery/:campaignId`, `confidence = 'high'`, `show_on_public = true`

### Seed call scripts — audit ammunition + sibling-aware anchors (added 2026-10-08)

The seed detail page has two cooperating sections: "Outreach Anchors" (recording-aware list: per-card Record contact on `active` anchors, Activate/Retire lifecycle, "Suggest variants") and "Verification Call Script" (anchor dropdown re-fetches `CallScriptService.assembleForSeed(seedId, anchorId)`; the anchor drives only the middle stages — `verification`/`pain_probe`/`transition` — while `verify`/`report_hook`/`claim_ask`/`close` stay fixed template copy; `(none)` = generic verification). The campaign-side sibling is the Openers "Call Script" tab (`assembleForCampaign`, five-stage cold-call arc with ranked `HOOK_LIBRARY` hooks — a different structure, same service + same `mkt_outreach_anchors` table).

- **`ammunition: OutreachAmmunitionEntry[]`** rides both assembled payloads — verbatim problem→hook→fix copy extracted from the audit's `outreach_problems` contract (Triage & Repair Outreach Problems spec §5). Campaign path reads the `business_analysis` audit already loaded for signal severity; seed path resolves the primary-linked campaign (`directory_seed_campaign_links`, `link_role` asc) → `BusinessContextService.getLatestAuditData` (sibling-BA inheritance included free). Reference-only — never interpolated into stage text; `[]` when no audit carries it. Both panels render the shared `OutreachProblemsSection` (copy buttons, no "Use as opener" hand-off wired there).
- **`POST /presence-seeds/:id/outreach-anchors/suggest`** → `suggestVariantsForSeed`: for EVERY linked campaign (primary/sibling/recovery), drafts anchors from `mkt_campaigns_list.repair_triage_briefing.outreach_problems` + latest-per-platform `mkt_audits_list` `audit_data.outreach_problems` (website_positioning audits carry them too), with a `pitch` fallback (primary_angle→observed_issue, opener_hook→verification_question, pain_points→evidence) when a briefing has none. **Dual-scoped** (`seed_id` + source `campaign_id`) — surfaces on the seed picker AND that sibling's Call Script tab, and both ledgers write on contact. Title prefix `[campaign_category · repair_track]` labels the variant; `anchor_type` by source platform + keyword sniff (`website_positioning`→`website_or_profile_claim`, listing/nap/duplicate/hours→`listing_accuracy`, categor*→`category_verification`, else `customer_discovery_problem`). Field map: problem→observed_issue+title, regular→verification_question, hook→pain_question, solution→recommended_transition, outreach_use→operator_thesis suffix, evidence→evidence_summary. Idempotent: `evidence_refs` marker `{kind:'sibling_variant',campaign_id,source,index}` + `observed_issue` text dedupe, so re-running after a re-audit adds only new findings.
- **`listAnchorsForSeed` unions** `seed_id = ?` OR `campaign_id IN (SELECT campaign_id FROM directory_seed_campaign_links WHERE seed_id = ?)` — sibling-authored campaign anchors appear on the seed page (badged "via linked campaign" when `anchor.seed_id !== seedId`) and in the script dropdown. `assembleForSeed`/`assembleForCampaign` accept any anchorId — no scope check.
- **`recordContactWithAnchor` dual-ledger fallback** — `effectiveCampaignId = param ?? anchor.campaign_id`: a seed-side contact on a campaign-scoped/dual-scoped anchor writes `mkt_outreach_log` for that campaign too (§12.5) — previously the seed route passed no campaignId so campaign-scoped anchors silently missed the campaign ledger. Seed-only anchors unchanged. `snapshotAnchor` factored into `buildAnchorSnapshot` (private) so the contact path loads the anchor row once.
- Tests: `CallScriptService.test.ts` (+5 ammunition: surface/empty/malformed-filter/seed-link-resolution/unlinked-empty), `ManualOutreachAnchorService.suggestVariants.test.ts` (8: dual-scope+field map, audit-source variants, pitch fallback, dedupe idempotency, unlinked-empty, union SQL, dual-ledger write, seed-only skip).

## V3.1 Entry Presence Tier (Migration 231)

Implements the V3.1 tier strategy: `directory_presence` (free gateway) → Entry Presence triad (`presence`, `discovery`, `storefront`) → Commerce tiers → Scale tiers. The `presence` tier is a clean directory-enrichment-only tier (display name "Starter", $19/mo) that does NOT inherit Google or platform marketplace capabilities. The legacy `starter` tier remains dormant and inactive.

Strategy source of truth: `docs/PLATFORM_STRATEGY_V3.md`
Progressive upgrade spec: `docs/LocalBiz/directory_presence_progressive_upgrade_spec.md`
Tier hierarchy skill: `.devin/skills/tier-hierarchy.md`

### Tier taxonomy
| Key | Layer | Price | Display | Role |
|-----|-------|------:|---------|------|
| `directory_presence` | Gateway | $0 | Directory Presence | Free seed/claim on-ramp |
| `presence` | Entry Presence | $19 | Starter | Paid in-house directory surface (logo, about, gallery, layouts) |
| `discovery` | Entry Presence | $29 | Discovery | Google visibility surface |
| `storefront` | Entry Presence | $59 | Storefront | Platform marketplace/storefront surface |
| `commitment` | Commerce | $79 | Commitment | Deposit-only money mode |
| `ecommerce` | Commerce | $99 | E-commerce | Full-payment money mode |
| `omnichannel` | Commerce | $149 | Omnichannel | Deposit + full-payment mode |
| `professional` | Scale | $199 | Professional | Advanced single-location tier |
| `organization` | Scale | $499 | Organization | Organization tier |
| `enterprise` | Scale | $499 | Enterprise | Multi-location/enterprise tier |

Legacy inactive tiers (do NOT reactivate): `starter`, `google_only`, `chain_starter`.

### Hierarchy
```text
directory_presence: []
presence:           [directory_presence]
discovery:          [directory_presence]
storefront:         [discovery, directory_presence]
```
`presence` does NOT inherit `google_only` or `starter`. It is directory enrichment only.

### Migration 231
- `database/migrations/231_entry_presence_tier.sql`
- Adds `billing_type` column to `subscription_tiers_list` (default `'subscription'`, `directory_presence` set to `'none'`)
- Inserts `presence` tier row ($19, sort_order=10, `billing_type='subscription'`)
- Seeds 6 directory-entry feature keys: `directory_entry_logo_on`, `directory_entry_about_on`, `directory_entry_gallery_on`, `directory_entry_social_on`, `directory_entry_layout_editorial`, `directory_entry_layout_immersive`
- Links features to `directory_entry` capability type
- Seeds `tier_features_list` for `presence` (directory enrichment only)
- Renumbers active V3 tier sort orders (0/10/20/30/40/50/60/70/80/90)

### Backend
- `apps/api/src/services/resolvers/DirectoryEntryOptionsResolver.ts` — reads `directory_entry_logo_on` / `directory_entry_about_on` (with `_enabled` fallbacks); produces `logo_enabled`, `can_show_logo`, `about_enabled`, `can_show_about`
- `apps/api/src/services/resolvers/types.ts` — `EffectiveDirectoryEntryOptions` includes the 4 new fields
- `apps/api/src/routes/public-tenant-capabilities.ts` — expired capability response includes false-valued logo/about fields
- `apps/api/src/routes/directory-presence-upgrade.ts` — V3.1 gateway upgrade API:
  - GET `/:tenantId/upgrade/options` — when current tier is `directory_presence`, returns the triad (`presence`, `discovery`, `storefront`) with mode metadata (`mode`, `surface`, `tagline`, `isPrimary`) and `isGatewayUpgrade: true`; non-gateway tenants get the flat sort_order ladder
  - POST `/:tenantId/upgrade` — enforces: from gateway, only the three Entry Presence modes are valid targets (`invalid_gateway_upgrade_target` error otherwise); paid tiers require `paymentMethodId`
- `apps/api/src/middleware/tier-access.ts` — `presence` added to `TIER_HIERARCHY`, `tierOrder`, display names, pricing
- `apps/api/src/utils/tier-limits.ts` — `presence` added to `SubscriptionTier` type and `TIER_LIMITS` (maxSkus: 0 — directory mode, no catalog)
- `apps/api/src/utils/trial-tier-transparency.ts` — `trial_presence` → `presence` mapping
- `apps/api/src/services/GrowthTipService.ts` — `presence` added to `TIER_ORDER`

### Frontend
- `apps/web/src/lib/tiers/tier-features.ts` — clean `presence` entry (directory-mode only); `TIER_HIERARCHY.presence = ['directory_presence']`; `TIER_DISPLAY_NAMES.presence = 'Starter'`; `TIER_PRICING.presence = 19`
- `apps/web/src/lib/tiers/tier-resolver.ts` — `presence` in `TierInfo['level']`, `mapTierLevel`, hierarchy comparison, upgrade options
- `apps/web/src/lib/tiers/content-consistency.ts` — `presence` progression entry
- `apps/web/src/lib/growth-tips/tipEngine.ts` — `presence` in `TIER_ORDER`
- `apps/web/src/services/CapabilityResolutionService.ts` — `logoEnabled`, `aboutEnabled`, `canShowLogo`, `canShowAbout`
- `apps/web/src/services/UnifiedCapabilityService.ts` — `BackendEffectiveDirectoryEntry` extended; `mapDirectoryEntry()` maps snake_case → camelCase
- `apps/web/src/services/DirectoryPresenceUpgradeService.ts` — `UpgradeTierOption` gained `mode`, `surface`, `tagline`, `isPrimary`, `billingType`; `UpgradeOptions` gained `isGatewayUpgrade`
- `apps/web/src/app/t/[tenantId]/settings/subscription/upgrade/page.tsx` — V3.1 mode picker:
  - When `isGatewayUpgrade` is true: renders mode badges (`directory`/`google`/`platform`), taglines, surface labels, "Recommended" badge on Presence
  - Presence card gets blue ring + border highlight as primary CTA
  - Paid tiers show inline Stripe `CardElement` form when selected (SetupIntent flow → `paymentMethodId` → `upgrade()` call)
- `apps/web/src/app/directory/[slug]/page.tsx` — passes `directoryEntryOptions` through `layoutProps`
- `apps/web/src/app/directory/[slug]/layouts/types.ts` — `DirectoryEntryLayoutProps` includes capability state
- All 4 directory layouts (Classic, Editorial, Immersive, Premium) — gate logo with `canShowLogo`, about with `canShowAbout`; default `?? true` so existing tenants keep rendering
- `apps/web/src/app/place/[slug]/layouts/PlaceEntryEditorialLayout.tsx` — gates logo with `dirEntryOpts?.canShowLogo`
- `apps/web/src/app/directory/claim/[token]/DirectoryClaimClient.tsx` — claim success CTA is "Choose Your Presence Mode" (not "Upgrade to Sell Online")
- `apps/web/src/components/dashboard/TierUpgradeCard.tsx` — dashboard CTA is "Choose Your Presence Mode"

### Tests
- `apps/api/src/services/resolvers/CapabilityResolversOnOff.test.ts` — 8 new `DirectoryEntryOptionsResolver` tests (logo/about gating, flexible tier, disabled capability, layout keys)
- `apps/web/src/lib/tiers/entry-presence-tier.test.ts` — 21 tests verifying presence feature boundaries, hierarchy isolation, legacy starter dormancy, gateway free-tier limits
- `apps/web/vitest.config.ts` — vitest config for web app (node environment, `@` alias)

## Profile Repair Briefing Persistence & Opener Bridge (Migration 232)

AI-generated triage and per-issue briefings are persisted as campaign artifacts (not just execution logs) and can be wired into the Openers workspace.

### Schema (Migration 232)
- `mkt_campaigns_list.repair_triage_briefing` JSONB NULL — persists the triage briefing (`scope`, `viability`, `pitch`, `risks`, `recommended_track`, etc.) with provenance metadata (`_execution_id`, `_validated`)

### Backend persistence
- `ProfileRepairPromptService.executeSeekSync()` — after running the triage template (`mpt-profile-repair-triage-default`), parses + validates the AI output, persists the briefing to `repair_triage_briefing` with `_execution_id` and `_validated` flags. Best-effort output (strict Zod fails but `profile_repair_triage` exists) is persisted with `_validated: false`. Unparseable output does NOT overwrite the previous briefing.
- `ProfileRepairPromptService.importExternalResult()` — persists valid imported triage output the same way.
- Per-issue seek templates (`mpt-profile-repair-nap-drift-seek`, etc.) do NOT persist to `repair_triage_briefing` — their output (`profile_repair_audit`) is rendered from `mkt_prompt_executions_list.raw_output` by the frontend.

### Opener bridge
- `OutreachOpenerService.createFromBriefing()` — creates/updates an opener from an AI briefing's `opener_hook`. Mirrors `importOpener` upsert + quality gate + bridge autocomplete logic, but:
  - `source = 'ai_briefing'` (distinct from `'ai'` and `'external'`)
  - `hook_angle = null` (briefing's `primary_angle` is free-text, not a HOOK_LIBRARY key)
  - `extracted_fields` includes `{ sourceBriefing, executionId, primaryAngle }` for provenance
- Route: `POST /api/admin/marketing-ops/openers/from-briefing` (before the catch-all)
- Frontend: `MarketingOpsService.createOpenerFromBriefing()` + `OpenerSource` widened to `'ai' | 'external' | 'ai_briefing'`

### Frontend
- `apps/web/src/components/marketing-ops/RepairTrackPanel.tsx` — reads `campaign.repair_triage_briefing` on mount (survives refresh + track confirmation); re-runs triage with explicit `templateId = 'mpt-profile-repair-triage-default'` (so post-confirmation re-runs don't accidentally run a per-issue seek); shows "Unverified" badge when `_validated === false`; "Create Opener from Hook" button
- `apps/web/src/components/marketing-ops/RepairBriefingCard.tsx` — renders per-issue `profile_repair_audit` executions (scope, impact, pitch, risks) + "Create Opener from Hook" button
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` — fetches executions via `listExecutions`, filters by `output_schema.name === 'profile_repair_audit'`, renders `RepairBriefingCard`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/openers/OpenerWorkspaceClient.tsx` — source badge shows "AI Briefing" for `ai_briefing` source

### Tests
- `apps/api/src/services/__tests__/OutreachOpenerService.test.ts` (4 tests) — create with `source='ai_briefing'`, upsert in place, quality-gate failure doesn't block, provenance fields
- `apps/api/src/services/__tests__/ProfileRepairPromptService.persistence.test.ts` (4 tests) — strict validation pass (`_validated=true`), best-effort (`_validated=false`), unparseable output (no write), per-issue template (no write)

### `repair_issue_type` is a VarChar(40) *token*, not a diagnosis (added 2026-10-17)

`mkt_campaigns_list.repair_issue_type` is `@db.VarChar(40)` and doubles as a lookup key — `ProfileRepairPromptService.resolveSeekTemplateId` switches on the exact token (`nap_drift` / `unclaimed_profile` / `platform_gap`) and silently falls back to the triage template for anything else. The triage AI's `issue_type_confirmed` is free-form, so a compound diagnosis (e.g. `"listing_hygiene_and_shelf_visibility (nap_drift + missing_category + missing_hours + no_website)"`, 88 chars) 500'd `POST /admin/marketing-ops/:id/switch-track` with Prisma's *"The provided value for the column is too long for the column's type"* — and would have missed the template lookup even if it had fit. Every write now normalizes through `normalizeRepairIssueType` (`apps/api/src/lib/repair-issue-type.ts`): exact token → first canonical token appearing in the string (compound answers lead with their primary diagnosis) → keyword hint → slugified + clamped to 40. Applied at all five write sites (`MarketingCampaignService.create` + `switchRepairTrack`, `RepairFulfillmentService.escalatePlatform`, `BusinessProspectService.createSiblingCampaign`, `DisputeIntakeService.submitIntake`), plus zod transforms on the route schemas (`switchTrackSchema`, `platformEscalateSchema`, `createSiblingSchema` — the last had a latent `.max(255)` against a 40-char column) and on `profileRepairTriageSchema.issue_type_confirmed` so the persisted briefing and the RepairTrackPanel display are canonical. The triage prompt suffix now names the ten-token vocabulary instead of `<string>`. Adding a triage term means adding it to `REPAIR_TRIAGE_VOCABULARY` *and* `SIGNAL_TO_TRIAGE_VOCAB`. Tests: `apps/api/src/lib/__tests__/repair-issue-type.test.ts`, `apps/api/src/validators/__tests__/profile-repair-output.schema.test.ts`.

### Platform signal weights in the triage briefing (2026-09-20, seed marker `triage-briefing-v4`)
Per `CATEGORY_PLATFORM_SIGNAL_WEIGHT_SPEC.md` §2 "Reported, not applied", `resolvePrompt`'s `signal_triage` path appends a `=== PLATFORM SIGNAL WEIGHTS ===` block (weights table + `LEAD PLATFORM:` + read-only directive) after the gold-standard block and before market context — in ALL three sub-paths (CI present, gold-standard-only, neither), since weights live on every active profile for the category. The render reuses the seek auto-source's `resolveSignalWeightsForCampaign` result (hoisted `resolvedSignalWeights`) — one resolution per render; `serializeSignalWeightContext` returns `''` when nothing resolves → legacy render preserved. The block supplies the "where the customers are" premise + severity weighting; it never feeds scoring. The `fulfill_target` path also appends the block (lazy resolution — weights are resolved there when the seek auto-source didn't run), so the citation package's fix-sheet ordering follows the same priority.

### Two-lane audit consumption in repair prompts (2026-09-27, seed marker `triage-briefing-v8`)

Repair seek/fulfill prompts consume `{{audit_results}}` from **either** audit lane — `serializeAuditResults` (`ProfileRepairPromptService`) is shape-dispatched: `business_analysis` audits serialize as `## Audit Coverage: FULL` with the audit's own blocks consumed directly (summary, identity, canonical NAP, Platform Status enriched with `render_controls` determinations — `business_specific_failure` renders as `verified absent`, not just `unable_to_verify` — website + conversion opportunities, operational status, review metrics, scoreline, gap analysis, quality gates, market opportunities, audit outreach problems, detected signals, recommended attributes, data quality). `category_identification` audits (the partial/fast path — seed + cat-id scan, no BA yet) serialize as `## Audit Coverage: PARTIAL` with a "presence observations ≠ verified findings" caveat plus the cat-id blocks (`business_summary`, `nap`, `digital_footprint` platform-presence snapshot, candidate categories, evidence sources, data quality). **Stub `business_analysis` audits** (`audit_metadata.source` ∈ `STUB_BUSINESS_ANALYSIS_AUDIT_SOURCES` — the upstream partial lane's carrier from discovery scan / queue / derive) serialize as `## Audit Coverage: PARTIAL — signal stub only` with provenance + `detected_signals` + `discovery_signal_map`; they must never reach the FULL banner (stub detection is by `audit_metadata.source`, checked before the BA shape test). Unknown/empty shape → `NONE` banner. Audit-row selection is `pickRepairSourceAudit` — real BA (`!isStubBusinessAnalysisAudit`) → cat-id → stub — wired into `executeSeekSync`/`renderPromptText`/`importExternalResult`/`buildSeekVariables` and the `resolvePrompt` G-2 reader in `MarketingExecutionService` (which now falls back to cat-id when no BA audit exists). `extractSignals`' derive tier bridges `digital_footprint` into repair signals on the partial lane (`platforms_found[].claimed === false` → `DS_CLAIMED_STATUS`; `website_status: none_found|broken` → `WC_MISSING_WEBSITE|WC_BROKEN_WEBSITE`) — cat-id audits never emit `detected_signals[]`, so the derive tier always runs for them. DeliverableSourceService keeps its own older serializer — untouched.

### Platform-aware outreach ranking (2026-10, seed markers `issue-briefing-v3`, `fulfill-package-v5`)
The lead-platform formula is generalized to a ranking: `rankPlatformPriorities(auditData, resolved)` (IntelligenceProfileService) returns every platform that BOTH carries a resolved weight AND shows an audit gap, sorted by `signal_weight × gap_severity` desc — entry `[0]` is what `selectLeadPlatform` returns. `signalPlatformDisplayName` maps canonical keys to owner-facing names ("Apple Maps", "BBB"). Consumers:
- **HookSuggestionService / CallScriptService** — `HookTemplate.platforms?: string[]` tags bind hooks to canonical platform keys; the severity tie-break keys are scaled by `×(1 + platformScore)` (hook's best platform score; 0 for untagged/unweighted → byte-identical legacy order). A residual `platformScore` tie-break orders the signal-less tail toward high-traffic platforms. Result shapes expose `platform_priorities` (and `callContext.platform_premise`); `{{lead_platform}}` resolves in hook bodies, call-script stages, and ManualOutreachScriptService merge context — the placeholder stays visible when nothing resolves.
- **Issue briefings + citation-package seeds** — `outreach_problems` rank severity × weight within the issue-aligned set; fix sheets and the submission-guide order of operations follow the platform ranking.
All weight resolution is best-effort try/catch — unresolved → empty priorities → exactly the pre-weight behavior.

### Platform weights across all outreach surfaces (2026-11)
`resolveOutreachPlatformContext` (`outreach-openers/platform-context.ts`) is THE shared resolver — hoisted from `OutreachOpenerService`'s inline block; returns `{platformSignalWeights, platform_premise, platform_weights}`. Every `extractFields` caller resolves it at the `common` seam (Opener/Header/Closer/FollowUp services), so `platform_premise` + `platform_weights` (ranked top-6 with `basis`) land in every archetype's `extracted_fields`. Instruction tails: `buildPlatformPremiseInstruction` + `buildPlatformPriorityInstruction` (exported from `archetype-prompts.ts`, applied to ALL archetypes — the missing-platform ordering bullet self-gates on `missing_platforms` presence) are appended by `buildArchetypePrompt` and `withPlatformInstructions` in `outreach-pitch/prompts.ts` (header/closer) + `buildFollowUpPrompt`. Rule encoded in the instructions: cite top platform(s) as category fact with rationale; translate weights to owner language ("most"/"first"/"second to"), never recite the score. `CallScriptService` already resolved `rankPlatformPriorities`; `platform_priorities` entries now carry `scope`+`basis`, and `CallScriptPanel` renders the ranked card (operator sees numbers + rationale; owner never does).

## Gold Standard Scan — Two-Template Pattern (Establishment vs Discovery)

Gold-standard scans use TWO distinct prompt templates, gated by `intelligence_campaign_kind` on the campaign. The Prompts tab filters templates by `intelligence_campaign_kind` (with a NULL fallback for legacy templates), so a discovery campaign sees only the discovery template and an establishment campaign sees only the establishment template.

### Templates (seeded by `apps/api/src/scripts/seed-gold-standard-scan-template.ts`)
- `mpt-seed-gold-standard-scan-001` — **Establishment** (`intelligence_campaign_kind = 'establishment'`): instructs the analyst to DERIVE `expected_fields` and `quality_gates` from the top candidates. The validated JSON is persisted as a DRAFT gold-standard profile by `IntelligenceProfileService.importAsDraft()`.
- `mpt-seed-gold-standard-scan-discovery-001` — **Discovery** (`intelligence_campaign_kind = 'discovery'`): instructs the analyst to EVALUATE new candidates against the already-established gold-standard profile (injected at render time). The validated JSON creates an audit; it does NOT create a profile draft.

### Render-time profile injection
- `MarketingExecutionService.resolvePrompt()` — when `intelligence_focus === 'gold_standards'` AND `intelligence_campaign_kind === 'discovery'`, resolves the active gold-standard profile via `IntelligenceProfileService.resolveGoldStandard(category)` and injects it via `serializeGoldStandard(profile, 'discovery')`.
- Establishment scans skip injection (they ARE the derivation step) and render the template body as-is.
- When no active profile exists for a discovery scan, a degraded-mode warning is appended (the analyst falls back to deriving expected_fields from candidates).

### `GoldStandardRole` type (`apps/api/src/services/intelligence/IntelligenceProfileService.ts`)
- `'benchmark'` — audit/seek prompt: compare a business against the gold standard
- `'target'` — fulfill prompt: produce fixes that move toward the gold standard
- `'discovery'` — gold-standard discovery scan: evaluate new candidates against the established expected fields and quality gates (do NOT re-derive)

### `serializeGoldStandard(profile, 'discovery')` output
Emits a `=== GOLD STANDARD DISCOVERY CRITERIA ===` block containing:
- Universal expected fields (canonical NAP, hours, website)
- Per-platform expected fields (primary category, attributes, description, photo count, branding expectations)
- Quality gates (non_negotiable + recommended)
- Pattern exemplars (candidates flagged `is_gold_standard` in the establishment scan, with destination URLs)

The directive tells the analyst to: evaluate each candidate against the established gates, mark `is_gold_standard = true` ONLY for candidates that pass ALL non_negotiable gates, and ECHO the established `expected_fields` in the output (not re-derive them).

### Re-seeding
```bash
cd apps/api
doppler run --config local -- npx tsx src/scripts/seed-gold-standard-scan-template.ts
doppler run --config prd -- npx tsx src/scripts/seed-gold-standard-scan-template.ts
```
Idempotent — updates existing templates in place and creates the discovery template if missing.

## Gold Standard Profile — Platform-Aware Resolution (Migration 236)

Gold-standard profiles are now platform-scoped, mirroring the existing city-aware resolution pattern. The `mkt_intelligence_profiles` table has a `reference_platform` column (VARCHAR(20), nullable):
- `NULL` = cross-platform profile (the default; backward-compatible with all existing profiles)
- `'google'` | `'yelp'` | `'facebook'` | `'bbb'` | `'apple_maps'` | `'bing'` = platform-specific profile

### Identity tuple
`importAsDraft()` now uses `(category_key, intelligence_focus, reference_city, reference_platform)` as the identity tuple. A google-specific establishment scan and a cross-platform establishment scan for the same category get **distinct profile ids** — they coexist rather than shadowing each other.

### Resolution fallback chain (`IntelligenceProfileService.resolve()`)
When `platform` is provided, the resolver narrows from most-specific to least-specific:
1. `(category, focus, city, platform)` — city + platform exact
2. `(category, focus, city, platform=null)` — city exact, cross-platform fallback
3. `(category, focus, city=null, platform)` — city-agnostic, platform exact
4. `(category, focus, city=null, platform=null)` — city-agnostic, cross-platform fallback
5. Legacy focus-only / category-only fallbacks (ignore platform)

This means a business audit on Google first looks for a google-specific gold-standard profile; if none exists, it falls back to the cross-platform profile's google section. You only need per-platform profiles when the cross-platform benchmark isn't deep enough.

### Import hook (`MarketingPromptService`)
When a gold-standard scan result is imported, `platform_focus` from the scan JSON is persisted as `reference_platform`. If `platform_focus === 'all'`, `reference_platform` is set to `NULL` (cross-platform).

### `resolveGoldStandard(category, platform?, ctx?)`
- `platform` is optional; when omitted, resolves cross-platform profiles only (backward-compatible).
- When provided, follows the platform-aware fallback chain above.

### Callers that pass platform
- `MarketingExecutionService.resolvePrompt()` — discovery scans pass `campaign.intelligence_platform`
- `MarketingExecutionService` audit/fulfill/triage paths — pass `campaign.intelligence_platform` when available
- Frontend `GoldStandardEstablishmentPanel` / `GoldStandardDiscoveryPanel` — pass `campaign.intelligence_platform`
- Frontend `PromptWorkspaceClient` — passes `selectedCampaign.intelligence_platform` for gold-standard focus
- API route `GET /intelligence-profiles/resolve/:category?platform=...` — accepts `platform` query param
- API route `POST /intelligence-profiles` — accepts `referencePlatform` in body

### Frontend
- `IntelligenceProfile` interface includes `reference_platform: string | null`
- `resolveIntelligenceProfile(category, focus?, city?, platform?)` — 4th param is platform
- `GoldStandardEstablishmentPanel` shows platform badge on active profile card; draft filter matches campaign platform OR cross-platform drafts

## Gold Standard — Emerging/Competitive Discovery Benchmark (Platform-Aware)

Closes the gap where emerging/competitive discovery scans had no category-top benchmark to rate candidates against. The gold standard profile (established by a prior Gold Standard Establishment scan) is now injected into emerging/competitive discovery scans as a `discovery_benchmark` block, introducing **platform awareness** into focus discovery scans for the first time.

### Injection point
`MarketingExecutionService.resolvePrompt()` — composer path (emerging/competitive intelligence-scope seek):
- After `PromptComposerService.composeIntelligencePrompt()` returns the composed body (base + extension + focus profile + focus modifier), resolves the gold standard via `IntelligenceProfileService.resolveGoldStandard(category, campaign.intelligence_platform, ctx)`
- If present: appends `serializeGoldStandard(goldStandard, 'discovery_benchmark')` to the rendered prompt
- If absent: appends a soft degraded-mode note (`=== NO GOLD STANDARD PROFILE — BENCHMARKING ABSENT ===`) so the operator knows to run an establishment scan first
- Resolution metadata includes `gold_standard_profile_id` + `gold_standard_profile_version` for audit trail

### `'discovery_benchmark'` role (`GoldStandardRole` type)
New role added to `IntelligenceProfileService.serializeGoldStandard()`:
- Header: `=== GOLD STANDARD DISCOVERY BENCHMARK ===`
- Includes `Platform scope:` line (platform-specific or `cross-platform (all platforms)`)
- Directive instructs the analyst to:
  - Rate each discovered candidate per-platform against the established expected fields and quality gates
  - Set `gold_standard_match = true` ONLY for candidates that pass ALL `non_negotiable` gates on the platform(s) where they have a presence
  - Populate `gold_standard_gate_results` per candidate with per-gate pass/fail
  - Aggregate per-platform gate failures into `platform_analysis.platform_breakdown`
  - Recommend a `primary_platform` for outreach based on where the gold standard is deepest AND where candidates have the most fixable gaps (highest-opportunity platform, not just the most-present platform)
  - Populate `platform_analysis.outreach_recommendation` with platform-specific opportunities and `recommended_platform_focus` for downstream business audits

### `PromptResolution` type
Extended with optional `gold_standard_profile_id?: string | null` and `gold_standard_profile_version?: number | null`.

## Discovery Leads Handoff (GAP-E3 — Migration 253)

Spec: `docs/LocalBiz/marketing_ops_discovery_leads_handoff_spec.md`

Closes the discovery→audit context cliff: child business campaigns born from intelligence-discovered prospects durably carry the discovery context (signals, provenance, seek priority, category fit, run lineage) so the business analysis audit prompt can render a "Discovery leads" block as verification hypotheses (never as findings — §S1 guardrail preserved).

### Migration 253
`database/migrations/253_campaign_discovery_context.sql` — additive `discovery_context JSONB` + `intelligence_run_id VARCHAR(64)` on `mkt_campaigns_list` + partial index on `intelligence_run_id`. Both nullable; no backfill.

### Data contract — `DiscoveryContext`
Stored on `mkt_campaigns_list.discovery_context` (JSONB, nullable). Validated by `discoveryContextSchema` in `apps/api/src/validators/intelligence-discovery.schema.ts`:
- `focus: 'emerging' | 'competitive'` (source-run focus, NOT the campaign's own `intelligence_focus` column)
- `discovered_at`, `business_seek_priority`, `category_fit`, `identity_confidence`, `location_status`, `seek_batch_id`
- `discovery_signals: string[]` (INT_* only — `/^INT_/` regex enforced)
- `discovery_provenance` (reuses the now-exported `discoveryProvenanceSchema`)
- `validateDiscoveryContext(raw)` helper returns `DiscoveryContext | null` (drop + log on invalid — never blocks campaign creation)

### Backend
- `MarketingCampaignService.createCampaign()` + `deriveBusinessCampaign()` — accept optional `discoveryContext` + `intelligenceRunId`, persist to new columns, append human-readable "Discovery context" section to notes
- `MarketingProspectQueueService.createCampaignFromQueue()` — builds discovery context from the queue entry for `source_kind = 'intelligence_seek'`, validates via `validateDiscoveryContext`, passes through to `deriveBusinessCampaign`. New private `resolveRunFocus(intelligenceRunId)` does PK lookup on `mkt_intelligence_runs.focus`
- `MarketingExecutionService.resolvePrompt()` — `category_audit` path injects `renderDiscoveryLeadsBlock(campaign)` after gold-standard benchmark, before `appendPromptSuffix`. Block renders signals (labeled via hardcoded `INT_SIGNAL_LABELS` map) + provenance (capped at 6) + priority/fit + `discovered_at` + mandatory absence-rules paragraph. Returns `''` when context absent (byte-identical render). `resolution.discovery_leads_injected` stamps whether the block was appended.

### INT label map (hardcoded)
The intelligence sprint's proposed registry seed (migration 199, GAP-S1) was never delivered — no INT_* rows exist in `mkt_signal_registry`. INT_* is a closed, spec-defined 11-code family, so a static `INT_SIGNAL_LABELS` map is used in both `MarketingCampaignService` (notes) and `MarketingExecutionService` (leads block) to avoid a DB dependency in the render path.

### Guardrails (§9)
1. §S1 preserved — INT_* codes never enter `detected_signals`, the signal extractor, or playbook rule evaluation
2. Verification framing mandatory — block always carries "hypotheses, not findings" framing + absence-rules paragraph
3. Scope exclusions — block renders only for business-scope `seek` prompts with `promptRole === 'category_audit'` (never `fulfill`, `signal_triage`, or intelligence-scope)
4. No triage coupling — discovery context does not auto-trigger triage or alter triage results

### Tests
- `apps/api/src/services/__tests__/DeriveBusinessCampaignDiscovery.test.ts` (7 tests) — T1 handoff with context, T2 legacy call, T7 invalid-context drop (4 cases)
- `apps/api/src/services/__tests__/DiscoveryLeadsBlock.test.ts` (11 tests) — T3 block rendering (6 cases), T4 triage invariance, T5 role gating (4 cases)
- `apps/api/src/services/__tests__/SignalExtractorIntFamily.test.ts` (5 tests, unchanged) — §S1 regression guard


### Output schema (`intelligence-discovery.schema.ts`)
Per-candidate (all optional, forward-compatible via `.passthrough()`):
- `gold_standard_match: z.boolean().nullable().optional()` — passes ALL non_negotiable gates
- `gold_standard_gate_results: z.array(z.object({ gate: z.string(), passed: z.boolean(), platform: z.string().optional() })).nullable().optional()` — per-gate pass/fail

Top-level `platform_analysis` section (optional — present only when a gold standard block was injected):
- `gold_standard_profile_id` / `gold_standard_profile_version` / `gold_standard_platform` — traceability
- `platform_breakdown[]` — per-platform presence counts, meets_gold_standard_count, common_gate_failures
- `candidates_meeting_all_gates` — category-level benchmarking summary
- `most_common_gate_failures[]` — aggregated gate failures with severity
- `outreach_recommendation` — `primary_platform`, `platform_rationale`, `platform_specific_opportunities[]`, `recommended_platform_focus`, `primary_angle`, `suggested_call_to_action`

The `recommended_platform_focus` field is the key handoff — it tells downstream business audits which platform to target, closing the loop between discovery and audit.

### Prompt suffix (`INTELLIGENCE_DISCOVERY_PROMPT_SUFFIX`)
Updated to document the new output fields and rules:
- When a `=== GOLD STANDARD DISCOVERY BENCHMARK ===` block is present, populate `gold_standard_match`, `gold_standard_gate_results`, and `platform_analysis`
- When no gold standard block is present (degraded mode), omit all three entirely

### Tests
- `IntelligenceProfileService.gold-standard.test.ts` — 7 new tests for `discovery_benchmark` role (header label, platform scope line, directive text, field serialization, no cross-contamination with benchmark/discovery roles)
- `ResolvePrompt.test.ts` — 6 new tests for the composer path (gold standard injected when present, degraded note when absent, platform passed through, competitive focus, composer body preserved + gold standard appended)
- `IntelligenceDiscoverySchema.test.ts` — 14 new tests for per-candidate gold standard fields + `platform_analysis` section (valid, absent, null, wrong shape, missing required fields, passthrough)

### Downstream consumption (phase 2, documented but not built)
- Queue ingestion could map `outreach_recommendation.recommended_platform_focus` to the spawned business audit campaign's `intelligence_platform`
- Frontend discovery audit card renders the `platform_analysis` section with per-platform bars + outreach recommendation + "Meets Gold Standard" badge per candidate

## GBP Authorized Management Suite (Phases 0–4)

Spec: `docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md`
Sprint plans: `docs/LocalBiz/GBP_SPRINT_PHASE0.md` through `GBP_SPRINT_PHASE4.md`
User guide: `docs/LocalBiz/GBP_USER_GUIDE_PHASE5.md`

A capability module (`gbp_management`) that converts Marketing Ops prospects into claimed, verified, paying tenants with full Google Business Profile management. Initial scope: emerging single-location businesses (multi-location path preserved in schema).

### Capability Keys (Migration 243)
- `gbp_ai_response` — AI review response (Tier A drafts + future Tier B autopilot)
- `gbp_posts_scheduler` — Scheduled post queue + lifecycle
- `gbp_directory_reviews` — Surface GBP reviews on public directory/place pages
- `gbp_directory_content` — Surface GBP posts + photos on public directory/place pages
- `gbp_management_flexible` — Flexible bundle key (auto-unlocks all four features above via resolver)

### Tier Assignment + BSaaS Catalog (Migration 244)
- `full_retail_visibility` tier has `gbp_management_flexible`
- 5 BSaaS catalog entries: 4 individual features + 1 flexible bundle (`gbp_management_flexible` at $49/mo, best value)
- Catalog visible at `/settings/admin/bsaas-catalog` and purchasable via Feature Store

### Merchant Gate Toggles (Migration 245)
- `tenant_gbp_options_settings` table — tenant-scoped soft gate
- `gbp_reviews_display` (default true) — controls whether entitled reviews surface on public pages
- `gbp_content_display` (default true) — controls whether entitled posts/photos surface on public pages
- Settings route: `apps/api/src/routes/gbp-options-settings.ts` (`GET/PUT /api/tenants/:tenantId/gbp-options`)
- PUT handler calls `invalidateEffectiveCapabilities(tenantId)` to clear in-memory + MV caches
- **Mount requirement:** the router declares orchestrator-style paths (`/:tenantId/gbp-options`), so it must be mounted in the tenant orchestrator (`router.use('/', gbpOptionsSettingsRoutes)` in `tenant.routes.ts`) to be reachable at the documented `/api/tenants/:tenantId/gbp-options`. Registering it at `/api` in `routeRegistry.ts` alone yields only `/api/:tenantId/gbp-options` — every other tenant-scoped settings router (product/featured/storefront/…) lives in the orchestrator for this reason. Regression: `apps/api/src/tests/tenant-gbp-options-routes.test.ts` (added 2026-10-17 after the page 404'd).

### Two-Gate Architecture (R33 Compliant)
- **Hard gate (entitlement):** `gbp_directory_reviews` / `gbp_directory_content` / `gbp_ai_response` / `gbp_posts_scheduler` from tier, BSaaS, grants, or admin complimentary
- **Soft gate (merchant pref):** `gbp_reviews_display` / `gbp_content_display` from `tenant_gbp_options_settings`
- Resolver: `apps/api/src/services/resolvers/GbpManagementResolver.ts`
  - `can_show_reviews` / `can_show_content` / `can_use_ai_response` / `can_use_posts_scheduler` — hard gate only (R33: tier-level, never gated by merchant prefs)
  - `reviews_enabled` / `content_enabled` — effective state (hard AND soft gate)
- Wired into `EffectiveCapabilityResolver.ts` (both regular + MV paths) via `resolveGbpManagement()`
- Frontend mapping: `UnifiedCapabilityService.ts` → `mapGbpManagement()` → `GbpManagementState` in `CapabilityResolutionService.ts`
- `PlanSummaryWidget.tsx` includes GBP Management capability card

### Phase 1 — Claim & Verification
- Customer claim workflow via `mkt_customer_claim_tokens` (existing claim service)
- GBP verification: `apps/api/src/services/GBPVerificationService.ts` — fetch options, initiate, complete with PIN
- Customer routes: `apps/api/src/routes/gbp-customer.ts` — `GET /status`, `GET /verification/options`, `POST /verification/start`, `POST /verification/complete`
- Directory seed standing transition: `unclaimed` → `claimed` after claim + verification
- CRM alerts fired on successful conversion
- Frontend: `apps/web/src/app/account/marketing/gbp/page.tsx` — GBP dashboard with connection status, verification card, location details, aggregate rating

### Phase 2 — Review Intelligence & Tier A Reply Engine
- Hourly review ingestion: `apps/api/src/jobs/gbpReviewIngestion.ts` — fetches reviews, refreshes cached aggregate rating, applies sentiment tagging, fires CRM alerts
- Cached aggregate rating: `gbp_locations_list.cached_average_rating` + `cached_review_count`
- Rule-based sentiment: positive, negative, neutral, mixed
- Tier A AI draft replies: `apps/api/src/services/GBPReviewReplyService.ts` — 3 drafts per review with owner-voice + category-aware tone
- Entitlement-aware: drafts only generated when `gbp_ai_response` is entitled
- Review reply + dispute endpoints in `gbp-customer.ts`
- Review dispute intake: registry-driven via `mkt_dispute_intake` with `intake_kind`
- Frontend: `apps/web/src/app/account/marketing/gbp/reviews/page.tsx` — review inbox

### Phase 3 — Local Post Publisher & Media Manager
- Scheduled post publishing: `apps/api/src/jobs/gbpPostScheduler.ts` (every 15 min) — publishes SCHEDULED posts to Google
- Post lifecycle: DRAFT → SCHEDULED → PUBLISHING → PUBLISHED | FAILED
- Post CRUD customer routes in `gbp-customer.ts`
- Binary upload: `GBPAdvancedSync.uploadPhotoBinary()` for media upload
- Gold Standard photo benchmark: `IntelligenceProfileService.resolveGoldStandard()` → `expected_fields.platforms.google.expected_photo_count`
- Frontend: `apps/web/src/app/account/marketing/gbp/posts/` (composer, offer builder, post card) + `apps/web/src/app/account/marketing/gbp/media/` (uploader, gallery)

### Phase 4 — Public Surfacing & Monetization
- Public GBP endpoints: `apps/api/src/routes/directory-gbp-public.ts`
  - `GET /api/public/directory/:slug/gbp-reviews` — public reviews + aggregate rating
  - `GET /api/public/directory/:slug/gbp-posts` — published posts only
  - `GET /api/public/directory/:slug/gbp-photos` — active photos
  - All endpoints enforce both gates; return `{ enabled: false }` when either gate fails
  - Public field filtering: excludes sentiment, ai_drafts, reply_status, dispute_status, view_count, status, scheduled_for, post_name, tenant_id
- Surface-agnostic GBP components: `apps/web/src/components/gbp/`
  - `GbpReviewsSection.tsx` — aggregate rating badge + review list with owner replies
  - `GbpPostsSection.tsx` — post card grid (offers, events, standard)
  - `GbpPhotoGallerySection.tsx` — category-filtered photo gallery
  - All self-gating: render nothing when `{ enabled: false }`
- Directory integration: `apps/web/src/app/directory/[slug]/page.tsx` — all 4 layout variants (classic, editorial, immersive, premium)
- Place integration: `apps/web/src/app/place/[slug]/page.tsx` — editorial layout
- Upgrade funnels on GBP dashboard: AI review response + post scheduler upsells linking to `/settings/feature-store?feature=gbp_*`
- POS/GMC CTAs on GBP dashboard: link to `/settings/integration-options` (wires existing integration settings, no duplicate logic)

### Tests
- `apps/api/src/services/resolvers/GbpManagementResolver.test.ts` (7 tests) — disabled, flexible, individual features, both gates, defaults, flexible+merchant gate
- `apps/api/src/tests/directory-gbp-public-routes.test.ts` (7 tests) — 404, both gates pass, hard gate fail, soft gate fail, posts, photos, public field filtering
- `apps/api/src/tests/gbp-customer-routes.test.ts` (24 tests) — auth, context gating, cross-customer isolation, reviews, replies, posts, media
- `apps/api/src/tests/gbpPostScheduler.test.ts` (5 tests) — scheduler lifecycle
- `apps/api/src/services/__tests__/GBPReviewReplyService.test.ts` (15 tests) — draft generation, reply publishing
- `apps/api/src/services/__tests__/GBPVerificationService.test.ts` (7 tests) — verification options, initiation, completion
- `apps/api/src/services/__tests__/CustomerGBPAccessService.test.ts` (8 tests) — customer GBP access resolution

### Key Files
- `apps/api/src/services/GBPAdvancedSync.ts` — GBP API wrapper (reviews, posts, media, locations)
- `apps/api/src/services/CustomerGBPAccessService.ts` — customer-to-GBP bridge resolution
- `apps/api/src/services/gbp/prompts.ts` — Tier A prompt construction (owner voice, category tone)
- `apps/api/src/jobs/gbpReviewIngestion.ts` — hourly review ingestion job
- `apps/api/src/jobs/gbpPostScheduler.ts` — scheduled post publisher (every 15 min)
- `apps/web/src/services/MarketingCustomerService.ts` — frontend service for all customer GBP endpoints
- `apps/web/src/components/customer/CustomerSidebar.tsx` — GBP nav items in customer sidebar

## Advanced GBP Features page + GBP module capability awareness (2026-10-17)

The tenant-side Advanced GBP Features page (`apps/web/src/app/t/[tenantId]/settings/integrations/google/advanced/`) is now capability-aware and grew a real photo picker, review tooling, and a retailer attribute editor.

### New capability keys (Migration 342)
`gbp_management` gains two keys, both ordinary module features (flexible key auto-unlocks; individually purchasable via BSaaS):
- `gbp_media_upload` — upload/manage GBP photos (gates the Photos tab + `POST /google/business/media`)
- `gbp_attributes` — read/write GBP business attributes (gates the Attributes tab + `PATCH|POST /google/business/attributes*`)

Wiring: `GbpManagementResolver` adds `can_use_media_upload` / `can_use_attributes` (tier-level, R33 — never merchant-gated); mirrored in `resolvers/types.ts`, `UnifiedCapabilityService.ts` (`BackendEffectiveGbpManagement` + `mapGbpManagement`) and `CapabilityResolutionService.ts` (`GbpManagementState`). `shared/tier-contract.json` `capability_modules.gbp_management` was updated by hand to match — **after migration 342 lands in prd, re-dump the witness and re-run `sync-fixture-modules.cjs` so the generated block matches the DB** (no test compares them today; the fixture is authoritative).

### Backend gate helper
`apps/api/src/lib/google/capability-gate.ts` → `isGbpManagementFeatureAllowed(tenantId, 'ai_response'|'posts_scheduler'|'media_upload'|'attributes')`. Reads the resolved `effective.gbp_management` fields; fails closed. Unit-tested in `apps/api/src/lib/google/__tests__/capability-gate.test.ts`.

### New/changed routes (`apps/api/src/routes/google-business-oauth.ts`)
- `POST /google/business/media` — now accepts **multipart** (`file` field, memory storage, 10MB) via `uploadPhotoBinary`, or the legacy JSON `photoUrl` via `uploadPhoto`; gated by `gbp_media_upload`.
- `POST /google/business/reviews/:reviewName/ai-draft` — resolves the local review id from the Google resource name (`gbp_reviews.google_review_id`) and calls `GBPReviewReplyService.generateDrafts` (which self-gates on `gbp_ai_response` → preview draft when unentitled).
- `POST /google/business/reviews/:reviewName/dispute` — registry-driven intake (`intake_kind='review_dispute'`) via `DisputeIntakeService`; marks the review `DISPUTED`. Not capability-gated (dispute is free per spec §6.5).
- `PATCH|POST /google/business/attributes*` — gated by `gbp_attributes`.
- `apps/api/src/routes/gbp-options-settings.ts` — added the documented-but-missing `GET /:tenantId/gbp-options/capability`.

`GBPAdvancedSync` fixes: `getAvailableAttributes` now calls `GET /v1/attributes?parent=locations/{id}&regionCode=US` (was `parent=<category resource>`); `updateAttributes` sends the required `attributeMask`; `setCommonAttributes` adds the storefront-retail fulfillment set (`has_delivery`, `has_curbside_pickup`, `has_in_store_pickup`, `has_takeout`, `has_in_store_shopping` — ids verified against `attributes.list` metadata) and writes `pay_credit_card_types_accepted` as REPEATED_ENUM.

### Frontend
- `advanced/GbpPhotoUploadPicker.tsx` — file (drag/drop + browse) **and** URL modes; upsell branch when `!canUseMediaUpload`. Render test: `GbpPhotoUploadPicker.test.ts`.
- `advanced/GbpReviewsTab.tsx` — rating filter, unreplied-only, sort, reply char budget + delete reply, AI drafts (gated → `gbp_ai_response`, upsell link otherwise), dispute intake.
- `advanced/GbpAttributesTab.tsx` — retailer fulfillment/payment quick toggles (→ `attributes/common`), Google's dynamic category-driven list (→ `PATCH attributes`), and an editable **storefront** group (SNAP/EBT display via `tenant_directory_entry_settings`, delivery/pickup via `tenant_fulfillment_settings`) — the last is platform-only, never sent to Google. There is no confirmed GBP EBT attribute, so SNAP/EBT lives in the storefront group.
- `gbp-options/page.tsx` — merchant-facing **GBP Display Settings** page for the soft gates (`gbp_reviews_display` / `gbp_content_display`), reading `GbpManagementState.canShowReviews/canShowContent` to label features not in plan. Linked from the advanced page ("Display settings →").
- `PlatformHomeSingletonService` gained `getGoogleBusinessAvailableAttributes`, `updateGoogleBusinessAttributes`, `deleteGoogleBusinessReviewReply`, `generateGoogleBusinessReviewDrafts`, `submitGoogleBusinessReviewDispute`, `uploadGoogleBusinessMediaFile` (FormData), `getGbpOptionsSettings`, `updateGbpOptionsSettings`.

### Tier B review autopilot — plumbing in place, NOT scheduled (2026-10-17)

The "bot agent" that auto-responds to reviews is wired but inert. Activation is **two independent switches**, and neither publishes a reply alone:

1. **Operator flag** `GBP_AUTOPILOT_ENABLED` (default off) — `unifiedConfig.gbpAutopilotEnabled`. `GBPReviewReplyService.runAutopilot` returns `{ activated: false, reason: 'not_activated' }` when unset.
2. **Merchant opt-in** `tenant_gbp_options_settings.gbp_autopilot_enabled` (default false, migration 343). `reason: 'merchant_opt_out'` when off.

Plus the existing hard gate: `gbp_ai_response` entitlement (`reason: 'not_entitled'`).

- `GBPReviewReplyService.runAutopilot(tenantId)` — real implementation: only reviews with `reply_status='NONE'`, no reply, and `star_rating >= gbp_autopilot_min_rating` (default 5★); generates Tier A drafts, scores them with the pure `selectBestAutopilotDraft` (rejects placeholders/stubs, prefers 80–600 chars, small thanks bonus), publishes via `replyToReview`, sets `reply_status='PUBLISHED'`. Capped at `GBP_AUTOPILOT_BATCH_LIMIT` (default 5) per pass.
- `apps/api/src/jobs/gbpReviewAutopilot.ts` — `runGbpReviewAutopilotPass()` (scans only opted-in tenants) + `startGbpReviewAutopilot()` (the hourly `scheduleJob`, `DISABLE_GBP_REVIEW_AUTOPILOT` kill switch). **Not called from `index.ts`** — it's a catalog-only JobRegistry entry (`declareJobs`, `scheduleLabel: 'not scheduled — awaiting green light'`), so it shows in `/settings/admin/jobs` with no timer. Green light = call `startGbpReviewAutopilot()` next to `startGbpReviewIngestion()` + set the flag.
- Resolver: `autopilot_enabled` = `can_use_ai_response && merchant opt-in` (effective field, R33 — tier fields untouched); `merchant_preferences` gained `gbp_autopilot_enabled` / `gbp_autopilot_min_rating`. Mirrored in `resolvers/types.ts`, `UnifiedCapabilityService.ts`, `CapabilityResolutionService.ts`.
- Settings UI: the GBP Display Settings page (`gbp-options/page.tsx`) has an "AI review autopilot" **Preview** section — opt-in toggle + auto-reply threshold (5★/4★/3★), gated by `canUseAiResponse`. Copy is explicit that replies begin once autopilot is switched on for the account.
- Tests: `GbpManagementResolver.test.ts` (opt-in matrix), `GBPReviewReplyService.test.ts` (scorer + the four gates + publish/fail paths).

## Directory Claim Operator Approval Flow (Migration 246)

Closes the gap where `DirectoryClaimService.initiateClaim` returned `operatorApprovalRequired: true` but persisted nothing — the request was lost and operators had no review queue. Also fixes `computeContexts` so directory-claim owners get platform context (and thus see Marketing/GBP nav).

### Schema (Migration 246)
- `directory_claim_requests` — pending/approved/rejected claim requests with `seed_id`, `tenant_id`, `token_id`, `customer_id`, `customer_email`, `customer_name`, `status`, `rejection_reason`, `submitted_at`, `reviewed_at`, `reviewed_by`

### Backend
- `apps/api/src/services/DirectoryClaimService.ts`:
  - `initiateClaim` now persists a `directory_claim_requests` row (status='pending') when `operator_approval_required` is true (idempotent — returns existing pending request if one exists for the token)
  - Fires a platform-scoped CRM alert (`type='directory_claim_pending'`) so operators see it in their feed
  - `listClaimRequests({ status })` — admin review queue (joins seed + listing for business name, category, location)
  - `approveClaimRequest(requestId, adminUserId)` — consumes token, flips `org_standing_mode` to `independent`, promotes customer to platform user, updates request to 'approved'
  - `rejectClaimRequest(requestId, adminUserId, reason)` — revokes token, updates request to 'rejected'
- `apps/api/src/routes/directory-presence-public.ts` — `/initiate` now passes `customerEmail` + `customerName` from auth context to `initiateClaim`
- `apps/api/src/routes/directory-presence-admin.ts` — new routes:
  - `GET  /api/admin/directory-presence/claim-requests` — list (default: pending)
  - `POST /api/admin/directory-presence/claim-requests/:id/approve` — approve
  - `POST /api/admin/directory-presence/claim-requests/:id/reject` — reject
- `apps/api/src/services/CustomerAuthService.computeContexts` — now grants `platform: true` when the customer owns a claimed directory seed via three paths:
  1. `linked_user_id → user_tenants → directory_presence_seeds` (customer was promoted)
  2. `directory_claim_requests.customer_id` matches (customer_id was captured on initiate)
  3. `directory_claim_requests.customer_email` matches customer's email AND status='approved' (covers the case where `/initiate` ran before `optionalCustomerAuth` was added, so `customer_id` was null but email was stored)
- `apps/api/src/routes/directory-presence-public.ts` — `/initiate` and `/accept` now apply `optionalAuth` + `optionalCustomerAuth` middleware so `req.customer` is populated for authenticated owners (previously the public route didn't parse customer JWTs, so `customer_id` was never stored on claim requests)
- `apps/api/src/lib/id-generator.ts` — `generateDirectoryClaimRequestId(tenantId)` (`dcr-{tenantKey}-{nanoid12}`)

### Frontend
- `apps/web/src/services/DirectoryPresenceAdminService.ts` — `listClaimRequests`, `approveClaimRequest`, `rejectClaimRequest` methods + `DirectoryClaimRequest` interface
- `apps/web/src/app/(platform)/settings/admin/directory/presence-seeds/page.tsx` — "Pending Claim Requests" section at the top of the seeds page with Approve/Reject buttons (only renders when there are pending requests)

## Owner Claim Verification (Migration 274)

Owner must confirm categories + attributes (a consent contract) before a directory claim can be initiated; accepted values mint as official listing data, unknown owner-typed labels are held for operator review (abuse gate).

### Schema (Migration 274)
- `directory_presence_seeds.owner_verified_at` / `owner_verification` (consent snapshot) / `owner_proposed_categories` (JSONB array of `{label, role, status, proposed_at, decided_at, decided_by}`)

### Backend
- `DirectoryClaimService.initiateClaim` — hard gate: returns `verification_required`/`ownerVerificationRequired` until `owner_verified_at` is set; `applyOwnerVerification` mints known categories + owner-authoritative attributes to the listing via `DirectoryPresenceSeedService.updateFields` with `source_name='owner_claim'` provenance, syncs `directory_settings_list`, stamps `category_fit='verified'` + consent record
- Abuse gate: labels not in `platform_categories ∪ mkt_service_categories_list` → `owner_proposed_categories` (pending), never the listing. `DirectoryPresenceSeedService.decideProposedCategory` (admin accept/reject) — accept registers into `mkt_service_categories_list` + mints to listing; last decision auto-resolves the Requests-Hub ticket
- `POST /api/admin/directory-presence/presence-seeds/:id/proposed-categories/decision` (platform-staff)
- `GET /api/public/directory/attribute-definitions` — public suggestion catalog for the owner picker

### Operator notifications — SOP
**Requests from public surfaces → Requests Hub.** `crm_alerts` is the *customer/tenant* notification feed (`tenant_id=<tenant>` = tenant CRM; `tenant_id='platform'` = marketing-customer portal with metadata read-time targeting — NOT an operator inbox; rows there also render in the broadcast-history page). For operator-facing work items, create a `crm_support_tickets` row: `tenant_id='platform'`, a `category` for grouping (`directory_claim` for claim flow), `inquiry_id` = the domain row id for linkage/auto-resolve, plus a `crm_ticket_messages` entry with a `button` block linking to the action page. For inbound "contact us" style requests (no triage decision needed), `crm_inquiries` rows land in the same Hub — `source` carries the origin tag (`public_form`, `customer_portal`, `help_desk_support`, `place_claim_request`, or a validated client `source_tag`). These surface in the Requests Hub (`/settings/admin/crm/requests`) + admin CRM dashboard stats + personal CRM assigned queue. Established precedents: claim requests (DirectoryClaimService), owner category proposals (same), place-page claim contact form + public-catalog inquiries + CCPA requests (`crm_inquiries`).

**Place-page claim contact form** (`/place/[slug]` → `PublicInquiryForm` → `POST /api/public/inquiries`): sends `source_tag='place_claim_request'` + `listing_id`; the route resolves listing→seed, appends a claim-context block (business, place URL, seed id, admin review link) to the inquiry body, and logs a `directory_seed_outreach_touches` row (`channel='form'`, `outcome='form_submitted'`) so the engagement shows on the seed detail's touch timeline.

**Directory intake surfaces → Requests Hub tickets** (public forms rendered on place/location/category pages via `AddBusinessCta`/`SuggestBusinessCta`):
- *Suggest a business* → `directory_presence_suggestions` (status `submitted`) + platform ticket `category='directory_suggestion'` `inquiry_id=suggestion.id`, auto-resolved when `updateStatus`/`approve` decides → queue at `/settings/admin/directory/suggestions`
  - Suggestion row actions: **Approve** (seed + claim link immediately), **Campaign** (business-scope `triage_management` campaign from NAP — audit-first, seed later), **Queue** / **Verify** (`addToQueue` `source_kind='public_suggestion'` → prospect-queue kanban `queued`/`verify_then_outreach`/`in_thread`/`hold`/`campaign_created`/`dismissed` with per-entry `logTouch` CRM activity + `next_touch_at` cadence — this is the "track communication before authorizing a seed" path; queue→campaign via `POST /prospect-queue/:id/create-campaign`)
  - Linkage: queue entries carry `business_snapshot.suggestion_id`; `listSuggestions` reverse-joins it → row shows an "in queue (status)" chip; `approve()` stamps `mkt_prospect_queue.seed_id` so the funnel reads suggestion → queue → campaign → seed
- **Contact consent (migration 275):** both intake forms carry an opt-in checkbox — `contact_consent` on `directory_presence_suggestions`, `owner_contact_consent` on `directory_presence_seeds` (survives the anonymous email-verify payload via `CreateSeedInput.ownerContactConsent`). `false`/absent = do not contact; the queue snapshot keeps the email in `submitter_email` but only routes it to `email` (outreach-usable) when consented. Surfaced on the suggestion detail modal, the intake ticket body, the touch note, and the seed detail owner block.
- *Add your business* → `directory_presence_seeds` draft (`seed_batch='owner-submitted'`, authenticated immediately / anonymous after email verify) + platform ticket `category='directory_owner_submission'` `inquiry_id=seed.id` + `form_submitted` touch on the seed timeline; auto-resolved by `publishSeed`/`deleteSeed` (via `resolveIntakeTickets`) → review at `/settings/admin/directory/presence-seeds/{seedId}`

### Frontend
- `/directory/claim/[token]` — `ClaimVerificationPanel` (valid state): category selector + create-new (flagged "sent for operator review"), attribute chips + suggestions + custom add, consent checkbox gating Claim. The valid state also offers a collapsed `DirectoryClaimListingEditor` (`includeCategories={false}` — the verification panel owns the category consent contract; a second category editor's save would be overwritten at claim submit) for optional pre-claim NAP/hours/slug/notes corrections via `PUT /claim/:token/listing` (token-gated, works pre-claim; name stays locked — corrections go through the reviewer notes field), plus a "What happens after you claim" bullet expectations block (OTP vs. operator review; free-forever listing + 5 free product slots promise linked back to `/place/about`; proof upload + further corrections live on the post-submit `pending_approval` screen — `POST /claim/:token/proof` requires a pending `directory_claim_requests` row, so it cannot run pre-submit).
- Seed detail page — "Owner Verification" section (consent stamp + per-proposal accept/reject); seeds list rows show an amber "N categories pending review" badge when `pendingOwnerProposals > 0`
- Tests: `DirectoryClaimService.ownerVerification.test.ts` (gate, mint, abuse-gate diversion, resend pass-through)





## Prospect Communications (prospect-scoped communication history)

Page: `/settings/admin/marketing-ops/communications` (`ProspectCommunicationsClient.tsx`) — picker → unified timeline, patterned after the openers/follow-ups workspaces. Deep-link: `?prospect=<queueEntryId>`.

- **Anchor = the queue entry.** `mkt_prospect_queue` is the prospect registry; it links the seed (pre-campaign) and the processed campaign (post-campaign). A campaign created straight from an audit card without ever entering the queue is NOT listed.
- **Aggregator:** `apps/api/src/services/ProspectCommunicationService.ts` (read-only). `listProspects()` → picker + rolled-up contact counts; `getTimeline(queueEntryId)` → merged events. Routes: `GET /api/admin/marketing-ops/prospects`, `GET /prospects/:id/timeline`.
- **Sources merged:** `directory_seed_outreach_touches` (by `seed_id`, pre-campaign) + `mkt_outreach_log` (by campaign, incl. siblings sharing `business_prospect_id`). Siblings fold into one conversation.
- **Channel normalization:** `normalizeChannel` maps `call`→`phone`, `visit`→`in_person`; everything else passes through. `raw_channel` preserves the stored value. Kept separate from `ProvingGroundCadenceService.CHANNEL_TO_OUTREACH` (that one collapses channels for the campaign-log taxonomy).
- **Card actions** mirror the PG promote panel: `queued` → Verify (`requestVerification`); `verify_then_outreach` → Resolve (`ResolveVerificationModal`); campaign present → Log contact (`LogContactModal`); pre-campaign seeded → Log touch (`logProspectTouch`).
- **`ResolveVerificationModal` prop is `VerificationEntryLike`,** a structural minimal shape (not `ProspectQueueEntry`) so non-queue surfaces can open it. `ProspectQueueEntry` still satisfies it.
- **Migration `295_directory_seed_outreach_touch_recording.sql`** — adds `recording_url`, `recording_duration_seconds` (+ CHECK ≥ 0), `recording_provider`, `recording_attached_at`, `recording_attached_by` to `directory_seed_outreach_touches` (pre-campaign call recordings). Additive/idempotent; guarded on migration 259. Campaign-side recordings already live in `mkt_outreach_log.call_details.recording_url`. Writers: `addOutreachTouch` (recording at log time), `attachTouchRecording` (attach later — `POST .../presence-seeds/:id/touches/:touchId/recording`). Apply to `local` + `prd`, then `pnpm prisma:generate`.
- **Business-hours journey (migration 296).** Opening hours pasted from the GBP listing in the resolve-verification modal travel **queue → campaign → seed listing**:
  1. Modal pastes/parses (`parseGoogleHoursPaste`) → `verifiedHours` on `resolveVerification`.
  2. Written to the queue snapshot as **both** `verified_nap.hours` (provenance) and flat `hours`.
  3. `createCampaignFromQueue` reads `verified_nap.hours ?? snapshot.hours` and passes `businessHours` to `deriveBusinessCampaign`/`createCampaign` → `mkt_campaigns_list.business_hours` (added by migration 296). The scan path applies it via `geoPatch.business_hours` post-derive.
  4. `DirectoryPresenceSeedService.createFromCampaign` reads `campaign.business_hours || audit.business_hours`; the queue→seed batch paths (`createSeedsFromBatch`, `createSeedsForProvingGround`) read `snapshot.hours || snapshot.verified_nap.hours`.
  5. `createSeed`/`updateSeed` write `directory_listings_list.business_hours` and sync `business_hours_list` (public hours endpoint).
  Canonical shape + parser live in **`apps/web/src/lib/business-hours.ts`** (shared by the seed detail page and the verification modal — do not re-inline the parser). Apply migration 296 to `local` + `prd`.
  **Editable at every leg via one component:** `apps/web/src/components/business-hours/BusinessHoursEditor.tsx` (timezone + GBP paste/parse + per-day grid). Mounted on the seed detail page (refactored to it), the campaign create/edit form (`CampaignFormClient`, `business_hours` field), and the prospect card on the communications page (queue leg). Queue writes go through `PATCH /prospect-queue/:id` `hours` (null clears) and merge into `business_snapshot.hours` + `verified_nap.hours`; hours are treated as identity enrichment, so they stay editable on `hold`/`in_thread` rows but not after graduation. Campaign writes go through the campaign create/update body `business_hours` (null clears via `Prisma.DbNull`).
- Tests: `ProspectCommunicationService.test.ts`, `DirectoryPresenceSeedService.outreachTouchRecording.test.ts`, `DirectoryPresenceSeedService.businessHours.test.ts`, hours cases in `MarketingProspectQueueService.test.ts`.

## Proving Ground Campaigns (Migration 262)

Spec: `docs/LocalBiz/PROVING_GROUND_CAMPAIGN_SPEC.md` � Sprint plan: `docs/LocalBiz/proving_ground_sprint_plan.md`

A proving ground is a `scope=city` + `campaign_category=proving_ground` aggregate campaign � the operator workspace for a city/category launch. One active PG per city/category signature (structural-duplicate guardrail).

Backend:
- `apps/api/src/services/ProvingGroundCadenceService.ts` � the authoritative signal->wait table (spec section 4.7): logTouch() writes the canonical touch on the seed (`directory_seed_outreach_touches`), advances the channel ladder, stamps `next_touch_at`, enforces the 3-consuming-touches/30d cap (hold +60d), exits to `in_thread` on live contact. Dead-channel signals (`bad_number`, `bounce`) do NOT consume a slot. Write-through keeps the seed outreach_state machine in sync; mirrors to `mkt_outreach_log` once `processed_campaign_id` exists.
- `apps/api/src/services/ProvingGroundDedupService.ts` � group-keyed identity ledger (`mkt_prospect_dedup_verdicts`); `same_entity` merges identity into the survivor seed's `name_variants`; `getCohortFunnel` excludes resolved groups (duplicateSeedCount = unannotated only).
- `DirectoryPresenceSeedService.createSeedsForProvingGround` � preflight seeding: seed+publish+link to source intelligence campaign+claim token+`queue.seed_id`; leaves status `queued` (seeding is the START of outreach, not graduation).
- `PlaybookChecklistService.resolveEffectivePlaybook` � PG campaigns resolve PG-01 directly by catalog code (no triage row required; aggregate campaigns never triage). `CampaignTriageService` excludes `proving_ground`-category playbooks from candidates.
- Routes: `POST /api/admin/marketing-ops/prospect-queue/:id/log-touch`; `POST/DELETE /:campaignId/children[/:childId]`; `POST /:campaignId/promote-to-proving-ground` (one-action create-or-merge: creates the city-scope PG parent or reuses the existing active PG for the same city+category, then attaches the source + `mergeCampaignIds`); `POST /:id/gap-log` (append-only mid-run gap entries); `PATCH /prospect-queue/:id` accepts `account_family` (family-only patches also allowed on `hold`/`in_thread` rows — identity, not cadence); `POST /api/admin/directory-presence/presence-seeds/proving-ground-seed`; `POST/GET .../dedup-verdicts`; `GET /prospect-queue?source_campaign_ids=a,b,c` (tree filter).
- `MarketingCampaignService.promoteToProvingGround` — flips an unparented intelligence campaign into a PG tree. Guards: `source_not_intelligence_scope` (400), `source_already_parented` (409). Per-child attach failures collect in `skipped` rather than aborting.
- `BaseService.handleError` passes `HttpError` subclasses through unchanged � do not wrap/re-create; guards must surface their real status codes (409/404).

Seed script: `doppler run --config local -- pnpm seed:proving-ground-preflight` (idempotent; requires migration 262's CHECK extension first). Re-run for `prd` after edits.

Frontend:
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/proving-grounds/[id]/` � cockpit (gates, tree funnel, preflight checklist embed, dedup panel, children attach/detach, due-today, gap log).
- `ProspectQueueClient` � `in_thread`/`hold` tabs, next_touch_at due badges, channel-ladder chips (dead rungs struck through), Log-outcome modal.
- Creation paths (all produce the same `scope=city` + `proving_ground` signature):
  - New Campaign form: `proving_ground` is always in the Campaign Category dropdown; selecting it coerces scope → `city` (category is the primary selector). Proving Grounds index "+ New Campaign" deep-links `?scope=city&campaignCategory=proving_ground`. Post-create redirect goes to the cockpit.
  - Campaign detail (intelligence, unparented): "Proving Ground" header button → promote modal (title/category/city/state pre-filled + same-market merge checkboxes). Attached campaigns show a "View Proving Ground" link instead.
  - Intelligence Profiles → Non-Business table: per-row flask action = one-click promote/merge; PG rows get a filled flask jumping to the cockpit.
- Client: `MarketingOpsService.logProspectTouch` / `attachProvingGroundChild` / `detachProvingGroundChild` / `promoteToProvingGround` / `getCampaignChildren`; `DirectoryPresenceAdminService.provingGroundSeed` / `recordDedupVerdict` / `listDedupVerdicts`.

Tests: `provingGround.test.ts` (guardrail + attach/detach + gap log + account_family), `provingGroundCadence.test.ts` (cadence map, cap, write-through, verdicts), PG-01 cases in `PlaybookChecklistService.test.ts`, verdict-exclusion cases in `SeedFunnelAnalyticsService.getCohortFunnel.test.ts`.

## Intelligence Coverage Map — 7-State Slot Model

Page: `/settings/admin/marketing-ops/coverage` (`CoverageClient.tsx`). Backend: `IntelligenceProfileService.getCoverage()`; route `GET /api/admin/marketing-ops/intelligence-profiles/coverage`.

Every slot position (gold standards: platform, nationwide; emerging/competitive: city) carries TWO orthogonal state dimensions — the UI renders two stacked chips per position (establishment on top, discovery on the bottom):

- **Establishment** `slot.status`: `pending` (nothing) → `inflight` (establishment campaign, no profile yet — `profile_id` holds the campaign id) → `draft` (draft profile) → `active` (active profile). Actions: create campaign → open campaign → activate profile → discovery unlocked below.
- **Discovery** `slot.discovery_status` + `discovery_campaign_id`: `pending` → `inflight` → `executed`. A discovery campaign is **executed** when it has ≥1 `mkt_prompt_executions_list` row with `status='completed'` OR ≥1 `mkt_audits_list` row (gold_standard_scan / intelligence_discovery imports). Actions: create campaign → open campaign → open audit (`?tab=audits`).

Key rules (regression history — do not reintroduce):
- The discovery dimension is tracked **per campaign kind, independent of establishment** — discovery campaigns never flip the establishment status and never create an `inflight` establishment slot. The old model conflated them (an executed discovery rendered "green + in-flight arrow" forever).
- Discovery campaigns attach to the slot covering their position (any establishment status); when none exists (e.g. gold-standards platform scan with no platform profile — platform slots reuse the All Platforms establishment by design) a `pending` slot is created to host the discovery state. An establishment campaign arriving later **upgrades** a pending slot rather than pushing a second one. Newest discovery campaign wins (campaigns arrive `created_at desc`).
- Terminal stages (`lost`, `dead`, `closed`, `resolved_and_closed`) are excluded from both dimensions.
- The old `status: 'discovered'` value is gone — replaced by `status: 'pending'` + `discovery_status: 'executed'`.
- Frontend: the discovery chip stays **locked** (lock icon, not clickable) until the establishment chip is active — except gold standards, where the **All Platforms** establishment also unlocks per-platform discovery (proxy establishment — mirrors `resolveGoldStandard`'s platform fallback chain). "All Platforms" is always the first chip in the gold row.

Tests: `apps/api/src/services/__tests__/IntelligenceProfileService.coverage.test.ts` (15 tests — all 7 states, gold platform slots, newest-wins, pending-slot upgrade, terminal exclusion, PG slot shape).

## National Location Row — Sync Contract (shipped 2026-09-22)

The `('__location__','__all__','__all__')` row in `directory_category_enrichment` is **derived state** over every covered market: `getNationalCoverage()` measures `directory_listings_list`, `getNationalCategoryEnrichments()` reads all `(category,'__all__','__all__')` packets. It refreshes on two triggers:

- **National category apply** — `CategoryMarketEnrichmentService.applyEnrichmentPacket`'s `else` (national) branch calls `enrichLocation('__all__','__all__')`, mirroring the city cascade. `enrichMarket` bails on the sentinel (`invalid_market`) — national category rows are campaign-lane only.
- **Every PG shelf sweep** — `ProvingGroundShelfSweepService` calls it unconditionally after the per-city location pass (`triggerSource='pg_sweep'`); reported as `nationalLocation` on `ShelfSweepReport`, NOT inside `locationMarkets` (that array is per-city first-fill only). This covers listing-driven coverage drift that category deploys don't.

**Preserve contract (differs from city rows):** `enrichNational` keeps the campaign row's head copy when `composer_version=2` (meta_title / description / keywords / secondary_categories / schema_type_hint) and only refreshes `context.national_coverage`. City `enrichLocation` overwrites head fields deterministically on every sync — do NOT copy that behavior into the national path; the composer cannot write national coverage narrative, so the campaign packet is the only good source of head copy.

**What sync does NOT refresh:** the AI narrative fields (`body_copy`, `shopper_guide`, `faq`, `area_breakdown`, `context.market_gaps` / `metro_dynamics` / `top_categories`) go stale as coverage shape changes — they only update on a `__location__`/`__all__` campaign re-run. Open follow-up: staleness signal comparing stamped `context.national_coverage` vs live `getNationalCoverage()` on the Coverage surface. Also open (sprint plan Phase C.3): the `profile_activated` hook still requires non-null `reference_city`, so national profile activation produces no national packet.

Tests: `directoryEnrichment.apply.category.test.ts` (national resync call), `directoryEnrichment.apply.location.test.ts` (campaign-copy preservation + baseline write), `ProvingGroundShelfSweep.test.ts` (national refresh + error isolation).

## Public Intake → Prospect Queue Draft Lane (Migration 310, added 2026-09-28)

Public-surface intake is a **draft queue record**, not a dead-end CRM message. `mkt_prospect_queue.status` gained `'intake'` (unvetted staging lane) and `source_kind` gained `'owner_submission'`; both are wired via `initial_status='intake'` on `addToQueue`.

- **Suggestions** (`directory_presence_suggestions`): `DirectorySuggestionService.createSuggestion` auto-enqueues every accepted suggestion into `intake` (`autoEnqueueSuggestion`, non-fatal — the admin Queue/Verify buttons remain the manual fallback when `queueEntryId` is null). Suggestion flips `submitted → under_review` on park; the `business_snapshot->>'suggestion_id'` back-link drives the "in queue (status)" badge on the suggestions list.
- **Owner submissions** (`seed_batch='owner-submitted'`): `DirectoryOwnerSubmissionService` mirrors each created draft seed into `intake` in both paths — authenticated `submit` and email-`verifyToken` — pre-linked via the new `seed_id` addToQueue input + `business_snapshot.seed_id`. Queue lifecycle is independent of the seed's own draft→publish lifecycle.
- **Graduation**: `POST /api/admin/marketing-ops/prospect-queue/:id/graduate` `{target:'queued'|'verify_then_outreach'}` → `MarketingProspectQueueService.graduate` (intake-only, 409 otherwise; verify target stamps `verification.requested_*` like `requestVerification`). Intake entries **cannot** create campaigns (`createCampaignFromQueue` 409s) — they must graduate or be dismissed first.
- **Dismissal sync**: `syncLinkedSuggestion` (queue service) flips the linked suggestion to `rejected` on `dismiss()` AND on `resolveVerification nextAction='dismiss'`, and resolves the intake Requests-Hub ticket — guarded to `status IN ('submitted','under_review')` so approved/duplicate rows are never overwritten. Graduate syncs `under_review` the same way.
- **Editability**: intake rows take priority/note/assigned_to patches (same `open` gate as queued/verify) so operators can annotate before graduating.
- **Frontend**: Intake column leads `ProspectQueueBoard` (Accept → queued / Verify → verify_then_outreach / Dismiss); list view gained an Intake status tab with the same action trio; `MarketingOpsService.graduateProspectQueue`; `owner_submission` label = "Owner Submission".

CRM tickets still file for both surfaces — they're now the notification + audit trail, resolved when the queue decision lands rather than by a separate suggestions-table action.

Tests: `graduate` + suggestion-sync cases in `MarketingProspectQueueService.test.ts` (76 total) — the prisma mock now includes `$executeRaw` for the raw sync writes.

## Business Visibility Report — Prospect-Scoped Owner Report (Migration 311, added 2026-09-28)

The owner-facing diagnostic report (spec `docs/LocalBiz/WEBSITE_GAP_OWNER_REPORT_SPEC.md`; sprint plan `docs/LocalBiz/WEBSITE_GAP_OWNER_REPORT_SPRINT_PLAN.md`). A prospect-scoped composite: each sibling campaign's audit produces a *chapter* (`buildWebsiteChapter` at v1), the report addresses `business_prospect_id` and assembles whatever chapters the signed link permits.

- **The sibling set IS the chapter list.** Each sibling contributes the chapter its **declared archetype** maps to (`ARCHETYPE_CHAPTERS` — resolved from the sibling's operator-accepted triage result's effective playbook: `overridden_playbook ?? playbook`). `website` reads `website_positioning`; every other chapter is a filtered owner-safe extract of the shared `business_analysis` audit: A1→`reviews`, A2→`recovery`, A3→`drift` (PB-01 *and* PB-06 — first sibling wins), A4→`cta`, A5→`repair`, A6→`products`, A7→`website`. `resolveChapterOwners` assigns each chapter to the sibling that declared it — an archetype chapter is never offered without its sibling, and unclaimed `repair`/`website` fall back to the audit row's own campaign so legacy campaigns still report. All BA-sourced chapters share `PRESENT_STATUSES`/`platformLabel`/`competitiveFrameLines`/`gapsMatching` helpers — gap rows are filtered by field-name regex so each chapter renders only its slice of the diagnostic. `assembleReport(prospectId, chapters, tier, {includePagePlan})` builds only permitted+owned chapters; every chapter emits the same DTO shape so `ProspectReportView`/`ProspectReportPdfService` render all builders unchanged.
- **Four-segment signed token** (`HMAC-SHA256` over `PROSPECT_REPORT_TOKEN_SECRET`): `base64url(prospectId.tier.chapterList.flags).sig`. `chapterList` is ordered — index 0 is the free-tier "pitcher" chapter; `flags` is a compact ordered string (`p` = include detailed page plan, `-` = omit). **No expiry; secret rotation invalidates every issued link.** The signed chapter list is a *permission scope*, not a snapshot — a `website,repair` token renders repair when that audit lands; a `website`-only token never widens. `tier=free` renders chapter 1 + `locked_chapters` teasers; owners can't flip `free`→`full` (it's inside the HMAC). `unifiedConfig.prospectReportTokenSecret` returns `''` in production when unset (service warns on first use).
- **Report codes are NOT claim codes.** `mkt_prospect_report_links` (migration 311) mints one 6-char code per share action/channel (alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, same as claim codes); the row carries the signed token + denormalized `tier`/`chapters`/`channel`. Claim `short_code`s remain claim-only — reusing them would falsely attribute report scans to the claim funnel. Per-link revocation = delete the row (HMAC stays valid for the prospect's other codes).
- **QR surfaces**: `prospect_report_{email,text,phone,social,in_person,banner}` registered in BOTH `apps/api/src/services/QrAnalyticsService.ts` (`QrSurfaceType` + labels) and `apps/web/src/services/QrAnalyticsService.ts` + `SURFACE_OPTIONS` in the admin QR page — kept outside `report_delivery_*`/`claim_invite_*` so report clicks never inflate the seed-delivery or claim funnels. Scans record `qr_scan_events` with `product_id = business_prospect_id`, tenant resolved seed→campaign→`'platform'`.
- **URL flow**: `/r/pr/{code}` (web page; the static `pr` segment beats `/r/[shortCode]` in App Router) → `GET /api/public/r/pr-scan/:code` (records scan, returns `/prospect-report/{token}`) → 302 → `/prospect-report/[token]` fetches `GET /api/public/marketing/prospect-report/:token`. PDF: `GET .../prospect-report/:token/pdf?qr={code}` — `qr` is a share-minted code; the PDF embeds a `/r/pr/{code}` QR and **never mints a links row at render time** (side-effect-free).
- **Operator surface**: `OwnerReportSection` (`apps/web/src/components/marketing-ops/`) mounted standalone on the campaign overview (`CampaignDetailClient.tsx`, `scope === 'business'`) — stage-independent, self-silences when no sibling audit can produce a chapter. Preview via `GET /api/admin/marketing-ops/campaigns/:id/prospect-report` (returns `chapter_campaigns` — chapter→owning-campaign attribution so each sibling defaults to ITS OWN chapter; an inherited audit on a sibling is not "its own"), share via `.../share?channel=…` (returns `code`,`url`,`pdf_url`,`qr_url` — one code per call). Checkboxes widen to siblings' chapters; page-plan toggle signs `p` into the token. Locked-chapter CTA = claim path at v1 (anonymous owners can't pay — `market_intel_unlocks` needs customer+tenant FKs; paid unlock lands with `MarketIntelAccessService` surface `'prospect_report'`, already added to `SurfaceType`).
- **Routes mount via `routeRegistry.ts`** (`{ path: '/api/public', router: prospectReportPublicRouter, authLevel: 'public' }`) — never mount ad hoc in `bootstrap.ts`.
- **Owner-safety**: the DTO (`validators/prospect-report-dto.schema.ts`) is safe-by-construction — the deterministic transform redacts `detected_signals`/`outreach_problems` and reframes `build_scope` (diagnostic says `repair`; the offer is a managed rebuild — scope ≠ delivery mode). The shared `ProspectReportView` renders DTO only; tests pin that trap strings never reach markup.
- **Archetype briefings (added 2026-09-28)** — routed siblings (A1/A2/A3/A4/A6) get an operator briefing whose narrative is analyst-composed but whose *facts* are deterministic: `archetypeFactSlice(archetype, baAudit)` (`ProspectReportService`) emits the same fields the sibling's report chapter renders **plus** the internal layer the owner DTO redacts (`detected_signals`/`outreach_problems`/`alignment_scoring`), injected at render as `{{archetype_extract}}` by `resolvePrompt` (keyed on template id via `ARCHETYPE_BRIEFING_TEMPLATES` — the only dynamic-import back-edge into the report service). The REPORT CONSISTENCY directive in every template makes briefing-vs-report disagreement a prompt violation, not just a risk. Templates: `mpt-archetype-briefing-a{1,2,3,4,6}` — `seek`/`profile_repair`/`profile_repair_audit` output, seeded by `seed-archetype-briefing-templates.ts` (template category `profile_repair` is what triggers the existing seek auto-source for `audit_signals`/`audit_results`, so PB-02 review_management siblings inherit it too). Web home: `ArchetypeBriefingPanel` on the campaign overview — dual execution (AI run / render→external→import, same as PB-08), renders via `RepairBriefingCard`; `CampaignDetailClient`'s existing `repairExecution` mount excludes `mpt-archetype-briefing-*` template ids so the briefing renders in exactly one place. A5 keeps `RepairTrackPanel` + per-issue seeks, A7 keeps `WebsiteGapBriefingPanel` — the panel self-silences on those archetypes.
- **Report generation is full-audit only (added 2026-09-30)** — the partial lane (stub `business_analysis` rows from queue/derive/discovery + `category_identification` fast-path rows) exists for accelerated seed creation and PARTIAL prompt serialization; it never feeds the owner report. The BA run is where the analyst narrative lives (`summary`/`public_narrative`/`outreach_problems`/`tier_rationale`); a discovery stub carries only `detected_signals` (internal codes the DTO redacts anyway) and a machine summary — no narrative material exists to render. `auditIsReportable` in `ProspectReportService` gates every audit read (`assembleReport` + `resolveProspectChapterOwners`/`listAvailableChapters`/`listChapterSources`): non-`business_analysis`/`website_positioning` platforms, stub rows, null `audit_data`, and schema-failing payloads are all not-reportable — a stub-only prospect resolves to the designed 404 self-silence instead of a `businessAnalysisSchema.parse` 500 (the `prospect-report` endpoint failure this fixed). A newer stub never shadows an older real audit (latest *reportable* wins), and the chapter build itself is try/catch-omitted so an unbuildable chapter degrades to absent, never fatal.
- **The boundary extends to the free-report banner (added 2026-09-30)** — the seed report itself stays lane-agnostic (provenance can exist before the BA), but its *promotion* is full-lane only. `SeedReportEvidenceService.getSeedReportContext` now skips stub `business_analysis` rows so a newer stub can't shadow an older real BA for `public_narrative`/platform evidence, and `resolveSeedAuditLane(seedId)` resolves `'full'` iff a non-stub BA is reachable via the seed's primary campaign or its parent (fails closed to `'partial'`). The public preview payload carries `audit_lane`; `seedReportPromotable(preview)` (`SeedReportPreviewService`) is the shared web gate — `MarketIntelBanner` self-gates on `surfaceType='seed'` (renders nothing until a promotable report is confirmed — no dead CTA, no partial-lane promo) via its `seedReportReady` prop or its own cached preview fetch, and `MarketIntelSidebar` gates the "How We Found This Business" card on the same flag. The report URL stays reachable (QR kits mint it directly); only the banner promotion is suppressed.

## Local dev environment notes (Windows, added 2026-10-05)

**`pnpm up` leaves the Prisma Client ungenerated -> `checkapi` explodes.** `pnpm-workspace.yaml` disables dependency build scripts (`allowBuilds: '@prisma/client': false`, `'prisma': false`), so `prisma generate` only ever runs via `apps/api`'s own `postinstall`. A plain `pnpm install` runs it; `pnpm up` does not. Symptom: `Module '"@prisma/client"' has no exported member 'PrismaClient'` - plus `'Prisma'`, `'user_role'`, `'inventory_items'`, `'tenants'` - across hundreds of `apps/api/src` files. Fix: `pnpm prisma:generate`. `checkweb` is unaffected; Prisma is API-only.

**`.gitattributes` pins `*.patch` to LF deliberately - do not remove that rule.** pnpm hashes patch file bytes and records the result in `pnpm-lock.yaml` (`patchedDependencies: next-themes@0.4.6: 5aa5fac5...`). With `core.autocrlf=true` a CRLF checkout changes that hash and installs then fail on `patchedDependencies` (`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`). Git-side symptom: the patch file reports as modified while `git diff` is empty, because the index cached the CRLF file size - `git checkout -- patches/next-themes@0.4.6.patch` clears it under the LF rule.

**`pnpm checkapi` / `checkweb` resolve `tsc` from the workspace, never the repo root.** `typescript` is not hoisted (`scripts/tsc-check.js` probes the `--project` dir first): `apps/api` pins `^6.0.3`, `apps/web` resolves `7.x`. Both typecheck clean as of 2026-10-05.
### Scheduled jobs — JobRegistry module (added 2026-10-05)

`apps/api/src/jobs/registry.ts` is the central scheduled-job module backing the admin **Scheduled Jobs** UI (`/settings/admin/jobs`, nav under "Logs & Audit") and `/api/admin/jobs` routes (mounted in `admin.routes.ts` at `/jobs` with `authenticateToken` + `requireAdmin`). Tables: `scheduled_jobs` (registry + `enabled` kill switch) and `scheduled_job_runs` (status/trigger/timing/error/result/captured logs) — migration `database/migrations/312_scheduled_jobs.sql`.

**Convention: every scheduled job must register with the registry.** As of 2026-10-06 all in-process jobs are migrated — the admin board is not auto-discovered, so a job that self-schedules with a bare `setTimeout`/`setInterval` and no registry call is invisible (no run history, no kill switch, no delay clamp). Two participation levels:

- `scheduleJob({name, description, scheduleLabel, envDisableVar, computeNextDelay, handler})` — fully instrumented: registry owns the timer, records every run, captures `console.*` output per run via AsyncLocalStorage (capped 500 lines/64KB), honors the DB `enabled` kill switch, and **clamps non-positive delays to 60s** — `computeNextDelay` must return a future ms delay; the clamp prevents the past-scheduling tight-loop that spammed merchants. New jobs: write a `start*`/`stop*` pair that calls `scheduleJob`/`stopJob` (see `monthly-fee-summary.ts` — the reference; jobs that fire immediately or after a short boot delay use a module-level `firstRun` flag inside `computeNextDelay` to return the startup delay once, then the steady interval).
- `declareJob(name, {scheduleLabel, description})` — catalog-only fallback; shows in the UI flagged "not instrumented" with no run data until migrated. `index.ts` batch-declares the catalog in one `declareJobs([...])` call at the top of the listen callback — add new jobs there too so they surface even before/without instrumentation.

Note: pg_cron jobs (Supabase-side MV refreshes, retention purges) are a separate world — they never appear on this board; `db-rescue.cjs cron list` is the visibility path.

Gotchas: all DB access is fail-safe (missing tables → memory-only mode, jobs still run; retries every 5 min); skipped runs are only recorded for manual/api triggers (disabled tight-schedule jobs would flood the table otherwise); `runJobNow` returns `{runId, skipped, result}` — handler return values persist as the run's `result` JSONB. Manual triggers await full execution — a long-running job can outlast the HTTP timeout but still completes and records. Runs stuck in `running` forever = process died mid-run (no reaper yet).

## PG Cockpit Communications Panel + shared channel resolution (added 2026-10-07)

The PG cockpit (`ProvingGroundCockpitClient`) gained a **Communications** tab (`tab='communications'`, hash `#communications`) mounting `ProspectCommsPanel` — the queue's contact worklist: one row per prospect with resolved channels and the log action its lifecycle supports (`processed_campaign_id` → `LogContactModal`/`logContact`; seeded pre-campaign → `ProspectTouchLogModal`/`logProspectTouch`; `verify_then_outreach` → shared resolve-verification modal; otherwise a disabled "no log target" chip).

- **`resolveProspectChannels(entry)`** (`apps/web/src/lib/prospect-channels.ts`) is THE channel resolver — do not re-extract contact fields in JSX. Precedence: `campaign_*` join fields > `business_snapshot.verified_nap`/`nap` > flat snapshot keys (`phone`/`business_phone`/`email`/`website`/`social_profiles`) > `channel_sequence` rung `contact` values. Input type `ProspectChannelSource` is satisfied by both `ProspectQueueEntry` and `ProspectSummary`. `source` reports `'campaign' | 'snapshot' | 'none'` (UI shows a "verified" chip on campaign-sourced rows).
- **`listProspectQueue(includeCampaigns)`** now flattens `campaign_phone`/`campaign_email`/`campaign_website_url`/`campaign_social_profiles` off the processed-campaign join (`MarketingProspectQueueService.list` select + decoration) so the panel renders verified channels without a per-row `getCampaign`. `LogContactModal` still needs the full `Campaign` (per-row `getCampaign` on click) because channel availability is campaign-shaped.
- **`LogContactModal`** renders the actual target value per channel (phone → tel/sms, email → mailto, website/social → open) above the Channel/Date grid; clicking a row selects that channel.
- **`ProspectTouchLogModal`** is the single pre-campaign touch logger — shared by the queue page, the communications page, and the cockpit panel (the previous three near-identical inline modals were removed). It shows resolved channels + the cadence ladder (current rung highlighted, dead rungs struck) and writes `logProspectTouch` (requires `seed_id` — gate callers on it, `not_seeded` 409 otherwise).
- **Contacted grouping** — the panel splits into "To contact" / "Contacted" sections (Contacted sorted by last_contact_at desc; a "hide contacted" header toggle collapses it). The signal is `list()`-decorated `contacted` / `last_contact_at` / `contact_source` (`'log'|'verify'|'manual'`): two batched `groupBy` lookups per page over `mkt_outreach_log` (via `processed_campaign_id`) and `directory_seed_outreach_touches` (via `seed_id`), plus `verification.resolved_at` / `business_snapshot.campaign_verified_at` (a completed verification call IS outreach — `resolveCampaignVerification` jsonb-merges `campaign_verified_at` onto the linked queue row's snapshot for live-contact outcomes), non-fatal on failure. Queue-only rows have no log anchor, so `PATCH /prospect-queue/:id {contacted}` writes `business_snapshot.manually_contacted_at` (enrichment-gated like `account_family`/`hours` — editable on hold/in_thread, plus contact-only patches on `campaign_created`). The row checkbox is locked on log/verify-derived rows (the record IS the signal), disabled on channelless rows (nothing to contact on — unmarking stays allowed), and toggles the manual flag otherwise. Campaign rows also carry a **Verify** button → `ResolveVerificationModal mode="campaign"` keyed by `processed_campaign_id` (writes verified NAP to the campaign via `resolveCampaignVerification`, not the queue row).

Tests: `prospect-channels.test.ts` (7 — precedence/fallback/coercion), `LogContactModal.test.ts` (3 — target rendering + action hrefs), `MarketingProspectQueueService.test.ts` (+9 — contacted decoration sources, manual-flag patch write/clear/gating).

## Seed listing photos — tier gates don't apply to operator-authored seed content (added 2026-10-07)

The seed place listing (`/place/[slug]` → `PlaceEntryEditorialLayout`) renders the store's own photos via the existing `DirectoryPhotoGalleryDisplay` — the same component all four `DirectoryEntry*Layout`s use — gated by `showsListingPhotoGallery(listing, dirEntryOpts)` in `apps/web/src/lib/place-photo-gallery.ts`.

- **Why the gate is a helper and not `dirEntryOpts?.galleryEnabled ?? true`**: seed tenants are provisioned with `subscription_tier = 'directory_presence'` (`DirectoryPresenceSeedService` create INSERT), the free gateway tier, which does **not** include `directory_entry_gallery_on` (`lib/tiers/tier-features.ts`, asserted by `entry-presence-tier.test.ts`). So the tenant gate resolves **false for every seed**, and reading it naively hides the gallery on the one surface it exists for. The helper bypasses it for `listingOrigin === 'directory_seed'` and leaves it intact for claimed listings — matching the codebase's own precedent on the seed banner QR: *"Tier gates don't apply: this is operator-authored platform styling for the report banner, not a tenant entitlement."* Both callers (`place/[slug]/PlacePageClient.tsx`, `retail/[slug]/page.tsx`) are `'use client'`; the helper lives in `lib/` so it stays importable from either side and unit-testable in node (a named export of a `'use client'` module is a client reference a server component cannot call).
- **The photos write path was unauthenticated and is now scoped**: `POST/PUT/DELETE /api/directory/:listingId/photos` carry `authenticateToken` + `requireDirectoryPhotoWrite` — platform staff (admin/support; viewers are read-only) or an OWNER/ADMIN of the listing's *own* tenant. `GET` stays public. The guard resolves the listing from the route param instead of reusing `checkTenantAccess`, which reads `req.params.tenantId`/`id` and would fall through to `getTenantId`'s last resort — the caller's *first* tenant — i.e. authorize against the wrong tenant. An unclaimed seed has no tenant members, so pre-claim writes are operator-only by construction; the claiming merchant takes over when the claim creates their membership.
- **`PUT /:listingId/photos/reorder` was unreachable** — declared after `PUT /:listingId/photos/:photoId`, so Express matched `:photoId = "reorder"` and 400'd. Moved above it (static-before-dynamic, the convention across the directory routers).
- **`lint-catchall-order` was anchored to the literal identifier `router`**, so files doing `const r = Router()` were invisible to it — which is how the reorder shadowing shipped. `extractRouteEntry` now accepts any identifier and `RouteEntry.routerName` groups the comparison, because one file may hold several routers mounted under different prefixes (`business-hours.ts` mounts `router` and `publicBusinessHoursRouter` separately; comparing across them is a false positive).
- **Render-testing `PlaceEntryEditorialLayout` needs three providers**, not just Mantine: `MantineProvider` → `AuthProvider` (`@/contexts/AuthContext`, via `LastViewed` → `useLastViewedSession`) → `CustomerAuthProvider` (`@/contexts/CustomerAuthContext`, via `MarketIntelSidebar`). `DirectoryPhotoGalleryDisplay` returns `null` during SSR (it loads in a `useEffect` and bails when empty), so a static render can never observe it — mock it with a sentinel to assert the *gate*, which is what `PlaceEntryEditorialLayout.test.ts` does. Production consequence: seeded photos **and their captions** are absent from the initial HTML, so non-JS consumers (link previews, unfurlers) see nothing. Same failure class as the old `/place` H1 bug.

## PB-08 post-decision execution — WebsiteBuildExecutionCard + delivery_mode (added 2026-10-09)

The website-gap motion now has its counterpart of `RepairExecutionCard`: **`WebsiteBuildExecutionCard`** (overview, right after `WebsiteGapBriefingPanel`) backed by **`GET /campaigns/:id/website-build-execution`** (`WebsiteBuildExecutionService`). It self-gates on `isWebsiteGapCampaign` **and** a `playbook_decision.kind='website_build_scope'` — before scope confirmation the briefing panel owns the surface and the card renders nothing. The read model aggregates the decision, `delivery_mode`, `scope_modes`, this campaign's seed link, prospect-shared seeds reachable via sibling links (`linkable_seeds` — the attach path for a non-primary sibling), seed-preview storefront state, the `website_build` intake (`mkt_dispute_intake`, auto-offered at `paid`), and resolved checklist progress + next steps.

- **`delivery_mode` (`'dfy'|'diy'`)** lives inside `playbook_decision` next to `confirmed_scope` — the PB-08 analog of the repair package's mode (pbcs-pb08-005 already names both lanes: operator build vs hand-off to owner/dev). The scope→modes catalog is `apps/api/src/lib/website-build.ts` (`BUILD_SCOPE_MODES` is authoritative — restrict a scope to one lane in one line; all four currently offer both). `PATCH /campaigns/:id/website-gap/delivery-mode` validates mode-against-scope server-side; `confirmWebsiteBuildScope` accepts an optional `delivery_mode` and carries a prior mode forward only while it remains valid for the new scope.
- **Preview storefront controls** (`generateSeedPreview`/`extendSeedPreview` via `DirectoryPresenceAdminService`) reuse the existing seed-scoped demo-storefront endpoints — eligibility is still `isSeedPb08Eligible` (a linked campaign with a confirmed PB-08 decision), so a sibling-linked seed works. Extension cap is `SEED_PREVIEW_MAX_EXTENSIONS = 2` (+7d each, 28-day hard cap), mirrored in the card's button copy.
- **The sibling-attach path matters**: `resolveCampaignSeedId` only reads a campaign's own `directory_seed_campaign_links` rows, so a PB-08 secondary sibling with no link row can't run the preview until it's attached to the prospect's shared seed with `link_role='sibling'` (one seed per prospect — never create a second primary).
- SSR-testable via the `initialExecution` prop (same test-hook convention as `initialTab`/`initialOutcome`): pass a fixture `WebsiteBuildExecutionReadModel` to skip the fetch. Tests: `WebsiteBuildExecutionCard.test.ts`.

## Deliverable source material — dual execution lanes (added 2026-10-09)

"Generate Source Material" in the Generate Deliverable modal now has the same dual-execution surface as `WebsiteGapBriefingPanel`/`RepairTrackPanel`/`ArchetypeBriefingPanel`: **AI Run** (internal `executeSingle`) or **External** (render → copy into any external LLM → paste JSON → validated import). The external lane needs zero platform AI credits.

- `DeliverableSourceService.buildSourceMaterialContext` is the single assembly point — campaign + latest `business_analysis` audit + eligibility + review intake + prior outreach + `evidence_snapshot_hash` + substituted variables — shared by all three methods so the lanes can't drift: `generateSourceMaterial` (internal), `renderSourceMaterialPrompt` (`GET /deliverable/:campaignId/source-material/render` — the generic `GET /prompts/templates/:id/render` CANNOT substitute here because these variables are service-computed, not auto-sourced by `resolvePrompt`), and `importSourceMaterial` (`POST /deliverable/:campaignId/source-material/import` — wraps `MarketingPromptService.importExternalResult`, which validates against the registered `deliverable_source_material` schema, `auditPlatform: null` so no audit row).
- The import stamps `variables_used.evidence_snapshot_hash` onto the imported execution (echoed `snapshot_hash` from the render response, falling back to current) so the §7.1 idempotency cache treats the import as the execution for that audit+signals state — a stale render's hash simply misses the cache on the next Generate.
- `getSourceMaterial` reads the latest `completed` execution for the template regardless of lane, so imported output flows through `normalize()` → `getTypeSource` → `resolveDeliverableContent` unchanged. Fulfill templates (`mpt-seed-fulfill-*`, `raw_json` schema) are importable via the generic `/prompts/executions/external` already but still lack dedicated render endpoints — same helper-extraction pattern applies if the lane is extended.

## Deliverable prompts — tone/attribution alignment (added 2026-10-09)

Gold-standard/profile awareness was ALREADY wired: `resolvePrompt`'s §1B amplification maps business-scope `fulfill` → `fulfill_target` (injects `serializeGoldStandard(profile,'target')` + signal-weight block) and `seek` → `category_audit` (benchmark variant). What was missing: scan-emitted attribution and prospect context never reached the deliverable lane, and three legacy bodies had real bugs.

- **New variables on both lanes**: `{{business_attributes}}` (campaign `attributes` + `business_origin_country/region` + `tone` + `secondary_categories` via `formatBusinessAttributes`) and `{{discovery_attribution}}` (`renderProspectOriginBlock` — now public on `MarketingExecutionService` — the unified `discovery_context` renderer: `bronze_attribution` reason keys from the emerging lane, `competitive_weaknesses` from the competitive lane, combined differential block when both). Both are supplied by `buildSourceMaterialContext` (source-material prompt) and `resolveDeliverableContent` (every fulfill). `''`/‘(none recorded)’ when absent — scope-check safe.
- **`serializeAuditResults` now surfaces the gold-standard-measured audit outputs** — `public_narrative`, `gap_analysis` (expected-vs-actual, severity), `quality_gate_results`, `recommended_attributes` (with `basis: gold_standard_expected|category_intelligence|audit_evidence`) — previously dropped, so the analyst prompt couldn't see the benchmark measurements the fulfills fix toward.
- **`public_narrative` is supplied to fulfills** from the latest BA audit (fixes `mpt-seed-fulfill-006` — `{{public_narrative}}` was declared but never supplied → out-of-scope throw on every seo_content fulfill).
- **`mpt-seed-fulfill-003` consumed `{{services}}`** — the fulfill auto-source filled it from `recommended_services`, so the GBP audit prompt silently rendered the service menu instead of GBP findings. Now `{{gbp_audit}}`; renamed 'Fulfill: GBP Audit Report' to match the modal label.
- **`mpt-seed-fulfill-001` (Review Responses) is DEPRECATED** (`is_active:false` via the new `isActive` seed field) — review_responses runs through `ReviewSlotService`/`OwnerVoiceService` (G-4); the template's `{{voice}}`/`{{reviews}}` were unsupplied → out-of-scope throw if invoked.
- **`mpt-seed-fulfill-002` rewritten** — dropped invented-tier pricing ("Basic/Standard/Premium" contradicts Register B), booking CTA → visit-and-inquire, added explicit `Output JSON:` (the `raw_json` promptSuffix demands valid JSON; prose bodies conflicted).
- **`evidence_snapshot_hash` now covers attribution context** (`business_attributes` + `discovery_attribution` fingerprint) — an operator-edited origin or re-attributed `discovery_context` invalidates the §7.1 cache instead of reusing a stale render.
- **Directives**: `DELIVERABLE_FULFILL_TONE_DIRECTIVE` + `DELIVERABLE_SOURCE_MATERIAL_TONE_DIRECTIVE` gained the physical-shelves platform goal + attribution rules ("honor supplied origin/attributes; attribution is operator context — never emit it into the deliverable"). `REPORT_DIRECTIVES_VERSION` → `report_directives_v3`.
- **Layout seed** (`DELIVERABLE_LAYOUT_SEED_V6`): Next-step CTA now points at the in-content claim link (dedupes the double CTA) and the retainer line lost its unsupported "costs you customers" claim.
- **Seeds run on local + prd 2026-10-09** (all three: V7 source-material/fulfills, ops templates, V6 layouts). `doppler --config stg` is NOT a separate database — it points at the local DB, so the local seed run already covers it; only `local` and `prd` ever need seeding.

## `deliverable_source` prompt role (added 2026-10-09)

The two deliverable-lane seek templates no longer inherit `category_audit` amplification — the source-material analyst is a POST-audit assembler, not a researcher, so the CI profile block / specialized sources / INT signal list / market context (audit-research material, and INT codes adjacent to `signals_consumed` was a contamination risk) are all wrong inputs. `resolvePrompt` now maps by template id before the `category_audit` default: `mpt-deliverable-source-material` → **`deliverable_source`** (injects `serializeGoldStandard(profile,'target')` + signal-weight block only — the gold standard in target role is the sole category-expectation source when no business_analysis audit exists, e.g. extractor-derived `WC_BUILDER_SUBDOMAIN` campaigns); `mpt-review-intake` → **`none`** (verbatim parser — byte-identical base render + schema suffix). Both ids are module constants in `MarketingExecutionService` (not imported from `DeliverableSourceService` — that would invert the dependency edge).

Seed V8 companion changes: `{{website_url}}`/`{{business_address}}`/`{{business_phone}}` variables (a `WC_BUILDER_SUBDOMAIN` campaign knows its hosted URL — the analyst must see it; address/phone feed contact-page content), RULES ground fields in "audit results, parsed review intake, **or the supplied category benchmark**" (benchmark is legit input for `category_expectations`/`must_have_pages`, never observed fact), empty-section sentinels (`prior_outreach` → `(none sent yet)`, `review_intake` → `(empty)`), and `evidence_snapshot_hash` now fingerprints website/address/phone too. Re-run `seed-deliverable-source-material-templates.ts` on local + prd.

## Fulfill-output PDF formatter (added 2026-10-09)

Every `mpt-seed-fulfill-*` execution stores `raw_json` — that JSON is the structured artifact future consumers (e.g. a mock-draft build) read, so the execution row stays untouched. Rendering it verbatim dumped the raw JSON into the customer-facing PDF body (the W6b defect `extractContentFromExecution` special-cases only for `citation_repair_package`). `formatFulfillContent` (`services/deliverable/deliverable-content-format.ts`) is the presentational bridge, applied inside `resolveDeliverableContent` before the quality/repetition gates: parses the first balanced JSON object (string-aware brace scan, fence-stripped), renders per-type `TYPE_LABELS` sections (e.g. `site_map` → "Site Map & Page Spec"), titled numbered blocks for object arrays (`page`/`title`/`name`/`platform`/`question`/`quote` title-field detection), `· `-joined inline lists ≤80 chars vs `•` bullets, `COMMON_LABELS` sub-keys + snake_case→humanized fallback so unknown keys render instead of dropping, and preserves prose trailing the JSON. Non-JSON/malformed output passes through byte-identical. Emits plain text — `renderLayoutSections` prints the body verbatim, so markdown syntax would show literally. Tests: `__tests__/deliverableContentFormat.test.ts`.

**The claim CTA is render-appended, not analyst-emitted** (SEED V10): the fulfill bodies' "Close with the claim-and-fix CTA" instruction was dead — `RAW_JSON_PROMPT_SUFFIX` demands "valid JSON only, no commentary", so a prose close was unemittable and the model dropped it (the PDF carried no claim link). Putting it in the JSON contract (V9) worked but routed a verbatim resolved string through the model — drop/mangle/misplace risk for zero added intelligence. Now `resolveDeliverableContent` appends `buildClaimCta(url)` to the formatted content directly: deterministic close, real claim URL, and **claimed seeds get no CTA** — `ensureClaimUrl` returns `{ url, claimed }` so the nothing-left-to-claim case omits it (link-less variant covers unlinked/draft/suppressed). The `claim_cta` prompt bodies/`Output JSON:` field are gone (V10; `{{claim_cta}}` is still supplied as `claimCta ?? ''` so pre-V10 seeded rows never render a literal placeholder), and `formatFulfillContent` drops a `claim_cta` key inside the JSON to dedupe V9-era executions. Re-run BOTH seed files on local + prd (`seed-deliverable-source-material-templates.ts` V10 + `seed-marketing-ops-templates.ts`).

## Vercel AI Gateway — config completed (added 2026-10-09)

The gateway code path (`VercelGatewayProvider` + `AiProviderFactory` preference when `AI_GATEWAY_ENABLED=true`, admin UI under Bot AI Controls) was fully built but unconfigured: no `AI_GATEWAY_*` vars existed in any Doppler config. Now set in `local`/`stg`/`prd`: `AI_GATEWAY_ENABLED=true`, `AI_GATEWAY_API_KEY` (`vck_…`), `AI_GATEWAY_DEFAULT_CHAT_MODEL=openai/gpt-4o-mini`, `AI_GATEWAY_DEFAULT_EMBEDDING_MODEL=openai/text-embedding-3-small`. **The repo shipped the wrong endpoint** — `https://gateway.ai.vercel.com/v1` (in `.env.example`, `unifiedConfig` default, docs, test fixture) fails with a bare connection error; the real endpoint is `https://ai-gateway.vercel.sh/v1`, verified live (`openai/gpt-4o-mini` → 200). Also note the gateway enforces `max_tokens >= 16` (translates to `max_output_tokens`) — every internal call site uses ≥100, so no action needed. With the key present, gateway handles all chat with `AI_GATEWAY_DEFAULT_CHAT_MODEL` unless `bot_chat_provider='vercel-gateway'` in `platform_settings_list`, in which case `bot_chat_model` (a gateway `provider/model` id, selectable in Bot AI Controls) wins. If the key is absent, `isAvailable()` is false and `getChatConfig` falls through to the configured provider (safe no-op). Deployed hosts must pick up the Doppler vars (restart/redeploy or mirror into Railway env).

## Tenant subdomain model + `/api/slugs` retirement (added 2026-10-10)

A tenant's `subdomain` mirrors its `slug`: `subdomain IS NULL OR subdomain = slug`. Subdomains are opt-in (a tenant may have a slug without one). All rules live in `apps/api/src/lib/subdomain.ts` (reserved-name list, format, availability across `tenants.subdomain` + `tenants.slug` + `directory_settings_list.slug`, plus `assignSubdomain`/`clearSubdomain`). Assign/rename routes through the platform-standard `SlugSingletonService.updateSlug` (syncs `directory_settings_list` + `tenants.slug` + `directory_listings_list`); `updateSlug` also mirrors an existing subdomain when the slug changes. Remove clears `subdomain` only — the slug (and its public slug URLs) is retained.

Surfaces: `PUT/DELETE /api/tenants/:id/subdomain` (self-service, `checkTenantAccess`) and `/api/admin/subdomains` (platform-admin list/rename/remove + `check`, audited). The admin page is `/settings/admin/subdomain`.

`/api/slugs` is mid-retirement — see `docs/SLUG_API_RETIREMENT.md`. Only `POST /api/slugs/patterns` has a first-party consumer; the rest are archived (`routes/archive/slug-generation.retired.ts`), kept live behind `deprecate()` headers (`middleware/deprecation.ts`) for a window, then hard-deleted later. `PATCH /api/tenant/profile` now requires `checkTenantAccess`. Deferred (documented, not fixed): `POST /api/tenants` writes `tenants.slug` directly (bypasses `SlugSingletonService`); `PUT /api/tenant/:tenantId/profile` has no auth middleware and a skippable tenant check. `gen:route-map` needs `doppler run --config local` (fails without Supabase env), and its committed output is already out of sync — regenerate only if your workflow expects it.

## A8 / PB-09 Profile Presence & Creation (migration 334, added 2026-10-10)

The "no profiles" archetype. Owns the previously orphaned presence/integrity signal family: `DS_MISSING_PROFILE`, `DS_CLAIMED_STATUS`, `DS_ZERO_INDEXED_PRESENCE`, `DS_PROFILE_SUSPENDED`, `DS_DUPLICATE_LISTING`, `DS_HIJACKED_LISTING`, `DS_OWNERSHIP_DISPUTE`, `DS_ADDRESS_VERIFICATION_BLOCK` (all `primary_playbook='PB-09'` + in PB-09 `matching_rules.any`), with `CP_MISSING_CONTACT_INFO` as `secondary_playbook`. Distinct from A7 (website acquisition/build): A8 is platform-profile presence — every directory/social profile is a door; missing profiles = discovery loss.

- **Cascade rank 3** — PB-04(1) > PB-05(2) > PB-09(3) > PB-01(4) > PB-02(5) > PB-07(6) > PB-08(8) > PB-03(9). PB-05 `dual.groupA` also gained the eight presence codes. Category `profile_repair` / `repair_track='standard'` — flows through all normal repair surfaces, no gate changes.
- **Seeded INACTIVE** (same G-1 guard as PB-08 — an active PB-09 lets pre-A8 code stamp `archetype='A8'` and throw on validation). Activate after A8 code is live: `UPDATE mkt_playbook_catalog SET is_active = true WHERE code = 'PB-09';`
- **Offers:** FITD `One-Time Profile Presence Build` $149; retainer `Profile Presence & Sync Defense` $199/mo. Both DFY and DIY lanes — the presence plan deliverable carries a DFY/DIY fork (we build vs owner builds from the same benchmarked blueprint). `profile_setup` intake auto-fires at `paid` on PB-09 campaigns (`trigger_guard` playbook_code=PB-09) — owner supplies the canonical record.
- **Gold-standard intelligence:** profiles are built to the category gold-standard field set (`IntelligenceProfileService.resolveGoldStandard`), not bare name-and-phone listings — pitch copy, checklist steps, and the `profile_presence_plan` deliverable prompts all say so. Checklist step 2 has operators supplement the audit with per-platform evidence (URLs, claim states, customer-visible state) — supplemented evidence feeds the next briefing.
- **Sibling rank 2** (A2 > A8 > A1 > A6 > A3 > A4 > A7 > A5) in `BusinessProspectService`/`GalleryMultiService`; report chapter `presence` (`ARCHETYPE_CHAPTERS.A8`); discovery-verdict tilts **visibility**; flagship deliverable type `profile_presence_plan` (catalog preview type is `gbp_audit`, shared with A3); new `profile_rescue` hook covers the integrity family (suspended/hijacked/disputed/verification-blocked).
- **Audit emission (2026-10-10):** the six `model_emitted` presence/integrity codes (`DS_ZERO_INDEXED_PRESENCE`, `DS_PROFILE_SUSPENDED`, `DS_DUPLICATE_LISTING`, `DS_HIJACKED_LISTING`, `DS_OWNERSHIP_DISPUTE`, `DS_ADDRESS_VERIFICATION_BLOCK`) were registered+routed but had no audit-prompt vocabulary — nothing taught the model to emit them. Definitions now live in `business-audit-default-body.md` §Digital Surface & Profile Signals (the two V2 variants are retired; the canonical `mpt-seed-seek-001` body is the file), guarded by "integrity ≠ availability" (a non-rendering profile is a render_controls question, never an integrity finding). Marker `business-audit-default-2026-10-10-presence-signals-2`. **Caution:** the retired V2 bodies carry a duplicated `DS_MISSING_PROFILE` amendment clause — `replaceFirst` isn't prefix-safe when FROM is a prefix of TO; check `position()`/count before relying on replaceFirst idempotency for amendments whose TO contains FROM.

**Applying data migrations without psql:** the `relation "the" does not exist` failure on 334 was a SQL client naively splitting on `;` inside string literals, not invalid SQL. Pattern that works (no psql, pgbouncer-safe): read the file and send it whole through `pg`'s simple query protocol under `doppler run --config <local|prd>` — same env/connection as `scripts/db-rescue.cjs`. Supabase `execute_sql`/`apply_migration` MCP tools are read-only/permission-gated in this setup; `db-rescue sql` is SELECT-only.

**Migration 335 — wasted-signal consolidation (2026-10-10):** every diagnostic signal code now has a playbook home. `DS_OUTDATED_HOURS`/`DS_OUTDATED_HOLIDAY_HOURS` → PB-01 `any` + `primary_playbook` + PB-05 `dual.groupA` (drift-class evidence); `VP_MISSING_PRODUCT_PHOTOS`/`VP_MISSING_STOREFRONT_PHOTOS` → PB-06 `any` + `primary_playbook`. Three `INT_*` codes wired for the **partial lane's seed tilt** (the scorer iterates raw `INT_*` codes — a declared route is the only way a code with no canonical term contributes): `INT_LOW_VISIBILITY`/`INT_WEAK_MAINSTREAM_INDEXING` → PB-09 (+5 visibility, matching their `INT_SIGNAL_MAP` → `DS_MISSING_PROFILE` derivation), `INT_PLATFORM_SIGNAL_DIVERGENCE` → PB-01 (−5 doubt + `route_` marker — divergence is drift-class identity doubt). Deliberately unwired: the identity-corroboration `INT_*` codes (`MULTISOURCE_IDENTITY`, `SINGLE_SOURCE`, `ACTIVE_OPERATIONAL_EVIDENCE`, `RECENT_BUSINESS_EVIDENCE`, `POSSIBLE_CATEGORY_MISALIGNMENT`) whose canonical ±10 terms + doubt markers a generic ±5 tilt would suppress; context `INT_*` (`HIDDEN_TRUST`, `UNDEREXPOSED_CREDENTIAL`, `CATEGORY_SPECIALIZATION`, `VERTICAL_SOURCE_DISCOVERY`) — enrichment facts, not gaps; `OX_*` (outreach lifecycle events); `CP_MISSING_CONTACT_INFO` (secondary → PB-09 per 334).

**Signal layering rule:** `INT_*` = **diagnostic layer** — identity/context evidence that reveals the pains and calibrates how much to trust the read; `DS_*`/`WC_*`/`CP_*`/`VP_*`/`RA_*` = **pain layer** — named fixable gaps that trigger playbooks; `OX_*` = **lifecycle layer** — outreach engagement state. Wire pain-layer codes to playbooks; wire a diagnostic code only when it is effectively a pain statement (`INT_LOW_VISIBILITY` → "you're invisible" = PB-09's thesis) or itself a symptom (`INT_PLATFORM_SIGNAL_DIVERGENCE` = drift). Never wire a diagnostic code whose job is evidence quality — the route would replace its canonical confidence term with a weaker generic tilt.

**Migration 336 — DS_PROFILE_NOT_PUBLIC + the `restricted` verdict (2026-11):** a business profile that exists but the public cannot see (private/unpublished, login-gated basic listing data, search-suppressed, authenticated-only capture) is a **visibility pain** — businesses are expected to be publicly discoverable, so "hidden" is a defect, not an evidence caveat. The render-control vocabulary gained a fourth determination `restricted` between `business_specific_failure` (verified absent → `unavailable` → DS_MISSING_PROFILE) and `unable_to_verify` (existence indeterminate → no signal): existence verified + public render denied → `data_status: "restricted"` + `DS_PROFILE_NOT_PUBLIC` + a `profile_visibility` gap (`non_negotiable` — to a customer it is as invisible as absence). Touched: `dataStatusEnum`/`renderControlDeterminationEnum` + schema doc string, audit body (`presence-signals-3`, seeded local+prd), signal-extractor derive (any platform `data_status==='restricted'`), taxonomy code+label+`isRepairSignal` (KNOWN_SIGNAL_CODES=55), A8 fields (`restricted_platforms` + integrity flag "a profile the public cannot see"), registry → PB-09 `any` + `primary_playbook` + PB-05 `dual.groupA`. Operator-evidence directive **v4/v5**: `HIDDEN IS NOT MISSING` — an `authenticated`-only capture is existence evidence → `restricted`, NOT missing (composes with v3's NOT-IN-FILE rule: absent from sweep = missing; captured-but-walled = restricted). **Operator = public proxy (v5):** if the operator could see it, it's public; if they could only reach it authenticated, it's `restricted`. Conversely, analyst-side barriers (Yelp bot policy, Facebook login gate) measure the analyst's access, not the public's — a bare barrier is NEVER restricted or missing, it stays `unable_to_verify` absent control/operator evidence. `unable_to_verify` survives only for evidence genuinely outside the check scope.

**Education-through-signal (2026-11):** `DS_PROFILE_NOT_PUBLIC` drives the "being listed ≠ being visible" lesson end-to-end — A8 opener hook variant (`restricted_platforms`: "your profile is there, but customers can't get into it"), presence report costing card ("a door customers can see but can't open — making it public is the fix"), `describeProfilePresence` state line + integrity issue in deliverable sections, `PRESENCE_SIGNAL_CODES` (A8 deterministic selection), severity `'material'` in signal-magnitude (exists-but-walled: invisible to customers, cheaper to fix than absence), `SIGNAL_TO_TRIAGE_VOCAB → 'platform_gap'` (hidden ≠ suspension track), `profile_presence_plan` + `gbp_audit` signal sets in DeliverableSourceService, and the fulfill-011 prompt (state enum adds `hidden` — "a locked door"; INTEGRITY REPAIRS covers publish/lift-restriction before build; EDUCATION NOTE teaches listed≠visible; seed marker `DELIVERABLE_SOURCE_MATERIAL_SEED_V11`, seeded local+prd).

**DS_DUPLICATE_LISTING broadened to alternate identities (added 2026-10-15):** the emit rule was name-first ("same or near-same name/address/phone, slight variants"), so an auditor legitimately declined to fire it on a second live profile under a *different trading name* at the same address+phone — the exact `alternate_identity` case (the bronze catalog's own canonical example: "Ethiopian Eritrean Store" at Arsema's address and phone). `business-audit-default-body.md` now defines the tell as **shared identity, not shared name**: same/near-same name/address/phone OR a different trading name carrying the same street address AND phone, with an explicit non-emit clause for two genuinely distinct businesses sharing a building (different phone, no shared identity). Marker `business-audit-default-2026-10-15-duplicate-listing-alternate-name-1`; seeded local+prd. Registry description broadened to match (local+prd). `discovery-verdict.ts` `BRONZE_REASON_SIGNAL_MAP.alternate_identity` now yields `['CP_NAP_NAME_DRIFT','DS_DUPLICATE_LISTING']` — the discovery scan already detects the second trading name (bronze `alternate_identity`), so the added code is what makes the find **actionable**: it routes to PB-09/A8 presence (pitch `profile_rescue` hook / approach / outreach / briefing / report all pre-existed for A8) instead of dying as a doubt marker with no playbook. **No new signal code** — `DS_DUPLICATE_LISTING` was already in `PRESENCE_SIGNAL_CODES` (A8 selection), PB-09 `matching_rules.any`, `primary_playbook`, and `PB-05.dual.groupA`. PB-09 is already `is_active=true` on prd (the migration-334 G-1 guard was cleared once A8 code shipped).

**`WC_MISSING_WEBSITE` gate loosened to any reachable profile (added 2026-10-23):** the website-absence rule required **at least three readable profiles** to show no website before the signal could fire, which conflated evidence sufficiency with profile count. A business whose one rendered profile carries an empty website field, plus a failed owned-domain/builder-subdomain search, is a missing-website finding — but the rule withheld the signal while `website.status` was still set to `none_found` on the same evidence, producing an internally inconsistent audit (Gomez African Grocery, Indianapolis: GBP website field `n/a`, no owned domain or builder subdomain located, one reachable profile → `none_found` with no signal). The gate is now **one reachable profile**: the business's own primary profile is the authoritative surface for its website field, so a business that has a site will list it there. The owned-domain/builder-subdomain search requirement is **retained** — it is the guard that stops a merely-incomplete profile from becoming a false positive — and unread profiles are still recorded in `website.issues`. Marker `business-audit-default-2026-10-23-website-absence-any-profile-1`; seeded local+prd (body 95,652 chars on both, verified by `position()` on the new and old rule text). The retired V1/V2 audit bodies never carried this rule — they hold only the one-line signal definition ("Business has no website URL listed on any profile") — so no archival sweep was needed. **Note:** the seed's idempotency gate is marker *presence*, so a checkout whose `.md` predates a marker bump will silently rewrite the template back to the older body; land the body + `DEFAULT_AUDIT_MARKER` on `main` before seeding.

**Keyword surface plan (A8 / PB-09, added 2026-10-15):** a fourth A8 presence deliverable section (`keyword_surface_plan`, template `mpt-deliverable-section-keyword-surface`) that routes a business's real-world identity tokens to the fields that legitimately carry them. Motivating class: multi-name / immigrant-owned storefronts whose identity does not fit Google's single name field — their workaround is a second (duplicate) profile with a keyword-bearing name. The owner's instinct is right; the tool is wrong. Pure helper `services/deliverable/keyword-surface-plan.ts` (`buildKeywordSurfacePlan` / `extractIdentityTokens` / `formatKeywordPlacements` / `formatDuplicateListingNote`) extracts tokens from the observed names (`nap_consistency.name_variations`, `platforms.*.displayed_name`, `alternate_profiles[].name`) plus category vocabulary, dropping structural noise (`llc`/`inc`/`store`/`mart`/… — but **NOT** `merkato`, a distinctive trade term, not a generic category word). Six placements: name (brand only — the one field the tokens must NOT go), categories, services, products, description, attributes. `DeliverableSectionService.describeKeywordSurface` reads the audit (pure); the analyst hop writes the prose (`KEYWORD_SURFACE_PLAN_PROMPT` in `deliverable/prompts.ts`). Seeded local+prd — which also **created** the three pre-existing A8 section templates (presence-map / profile-build / claim-guide had never been seeded on prd). The `profile_presence_plan` **source material** carries it too — `fulfill-011` gains task item 10 + the `keyword_surface_plan` sub-key (`{identity_tokens, alternate_names, placements[], name_note}` on `profilePresencePlanSourceSchema`, plus a `TYPE_LABELS.profile_presence_plan` label) — so the workspace section AND the deliverable JSON both carry the plan. Source-material seed marker → `DELIVERABLE_SOURCE_MATERIAL_SEED_V12`, re-seeded local+prd. Both consumers are **type-agnostic**: `DeliverableAssemblyService.assemble` loops every approved section by `section_index` (no allow-list), and `DeliverableSectionCard` renders `title`+`content` with no type switch — so a new section needs no registration anywhere. The only gate is `archetype === 'A8'` (`resolveCampaignArchetype`).

**Discovery duplicate sweep + `INT_POSSIBLE_DUPLICATE_LISTING` (added 2026-10-15):** the discovery scan can only emit `INT_*` codes in `discovery_signals` (§S1), so duplicate detection needed a diagnostic-layer code plus a directive. `INTELLIGENCE_DISCOVERY_PROMPT_SUFFIX` (`intelligence-discovery.schema.ts` — **code, so retroactive; no re-seed**) gained a REQUIRED rule: for every candidate, check whether a SECOND live listing exists on the same platform at the same street address AND phone under a different trading name. Address+phone alone is the tell (a matching name is NOT required); two genuinely distinct businesses sharing a building with different phones are NOT duplicates. On a hit the scan emits `INT_POSSIBLE_DUPLICATE_LISTING`, lists the alternate name(s) in `candidate_key_aliases`, records the alternate URL in `discovery_provenance` (role `alternate_listing`), and — when the BRONZE STANDARD block is present — attributes the `alternate_identity` reason with a basis naming the shared address and phone. The code is registered in `mkt_signal_registry` (family `INT`, `model_emitted`; 12 codes now — `seed-intelligence-discovery-signals.ts`, marker `2026-10-15-duplicate-listing`, seeded local+prd) and mapped in `discovery-verdict.ts` `INT_SIGNAL_MAP` → `DS_DUPLICATE_LISTING`, the pain-layer code that routes PB-09/A8. Deliberately NOT a `DOUBT_DISCOVERY_SIGNAL` — a duplicate listing is a named fixable pain, not identity doubt; the mapping carries it, and no direct `primary_playbook` pref is needed because the derived `DS_*` code already sits in PB-09's `any`. Directive-home map (per `DISCOVERY_SCAN_CONTRACT_SPEC.md`): output contract → `INTELLIGENCE_DISCOVERY_PROMPT_SUFFIX`; posture → `PromptComposerService.composeIntelligencePrompt`; mechanism set → `seed-intelligence-fragments.ts`.

**Duplicate resolution — retire-or-merge fork + the split-identity insight (added 2026-10-15):** the Arsema case escalated. The NEWER listing ("Ethiopian Eritrean Store") carries the business's **linked social profiles**, so the OLDER listing ("Arsema Food Mart") read as bare and the audit emitted missing-profile signals that were **artifacts of the split, not real absence**. Encoded in three places:
- **Audit body** (`business-audit-default-body.md`, marker `business-audit-default-2026-10-15-split-identity-3`, seeded local+prd): the `DS_DUPLICATE_LISTING` definition now states a duplicate fragments the business's CROSS-PLATFORM identity — the linked social/directory profiles usually hang off ONE of the listings — and requires checking the alternate listing before emitting any missing-profile/absent finding, recording which profiles the alternate carries.
- **Repair guidance** — the fork is now explicit in BOTH prompt sites: `OWNERSHIP_CLAIM_GUIDE_PROMPT` (`deliverable/prompts.ts`, construction marker `DELIVERABLE_CONSTRUCTION_SEED_V2`) and `FULFILL_011` (source material, marker `DELIVERABLE_SOURCE_MATERIAL_SEED_V13`). Both state: MERGE into one owner-approved profile OR RETIRE the duplicate; the **OWNER picks the survivor**; the criteria (older = likely the platform's original; claimed = the one you can act on; review count; the name matching signage/website); **review transfer on a merge is NOT guaranteed** — never promise "you keep all the reviews"; and the cross-platform consequence.
- **Call script** — `REPAIR_CALL_SCRIPT_OBJECTIONS` (hook-library) gained *"I want to keep both listings"*, the exact pushback, countered in order: **split ranking** (paid daily, no adversary needed) → **enforcement** (complaint-driven; the newer listing usually goes) → **control** (an unclaimed duplicate can be claimed or edited by anyone). A3/A5/**A8** all inherit the set (11 objections now; `CallScriptService.test` updated).

**Pre-existing gap fixed in passing:** `DS_PROFILE_NOT_PUBLIC` (migration 336) was repair-class but appeared in NO hook's `signals`, so `hook-library.test`'s *"every repair-class signal has at least one angle"* was already failing. Added it to the `profile_rescue` angle (integrity family) plus the test's stale `REGISTERED_SIGNALS` list, which had stopped at migration 334.

**Identity-split contract audit — validation / triage / shape / render (2026-10-15):** verified the whole surface; three drifts found and fixed.
- **The validator's `BUSINESS_ANALYSIS_PROMPT_SUFFIX` is NEVER rendered** — `business_analysis` sits in `LEGACY_NO_SUFFIX_SCHEMAS` (`MarketingExecutionService.resolvePrompt`), so the embedded skeleton in `business-audit-default-body.md` is the model's ONLY output contract. The suffix edit is drift-prevention only (as the spec prescribes); both carry `alternate_profiles`.
- **Skeleton ↔ directive drift (fixed):** the directive says `platforms.<platform>.alternate_profiles[]`, but the skeleton showed the key under `google` only — while the zod schema allows it on ANY platform (it lives on the base `platformSchema`). Added it to the `yelp` and `facebook` skeleton blocks; marker → `business-audit-default-2026-10-15-split-identity-4`, re-seeded local+prd (4 occurrences now: 1 directive + 3 skeleton).
- **Consumer scope drift (fixed):** `DeliverableSectionService.describeKeywordSurface` read `google.alternate_profiles` only; now reads every platform, matching the A8 `archetypeFactSlice`. `PlatformAudit` (`archetype-selection.ts`) now declares `alternate_profiles` so the shared typed shape agrees.
- **New guard:** `validators/__tests__/business-audit-body-skeleton.test.ts` — extracts the body's fenced JSON skeleton and asserts (a) `alternate_profiles` on google/yelp/facebook, (b) every schema top-level key has a slot in the skeleton, (c) every google-block schema key has a slot. **Structural, not value-level:** the skeleton's enum fields carry `|`-list placeholders (`"confirmed|ambiguous|mismatched"`) on purpose so the model won't echo them as defaults — those values are deliberately invalid, so `safeParse` of the raw skeleton can never pass. Zod v4 introspection: `_def.type` + the public `.shape` object; wrappers via `_def.innerType`.
- **Known asymmetries (deliberate, not disagreements):** `DS_DUPLICATE_LISTING` is `model_emitted` only — `signal-extractor` derives no belt-and-suspenders code (unlike `DS_CLAIMED_STATUS` / `DS_PROFILE_NOT_PUBLIC`). And discovery carries no structured alternate facts: the scan records the alternate URL in `discovery_provenance` (role `alternate_listing`) while the BA holds `alternate_profiles` — only the BA carries review_count/rating.

**`alternate_profiles` → SEO `sameAs` (added 2026-10-15):** the seed SEO composer now unions `platforms.*.alternate_profiles[].url` into `sameAs` — new `AuditSeoFields.alternateProfileUrls` + a `composeSameAs` branch (`SeedSeoComposer`), with caller extraction in `DirectoryPresenceSeedService.composeCampaignSeoPacket` walking the same `['google','yelp','facebook','bbb']` loop as `profile_url`. A second live listing for the same business IS the same entity elsewhere, so it belongs in the sameAs set. **This closes a hazard created by the `same_as` override:** the resharpen guard is **whole-seed** — `EXISTS(... WHERE field_key IN ('description','keywords','same_as') AND override_by IS NOT NULL)` skips the seed entirely — so stamping `override_by` on `same_as` (to protect the hand-added profile URLs) also froze `description`/`keywords`, and the manual "Reset to composed" (`resetEnrichment`, which bypasses the guard) would have **dropped** those URLs. Now a recompose preserves them. No `COMPOSER_VERSION` bump: that constant distinguishes deterministic vs campaign-written packets (`CAMPAIGN_COMPOSER_VERSION = 2`) for the category/location enrichment tables — it is not a re-run trigger, and bumping it would force a mass re-enrichment for a marginal gain. The fix applies on each seed's next compose (birth / resharpen / reset / backfill). **Still open:** the whole-seed guard is coarse — a hand-edited `same_as` freezing `description`/`keywords` is arguably wrong; per-field skipping would be the refinement.

**Log Contact ↔ Outreach Prep parity — worksheet prefill (added 2026-10-15):** the Log Contact modal loaded the campaign's contact channels on open but opened the **confirmed-fields trio** (owner name / team signal / preferred channel) **blank** even when the Outreach Prep worksheet already held them — so the operator retyped values the platform had, and a team signal settled in a walk-in meeting never reached the modal that records it. `LogContactModal` now prefills all three: an optional `initialWorksheet` prop (a caller that already has it can pass it) with a best-effort `marketingOpsService.getOutreachIntelligence(campaign.id)` fetch fallback. Each field fills **only while still empty**, so an operator edit always wins over a late-arriving fetch, and a worksheet `team_signal` of `'unknown'` is the absence of a signal — it prefills nothing. Passing `initialWorksheet={null}` means "there is none" and skips the fetch. New **`initialTab`** prop: Radix `TabsContent` unmounts inactive panels, so the write-back block (and its prefill) is absent from a static render unless it is the active tab — same test hook as `ResolveVerificationModal`'s `initialTab`/`initialOutcome`. Write-back stays conflict-safe: the backend records a same-value resubmit as idempotent, never a conflict. Tests: `LogContactModal.test.ts` (assert the `<select>` prefill via `value="…"[^>]*selected` — React serializes controlled select state as `selected` on the matching option, unlike `<input>`'s `value`).

**…and the reverse direction — Outreach Prep gets the contact channels (same day):** the Outreach Prep tab showed the team signal but **not** the prospect's contact channels, so the worksheet was prepared blind to the channels the prospect is actually reachable on. Rather than copy the modal's target block, it was **extracted to `components/marketing-ops/ProspectChannelTargets.tsx`** (`buildChannelTargets(campaign)` pure helper + the component) and is now rendered by **both**: the modal passes `onSelect` (a row selects that channel for the log entry) and `activeChannel`; the tab omits both, so its rows are plain reference. `OutreachIntelligenceTab` gained an optional `campaign` prop (the parent `CampaignDetailClient` already had it) and renders the block above the salutation preview — showing the campaign's business-published contact set, never the personal phone numbers the tab's guardrail forbids. **Extracting rather than copying is the point: the two surfaces cannot drift.** Tests: `ProspectChannelTargets.test.ts` (row contract + order, `onSelect` gating, empty → `''`); the modal's original channel-target tests still pass **unchanged**, which is what pins the extraction as markup-preserving.

**Delivery-mode recommendation from the team signal (added 2026-10-15):** the dfy/diy fork (profile-repair `repair_fulfillment.mode` — which A8 rides — and PB-08's `playbook_decision.delivery_mode`) is a *capacity* question: does the prospect have anyone to execute with? That is exactly what the worksheet's `team_signal` records, settled during the walk-in/call. New pure lib `lib/delivery-mode.ts` (`recommendDeliveryMode(teamSignal)`): `sole_owner` → **DFY, `strong`**; `family_team` / `small_staff` → **DIY, `lean`** (both lanes genuinely viable — the reason says "DFY stays available" so the operator doesn't read it as a verdict); `unknown` / absent / unrecognised → `null` (ask, don't guess). Surfaced on `GET /:id/repair-execution` as `recommended_mode` (best-effort dynamic import of `OutreachIntelligenceService.getForCampaign`; a missing worksheet simply yields no suggestion). `RepairExecutionCard` seeds `cfgMode` from it **only when no mode is saved** — a saved mode always wins — and shows a one-line "Suggested: …" hint while unset. **Advisory only: it never writes a mode.**

**Project-phase predicate seed v2 — the PB-09 family placed (added 2026-10-15):** the pre-existing `lib/__tests__/project-phase-predicates.test.ts` failure was the §3.3 coverage invariant firing on seven codes migrations 334/336 registered that v1 never placed — the tripwire working as designed ("Any future admin-registered signal code is unmapped until added to the predicate seed with a version bump"). **Correction to the first note here:** it read "most likely they go in `PHASE_PREDICATE_UNMAPPED_SIGNALS`" — wrong. `DS_MISSING_PROFILE`, the same PB-09 family, has been on **findability** since v1, so presence codes belong to phases. v2 adds: `DS_DUPLICATE_LISTING` → **foundation** (one business under two listings at one address is identity/NAP consistency, the phase's own subject); `DS_HIJACKED_LISTING` + `DS_OWNERSHIP_DISPUTE` + `DS_ADDRESS_VERIFICATION_BLOCK` → **claim** (all three are "who controls, or can prove they control, the profile"); `DS_ZERO_INDEXED_PRESENCE` + `DS_PROFILE_NOT_PUBLIC` + `DS_PROFILE_SUSPENDED` → **findability** (the same discovery loss `DS_MISSING_PROFILE` already carries). Mechanics: `PROJECT_PHASE_PREDICATES_V2` derived from v1 through a `V2_ADDITIONS` map (DRY, drift-proof), a new `PROJECT_PHASE_PREDICATES_CURRENT` alias for the unseeded fallback, `VERSION` → 2, marker → `project-phase-predicates-v2-presence-integrity`. Consumers moved to `_CURRENT` (`project-phases.ts` selector default, `project-phase-resolution.loadPredicates`, the seed script); `_V1` stays exported because a plan's `predicateSeedVersion` is reproducible provenance and the DB keeps the v1 rows. Spec §5 table + a v2 note updated **first**, per the file's own "edit the spec, then bump the version". Seeded local+prd (5 v2 rows). **Behavior change:** affected prospects gain phases on their project plan.

**Presence plan consumes the settled delivery lane (added 2026-10-15):** `FULFILL_011` presented the DFY/DIY fork but never read the decision — the chosen lane lived in `repair_fulfillment.mode` and the deliverable didn't know it, so it could say "here are your two options" while the lane was already settled. `DeliverableSourceService.resolveDeliverableContent` now supplies `delivery_mode` (new `resolveDeliveryMode(campaign)` helper → `repair_fulfillment.mode` uppercased, `''` when unset) and item 7 tells the analyst to lead with the settled lane — or present both evenly when blank. Marker `DELIVERABLE_SOURCE_MATERIAL_SEED_V13` → **V14**, seeded local+prd.

**Review-lane delivery mode (PB-02 / A1) — DIY defined and wired (added 2026-10-15):** the dfy/diy vocabulary is shared across lanes but the *division of labour* is lane-specific, so each lane names its own split. For the review lane: **DIY = the platform obtained the reviews and drafted the responses (analyst-assisted); the OWNER posts them. DFY = the platform posts them on the owner's behalf, on delegated access.** Encoded as `REVIEW_DELIVERY_LANES` + `reviewDeliveryBrief(mode)` in `lib/delivery-mode.ts` (returns `''` when unsettled, so an unsettled lane renders no instruction at all). Recorded in `playbook_decision` — the playbook-agnostic decision column (migration 309) — namespaced `kind='review_delivery_mode'` exactly as PB-08 namespaces `kind='website_build_scope'`: `MarketingCampaignService.setReviewDeliveryMode` + `PATCH /:id/review-delivery-mode` (reuses the website-gap `deliveryModeSchema` — same two-value enum) + web `setReviewDeliveryMode`. Consumed by `ReviewSlotService`: a new `resolveReviewDeliveryMode(campaignId)` reads the decision and `slotResponseVariables` supplies `delivery_mode` — the read is **hoisted once** per `generateAllResponses` run and resolved per-slot on the two single-slot paths, and it is best-effort (a read failure yields no instruction, never a failed draft). `DELIVERABLE_REVIEW_RESPONSE_PROMPT` gains a "Delivery lane (who posts this response)" block, with the blank case stated explicitly. Construction marker `DELIVERABLE_CONSTRUCTION_SEED_V2` → **V3**, seeded local+prd. **Web type note:** `Campaign.playbook_decision` widened to `WebsiteGapDecision | ReviewDeliveryDecision` — a PB-08 panel must now narrow on `kind` (`WebsiteGapBriefingPanel` does), which is the honest reading of a playbook-agnostic column. **Not built:** there is no review-lane UI control yet; the mode is settable via the API.

**Lane delivery UI + the recovery lane (added 2026-10-15):** two follow-ons, both landing on the same `playbook_decision` column.
- **UI — `LaneDeliveryModePanel`** (`components/marketing-ops/`, mounted in `CampaignDetailClient` right after `RepairExecutionCard`). One panel serves **both** lanes: `campaign.pipeline` (`'review' | 'recovery'`) picks the `kind`, so the review and recovery forks share a surface instead of two near-identical ones. The website lane keeps its own home (`WebsiteBuildExecutionCard`, scope-gated by `BUILD_SCOPE_MODES`). Self-gates on business scope + a review/recovery pipeline, and is **fully prop-driven** (no fetch, no effect) so it renders statically in tests. `LANE_COPY[kind]` is typed as a **literal** union (`LaneKind`) — a bare `string` breaks the `playbook_decision` union narrowing and `delivery_mode` widens to `… | undefined`.
- **Recovery lane (PB-04 / A2)** — the same shape one step further along the same road: the platform produces the written case either way, and the fork is who **files** it. `RECOVERY_DELIVERY_LANES` + `recoveryDeliveryBrief` in `lib/delivery-mode.ts`; `MarketingCampaignService.setRecoveryDeliveryMode` + `PATCH /:id/recovery-delivery-mode` + web `setRecoveryDeliveryMode`; `RecoveryDeliveryDecision` added to the web `playbook_decision` union.
- **`writeDeliveryDecision` is shared** — `setReviewDeliveryMode` and `setRecoveryDeliveryMode` are thin wrappers over one private writer (`kind` is the only difference), so the two lanes cannot drift.
- **Two consumption paths, both supplied** — `RecoveryResolutionService` builds `variablesUsed` at **three** sites (enqueue, `renderPromptText`, the external-import path) and all three now carry `delivery_mode`; `MarketingExecutionService`'s recovery auto-source branch supplies it too, because that branch serves every *other* render of the template. Best-effort everywhere — a read failure yields no instruction, never a failed draft.
- **Migration `338_recovery_delivery_lane.sql`** teaches `mpt-recovery-resolution-default` to read `{{delivery_mode}}` (clause inserted before `INPUTS:`) and declares it in `variables`. Applied local+prd. **Lesson worth keeping:** the anchor is the bare `INPUTS:` header, **not** `E'\nINPUTS:\n'` — the first attempt no-opped silently because the stored body's line endings are whatever the seeding client sent (CRLF), and a newline-anchored `replace()` matches nothing while the UPDATE still reports success (the `variables` append landed, the body didn't). Verify the *placeholder position*, not the row count.

**Profile synonyms carry analyst language tags — strip them before they become keywords (fixed 2026-10-15):** the intelligence profile's `synonyms` are **language-annotated** (`"African grocery store [English]"`, `"Habesha store [endonym — Amharic/Tigrinya]"`, `"supermarché [endonym — Francophone West African]"`), and `composeKeywords` pushed them **verbatim** — so the analyst's annotation shipped into `directory_listings_list.keywords` on the Arsema seed (7 of 15 terms read `"african grocery store [english]"`). New `stripLanguageTag(term)` in `SeedSeoComposer` removes only the trailing bracketed annotation; the **term is kept verbatim**, because an endonym like "Habesha store" is genuine diaspora search vocabulary — which is exactly why the profile carries it. Side benefit: the previously wasted slots now carry distinct real terms (`african grocery`, `african market`, `african provisions`, …), so the 15-cap yields 15 usable keywords instead of 8 + 7 deduped-to-nothing duplicates. **Diagnostic lesson (cost me several wrong guesses):** I searched the DB with `LIKE '%[english]%'` — Postgres `LIKE` is **case-sensitive**, the data is `[English]`, and the search returned zero across every table. Use `ILIKE` (or lowercase both sides) when hunting for a string whose casing you don't control. The source was only found by instrumenting `composeKeywords` to log each input bucket and running the composer against live prd data via `getComposedEnrichment` — the same path the reset endpoint uses. **Reproduce-with-live-data beats reading source** when the value is assembled from many optional inputs.

**Note — the packet's `secondaryCategories` are computed but NOT written.** `composeSecondaryCategories` derives shelf labels from the campaign + profile subcategories, but the composer write set is `description`/`keywords`/`same_as` only. So the long persona phrases it produces (e.g. `"somali / east african halal market with a remittance counter"`) never reach `directory_listings_list.secondary_categories`, which keeps the campaign's clean labels (`{Ethiopian Grocery Store, International Grocery Store}`). Latent, not live — but if anything ever starts writing that packet field, those phrases land as `/place` chips.

**`data_quality` on `profile_repair_audit` — the archetype briefings can state their own limits (added 2026-10-15):** `website_positioning` has carried a `data_quality` block (`{verified_fields, unavailable_fields, limitations}`) since its sprint, which is why the website audit is the one briefing that qualifies its own figures (*"content verified from the served catalog payload, not a browser render"*). `profile_repair_audit` — the shared shape for **every** archetype briefing (A1–A8) — had no such slot, so A8 and A3 asserted third-party **mirror** data as settled fact: both opened on *"18 of your 21 five-star reviews"* while the live profiles read 22 and 8, and A3 additionally cited "roughly 9 photos" against a `photo_count` that is `null` in the audit. **The gap was structural, not analyst quality** — the same analyst was careful in the website lane precisely because the schema made it be. Added: `data_quality` on `profileRepairAuditSchema` (declared explicitly — `.passthrough()` persists unknown keys into raw `audit_data` but gives typed consumers no validation and no guaranteed access), the key in `PROFILE_REPAIR_AUDIT_PROMPT_SUFFIX`'s contract, and a shared `dataQualitySection()` in `seed-archetype-briefing-templates.ts` injected through the single `bodyFor()` builder so all six templates get it in one place. The load-bearing rule: **name your source for any figure you put in the pitch** — a count read from a mirror/aggregator must be listed in `limitations` as mirror-sourced and unverified, and a pitch line built on it must not be stated to the owner as settled fact. The section also carries the `unable_to_verify` discipline (a platform blocked on BOTH business and control is never `absent`) and the client-hydration caveat. Re-seeded local+prd (6 updated each — the script upserts by id, no version marker). Tests: `validators/__tests__/profile-repair-audit-data-quality.test.ts` (optional-block back-compat, block retention, suffix contract).

**Opener ↔ audit alignment — `platforms_with_listings` + `DS_MISSING_PROFILE` severity (added 2026-10-15):** the playbook briefings read the audit's **structured** fields (`data_status`, `render_controls`, `alternate_profiles`); the opener extractors read **key presence**. Two consequences surfaced on the Arsema A5 opener.
- **`platformLabels` was keyed on platform-block presence** (`outreach-openers/field-extractors.ts`). The audit always emits all four blocks (schema-required), so `Object.keys(auditData.platforms)` is effectively constant — and `PLATFORM_LABELS` has no `bbb` entry, so BBB was the only block the old filter ever dropped. Every business therefore got `["Google","Yelp","Facebook"]`, and the A3/A5 openers told an owner they "show up differently across Yelp, Google and Facebook" when **no Yelp listing existed** (the operator sweep found none, and the category norm is 0 of 55 observed businesses). Now keyed on `data_status` ∈ {`complete`, `partial`}; `unavailable` (verified absent) and `restricted` (exists but not publicly visible — nothing to compare against a customer's view) are excluded, with a **key-presence fallback** when no block carries a positive status, so an all-unknown payload (older audits, or a model that left `data_status` unset) keeps the legacy list rather than rendering empty. **Shared by A3 and A5** — same helper, same bug.
- **`DS_MISSING_PROFILE` was a blanket `crisis`** (`outreach-openers/signal-magnitude.ts` `DEFAULT_SEVERITY`, comment: "invisibility is a crisis"). Platform-blind: a missing **Yelp** page ranked the same as a missing **Google** page, so on Arsema it outranked `DS_DUPLICATE_LISTING` (material) and the prompt was instructed to lead with the *weakest* finding — a category-normal absence — over a duplicated identity splitting 30 reviews across two listings. `computeSignalSeverity` now derives it from **which** platforms are `unavailable`: Google absent (or nothing identifiable) → `crisis`; otherwise → `material`. New `absentPlatformKeys` helper (restricted excluded — a different finding with a different fix).
- **The A8 archetype-primary severity carried the same blanket assumption, and is now aligned too** (`computePrimarySignalSeverity`'s A8 case). It returned `crisis` when `DS_MISSING_PROFILE` was detected, and again when **any** `render_controls` entry was `business_specific_failure` — which on Arsema fires for yelp/bbb/apple_maps/bing, so an A8 opener would still have led on a category-normal absence. Now: `DS_ZERO_INDEXED_PRESENCE` and `DS_PROFILE_SUSPENDED` stay crisis on sight (genuine invisibility); `DS_MISSING_PROFILE` is crisis **only when Google is the absent platform**; render-control-confirmed absence is crisis **only for `platform === 'google'`** (the non-primary platforms record `business_specific_failure` there too and must not drive the archetype's severity); and "no platform present and none restricted" still returns crisis. On Arsema the A8 primary now resolves to `material` via the `DS_DUPLICATE_LISTING` branch.
Tests: `outreach-openers/__tests__/opener-signal-alignment.test.ts`.

**Full archetype sweep — every opener input now reads the audit's evidence (same day).** After the three fixes above, all eight archetypes were audited for the same class of defect (a *presence* read standing in for a *value*, or a static severity standing in for magnitude). Four more found and fixed, plus a label bug:
- **A8 `extractA8Fields` presence map was inverted.** The bucket loop's `else` put every non-unclaimed `profile_status` — including `unable_to_verify` — into `present`, and the delete that follows (`for (const name of [...present, ...unclaimed]) confirmedAbsent.delete(name)`) then erased render-control-confirmed absences. A business verified missing from Yelp and BBB read as being **on** Yelp and BBB, inverting A8's entire thesis. Now: `data_status === 'unavailable'` is skipped (absence comes from `render_controls`), `restricted` is tracked separately, and `present` requires `claimed` / `likely_claimed` — `unable_to_verify` attributes nothing, because it is the absence of a finding.
- **`RA_UNADDRESSED_POSITIVE_BACKLOG` had no magnitude-aware case**, unlike its negative sibling — so 30 unanswered five-star reviews resolved to `borderline`, and `formatSignalContextForPrompt` filters to `severity >= primarySeverity`, which **dropped the review signal from the prompt's signal list entirely**. Now scales: 30+ → `crisis`, 5+ → `material`, else `borderline` (thresholds mirror A1's review-response case).
- **A2's primary severity read `negative_review_themes[0].supporting_review_count`** — a field the audit directive explicitly tells the model to leave null (*"Do NOT estimate supporting_review_count"*) — so every A2 campaign was pinned at `material` regardless of exposure. Now reads the observed negative backlog (10+ → crisis, 3+ → material) plus `RA_BBB_GRADE_SUPPRESSION` → crisis. The two existing `signal-magnitude` A2 tests encoded the old contract and were updated.
- **A6's primary severity read `!!website.url || status === 'working'`** — treating a *present-but-broken* URL as a healthy website, so a dead site scored the same as a live one with no catalog. Now: no URL → crisis; explicitly `broken` / `none_found` / `social_media_only` → crisis; otherwise material.
- **`label()` title-cased raw platform keys**, rendering `bbb` as **"Bbb"** and `apple_maps` as **"Apple_maps"** straight into the prompt, where the writer could echo them to the owner. Replaced with an explicit `PLATFORM_DISPLAY` map (google → "Google Business Profile", bbb → "BBB", apple_maps → "Apple Maps") and a snake_case→Title Case fallback.

**The pattern to watch** (this class bit five times): an extractor that keys on a field's **presence** rather than its **value**. It hides wherever the schema makes a block mandatory or the skeleton is fully populated — `platforms` was the worst case because all four blocks are required, so a key-presence read was effectively a constant. When adding an extractor input, ask what the *absence* of the field means before treating its presence as evidence.

## Platform presence — the shared delegate (`lib/platform-presence.ts`, added 2026-10-15)

Platform presence was derived **independently in four places**, and they disagreed about the same audit — every disagreement shipped as a defect. This module is now the single source.

| Was | Consumer |
|---|---|
| `PRESENT_STATUSES` + local `platformLabel` | `ProspectReportService` — the archetype fact slice + every owner-report chapter |
| `platformLabels` (keyed on block presence) | `outreach-openers/field-extractors` — the A3/A5 drift clause |
| a bucket loop putting `unable_to_verify` into `present` | `extractA8Fields` — A8's presence map |
| `absentPlatformKeys` (`data_status === 'unavailable'`) | `outreach-openers/signal-magnitude` — severity |
| a local `label()` title-casing keys | the owner-facing platform names |

**What it exports:** `platformPresence(auditData)` → `{ presentKeys, claimedKeys, unclaimedKeys, missingKeys, restrictedKeys, evidencedKeys }`; `platformLabel` / `platformLabels` (formal — "Google Business Profile"); `platformShortLabel` / `platformShortLabels` (conversational — "Google"); `PRESENT_STATUSES`.

**Semantics worth keeping:** presence requires a **claim verdict** — `unable_to_verify` attributes nothing, because it is the *absence of a finding*, and treating it as presence is what put Yelp and BBB on a presence map for a business verified missing from both. `missingKeys` = `data_status: 'unavailable'` ∪ `render_controls` `business_specific_failure`, minus anything verified present or restricted (so a non-primary platform like `apple_maps`/`bing` — which carries a control attempt but no platform block — is correctly absent). `restricted` is tracked separately: the profile exists but the public cannot see it, a different finding with a different fix.

**Two registers, not one.** The consolidation surfaced that the label is not one thing: a report or a field list reads "Google Business Profile", but the opener's drift clause ("shows up differently across …") wants "Google". Carrying one label for both is what let the layers diverge. **Use the short register inside prose, the formal one in field lists and PDFs.**

**It is a LEAF module** — it imports nothing from the service layer, so `ProspectReportService` and the outreach layer both depend on it without a cycle. (Contrast `archetypeFactSlice`, which `AGENTS.md` describes as the only dynamic-import back-edge *into* the report service.) Consumers layer their own signal-driven heuristics on top at their own seam — A8 adds key platforms with no `profile_status` when a `DS_MISSING_PROFILE` signal fired.

**The contract guard is the part that prevents recurrence:** `outreach-openers/__tests__/opener-signal-alignment.test.ts` asserts every consumer's presence map and severity **equals the delegate's** for the same audit. Teaching a consumer its own presence rule now fails a test instead of shipping. Layer A's equivalent is the REPORT CONSISTENCY directive, which makes briefing-vs-report disagreement a prompt violation.

**Phase 2 — the shared audit core (`lib/archetype-facts.ts`, same day).** Phase 1 single-sourced presence; Phase 2 adds the other half of the shared core — **normalized review counts** — and exposes both under one archetype-scoped call, `archetypeFacts(archetype, auditData)` → `{ archetype, presence, counts, platformStatuses }`.

The two archetype-scoped extractions are genuinely different *audiences* and legitimately carry different keys — `ProspectReportService.archetypeFactSlice` produces owner-safe report facts, `outreach-openers/field-extractors` produces pitch inputs. What they must never disagree about is the **shared core**, and that is what moved:

- `ProspectReportService.archetypeFactSlice` is now a thin wrapper over a private `archetypeFactSliceBase`, spreading `sharedCoreKeys(archetypeFacts(...))` into **every** archetype's slice. The briefing's `{{archetype_extract}}` therefore carries the same `platform_presence`, `platform_statuses` and `review_counts` the opener reads.
- The A1/A2/A5 openers read counts from `archetypeFacts(...).counts` instead of poking `combined_review_metrics` field by field.
- **The cross-layer contract test is the deliverable**: `opener-signal-alignment.test.ts` asserts, for **all eight archetypes**, that the briefing slice's shared core equals the delegate's, and that the opener's counts and presence map equal the briefing's. Disagreement is now a test failure.

**A latent type lie this surfaced:** `A1Fields.unanswered_total` / `unanswered_negatives` / `unanswered_rate_percent`, `A2Fields.unanswered_negatives` and `A5Fields.unaddressed_review_count` were declared `number` while the audit schema declares `combined_review_metrics.observable_*` as **`coercedNumberNullable`**. They are now `number | null`. **Do not coerce a null count to 0** — null means the analyst could not observe it, and the prompt branches (`if unaddressed_review_count > 0`) already suppress the claim on null, which is the safe direction.

**Phase 3 — the archetype contract (`outreach-openers/archetype-contract.ts`, same day).** The archetype's **forbidden vocabulary** lived in its prompt template while its **severity and co-occurring-signal instruction** were computed in two other files. Nothing enforced agreement, so they contradicted each other: **the A8 prompt forbids `"reviews," "responses," "replies," "website,"` while `buildCoOccurringSignalInstruction` instructed the writer to LEAD with the review backlog.** The instruction was unsatisfiable — obey it and break the forbidden list, or obey the list and ignore the instruction. Raising `RA_UNADDRESSED_POSITIVE_BACKLOG` to `crisis` in the sweep is what made it fire.

`archetype-contract.ts` encodes the lane's **scope** next to its severity: `signalSubject(code)` maps a signal to the vocabulary domain it forces (`RA_*`→review, `CP_NAP_*`/`DS_OUTDATED_HOURS`→drift, `WC_*`→website, the `DS_` presence codes→presence, the integrity codes→integrity), and `FORBIDDEN_SUBJECTS` records which subjects each archetype's prompt bans. **Only A7 (`review`) and A8 (`review`, `website`) ban a subject** — the other six ban copy patterns (no pricing, one number per hook), which are about *how* the opener is written, not *what* it may be about, and are deliberately not encoded. `signalSubject` returns `null` for an unrecognised code so the guard never guesses a subject and silently suppresses a legitimate lead.

`buildCoOccurringSignalInstruction(fields, archetype)` now branches: when the strongest signal's subject is outside the lane's scope it emits **a scoped acknowledgement** (*"A STRONGER SIGNAL EXISTS OUTSIDE THIS OPENER'S SCOPE … must NOT lead with it and must NOT name it here"*) instead of a lead. **The instruction is now always satisfiable.**

**The anti-drift guard is the load-bearing test:** `archetype-contract.test.ts` parses each prompt's own `Forbidden:` paragraph and asserts the table matches it — adding a quoted subject to a prompt's forbidden list without updating `FORBIDDEN_SUBJECTS` fails a test. (It earned its keep immediately: the first run failed, and the bug was in the *test's* regex — the prompts quote list items with the comma inside the quotes, `"reviews,"`, so the class must be `/"reviews[",]/`.) Verified on the real campaign: the A5 render (the archetype that owns the combination) keeps the lead instruction, and the same fields forced through A8 produce the scoped notice instead.

**All three phases are now complete.** The delegate proposal is closed: `lib/platform-presence` (presence + labels) → `lib/archetype-facts` (shared core + cross-layer contract test) → `archetype-contract` (scope co-located with severity). The pattern across all three: **a fact that two consumers must agree on belongs in one module, and the agreement belongs in a test.**

## Sibling lanes — two defects found on a live 4-campaign prospect (2026-10-15)

Operating a real prospect (primary + A8 + A3 + PB-08 siblings) surfaced two more instances of the same class, both at the *lane* level rather than the field level.

**1. The triage recommended a playbook the accept guard refuses.** `evaluateTriage` ranks by signals only, while the sibling-uniqueness guard (`BusinessProspectService` line ~191, migration 184) refuses a second campaign on the same `playbook_code` over `business_prospect_id` + `scope: 'business'`. So **every sibling's card recommended the prospect's rank-winner (PB-05) — which the primary owns** — and `Accept Recommendation` was a guaranteed 409. The Override dropdown offered taken playbooks, and the alternatives panel offered "Create Sibling" for a playbook that already had one: **three affordances, all consulting the ranking, none consulting the invariant.**

Fix: `filterAvailablePlaybooks(playbooks, usedElsewhere)` — a pure exported helper in `CampaignTriageService`, called from `loadSignalsAndPlaybooks` with `playbookCodesUsedElsewhere(prospectId, campaignId)`. The used set is computed from the OTHER campaigns, so **self-exclusion is implicit and the primary is unaffected** (no sibling can hold the primary's playbook). Degenerate case — every match taken — returns the unfiltered list so the card still renders a verdict. Tests: `triage/__tests__/sibling-playbook-availability.test.ts`.

**2. `resolveCampaignArchetype`'s inline copy in `resolveOpener` had drifted twice.** The shared resolver and the opener's inline block were two implementations of the same precedence:
- the inline copy read `triage.recommendedPlaybook` and **ignored `overriddenPlaybook`** — so an *overridden* sibling generated the *recommended* playbook's archetype, not the lane the operator chose;
- it had **no declared-lane step**, so between a sibling's re-evaluate and its re-accept it fell to `selectArchetype` — which knows nothing about lanes — and resolved as a **different lane** (an A7 website sibling became an A8 presence opener).

Two more facts pinned here:
- **`mkt_campaigns_list.archetype` is NOT the lane declaration** — it is not stamped by `acceptTriage`, and it was `null` on the live sibling. The durable declaration is **`playbook_code`**, resolved to an archetype via `MarketingPlaybookCatalogService.getPlaybookByCode`. (The siblings-list `archetype` field is *derived*, not the column.)
- **Re-evaluating a sibling's triage clears `overridden_playbook_id` as well as `is_operator_accepted`.** For a primary that is fine; for a sibling the override IS the lane, so a re-evaluate erases it — which is why the sibling rendered without an archetype badge, why the primary offered "Create Sibling" for a playbook that existed, and why the opener fell back. `resolveCampaignArchetype` now has step 2 = the campaign's declared playbook, before the audit-derived selector. `resolveOpener` calls the shared resolver instead of re-implementing it (keeping the A2 theme special-case). `ResolvedArchetype.source` gained `'campaign'`; `HookSuggestionResult.archetypeSource` widened to match.

Verified live: primary → A5 (`triage`), A7 sibling → **A7 (`campaign`, playbook PB-08)** — previously A8 — and A3 sibling → A3 (`triage`).

**The through-line, now five times:** a fact two consumers must agree on lives in **two places**, one writer changes it, and nothing reconciles them. Presence, review counts, archetype scope, lane availability, and the lane declaration itself. The remedy is always the same — one module, plus a test that fails on disagreement.

**3. The rationale filed the winning signal under "other".** `buildReasoning` (`TriageEngineService.ts`) buckets detected signals into families — `repair` / `review` / `crisis` / `visual` — and files everything else under **"other signals"**. **The website family (`WC_*`) is in none of those buckets**, so PB-08 — whose entire `any` clause is `WC_*` — rendered a rationale naming the duplicate and NAP-drift signals (which did not contribute) while filing `WC_BUILDER_SUBDOMAIN`, the signal that actually won the match, under "other". The card read as if listing drift had driven a website recommendation, and the payload's own `contributedToRule: true` sat right beside the contradiction.

Fix: a `matched on: <codes>` part derived from the winning rule's clauses (`matchedSignals(rules, signals)` — `any` hits, `all` set, both dual groups), added to the `mentioned` set so a matched signal is never also listed as unmatched. Verified read-only against the real catalog and the live signal set: the full catalog yields PB-05 with `WC_BUILDER_SUBDOMAIN` correctly in "other" (it does not contribute to PB-05's dual rule), and the sibling's filtered pool yields **PB-08 `matched on: WC_BUILDER_SUBDOMAIN`** with only `DS_OUTDATED_HOURS` remaining unmatched. Tests: `triage/__tests__/triage-reasoning-attribution.test.ts`.

**Alternate-profile detection (added 2026-10-15):** two pieces. **(1) `alternate_profiles[]`** on the business_analysis platform schema (`business-analysis.schema.ts`, base `platformSchema` so any platform can carry it) — `{name, url, category, rating, review_count, first_seen, plus_code}`. The audit body now instructs the model to record each alternate listing when it emits `DS_DUPLICATE_LISTING`. `name_variations` (bare strings) and `same_as` (bare URLs) cannot carry review count / rating / age — exactly what the A8 pitch and the keyword surface plan need. Emitted into the A8 `archetypeFactSlice` (`ProspectReportService`) as `alternate_profiles`. **(2) `MarketingGbpEnhancerService.sweepAlternateListings(campaignId)`** — the address-keyed Places sweep. `lookupBusiness` is name-keyed (`"<name>, <city>"` → `places[0]`) so a differently-named duplicate is invisible to it by construction; the sweep queries by **address** with a wider field mask (`PLACES_SWEEP_FIELDS`) and keeps every result sharing the target's street key or phone under a different name. Pure matchers exported for tests: `normalizePhone` (last 10 digits), `normalizeName` (punctuation → space, so a hyphen is a word break), `streetKey` (leading number+street+type, so `"6667 W Washington St, Unit A"` ≡ `"6667 W Washington St, Indianapolis, IN 46241, USA"`), `isSameListingName` (≥80% token overlap — `"Arsema G Food Mart LLC"` ≡ `"Arsema Food Mart"`, but ≠ `"Ethiopian Eritrean Store"`). Opt-in + billable — not auto-called and not cached; soft-fails to `[]`.

## Audit Channel Scan + Engagement Brief (two-pass audit, added 2026-10-13)

Spec: `docs/AUDIT_CHANNEL_SCAN_AND_OPPORTUNITY_COLLECTION_SPEC.md`. The business audit split into evidence collection (Pass 1) and judgment (Pass 2).

**Pass 1 (shipped):** the canonical `business-audit-default-body.md` (marker `business-audit-default-2026-10-13-opportunity-sentiment-1`) emits `channels_scanned[]` (per-surface evidence ledger — every channel attempted, `not_attempted` entries record the sweep boundary) and `observed_assets[]` (deduplicated strengths roll-up with `also_seen_on` corroboration + internal-only `underexposed`/`confidence`). Product-visibility fields stay under `website.*` for schema stability but are evidenced by ANY verified public surface: `true` = observed anywhere, `false` = explicit rendered negative ONLY ("pickup only", "no shipping"), `unable_to_verify`/null = unaddressed. `{field}_observed_on` companions carry provenance; `apps/api/src/lib/channel-surfaces.ts` (`surfaceNoun`/`surfaceRef`) lets owner-facing copy name the real surface instead of "your site". In `signal-extractor.ts`, `WC_MISSING_PICKUP_DELIVERY` is exempt from `frictionSuppressed` (spec §A2) — `false` carries its own verification, so social/builder footprints are evaluated; null still fires nothing. Ledger division: channel surfaces → `channels_scanned`; non-channel sources → `specialized_sources_audited`; `sources` = flat URL log; primary-platform entries must agree with `render_controls`.

**Opportunity Sentiment (spec §F):** reviews are a context source, not an audience metric. The audit now also emits `positive_review_themes[]` (the positive half of review *content* — previously only counts existed; the negative side had the only theme collection) and `sentiment_context[]` — observations classed `logistics|demand|gaps|infrastructure`, each citing a platform so it stays evidence rather than impression. Directive: do **not** enumerate or summarize every review — extract the opportunity-bearing signal. Promotion rule: a positive theme establishing a strength is ALSO promoted into `observed_assets` (`observed_on: "reviews"`); a defect stays in `negative_review_themes`/`gap_analysis`; `sentiment_context` carries the residue that is neither but still shapes how the business should be approached. `supporting_review_count` is never estimated; an absent positive theme records "not verified" and never reads as poor sentiment. Neither field renders in `public_narrative` as deficiency language, and neither influences the footprint side (surface-only — see above).

**Pass 2 — Engagement Brief:** template `mpt-seed-brief-001` (canonical body `src/scripts/engagement-brief-default-body.md`, marker `engagement-brief-default-2026-10-13-v1`, seeder `seed-engagement-brief-template.ts`, `output_schema: engagement_brief`). The brief persists as an `mkt_audits_list` row with `platform='engagement_brief'` (spec OQ3 storage decision: audit row, no dedicated table) — `audit_data` carries the ranked spine (`pains`/`assets`/`capability_fits`/`verification_gates`/`engagement_shape`) with `evidence_index` refs back into the source audit; every item carries a `visibility` tag (`internal|client_safe|public_safe`). `resolvePrompt` auto-sources `{{source_audit}}`/`{{source_audit_id}}`/`{{footprint_side}}` on the business-scope path; `importExternalResult` post-validates then stamps `source_audit_id`, `brief_version`, and `side` authoritatively — the model never sets them. Internal Execute works too: `applyEnrichmentFromOutput` persists the `engagement_brief` row + stamp for internal runs (the audit itself is external-only — its schema is absent from that lane because an internal chat run cannot render channels). Precondition: `executePrompt` refuses an `engagement_brief` run when the campaign has no non-stub `business_analysis` audit (`assertEngagementBriefSourceAudit`) — the audit is render-bound so the fallback is "run the audit first," never an internal fabricated audit or an empty spine. Trust boundary (Finding-2 close, 2026-10-13): a model- or operator-emitted `source_audit_id` is NEVER trusted — when the campaign's latest `business_analysis` lookup resolves nothing the field stamps `null` (a claimed id could only cite another campaign's audit or a non-`business_analysis` row; dropped with a warn), and when an audit does resolve the campaign row wins over any echoed id.

**The side (`emerging|competitive`):** `services/engagement-brief/footprint-side.ts` — pure `classifyFootprintSide(auditData, asOf?)` shaped like `selectArchetype`. Scores **surface** density from evidence (owned site +4, rendered channels +2 cap 6, recent `last_activity` +1 cap 3, `notable_activity` +1 cap 2, claimed platforms +1 cap 2, rated platforms +1 cap 2); `COMPETITIVE_DENSITY_THRESHOLD=10`, unclassifiable → `emerging`. Reads activity not just channel count. **Surface = owned OR claimed** (F4, confirmed 2026-10-13): a `claimed`/`likely_claimed` primary profile is a controlled surface — rendered primaries (+6 cap) + claimed (+2) + rated (+2) can hit the threshold with zero owned site; flipping that semantic means revisiting the claimed cap. Persisted `density_breakdown` records per-component `{observed, awarded, cap}` so the score is reproducible from the stored brief (F3 — `inputs_used` stays the uncapped observed ledger). **Audience is not a routing input** (decided 2026-10-13): review volume/followers/traffic are deliberately excluded — the platform's priorities are surface/presence, so a business with ~600 reviews and no owned site routes to `emerging` (it needs presence built, not optimization), and "high audience, low surface" is a prime prospect shape rather than a competitive signal. Audience data stays available to Pass 2 via the source audit the brief embeds. Never public — it is a routing input only. Bump `FOOTPRINT_SIDE_CLASSIFIER_VERSION` when weights/threshold change (now v2) — it's persisted on every brief so the boundary stays auditable. OQ8 decided 2026-10-13 via `src/scripts/footprint-side-distribution.ts` (doppler `npx tsx` — histogram of `density_score` over stored `business_analysis` audits): all stored audits score ≤8 because pre-Pass-2 audits lack `channels_scanned` inputs, so nothing has crossed 10 — `competitive` is reachable only on rendered-channel evidence, which is intended. Re-run once channel-scan audits accumulate.

**Fulfillment columns + seed assets (OQ1/OQ5, shipped 2026-10-13, migration `337_listing_fulfillment_and_seed_assets.sql`):** `directory_listings_list` gained `delivery_offered`/`pickup_offered` (tri-state — NULL = unobserved, false = explicit rendered negative, true = observed/owner-confirmed; public filters only match `= true`) plus `fulfillment_as_of`/`fulfillment_source`/`fulfillment_source_name` (`audit_channel_scan` | `owner_confirmed` | `ops_review`). `services/directory/fulfillmentFacts.ts` is the single extraction contract: `extractFulfillmentFromAuditData` reads the audit's `website.has_delivery_option`/`has_pickup_ordering` any-verified-surface rollup + `*_observed_on` companions (returns null when the audit addressed neither — a "didn't look" audit never erases prior evidence; the sync writes per-field via COALESCE); `extractSeedObservedAssets` gates `observed_assets` to `confidence === 'verified_on_surface'` (cap 20) into `directory_presence_seeds.observed_assets` — internal operator metadata, shown on the seed detail page, NEVER public (not `attributes[]` chips — those need owner-facing copy an `underexposure_note` doesn't carry). Two write paths: `createFromCampaign` at seed birth and `DirectoryPresenceSeedService.syncFulfillmentForCampaign` — a best-effort `importExternalResult` hook beside the resharpen call, covering seeds that predate the audit; `fulfillment_source='owner_confirmed'` outranks audit writes, operator edits default to `ops_review`. Public surface: `delivery=true`/`pickup=true` params on `/places/search`, `deliveryOffered`/`pickupOffered` on the search/category/city payloads + `/place` card chips.

**Deferred:** judgment migration (OQ7 — `market_opportunities`/`outreach_problems`/`primary_outreach_hook`/tier fields still emit in Pass 1); projections reading the spine (Non-Goal — consumers still read `audit_data` directly).

## Web API envelope — unwrap twice (added 2026-10-15)

A payload from the platform API is wrapped twice on its way to a component: handlers return `{ success, data: <payload> }` (`BaseController.handleSuccess`), and `RequestExecutionUtility` returns the *parsed body* as `ApiResult.data`. So a caller holding an `ApiResult` must unwrap two hops to reach the payload — `result.data` is the body, and the payload is `body.data`. `apps/web/src/lib/api-envelope.ts` `unwrapApiBody()` does both hops and passes through payloads that aren't wrapped (`{ success, subdomains, total }`), so it is safe for either shape. `TenantInfoService.getTenantInfo` already inlined this correctly (`responseData?.data || responseData`); `getTenantSubdomain` did not, and the tenant subdomain settings page read `result?.data?.subdomain` — landing on the envelope, which left the "Current Subdomain" banner blank and never seeded the slug picker with the live value (the picker then auto-selected the first available pattern). Symptom pattern to recognise: a page that shows a saved value everywhere except its own "current value" display.

**Subdomain settings page data sources** — two independent surfaces, deliberately non-exclusive: the platform subdomain (`tenants.subdomain`, mirrored to `tenants.slug`) and any active custom domain both resolve to the same tenant-host delegate; one does not replace the other. `GET /api/tenants/:id` (the inline handler in `routes/inline-tenant.ts` → `tenantController.getTenant` → `TenantService.getTenantById`, whose `TENANT_SELECT` must include `subdomain`) drives the current-value banner. `GET /api/tenants/my-subdomains` drives the "Your Existing Subdomains" list and is scoped to the caller's `user_tenants` rows — platform staff (admin/support/viewer) are authorized on every tenant via `checkTenantAccess` but hold **no** membership row, so the list came back empty for a platform admin viewing a tenant that plainly had a subdomain; the handler now falls back to the tenant record when a `tenantId` is requested and the caller has no membership row, gated on `isPlatformUser` so non-members without a platform role still get nothing (fail-closed). Cache keys to invalidate on subdomain writes: `tenant-subdomain-*`, `tenant-info-*`, `tenant-user-subdomains-*` (covered by the `tenant*` wildcard), `slug-patterns*`.

**`updated_at` is trigger-maintained — but the triggers are not in the migrations (added 2026-10-15).** `tenants` and `custom_domains` each carry a `BEFORE UPDATE ... FOR EACH ROW` trigger maintaining `updated_at` (`update_tenants_updated_at` → `update_updated_at_column()`, `custom_domains_updated_at` → `update_custom_domains_updated_at()`). Neither the shared function nor those triggers appear anywhere in `apps/api/prisma/migrations` — they were created outside the migration history, so a freshly provisioned environment will NOT have them and `updated_at` semantics differ there. Two consequences. **(1) Don't reason about these columns from `schema.prisma` alone:** there is no `@updatedAt` annotation, yet the column *is* maintained in production — verify with `select tgname, pg_get_triggerdef(oid) from pg_trigger where tgrelid = 'public.tenants'::regclass and not tgisinternal` before trusting or dismissing it. **(2) `updated_at` answers "last modified", never "when was X assigned":** it moves on unrelated edits (tenant name syncs, `location_status`/`subscription_tier` changes, metadata writes; domain verification checks, certificate refreshes, status changes), so an old adoption can read as recent if anything else touched the row afterwards. For adoption dates use an explicit stamp (`tenants.metadata.subdomainAssignedAt`) or the row's own `created_at` (`custom_domains.created_at` is the attach moment). Note `SeedFunnelAnalyticsService` deliberately treats `tenants.updated_at` as an activity *proxy* (the S1/W3 proxy) — that is a proxy by design, not an event date.

## CORS allows tenant custom domains dynamically (added 2026-10-15)

The storefront serves on three surfaces — platform app, platform subdomain, and tenant-owned custom domain — but the browser always calls the API on the API's own origin (`NEXT_PUBLIC_API_BASE_URL`, e.g. `https://api.visibleshelf.com`). So *every* surface is a cross-origin caller and must be allowed by the API's CORS allowlist. The allowlist was a static regex array of platform hosts only, which silently blocked every client-side fetch from a tenant custom domain while leaving the server-rendered page intact: the storefront looked fine but lost everything client-fetched — the coupon spotlight (`usePublicCouponOptionsCapability`), the hours/status badge (`useStoreStatus`), and the styled-QR state (`getStorefrontQrState`, which falls back to the plain QR). Symptom pattern to recognise: **a tenant custom domain renders the page but its client-fetched widgets are missing, while the same tenant on a platform subdomain is complete.** Confirm with `curl -D - -o /dev/null -H "Origin: https://<tenant-domain>" https://api.visibleshelf.com/api/...` — a platform-subdomain origin returns `access-control-allow-origin`; a custom domain returns none (server-side `curl` without `Origin` proves nothing, which is why the custom-domain smoke test missed it).

A static list is the wrong shape — tenants attach/detach custom domains continuously, so the allowlist must be **read from persistence**. `apps/api/src/middleware/cors-origin.ts` resolves the request `Origin` against the same source of truth the storefront proxy uses — `customDomainService.resolveHostToTenant(host)` (`custom_domains`, `status='active'`, www-stripped via the shared `normalizeHostForResolve`) — so CORS can never allow a host the proxy would fail closed on. It fails closed on lookup errors and never caches a failure; positive *and* negative resolutions are cached per isolate for 60s (`clearCorsOriginCache()` is the test seam, keyed on the logical root so `www.` and apex share one lookup). `bootstrap.ts` hands it to `cors()` as an **options delegate** — note `cors` 2.8.x resolves the origin *synchronously*, so an `origin` **function** is truthy and would reflect *any* origin (never pass one); the async decision is made first and passed as an origin **array**: `[...PLATFORM_CORS_ORIGINS, requestOrigin]` when allowed, the platform patterns alone when denied. Platform hosts stay a code-owned list (D8); only the custom-domain half is data-driven. Tests: `npx vitest run src/middleware` from `apps/api`. Reuse this pattern for any other surface that becomes tenant-domain-addressable.

## jsPDF `addImage` embeds images uncompressed at full resolution (added 2026-10-16)

Every PDF this platform renders is jsPDF, and `doc.addImage(...)` defaults its `compression` argument to `'NONE'` — the image goes into the file as **raw pixel data at the source resolution**, not as the compressed PNG/JPEG that was fetched. The platform logo (`platform_settings_list.logo_url`, a 1200×1200 PNG, 873,089 bytes on disk) is drawn a fraction of an inch tall everywhere (`logoHeight = 0.3` on the 4×6" postcard, `15` mm on receipts/reports, `20` mm on billing statements), so `POST /campaigns/:id/mailer` returned **12,003,973 bytes** for a 4×6" card and took 14s to ship it. In Firefox's Network panel that reads as a wall of base64 under a red **"Response has been truncated"** banner — the banner is the panel's 1 MiB response-*display* cap (`devtools.netmonitor.responseBodyLimit`) and the base64 is the panel's rendering of any non-text body ([Bugzilla 1623503](https://bugzilla.mozilla.org/show_bug.cgi?id=1623503)), not a failed or truncated request. Diagnosis rule: a Response tab starting `JVBERi0xLjM…` is `%PDF-1.3` base64-encoded for display — check status + `Content-Type` before believing anything is broken.

Two fixes, both in `apps/api/src`:

1. **`compression: 'SLOW'`** on every `addImage` call — pass `undefined` for `alias` to reach it: `addImage(dataUri, 'PNG', x, y, w, h, undefined, 'SLOW')`. Lossless for PNG (deflate of the raw data), ignored for JPEG (already compressed). Postcard: 12,003,973 → 860,574 bytes.
2. **`brandingLogoDataUri(source, maxEdge = 400)`** (`services/marketing/MarketingReceiptPdfService.ts`) — resolves a remote URL *or* a base64 data URI into a downscaled data URI plus its jsPDF format (`{ dataUri, format: 'PNG' | 'JPEG' }`; JPEG stays JPEG), via `sharp` (already a dependency). Every PDF service calls it instead of its own `fetch → arrayBuffer → base64` block, which also fixes the pre-existing mismatch where a JPEG logo was handed to `addImage` with a hardcoded `'PNG'` format. 400px is ≥300 dpi for the largest use (20 mm) and 4× the postcard's need; same 1200×1200 source → 107,711 bytes.

Callers keep their `if (branding.logoUrl) { try { … } catch { /* Continue without logo */ } }` shape, so a failed fetch/decode still degrades to the text header. Regression test: `apps/api/src/services/marketing/__tests__/PostalMailerPdfService.test.ts` (mocks branding with a 1200px PNG logo, asserts the postcard stays under 512 KiB — it renders ~4.8 MB without the compression argument and ~1 MB without the downscale). Unrelated known failure: `VercelGatewayProvider.test.ts` > "routes to direct provider if gateway is disabled" fails on a pristine `staging` checkout too (the two tests mutate `unifiedConfig.env` in-file) — not PDF work.

Mailer client (`CampaignDetailClient.tsx`): `window.open(blobUrl, '_blank')` *after* the generation await is **popup-blocked** — transient user activation expires 5s after the click and this call ran 14s in, so the operator got nothing. `handleGenerateMailer` now opens the tab up front (still inside the click) and navigates it once the blob exists, falls back to an `<a download>` click when even that is refused, and revokes the object URL after 60s. `MarketingOpsService.generateMailer` also surfaces the API's message: `result.error` is always `{ status, message, code }`, so the old `typeof result.error === 'string'` check always fell through to the generic string and hid e.g. the `ai_unavailable` 503 text.

## Diagnostic gallery links are path-form `/preview/<token>` (added 2026-10-16)

The public gallery URL is a **path segment**, never a query param: `/preview/<token>`, with `?prospect=true` added to select `MultiGalleryPage` over `GalleryClient`. Every producer agrees on that shape — `PostalMailerService.resolveQrDestination`, the gallery-token routes in `marketing-ops.ts`, `LogContactModal`, `CallScriptService`, `GalleryPanel`, the `/g/<shortCode>` redirect page, and the `next.config.ts` rewrite that maps `/preview/:token/img/:fileId` to the token-scoped screenshot endpoint. `GalleryClient` and `MultiGalleryPage` were the two exceptions — they read `searchParams.get('token')`, so every `/preview/<token>` link landed on **"Gallery Unavailable" / "No token provided"** (present since `1ccf70d57`, the commit that created them). Both now resolve via `resolveGalleryToken(params.token, searchParams.get('token'))` (`apps/web/src/app/preview/[token]/galleryToken.ts`): route segment first, `?token=` kept so legacy query links still work.

Symptom pattern to recognise: a gallery QR/link shows the "Gallery Unavailable" card with **"No token provided"** while the token is perfectly live — the page never saw a token, so it is client-side param reading, not an expired or missing token. Verify the token independently: `curl -s -o /dev/null -w '%{http_code}' https://api.visibleshelf.com/api/public/marketing/gallery/<token>` (200 = token + campaign resolve) and `curl -sI https://www.visibleshelf.com/g/<shortCode>` (307 → `/preview/<token>`). The data endpoint stamps `viewed_at` on first read, so a probe writes.

**The postcard mints a gallery token only when a gallery actually exists.** `resolveQrDestination` runs `GalleryEligibilityService.resolveEligibility` first — eligibility requires `preview_built|shown` + ≥1 `mkt_files_list` row with `file_type='diagnostic_screenshot'` + a resolved archetype — then mints with archetype-aware `galleryMeta` (`resolveGalleryArchetypeDefaults` + the shared A2 theme lookup `resolveGalleryTheme` in `services/marketing/gallery-theme.ts`, extracted out of the gallery-token route so both mint identical meta), `ctaAmountCents` from `package_price_cents`, supersedes prior unconverted gallery tokens (one live token per campaign, same contract as the route), and encodes the short `/g/<shortCode>` URL so the QR carries fewer modules at postcard size. Otherwise the QR falls back to the site root with the `Scan to learn more` CTA and logs the eligibility reason. A `seek`/`seed` campaign — the mailer's cold-outreach default — can never be gallery-eligible, so the previous unconditional mint printed a card promising a diagnostic the prospect could not open. Tests: `apps/api/src/services/marketing/__tests__/PostalMailerService.test.ts` (both directions plus the claim/portal precedence) and `apps/web/src/app/preview/[token]/galleryToken.test.ts`.

Also known-failing on a pristine checkout (both need env/order that the bare `vitest run` lacks, neither is PDF/gallery work): `src/tests/route-coverage.test.ts` ("Supabase configuration missing" — it boots the app; use `pnpm test:routes` under Doppler) and `src/services/ai-providers/__tests__/VercelGatewayProvider.test.ts` > "routes to direct provider if gateway is disabled".

## Outreach Kit tab — mailer is the gallery's print front-end (added 2026-10-16)

The campaign detail `gallery` tab (key unchanged — `?tab=gallery` deep links keep working) is now labelled **Outreach Kit** and composes `GalleryPanel` + `MailerPanel` + `GalleryAnalyticsTab`. The Postal Mailer block moved off Overview entirely (`MailerPanel.tsx`, same folder); the mailer stays gated to business-scope `seek|seed|preview_built` and renders a muted explainer outside that window.

**QR destination is operator-picked.** `POST /campaigns/:id/mailer` accepts `{ qrDestination, customUrl, qrDataUrl }` and `POST /campaigns/:id/mailer/qr-target` resolves the landing URL without generating the PDF — it exists because the styled QR is rendered client-side, so the URL must settle before the designer encodes it. `resolveQrDestination` gains an explicit-destination switch: `diagnostic_gallery` 400s with the eligibility reason when ineligible (never silently falls back), `claim` reuses a live `mkt_customer_claim_tokens` row for the campaign email before calling `issueClaimToken` (which voids prior unclaimed tokens — reuse keeps resolve-then-generate deterministic), `portal` requires `customer_id`, `site` is the homepage, `custom` validates http(s). `auto`/omitted preserves the original claim→portal→gallery→site precedence.

**Gallery QR target is reuse-or-mint**: a live unexpired `diagnostic_gallery` token is reused verbatim; none live → supersede unconverted stragglers + mint 30d with archetype-aware `galleryMeta`. `resolveQrTarget` returns `tokenExpiresAt` so the composer can warn when the encoded link has <7d runway (print lead time).

**`/g/<shortCode>` is token-aware now** (same pattern as `resolveClaimShortCode` + intake `/i/` codes): `MarketingDeliverableService.resolveShortCode` maps code→campaign permanently — an expired/superseded/paid encoded token resolves to the campaign's newest live token of the same `token_type`, and when no successor exists it still returns the dead token so `/preview` renders the expired re-activation hook instead of a 404. Only unknown codes 404. Printed postcards therefore survive gallery re-issue.

**Styled QR on the postcard**: `MailerQrDesignerModal` adapts `ClaimQrDesignerModal` (shared `qr-engine` + `qr-style-constants`, template picker subset `default|report-audit|claim-invite|promo`, platform logo via `platformSettingsService` with anonymous-CORS probe + uploaded custom logo, logo shape, gradients, PNG/SVG export). "Use this QR" hands a 1024px PNG data URL to the composer via `onApply`; the mailer route validates `data:image/png;base64,` + ≤8MB (same contract as the seed QR-kit postcard routes) and `generatePostcardPdf` embeds `payload.qrImageDataUrl` verbatim instead of `QRCode.toDataURL` when present. Tests: `PostalMailerService.test.ts` (explicit destinations, reuse-vs-mint, resolveQrTarget gate) + `MarketingDeliverableService.shortcode.test.ts` (live/dead/successor paths).

## Outreach Kit — minting a gallery link ≠ encoding one (added 2026-10-16)

Reported symptom on `mcamp-uvcasj3e` (stage `seek`, business scope, unpaid, no customer, **3 live gallery tokens**): the Postal Mailer's QR destination dropdown offered only *Auto / Website homepage / Custom URL*, and the resolved URL was the platform home whichever was picked. Root cause is the eligibility gate, not the dropdown: minting needs `preview_built|shown` (`GalleryEligibilityService`), so at `seek` the gallery option was filtered out of `availableDestinations`, and with it gone **both** remaining resolvable picks land on `${frontendUrl}/` — `site` by definition, `auto` because its gallery step also required eligibility. Confirm the shape with `db-rescue.cjs sql "select stage, scope, customer_id, date_paid from mkt_campaigns_list where id = '<id>'"` + the token rows: a seek/seed campaign with live `diagnostic_gallery` tokens is exactly the case this covers.

- **The gallery destination is offered whenever live links exist** (`apps/web/src/lib/mailer-qr-destinations.ts` — pure helpers, unit-tested): `canMintGalleryLink` gates only the *reuse-or-mint* sentinel; the option itself shows for `eligible || liveGalleryTokens.length > 0`, so the picker is token-aware and a campaign that minted at `preview_built` can still print that link from `seek`. `filterLiveGalleryTokens` drops converted/expired rows; a pinned-but-since-expired link stays selectable so the select never renders blank. `defaultGalleryTokenId` preselects the newest live link when the campaign can't mint — the sentinel (`''`) would 400 there — and the client disables Preview/Design/Generate while `galleryNeedsToken` is true.
- **Server side already supported it**: `explicitGalleryQrTarget` (via `galleryTokenId`) never consults eligibility — it only checks the token belongs to the campaign. The gap was purely that the UI never exposed the option.
- **`auto` now reuses a live gallery link** before falling back to the site root (new `liveGalleryQrTarget`, shared with the mint path so reuse semantics stay identical). Mint-eligibility is unchanged: `auto` still refuses to *mint* for a seek/seed campaign. `qrDestination: 'none'` (the true site-root fallback) now renders an explanatory line in the composer instead of a bare URL, since "why is this the home page?" was the reported confusion.
- **`frontendUrl` is trailing-slash-stripped** in `resolveQrDestination`: prod `WEB_URL` is `https://visibleshelf.com/`, so `${baseUrl}/` emitted `https://visibleshelf.com//` and gallery links `//g/<code>`.
- Tests: `apps/web/src/lib/mailer-qr-destinations.test.ts` (option set for the reported seek+no-links case, live-link case, claim/portal gates, sentinel-vs-pin default) and `PostalMailerService.test.ts` (auto reuses a live link when not mint-eligible, pinned link skips eligibility, trailing-slash normalization).

## Diagnostic screenshots are deletable (added 2026-10-16)

The Outreach Kit tab's Diagnostic Screenshots panel now has a per-row **Delete** (`GalleryPanel.tsx` → `marketingOpsService.deleteFile` → `DELETE /api/admin/marketing-ops/files/:id`, confirm dialog, permanent, then refetch — which also refreshes eligibility, since the screenshot count is part of the gallery gate). The route was row-only, which orphaned the stored object; it now removes the storage object from the private disputes bucket **first** and then the row, with storage cleanup best-effort (`logger.warn` + proceed) so an unreachable storage backend can't leave an operator stuck with a screenshot they can't remove. Deleting the last screenshot of a campaign that has live gallery links leaves that gallery rendering empty — deliberate (the delete is unguarded by request), so don't add a hard block without asking.

## Screenshots tag to briefing topics (added 2026-10-22)

Diagnostic screenshots are no longer free-form — each can be anchored to ONE topic in the sibling's archetype briefing ("Issues & Conversion Impact" / "Positioning Gaps" / "Outreach Ammunition" / "Benefits"), so the gallery caption carries that topic's hook/fix/benefit (migration `355` → `mkt_files_list.briefing_topic JSONB`, nullable = "General").

- **Ref in, snapshot out.** The client sends `{auditId, kind, index}` (`kind ∈ issue|gap|ammunition|benefit`); the API resolves it against the audit row and persists the item copy (`{auditId, auditPlatform, kind, index, label, detail}`) — an audit re-run can't re-mean a stored tag. Resolver/extractor live in `apps/api/src/lib/briefing-topics.ts` (`extractAuditBriefingTopics`, `resolveBriefingTopicSnapshot`, `publicBriefingTopic`); the web has the mirror `flattenBriefingTopics` in `apps/web/src/lib/briefing-topics.ts` (newest non-stub audit per briefing platform — `business_analysis` + `website_positioning` — inherited primary-sibling audits included via `campaign.audits`). Keep the kind vocabulary in sync between the two files.
- **Routes.** `POST /:campaignId/files/upload` accepts `briefingTopic` (JSON object or multipart JSON string — resolved BEFORE the storage upload so a bad tag fails fast, `400 invalid_briefing_topic`). `PATCH /:campaignId/files/:fileId/topic` retags or clears (`briefingTopic: null`). The referenced audit must live on this campaign OR on a sibling in the same `business_prospect_id` group — non-primary siblings tag to the inherited primary briefing.
- **Surfaces.** Admin: `GalleryPanel` gets an upload-time topic select plus a per-row retag select (a stored tag whose ref no longer matches a live topic renders as a disabled "(saved)" option). Prospect: both galleries emit `briefingTopic` per screenshot — `publicBriefingTopic` strips provenance (`auditId`/`index`) and re-filters detail to primitives — and `GalleryClient` / `MultiGalleryPage` render a "What this shows" caption (label + tagline: conversion cost for issues, gap description for gaps, solution→hook for ammunition, text for benefits).
- Tests: `apps/api/src/tests/marketing-ops-file-upload.test.ts` (snapshot persistence, invalid kind/index, cross-group rejection, inherited-audit acceptance, PATCH set/clear) and `apps/web/src/lib/briefing-topics.test.ts` (flatten order, newest-per-platform, stub exclusion, taglines).

## Surface classes + short-code redirect targets (added 2026-10-16)

**The URL delegate and the proxy allowlist now share one inventory.** `apps/web/src/lib/storefront-routing.ts` gained a `SurfaceClass` enum (`public | directory | tenant-scope | storefront | product`), `SURFACE_RULES` (per-class `{ reachableOnTenantHost, origin: 'platform' | 'canonical' }`), a root→class table (`SURFACE_ROOTS`, module-private), and `surfaceClassForPath()`. `isStorefrontPath()` is now **derived** from the class table (`reachableOnTenantHost`), and `STOREFRONT_PASSTHROUGH_ROOTS` is derived too — so adding a public route means adding it to `SURFACE_ROOTS` once, not editing a list. `STOREFRONT_PREFIX_ROOTS` (`/services`, `/policies`) stays explicit: prefixing with `/tenant/{id}` is a rewrite mechanic, not a class. **The five names are vocabulary, not five behaviours** — there are only two origins: host-independent (`public`/`directory`/`tenant-scope` → `platformOrigin()` absolute) and host-scoped (`storefront`/`product` → the target tenant's canonical). The only behavioural split inside host-independent is reachability: `tenant-scope` is refused on a tenant host, `public`/`directory` are served but never emitted relative. `/recovery` and `/marketing` are `tenant-scope` **by policy** (public token forms reached via a platform-absolute short link — see below), not because they're workspace paths.

**The canonical ladder is now one function.** `canonicalStorefrontOrigin(canon)` (for passthrough paths valid verbatim on every surface — `/products/{id}`, `/directory/{slug}`) and `canonicalStorefrontHome(canon, idOrSlug)` (the storefront root, absolute in all three kinds: `custom → https://{host}/`, `subdomain → https://{host}.{platformApexHost()}/`, `path → {platformOrigin()}/tenant/{idOrSlug}`). The ladder mapping had been copy-pasted three times (`useCrossTenantUrl`, `useTenantStorefrontUrl`, `tenant/[id]/page.tsx`); all three now call these. Data source is `tenantPublicService.getStorefrontCanonical(idOrSlug)` → `GET /api/tenants/storefront-canonical/:id` (tenant-scoped by id **or** slug, public, rate-limited, 15-min cache) — usable server-side, which is what makes the short-code redirectors able to reach it.

**Every short-code redirect target is emitted ABSOLUTE, chosen by the target's surface class.** The redirectors are server components, so they can only reach the delegate's data (the canonical resolver) — they cannot use the client hooks, and a bare host-relative `redirect()` keeps whatever host the link was opened on. Two rules, applied per target: a **platform** destination (`/place/claim`, `/preview`, `/seed-report`, `/prospect-report`, `/recovery/intake`) → `${platformOrigin()}${path}`, exactly like `PlaceCard`'s claim CTA and `usePlatformUrl`; a **storefront** destination → the canonical ladder. Concretely: `lib/claim-qr-redirect.ts` (`/q`, `/qw`, `/qs`, `/qe`), `lib/report-qr-redirect.ts` (`/r`, `/rt`, `/re`, `/rs`, `/rp`, `/rb`), `lib/intake-scan-redirect.ts` (`/i`), `app/c/[shortCode]`, `app/g/[shortCode]`, `app/r/pr/[code]` are all platform-absolute; `app/s/[autoId]` (the coupon — the ONE short code whose destination is a tenant storefront) resolves `getStorefrontCanonical(autoId-tenant)` and redirects to `canonicalStorefrontHome(...)?coupon=…`. **The `/i` case was a live landmine:** `/recovery` is deliberately refused by the allowlist (the rewrite returns before the auth gates), so a host-relative `/recovery/intake` recorded its `qr_scan_events` row and then 404'd on any tenant host — the fix keeps the B1 boundary instead of widening it. Symptom pattern to recognise: **a tracked short link resolves (the scan lands in analytics) but the visitor gets a 404** — the redirect target is host-relative and the target's root isn't allowlisted. Also fixed in the same pass: `app/qr/[tenantId]/page.tsx` hardcoded `https://{subdomain}.visibleshelf.com` for Visit-Store (now `useTenantStorefrontUrl`, so custom domains work and a domain-without-subdomain tenant no longer 404s), and `app/products/[id]/page.tsx` emitted JSON-LD `offers.url` from `${NEXT_PUBLIC_BASE_URL || 'https://rvp.vercel.app'}` — a var defined nowhere in the repo, so every product page shipped a stale non-platform origin to Google on every surface (now the same host-aware `currentUrl` as the share/QR URL). Tests: `apps/web/src/lib/storefront-routing.test.ts` (class table, allowlist derivation, every short-code root is a reachable `public` surface, ladder helpers) and `apps/web/src/app/shortcode-redirect-targets.test.ts` (each redirector's emitted target is absolute — platform origin, or the canonical for the coupon).

**The API-side ladder lives in one module too (added 2026-10-16).** `apps/api/src/lib/storefront-url.ts` — `resolveStorefrontCanonical(idOrSlug)` (tenant by id **or** slug → `active` custom domain → `tenants.subdomain` → path; returns `{ kind, host, tenantId, subdomain }`), `canonicalStorefrontBaseUrl(canon)` (absolute base, or **null** for a path-only tenant — callers that need a merchant-controlled domain must refuse rather than fall back to the platform path), and `platformApex()` (derived from `unifiedConfig.frontendUrl || webUrl`, never a hardcoded literal — staging serves on `visibleshelf.store`). `GET /api/tenants/storefront-canonical/:id` now just wraps it, so the route and every server-side consumer share one read. Cross-runtime counterpart is the web's `canonicalStorefrontOrigin`/`canonicalStorefrontHome`; `{ kind, host, tenantId }` is the contract between the two runtimes.

**Emitter triage — most emitters are CORRECT as-is; do not "fix" them.** A short-code *redirector* is a platform surface, so the QR kits (`ClaimInviteQrKitService`, `SeedReportDeliveryService`, `seed-report-qr.ts`), `PostalMailerService`'s gallery/claim/portal/site targets, and `outreach-link-vars.ts` all correctly encode **platform** URLs — the *resolution* (above) is what lands the visitor on the tenant's canonical surface. Rewriting them to the tenant domain would add a hop and, for prospect-facing claim/report links, point at a storefront the prospect does not have. The coupon QR (`CouponQRDialog` → `coupon-qr.ts`/`coupons.ts` returning relative `/s/{autoId}?c=` + `/tenant/{id}?coupon=`) is the same case: it encodes the platform redirector, which is what preserves `qr_scan_events` tracking (encoding the canonical domain directly would lose the scan). **The one emitter that writes a DIRECT tenant-storefront URL into an external system is `GMCProductSync`** — the sprint plan's named D6 exception candidate — and it was wrong: both `syncProduct` and the batch path hardcoded `https://{subdomain}.visibleshelf.com` and ignored custom domains entirely, with `businessProfile.website` (the tenant's *external* site, where the products don't live) as the fallback. Precedence is now **active custom domain → platform subdomain → external website → refuse**, via `canonicalStorefrontBaseUrl`; the diagnostics path's `storefrontReady` uses the same resolution so it can't disagree with what the sync accepts (`hasSubdomain`/`subdomain` stay the raw platform-subdomain fields; the same read now also returns the custom-domain-aware `storefrontKind`/`storefrontHost`/`storefrontBaseUrl`/`platformSubdomainUrl`/`customDomain`, which the shared web component `apps/web/src/components/google/StorefrontDomainSummary.tsx` renders — one module behind both the GMC **Settings → Domain Configuration** card (`variant="card"`) and the legacy `google/sync-status` chip (`variant="inline"`), so the two surfaces can't drift. It shows the live address (custom domain when active, apex derived from config so staging's `visibleshelf.store` is right) plus a `path`-only "no domain yet" warning, replacing the old hardcoded `{subdomain}.visibleshelf.com` row and the never-populated `domainValidation` warning block; read-only by design — the ladder picks the domain automatically, the merchant only needs confirmation). Tests: `apps/api/src/lib/__tests__/storefront-url.test.ts` (apex derivation, each ladder rung, path-only → null, id-or-slug + `status='active'` query shape); `apps/web/src/components/google/StorefrontDomainSummary.test.ts` (label + inline/card render) and `.../google/tabs/SettingsTab.test.ts` (card wired into the Settings tab).

**Still a deliberate non-goal:** preferring the custom domain for the *directory/QR/outreach* emitters as a cohort (D6). Only the GMC product link changed — it is the only emitter that names a surface the tenant owns **directly** rather than through a platform redirector, so the canonical ladder had to be applied at emission instead of at resolution.

## Recently-viewed store cards route seeds to /place (added 2026-10-16)

`LastViewed`'s store cards linked every entry to `/directory/{slug}?source=recent`, including unclaimed directory-presence seeds whose canonical URL is `/place/{slug}`. Root cause was a dropped field, not the routing logic: `UnifiedStoreCard` already routes via `getDirectoryListingUrl` (`subscriptionTier === 'directory_presence' || listingOrigin === 'directory_seed'` → `/place/{slug}`) — the same pattern `RelatedStores` relies on — but `LastViewed` built its `listing` inline without the seed signal, and `GET /api/recommendations/last-viewed` never selected it.

- `recommendationService.getLastViewedItems` store branch now selects `listing_origin` + `subscription_tier` in the `entity_data` json and surfaces them on the `Recommendation` (`listingOrigin`/`subscriptionTier`).
- `LastViewed` maps them through and hands the card a listing built by the new pure helper `apps/web/src/lib/last-viewed-listing.ts` (`buildLastViewedStoreListing`) — in `lib/` so it unit-tests in node without pulling the client card's Mantine/hook graph.
- `DirectoryListing` gained `listingOrigin?: string | null`.
- Test: `apps/web/src/lib/last-viewed-listing.test.ts` (seed → `/place`, tier-only seed → `/place`, claimed → `/directory`, no signal → `/directory`, display fields carried).

## Directory cards never link to the store's external website (added 2026-10-16)

`StoreCardV2` (the directory-home card via `StoreResults` in all three layout variants) sent the whole card to `store.website` when `store.canUseExternalLink && store.website` — so any listing with the external-link capability enabled **and** a website pulled shoppers off-platform instead of loading the entry page (reported symptom: a `/directory` card opening the merchant's own site). The branch is gone; the card now always links to `getDirectoryListingUrl(store)` (directory for claimed tenants, place for unclaimed seeds), which also restores seed→`/place` routing for those cards (it was being bypassed whenever the external branch won). The `ExternalLink` glyph on "Visit Store" became `ChevronRight` (it no longer leaves the platform) and the `target="_blank"`/`rel` pair went with the branch. The same branch lived in `components/directory/StoreCard.tsx` (dead code — no importers) and was removed there too, switching its old hardcoded `/directory/{slug}` for `getDirectoryListingUrl`.

- `DirectoryStore` gained `listingOrigin?: string | null` — the MV search route already returns it (`apps/api/src/routes/directory-mv.ts`), so the seed signal is now typed instead of runtime-only.
- **The per-listing `canUseExternalLink` capability now has no consumer on the web.** It came from `mec.is_enabled` (`directory-mv.ts` / `directory.ts` / `directory-consolidated.ts`); the tier-capability UI (`canShowExternalLink`/`externalLinkEnabled` in `CapabilityResolutionService` → `DirectorySettingsPanel`, `PlanSummaryPanel`, `CapabilityShowcase`) still advertises it, and the entry-page layouts never rendered a website link — so if the entitlement should still do something, it has to be re-homed (e.g. a "Visit Website" link *inside* the entry page), not the card destination.
- Test: `apps/web/src/components/directory/redesign/StoreCardV2.test.ts` (seed→`/place`, claimed→`/directory`, website ignored even with the capability on, `?shelf=` preserved).

### Wedge fidelity (`directory_presence_seeds.seed_fidelity`) — every claim surface is gated (added 2026-10-16)

`misaligned` suppresses **every** claim-token surface — QR kits, claim links, merge vars, report CTAs, and the `/place` claim banner all add `AND dps.seed_fidelity IS DISTINCT FROM 'misaligned'` and degrade to the inquiry path (`ClaimInviteQrKitService.resolveClaimInviteKit`, `outreach-openers/outreach-link-vars.ts`, `seed-report-public.ts`, `directory-consolidated.ts`, `DirectoryClaimService`). The verdict is one persisted value per seed, consulted by reads — so **every writer that changes a verdict input must recompute it**, or a stale verdict silently 404s the claim surfaces (`{"error":"no_active_claim_token"}`).

Verdict inputs (`services/seed-fidelity.ts` → `evaluateSeedFidelity`, pure):

- the audit canonical (campaign columns → latest non-stub `business_analysis` audit → `resolveCampaignNap`)
- the listing NAP + sparsity (`product_count`, `directory_photos` count, `business_hours`)
- **`nap_verified_at` / `nap_owner_corrected`** — an attested NAP makes the *listing* authoritative over the audit canonical, short-circuiting the mismatch branch entirely

Recompute sites (`computeAndStoreSeedFidelity`): `publishSeed`, `updateFields` (when NAP fields or hours change), `MarketingCampaignService.resolveCampaignVerification`, and `ManualOutreachAnchorService.processVerificationResults` (the last two added 2026-10-16 — a seed verified *after* its publish-time verdict used to keep that verdict forever; repro `dps-329R-nf8nmoao`: verdict 10-13 `misaligned`, campaign verification confirmed the NAP 10-15, QR kit 404'd until the verdict was recomputed → `thin`). Any **new** NAP-verification writer must recompute too.

`refreshSeedFidelityIfStale` (spec D5 lazy refresh) is the belt-and-braces: it now recomputes when the latest `directory_seed_nap_verifications.created_at` postdates `seed_fidelity_checked_at`, as well as when the source audit id changed or the stored audit id no longer resolves to a live campaign. Called from `resolvePlanSeedClaim` (plan cockpit) and `GET /api/admin/directory/presence-seeds/:id` (seed detail) — the detail route is what makes a stale row self-heal for the operator.

`hasMaterialAddressVariations` / `splitUnitDesignator` (`outreach-openers/signal-magnitude.ts`) own the "a unit designator is not drift" rule for `evaluateSeedFidelity`, `hasMaterialDrift`, and `hasMaterialAddressDrift`: a unit on only one side (`"6667 W Washington St"` vs `"6667 W Washington St, Unit A"`) is cosmetic, two *different* units on the same street stay material. Addresses are segmented on commas first so a mid-address unit cannot swallow the city into the unit bucket.

Tests: `services/__tests__/seed-fidelity.test.ts` (comparator), `seed-fidelity-refresh.test.ts` (staleness), `ManualOutreachAnchorService.processVerificationResults.test.ts` + `MarketingCampaignService.resolveCampaignVerification.test.ts` (write sites), `outreach-openers/__tests__/signal-magnitude.test.ts` (normalizer).

### Auth0 / Google OAuth / platform-host config — read `docs/AUTH_CONFIG_SECURITY.md` before touching any of it (added 2026-10-16)

**The Auth0 config exists nowhere in this repo** — zero `AUTH0_*` in any `.env*` or `.vercel`; it lives entirely in Vercel env vars + Auth0 dashboard state. `docs/AUTH_CONFIG_SECURITY.md` is the compensating record: tenant + application inventory (match on Client ID, the names are misleading — the app named "Visible Shelf" is *staging*), the allowlist rules per field (Callbacks need exact `/auth/callback` paths; Logout/Web Origins/CORS take bare origins), the two independent Google relationships, host/domain config, and a probe procedure to verify any change actually took effect.

Hard-won facts recorded there:

- **Never wildcard Auth0 allowlists.** `https://*.vercel.app/auth/callback` and `https://retail-visibility-platform-*.vercel.app/auth/callback` were both live on production *and* staging until 2026-10-16, and both are exploitable — Vercel subdomains are free to claim. Verify with the replay probe in the doc (always include the control row; `403 Callback URL mismatch` on an arbitrary host is the pass condition).
- **`platformApexHost()` derives from `platformOrigin()`** and builds `{slug}.{apex}` tenant-subdomain URLs. Pointing `NEXT_PUBLIC_WEB_URL`/`WEB_URL` at `www.` would yield `{slug}.www.visibleshelf.com` and break live tenants — fix the serving host at the Vercel domain level instead. `NEXT_PUBLIC_*` is also build-time inlined, so it needs a rebuild, not just an env edit.
- **Two Google OAuths, don't conflate them.** Login is brokered by Auth0 (Google's allowlist is *Authorized redirect URIs* in Google Cloud Console, pointing at Auth0's `/login/callback` — Allowed Callback URLs is the Auth0→app leg, which Google never reads). GBP + Merchant Center is direct and platform-owned (`lib/google/oauth.ts`, `GOOGLE_CLIENT_ID`/`GOOGLE_REDIRECT_URI`).
- **Login runs on Auth0 dev keys** (Auth0 renders the warning on the production login page): shared quota, "Auth0" on the Google consent screen, rotatable without notice. Fix = own Google Cloud OAuth client (§3c).
- **A Vercel edge redirect has no `X-Matched-Path`** — that header only appears when the request reaches the Next.js app, which is how the apex→www hop was distinguished from app code.

## GBP transport seam — develop the Business Profile flow without Google's allowlisting (added 2026-10-17)

**Two independent Google gates, and until now the repo only tracked one.** `docs/AUTH_CONFIG_SECURITY.md` §3b is a careful record of **Gate A — the OAuth consent screen** (unverified-app screen, 100-user cap; published to `In production` 2026-10-16). It contains zero mentions of **Gate B — GBP API project allowlisting**, which is a different gate on a different axis and is what actually blocks the feature.

Gate B is the one behind `GET /api/google/business/locations` returning `503 api_not_approved`. Proof that it is Gate B and not A or a code bug: the response is `429 RATE_LIMIT_EXCEEDED` with `quota_limit_value: '0'`, which can only be produced *after* the token was accepted (an invalid token is 401) and *after* the API was found enabled (a disabled API is 403 `SERVICE_DISABLED`). Google's own wording: *"If your quota limit for the Google Business Profile API is 0, you have not yet been granted access. Don't request a quota increase. Instead, submit the Application For Basic API Access."* So the fix is the **access-request form** (`support.google.com/business/contact/api_default`, option *Application for Basic API Access*) — **not** a quota-increase request, which auto-rejects with *"your company may not have an allowlisted project"*, and **not** anything in the OAuth consent screen.

**The project number recorded in `docs/AUTH_CONFIG_SECURITY.md` line 211 is wrong.** It says `487743626849`; the real number is **`407743626849`**, derived from the client IDs the repo actually uses (`407743626849-14md…` Business Profile, `407743626849-l1na…` Merchant Center — a client ID's prefix *is* its project number; see `INSERT_GOOGLE_BUSINESS_OAUTH.sql` and `GoogleIntegrationService.test.ts`). The application form requires the exact project number, so the digit transposition matters. Also: *"Only one project per business can be granted access to the Business Profile APIs"* — do not spin up a separate test project, because it can never be approved.

Eligibility (Google's current prerequisites, and the real long pole — not the ~14-day review): a **verified GBP active for 60+ days**, owned by the applicant *or* one of the clients they manage, with a **website representing that business** on the profile, submitted from an email that is an **owner/manager on that GBP**, with the website domain matching the email domain. Check status in Cloud Console → **IAM & Admin → Quotas** (`mybusinessaccountmanagement.googleapis.com`): **0 QPM = not approved, 300 QPM = approved**. The legacy "Google My Business API" only becomes *visible* in the console once you are approved — that visibility is the tell.

### The seam itself

Google ships no sandbox for these APIs (*"There's no Sandbox environment for the Business Profile APIs"*), permits no fake listings (*"there's no direct way to create a fake GBP listing in prod… Most of the fake listings that are created get flagged by our moderation and suspended"*), and offers `validateOnly` as a dry-run flag that still requires quota. Asked point-blank whether partners can create a test account, Google's FAQ answers **"No"** and recommends the only remaining option: *"you can use mock API responses."*

`apps/api/src/lib/google/gbp-transport.ts` is that, as one seam. Three modes, **off by default**:

| `GBP_TRANSPORT` | Behaviour |
|---|---|
| `live` (default) | Transparent passthrough to the global `fetch` — zero behaviour change. |
| `fixture` | Serves recorded JSON from `GBP_FIXTURE_DIR`; never touches Google, so it works at 0 QPM. |
| `record` | Calls Google for real *and* writes each response into `GBP_FIXTURE_DIR`, so fixtures can be refreshed from a real approved account. Never overwrites an existing file. |

- **The module owns the Google hostnames.** `GBP_BUSINESS_INFORMATION_BASE` / `GBP_ACCOUNT_MANAGEMENT_BASE` / `GBP_V4_BASE` are exported from it, and it is the **only file under `src/` allowed to name a `mybusiness*.googleapis.com` host** — enforced by a guard test in `lib/google/__tests__/gbp-transport.test.ts`. That guard is the point: a new call site with a hardcoded URL would silently bypass fixtures and, in dev, resurface as the very quota error the harness exists to remove. All ~41 call sites across 10 files now go through `gbpFetch`; two dead `private readonly API_BASE` fields were dropped in the process.
- **A fixture miss is a loud `501 FIXTURE_MISSING`, never a fall-through to Google.** In fixture mode you must always be able to tell what came from the harness.
- **Interception is host-scoped.** The media flow's `PUT` to the `startUpload` upload reference is a storage endpoint, not an API call, so it is left on raw `fetch` and passes through in every mode.
- **`gbpFetch` resolves the global `fetch` at call time, not at import.** That is deliberate: the existing suites that do `global.fetch = mockFetch` (e.g. `GBPVerificationService.test.ts`) keep intercepting exactly as before, which is why the ~41-site swap landed with no test churn.
- Fixture files declare `{ match: { method, host, path, queryIncludes }, status, body }`; `path` globs with `*` (one segment) and `**` (any). Two fixtures matching one request **throws** rather than letting filename order decide.
- Fixture mode **throws under `NODE_ENV=production`** unless `GBP_FIXTURE_ALLOW_PROD=true` is set explicitly.

**Profiles:** `apps/api/fixtures/gbp/approved/` (the happy path, the default) and `apps/api/fixtures/gbp/pending/` (a real `429`/`quota_limit_value: '0'` body, i.e. today's live behaviour on demand). Point `GBP_FIXTURE_DIR` at the latter to develop the pending-approval UI state, or at the former to build the link-location flow.

**Run it:** `cd apps/api && GBP_TRANSPORT=fixture npx vitest run src/tests/gbp-locations-fixture.test.ts` — drives the **real route** through the **real transport** and asserts both halves: the pending profile still 503s with `api_not_approved`, and the approved profile returns locations where the live project cannot. `npx vitest run src/lib/google/__tests__/gbp-transport.test.ts` covers mode resolution, matching, the production guard, record mode, and the host guard.

**Addressed 2026-10-17 — the tenant is no longer blamed for the platform-side approval gap.** The error was being discarded twice, so the fix is in three layers:

- `FlexibleApiSingleton.executeUnifiedRequest` now carries `userMessage` from the error envelope onto `ApiResult.error` (`EnhancedFlexibleApiSingleton.ApiResult.error` grew an optional `userMessage`). Previously only `message` survived, so the API's deliberately tenant-facing copy was unreachable from the web app — for **every** endpoint, not just GBP.
- `platformHomeService.getGoogleBusinessLocations` returns `{ locations, unavailable?: { code, message } }` instead of `unwrapApiBody(result)`, mirroring the `getGoogleOAuthMerchants` precedent directly above it in the same file: `unwrapApiBody` collapses a failure to `null`, which is indistinguishable from "this account has none". `unavailable.message` prefers `userMessage`, falls back to `message`.
- `sync-status/page.tsx` renders `unavailable.message` in the selector, plus an extra *"this one is on our side, not yours"* line when `code === 'api_not_approved'`, and only reaches *"No GBP locations found…"* when the list is genuinely empty. `TenantInfoService.getGBPLocations` returns the failure envelope rather than `null`; `GBPLocationCard.tsx` reads it and skips opening the selector on failure.

Regression guard: `PlatformHomeSingletonService.gbpLocations.test.ts` (six cases — envelope unwrap, `api_not_approved` → `unavailable`, `userMessage` preference, `message` fallback, genuinely-empty-is-success, failed-transport-is-never-"no locations"). The page itself is `useEffect`-gated so it can't be reached in a static render — the service contract is the testable surface, per the web-component notes above.

**Dead-endpoint repair 2026-10-17.** `GBPLocationCard.tsx` was calling `tenantInfoService.getGBPLocations` / `linkGBPLocation` / `unlinkGBPLocation`, which targeted `/api/tenants/:id/gbp/{locations,link,unlink}` — **none of which exist in the API**, so its Link/Unlink buttons 404'd silently. Fixed:

- The card now uses the live `getGoogleBusinessProfile*` methods (`/api/google/business/*`), which carry the same double-wrapped envelope. Its `getGBPConnectionStatus` / `getGBPLinkedLocation` reads already hit live routes (`/google/business/status` returns `data.isConnected`; `linked-location` returns `data.location`) and were left alone.
- **`POST /google/business/unlink-location` had no server side at all** — the card's "Unlink Location" button was its only caller and it 404'd. Added to `routes/google-business-oauth.ts`, mirroring `link-location`: deletes the row for a given `locationId`, or every `gbp_locations_list` row on the account when none is given (the same cleanup `disconnect` performs). `unlinkGoogleBusinessProfileLocation(tenantId, locationId?)` now sends `{ tenantId, locationId }` — the old body was `{}`, so even a route it *did* point at would have rejected it.
- `GET /google/business/locations` returns `address` as a **pre-formatted string**, not the raw GBP `{ addressLines, locality, … }` object the card assumed — so the picker rendered no address and linked a blank one. `formatLocationAddress` now accepts both shapes.
- The three dead `TenantInfoService` methods were deleted rather than left as a trap for the next caller.

Guard: `src/tests/gbp-locations-fixture.test.ts` gained four `unlink-location` cases (locationId-scoped delete, account-wide delete, no-op without an account, 400 without tenantId).


### Server-resolved auth user has no `tenants` — normalize before consumers read it (added 2026-10-17)

The root `layout.tsx` seeds `AuthProvider` with the Auth0 profile decoded from the session cookie (`ServerResolvedAuth['user']`) — **it carries no `tenants` array and no DB `role`**. `AuthProvider` stores that partial object as `user` while `isLoading` is still `true`, so any consumer that reads `user.tenants` without a guard crashes on first client render. Symptom: a page-level error boundary reading `can't access property "find", o.tenants is undefined` (e.g. `/t/{tenantId}/settings/integrations`, stack pointing at `useTenantTier`). Fixes applied: `AuthProvider` normalizes the seed (`tenants: serverUser.tenants ?? []`), and `useTenantTier` guards its lookup (`userData.tenants?.find(...)`). The `User` type declares `tenants` as required, so TypeScript will not flag the unguarded reads — grep `\.tenants\.(find|map|length|some)` when touching auth-consuming code.

### GMC Products tab surfaces validation detail inline (added 2026-10-17)

The Overview banners say "check the Products tab for details" for the Google Shopping validation counts, but `ProductsTab` only rendered the compliance report behind a manual "Run Validation" click and showed nothing per-product in the table. The tab now auto-loads `gmcValidationService.getValidationReport` on mount (and after a successful sync), adds a **Validation** column keyed by `inventory_items.id` via the exported pure helper `buildValidationIndex` (only items with ≥1 issue are indexed), and expands a row to list every `field: message` so the merchant sees exactly what to fix. Each expanded row also links to the tenant-scoped product editor (`/t/{tenantId}/items/{itemId}` — the same "Edit product details" target `FeaturedProductsManager` uses) so the fix is one click away. The report covers `visibility='public'` + `product_type IN ('physical','hybrid')` + non-trashed items only, so rows outside that set render `—`. The API validator's ERROR set is title/description(<30)/image_url/price — *not* availability, so the Overview banner's parenthetical was corrected to name those fields (`GMCValidationService.validateProductForGMC` is the source of truth; keep the banner in sync with it).

### Four-Act cascade — stage advice on the VAST surfaces (added 2026-10-20)

The cascade answers "what outreach is next"; `StageAdviceService` (`apps/api/src/services/StageAdviceService.ts`) answers the orthogonal "is the next *pipeline* stage true yet". It returns a `stageAdvice` block on `CampaignCascadeResponse` (`GET /campaigns/:id/cascade` and `/campaigns/cascade-batch`), so the campaign Execution tab (`CampaignExecutionPanel`), the PG VAST board (`VastPanel` rows) and the seed card (`SeedCascadeCard`) all read one derivation.

- **It is a view, not a gate** (spec §8). Every predicate is the one the transition route already enforces, so the board cannot go green on something the route refuses: `GalleryEligibilityService.resolveArchetypeSource` (the `preview_built` hard gate), `PlaybookChecklistService.getIncompleteRequiredSteps` (the soft gate), `resolveEligibility` (stage/screenshots/archetype), and the seed summary's act 1/act 3 gates. The banner's only mutation is `POST /:id/transition`; a 409 `checklist_incomplete` payload is rendered as the acknowledgement list, and a 409 `business_analysis_required` disables the button (it is the one edge with no back-edge).
- **Readiness is four-state**, not boolean: `ready` / `ready_with_ack` (checklist soft gate, or "no gallery view yet" on `preview_built → shown`) / `blocked` / `terminal`. `StageAdviceBlocker.hard` marks the 409s the operator cannot acknowledge away.
- **Two mechanics are encoded** because they make the ordering non-obvious: the mailer is only allowed in `seek`/`seed`/`preview_built` (`PostalMailerService.assertMailerAllowed`), so the act-2 postcard must ship **before** `shown`; and the act-2 confirm page leads onward to the gallery, so the gallery must exist before the postcard is mailed (`GALLERY_ELIGIBLE_STAGES = ['preview_built','shown']`).
- **Advice stops at `shown`** — the first four stages are the cascade's; after that the remaining work is the act-4 visit and payment, which are not stage predicates. Aggregate scopes and non-business campaigns are `terminal`.
- **Seek-edge advice resolves with no seed** (`getForCampaign` passes `cascade: null`) because that edge is about the audit, not the listing. `operationalVerified` is a notes-marker heuristic (`'Operating status verified via phone call'`) — the verify route only writes prose, there is no structured column.
- Tests: `apps/api/src/services/__tests__/StageAdviceService.test.ts` (pure `deriveStageAdvice`, 16 cases), `StageAdviceBanner.test.ts` (SSR, `.test.ts` + `createElement`), plus pass-through cases in `CampaignCascadeService.test.ts` / `VastPanel.test.ts`.

### Seed cleanup panel — post-batch-publish verification (added 2026-10-23)

Publish-first / clean-later surface at `/settings/admin/directory/presence-seeds/cleanup` (link on the seeds page header). Backed by `DirectorySeedCleanupService` + three routes declared before `/presence-seeds/:id`:

- `GET /presence-seeds/cleanup-report?seedBatch=` — duplicate groups + per-seed completeness. Dedup uses the SAME normalizers as the funnel detection (`phone` digits / `address_city` punctuation-stripped) so verdicts recorded here clear `duplicateSeedCount`; a batch scope still compares against ALL live seeds (a batch can duplicate an older seed), and groups carry their `mkt_prospect_dedup_verdicts` row rather than being hidden. Completeness reports missing canonical provenance (`name`/`address`/`phone`/`website`/`primary_category`/`secondary_categories`/`hours`), SEO (`description`/`keywords`/`same_as`/`seo_enrichment`), and attributes; `pg-*` batches are flagged since their thin profile is structural (the proving-ground path writes only `discovery:*` provenance — no canonical rows, no SeedSeoComposer packet).
- `POST /presence-seeds/resolve-duplicates` — `{keepSeedId, suppressSeedIds[], matchKey}`: suppresses losers + revokes their live claim tokens in one transaction, then records `same_entity` verdicts for EVERY match key the set satisfies (the same pair can surface under both keys and verdicts are per-key). Claimed seeds can be the keeper but can never be suppressed (409 `claimed_seed_cannot_suppress`); already-suppressed losers are idempotent skips.
- `POST /presence-seeds/backfill-enrichment` — `{seedIds[]}`: insert-only canonical provenance (`ON CONFLICT DO NOTHING` — human/owner rows outrank), queue-snapshot attributes via `normalizeAttributeEntry`, then per-seed `getComposedEnrichment` with fill-missing writes (`buildSeoEnrichmentJson` + prov rows). `POST /:id/reset` stays the overwrite path; backfill never clobbers. Queue-linked seeds cite `prospect_queue`, others `cleanup_backfill`.

First-batch catch (pg-mcamp-mdjvk2bu-20261023, 58 seeds): 9 address + 5 phone duplicate groups (name variants beat the exact-`LOWER(business_name)` batch dedup guard) and all 58 thin on canonical provenance + SEO — both fixable from the panel.

### Places sitemap producer — URL assembly is pure (added 2026-10-23)

`GET /api/public/directory/places-sitemap.xml` (`apps/api/src/routes/directory-presence-public.ts`) owns the SQL; `apps/api/src/lib/sitemap.ts` owns every URL/XML rule and is unit-tested in `apps/api/src/lib/__tests__/sitemap.test.ts`. Spec: `docs/LocalBiz/PLACES_SEO_INDEXING_SPEC.md`.

- **Origin comes from `unifiedConfig.webUrl`, never `req.get('host')`.** Through the Next proxy the host is `api.visibleshelf.com`, which stamped every `<loc>` cross-domain and made the sitemap unusable. `resolveSitemapBaseUrl` trims trailing slashes and returns null for empty/non-http(s)/`api.*` — the route then answers `500 sitemap_origin_unconfigured` rather than emitting a bad document.
- **Seeds and claimed listings are disjoint surfaces.** Seeds (`dll.listing_origin = 'directory_seed'`) emit `/place/{slug}`; everything else emits `/directory/{slug}`. The layouts 308 the other way for each, so emitting either on the wrong surface puts a redirect in the sitemap. Demo tenants are excluded (`t.is_demo IS NOT TRUE`) — sample storefronts are not inventory.
- **Composite shelf slugs are filtered, not rendered** (§4.6): >60 chars or containing `per-directory`. Dropped slugs are logged with a count so the operator can see the cost. `-unverified` variants are legitimate and kept.
- **`<lastmod>` is optional and NULL-safe** — `formatLastmod` returns null for NULL/Invalid Date instead of throwing (a single throw 500s the whole document).
- **Queries are `ORDER BY`-stable** so successive crawls fetch a byte-stable sitemap (diff noise otherwise).
- **No generation log.** The `directory_places_sitemap_log` insert was dropped — nothing read the table, and the index multiplies generation events. Drop the table in a follow-up migration if nothing adopts it.
- **Split into an index:** `GET /api/public/directory/sitemap.xml` is a `<sitemapindex>` over `GET /sitemap/:file` — `core`, `places`, `directory`, `storefronts`, `products-N` (20,000-URL chunks, `ORDER BY ii.id` so successive crawls see stable files). The legacy `/places-sitemap.xml` 301s to the index.
- **Storefront/product locs use the tenant ladder** — active `custom_domains` row → `{subdomain}.{apex}` → `/tenant/{slug}` — resolved in one `LEFT JOIN LATERAL` (`TENANT_LADDER_JOIN`), never per tenant. Products inherit their OWNING tenant's origin (`{origin}/products/{id}`). Gating: `item_status='active' AND visibility='public'`, `is_demo IS NOT TRUE`, `location_status='active'`.
- **Web exposure:** `next.config.ts` rewrites `/sitemap.xml` → API index and `/sitemaps/:file` → API file; `app/robots.ts` serves on the platform apex AND every tenant host (the proxy passes `.`-paths through) with a **platform-absolute** `Sitemap:` line — that reference is what authorizes the cross-host `<loc>`s for subdomains and custom domains. `/directory/sitemap.xml` 308s to `/sitemap.xml`. Root layout sets `metadataBase`.

### Storefront / product canonicals + un-gated JSON-LD (added 2026-10-23)

Spec §4.9 / RC11. Three surfaces describe the same tenant; only `/tenant/{slug}` emitted a correct canonical before this.

- **One ladder, one URL builder.** `apps/web/src/lib/seo-canonical.ts` composes `storefront-routing.ts` with the surface path: `productCanonicalUrl(canon, id)` → `{canonical origin}/products/{id}`, `shopProfileCanonicalUrl(canon, idOrSlug)` → `canonicalStorefrontHome`. Both accept the loose `CanonicalLookup` shape returned by `TenantPublicService.getStorefrontCanonical`, so callers pass the service result directly. Never derive these from `headers().get('host')` — the same product renders on the apex and every tenant host.
- **`/shops/{slug}` is suppressed by canonical, never `noindex` or `Disallow`.** `noindex` voids the canonical and a robots block stops the crawl before the canonical is read. It stays reachable and linked; it is simply not advertised in the sitemap.
- **`Product`/`Store` JSON-LD is un-gated.** Basic structured data is not a paid capability: the product page emits its `Product` script unconditionally, and `/tenant/{slug}` emits `buildStorefrontSchema` (`apps/web/src/lib/storefront-seo.ts`) for every tenant. `enhanced_seo` still gates `<meta name="keywords">`, enriched descriptions, and share-card imagery.
- **Never emit JSON-LD through `metadata.other`.** `other: { 'application/ld+json': … }` renders `<meta name="application/ld+json">`, which no crawler reads. Emit one `<script type="application/ld+json">` in the body. Both old call sites were removed; the product page had been emitting a valid script *and* an inert meta for paying tenants.
- **Gating:** demo tenants, `google_only` tiers, closed-storefront messages, and non-public products (`item_status !== 'active' || visibility !== 'public'`) get `robots: { index: false, follow: false }` on the storefront/product surfaces, matching the sitemap producer's exclusions.
- Tests: `apps/web/src/lib/__tests__/seo-canonical.test.ts` (custom/subdomain/path/null ladder), `storefront-seo.test.ts` (type mapping, null-address stripping, keyword filtering).
