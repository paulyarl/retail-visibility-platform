# Triage & Repair Prompts — Operator Outreach Problems & Solutions — Spec

> The seven triage/repair seek prompts return briefings that describe what is broken, but they never hand the operator a ready-to-use set of **problem → solution pairs** for the outreach conversation. This spec adds one shared, schema-enforced output field — `outreach_problems` (1–3 entries — the most painful **playbook-aligned** problems the audit surfaced, each a problem + two spoken lines (regular + hook) + solution + evidence + how-to-use-it) — to all seven templates, so every triage or audit run ends with concrete outreach ammunition the operator can deploy verbatim.

**Status:** Not started — spec only (future sprint)
**Owner:** TBD
**Scope:** `apps/api` prompt seed scripts (3) + output schema validators (3) + prompt suffixes + `MarketingExecutionService.resolvePrompt` signal-triage injection + opener-from-briefing route enum + operator briefing cards (web) + validator test fixtures. No migrations.
**Gap analysis:** performed 2026-09-16 against the live codebase + `docs/api-response/seek-prompt-templates.md` dump; discovered drift is itemized in §4.4 and must be resolved during implementation.

---

## 1. Overview

### 1.1 Request

For each of the seven triage/repair prompts, the analyst must return to the operator **1–3 problem → solution pairs** that the operator could use for outreach to the prospect — the most painful problems *that align with the template's playbook*. A single-signal audit (e.g. no website, everything else clean) legitimately returns one entry; a pain-dense audit returns its top three — but all three must be on-issue (a NAP Drift briefing returns three NAP pairs even when a non-NAP pain signal is present in the audit data; the off-issue pain belongs in `risks`/`pitch`, not in `outreach_problems`). One tweak, applied uniformly to all seven.

**Rationale:** the pairs are sized for the pitch construction workflow — the operator copies lines off the audit/briefing card and pastes them into the pitch construction (openers) workspace to assemble outreach. Ready-made, playbook-aligned pairs are the missing raw material for that workspace today.

### 1.2 The seven templates

| # | Template | ID | Output schema | Seed script |
|---|---|---|---|---|
| 1 | Profile Repair Triage Analysis (Default) | `mpt-profile-repair-triage-default` | `profile_repair_triage` | `seed-profile-repair-triage-briefing.ts` |
| 2 | Profile Repair — NAP Drift Audit (Seek) | `mpt-profile-repair-nap-drift-seek` | `profile_repair_audit` | `seed-profile-repair-issue-briefings.ts` |
| 3 | Profile Repair — Unclaimed Profile Audit (Seek) | `mpt-profile-repair-unclaimed-seek` | `profile_repair_audit` | `seed-profile-repair-issue-briefings.ts` |
| 4 | Profile Repair — Platform Gap Audit (Seek) | `mpt-profile-repair-platform-gap-seek` | `profile_repair_audit` | `seed-profile-repair-issue-briefings.ts` |
| 5 | Business Digital Audit - Cohesive (Category-Integrated V2) | `mpt-j9bbem3l` | `business_analysis` | `seed-business-audit-v2-templates.ts` |
| 6 | Business Digital Audit - Alignment Scoring (Signal-Aligned V2) | `mpt-6oeuiizo` | `business_analysis` | `seed-business-audit-v2-templates.ts` |
| 7 | Seek: Business Audit (V1) | `mpt-je6m7ru6` | `business_analysis` | `seed-business-audit-v2-templates.ts` |

> **Eighth template discovered in gap analysis:** `mpt-seed-seek-001` ("Seek: Business Audit") also declares `business_analysis` but is not in this table — it is a minimal legacy prompt with no bindings or embedded schema. It is folded into scope via §4.4.1; if it is deliberately excluded there, the count stays seven.

### 1.3 Current state and gap

All seven prompts already produce operator-facing briefing content, but nothing in the output is structured as a deployable problem → solution pair:

| Template | Has today | Gap |
|---|---|---|
| Triage (`profile_repair_triage`) | `scope`, `viability`, `pitch` (`primary_angle`, `opener_hook`, `pain_points[]`, `marketplace_positioning`), `risks[]`, track | `pain_points` are bare strings — no solution, no evidence, no usage guidance. `risks` are campaign risks, not prospect problems. |
| Issue briefings (`profile_repair_audit`) | `scope`, `impact`, `pitch` (`opener_hook`, `pain_points[]`, `value_preview`), `risks[]` | Same: one `opener_hook` + loose pain points; no per-problem solution or usage. |
| Business audits (`business_analysis`) | `market_opportunities[]` (title/description/impact), `alignment_scoring.primary_outreach_hook` (single hook), `recommended_services[]` | Opportunities are not problems; the single `primary_outreach_hook` is one line, not a set of pairs. |

