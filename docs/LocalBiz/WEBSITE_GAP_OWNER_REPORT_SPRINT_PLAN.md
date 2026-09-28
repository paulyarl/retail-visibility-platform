# Sprint Plan: Prospect (Business Visibility) Report — Owner-Facing "Free Report" Deliverable

**Document Version:** 1.1 (gap-analysis fold)
**Date:** 2026-09-28
**Status:** Ready for Sprint Planning
**Spec:** `docs/LocalBiz/WEBSITE_GAP_OWNER_REPORT_SPEC.md` (§references throughout)

> **Revision 1.1 — gap-analysis fold.** A pre-implementation gap sweep against the
> codebase corrected several load-bearing assumptions. The material changes:
>
> 1. **Routers mount in `routeRegistry.ts`, not `index.ts`** — no router is mounted
>    in `index.ts`; the seed-report routers live in the route registry (imports
>    `apps/api/src/routes/routeRegistry.ts:307-309`, mounts `:2116-2128`).
> 2. **Page-plan flag added to the signed token** (4th payload segment) — without it
>    the public route/PDF can never honor the operator's `includePagePlan` toggle.
> 3. **Share endpoint pinned** — one call per channel (`&channel=…`), one code per
>    call, explicit response shape; the old signature silently minted rows for an
>    undefined channel set.
> 4. **Token-based QR router dropped at v1** — all shareable paths mint codes
>    (`/r/pr/{code}`); the `/r/prospect-report/:token/:channel` route was redundant
>    with the code table and created an attribution ambiguity.
> 5. **PDF render is side-effect-free** — it no longer mints a code per GET.
> 6. **Web QR surface registry added to scope** — `apps/web/src/services/QrAnalyticsService.ts`
>    and the admin QR page carry their own `QrSurfaceType`/labels/filter list.
> 7. Met/unmet rule extended to number/array expectations; claimed-owner locked-CTA
>    v1 behavior pinned; token expiry/revocation property documented.

---

## 0. Pre-Flight Checklist (Start-of-Phase)

### 0.1 Hard Rule — TypeScript Checks at Phase End

```bash
pnpm checkapi   # tsc --noEmit --project apps/api
pnpm checkweb   # tsc --noEmit --project apps/web
```

Zero new errors on both, per phase. Non-negotiable.

### 0.2 Service Strategy

| Service | Audience | Base | Status |
|---|---|---|---|
| `ProspectReportService` | Internal | `BaseService` | **New** — assemble/transform/token/links |
| `ProspectReportPdfService` | Internal | module fns (SeedReportPdfService pattern) | **New** — placed beside `SeedReportPdfService.ts` in `services/intelligence/` |
| `MarketIntelAccessService` | Internal | existing | Extend `SurfaceType` += `'prospect_report'` (no unlock route in this sprint — OQ-6 plumbing lands with the paid tier; **dead code at v1 by design**) |
| `QrAnalyticsService` (api) | Internal | existing | Extend `QrSurfaceType` += `prospect_report_*` + `SURFACE_LABELS` |
| `QrAnalyticsService` (web) | Admin panel | `TenantApiSingleton` | Extend the **separate** web `QrSurfaceType` union + `SURFACE_LABELS` (see Phase 1) |
| Admin QR analytics page | Admin panel | page component | Add the new surfaces to the hardcoded `SURFACE_OPTIONS` filter |
| `MarketingOpsService` (frontend) | Admin panel | `AdminApiSingleton` | Extend `getProspectReport`/`getProspectReportShare` |
| Public client | Public page | `PublicApiSingleton` | **New** `ProspectReportPublicService` (mirrors the web `SeedReportPreviewService` and the api `seed-report-public.ts` router — **not** a class named `SeedReportPublicService`, which does not exist) |

- [ ] No direct `fetch` in web components — all calls through the two singletons
- [ ] No third-party report/state libraries — transform is pure functions

### 0.3 Skill / Doc Awareness

- Manual-migration policy: `311_*.sql` hand-written, `prisma db pull` after apply per AGENTS.md (local only; prod via shipped build)
- `vi.hoisted()` mock pattern for new API tests
- Mantine-free server-render test conventions for web (`createElement`, `.test.ts`, `renderToStaticMarkup`)
- Structured logging: `logger.method(message, undefined, { meta })` in new service methods
- Router registration: `apps/api/src/routes/routeRegistry.ts` — `{ path, router, domain, authLevel, comment }` entries, **not** `index.ts`

### 0.4 Pinned contracts (single source of truth for implementers)

These are the decisions the gap sweep surfaced. Implementers should not re-derive them.

