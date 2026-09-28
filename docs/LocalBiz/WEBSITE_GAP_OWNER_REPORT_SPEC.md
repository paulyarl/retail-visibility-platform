# Website Gap Owner Report — "Free Report" Deliverable Spec

> The `website_positioning` audit already speaks in the owner's language — every issue carries a conversion implication, every evidence line cites provenance, `data_quality` admits what wasn't checked. This spec adds the third layer: a **deterministic transform** from the audit JSON into an owner-facing *Website Visibility Report* — the pitchable "free report" the outreach hook promises. No LLM in the transform: every rendered sentence traces to a schema field, which is what keeps the report honest enough to hand over.

**Status:** Spec only — not started.
**Depends on:** WEBSITE_GAP_AUDIT_PLAYBOOK_SPEC.md §6.2 (audit contract — shipped), `playbook_decision` (migration 309 — shipped), `WebsiteGapBriefingPanel` (shipped).
**Scope:** `apps/api` (transform service, DTO schema, routes, short-link table), `apps/web` (panel preview + public page). **Migration:** one new table — `mkt_prospect_report_links` (§5.2 short codes).

---

## 1. The three-layer model

| Layer | Artifact | Audience | Produced by |
|---|---|---|---|
| L1 — Evidence | `website_positioning` audit JSON (`mkt_audits_list`) | Machine contract | Analyst (AI run or external import) |
| L2 — Briefing | `WebsiteGapBriefingPanel` + `WebsitePositioningAuditCard` | Operator | React render of L1 |
| L3 — Owner report | **Website Visibility Report** | The prospect/owner | **Pure function over L1** |

L3 is a *transform*, not a render: it remaps field→section, remaps vocabulary (severity codes → owner tiers), redacts internal-only fields, and produces a stable DTO that any surface (web preview, print/PDF, email paste) can render identically.

## 2. Field-by-field mapping (every audit field accounted for)

| Audit field | Owner report section | Transform |
|---|---|---|
| `summary` | §1 "The short version" | Verbatim — already owner-safe prose |
| `presence_classification` | §2 verdict line | Humanized ("a working website you own", "only a third-party page") + one-line gloss per enum value |
| `ownership` | §2 verdict line | Combined with presence into a single verdict sentence |
| `issues[]` | §4 "What's costing you customers" | Reordered `non_negotiable` first, `recommended` second. `issue` → finding headline, `conversion_implication` → "what it costs you" line, `evidence` → "where we saw it" line (kept — provenance is the trust asset) |
| `positioning_gaps[]` | §3 "Already working" **and** §5 "What {category} customers expect" | **Split by met/unmet**: rows where `actual` satisfies `expected` (e.g. `actual: true`, matching string) go to the "already working" list; unmet rows render as expected-vs-actual pairs. This converts the conformance-row noise into a credibility section — the report leads with what's right before what's wrong |
| `build_scope.recommended` | §6 "The fix" | Humanized + reframe: `repair`/`secure_and_refresh` render as "a focused rebuild of the pages that matter" per the delivery-mode decision (§4) — the platform never sells WordPress repair, so the owner-facing noun is always "the new site", not "repairs" |
| `build_scope.scope_notes` | §6 | Verbatim |
| `build_scope.must_have_pages[]` | §6 | **Operator-gated** (§5.2) — default shows the *priority themes* only; full page list behind an "include detailed page plan" toggle (free-spec leakage trade-off) |
| `detected_signals[]` | — | **Redacted.** WC_* codes are internal taxonomy; never owner-facing |
| `competitive_frame[]` | §5 "What leading {category} businesses do" | Verbatim list — already one line per exemplar |
| `outreach_problems[]` | — | **Redacted** (it's the salesperson's ammunition — `hook`/`regular`/`outreach_use` are tactics). Exception: `problem`→`solution` pairs may populate an optional operator-curated "how we'd fix it" annex, opt-in only |
| `data_quality.verified_fields[]` | §7 "What we verified" | Verbatim list, minus internal banner lines (e.g. "EVIDENCE COVERAGE is FULL…" — strip `EVIDENCE COVERAGE` prefix lines; see §3.4) |
| `data_quality.unavailable_fields[]` | §7 "What we couldn't check" | Verbatim — the honesty footer that distinguishes this from SEO-spam audits |
| `data_quality.limitations[]` | §7 footnote | Verbatim |
| (provenance) | Header | Campaign business name + `mkt_audits_list.created_at` as "prepared {date}" + `website_url` |