The operator is left to synthesize the outreach framing themselves from scattered fields. The fix is one shared output contract, enforced by the validators, present in every rendered prompt.

### 1.4 Design principles

- **One contract, seven templates.** The same field name, shape, and content rules everywhere, so the operator UX is uniform regardless of which playbook produced the briefing.
- **Schema floor of one, prompt cap of three.** The validator requires a non-empty array (`.min(1)`) where the schema is dedicated to these prompts (`profile_repair_triage`, `profile_repair_audit`) — a repair briefing with zero problems is a failed run. The ≤3 cap is prompt-level only: "the most painful of the bunch," ranked by severity, never padded. Where the schema is shared (`business_analysis`), the field is optional — see §3.3.
- **Evidence-grounded, never invented.** Every problem must trace to the audit data. This is already the standing rule in all seven bodies ("do not invent platform names, drift details, or missing assets…") — the new field inherits it, and extends it two ways: the analyst **may visit the business's live profile/website** during analysis (ordinary-visitor access rules — no bypassing bot defenses, no intrusive testing) to confirm a pair before writing it, and where a **Gold Standard** block is present its expected fields, quality gates, and pattern exemplars define *what good looks like* for the signals under analysis — `gap_analysis` / `quality_gate_results` are the first evidence source. **Every prompt in scope must be gold-standard aware at render time** — today the four repair prompts only receive the benchmark when a Category Intelligence profile also resolves (see §4.5).
- **Consequence language, not defect labels.** Consistent with the existing pitch guidance ("not 'your NAP is inconsistent' but the business consequence").
- **Playbook-aligned, then most painful.** Entries are selected on two axes: they must serve the template's playbook (§4) AND be the most painful within that aligned set. Off-issue pains — even severe ones — stay in `risks`/`pitch`, never in `outreach_problems`.
- **Deliverable in kind, high-level in detail.** Solutions must be things the operator/platform actually offers *in kind* (repair packages, claim service, listing cleanup) — never promises of platform-side behavior. But the analyst is blind to the platform's package catalog, so `solution` is a summary or high-level steps, not a named product — the operator fills in the specific offer.
- **Develop-value-first framing.** These prompts predate the platform's seed-first outreach motion: the platform seeds the prospect's directory presence first, then invites the owner to claim it — the claim path is the front door to every fix. Pairs are framed "we surfaced this on your listing — claim and we fix it," easing pains the prospect can see, not "buy an audit." (Honesty rule unchanged: never assert a published listing exists unless the data shows one.)
- **Additive.** No existing field is removed or redefined (`pain_points`, `opener_hook`, `market_opportunities`, `primary_outreach_hook` all stay for backward compatibility).

---

## 2. The shared output contract

### 2.1 Field shape

New top-level field inside each template's existing output envelope:

```json
"outreach_problems": [
  {
    "problem": "<the problem stated as the prospect experiences it — the business consequence, not the technical defect>",
    "regular": "<the plain professional line that raises this problem>",
    "hook": "<the alternative line — same fact, pattern-interrupt delivery>",
    "solution": "<a high-level summary of the fix — the analyst is not expected to name platform-specific packages; the operator maps this to the actual offer>",
    "evidence": "<the audit-data observation that grounds this problem: platform + observed fact>",
    "outreach_use": "<how the operator deploys this pair in outreach — e.g. cold-call opener, email hook, objection response>"
  }
]
```

Placement per schema:

- `profile_repair_triage` → sibling of `pitch` / `risks`, inside `profile_repair_triage`.
- `profile_repair_audit` → sibling of `pitch` / `risks`, inside `profile_repair_audit`.
- `business_analysis` → top-level sibling of `market_opportunities` / `recommended_services`.

### 2.2 Content rules (shared directive text)

All seven bodies carry the same directive section (adapted per template, see §4):