**Signed token (§5.1 + G-3), 4 segments:**
```
payload  = base64url(prospectId + "." + tier + "." + chapterList + "." + flags)
token    = payload + "." + base64url(HMAC-SHA256(payload, PROSPECT_REPORT_TOKEN_SECRET))
```
- `chapterList` — comma-joined ordered chapter ids (`website`, `repair`), index 0 = free-visible.
- `flags` — compact ordered chars; `p` = include detailed page plan, `-` = none. Reserves room for future flags without a payload-shape break.
- `timingSafeEqual` compare **after a length check** (unequal buffers throw).
- No `exp` at v1 (spec-accepted: links are cheap to re-mint; rotating the secret invalidates all issued links). **Deleting a `mkt_prospect_report_links` row kills only that code — the raw token stays valid.** Documented in AGENTS at Phase 7.

**Chapter registry (chapter id ↔ audit source ↔ builder — playbook-agnostic):**
```
CHAPTER_BUILDERS: Record<ChapterId, { source: AuditSource; title: string; build: (...) }>
  website → 'website_positioning', "Your website today", buildWebsiteChapter
  repair  → (unregistered at v1 — OQ-5)
```
Chapters key on the **audit source** (`mkt_audits_list.platform`), never on a playbook code.
A chapter is whatever owner-safe transform exists for an audit on file, so the machinery is
agnostic to which playbook produced it — a new chapter is added by registering a builder for a
new audit source, not by naming a playbook.

**Operator share endpoint — one code per call:**
```
GET /api/admin/marketing-ops/campaigns/:id/prospect-report/share
      ?chapters=website[,…]&tier=free|full&channel=email|text|social|phone|in_person|banner
      [&includePagePlan=true]
→ { channel, code, url: "/r/pr/{code}", pdf_url: "…/{token}/pdf?qr={code}", qr_url: "/r/pr/{code}" }
```
Each call mints **one** signed token for the requested selection + **one** links row for that channel. The panel loops channels for its per-channel buttons. `pdf_url`/`qr_url` reuse the same code (no render-time minting).

**All shareable paths use minted codes.** The token-based `/r/prospect-report/:token/:channel` router from spec §5.2's mapping table is **dropped at v1** — `/api/public/r/pr-scan/:code` + the web `/r/pr/[code]` page already carry the channel on the row, so the token route added nothing but attribution ambiguity. (Deviation from spec §5.2 noted; spec §5.2a's code discipline wins.)

---

## Phase 1 — Data & plumbing foundation

**Goal:** every constant/column the code depends on exists before any logic.

- [ ] `database/migrations/311_mkt_prospect_report_links.sql` — `code` UNIQUE (6-char, same 32-char alphabet as claim codes), `business_prospect_id`, `campaign_id`, `token`, `tier`, `chapters` jsonb, `channel`, `created_by`, `created_at`; indexes on `(business_prospect_id)`, `(campaign_id)` (§5.2a). **No separate index on `code`** — the UNIQUE constraint already indexes it.
- [ ] Apply migration local; `prisma db pull` + `prisma generate`
- [ ] `unifiedConfig` — `PROSPECT_REPORT_TOKEN_SECRET` getter. Existing getters are plain `this.env.X || fallback` (`stripeSecretKey:44`, `encryptionKey:458-460`); **there is no boot-warning mechanism in `unifiedConfig`** — implement the getter with a dev fallback and emit the prod-required warning from `ProspectReportService` init (first use), not from config. Register the var in the env schema if one exists (G-5)
- [ ] `QrAnalyticsService` (api) — `QrSurfaceType` += `prospect_report_phone | prospect_report_email | prospect_report_social | prospect_report_in_person | prospect_report_text | prospect_report_banner`; `SURFACE_LABELS` entries. `prospect_report_banner` is **declared now, consumed when the §5.7 banner lane ships** (spec §5.7). Surface values fit `VARCHAR(30)` (longest `prospect_report_in_person` = 25)
- [ ] `QrAnalyticsService` (web) — same surfaces + labels added to the **separate** web union (`apps/web/src/services/QrAnalyticsService.ts:11,90-108`). Without this, new scans render as raw strings in the admin dashboard
- [ ] Admin QR page — add the new surfaces to the hardcoded `SURFACE_OPTIONS` list (`apps/web/src/app/(platform)/settings/admin/qr-analytics/page.tsx:22-34`)
- [ ] `MarketIntelAccessService.SurfaceType` += `'prospect_report'` — union only; `getAccessTier` special-cases only `'place'`, no exhaustive switch breaks
- [ ] `pnpm checkapi` + `pnpm checkweb` green

**Done when:** migration applied, client regenerated, both typechecks clean, web + api surface registries updated.