Nothing else enters. No new facts are generated — if a section has no source rows, it is **omitted**, never stubbed.

## 3. Transform rules

### 3.1 Severity → owner tier

`non_negotiable` → "costing you customers now"; `recommended` → "worth fixing". The internal vocabulary never appears.

### 3.2 Verdict glosses (`presence_classification` × `ownership`)

Fixed string table, e.g.:
- `present` + `owned_domain` → "You have a working website on your own domain — the foundation is solid."
- `third_party_only` → "Customers looking for your website find a page on someone else's platform."
- `no_presence` → "We could not find a website for your business."

Same table shape for all 7×3 combos (with a safe fallback for unusual pairs).

### 3.3 Met/unmet split for `positioning_gaps`

A gap row counts as *met* when `actual` is `true` (boolean expectation) or string-equal to `expected` (string expectation). Met rows → "Already working" bullets (`gap_description` verbatim — it already says "this benchmark requirement is met"). Unmet rows → §5 pairs: "**{field humanized}** — customers expect {expected}; your site shows {actual}. {gap_description}".

### 3.4 Internal-line stripping

`verified_fields` lines prefixed with `EVIDENCE COVERAGE`, `DISCOVERY`, or containing `prior_website_findings`/`unable_to_verify` mechanics are stripped before rendering — lane plumbing is internal. Everything else passes through.

### 3.5 Zero-fact guarantee

The transform is pure: `audit.audit_data` + campaign display fields (name, website_url, category) → DTO. Deterministic output, unit-testable field-by-field, impossible to hallucinate. This is the whole reason it can be handed to an owner.

## 4. Delivery-mode framing (the platform-adaptation decision)

`build_scope.recommended` is *diagnostic* — it describes what the site needs. The platform only delivers **managed replacement** (§"two axes" decision). The report therefore never promises to repair the existing stack:

- `new_build` / `rebuild` → "a new site built for how {category} customers actually shop"
- `repair` / `secure_and_refresh` → "a fresh site that keeps everything already working — ordering, categories, your domain — and fixes what this report found"

The owner reads "replacement that preserves what works", not "we'll patch your WordPress". The operator's `playbook_decision.confirmed_scope` remains the internal record (`diverged_from_audit` = expected signal, not error).

## 5. Surfaces — prospect-keyed composite, replicating the seed-report stack

The seed-report pipeline already owns every piece this needs: a public DTO route, a jsPDF renderer with platform branding, a QR redirect that records scans and writes the delivered→viewed funnel, and a short-code resolution path. The owner report replicates all four — with one deliberate divergence: the public artifact is keyed on **`business_prospect_id`, not `campaign.id`**.

### 5.0 Why prospect-keyed, not campaign-keyed

Sibling campaigns (e.g. a website-gap sibling and a repair sibling) are the same business. The owner never experiences playbooks — they experience "the people who audited my business." Campaign-keyed links would hand them two unrelated artifacts that look like two vendors; prospect-keyed gives one document, one provenance footer, one claim CTA — and the claim is per-*business* anyway.

So the model splits:

- **Transform stays campaign-scoped** — each diagnostic's audit → a **chapter**. `buildWebsiteChapter(auditData, campaign)` is the first registered builder (audit source `website_positioning`); a repair chapter builder registers when a repair audit gains an owner-safe transform. Chapters key on the **audit source**, never on a playbook code — the machinery is agnostic to which playbook produced the audit. Chapters are the primitive.
- **The report is prospect-scoped** — the public URL resolves `business_prospect_id` → all sibling campaigns → whichever chapters have audits on file. A solo campaign is the degenerate one-chapter case (legacy campaigns without a prospect id get one minted on first share via `initializeProspectFromCampaign` — see G-6).
- **Signed chapter list is a permission set, not a snapshot.** A token signed for `website,repair` shows the repair chapter the moment its audit lands — even if the audit didn't exist when the link was minted. The URL accumulates *within its signed scope*; widening beyond it needs a fresh link (one click). See G-3.

### 5.1 Chapter selection — "one or both with a click"

The owner-facing report always shows the chapters the operator *chose at share time* — never silently "everything we have." The chapter set is **encoded in the signed token**, not persisted per-prospect:

```
token = base64url(prospectId + "." + tier + "." + chapterList + "." + flags) + "." + HMAC-SHA256(payload, REPORT_TOKEN_SECRET)
```