```markdown
### Operator Outreach Problems & Solutions — REQUIRED

Produce `outreach_problems` — an array of ONE to THREE (1–3) problem-and-solution
pairs the operator can use directly in outreach to the prospect (the business owner).
Return only the most painful problems, ranked by severity: when the audit surfaces
a single real issue, return just that one — never pad the count. Each entry ships
two spoken lines — a plain professional statement and a hook alternative —
followed by the solution. Shape:

{ "problem": "<the problem as the prospect experiences it — the business consequence>",
  "regular": "<the plain professional line that raises this problem>",
  "hook": "<the alternative line — same fact, earns attention>",
  "solution": "<high-level summary of the fix — what gets done, not a named package>",
  "evidence": "<the audit-data observation that grounds this problem: platform + observed fact>",
  "outreach_use": "<how the operator deploys this pair — cold-call opener, email hook, objection response>" }

Rules:
* 1–3 entries — the most painful problems only, ranked by severity. One
  well-grounded pair beats three thin ones: if the audit surfaces a single real
  issue (e.g. no website, everything else clean), return just that one. Never pad
  the count with duplicated, weak, or invented problems; never exceed three — when
  pains are numerous, the three most painful win. Each entry addresses a distinct
  customer-facing consequence — do not restate the same defect once per platform.
* Playbook alignment — every entry must serve THIS prompt's playbook, not just the
  audit's pain list. Most painful AND on-issue is the bar: a NAP Drift briefing's
  pairs are all NAP pairs, even when a non-NAP pain signal appears in the audit
  data. Off-issue pains belong in the other briefing fields (risks, pitch), never
  in `outreach_problems`. Rank by severity *within* the aligned set.
* Ground every `problem` in the audit data above — do not invent drift, missing
  platforms, or missed assets that are not present in the audit results. You MAY
  visit the business's live profile or website as an ordinary public visitor to
  confirm what is observable today before writing the pair (same access rules as
  the verification directives: no bypassing bot defenses, no logins, no intrusive
  testing). `evidence` cites what was actually observed — platform + observed fact.
* When a Gold Standard block is present, treat it as the "what good looks like"
  reference for every signal in the analysis — a problem is strongest when it names
  the expected field or quality gate the business fails, and `gap_analysis` /
  `quality_gate_results` are your first evidence source. When the block is absent,
  ground pairs in the audit results and the category intelligence block alone.
* Use the category intelligence block (when present) to make problems and solutions
  category-aware — what resonates for an African Grocery Store differs from a
  plumbing contractor.
* Frame problems as business consequences ("customers asking Siri for your category
  are sent to a competitor"), never as technical labels ("NAP inconsistency").
* Every entry carries two spoken lines: `regular` — the plain professional way to
  raise the problem — and `hook` — the alternative that earns attention with the
  same fact (a curiosity gap, a "try being your own customer" moment, a specific
  number). The hook must stay 100% true to the evidence: no clickbait, no invented
  stakes, no fear-mongering.
* Solutions must be deliverable by the operator — never promise platform-side
  behavior the operator cannot control. Stay high-level: you do not know the
  platform's package catalog, so articulate the solution summary or high-level
  steps (e.g. "claim the listing and correct the phone across Google and Yelp")
  rather than naming a specific product — the operator maps your summary to the
  actual offer.
* Frame every pair in the develop-value-first motion: the platform seeds the
  prospect's directory presence first and invites the owner to claim it — the
  pairs ease pains the owner can already see. Problems land as "we surfaced this
  on your listing," solutions as "claim your profile and we fix it" — never as
  "buy an audit." Do not assert a published listing exists unless the audit data
  shows one; the claim-and-fix framing works whether or not the seed is already
  live (the seed is created as part of the outreach motion).
* `outreach_use` must be concrete enough to act on without rework.
* Tone — warm, professional, helpful (see §2.3): write copy the operator can read
  aloud to the owner with a straight face and a smile. Never dry, never dull.
```

### 2.3 Analyst copy tone

The operator reads these pairs **aloud, to the prospect**. The analyst's copy is a script, not a report — every field must survive being spoken to the owner over the phone. The tone contract:

**Voice: a knowledgeable local advisor who wants the business to win.** Warm, plain-spoken, professional. The analyst writes like a trusted consultant explaining what they found and how they'd fix it — not like an audit report, and not like a sales flyer.

| Do | Don't |
|---|---|
| Write like a knowledgeable local advisor | Write like an audit report |
| Short, spoken sentences the operator can read aloud verbatim | Stiff report prose ("It has been observed that…", "Analysis indicates…") |
| Name the customer consequence first, then the fix | Lead with platform jargon (NAP, GBP, citations, "coverage gap") |
| Calm and honest about severity | Alarmist or fear-mongering ("you're being penalized!", "critical failure") |
| Respectful of the owner's effort so far | Condescending, blaming, or embarrassing |
| A concrete helpful next step in every solution | Vague filler ("consider optimizing your presence") |
| Contractions and spoken register (this is read aloud) | Formal written register ("do not", "it is not") |
| Warmth through helpfulness | Warmth through hype — no exclamation marks, no superlatives, no pressure tactics |
| Develop-value-first framing — "we surfaced this on your listing; claim and we fix it" | Sell-the-audit framing — "you should pay us to look into this" |

