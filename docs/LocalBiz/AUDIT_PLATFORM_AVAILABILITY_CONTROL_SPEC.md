# Business Audit — Platform Availability Verification (Render Control) — Spec

> The audit cannot currently distinguish "this business is not discoverable on Google" from "the analyst could not render Google." Both produce `unable_to_verify`, both emit no signal, and both score zero. This spec adds a render control — the gold standard's profiles — so an unrendered platform becomes attributable evidence instead of an unscored gap.

**Status:** Not started — spec only
**Owner:** TBD
**Scope:** `apps/api` audit seed template + business-analysis schema + audit card

---

## 1. Overview

### 1.1 Problem

The Business Audit V2 contract forbids converting an inability to verify into a failure:

> `Absence vs. Non-Negotiable — A non_negotiable quality gate or expected field is recorded as failed (passed: false) ONLY when the field is verified absent. When a field cannot be verified (not found during searched discovery paths), record passed: null and note "not verified" — do NOT convert inability to verify into a failure.`

That rule is correct in isolation, and it is also the reason a failed audit run can produce almost nothing. When Google, Yelp, and BBB do not render, the audit is left with:

- no profile status → no `DS_CLAIMED_STATUS`
- no verified absence → no `DS_MISSING_PROFILE`
- no review data → no `RA_*` signals
- no ratings → no Misalignment Index, `action_classification` defaults to `BALANCED_HEALTHY`
- `google_profile_maintenance` = 0, because the rubric assigns 0 "when the profile appears maintained **or status is unavailable**"

So unverifiability is scored as health, and the more surfaces that fail, the lower the score, the lower the tier, the lower the fee. The businesses with the thinnest real footprint produce the least actionable audits — exactly inverted from the intent.

The discovery side already contradicts the audit for the same business: an emerging scan emitted `INT_LOW_VISIBILITY`, `INT_WEAK_MAINSTREAM_INDEXING`, and `INT_POSSIBLE_CATEGORY_MISALIGNMENT`, while the audit emitted one signal (`DS_OUTDATED_HOURS`) and classified the business `BALANCED_HEALTHY`.

### 1.2 Why the naive fix fails

The obvious fix — "if it cannot render, treat it as missing" — is wrong, because "cannot render" has several causes with opposite implications:

| Cause | Meaning | Correct treatment |
|---|---|---|
| Business has no profile | Real invisibility | Signal |
| Profile exists but is stale, unclaimed, or broken | Real invisibility | Signal |
| Platform blocks the analyst (JS-gating, bot defense, login wall, rate limit) | Analyst tooling limitation | No signal |

The third cause dominates. Google Maps does not render to a plain fetch. Under a cause-agnostic rule, `DS_MISSING_PROFILE` fires for Google on **every audit**, `google_profile_maintenance` becomes a constant 2, and the score stops discriminating between businesses. The signal carries no information.

### 1.3 Solution

Establish a **control set** and make the render outcome relative rather than absolute.

The Gold Standard block already ships control businesses — same category, known-present, with per-platform destination URLs. If a control profile renders on a platform and the audited business's profile does not, the failure is attributable to the business. If the control also fails, the failure is attributable to the platform or the analyst.

The rule is then mechanical and auditable:

> Signal only when the control rendered on that platform AND the business did not.

### 1.4 Design principles

- **Mirror the existing pattern.** The Website Accessibility Verification directive already does this for the business's own website. The new directive should read as its platform-scoped sibling.
- **Relative, not absolute.** A render outcome is meaningless without a control. Never emit an availability signal from a bare failure.
- **Fail safe.** No control, or a failed control, resolves to `unable_to_verify` with no signal — the current behaviour. The control can only *add* attributable evidence, never subtract. **Exception:** the scoring amendments in §6 are explicitly subtractive where noted (§6.1 excludes `unable_to_verify` from the denominator instead of scoring it 0; §6.3 allows `action_classification: null` instead of defaulting to `BALANCED_HEALTHY`; §6.4 suppresses `recommended_tier` below a coverage threshold). These changes alter today's output for unverifiable cases and are gated on the control mechanism shipping first — they are listed separately so the additive control can ship independently if the scoring redesign needs more iteration.
- **Recorded, not inferred.** Control attempts must be written to the output so the comparison is auditable. An unrecorded comparison is unfalsifiable.
- **Visibility language, not quality language.** The finding is "not discoverable on this platform." It is not a claim about the business's quality, and it must not drift into one.