`chapterList` is **ordered** — index 0 is the free-visible chapter for `tier=free` (the pitcher's chapter, §5.1a). `flags` is a compact ordered string (reserves room for future render options without a payload-shape break); its only v1 value is `p` = include the detailed page plan (§2), `-` = omit. The page-plan toggle must ride the token because the public route and PDF assemble from the token alone and have no other channel for the operator's choice. Consequence: each share action mints a self-contained link for exactly that selection — "send website report" and "send full diagnostic" produce two links to the same prospect's report URL shape, differing in what renders. No DB, no publish state, and stripping/editing the chapter list, tier, or flags invalidates the signature (the owner can't upgrade their own link or unlock the page plan).

### 5.1a Free / full tiering — the report as lead-gen gate

When a prospect has **multiple chapters on file**, the report splits into a free artifact and a paid one:

- **`tier=free`** — renders only the first chapter plus a locked-section teaser for each withheld chapter: the chapter title ("Your public profiles — 4 findings inside") and a blurred/locked placeholder, never the content. This is the cold-outreach link.
- **`tier=full`** — renders the entire signed chapter list. Sent after the owner engages (claim, booked call, or paid diagnostic — the unlock mechanism is OQ-6).

Enforcement is server-side: the public route decodes the token, applies the tier clamp *before* chapter assembly, and a `free` token can never serve a `full` body — the tier is inside the HMAC payload, so flipping it invalidates the signature.

Two properties worth stating:

- **Chapter 1 is the pitcher's chapter.** The sibling panel that mints a free link puts its own chapter first — the operator sharing from a website-gap sibling leads with the website story, and the locked repair chapter is the upsell that reads "there's more."
- **Perceived effort is a feature, not a deception.** The report never claims manual production — its authority comes from cited evidence (the £30 banner, the stale widget date), which is *more* credible than a generic hand-written audit. Copy stays honest ("we reviewed your public web presence on {date}"); the depth is what makes it feel bespoke.

Panel UX — **every sibling owns its chapter, defaults to it, can widen:**

- Each sibling campaign that has a reportable audit surfaces the Owner Report section in its panel.
- The chapter checkboxes default to **this campaign's chapter only** — the website-gap panel defaults to the website chapter; a repair panel (when the repair chapter builder lands) defaults to repair. The report an operator shares from a campaign is that diagnostic's story unless they deliberately widen it.
- Widening is one click per additional chapter — "send website" and "send full diagnostic" are the same control with different checkboxes, minting different signed links.
- The composite preview always shows what the *recipient* will see for the current selection — not the union of everything on file.

This is the same "operator controls leakage" philosophy as the `must_have_pages` gate, applied at chapter granularity.

### 5.2 Stack mapping

| Seed-report piece | Owner-report analog |
|---|---|
| `seed-report-dto.schema.ts` + `seed-report-lint.ts` | `prospect-report-dto.schema.ts` — DTO is safe-by-construction (deterministic transform, §3.5), so the schema itself is the lint; no separate publish gate |
| `GET /api/public/marketing/seed/:seedId/report{,/pdf,/preview}` | `GET /api/public/marketing/prospect-report/:token` + `…/pdf` — no preview/full split; the DTO is already the public-safe subset by design |
| `SeedReportPdfService` (jsPDF + `loadPlatformBranding`, claim QR embedded) | `ProspectReportPdfService` — same helpers + branding; embeds the delivery/claim QR |
| `seed-report-qr.ts` `/r/seed/:seedId/:channel` | **Dropped at v1** — every shareable path mints a code (§5.2a); `/r/pr-scan/:code` records `qr_scan_events` under the new `prospect_report_*` surfaces (kept outside `report_delivery_*` so seed funnel rates stay clean) and the `/r/pr/[code]` page 302s → `/prospect-report/{token}`. No token-in-path QR route (the code row already carries the channel — a token route would only add attribution ambiguity) |
| `/r/report-scan/:shortCode` (claim-token short code) | **Pattern replicated, not reused** — `mkt_prospect_report_links` issues the report's own 6-char codes (`/r/pr/{code}`). Claim codes stay claim-only: a report click must never register as a claim/seed-delivery scan (false attribution). See §5.2a |
| `/seed-report/[seedId]` public page | `/prospect-report/[token]` public page rendering the shared `ProspectReportView` |
| `SeedReportDeliveryService.recordViewFromScan` | `qr_scan_events` with `productId = business_prospect_id` for v1; dedicated delivery lifecycle deferred (OQ-4) |
| *(paid report unlock — `MarketIntelAccessService` + Stripe `/unlock` on `market-intel-surface-customer.ts`)* | `canAccessFull(customerId, 'prospect_report', businessProspectId)` — new surface type on the **existing** entitlement service; the `tier=free` page's locked-chapter CTA routes here when the owner has claimed, to the claim flow when they haven't (see §5.6) |