**Worked transformations (dry → warm):**

- Dry: "NAP inconsistencies were detected across Google and Yelp."
  Warm: "Your Google and Yelp listings show an old phone number — customers who call it never actually reach you."
- Dry: "The Google Business Profile is unclaimed, which limits owner-side management functionality."
  Warm: "Your Google listing exists, but it's sitting unclaimed — right now you can't post updates or reply to the reviews customers are leaving."
- Dry: "A platform coverage gap was identified for Apple Maps."
  Warm: "When iPhone owners ask Siri for your category, Siri sends them to a competitor down the street — you're invisible on Apple Maps."

**Same problem, two spoken lines (regular vs hook):**

- Problem: the Google listing is unclaimed, so the owner can't respond to reviews.
  - Regular: "Your Google listing is unclaimed, so reviews customers leave right now go unanswered."
  - Hook: "Try this — Google your business and read the newest review out loud. An unclaimed listing means you couldn't have replied to it, and your competitor could have."
- Problem: the listed phone number is an old disconnected line.
  - Regular: "The phone number on your listing is an old one, so calls aren't reaching you."
  - Hook: "Quick question — when's the last time you dialed the number shown on your own Google listing? That's the exact number your customers are dialing."

**Develop-value-first framing (same problem, seed-first motion):**

- Problem: stale phone number on the listings.
  - Regular: "We've put together a directory listing for your business — but it's showing an old phone number. Claim the listing and we'll get the right number in front of customers."
  - Hook: "Your business is already on our directory — we did the legwork. One thing though: the phone number it shows is an old one. Want to claim it and fix that today?"

**Tone boundaries:** warm ≠ promotional. The pairs stay evidence-grounded (the `evidence` field carries the raw observation), and the owner is never the butt of the copy — the problem is the situation, the fix is the offer. This mirrors (and deliberately relaxes for the private outreach context) the public-narrative tone rule in `PUBLIC_NARRATIVE_DIRECTIVE`: same warmth, but the outreach copy *may* name deficiencies because the operator, not the public, reads it.

### 2.4 Relationship to existing fields

- `pitch.pain_points` / `pitch.opener_hook` stay as-is (backward compat).
- The per-entry `hook` is distinct from the campaign-level `pitch.opener_hook`: the opener raises the conversation once; each entry's `regular`/`hook` pair gives the operator a choice of lines **per problem**, across touches (call, email, follow-up), without repeating the same opener.
- `risks` stay campaign-scoped (things that make the campaign harder) — deliberately distinct from prospect problems.
- For the business audits, `market_opportunities` stays (it feeds the Seed Market Intel Sidebar); the new field is the outreach-facing sibling, not a replacement.

---

## 3. Schema changes

### 3.1 `profile_repair_triage` — required, min 1

`apps/api/src/validators/profile-repair-output.schema.ts` → `profileRepairTriageSchema`:

```ts
outreach_problems: z.array(z.object({
  problem: z.string(),
  regular: z.string(),
  hook: z.string(),
  solution: z.string(),
  evidence: z.string(),
  outreach_use: z.string(),
})).min(1),
```

`.min(1)`, not `.min(3)` — the count is evidence-driven, not a quota (§2.2). A repair triage with zero problems is a failed run and should reject; a one-problem briefing is valid. No `.max()` — the ≤3 cap is a prompt-level ranking rule, so a fourth well-formed entry must not hard-fail an otherwise good import.

Add the same shape to `PROFILE_REPAIR_TRIAGE_PROMPT_SUFFIX` (the JSON shape block).

### 3.2 `profile_repair_audit` — required, min 1

Same file, `profileRepairAuditSchema` + `PROFILE_REPAIR_AUDIT_PROMPT_SUFFIX`. Both schemas are dedicated to the profile repair prompts, so the required `.min(1)` is safe.

### 3.3 `business_analysis` — optional in Zod, prompt-enforced

`businessAnalysisSchema` is shared beyond the three audit templates: the live dump shows it on `mpt-seed-seek-001` ("Seek: Business Audit" — a fourth audit folded into scope per §4.4.1), and it is also attached to "Seek: Business Review Response V1" via `set-business-analysis-schema.ts` (local-only per the prd dump — verify per §4.4.2). Making the field required here would make non-covered templates fail import for missing outreach problems.

Decision: add the field as **optional** in `businessAnalysisSchema`:

```ts
outreach_problems: z.array(z.object({
  problem: z.string(),
  regular: z.string(),
  hook: z.string(),
  solution: z.string(),
  evidence: z.string(),
  outreach_use: z.string(),
}).passthrough()).min(1).optional(),
```

`.min(1)` applies when the field is present — an empty array carries no information and should be emitted as "omit the field entirely" instead, matching the codebase's existing pattern (`market_opportunities`, `signal_checklist`).

The 1–3 count rule is enforced at the **prompt level** for the audit templates only (body directive + suffix shape). The full set of templates declaring `business_analysis` was confirmed in gap analysis — it had already grown past the audit + review-response set (see §4.4).

Add the shape to `BUSINESS_ANALYSIS_PROMPT_SUFFIX` — but the accompanying note must be **conditional**, not "required for this audit". The suffix is appended to *every* `business_analysis` render, including templates that carry no directive (the review-response template, and `mpt-seed-seek-001` if §4.4.1 excludes it). A blanket "required" instructs prompts that have no contract for the field. Use neutral phrasing, e.g.: "Populate `outreach_problems` with 1–3 entries (the most painful problems, ranked by severity) when the prompt body contains an Operator Outreach Problems & Solutions directive; omit the field entirely otherwise — do not emit an empty array."

### 3.4 Persistence impact

- **Triage:** `ProfileRepairPromptService` persists the validated briefing via spread (`repair_triage_briefing: { ...recommendation, ... }`) — a declared schema field persists automatically. No service change.
- **Per-issue briefings:** stay execution-row-only (existing non-goal, unchanged — the field rides in the execution's validated output).
- **Business audits:** top-level schema is `.passthrough()`; imported results store the full validated JSON in `audit_data`, so the field persists with no code change.

### 3.5 Prompt suffixes need no seed re-run

The suffixes (`PROFILE_REPAIR_*_PROMPT_SUFFIX`, `BUSINESS_ANALYSIS_PROMPT_SUFFIX`) are code-side — appended at render/copy/download time from `OUTPUT_SCHEMA_REGISTRY`. Editing them is a plain code change. Only the **body** changes require seed re-runs.

---

## 4. Prompt body wiring (per template)

### 4.1 Triage briefing (`mpt-profile-repair-triage-default`)

`seed-profile-repair-triage-briefing.ts` replaces the whole body when the marker is absent. Changes:

1. Add `### 6. Operator Outreach Problems & Solutions` to `NEW_BODY` (after `### 5. Track Recommendation`, before the closing "The output JSON shape…" line), using the shared directive text from §2.2, with the playbook-alignment rule bound to `issue_type_confirmed` — the pairs must serve the confirmed issue the operator is about to pitch, not every pain the audit surfaced. This prompt has no Gold Standard block — its "what good looks like" reference is the appended Category Intelligence block (category signals, evidence rules); the directive's gold-standard clause resolves to that fallback automatically. After the §4.5 runtime fix, the benchmark block is injected whenever a gold-standard profile exists for the category — the "when present" phrasing stays correct because absence then means no gold standard exists for the category at all.
2. Bump the idempotency marker: live bodies contain `OPERATOR BRIEFING — PRIMARY OUTPUT`, so re-running with the same marker skips. Change `BRIEFING_MARKER` to a versioned value, e.g. `OPERATOR BRIEFING — PRIMARY OUTPUT` + `<!-- triage-briefing-v2: outreach-problems -->` appended/inserted per the existing pattern.

### 4.2 Issue briefings (3 templates in `seed-profile-repair-issue-briefings.ts`)

1. Append `### 6. Operator Outreach Problems & Solutions` to each of the three `TEMPLATES[].body` consts (after `### 5. Severity + Issue Type`, before the closing "The output JSON shape…" line), with the shared directive text and the playbook-alignment rule bound to the template's `issueType` — the NAP Drift template's pairs are all NAP pairs, the Unclaimed template's are all claim-state pairs, the Platform Gap template's are all coverage-gap pairs — even when the audit data contains a more painful off-issue signal. `issueType` examples stay per-issue (NAP drift / unclaimed / platform gap). These prompts also have no Gold Standard binding in their stored bodies — the benchmark arrives at render time (see §4.5); until then the Category Intelligence block is the "what good looks like" reference.
2. Bump `BRIEFING_MARKER` to a versioned value — live bodies already contain the current marker, so the skip branch would otherwise fire forever.

### 4.3 Business audits (3 templates in `seed-business-audit-v2-templates.ts`)

1. Add a new `OUTREACH_PROBLEMS_DIRECTIVE` const carrying the shared directive text, adapted for the audit context: the input is the audit's own findings (`gap_analysis`, `detected_signals`, `website`, `platforms`) rather than `audit_results`; solutions stay high-level (summary or steps — the analyst doesn't know the package catalog) and may draw on the audit's own `recommended_services` when present; the operator maps the summary to the actual offer at outreach time. Playbook alignment here means **deliverability in kind** — every pair must be the *kind* of fix the operator's packages deliver (`recommended_services` is a hint, not a lookup table — the analyst summarizes the fix, it does not name the product), so the entries converge on the pitch the audit is already making rather than scattering across every observed weakness. The Gold Standard clause carries real weight in this variant: the two V2 templates receive the benchmark block at render time, so `gap_analysis` / `quality_gate_results` are the primary evidence source for pairs (a verified gap against an expected field IS the problem, and "close the gap to benchmark" frames the solution). `mpt-je6m7ru6` and `mpt-seed-seek-001` have no Gold Standard block — the clause's fallback (audit results + category intelligence alone) applies to them.
2. Insert it in **all three** transforms (`transformCategoryIntegrated`, `transformSignalAligned`, `transformBusinessAuditV1`) — plus the new `transformSeedBusinessAudit` for `mpt-seed-seek-001` if §4.4.1 folds it in.
3. Anchor: after the Market Intel Output directive insertion in each transform (its final line — `"Omit the field entirely when no category context was provided."` — is guaranteed present in all three bodies by the previous seed). The directive has a heading (`### Operator Outreach Problems & Solutions — REQUIRED`), so a `removeSection` of the same heading must precede the insertion in each transform (seed-version bump re-application), and the insertion must come **after all `removeSection` calls** per AGENTS.md.
4. Bump `SEED_VERSION_MARKER` (e.g. `<!-- seed-version: business-audit-v2-2026-09-XX-outreach-problems-1 -->`) so already-wired bodies re-apply.