## Phase 2 — DTO + website chapter transform (the pure core)

**Goal:** `buildWebsiteChapter(auditData, campaign)` — deterministic, fully unit-tested before any route exists.

- [ ] `apps/api/src/validators/prospect-report-dto.schema.ts` — shell DTO (business name, prepared date, website_url, chapters[], locked_teasers[], data_quality union, cta) + `WebsiteChapterDto` section shapes
- [ ] `ProspectReportService.buildWebsiteChapter` — the §2 field-by-field map:
  - summary verbatim; verdict gloss table `presence × ownership` (§3.2, all 21 cells + fallback)
  - issues sorted `non_negotiable`→`recommended`, severity retitled "costing you customers now" / "worth fixing" (§3.1)
  - `positioning_gaps` met/unmet split (§3.3, **extended**): *met* when `actual === true`, or string-equal (trimmed/lowercase) to `expected`, or **array set-equal** to `expected` (order-insensitive), or **number strictly equal**. Anything else (incl. type mismatch) → unmet. Array/number rows were previously always-unmet — this is the one transform correctness edge; cover each branch with fixtures
  - `build_scope` delivery-mode reframe (§4 — `repair`/`secure_and_refresh` → "a fresh site that keeps everything already working…"), `must_have_pages` behind `includePagePlan` flag
  - `detected_signals` + `outreach_problems` **redacted**; `data_quality` passes with §3.4 internal-line strip (`EVIDENCE COVERAGE`, `DISCOVERY`, `prior_website_findings`, `unable_to_verify` mechanics)
  - empty source → section omitted, never stubbed
- [ ] Register the `website` chapter in `CHAPTER_BUILDERS` (audit source `website_positioning`) per §0.4
- [ ] `ProspectReportService.test.ts` — per-field assertions incl. met/unmet fixtures from the real Raja Bazaar audit JSON (the conformance row `functional_owned_storefront` must land in "already working"; plus one array and one number gap), redaction, strip rules, `must_have_pages` flag on/off
- [ ] `pnpm checkapi` + test green

**Done when:** the chapter builder converts the Raja audit JSON into the full owner-facing structure with zero invented facts.

## Phase 3 — Assembly, tokens, short links

**Goal:** `assembleReport(businessProspectId, allowedChapters, tier, opts)` + token mint/verify + links mint/resolve.

- [ ] `ProspectReportService.assembleReport` — `listSiblings` → per-sibling latest `platform='website_positioning'` audit (ORDER BY created_at DESC LIMIT 1, §9.1) → chapters in signed order; `tier=free` clamps to chapter[0] + emits `locked: true` teaser records (title + finding count only) for withheld chapters (G-4)
- [ ] Token mint/verify per §0.4 — 4-segment payload (incl. `flags`), HMAC-SHA256, length-check then `timingSafeEqual`; tampered payload (incl. flipping `tier` or `flags`) → null
- [ ] Short links — `mintLinkCode(prospectId, campaignId, token, tier, chapters, channel, createdBy)` (6-char, collision-retry, uppercase-normalized on resolve) + `resolveLinkCode(code)`
- [ ] `initializeProspectFromCampaign` call on share when `business_prospect_id` null (G-6)
- [ ] Tests: assembly over 2-sibling fixture (one audit → 1 chapter + locked placeholder), tier clamp, token round-trip + tamper rejection (tier flip, flag flip), code mint/resolve, prospect auto-init
- [ ] `pnpm checkapi` + tests green

## Phase 4 — Routes

**Goal:** operator + public surfaces live.

- [ ] `marketing-ops.ts`: `GET /campaigns/:id/prospect-report` (preview DTO), `GET /campaigns/:id/prospect-report/share` per the §0.4 contract — gate: ≥1 reportable audit else 404 (G-6)
- [ ] `prospect-report-public.ts` (new router): `GET /api/public/marketing/prospect-report/:token` (verify → clamp → assemble → DTO), `GET …/:token/pdf?qr={code}` (Phase 6 stub → 501 until PDF lands; **never mints a row — `?qr=` supplies the code, absent → QR omitted**), `GET /api/public/r/pr-scan/:code` (resolve + `trackQrScanEvent(surface: 'prospect_report_{channel}')` + return `{ url }`) — tenant resolution: linked seed → campaign → `'platform'` fallback (G-1)
- [ ] ~~`prospect-report-qr.ts` token router~~ — **dropped at v1** (§0.4): all shareable paths mint codes; no `/r/prospect-report/:token/:channel`
- [ ] Mount both routers in **`apps/api/src/routes/routeRegistry.ts`** (`{ path: '/api/public', router, domain: 'directory', authLevel: 'public' }` — mirror the `seedReportPublicRoutes`/`seedReportQrRoutes` entries), **not `index.ts`**
- [ ] Route tests: 404s (bad token / unknown code / no audits), tier flip rejected, surface attribution recorded, `/pdf` returns 501 pre-Phase-6
- [ ] `pnpm checkapi` + tests green