### 5.2a Short links — `mkt_prospect_report_links` (pattern replicated, NOT reused)

Every shareable path is trackable — but a report click must never register as a claim or seed-delivery scan (false attribution). The claim short-code *mechanics* are replicated as the report's own namespace:

```
mkt_prospect_report_links {
  id, code (6-char unique — same alphabet as claim short_codes),
  business_prospect_id, campaign_id,   -- minted-from context
  token,                                -- the signed §5.1 token
  tier, chapters jsonb, channel,        -- denormalized for analytics
  created_by, created_at
}
```

- **One code per share action.** "Copy link for email" and "print QR" mint *different* codes — the channel lives on the row, so `/r/pr/{code}` needs no channel param and the scan records the correct `prospect_report_{channel}` surface directly. Per-link analytics come free: which share, which channel, which campaign minted it.
- **Resolution**: `/api/public/r/pr-scan/:code` → look up → `trackQrScanEvent(surface: 'prospect_report_{channel}', productId: business_prospect_id)` → return `{ url: '/prospect-report/{token}' }` → the web short-URL page (`/r/pr/[code]`) 302s there. Mirrors the `/r/report-scan/:shortCode` resolve+track architecture one-for-one — but the namespace, table, and surfaces are the report's own.
- **Claim short codes stay claim-only.** A seeded prospect's claim code keeps resolving to the seed report + claim flow; its report code is a separate minted artifact. Same prospect, two codes, two clean funnels — never conflated.
- **Banner lane uses it too** (§5.7): the claimed-owner banner link is a minted code with `channel='banner'` → `prospect_report_banner` surface on click — uniform tracking across push and pull surfaces.
- **Revocation becomes trivial** — deleting a code row kills that link while the underlying HMAC token remains valid for other codes.

### 5.3 Operator API

- `GET /campaigns/:id/prospect-report` → `ProspectReportDto` for the panel preview — assembled over the full sibling set the campaign belongs to.
- `GET /campaigns/:id/prospect-report/share?chapters=website&tier=free&channel=email[&includePagePlan=true]` → `{ channel, code, url, pdf_url, qr_url }` — **one call per channel, one code per call** (§5.2a): mints the signed token for the requested chapter set + tier and a single `mkt_prospect_report_links` row for that channel, so `url` is the short `/r/pr/{code}` form and `pdf_url`/`qr_url` reuse the same code (no render-time minting). The panel loops channels for its per-channel share buttons.

Gate: campaign belongs to a `business_prospect_id` group (or is itself addressable) and ≥1 sibling holds a reportable audit → else 404. The website-positioning audit is the only chapter source at v1; the endpoint is chapter-agnostic from day one.

### 5.4 Web — panel + public page

- **Panel "Owner Report" section** (once a reportable audit exists on any sibling): composite preview, chapter checkboxes (§5.1), per-chapter **include detailed page plan** toggle (default off, §2), **copy link** / **copy text** / **download PDF**, per-channel share links (email / text / print QR).
- **`/prospect-report/[token]` public page** — verifies the signature, applies the tier clamp (§5.1a), assembles the permitted chapters, renders `ProspectReportView`. Footer CTA links the business's claim URL when any sibling is seeded, else the configured ops contact. On `tier=free` the withheld chapters render as locked teasers whose CTA is the unlock path (claim / book a call / paid diagnostic — OQ-6); a free link that resolves to a single-chapter prospect simply renders that chapter, no teaser.

### 5.5 Deliverable plumbing (future, not this spec)

A `prospect_diagnostic_report` DeliverableType could slot this into `DeliverableSectionService`/gallery flows — deliberately deferred; the transform ships first and the plumbing reuses the chapter DTOs.

### 5.7 Deferred: pull-surface banner on the seed report page

v1 is **operator-pitch only** — the prospect learns the report exists when an operator hands them a signed link (the `prospect_report_*` QR channels: email / text / phone / social / in-person card). There is deliberately no organic discovery lane at v1: token-gating means only people an operator sent the link can see it.

The follow-up pull surface, when wanted: a **banner card on `/seed-report/[seedId]`** that resolves seed → `directory_seed_campaign_links(role='primary')` → `business_prospect_id` → any reportable audit → links to `/prospect-report/{token}` (token minted server-side at render — the seed page itself becomes a share). Design constraints:

