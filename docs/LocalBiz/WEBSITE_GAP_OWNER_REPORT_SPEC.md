# Website Gap Owner Report — "Free Report" Deliverable Spec

> The `website_positioning` audit already speaks in the owner's language — every issue carries a conversion implication, every evidence line cites provenance, `data_quality` admits what wasn't checked. This spec adds the third layer: a **deterministic transform** from the audit JSON into an owner-facing *Website Visibility Report* — the pitchable "free report" the outreach hook promises. No LLM in the transform: every rendered sentence traces to a schema field, which is what keeps the report honest enough to hand over.

**Status:** Spec only — not started.
**Depends on:** WEBSITE_GAP_AUDIT_PLAYBOOK_SPEC.md §6.2 (audit contract — shipped), `playbook_decision` (migration 309 — shipped), `WebsiteGapBriefingPanel` (shipped).
**Scope:** `apps/api` (transform service, DTO schema, route), `apps/web` (panel preview + copy/print), no migrations.

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

Sibling campaigns (PB-05 repair, PB-08 website-gap) are the same business. The owner never experiences playbooks — they experience "the people who audited my business." Campaign-keyed links would hand them two unrelated artifacts that look like two vendors; prospect-keyed gives one document, one provenance footer, one claim CTA — and the claim is per-*business* anyway.

So the model splits:

- **Transform stays campaign-scoped** — each playbook's audit → a **chapter**. `buildWebsiteChapter(auditData, campaign)` for PB-08 today; a repair chapter builder registers when PB-05 gets an owner-safe transform. Chapters are the primitive.
- **The report is prospect-scoped** — the public URL resolves `business_prospect_id` → all sibling campaigns → whichever chapters have audits on file. A solo campaign is the degenerate one-chapter case.
- **The same URL accumulates.** Share it while only the repair audit exists → one-chapter report. Run the positioning audit next month → the link now shows both chapters. The drip happens by timing, not by minting new artifacts — and an owner who bookmarks it watches evidence accumulate.

### 5.1 Chapter selection — "one or both with a click"

The owner-facing report always shows the chapters the operator *chose at share time* — never silently "everything we have." The chapter set is **encoded in the signed token**, not persisted per-prospect:

```
token = base64url(prospectId + "." + tier + "." + chapterList) + "." + HMAC-SHA256(...)
```

Consequence: each share action mints a self-contained link for exactly that selection — "send website report" and "send full diagnostic" produce two links to the same prospect's report URL shape, differing in what renders. No DB, no publish state, and stripping/editing the chapter list invalidates the signature (the owner can't upgrade their own link).

### 5.1a Free / full tiering — the report as lead-gen gate

When a prospect has **multiple chapters on file**, the report splits into a free artifact and a paid one:

- **`tier=free`** — renders only the first chapter plus a locked-section teaser for each withheld chapter: the chapter title ("Your public profiles — 4 findings inside") and a blurred/locked placeholder, never the content. This is the cold-outreach link.
- **`tier=full`** — renders the entire signed chapter list. Sent after the owner engages (claim, booked call, or paid diagnostic — the unlock mechanism is OQ-6).

Enforcement is server-side: the public route decodes the token, applies the tier clamp *before* chapter assembly, and a `free` token can never serve a `full` body — the tier is inside the HMAC payload, so flipping it invalidates the signature.

Two properties worth stating:

- **Chapter 1 is the pitcher's chapter.** The sibling panel that mints a free link puts its own chapter first — the operator sharing from PB-08 leads with the website story, and the locked repair chapter is the upsell that reads "there's more."
- **Perceived effort is a feature, not a deception.** The report never claims manual production — its authority comes from cited evidence (the £30 banner, the stale widget date), which is *more* credible than a generic hand-written audit. Copy stays honest ("we reviewed your public web presence on {date}"); the depth is what makes it feel bespoke.

Panel UX — **every sibling owns its chapter, defaults to it, can widen:**

- Each sibling campaign that has a reportable audit surfaces the Owner Report section in its panel.
- The chapter checkboxes default to **this campaign's chapter only** — the PB-08 panel defaults to the website chapter; a PB-05 panel (when the repair chapter builder lands) defaults to repair. The report an operator shares from a campaign is that playbook's story unless they deliberately widen it.
- Widening is one click per additional chapter — "send website" and "send full diagnostic" are the same control with different checkboxes, minting different signed links.
- The composite preview always shows what the *recipient* will see for the current selection — not the union of everything on file.

This is the same "operator controls leakage" philosophy as the `must_have_pages` gate, applied at chapter granularity.

### 5.2 Stack mapping