## Phase 5 — Web surfaces

**Goal:** operator can preview + mint links; owner can open the report.

- [ ] `MarketingOpsService.getProspectReport` / `getProspectReportShare` (`AdminApiSingleton`)
- [ ] `ProspectReportView.tsx` — pure DTO renderer (header, short-version, chapters, locked-teaser cards, how-it-was-made, footer CTA) shared by panel preview + public page
- [ ] `WebsiteGapBriefingPanel` — "Owner Report" section: recipient-view preview, chapter checkboxes (default = this campaign's chapter), page-plan toggle, per-channel share buttons (one `getProspectReportShare` call each, minting `/r/pr/{code}` links), copy-text + PDF buttons
  - **Scope note:** only website-gap-gated siblings render this section at v1 (the panel is `isWebsiteGapCampaign`-gated and `website` is the only registered chapter). Siblings with no registered chapter for their audit source intentionally show nothing until a builder registers; the "send full diagnostic" widening control is therefore inert at v1
- [ ] `apps/web/src/app/prospect-report/[token]/page.tsx` + client — `ProspectReportPublicService` fetch → `ProspectReportView`; footer CTA → claim URL when seeded (G-2 chain) else ops contact
- [ ] `apps/web/src/app/r/pr/[code]/page.tsx` — resolve+redirect (mirrors `lib/report-qr-redirect.ts`). **Namespace note:** `app/r/[shortCode]` already exists; `app/r/pr/[code]` is a static segment that wins for `/r/pr/*` — verify the interaction in a route test
- [ ] **Locked-chapter CTA (v1):** unlock routes are out of scope and the public page is unauthenticated, so v1 renders the **claim CTA for every locked chapter**; the claimed-owner paid-unlock branch is deferred with OQ-6 plumbing. Pin this in `ProspectReportView` so the test suite asserts it
- [ ] `ProspectReportView.test.ts` — server-render: chapter content present, locked teaser renders as locked card, `detected_signals`/`outreach_problems` strings absent, page-plan on/off
- [ ] `pnpm checkweb` + tests green

## Phase 6 — PDF

**Goal:** `GET …/:token/pdf` serves a branded PDF.

- [ ] `ProspectReportPdfService` — SeedReportPdfService pattern (same `services/intelligence/` location): `loadPlatformBranding` header, section helpers, per-chapter sections, locked teasers as greyed blocks, how-it-was-made footer, embedded `/r/pr/{code}` QR **using the code passed via `?qr=` (minted by the share call), never minted at render**
- [ ] Un-stub the `/pdf` route → `Content-Type: application/pdf`
- [ ] Spot-check: generated PDF on the Raja campaign opens, sections paginate, QR scans to report

## Phase 7 — Live verification + ship

- [ ] On the real website-gap sibling (Raja Bazaar): preview DTO renders → mint email/QR links → open `/r/pr/{code}` → scan recorded with correct surface → `tier=free` shows website chapter only → PDF downloads (QR supplied by share code)
- [ ] Full test suite run (api targeted + `cd apps/api && npx vitest run` on touched areas; web suite)
- [ ] `pnpm checkapi` + `pnpm checkweb` final
- [ ] Migration applied `local`; prod rides the shipped build per deployment SOP
- [ ] Update `AGENTS.md` — prospect-report lane, token/link conventions (**4-segment payload, no-expiry/rotation-invalidates-all property, claim-vs-report code distinction**), api + web QR surface registry (both copies), `routeRegistry.ts` mount convention
- [ ] Commit + push staging → merge main per ship flow

## Explicitly out of scope

- `tier=full` paid unlock routes (`/unlock` + Stripe) — OQ-6 resolved but the plumbing lands when the paid offer ships; `tier` is already in the token so links minted today stay valid. The public page's claimed-owner locked CTA therefore renders the claim CTA at v1 (§ Phase 5)
- §5.7 seed-report banner (OQ-7) + `prospect_report_banner` **consumption** (surface enum is declared now)
- Token-based QR router `/r/prospect-report/:token/:channel` — dropped at v1 in favor of minted codes (§0.4)
- Repair/other chapter builders (OQ-5) — registry exists, website chapter only
- `owner_visibility_report`/`prospect_diagnostic_report` DeliverableType plumbing (§5.5)
- Guest checkout for anonymous payers (G-7 — claim-first is the designed path)