- **Claimed-owner-only**, not public — the seed report URL is already a capability URL; an open banner would expose the report's existence to anyone forwarded the seed link (competitors, curious strangers). Gating the banner to the claimed owner's authenticated session preserves the operator-control property while still catching prospects who claimed without ever hearing a pitch — the exact funnel hole §5.6's claim-first ordering creates.
- **New QR surface** `prospect_report_banner` — same reasoning as `report_banner` in the seed-report QR spec: banner clicks aren't operator deliveries and must not inflate the delivered→viewed funnel.
- **Renders as a `tier=free` link** — the banner mints the free tier (chapter 1 + locked teasers), feeding the same claim→paid unlock CTA as operator-sent links.
- **Banner copy must preempt the "didn't you already send me a report?" question** — the seed report is the listing/identity artifact; the visibility report is the diagnosis + offer. Copy pattern: *"Your listing is claimed — we also looked at your website specifically. Here's what works, what's costing you customers, and what we can build for you."* See §6a.
- **Banner link is a minted code** with `channel='banner'` (§5.2a) — the click resolves through `/r/pr-scan/:code` → `prospect_report_banner` surface → report, same tracking discipline as operator-sent codes.

Non-goal for this lane: a "diagnostic available" badge on the public `/place` listing — that surfaces audit existence to *everyone*, including competitors. Claimed-owner-only is the ceiling for pull surfaces.

### 5.5a Placement decision — operator surface on the campaign, banner on the seed page

Two different surfaces for two different audiences:

- **Operator-facing: the campaign, not the seed.** The Owner Report section lives in each sibling campaign's panel (WebsiteGapBriefingPanel today; the repair panel when its chapter builder lands). Campaigns are self-aware — each one knows its own diagnosis, its own audit, its own default chapter. Seeds are *not* sibling-aware (`directory_presence_seeds` links to campaigns via `directory_seed_campaign_links`, but a seed row carries no knowledge of the campaign family), so putting the control on the seed page would force sibling resolution onto a surface that has none. The campaign is the natural home.
- **Prospect-facing pull surface: the seed report page** (§5.7) — the one owner-visible page the platform already has. The banner is where the prospect *discovers* the report exists without an operator pitching it.

### 5.6 The offer ladder — where this report sits

The prospect report joins the platform's existing free→paid ladder rather than inventing a new commercial motion:

| Rung | Mechanism | Status |
|---|---|---|
| Free seed claim | `directory_claim_tokens` | existing |
| 5 free product slots | claim-side entitlement | existing |
| Free seed report (with claim) | seed-report public surfaces | existing |
| Paid category report | `MarketIntelAccessService.canAccessFull` + Stripe `/unlock` | existing |
| Paid location report | same access service | existing |
| **Free prospect report** | `tier=free` signed token (§5.1a) | this spec |
| **Paid full prospect report** | `tier=full` + `canAccessFull('prospect_report', businessProspectId)` + Stripe unlock | this spec — new surface type, not new machinery |

The `tier=free` locked-chapter CTA resolves by owner state: **unclaimed → claim flow** (the free ladder rungs do the conversion work); **claimed → paid unlock** (`unlock_required` 402 → Stripe PaymentIntent, the `market-intel-surface-customer.ts` pattern). The paid-full tier is a *self-liquidating* lead-gen artifact — it filters tire-kickers and offsets acquisition cost; the revenue destination remains the engagement itself, so pricing should stay nominal.

## 6. Report structure (rendered order)

The report is a shell + chapters. The shell is prospect-level; each chapter is one diagnostic's transform.

1. **Header** — "{Business name} — Business Visibility Report · prepared {date} · {website_url}"
2. **The short version** — chapter count = 1: the website chapter's `summary` verbatim. Multi-chapter: a deterministic composite line ("We reviewed your website and your public profiles — here's what we found.") + each chapter's summary as a bullet.
3. **Chapters** — in sibling order (diagnostic priority). The website chapter:
   - **Your website today** — verdict gloss + §3.3 "already working" bullets
   - **What's costing you customers** — tiered issues (§3.1)
   - **What leading {category} businesses do** — `competitive_frame`
   - **The fix** — §4 framing + `scope_notes` (+ `must_have_pages` if toggled)