| Seed-report piece | Owner-report analog |
|---|---|
| `seed-report-dto.schema.ts` + `seed-report-lint.ts` | `prospect-report-dto.schema.ts` — DTO is safe-by-construction (deterministic transform, §3.5), so the schema itself is the lint; no separate publish gate |
| `GET /api/public/marketing/seed/:seedId/report{,/pdf,/preview}` | `GET /api/public/marketing/prospect-report/:token` + `…/pdf` — no preview/full split; the DTO is already the public-safe subset by design |
| `SeedReportPdfService` (jsPDF + `loadPlatformBranding`, claim QR embedded) | `ProspectReportPdfService` — same helpers + branding; embeds the delivery/claim QR |
| `seed-report-qr.ts` `/r/seed/:seedId/:channel` | `prospect-report-qr.ts` `/r/prospect-report/:token/:channel` — records `qr_scan_events` under new `prospect_report_*` surfaces (kept outside `report_delivery_*` so seed funnel rates stay clean), 302 → `/prospect-report/{token}` |
| `/r/report-scan/:shortCode` (claim-token short code) | Reused when any sibling campaign has a linked seed — `short_code` → `seed_id` → `campaign.business_prospect_id` → full-chapter report (the seed handshake delivers the *whole* diagnostic — one claim, one report) |
| `/seed-report/[seedId]` public page | `/prospect-report/[token]` public page rendering the shared `ProspectReportView` |
| `SeedReportDeliveryService.recordViewFromScan` | `qr_scan_events` with `productId = business_prospect_id` for v1; dedicated delivery lifecycle deferred (OQ-4) |
| *(paid report unlock — `MarketIntelAccessService` + Stripe `/unlock` on `market-intel-surface-customer.ts`)* | `canAccessFull(customerId, 'playbook_report', businessProspectId)` — new surface type on the **existing** entitlement service; the `tier=free` page's locked-chapter CTA routes here when the owner has claimed, to the claim flow when they haven't (see §5.6) |

### 5.3 Operator API

- `GET /campaigns/:id/prospect-report` → `ProspectReportDto` for the panel preview — assembled over the full sibling set the campaign belongs to.
- `GET /campaigns/:id/prospect-report/share?chapters=website&tier=free` → `{ url, pdf_url, qr_url }` — mints the signed token for the requested chapter set + tier + channel-tagged links.

Gate: campaign belongs to a `business_prospect_id` group (or is itself addressable) and ≥1 sibling holds a reportable audit → else 404. PB-08 positioning audit is the only chapter type at v1; the endpoint is chapter-agnostic from day one.

### 5.4 Web — panel + public page

- **Panel "Owner Report" section** (once a reportable audit exists on any sibling): composite preview, chapter checkboxes (§5.1), per-chapter **include detailed page plan** toggle (default off, §2), **copy link** / **copy text** / **download PDF**, per-channel share links (email / text / print QR).
- **`/prospect-report/[token]` public page** — verifies the signature, applies the tier clamp (§5.1a), assembles the permitted chapters, renders `ProspectReportView`. Footer CTA links the business's claim URL when any sibling is seeded, else the configured ops contact. On `tier=free` the withheld chapters render as locked teasers whose CTA is the unlock path (claim / book a call / paid diagnostic — OQ-6); a free link that resolves to a single-chapter prospect simply renders that chapter, no teaser.

### 5.5 Deliverable plumbing (future, not this spec)

A `prospect_diagnostic_report` DeliverableType could slot this into `DeliverableSectionService`/gallery flows — deliberately deferred; the transform ships first and the plumbing reuses the chapter DTOs.

### 5.6 The offer ladder — where this report sits

The playbook report joins the platform's existing free→paid ladder rather than inventing a new commercial motion:

| Rung | Mechanism | Status |
|---|---|---|
| Free seed claim | `directory_claim_tokens` | existing |
| 5 free product slots | claim-side entitlement | existing |
| Free seed report (with claim) | seed-report public surfaces | existing |
| Paid category report | `MarketIntelAccessService.canAccessFull` + Stripe `/unlock` | existing |
| Paid location report | same access service | existing |
| **Free playbook report** | `tier=free` signed token (§5.1a) | this spec |
| **Paid full playbook report** | `tier=full` + `canAccessFull('playbook_report', businessProspectId)` + Stripe unlock | this spec — new surface type, not new machinery |

The `tier=free` locked-chapter CTA resolves by owner state: **unclaimed → claim flow** (the free ladder rungs do the conversion work); **claimed → paid unlock** (`unlock_required` 402 → Stripe PaymentIntent, the `market-intel-surface-customer.ts` pattern). The paid-full tier is a *self-liquidating* lead-gen artifact — it filters tire-kickers and offsets acquisition cost; the revenue destination remains the playbook engagement itself, so pricing should stay nominal.

## 6. Report structure (rendered order)

The report is a shell + chapters. The shell is prospect-level; each chapter is one playbook's transform.

1. **Header** — "{Business name} — Business Visibility Report · prepared {date} · {website_url}"
2. **The short version** — chapter count = 1: the website chapter's `summary` verbatim. Multi-chapter: a deterministic composite line ("We reviewed your website and your public profiles — here's what we found.") + each chapter's summary as a bullet.
3. **Chapters** — in sibling order (playbook priority). The website chapter (PB-08):
   - **Your website today** — verdict gloss + §3.3 "already working" bullets
   - **What's costing you customers** — tiered issues (§3.1)
   - **What leading {category} businesses do** — `competitive_frame`
   - **The fix** — §4 framing + `scope_notes` (+ `must_have_pages` if toggled)