---

## 2. The existing pattern (website accessibility)

`seed-business-audit-v2-templates.ts` defines `WEBSITE_ACCESSIBILITY_VERIFICATION_DIRECTIVE` and inserts it at the end of the Website Assessment section via `insertAfter` with fingerprint idempotency. Its core moves, which the new directive should replicate:

1. **Attempt the load before asserting anything.** "A search-result snippet, indexed page preview, or directory listing that displays a URL is NOT proof that the website loads; the URL itself must be visited."
2. **Name the business value.** "Website condition is a high-value opportunity target for this platform: a missing or unusable website is a gap the platform can confidently fill."
3. **Gate the positive fields.** Positive attributes are recorded only at the appropriate verification state.
4. **Record the mechanics.** Requested URL, final URL, access barrier, errors — routed into the existing `website.issues` **string array**, explicitly "no schema change."
5. **Gate the signal.** `WC_BROKEN_WEBSITE` fires only when the public visitor path is verified inaccessible — not for `unable_to_verify`.

### 2.1 Why the website case is unambiguous

For the business's own website, **the analyst's access path and the customer's access path are the same**: load a URL in a browser. Friction transfers, so analyst friction genuinely is customer friction, and treating it as a finding is sound.

For third-party platforms the paths diverge — the customer has a session, a device, a geolocation, and often a native app. That is precisely why the platform case needs a control and the website case does not.

---

## 3. The control mechanism

### 3.1 Control set

**Primary: gold standard pattern exemplars.** The Gold Standard block is serialized by `IntelligenceProfileService.serializeGoldStandard(profile, 'discovery_benchmark')` and appended to the prompt. Each exemplar carries per-platform destination URLs — Google Maps search URLs, Apple place-ids, Bing `q=` URLs, Yelp biz URLs, Facebook page URLs, BBB profile URLs.

**Not viable: local competitive benchmarks.** An earlier draft of this idea proposed pairing the gold standard exemplars (cross-market) with the audit's own `competitive_benchmarks` (same-market) to control for geography. That does not work: `competitive_benchmarks` is an **audit output**, produced after platform evaluation, so it is not available at prompt-render time. Controls must exist in the prompt.

**Residual geography confound.** Gold standard exemplars are typically cross-market (the African Grocery Store profile carried exemplars from Randolph MA, Chicago, Celina TX, Hyattsville MD, Tempe AZ, Columbus OH, and Boston). Platform serving can vary by region, so a Chicago profile rendering does not perfectly control for a Fort Wayne profile failing. Where a market-scoped gold standard is available, prefer it. Where it is not, the conservative fallback in §3.3 applies: a failed control yields `unable_to_verify`, so the confound costs coverage rather than accuracy.