### 4.4 Discovered drift — fix-and-align items (from the 2026-09-16 gap analysis)

A codebase audit surfaced drift the body wiring above does not account for. Resolve each item during implementation, **before** the seed re-runs:

1. **`mpt-seed-seek-001` ("Seek: Business Audit") also declares `business_analysis`.** The live dump shows `business_analysis` on `mpt-seed-seek-001`, `mpt-6oeuiizo`, `mpt-j9bbem3l` — and `mpt-je6m7ru6` is absent from that dump (it is prd; the seed comment confirms V1 is absent there). `mpt-seed-seek-001` is a minimal legacy prompt (~1.9k chars): no embedded JSON schema, no Category/Gold/Market-Context bindings, no seed marker — it relies entirely on `BUSINESS_ANALYSIS_PROMPT_SUFFIX` for its output shape. **Fix:** fold it into scope as an eighth template — add `transformSeedBusinessAudit` to `seed-business-audit-v2-templates.ts` that (a) runs `removeSection(out, '### Operator Outreach Problems')` for re-run self-healing, then (b) `insertBefore`/`insertAfter` the §4.3 `OUTREACH_PROBLEMS_DIRECTIVE` (audit-context variant — the input is its own audit findings, which fits this prompt's shape) anchored on its closing line `Format as structured JSON.`, and (c) appends `SEED_VERSION_MARKER`. If it is deliberately excluded instead, record that decision in §1.2 — a business audit that silently skips the outreach-problems contract leaves the operator UX inconsistent.
2. **Review-response template presence.** "Seek: Business Review Response V1" was created via the UI and does not appear in the prd dump — verify it exists (and still declares `business_analysis`) in each environment before relying on the optional-field rationale. The optional-Zod decision stands regardless: any non-audit template on the shared schema makes a required `.min(1)` unsafe.
3. **`mpt-je6m7ru6` is absent in prd.** The V1 seed task logs `Template not found` and continues — expected, not a failure. The §7 render check applies to local only for V1.
4. **Dump live bodies before re-running full-body-replace seeds.** `seed-profile-repair-triage-briefing.ts` and `seed-profile-repair-issue-briefings.ts` replace the whole body when the marker is absent — bumping the marker discards any manual UI edits since the last seed. Export the four repair bodies (and the three audit bodies) to a scratch file first so drift is recoverable.
5. **Anchor verification.** Every `insertAfter` throws when its anchor is absent. Before seeding, grep each live body for the §4.1–4.4 anchors (closing instruction line, `### 5.` headings, the Market Intel directive's last line) — bodies may have been hand-edited since these seeds last ran.

### 4.5 Gold-standard awareness — render-time injection gap (`MarketingExecutionService.resolvePrompt`)

All eight prompts in scope must receive the Gold Standard benchmark at render time. Today they do not — the injection is role-gated:

| Role (`promptRole`) | Templates | Gold Standard 'benchmark' block today |
|---|---|---|
| `category_audit` (business-scope seek, non-repair) | `mpt-j9bbem3l`, `mpt-6oeuiizo`, `mpt-je6m7ru6`, `mpt-seed-seek-001` | Injected unconditionally — including the no-CI-profile fallback (`goldStandardOnly` path, `MarketingExecutionService.ts` ~line 1348) |
| `signal_triage` (business-scope seek, `template.category = 'profile_repair'`) | The 4 repair templates | **Only when a Category Intelligence profile resolves** — the `signal_triage` branch early-returns on `!profile` (~line 1280) *before* `resolveGoldStandard` is attempted (~line 1300). No CI profile for the category → no benchmark, even when a gold standard exists. |

**Fix (code, not a seed):** in the `signal_triage` branch, decouple the benchmark from CI-profile resolution — when `audit_signals` is populated but `profileService.resolve` returns null, still attempt `resolveGoldStandard(category, platform, city, state)` and append the `'benchmark'` block (plus market context) before returning, mirroring the `goldStandardOnly` fallback in the `category_audit` path. Keep the empty-`audit_signals` early return unchanged (it exists to suppress the distractor category block when triage has no primary input — amplifying a signal-less run is out of scope).

With this fix, every prompt in scope is gold-standard aware at render time: the repair prompts get the benchmark whenever a gold standard exists for the category, and the §2.2 directive's "when a Gold Standard block is present" clause stays correct — absence then means no gold standard exists for the category at all, which is itself briefing-worthy (`data_quality.limitations`).

---

## 5. Operator view (operator-friendly audit rendering)

The entries are only worth producing if the operator meets them where outreach happens. Three surfaces render `outreach_problems`; all three read the same shape, so one card component serves them.

### 5.1 Where the entries land

| Surface | Source | Rendering |
|---|---|---|
| Triage briefing panel | `campaign.repair_triage_briefing.outreach_problems` | Card list in `RepairTrackPanel`, under the existing pitch/risks blocks |
| Per-issue briefings | `outreach_problems` parsed from the latest execution's `raw_output` | Same card list inside `RepairBriefingCard` (campaign Overview tab) — extend `RepairAuditOutput` + `parseBriefing` to read the field, tolerating its absence on pre-change executions |
| Business audits | `audit_data.outreach_problems` | New "Outreach ammunition" section in `BusinessAnalysisAuditCard` |

### 5.2 Card anatomy (per entry)

- **Headline** — the `problem` line, consequence-first.
- **Two spoken lines**, labeled and visually distinct:
  - **Regular** — shown by default; the plain professional line.
  - **Hook** — labeled "Hook", visually distinct (accent border), same fact, pattern-interrupt delivery.
- **Copy button per line** — one click puts the verbatim line on the clipboard; the operator never re-types analyst copy.
- **Solution** — rendered as "The fix" directly under the lines. It is intentionally a high-level summary (§2.2) — the operator maps it to the actual package; the card does not need to name one.
- **Evidence** — collapsible; the raw audit observation behind the problem.
- **Usage chip** — `outreach_use` rendered as a small tag ("Cold-call opener" / "Email hook" / "Objection response").

### 5.3 Opener hand-off

`createOpenerFromBriefing` currently sources only `pitch.opener_hook`. Extend it so any entry's `regular` or `hook` line can seed an opener from its card. This is **not** a frontend-only change:

- `openerFromBriefingSchema` in `marketing-ops.ts` constrains `source_briefing` to `z.enum(['triage', 'issue_audit'])` — widen it with `'business_audit'` so audit-card lines are accepted, and mirror the union in `MarketingOpsService.createOpenerFromBriefing`'s input type plus any `OpenerSource`/provenance typing downstream.
- For a per-problem line, `primary_angle` = the entry's `problem` text (consequence-first framing is exactly the angle); `execution_id` = the audit's execution id where available.
- `BusinessAnalysisAuditCard` has no opener affordance today — add a per-line "Use as opener" action to the new Outreach ammunition section.
- Triage/issue-audit cards keep `source_briefing: 'triage'` / `'issue_audit'`; only the audit card uses the new value.

The campaign-level opener stays the default; the per-problem lines give the operator fresh material across touches (call → email → follow-up) without repeating the same opener.

---

## 6. Seed mechanics & idempotency (AGENTS.md discipline)

- **Marker checks:** every script must gate on the **presence of the new versioned marker**, never the absence of an old section.
- **`insertAfter` fingerprints the first 80 chars** of the insertion — never bundle multiple bindings into one call. The new directive is a single self-contained block per template, so one `insertAfter` per template is correct; do not merge it with any other pending insertion.
- **`removeSection` swallows headingless content up to the next heading.** The new directive has a heading, so `removeSection` → `insertAfter` is safe; keep the insertion after all `removeSection` calls in each transform so every run self-heals.
- **Triage script full-body replace:** safe — runtime blocks (Category Intelligence, Gold Standard, Market Context) are appended by `MarketingExecutionService.resolvePrompt()` at render time and are not stored in the template body.
- **Full-body replace discards manual edits.** The triage + issue-briefing seeds replace the entire body when the marker is absent, so a marker bump wipes any hand edits made in the prompts UI since the last run. Export the live bodies first (§4.4.4).
- **No migrations.** No app-layer enums or `chk_` CHECK constraints are touched. (The `source_briefing` widening in §5.3 is a Zod enum in the route file — code, not a CHECK constraint.)

---

## 7. Rollout & verification

1. **Typecheck:** `pnpm checkapi` **and `pnpm checkweb`** — web types change (`TriageRecommendation`, `RepairAuditOutput`, `createOpenerFromBriefing` input union).
2. **Tests — required, not optional.** `pnpm checkapi` is `tsc` only and will NOT catch broken fixtures. Update `apps/api/src/validators/__tests__/profile-repair-output.schema.test.ts`: every "well-formed" fixture needs a non-empty `outreach_problems` array or it fails the moment `.min(1)` lands. Add boundary tests: missing field → reject; empty array → reject; 1 entry → pass; 3 → pass; 4 → pass (the cap is prompt-level, not validator-level). For `businessAnalysisSchema`: absent → pass; present → validate entry shape; empty array → reject. Run the api vitest suite.
3. **Re-run seeds** (from `apps/api`), each against both configs:
   ```powershell
   doppler run --config local -- npx tsx src/scripts/seed-profile-repair-triage-briefing.ts
   doppler run --config local -- npx tsx src/scripts/seed-profile-repair-issue-briefings.ts
   doppler run --config local -- npx tsx src/scripts/seed-business-audit-v2-templates.ts
   # repeat each with --config prd
   ```
4. **Staleness check (AGENTS.md):** each template's `updated_at` in the DB must be newer than the seed files' last git commit. A stale `updated_at` means the seed was not re-run after an edit.
5. **Render check:** open each of the seven templates (eight if §4.4.1 folds in `mpt-seed-seek-001`) in the prompts workspace and confirm (a) the new `### Operator Outreach Problems & Solutions — REQUIRED` section is in the body, and (b) the rendered prompt's JSON shape block includes `outreach_problems`. **V1 (`mpt-je6m7ru6`) is absent in prd** — this check applies to local only for that template (§4.4.3). **Gold-standard check:** render a repair prompt for a campaign in a category that has a gold standard but NO Category Intelligence profile — the `GOLD STANDARD BENCHMARK` block must appear (proves the §4.5 decoupling worked).
6. **Validation check:** paste a sample execution output with no `outreach_problems` field (or an empty array) → the import must reject it (`profile_repair_triage` / `profile_repair_audit`); with 1–3 entries → import succeeds. For `business_analysis`, confirm the Zod layer accepts absence (shared schema), rejects an empty array, and the rendered prompt instructs the 1–3 ranked-by-severity rule.
7. **Rollout ordering — schema and prompt bodies ship together.** Once the required `.min(1)` lands, the external-import path hard-rejects outputs missing `outreach_problems` — there is no graceful fallback (the AI-run path degrades via `_validated: false`; `importExternalResult` throws). Any in-flight output generated under the old prompt becomes unimportable. Deploy the validator change and the seed re-runs in the same step, and warn operators that stale clipboard output will need the field added manually.

---

## 8. Out of scope (future sprints)

- **Inline editing of entries** — the cards render analyst copy read-only this sprint, *deliberately*: the intended workflow is copy → paste into the pitch construction workspace (the openers workspace / Manual play lane), where the operator edits the line into their own pitch. The per-line copy buttons (§5.2) are the hand-off — editing or regenerating individual lines in place is a separate sprint.
- **Pitch-construction workspace integration** — pushing pairs into the workspace as structured slots (rather than copy-paste) is a deeper integration for a later sprint. Copy-paste is the contract this sprint: the 1–3 pairs are sized exactly for it.
- Collapsing `pitch.pain_points` into `outreach_problems` (backward-compat fields stay).
- Extending the same field to non-triage templates (fulfill, discovery, enrichment).