4. **Locked chapters** — `tier=free` only: one placeholder card per withheld chapter — title + finding count ("Your public profiles — 4 findings inside"), content never rendered, unlock CTA below
5. **How this report was made** — unioned `data_quality` across included chapters (verified / couldn't-check / limitations)
6. **Footer CTA** — claim URL when any sibling is seeded, else configured ops contact

Title note: the header says "Business Visibility Report" rather than "Website Visibility Report" precisely because the document is chapter-composed — a single-chapter delivery still reads correctly under the generic title, and the composite needs it.

## 7. Files touched (implementation plan)

API:
- `apps/api/src/services/ProspectReportService.ts` (new — `assembleReport(prospectId, chapters)` over the sibling set; chapter-builder registry keyed by playbook; website chapter = `buildWebsiteChapter(auditData, campaign)`; token mint/verify per §5.1)
- `apps/api/src/services/ProspectReportPdfService.ts` (new — jsPDF render, `loadPlatformBranding`, delivery/claim QR embed)
- `apps/api/src/validators/prospect-report-dto.schema.ts` (new — shell + chapter DTOs)
- `apps/api/src/routes/marketing-ops.ts` — `GET /:id/prospect-report`, `GET /:id/prospect-report/share?chapters=…`
- `apps/api/src/routes/prospect-report-public.ts` (new — `/api/public/marketing/prospect-report/:token{,/pdf}`)
- `apps/api/src/routes/prospect-report-qr.ts` (new — `/api/public/r/prospect-report/:token/:channel`, scan + 302; short-code resolution via existing claim-token → seed → `business_prospect_id` lookup)
- `apps/api/src/services/QrAnalyticsService.ts` — `QrSurfaceType` += `prospect_report_phone|email|social|in_person|text` + labels
- `apps/api/src/index.ts` — mount the two new routers

Web:
- `apps/web/src/services/MarketingOpsService.ts` — `getProspectReport()`, `getProspectReportShare()`
- `apps/web/src/components/marketing-ops/WebsiteGapBriefingPanel.tsx` — Owner Report section (composite preview + chapter checkboxes + page-plan toggle + share controls)
- `apps/web/src/components/marketing-ops/ProspectReportView.tsx` (new — pure DTO renderer shared by panel preview and the public page)
- `apps/web/src/app/prospect-report/[token]/page.tsx` (new — public report surface)

Tests: `ProspectReportService.test.ts` (per-section mapping incl. met/unmet split, severity retitle, internal-line strip, redaction of `detected_signals`/`outreach_problems`, empty-section omission, token mint/verify round-trip, chapter-selection enforcement — a `website`-only token must not render the repair chapter, `tier=free` clamps to chapter 1 and emits locked teasers for the rest); `ProspectReportView.test.ts` (server-render asserts incl. locked-teaser state); route tests for gate behavior (no prospect group/audit → 404, bad token → 404, chapter not in token → excluded, tier flip → signature invalid).

## 8. Open questions

- **OQ-1 — Delivery.** ~~Open~~ **Resolved (§5):** replicate the seed-report stack — public DTO route + jsPDF + QR redirect + `/prospect-report/[token]` page; prospect-scoped HMAC token carrying the chapter selection, claim-token short code for seeded campaigns.
- **OQ-2 — Branding.** Whose name signs the report (operator agency vs. VisibleShelf) — `loadPlatformBranding` already supplies platform name/logo/colors for the PDF; operator-agency co-branding deferred until first operator feedback.
- **OQ-3 — Stale-evidence dating.** The audit cites a verified-on date; reports generated long after the audit should surface "as of {audit date}" more prominently (or require re-run). Default: always print the audit date in the header; per-chapter dates when chapters diverge in age.
- **OQ-4 — Delivery lifecycle.** `SeedReportDeliveryService` gives the seeded lane a delivered→viewed funnel for free; unseeded prospect reports only record scans. If operators want sent/opened/replied cadence, add a `mkt_report_deliveries`-style table keyed on `business_prospect_id` later.
- **OQ-5 — Chapter registry.** PB-08's website chapter is the only builder at v1. When PB-05 repair gets an owner-safe transform it registers a `repair` chapter builder — the composite + selection machinery already supports it, no route/token changes.
- **OQ-6 — Unlock mechanism.** ~~Open~~ **Resolved (§5.6):** the report joins the existing free→paid ladder — `tier=free` is the offer, `tier=full` the paid offer, gated on `MarketIntelAccessService` (`'playbook_report'` surface type keyed on `business_prospect_id`) + Stripe `/unlock`, the same mechanism as the paid category/location reports. Unclaimed owners' locked CTA routes to the claim flow (claim is still the conversion); claimed owners see the paid unlock.