**Exemplar URL may be absent (B5).** `IntelligenceProfileService.serializeGoldStandard` emits a `Destination URL:` line for a platform evaluation only when `pe.profile_url` is set (line 2169). A gold-standard candidate flagged `is_gold_standard` on a platform may have no `profile_url` captured — in that case the exemplar exists on the platform but carries no URL to attempt. Treat this identically to "no control for this platform" (§3.2 row 4): resolve to `unable_to_verify` with no signal, and note the missing control URL in `data_quality.limitations` as `"control exemplar for {platform} has no destination URL"`. This is distinct from §9.2 (platform absent from the gold standard's platform list) — here the platform IS named but the URL is missing.

**Self-exemplar collision (D1).** The existing `GOLD_STANDARD_BINDING` already instructs: "If the audited business appears in the benchmark's Pattern Exemplars section, treat those exemplar notes as reference priors only (not as a self-comparison)." The control mechanism must respect this: if the only gold-standard exemplar on a platform IS the audited business itself, the control URL and the business URL are the same, so `business_specific_failure` can never fire (the control and business render or fail together). Exclude self-exemplars from the control set — skip any exemplar whose `business_name` matches the audited business's name (case-insensitive). If excluding the self-exemplar leaves no remaining exemplar on that platform, resolve to `unable_to_verify` per §3.2 row 4.

**Empty platform slot (D2).** A gold standard profile may name a platform in its expected fields but have no candidate flagged `is_gold_standard` on that platform. `serializeGoldStandard` emits no exemplar and no URL for that platform. This is distinct from §3.3 (the entire Gold Standard block is absent) — here the block is present but the platform slot is empty. Resolve to `unable_to_verify` with no signal, and note in `data_quality.limitations` as `"no gold-standard exemplar on {platform}"`. The §3.3 limitation note ("absence of a control set") fires only when the entire block is missing, not when a single platform slot is empty.

### 3.2 The rule

| Control outcome | Business outcome | Determination | Signal |
|---|---|---|---|
| Rendered | Not rendered | `business_specific_failure` | `DS_MISSING_PROFILE` |
| Rendered | Rendered | `platform_available` | none — proceed with normal platform audit |
| Not rendered | any | `unable_to_verify` | none |
| No control for this platform | any | `unable_to_verify` | none |

Per-platform only. A control on Google says nothing about Bing.

**Signal scope vs. control-attempt scope.** The directive (§4) attempts controls for every platform in scope — the four primary platforms (google, yelp, facebook, bbb) plus any platform named in the Gold Standard block (e.g. bing, apple_maps). However, `DS_MISSING_PROFILE` (§4.2) fires only for the four primary platforms. A control-confirmed absence on bing or apple_maps is recorded in `render_controls` with `determination: business_specific_failure` but emits no signal — the determination is attributable evidence for the operator and for the discovery surface (§9.3), not a `DS_*` signal. This reconciles the directive's broad platform scope with the signal definition's restricted scope.

### 3.3 Fallback

If the Gold Standard block is absent, no control exists. Every unrendered platform resolves to `unable_to_verify` with no signal, and the absence of a control set is noted in `data_quality.limitations`. This is the current behaviour, so the change is strictly additive.

### 3.4 Accepted property, not a flaw

Exemplars were selected as best-in-class, so they carry rich profiles, and a platform may serve more content for well-known entities than for a thin one. A render failure may therefore correlate with profile thinness rather than literal absence.

That correlation is the signal we want — thin profile means visibility pain — but it means the finding must be worded as *not discoverable* rather than *does not exist*. See §1.4.

---

## 4. Directive text

New const `PLATFORM_AVAILABILITY_VERIFICATION_DIRECTIVE`, inserted at the end of the **Platforms** section, mirroring the website directive's structure and voice:

```
### Platform Availability Verification — REQUIRED

For every platform in scope (google, yelp, facebook, bbb, and any platform named in the
Gold Standard block), attempt to load the business's profile URL as an ordinary public
visitor before recording any positive platform attribute or emitting any missing-profile
signal. A directory entry, search-result snippet, or indexed preview that displays a URL
is NOT proof that the profile is reachable.

A render failure is only interpretable relative to a control. The Gold Standard block
provides control businesses in the same category with per-platform destination URLs. A
control is a profile known to exist on that platform. Attempt at least one control URL on
the same platform as the business profile you are testing.

Determine the outcome:

* Control rendered AND the business profile did not render → the failure is specific to
  this business. Record the platform as unavailable for this business.
* Control rendered AND the business profile rendered → the platform is available. Proceed
  with the normal platform audit.
* Control did not render, or no control exists for this platform → the failure is not
  attributable to the business. Record the platform as unable_to_verify and emit NO
  missing-profile signal.

If the Gold Standard block is absent, no control is available. Record every unrendered
platform as unable_to_verify and note the absence of a control set in
data_quality.limitations.

Record each control attempt in the top-level `render_controls` array (one entry per platform attempted):

* `platform` — the platform name (google, yelp, facebook, bbb, bing, apple_maps, ...)
* `business_profile_url` — the business profile URL requested, and `business_rendered` — whether it rendered
* `control_business` — the control business name, and `control_url` — the control URL requested, and `control_rendered` — whether it rendered
* `access_barrier` — whether an access-blocking page appeared instead of profile content (see enum in §5)
* `determination` — the resulting outcome: `business_specific_failure` | `platform_available` | `unable_to_verify`

Note: `bbb` has no platform object in the `platforms` block today (the validator's `platformsSchema` defines only google, yelp, facebook). A bbb control-confirmed absence is recorded in `render_controls` only — do not attempt to create a `platforms.bbb` object. The same applies to bing, apple_maps, and any other non-primary platform named in the Gold Standard block.

Do not bypass bot defenses, solve access controls, or perform intrusive testing.

Do not record positive platform attributes (rating, reviews, hours, categories, attribute
chips) unless the profile content actually loaded.

Emit `DS_MISSING_PROFILE` ONLY when the control rendered on that platform and the business
profile did not. Do not emit it when the control also failed, when no control was available,
or when the platform was not attempted.
```

### 4.1 Amendment to the Gold Standard binding

The `Absence vs. Non-Negotiable` paragraph currently forbids converting inability-to-verify into a failure, full stop. It needs one qualifier so the control outcome can override it:

> `Absence vs. Non-Negotiable — A non_negotiable quality gate or expected field is recorded as failed (passed: false) ONLY when the field is verified absent. When a field cannot be verified, record passed: null and note "not verified" — do NOT convert inability to verify into a failure. Exception: when the Platform Availability Verification directive establishes a business_specific_failure for a platform, the platform's expected fields are recorded as verified absent for that business, and the gates fail accordingly.`

### 4.2 Amendment to the DS_MISSING_PROFILE definition

Append the control condition:

> `* DS_MISSING_PROFILE: Business missing entirely on a primary platform (Google, Yelp, Facebook, BBB). Emit ONLY when a render control established business_specific_failure for that platform per the Platform Availability Verification directive.`

Non-primary platforms named in the Gold Standard block (bing, apple_maps, etc.) record `business_specific_failure` in `render_controls` but do NOT emit `DS_MISSING_PROFILE` — the signal is restricted to the four primary platforms. The determination is still attributable evidence for the operator and the discovery surface (§9.3).

---

## 5. Output contract

Two options. They differ in cost, and the difference is real — the website directive avoided a schema change only because `website.issues` already existed as `string[]`.

### Option A — no schema change

Route control records into the existing `platforms.{platform}.profile_issues` array. That field already exists on the `google` platform object and is `string[]`.

- **Pro:** no validator change, no seed schema change, no audit-card change.
- **Con:** `profile_issues` is a general-purpose field, so control records are not machine-readable. Downstream code cannot compute coverage or gate the score without parsing strings. Also, `profile_issues` exists on `google` but **not** on `yelp`, `facebook`, or `bbb` in the current schema — those three would need the field added regardless.

### Option B — dedicated field (recommended)

Add a top-level `render_controls` array:

```json
"render_controls": [
  {
    "platform": "google",
    "business_profile_url": "https://...",
    "business_rendered": false,
    "control_business": "Destiny African Market",
    "control_url": "https://...",
    "control_rendered": true,
    "access_barrier": "js_required",
    "determination": "business_specific_failure"
  }
]
```

**Enum definitions (C1):**

`access_barrier` — one of:
- `none` — profile content loaded normally
- `js_required` — page requires JavaScript execution the analyst cannot perform
- `bot_defense` — bot-detection interstitial (Cloudflare, reCAPTCHA challenge, etc.)
- `captcha` — explicit CAPTCHA challenge
- `login_wall` — login or account required to view content
- `rate_limit` — platform rate-limited the request
- `timeout` — request timed out without rendering content
- `not_attempted` — control or business URL was not attempted (e.g. no URL available)

`determination` — one of:
- `business_specific_failure` — control rendered, business did not
- `platform_available` — both control and business rendered
- `unable_to_verify` — control did not render, no control exists, or self-exemplar excluded (§3.1)

**`determination` ↔ `data_status` mapping (C2):** Each platform object already carries `data_status: complete | partial | unavailable | unable_to_verify`. The new `determination` is a separate, render-level field that does NOT replace `data_status`. The mapping rule:

| `determination` | `data_status` guidance |
|---|---|
| `business_specific_failure` | set `data_status: unavailable` (the profile is verified absent, not merely unrendered) |
| `platform_available` | leave `data_status` to the normal platform audit (complete / partial / unavailable based on what loaded) |
| `unable_to_verify` | set `data_status: unable_to_verify` unless the profile partially loaded — in that case use `partial` and note the partial load in `data_quality.limitations` |

This keeps the two fields reconciled: `data_status` reflects what content was observed, `determination` reflects whether the render outcome is attributable to the business.

- **Pro:** machine-readable; enables a coverage metric (`controls_rendered / controls_attempted`); lets the score gate on coverage rather than scoring unverifiable as 0.
- **Con:** requires a validator update, a schema fragment in the seed (the seed already has a `GAP_AND_GATES_SCHEMA` fragment precedent for this), and an audit-card surface.

**Recommendation:** Option B. Option A cannot support the coverage gate that makes the score honest, which is half the point of the change.

### 5.1 Note on schema-change discipline

A schema mismatch is not hypothetical — an earlier audit import for this business failed with `website.issues.0: Invalid input: expected string, received object`. Any schema change must update the validator and the seed fragment together, and be verified by an actual import, not just by reading the code.

---

## 6. Scoring and signal implications

Once control-confirmed absence is representable, three rubric defects become fixable:

1. **`google_profile_maintenance`** — currently `0 points when the profile appears maintained or status is unavailable`, which scores unverifiability as health. Split the rule: control-confirmed absence scores 2; verified-maintained scores 0; `unable_to_verify` is **excluded from the denominator** rather than scored 0.

   **Rubric text location (C5):** The `google_profile_maintenance` scoring rule lives in the prompt template body stored in the database (NOT in `seed-business-audit-v2-templates.ts` — the seed script only applies targeted transforms to the DB body). The exact source sentence must be extracted from the live template body before a `replaceFirst` transform can be written. The amendment requires:
   - Query the live template body for the `google_profile_maintenance` rubric sentence (search for `"profile appears maintained"` or `"status is unavailable"`).
   - Add a `replaceFirst` transform in the seed script with the extracted source string → amended target string.
   - The amended text: *"0 points when the profile is verified maintained; 2 points when the Platform Availability Verification directive establishes `business_specific_failure` for Google; excluded from the denominator (not scored 0) when the platform is `unable_to_verify`."*

   **gap_analysis cascade (C3):** When `determination: business_specific_failure` is established for a platform, §4.1 says "the platform's expected fields are recorded as verified absent for that business, and the gates fail accordingly." To avoid noise, do NOT auto-generate one `gap_analysis.gaps` entry per expected field (a platform's expected-fields set can be large — hours, categories, photos, attributes). Instead:
   - Record a single `quality_gate_results.results` entry per non_negotiable gate on that platform with `passed: false` and `notes: "platform verified absent per render control"`.
   - Record a single `gap_analysis.gaps` entry for the platform with `field: "profile_presence"`, `expected: "profile exists and renders"`, `actual: "profile not discoverable (control-confirmed)"`, `severity: "non_negotiable"`.
   - Do not cascade into per-field gaps (hours, photos, categories) — those are subsumed by the profile-presence gap.

2. **Score inversion.** Review-derived components are 5 of the 10 available points (`review_response_opportunity` 0-3, `unanswered_negative_reviews` 0-2). A business with no reviews can never exceed 5, so the pre-review segment emerging discovery targets is structurally capped below tier_1. Consider a visibility component that does not depend on an existing review base.

   **Deferred to a follow-on spec (C4).** This item proposes "a visibility component that does not depend on an existing review base" but offers no concrete component, weighting, or rubric text. It is a rubric redesign, not a targeted amendment, and should not block the control mechanism. Ship the control (§3-5) and the targeted amendments (§6.1, §6.3, §6.4) first; defer the score-inversion redesign to a separate spec that proposes the concrete component.

3. **`action_classification`** — defaults to `BALANCED_HEALTHY` when nothing can be computed, making "not computed" indistinguishable from "healthy." Allow `null`.

   **Validator change required (B3):** `business-analysis.schema.ts:477` currently defines `action_classification: actionClassificationEnum.optional()` — it can be omitted but cannot be `null`. Change to `actionClassificationEnum.nullable().optional()` so the model can explicitly emit `null` to distinguish "not computed" from "healthy."

Also add a **coverage qualifier**: `controls_rendered / controls_attempted`. Suppress `recommended_tier` and `estimated_monthly_service_fee` below a threshold rather than emitting `tier_3`, which currently reads as an assessment.

**Validator change required (B4):** `business-analysis.schema.ts:612` currently defines `recommended_tier: tierEnum` (required, non-nullable). Suppressing it below a coverage threshold requires changing to `tierEnum.nullable().optional()`. `estimated_monthly_service_fee` is already `.optional()` and needs no change.

**Cost / latency budget (C6):** Each audit now attempts one control URL per in-scope platform (4–6+ platforms) on top of the business profile loads. The directive should bound the total control attempts to at most 6 (the four primary platforms plus up to two gold-standard-named extras) and should not attempt more than one control URL per platform (§9.1's two-control question is deferred). If the gold standard names more than 6 platforms, prioritize the four primary platforms first, then extras by gold-standard quality_score descending. This bounds the additional fetch cost to at most 6 URL loads per audit.

---

## 7. Implementation tasks

### 7.1 Seed template (prompt-level)

- [ ] Add `PLATFORM_AVAILABILITY_VERIFICATION_DIRECTIVE` const to `seed-business-audit-v2-templates.ts`
- [ ] Insert it at the end of the Platforms section via `insertAfter` with a fingerprint, mirroring the website directive's insertion pattern. **Both variants must be wired** — the seed script has two transform functions (one per template: `mpt-j9bbem3l` Category-Integrated, `mpt-6oeuiizo` Signal-Aligned), and the website directive is inserted in both (steps 4d and 19d). The new directive must be inserted in both transform functions.
- [ ] **Anchor verification (E2):** The Platforms section heading lives in the DB template body, not the seed file. Before writing the `insertAfter` call, confirm the anchor text exists in BOTH live template bodies. Use the same fallback-anchor pattern as the website directive (primary anchor → fallback → `## Platforms` heading). If the heading text differs between variants, use variant-specific anchors.
- [ ] **Seed-insertion safety (E1):** Per AGENTS.md, `insertAfter` fingerprints only the first 80 chars of the insertion — never combine multiple bindings into one `insertAfter` call. The directive is a single block, so this is safe, but if the directive is later split into multiple bindings, each must be a separate `insertAfter`. Do NOT use `removeSection` on the Platforms section (it would eat up to the next `##` heading). If a prior version of the directive needs removal for a version bump, use a `replaceFirst` on the directive's heading line (`### Platform Availability Verification — REQUIRED`) instead.
- [ ] Amend the `Absence vs. Non-Negotiable` paragraph (§4.1). This paragraph lives in the `GOLD_STANDARD_BINDING` const (seed line 82) and is inserted via `insertAfter` at step 1. Use `replaceFirst` on the existing paragraph text to append the exception clause.
- [ ] Amend the `DS_MISSING_PROFILE` definition (§4.2). The definition lives in the DB template body — extract the exact source text from the live template and use `replaceFirst`.
- [ ] If §6.1 rubric amendment is in scope: extract the `google_profile_maintenance` rubric sentence from the live template body and add a `replaceFirst` transform (see §6.1).
- [ ] Bump `SEED_VERSION_MARKER` in the seed script. Current value: `business-audit-v2-2026-09-15-narrative-tone-6`. New value: `business-audit-v2-2026-09-15-availability-control-1`. The marker bump is what triggers re-application — a marker collision with the existing value would silently skip all transforms.
- [ ] Re-run the seed against **both** configs per AGENTS.md: `doppler run --config local -- npx tsx src/scripts/seed-business-audit-v2-templates.ts`, then again with `--config prd`
- [ ] Verify the live template's `updated_at` moved (or regenerate the dump via `dump-prompt-templates.ts`)

### 7.2 Validator (schema-level)

- [ ] Add the `render_controls` array to `business-analysis.schema.ts` with typed fields per §5 (C1 enums for `access_barrier` and `determination`)
- [ ] Change `action_classification` from `actionClassificationEnum.optional()` to `actionClassificationEnum.nullable().optional()` (B3, line 477)
- [ ] Change `recommended_tier` from `tierEnum` (required) to `tierEnum.nullable().optional()` (B4, line 612) — only if §6.4 coverage-suppression is in scope
- [ ] Add the `render_controls` schema fragment to the seed's embedded JSON schema (precedent: `GAP_AND_GATES_SCHEMA` insertion pattern, step 3)
- [ ] Verify with a real import through the external-import path — do not rely on reading the schema (§5.1)

### 7.3 Server-side signal extractor (D3 — CRITICAL)

- [ ] **Gate `DS_MISSING_PROFILE` in `signal-extractor.ts` on the control determination.** The server-side extractor at `apps/api/src/services/triage/signal-extractor.ts:258-265` currently fires `DS_MISSING_PROFILE` whenever `!google` (no google platform object) — this is exactly the "Google didn't render" case the spec is fixing, and it bypasses the control mechanism entirely. The prompt-level amendment (§4.2) is insufficient on its own.
- [ ] Change the extractor to check `render_controls` for a `business_specific_failure` entry on the platform before adding `DS_MISSING_PROFILE`. Pseudocode:
  ```typescript
  if (!signals.has('DS_MISSING_PROFILE')) {
    const renderControls = auditData.render_controls ?? [];
    const platformsWithFailure = renderControls
      .filter(rc => rc.determination === 'business_specific_failure')
      .map(rc => rc.platform);
    if (platformsWithFailure.length > 0) {
      signals.add('DS_MISSING_PROFILE');
    }
  }
  ```
- [ ] **Backward compatibility:** existing audits without `render_controls` (pre-control-mechanism) must not regress. If `render_controls` is absent, fall back to the current behavior (`!google`) so the extractor does not silently stop firing for legacy imports. Add a version check or a `render_controls` presence check.
- [ ] **Platform coverage gap:** the current extractor only checks `google`, not yelp/facebook/bbb. The amended extractor should fire `DS_MISSING_PROFILE` when ANY primary platform has `business_specific_failure` (matching §4.2's "Google, Yelp, Facebook, BBB" scope). Update the test at `apps/api/src/services/triage/__tests__/TriageEngineService.test.ts` (lines 623-647) accordingly.

### 7.4 Audit card (frontend)

- [ ] If Option B: surface control results on the audit card
- [ ] Surface the coverage qualifier (`controls_rendered / controls_attempted`) on the audit card when below threshold

### 7.5 Scoring amendments (deferred-capable)

- [ ] Apply the §6.1 scoring amendment (`google_profile_maintenance` split) — or defer to a follow-on spec if the control ships first
- [ ] Apply the §6.3 `action_classification: null` amendment — or defer
- [ ] Apply the §6.4 coverage qualifier + tier suppression — or defer
- [ ] §6.2 score-inversion redesign — deferred to a separate spec (C4)

---

## 8. Verification

**Measurement first.** Before shipping, measure the per-platform render success rate across a sample of businesses in one market. The entire design assumes controls render often enough to be useful.

**Graduated decision rule (D4):**

| Control render rate | Decision |
|---|---|
| ≥ 80% on a platform | Ship the mechanism for that platform — controls are reliable |
| 50–80% on a platform | Ship, but note the reduced coverage in the PR — the mechanism works but costs more `unable_to_verify` determinations than ideal |
| 20–50% on a platform | Ship with a `data_quality.limitations` note on every audit: `"control render rate for {platform} is {rate}%; determinations may be conservative"`. Do not suppress the mechanism — partial coverage is still better than no control |
| < 20% on a platform | Do not ship the control for that platform — fix render reliability first. The mechanism is inert below this threshold (every determination collapses to `unable_to_verify`). The platform resolves to the current behavior (no signal) |

**Measurement procedure:** sample at least 20 businesses in one market. For each, attempt to load one gold-standard exemplar URL per platform as an ordinary public visitor (no bot bypass, no headless browser — the same tooling the analyst uses). Record whether the profile content loaded. Compute the per-platform render rate. Record the measured rates and sample size in the PR.

**Measurement is a prerequisite, not a nice-to-have.** A mechanism that ships without measuring may be inert on every platform and the team won't know until audit outputs fail to change.

**Template**

- The directive renders in the Platforms section for both Business Audit V2 variants
- The `Absence vs. Non-Negotiable` amendment is present
- Seed re-run is idempotent — a second run does not duplicate the directive

**Behaviour**

- Control renders, business does not → `DS_MISSING_PROFILE` emitted, `determination: business_specific_failure`
- Control renders, business renders → no signal, normal audit proceeds
- Control does not render → `unable_to_verify`, no signal
- No Gold Standard block → `unable_to_verify`, no signal, absence noted in `data_quality.limitations`
- Gold Standard present but no exemplar on a platform (empty slot, D2) → `unable_to_verify`, no signal, noted in `data_quality.limitations` as `"no gold-standard exemplar on {platform}"`
- Gold Standard present but exemplar has no destination URL (B5) → `unable_to_verify`, no signal, noted in `data_quality.limitations` as `"control exemplar for {platform} has no destination URL"`
- Only exemplar on a platform is the audited business itself (self-exemplar, D1) → excluded from control set, `unable_to_verify`, no signal
- A platform is never marked unavailable without at least one recorded control attempt on that platform

**Regression**

- With no gold standard present, output is byte-identical to today's behaviour
- `WC_BROKEN_WEBSITE` behaviour is unchanged (website and platform paths stay separate)
- **Server-side signal extractor (D3):** `signal-extractor.ts:258-265` must be gated on `render_controls` — without this change, the extractor fires `DS_MISSING_PROFILE` on `!google` regardless of the control outcome, bypassing the entire mechanism. Verify the extractor test suite (`TriageEngineService.test.ts:623-647`) passes after the gate is added, and that legacy audits without `render_controls` fall back to the current behavior.
- **Backward compatibility:** audits imported before the control mechanism ships (no `render_controls` field) must produce identical signal-extractor output to today — the `render_controls` absence check must fall back to `!google`, not silently drop the signal.

**End to end**

- Import a real audit result through the external-import path and confirm it validates. Do not rely on reading the schema.

---

## 9. Open questions

1. **How many controls are enough?** One control per platform is the minimum. Requiring two would raise confidence but doubles fetch cost and may not be possible where exemplars are thin on a platform. **Resolved for v1:** one control per platform, bounded to 6 total attempts (§6 cost budget). The two-control question is deferred.
2. **What if the control set renders on one platform but the business is absent from the gold standard's platform list?** The gold standard may not name every platform in scope. Absent platforms have no control and resolve to `unable_to_verify`. **Resolved:** see §3.2 (signal scope vs. control-attempt scope) — non-primary platforms (bing, apple_maps) are recorded-only, no signal.
3. **Should the control result feed the discovery surface?** A control-confirmed absence is strong evidence for the `INT_*` visibility family. Out of scope here, but it is the natural place to close the contradiction between discovery and audit outputs for the same business.
4. **Does a control-confirmed absence belong in `public_narrative`?** No. The public narrative excludes deficiency language, and "not discoverable" is a finding for the operator, not the listing page.
5. **Should the server-side signal extractor (`signal-extractor.ts`) be the single source of truth for `DS_MISSING_PROFILE`, or should the model emit it directly?** Currently both paths exist: the prompt tells the model to emit `DS_MISSING_PROFILE` (§4.2), and the extractor derives it independently from `!google` (§7.3). After the control ships, the extractor should be the gate (it has access to `render_controls`), and the prompt-level instruction should be advisory. If both emit, the extractor's `signals.has()` guard deduplicates — but the extractor must not fire without a `business_specific_failure` determination.

---

## 10. Non-goals

- Changing how the website accessibility path works — it is already correct
- Emitting availability signals without a control
- Treating analyst-side render failures as business findings
- Claims about business quality, revenue, or customer volume
- Fixing platform render reliability (a separate, upstream concern that this spec depends on)

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Blanket "cannot render = missing" fires on every audit | Control requirement — no signal without a rendered control (§3.2) |
| Control URLs are stale claims, not live checks | Directive requires an in-session attempt, recorded per platform (§4) |
| Cross-market exemplars weaken the geography control | Prefer market-scoped gold standards; failed control falls back to `unable_to_verify` (§3.1, §3.3) |
| Analyst asserts the comparison without attempting it | Control attempts are a recorded output field (§5 Option B) |
| Schema change breaks import | Update validator and seed fragment together; verify with a real import (§5.1) |
| Finding drifts into a quality claim | Language constrained to discoverability; `public_narrative` excludes it (§1.4, §9.4) |
| Mechanism is inert because controls rarely render | Render-reliability measurement is a prerequisite task (§8) |
| Server-side extractor bypasses the control (D3) | Gate `signal-extractor.ts` on `render_controls.determination === 'business_specific_failure'`; fall back to `!google` for legacy imports without `render_controls` (§7.3) |
| Self-exemplar tautology — control and business are the same URL | Exclude self-exemplars from the control set by business-name match (§3.1) |
| Exemplar exists on a platform but has no destination URL | Treat as no control for that platform; note in `data_quality.limitations` (§3.1, B5) |
| `determination` and `data_status` drift apart | Mapping rule in §5 keeps them reconciled — `business_specific_failure` → `unavailable`, `unable_to_verify` → `unable_to_verify` |
| `gap_analysis` floods with per-field gaps on a confirmed absence | Single `profile_presence` gap entry per platform, not per-field cascade (§6.1, C3) |