4. **Locked chapters** — `tier=free` only: one placeholder card per withheld chapter — title + finding count ("Your public profiles — 4 findings inside"), content never rendered, unlock CTA below
5. **How this report was made** — unioned `data_quality` across included chapters (verified / couldn't-check / limitations)
6. **Footer CTA** — claim URL when any sibling is seeded, else configured ops contact

Title note: the header says "Business Visibility Report" rather than "Website Visibility Report" precisely because the document is chapter-composed — a single-chapter delivery still reads correctly under the generic title, and the composite needs it.

### 6a. Relationship to the Seed Intelligence Report — owner-facing framing

A seeded prospect may receive **both** artifacts — the Seed Intelligence Report (identity/claim artifact) and this Business Visibility Report (diagnosis/offer artifact). When a prospect asks "didn't you already send me a report?", the answer is:

> "The first report showed what the internet already says about your business — that record is yours to claim, free. This report is different: it's our assessment of your website specifically — what works, what's quietly costing you customers, and what a fix looks like. **And if you'd like, we can do the fix — that's the work we do.**"

Rules this implies:

- **Cross-reference, never collision.** The seed report's claim CTA and this report's footer CTA coexist; neither pretends the other doesn't exist. When a prospect has both, the visibility report's "How this report was made" may reference the claimed listing as a data source (provenance asset, not pitch).
- **The distinction is a pitch beat, not an apology.** The listing report says "here's what exists"; this report says "here's what we found and **what we can do about it**." The offer closes the sentence — every owner-facing explanation of the difference ends on the engagement, not the taxonomy.
- **The same one-liner belongs everywhere the two surfaces meet** — §5.7 banner copy, the operator's follow-up scripts, and the footer CTA context line.

## 7. Files touched (implementation plan)

API:
- `database/migrations/3XX_mkt_prospect_report_links.sql` (new — §5.2a table: `code` unique 6-char, `token`, `tier`, `chapters`, `channel`, `business_prospect_id`, `campaign_id`, `created_by`)
- `apps/api/src/services/ProspectReportService.ts` (new — `assembleReport(prospectId, chapters)` over the sibling set; chapter-builder registry keyed by audit source; website chapter = `buildWebsiteChapter(auditData, campaign)`; token mint/verify per §5.1; short-code mint/resolve per §5.2a)
- `apps/api/src/services/ProspectReportPdfService.ts` (new — jsPDF render, `loadPlatformBranding`, delivery/claim QR embed)
- `apps/api/src/validators/prospect-report-dto.schema.ts` (new — shell + chapter DTOs)
- `apps/api/src/routes/marketing-ops.ts` — `GET /:id/prospect-report`, `GET /:id/prospect-report/share?chapters=…` (mints a links row per channel)
- `apps/api/src/routes/prospect-report-public.ts` (new — `/api/public/marketing/prospect-report/:token{,/pdf}` + `/api/public/r/pr-scan/:code` resolve+track)
- ~~`apps/api/src/routes/prospect-report-qr.ts`~~ — **dropped at v1**; all shareable paths mint codes (§5.2a), resolved via `/api/public/r/pr-scan/:code`
- `apps/api/src/services/QrAnalyticsService.ts` — `QrSurfaceType` += `prospect_report_phone|email|social|in_person|text` + labels
- `apps/api/src/services/MarketIntelAccessService.ts` — `SurfaceType` += `'prospect_report'` (free-form column, no migration)
- `apps/api/src/config/unifiedConfig.ts` — `PROSPECT_REPORT_TOKEN_SECRET` getter (G-5)
- `apps/api/src/index.ts` — mount the two new routers

Web:
- `apps/web/src/services/MarketingOpsService.ts` — `getProspectReport()`, `getProspectReportShare()`
- `apps/web/src/components/marketing-ops/WebsiteGapBriefingPanel.tsx` — Owner Report section (composite preview + chapter checkboxes + page-plan toggle + share controls)
- `apps/web/src/components/marketing-ops/ProspectReportView.tsx` (new — pure DTO renderer shared by panel preview and the public page)
- `apps/web/src/app/prospect-report/[token]/page.tsx` (new — public report surface)
- `apps/web/src/app/r/pr/[code]/page.tsx` (new — short-URL redirect page: calls `/api/public/r/pr-scan/:code`, 302s to returned `/prospect-report/{token}` — mirrors the `/r/{shortCode}` claim-code page pattern)

Deferred (§5.7, not in v1 files): banner card on `apps/web/src/app/seed-report/[seedId]/SeedReportClient.tsx` (claimed-owner gate) + `prospect_report_banner` QR surface.

Tests: `ProspectReportService.test.ts` (per-section mapping incl. met/unmet split, severity retitle, internal-line strip, redaction of `detected_signals`/`outreach_problems`, empty-section omission, token mint/verify round-trip, chapter-selection enforcement — a `website`-only token must not render the repair chapter, `tier=free` clamps to chapter 1 and emits locked teasers for the rest); `ProspectReportView.test.ts` (server-render asserts incl. locked-teaser state); route tests for gate behavior (no prospect group/audit → 404, bad token → 404, chapter not in token → excluded, tier flip → signature invalid).

## 8. Open questions

- **OQ-1 — Delivery.** ~~Open~~ **Resolved (§5):** replicate the seed-report stack — public DTO route + jsPDF + QR redirect + `/prospect-report/[token]` page; prospect-scoped HMAC token carrying the chapter selection, claim-token short code for seeded campaigns.
- **OQ-2 — Branding.** Whose name signs the report (operator agency vs. VisibleShelf) — `loadPlatformBranding` already supplies platform name/logo/colors for the PDF; operator-agency co-branding deferred until first operator feedback.
- **OQ-3 — Stale-evidence dating.** The audit cites a verified-on date; reports generated long after the audit should surface "as of {audit date}" more prominently (or require re-run). Default: always print the audit date in the header; per-chapter dates when chapters diverge in age.
- **OQ-4 — Delivery lifecycle.** `SeedReportDeliveryService` gives the seeded lane a delivered→viewed funnel for free; unseeded prospect reports only record scans. If operators want sent/opened/replied cadence, add a `mkt_report_deliveries`-style table keyed on `business_prospect_id` later.
- **OQ-5 — Chapter registry.** The website chapter is the only builder at v1. When a repair audit gains an owner-safe transform it registers a `repair` chapter builder — the composite + selection machinery already supports it, no route/token changes.
- **OQ-7 — Pull-surface banner.** ~~Open~~ **Deferred, spec'd (§5.7):** claimed-owner-only banner on `/seed-report/[seedId]`, minting a `tier=free` link. v1 ships operator-pitch channels only.
- **OQ-6 — Unlock mechanism.** ~~Open~~ **Resolved (§5.6):** the report joins the existing free→paid ladder — `tier=free` is the offer, `tier=full` the paid offer, gated on `MarketIntelAccessService` (`'prospect_report'` surface type keyed on `business_prospect_id`) + Stripe `/unlock`, the same mechanism as the paid category/location reports. Unclaimed owners' locked CTA routes to the claim flow (claim is still the conversion); claimed owners see the paid unlock.

---

## 9. Gap sweep — findings & resolutions

Pre-implementation sweep of every surface the owner report touches. Verified-clean assumptions first, then the real gaps.

### 9.1 Verified clean

- **Prospect plumbing exists.** `BusinessProspectService.listSiblings(businessProspectId)` returns the full sibling set; `initializeProspectFromCampaign` mints a `business_prospect_id` + marks `is_primary_sibling` for legacy campaigns lacking one. The "campaign without a prospect" edge collapses to: call initialize on first share.
- **`qr_scan_events` is free-form.** `surface VARCHAR(30)` — longest new value `prospect_report_in_person` is 25 chars, fits. `product_id VARCHAR(255)` takes the prospect id. No CHECK constraints.
- **`market_intel_unlocks` is free-form.** `surface_type`/`unlock_type` are unbounded `String` — `'prospect_report'` extends the TS union only; no migration. The `@@unique([tenant_id, surface_type, surface_key, unlock_type])` constraint is satisfied by the prospect key.
- **Stripe unlock precedent is complete.** `market-intel-surface-customer.ts` shows the whole flow: `canAccessFull` gate → `createOneTimePaymentIntent` → `/unlock/confirm` → `recordUnlock` + `recordMarketingRevenue(source: 'market_intel_unlock')`. Reuse verbatim with a `prospect_report_unlock` source string.
- **Claim→identity chain exists.** `DirectoryClaimService` sets `campaign.customer_id` and `promoteCustomerToUser` creates the `user_tenants` OWNER row — a claimed owner satisfies `resolveTenantForPurchase`, so the paid unlock is genuinely reachable post-claim.
- **PDF primitives exist.** jsPDF + `qrcode` (toBuffer→data-uri) + `loadPlatformBranding` (operator_name/logo/color from `mkt_branding_config` — partially resolves OQ-2: the report can sign the operator name today).
- **Public page precedent.** `/seed-report/[seedId]` is already an unauthenticated report surface (`PublicApiSingleton` client pattern); `/prospect-report/[token]` mirrors it.
- **Audit retrieval is scoped correctly.** `mkt_audits_list(campaign_id, platform)` indexed on both; chapters query per-sibling `platform='website_positioning'` (and future types) — the same-column multi-audit accumulation (reruns append rows) means the builder must take **latest** (`ORDER BY created_at DESC LIMIT 1`), matching how the briefing panel picks `audits.find(platform)` over a latest-first list.

### 9.2 G-1: `qr_scan_events.tenant_id` is NOT NULL with a tenant FK

`trackQrScanEvent` requires a real tenant. The seed-report route resolves `directory_presence_seeds.tenant_id` with a `'platform'` fallback (a `platform` tenant row must exist for the insert to land — the seed flow relies on it). Prospect-report scans resolve: linked seed's `tenant_id` first, else the primary campaign's `tenant_id` (nullable → `'platform'` fallback). **No new machinery — replicate the fallback pattern exactly.**

### 9.3 G-2: Claim-token short codes must NOT be reused for the report — false attribution

`directory_claim_tokens.short_code` resolves to a **seed** and routes through the claim/seed-report scan surfaces. Reusing it for the prospect report would record report clicks against the claim/seed-delivery funnel — the exact contamination the `report_banner`-outside-`report_delivery_*` convention exists to prevent. **Resolution (§5.2a): replicate the pattern as a separate namespace** — `mkt_prospect_report_links` issues the report's own 6-char codes resolved via `/r/pr-scan/:code`, recording `prospect_report_*` surfaces. Same mechanics, clean attribution. Seeded and unseeded prospects use the same code table — uniformity, not reuse.

### 9.4 G-3: Signed chapter list vs. "URL accumulates" — reconciled in §5.0

The token's `chapterList` is a **permission scope**, not a snapshot of what exists at mint time. A token signed for `website,repair` renders the repair chapter whenever its audit lands — so a full-diagnostic link minted early accumulates correctly. A `website`-only token never grows (operator intent: this recipient only sees the website story). The §5.0 accumulation claim is therefore true *within the signed scope* — which is the correct semantics, since unbounded accumulation would let a shared link silently disclose later audits the operator never chose to share.

### 9.5 G-4: `tier=free` on a single-chapter prospect leaks the whole report — by design, but state it

With one chapter on file, free == full for content. The locked-teaser section only materializes when a withheld chapter exists in the signed list. This is intentional (chapter 1 is the free rung) but the DTO must still carry `locked: true` metadata on withheld chapters so `ProspectReportView` renders teasers rather than omitting them — the teaser IS the upsell surface.

### 9.6 G-5: `REPORT_TOKEN_SECRET` doesn't exist in unifiedConfig

No generic HMAC signing secret exists today (all token flows are DB-backed claim tokens). Add a `PROSPECT_REPORT_TOKEN_SECRET` getter to `unifiedConfig` (env var, required in production, dev-fallback to a fixed string with a boot-time warning — matching how other optional secrets degrade). Rotating it invalidates all issued links — acceptable, links are cheap to re-mint.

### 9.7 G-6: Operator API gate — "is itself addressable" was hand-wavy

Resolved concretely: `GET /:id/prospect-report/share` calls `initializeProspectFromCampaign` when `business_prospect_id` is null (idempotent — returns existing), then `listSiblings` → collect reportable audits → 404 only if zero chapters can be built. No campaign is ever "unaddressable"; every campaign is a prospect group of ≥1.

### 9.8 G-7: The paid unlock needs a customer identity — anonymous payers can't exist

`market_intel_unlocks.customer_id` and `tenant_id` are both NOT NULL FKs; the entire access service is keyed on authenticated customers. An unclaimed owner on a public report page **cannot** pay — they have no customer row. This confirms (rather than constrains) §5.6's resolution: unclaimed CTA → claim flow (which creates customer + tenant via `promoteCustomerToUser`), claimed CTA → `/unlock`. **Corollary: the paid-full-report rung is only reachable post-claim.** If a pre-claim paid path is ever wanted, it needs a guest-checkout lane — explicitly out of scope (OQ-6 stayed resolved because the claim-first ordering IS the designed funnel).

### 9.9 G-8: `mkt_branding_config` already carries operator identity

`loadPlatformBranding` reads `operator_name`/`operator_logo_url`/`primary_color` — the same table the receipt PDF uses. OQ-2 is partially resolved at the platform level: the report signs the operator brand today. Per-campaign co-branding stays deferred.

### 9.10 G-9: Express `:token` param charset

`base64url` + `.` separators are safe in an Express path param (dots don't break segment matching). Verify at route-test time — if a URL-safe variant is ever needed, `~` separators or a single-segment `payload.sig` works identically. Low risk, noted for completeness.
