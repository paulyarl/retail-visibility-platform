# Automated Seed Intelligence Report — Specification

> **Status:** Greenfield baseline specification
>
> **Scope:** Directory seed discovery, intelligence aggregation, owner claim, operator outreach, and automated report generation
>
> **Primary conversion:** Business is invited to claim its free seed, with the automated research report serving as the hook
>
> **Related specification:** `docs/LocalBiz/SEED_MARKET_INTEL_SIDEBAR_SPEC.md`

---

## 1. Executive summary

The platform constructs business seeds from fragmented public and category-specific intelligence. No single source is authoritative for most local businesses. A seed is therefore a probabilistic, provenance-aware identity record that becomes more valuable when the business verifies and claims it.

The platform must automatically generate a report that explains how the seed was constructed:

- what businesses and sources were discovered;
- how name, address, phone, category, and location identity were reconciled;
- what was observed versus what remains unverified;
- which discovery signals were detected;
- whether the platform contacted the business;
- what the business confirmed, corrected, disputed, or reported;
- what the business receives by claiming the seed.

The report is not initially a sales audit or a deficiency scorecard. It is the evidence-backed explanation of the platform's research effort and the invitation to verify and claim the resulting seed.

The core product message is:

> **We found your business, assembled the available evidence, and documented how your seed was constructed. Claim it to verify the work and take control of the record.**

---

## 2. Product objective

### 2.1 Objective

Turn the intelligence gathered during seed construction into an automated, provenance-aware report that can be used as:

1. a free business-facing claim preview;
2. an owner-verification workspace;
3. an operator intelligence and outreach brief;
4. a versioned historical record;
5. the foundation for later paid market intelligence and business-audit products.

### 2.2 Conversion model

```text
Public signals discovered
        ↓
Business identity reconciled
        ↓
Free seed constructed
        ↓
Evidence and unresolved questions summarized
        ↓
Optional operator verification
        ↓
Automated seed intelligence report
        ↓
Business invited to claim seed with report as the hook
        ↓
Owner confirms/corrects information
        ↓
Claimed first-party business record
        ↓
Optional paid intelligence, repair, or growth work
```

### 2.3 Product positioning

The report must position the platform as having performed useful research, without overstating certainty:

> We did the initial intelligence work. You can review the evidence, correct what is outdated, and claim the seed as the verified starting record for your business.

The report must not imply:

- that the platform owns or controls the business listing before claim;
- that unverified information is authoritative;
- that a missing field proves a business deficiency;
- that a contact attempt confirms a business pain;
- that the report is a complete census of every public source;
- that the business has failed an audit merely because evidence was unavailable.

---

## 3. Existing system context

### 3.1 Existing market intelligence

`SEED_MARKET_INTEL_SIDEBAR_SPEC.md` already defines a market-intelligence surface for seed pages, including teaser content, partial/full content, paid access, owner-claim access, and PDF generation.

This specification extends that work by defining the upstream evidence contract and the seed-construction report. It does not replace the market-intelligence sidebar. The two products should share normalized report facts where possible.

Existing intelligence sources include:

- directory presence seed data;
- directory listings and platform observations;
- business analysis audit output;
- category intelligence profiles;
- city/location intelligence;
- gold-standard profiles;
- outreach intelligence worksheets;
- outreach logs and call details;
- owner claim and correction events;
- manual outreach anchors.

### 3.2 Existing report generation

`MarketIntelReportPdfService` currently renders a multi-section market intelligence PDF with executive summary, market position, category signals, gold-standard comparison, growth opportunities, market gaps, recommendations, and market context.

The automated seed report must use a validated report DTO before rendering. The PDF renderer must not interpret raw prompt JSON directly.

The current market-intelligence PDF can remain the paid/deeper report format. The seed-construction report is a separate report mode with a different emphasis:

| Report | Primary purpose |
|---|---|
| Seed construction report | Explain research effort and invite claim |
| Claimed seed report | Show owner-confirmed baseline and corrections |
| Market intelligence report | Provide market context, opportunities, comparison, and recommendations |
| Business audit report | Diagnose business-specific conditions and recommend remediation |

### 3.3 Existing outreach context

The outreach opener, pitch, and call-script systems currently resolve a detected archetype from accepted triage or audit fallback. A manual outreach anchor must be added as a separate operator-controlled layer.

```text
Detected archetype
  = system interpretation of available evidence

Manual outreach anchor
  = operator-selected fact, uncertainty, or question for a contact attempt

Owner verification event
  = what the business actually confirmed, corrected, disputed, or reported
```

A manual anchor must not replace or mutate the detected archetype.

### 3.4 Existing substrate and non-duplication rules

This report system is greenfield at the report layer, not greenfield across the seed platform. The implementation must extend existing seed, provenance, signal, tone, claim, and outreach infrastructure rather than create parallel sources of truth.

| Existing substrate | Existing responsibility | Report integration |
|---|---|---|
| `directory_presence_seeds` | Resolved seed identity, category fit, owner verification, claim/outreach state | Primary identity and claim-status source |
| `directory_field_provenance` | Per-field source, URL, access date, confidence, owner override, public visibility | Primary field-provenance source; add report evidence state and notes if required |
| `directory_seed_nap_verifications` | Versioned NAP verification and owner corrections | Owner-correction history |
| `directory_seed_outreach_touches` | Per-seed outreach channel, outcome, notes, operator, and occurrence | Seed-level outreach history and report verification events |
| `mkt_signal_registry` | Signal code, family, label, description, detection source, active state | Canonical `INT_*` signal registry |
| `mkt_category_tone_presets_list` | Per-category tone presets | Category-aware tone resolution |
| `mkt_prompt_templates_list` | Prompt ID, version, tone, fragment kind, output schema | Prompt/fragment metadata and contract version |
| `directory_claim_tokens` and existing claim services | Claim-token generation, claim flow, and ownership verification | Report CTA handoff; do not create a second claim-token system |
| `mkt_outreach_log` | Campaign-level outreach and call details | Campaign outreach record; seed touches remain in the seed-level table |

The following rules are mandatory:

1. Do not create `mkt_seed_report_observations` as a second field-provenance table.
2. Extend `directory_field_provenance` additively for `evidence_state`, `notes`, and report linkage only if schema review confirms those fields are needed.
3. Do not hardcode the `INT_*` allowlist as the runtime source of truth. Validate signal codes against `mkt_signal_registry`; TypeScript types may provide compile-time convenience only.
4. Do not copy the shared tone directive independently into every prompt body. Resolve the shared directive through the existing prompt-template and category-tone systems.
5. Do not create a second seed-level outreach history. Anchor verification must write to `directory_seed_outreach_touches`; campaign-level details may additionally write to `mkt_outreach_log`.
6. Do not re-derive seed identity from raw observations when the resolved seed row already contains the current canonical identity and verification state.
7. Do not create a second claim-token or claim-completion flow.

The only new persistence objects required by this specification are the versioned seed report snapshot and the manual outreach anchor, plus additive fields/migrations where the existing substrate cannot represent the required state.

---

## 4. Design principles

### 4.1 Evidence before narrative

Prompts produce structured observations and provenance. The report service turns those observations into business-facing narrative.

```text
Prompt outputs
    ↓
Schema validation
    ↓
Evidence normalization
    ↓
Identity and conflict resolution
    ↓
Report fact assembly
    ↓
Optional narrative generation
    ↓
HTML/PDF/report API
```

### 4.2 LLMs may phrase evidence but may not create evidence

Prompt-generated prose must be grounded in structured observation IDs. A model may summarize facts but may not invent:

- a source;
- a source URL;
- a business attribute;
- a current operating status;
- a customer pain;
- an owner confirmation;
- a negative finding that was not observed.

### 4.3 Absence is not a negative finding

Use explicit language:

- `not_found_during_discovery` — the field was not located in the sources checked;
- `not_checked` — the source or field was outside the run scope;
- `unknown` — the platform cannot establish the fact;
- `conflicting` — sources disagree.

Do not convert any of these states to `false` unless the source explicitly establishes a negative value.

### 4.4 Provenance is first-class

Every report fact must be traceable to one or more source observations, prompt outputs, owner responses, or operator events.

### 4.5 Owner confirmation outranks public discovery for business-owned fields

The precedence for a business field is:

1. current owner-confirmed value;
2. current business-provided value during a verified claim flow;
3. corroborated public-source value;
4. single-source public observation;
5. unresolved or unknown.

Owner confirmation must not erase the prior public observation. It creates a new versioned fact and records the change.

### 4.6 Research report before sales report

The free report should lead with:

- what was found;
- how it was found;
- what was reconciled;
- what remains to be verified;
- what claiming provides.

Potential opportunities may be shown, but the report must not lead with unsupported deficiencies or pressure language.

### 4.7 Tone and narrative quality

The report is a business-facing intelligence artifact, not a database export. Its tone must be appropriate to the business, category, and evidence available. It should be clear, energetic, constructive, and commercially aware.

The report must never be dull or dry.

Use:

- confident but qualified language;
- active verbs;
- concise explanations of why a finding matters;
- forward-looking opportunity language;
- a sense of momentum and practical next steps;
- category-aware examples where available;
- human language that respects the owner's time and expertise.

Avoid:

- generic filler such as “digital presence is important” without connecting it to discovery or customer decisions;
- bureaucratic source inventories with no explanation of why the sources matter;
- repetitive “observed / not observed” prose;
- alarmist, shaming, or adversarial language;
- exaggerated claims about customer loss, competitor behavior, rankings, or revenue;
- jargon such as “evidence normalization” in the customer-facing report;
- presenting uncertainty in a way that makes the report feel unfinished or careless.

The report should translate research into business meaning:

```text
Dry:
We found four sources containing a business name and address.

Appropriate:
Your business is already visible in four different places. We brought those
records together so you can see where the information agrees, where it differs,
and what customers may encounter when they look you up.
```

```text
Dry:
Website not found during discovery.

Appropriate:
We did not locate an owned website in the sources checked. That is an open
question for verification—not a conclusion that no website exists. If you have
one, claiming the seed is an opportunity to connect it to the record customers
are already finding.
```

```text
Dry:
Three competitors have claimed listings.

Appropriate:
Several comparable businesses are already establishing verified records in this
market. Claiming yours gives you a clear starting point for making sure customers
see the right business, the right details, and the reasons to choose you.
```

The automated narrative layer may use an LLM for phrasing, but every substantive
claim must be grounded in report facts and source observation IDs. The tone may
be lively; the evidence must remain precise.

---

## 5. Report lifecycle and versioning

### 5.1 Generation triggers

Generate or regenerate a report when report-visible evidence changes:

- a seed is created with minimum qualifying identity evidence;
- new source observations change a report fact;
- a category or city intelligence run changes report-visible context;
- identity resolution changes;
- an owner claims the seed;
- an owner submits corrections;
- an owner verification event changes a report fact;
- a report is explicitly refreshed by an authorized operator;
- a prior report is stale and a scheduled re-engagement check requires a delta report.

The following events do **not** create a new report version by themselves:

- creating a draft manual anchor;
- activating an anchor without new evidence;
- logging a contact attempt with no verified fact or owner response;
- changing an internal operator note;
- rendering the same report version in a different format.

Those events update their own audit or outreach records. If they include a new owner-confirmed fact, correction, dispute, or owner-reported pain, they may trigger a new report version through the verification-event path.

### 5.2 Minimum evidence and outreach eligibility

A seed report has two separate decisions:

```text
Can a report be generated internally?
Can the report be used as a business-facing claim hook?
```

A report may be generated internally with `insufficient_evidence` for operator review, but it must not be sent to a business or expose a claim CTA.

Business-facing claim-hook eligibility requires:

- a category-qualified identity candidate;
- identity confidence of `medium` or `high`;
- an inside-city, adjacent-city, or metro-area classification;
- at least one reliable source observation;
- no unresolved identity conflict that would make the claim ambiguous;
- a valid seed and claim-token handoff.

`provisional` may be used as a claim hook only when the identity is sufficiently coherent and the unresolved fields are optional. `requires_identity_review` and `insufficient_evidence` are operator-internal statuses.

### 5.3 Versioning

Reports are immutable versions. A new report version is created when report inputs change.

```text
Report v1 — initial public-source discovery
Report v2 — additional directory/source reconciliation
Report v3 — operator verification activity added
Report v4 — owner claimed and corrected fields
```

A report version stores the prompt template versions, source snapshot IDs, and evidence IDs used to produce it.

### 5.3 Report status

```ts
type SeedReportStatus =
  | 'provisional'
  | 'complete'
  | 'requires_identity_review'
  | 'insufficient_evidence'
  | 'claimed';
```

Suggested status rules:

- `provisional`: at least one source and a candidate identity exist, but required identity fields remain unresolved;
- `complete`: a qualifying identity and category/location classification are established from available evidence;
- `requires_identity_review`: conflicting identity records cannot be safely reconciled;
- `insufficient_evidence`: no reliable category-qualified identity can be established;
- `claimed`: the business completed verified claim, regardless of remaining optional fields.

### 5.4 Re-engagement and report deltas

A new report version is a re-engagement opportunity only when it contains meaningful report-visible change.

Track at minimum:

- report version viewed/unviewed;
- claim started/completed;
- prior outreach outcome;
- last delivery date;
- delta summary between the prior and current report;
- whether the prior report was declined, ignored, or unreachable.

When all of the following are true, create a re-engagement suggestion:

- the prior report was delivered;
- the seed remains unclaimed;
- the prior report was not viewed or did not produce a response;
- a newer report version contains a meaningful delta, owner-confirmed fact, new source, corrected identity field, or newly available claim path;
- the courtesy/follow-up policy allows another contact.

The re-engagement message must lead with the delta, not resend the same report:

> We refreshed the business record we prepared for you and found [new or corrected item]. The updated report is ready if you would like to review and claim it.

No new report version or re-engagement is created solely because a timer elapsed. Respect contact frequency, channel preference, opt-out, and prior decline states.

### 5.5 Reproducibility metadata

```json
{
  "report_id": "sir-123",
  "seed_id": "seed-456",
  "version": 3,
  "generated_at": "2026-09-15T15:30:00Z",
  "generated_from": {
    "prompt_templates": [
      {
        "template_id": "intelligence-discovery",
        "template_version": 4
      }
    ],
    "source_snapshot_ids": ["snapshot-1", "snapshot-2"],
    "evidence_ids": ["evidence-1", "evidence-2"]
  },
  "evidence_count": 42,
  "unresolved_count": 7,
  "owner_verification_count": 1
}
```

---

## 6. Prompt contract

Existing prompts are multitask prompts. They should not be rewritten into report-writing prompts. Instead, each relevant prompt receives an additive `report_evidence` output contract.

### 6.0 Contract scope: per-candidate evidence

`report_evidence` is emitted **per candidate business**, not once for the entire discovery run.

A discovery run may return many candidates. Each candidate that can become a seed receives its own evidence block keyed by the candidate's stable run-local key. The normalizer then maps that candidate to an existing `directory_presence_seeds.id` or creates a new seed identity through the existing seed-creation flow. The contract must extend the existing intelligence-discovery output schema rather than introduce a competing candidate envelope.

```ts
interface CandidateReportEvidence {
  candidate_key: string;
  business_name: string | null;
  city: string | null;
  state: string | null;
  report_evidence: ReportEvidenceOutput;
}
```

Run-level metadata such as prompt version, source batch, and discovery date remains on the prompt execution record. Candidate-level observations, identity candidates, category assessment, platform observations, and `INT_*` signals belong inside the candidate block.

This prevents a city/category discovery run from accidentally applying one business's evidence or signal to every candidate in the run.

### 6.1 Common directive

The following directive should be added to relevant intelligence prompt templates:

```text
REPORT EVIDENCE DIRECTIVE

In addition to completing the primary task, return a report_evidence object.

Record only information supported by the supplied research or tool results.
Do not infer missing information as negative evidence.

For every observed business fact:
- identify the field;
- provide the observed value;
- classify the evidence state;
- provide confidence;
- identify the source;
- include the source URL when available;
- include the observation date when available.

Use "not_found_during_discovery" when a field was not located in the sources checked.
Do not use "does_not_exist" unless a source explicitly confirms nonexistence.

Return unresolved questions separately from observations.
Return discovery signals separately from business-audit signals.
Do not calculate fees, benchmarks, rankings, or audit deficiencies unless the primary task explicitly requires them.
```

The exact directive may be adapted for prompt size and task context, but the semantics must remain consistent.

### 6.2 Common report-evidence schema

```ts
interface ReportEvidenceOutput {
  observations: ReportObservation[];
  identity_candidates: IdentityCandidate[];
  category_assessment: CategoryAssessment | null;
  geographic_assessment: GeographicAssessment | null;
  signals: ReportSignal[];
  unresolved_questions: UnresolvedQuestion[];
  platform_observations: PlatformObservation[];
}
```

### 6.3 Report observation

```ts
type EvidenceState =
  | 'confirmed'
  | 'observed'
  | 'probable'
  | 'conflicting'
  | 'not_found_during_discovery'
  | 'not_checked'
  | 'owner_confirmed'
  | 'owner_corrected'
  | 'owner_disputed';

type EvidenceConfidence = 'high' | 'medium' | 'low' | 'unknown';

interface ReportObservation {
  observation_id?: string;
  subject: string;
  field: string;
  value: unknown;
  state: EvidenceState;
  confidence: EvidenceConfidence;
  source_name: string;
  source_type: string;
  source_url: string | null;
  observed_at: string | null;
  notes: string | null;
}
```

The normalizer assigns a stable observation ID if the prompt does not supply one.

### 6.4 Identity candidate

```ts
interface IdentityCandidate {
  business_name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  identity_confidence: 'high' | 'medium' | 'low';
  basis: string[];
  source_observation_ids: string[];
}
```

### 6.5 Category assessment

```ts
interface CategoryAssessment {
  category: string;
  subcategory: string | null;
  category_fit: 'verified' | 'probable' | 'insufficient';
  basis: string[];
  source_observation_ids: string[];
}
```

### 6.6 Geographic assessment

```ts
interface GeographicAssessment {
  location_status:
    | 'inside_city'
    | 'adjacent_city'
    | 'metro_area'
    | 'outside_market';
  basis: string[];
  source_observation_ids: string[];
}
```

### 6.7 Discovery signals

Discovery prompts may emit only active signals from the `mkt_signal_registry` where:

```text
family = 'INT'
code begins with 'INT_'
is_active = true
```

The registry is the runtime allowlist and metadata source. The TypeScript type may expose known codes for developer ergonomics, but it must not be the authoritative validation mechanism.

```ts
interface ReportSignal {
  code: string;
  family: 'INT';
  label: string;
  basis: string;
  source_observation_ids: string[];
  registry_signal_id: string;
}
```

The normalizer must reject, quarantine, or mark invalid any prompt signal that:

- is not present in `mkt_signal_registry`;
- is inactive;
- does not belong to the `INT` family;
- lacks an evidence basis;
- lacks source observation IDs when the signal claims to be evidence-backed.

The initial `INT_*` codes from the category profile must be seeded into `mkt_signal_registry`, not maintained only in a TypeScript union.

Business-audit signal families must not be mixed into intelligence-scope discovery output.

### 6.8 Unresolved questions

```ts
interface UnresolvedQuestion {
  field: string;
  question: string;
  reason: string;
  suggested_verification_method:
    | 'owner_claim'
    | 'phone_call'
    | 'email'
    | 'website_review'
    | 'source_refresh'
    | 'operator_review';
}
```

### 6.9 Platform observation

```ts
interface PlatformObservation {
  platform: string;
  presence: 'observed' | 'not_found_during_discovery' | 'not_checked';
  business_name: string | null;
  address: string | null;
  phone: string | null;
  primary_category: string | null;
  hours_present: boolean | null;
  website_present: boolean | null;
  claimed_status: 'claimed' | 'unclaimed' | 'not_verified' | null;
  attributes: Array<{
    key: string;
    label: string;
    value: string | boolean | null;
  }>;
  source_url: string | null;
  observed_at: string | null;
}
```

`claimed_status: "not_verified"` is required when the source does not explicitly establish claimed or unclaimed status.

### 6.10 Shared tone directive for all fragment creation surfaces

Tone consistency must be enforced when intelligence fragments are created, not only when the final report is assembled. Every prompt or seed script that creates reusable narrative fragments must receive the shared tone directive.

This applies to all fragment creation surfaces, including:

- business intelligence fragments;
- intelligence discovery fragments;
- category intelligence fragments;
- location intelligence fragments;
- enrichment fragments;
- report-summary fragments;
- claim and outreach explanation fragments;
- any future prompt-composition or enrichment surface that produces business-facing text.

The shared directive must be composed through the existing prompt-template and category-tone systems:

1. Resolve the active `mkt_prompt_templates_list` row for the task.
2. Resolve the applicable `mkt_category_tone_presets_list` row for the category and tone.
3. Compose the shared business-intelligence tone directive once through the prompt-composition layer.
4. Append the report-evidence directive and output schema.
5. Record the resolved template ID/version and tone preset ID/version in execution metadata.

Do not copy the full directive independently into every prompt body or seed transform. This prevents tone drift and avoids seed-script insertion failures. If a prompt needs a category-specific adjustment, change the tone preset or composition rule, not a one-off fragment body.

```text
SHARED BUSINESS INTELLIGENCE TONE DIRECTIVE

Write for a capable business owner or operator. Be clear, specific, useful, and
forward-looking. The writing should feel intelligent and commercially aware,
never dull, dry, bureaucratic, alarmist, or generic.

Explain why a finding matters to visibility, customer discoverability, marketplace
expectations, or the next practical business decision. Use active language and
concrete observations. Create constructive momentum and, when supported by market
evidence, explain the opportunity to keep pace with comparable businesses.

Do not shame the business. Do not imply that incomplete public information proves
poor business quality. Do not claim that a visibility observation caused lost
customers or revenue unless the evidence explicitly supports that conclusion.
Do not convert an unavailable field into a negative finding.

Separate observed evidence, interpretation, opportunity, and owner-confirmed
information. Use qualified language when evidence is incomplete. Every substantive
claim must be grounded in the structured evidence returned by this prompt.

The result should be engaging enough to start a useful conversation and precise
enough to support an intelligence report.
```

### 6.10.1 Fragment metadata

Each reusable fragment should carry evidence and audience metadata. Prompt-template identity, version, tone, and fragment kind must be derived from the existing `mkt_prompt_templates_list` row rather than duplicated as independently editable fragment fields.

```ts
interface IntelligenceFragmentMetadata {
  fragment_id: string;
  fragment_family: string;
  intended_audience: 'operator' | 'business_owner' | 'customer' | 'internal';
  evidence_observation_ids: string[];
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  generated_at: string;
  prompt_template_id: string;
  prompt_template_version: number;
  prompt_fragment_kind: string | null;
  prompt_tone: string | null;
  category_tone_preset_id: string | null;
  category_tone_preset_updated_at: string | null;
}
```

`prompt_fragment_kind`, `prompt_tone`, and template version are read from the persisted prompt-template record at execution time. The report assembler must not invent a separate tone profile that can diverge from the template registry.

Fragments may vary in emphasis by family, but they must share the same voice:

| Fragment family | Emphasis | Shared tone requirement |
|---|---|---|
| Business | What was found about this business | Specific, respectful, opportunity-oriented |
| Intelligence | What the evidence means | Analytical but readable |
| Category | How the category behaves | Local, concrete, commercially useful |
| Location | How geography affects discovery | Contextual, practical, non-alarmist |
| Enrichment | Additional source or market detail | Useful, qualified, provenance-aware |
| Report | What the combined evidence means | Engaging, concise, conversion-aware |
| Outreach | How to start the conversation | Human, direct, respectful |

A fragment must never become more certain merely because it is reused in a later
report. The report assembler can improve flow and readability, but it cannot
upgrade the fragment's evidence state or confidence without new evidence.

---

## 7. Prompt-specific responsibilities

### 7.1 Category discovery prompts

Must contribute:

- candidate businesses;
- name variants;
- address and phone variants;
- category fit and subtype;
- geographic classification;
- ownership evidence;
- discovery source provenance;
- deduplication clues;
- current-status uncertainty;
- `INT_*` signals.

Must not contribute:

- business-audit scores;
- unsupported digital deficiencies;
- fees;
- sales rankings;
- competitive benchmarks unless explicitly requested by a competitive-scope task.

### 7.2 Directory/platform discovery prompts

Must contribute:

- platform presence;
- listing identity;
- NAP values;
- category labels;
- hours;
- website links;
- explicit claimed/unclaimed status;
- displayed platform attributes;
- source freshness.

They must distinguish `not_found_during_discovery` from `not_checked`.

### 7.3 Category intelligence prompts

Must contribute:

- category definition;
- subcategories;
- local terminology;
- specialized sources;
- discovery patterns;
- category-specific evidence rules;
- prohibited inferences;
- relevant discovery signal definitions.

### 7.4 City/location intelligence prompts

Must contribute:

- city and metro classification;
- adjacent-city relationships;
- relevant ZIP codes and neighborhoods;
- food-access context;
- local market dynamics;
- geographic caveats.

### 7.5 Business analysis prompts

May contribute:

- business-specific audit observations;
- platform observations;
- business-audit signal families;
- gold-standard comparison data.

These facts must remain separated from discovery intelligence in the normalized evidence model.

---

## 8. Evidence normalization

Create a dedicated normalization layer between prompt execution and report generation.

Suggested service:

```text
apps/api/src/services/intelligence/SeedReportEvidenceService.ts
```

Responsibilities:

- validate prompt output with Zod;
- assign stable observation IDs;
- normalize field names;
- normalize source types and URLs;
- preserve raw prompt output for traceability;
- deduplicate equivalent observations;
- detect conflicting values;
- separate discovery, audit, market, and owner evidence;
- resolve identity candidates;
- aggregate active `INT_*` signals from `mkt_signal_registry`;
- read current resolved identity and claim state from `directory_presence_seeds`;
- read field provenance from `directory_field_provenance`;
- read owner NAP corrections from `directory_seed_nap_verifications`;
- read seed outreach from `directory_seed_outreach_touches`;
- read campaign-specific outreach details from `mkt_outreach_log` where linked;
- produce a report-ready evidence snapshot without creating a duplicate observations table.

### 8.1 Normalization rules

- Never discard a conflicting observation; mark the field `conflicting` and retain both sources.
- Never replace an unavailable value with an inferred negative.
- Never promote a single-source identity to high confidence without corroboration.
- Never treat an owner contact attempt as owner confirmation unless a connected representative confirms the fact.
- Never treat an owner-reported pain as a platform-observed pain.
- Preserve the original observation date.
- Preserve the prompt template version that produced the observation.
- Treat `directory_field_provenance` as the field-level provenance source of truth.
- Treat `directory_presence_seeds` as the current resolved seed identity source of truth.
- Treat `directory_seed_nap_verifications` as the owner-correction history source of truth.
- Treat `directory_seed_outreach_touches` as the seed-level contact history source of truth.

### 8.2 Evidence-state extension

The existing `directory_field_provenance.confidence` field provides confidence but not the full report evidence-state taxonomy. Add an additive `evidence_state` field and optional `notes`/report linkage through a numbered migration after schema review.

Recommended values:

```text
confirmed
observed
probable
conflicting
not_found_during_discovery
not_checked
owner_confirmed
owner_corrected
owner_disputed
```

Existing provenance rows must receive a safe backfill value based on their current confidence and override fields. The backfill must not claim owner confirmation where no owner override exists.

### 8.3 Tone and claim-safety linting

Prompt directives are necessary but not sufficient. Before a report version is rendered or published, `SeedReportEvidenceService` or the report validation layer must run deterministic lint checks.

The linter must flag or block:

- unsupported phrases such as `no website`, `no Google profile`, or `does not exist` when the fact state is only `not_found_during_discovery`;
- fear-based claims that competitors will take customers;
- unsupported claims about lost revenue, lost customers, rankings, or business quality;
- peer-effect claims without a verified peer metric;
- customer-facing text that exposes internal prompt instructions or operator notes;
- substantive narrative sentences with no grounded report fact or evidence reference;
- dry placeholder output that exposes internal state labels without a business-facing explanation.

The linter produces:

```ts
interface ReportLintResult {
  passed: boolean;
  blocking_issues: Array<{ code: string; message: string; evidence_ids: string[] }>;
  warnings: Array<{ code: string; message: string; evidence_ids: string[] }>;
}
```

A blocking lint failure prevents publication and preserves the last successful report version.

### 8.4 Evidence precedence

For business-owned fields:

```text
owner_confirmed/current business-provided
  > corroborated public source
  > single public source
  > inferred/derived
  > unknown
```

For platform-presence facts:

```text
explicit platform observation
  > trusted directory observation
  > inferred presence
  > not_found_during_discovery
```

Derived values must retain their source observation IDs and must never be presented as direct observations.

---

## 9. Report DTO

The report builder consumes normalized evidence and produces a stable DTO.

The builder must read the current canonical identity and claim state from `directory_presence_seeds`, not reconstruct those values solely from raw prompt observations. Raw observations and `directory_field_provenance` explain how the seed was built; the seed row represents the current resolved record.

The builder must read owner correction history from `directory_seed_nap_verifications` and seed-level contact history from `directory_seed_outreach_touches`. Campaign-level details may be joined from `mkt_outreach_log` when a seed-to-campaign link exists.

```ts
interface SeedIntelligenceReport {
  report_id: string;
  seed_id: string;
  version: number;
  status: SeedReportStatus;
  generated_at: string;
  generated_from: ReportGenerationMetadata;

  business_identity: BusinessIdentitySection;
  source_summary: SourceSummarySection;
  identity_reconciliation: IdentityReconciliationSection;
  market_classification: MarketClassificationSection;
  platform_presence: PlatformPresenceSection;
  category_fit: CategoryFitSection;
  intelligence_signals: IntelligenceSignalSection;
  verification_activity: VerificationActivitySection;
  claim_summary: ClaimSummarySection;
  next_actions: NextActionSection;
}
```

### 9.1 Business identity section

```ts
interface BusinessIdentitySection {
  business_name: ReportFact;
  address: ReportFact;
  phone: ReportFact;
  website: ReportFact;
  city: ReportFact;
  state: ReportFact;
  owner_name: ReportFact;
  ownership_type: ReportFact;
}
```

### 9.2 Report fact

```ts
interface ReportFact {
  field: string;
  value: unknown;
  state: EvidenceState;
  confidence: EvidenceConfidence;
  source_observation_ids: string[];
  owner_verified_at: string | null;
  display_note: string | null;
}
```

### 9.3 Source summary section

```ts
interface SourceSummarySection {
  sources_checked_count: number;
  sources_with_evidence_count: number;
  source_types: Array<{
    source_type: string;
    source_name: string;
    role: string;
    observation_count: number;
  }>;
  identity_signals_count: number;
  name_variants_count: number;
  address_variants_count: number;
  unresolved_count: number;
}
```

### 9.4 Identity reconciliation section

```ts
interface IdentityReconciliationSection {
  canonical_candidate: IdentityCandidate | null;
  alternate_names: string[];
  alternate_addresses: string[];
  alternate_phones: string[];
  conflicts: Array<{
    field: string;
    values: Array<{
      value: string;
      source_observation_ids: string[];
    }>;
    resolution: 'resolved' | 'unresolved';
  }>;
  identity_confidence: 'high' | 'medium' | 'low';
}
```

### 9.5 Claim summary section

```ts
interface ClaimSummarySection {
  claim_status: 'unclaimed' | 'claim_invited' | 'claim_pending' | 'claimed';
  claim_url: string | null;
  claim_benefits: string[];
  owner_confirmation_count: number;
  owner_correction_count: number;
}
```

---

## 10. Automated report sections

The initial seed report should contain the following sections.

### 10.1 Report introduction, cover, and executive summary

The report introduction is the narrative hook for the claim invitation. It should establish why visibility and discoverability matter before explaining what the platform found.

The introduction should connect four ideas:

1. **Visibility:** customers need to encounter the business in the places and contexts where they search, compare, and decide.
2. **Customer discoverability:** accurate identity, category, location, hours, services, and marketplace presence reduce uncertainty for prospective customers.
3. **Marketplace expectations:** customers increasingly expect businesses to have consistent, understandable, and verifiable information across search, directories, social platforms, and category-specific sources.
4. **Conversation:** public data can show signals, but the business is the best source for confirming what is current, what is inaccurate, and what customers have difficulty finding.

The introduction must connect the research effort to business success without claiming that an observed visibility gap caused lost revenue or poor performance. Use opportunity language rather than unsupported causality.

Recommended introduction structure:

```text
Visibility is part of how customers discover, evaluate, and choose a business.

Customers encounter businesses across search, maps, directories, social platforms,
local sources, and category-specific marketplaces. Those surfaces do not always
carry the same name, address, phone, hours, category, or description.

We researched the public signals associated with your business and assembled them
into a free business seed. This report explains what we found, where we found it,
what appears consistent, and what still needs confirmation.

The purpose is not to assume what is wrong with your business. It is to make the
available intelligence visible, start a useful conversation, and give you the
opportunity to verify and claim the record that represents you in the marketplace.
```

Include:

- business name;
- city/state;
- seed status;
- report version;
- generation date;
- report purpose;
- concise explanation of the research effort;
- relationship between discoverability, marketplace expectations, and business choice;
- clear distinction between observed evidence and owner-confirmed information.

Suggested business-facing copy:

> Visibility is part of how customers discover, evaluate, and choose a business. They may encounter you through search, maps, directories, social platforms, local sources, or category-specific marketplaces, and those sources may not all represent your business in the same way.
>
> We researched the public signals associated with your business and assembled them into a free business seed. This report shows what we found, where it came from, what appears consistent, and what still needs confirmation. The goal is to make the available intelligence visible, start a useful conversation, and give you the opportunity to verify and claim the record that represents your business.

### 10.1.1 Forward-looking opportunity and peer effect

The introduction may create constructive urgency through a peer effect only when the platform has a real, reproducible peer metric. This should be framed as an opportunity to stay visible and prepared, not as a threat.

Peer-effect copy is eligible only when all of the following are true:

- a category and geographic cohort is defined;
- the cohort membership is reproducible;
- the metric is calculated from current `directory_presence_seeds` data or another approved source;
- the metric denominator and observation date are available;
- the metric does not expose another business's private information;
- the report can cite the cohort methodology in internal provenance.

The initial supported metric should be explicit claim participation, for example:

```text
peer_claim_rate = claimed seeds in cohort / eligible seeds in cohort
```

If the peer metric is unavailable, omit peer-effect copy entirely. Do not substitute phrases such as “most competitors,” “many businesses,” or “some comparable businesses” merely to create urgency.

When the market evidence supports it, the report may explain:

- how many comparable businesses are already represented in the directory or market surface;
- how claimed or verified peer records can create a higher marketplace expectation;
- that peers who verify and improve their records may become easier for customers to discover and compare;
- that claiming early gives the business a chance to establish an accurate record before the category becomes more crowded;
- that the business can turn the same intelligence into a stronger, more trustworthy customer-facing presence.

Use only the calculated peer metric and its defined cohort. When the metric is available, use language that names the measurement window and avoids implying a performance guarantee:

> In the [category] cohort we measured in [market] on [date], [claimed_count] of [eligible_count] eligible business seeds had been claimed. Claiming your seed gives you a practical starting point for making sure your business is accurately represented as this marketplace develops.

If the metric is unavailable, use the non-peer version of the introduction and do not mention competitors or comparable businesses.

Suggested optimistic transition:

> This is not a conclusion about the quality of your business. It is a starting point and an opportunity. By verifying the information we found, you can make it easier for customers to understand who you are, what you offer, and how to reach you — while keeping pace with the way businesses in your category are becoming more visible online.

The introduction must avoid:

- claiming that visibility caused a specific revenue or customer loss without evidence;
- treating incomplete public information as proof of poor business quality;
- presenting the report as a definitive audit before the business has participated;
- claiming that most competitors are present unless the market evidence supports that statement;
- implying that competitors will automatically take customers because the business has not claimed;
- using fear-based language to force the claim.

### 10.2 What we found

Show evidence counts rather than unsupported quality claims:

```text
Sources checked: 6
Independent identity signals: 4
Name variants found: 2
Address variants found: 1
Phone numbers found: 1
Website references found: 1
Owner verification: Not yet completed
```

### 10.3 Business identity

Display a field table with:

- current candidate value;
- evidence state;
- confidence;
- source count;
- owner-confirmed indicator;
- conflict indicator.

### 10.4 Source trail

For each meaningful source:

- source name;
- source role;
- evidence type;
- URL when available;
- observed date;
- fields contributed.

### 10.5 Category and market classification

Include:

- category fit;
- subcategory;
- location status;
- ownership classification;
- category-profile context;
- relevant operational or community signals.

This section is descriptive and must not become an unsupported quality judgment.

### 10.6 Digital presence map

Show platform observations with clear states:

```text
Google — observed / not found during discovery / not checked
Facebook — observed / name variant / not found during discovery
Yelp — observed / not found during discovery
Owned website — observed / not found during discovery
Vertical sources — source names and roles
Local press — source names and roles
```

### 10.7 Intelligence signals

For each `INT_*` signal:

- signal code;
- human-readable label;
- evidence basis;
- source links or observation IDs.

### 10.8 Verification activity

Only display this section when contact or owner-verification events exist.

Include:

- date;
- channel;
- purpose;
- contact outcome;
- facts confirmed;
- facts corrected;
- facts disputed;
- owner-reported pain, if any;
- claim response;
- next action.

### 10.9 Claim invitation

End with the claim value proposition:

> Claiming is free. It lets you confirm ownership, correct inaccurate information, add missing details, connect your preferred profiles, and establish the verified starting record for future intelligence.

Primary CTA:

```text
Claim this free business seed
```

---

## 11. Manual outreach anchor integration

### 11.1 Purpose

A manual anchor gives the operator a focused question to verify without changing the detected archetype.

```text
Detected archetype
  = system interpretation of available evidence

Manual anchor
  = operator-selected outreach thesis

Contact result
  = business response to the thesis
```

### 11.2 Anchor types

```ts
type ManualAnchorType =
  | 'identity_verification'
  | 'address_verification'
  | 'hours_verification'
  | 'operating_status_verification'
  | 'website_or_profile_claim'
  | 'category_verification'
  | 'service_verification'
  | 'customer_discovery_problem'
  | 'listing_accuracy'
  | 'seed_claim_invitation'
  | 'owner_reported_pain'
  | 'custom';
```

### 11.3 Anchor model

```ts
interface ManualOutreachAnchor {
  id: string;
  seed_id: string | null;
  campaign_id: string | null;
  business_prospect_id: string | null;
  anchor_type: ManualAnchorType;
  status: 'draft' | 'active' | 'used' | 'retired';
  title: string;
  operator_thesis: string;
  observed_issue: string | null;
  evidence_summary: string | null;
  evidence_refs: EvidenceReference[];
  verification_question: string;
  pain_question: string | null;
  recommended_transition: string | null;
  expected_verification:
    | 'confirm'
    | 'correct'
    | 'dispute'
    | 'discover'
    | 'claim'
    | 'not_applicable';
  created_by: string;
  activated_by: string | null;
  created_at: string;
  activated_at: string | null;
  retired_at: string | null;
}
```

### 11.4 Anchor rules

1. An active anchor affects outreach copy only.
2. It does not change the detected archetype.
3. The anchor evidence is copied into the report as operator-selected context.
4. The anchor is snapshotted when used for contact.
5. A contact attempt is not a verified fact.
6. A business response must be recorded separately from the operator thesis.
7. An owner-reported pain must not be represented as a platform-observed deficiency.
8. A no-answer or declined call must not reduce the business score.
9. Sibling campaigns may have separate anchors while sharing prospect-level research.

### 11.5 Example seed-claim anchor

```json
{
  "anchor_type": "seed_claim_invitation",
  "title": "Invite business to claim prepared seed",
  "operator_thesis": "The business has public presence signals across multiple sources, but ownership and current details are not verified.",
  "observed_issue": "Address and category information were found across directory and social sources.",
  "verification_question": "Is this still the correct business information?",
  "pain_question": "Do customers ever have trouble finding accurate information about the business online?",
  "recommended_transition": "We assembled a free seed from the public information we found. Would you like to review and claim it?",
  "expected_verification": "claim"
}
```

### 11.6 Contact result model

```ts
type AnchorVerificationResult =
  | 'not_attempted'
  | 'unreachable'
  | 'identity_confirmed'
  | 'identity_not_confirmed'
  | 'fact_confirmed'
  | 'fact_corrected'
  | 'fact_disputed'
  | 'pain_confirmed'
  | 'pain_not_present'
  | 'pain_discovered'
  | 'claim_accepted'
  | 'claim_declined'
  | 'follow_up_requested'
  | 'other';
```

An event may contain multiple results.

```json
{
  "anchor_id": "anchor-123",
  "call_result": "connected",
  "verification_results": [
    {
      "type": "identity_confirmed",
      "field": "business_identity",
      "value": true,
      "confidence": "confirmed"
    },
    {
      "type": "fact_corrected",
      "field": "hours",
      "previous_value": "9 AM–5 PM",
      "new_value": "10 AM–7 PM",
      "confidence": "confirmed"
    },
    {
      "type": "pain_not_present",
      "field": "customer_discoverability",
      "owner_response": "Most customers find us through community referrals."
    }
  ]
}
```

### 11.7 Owner-reported pain downstream handoff

An owner-reported pain is a first-party intelligence result, not an automatic business-audit signal. The verification service must persist it as an owner-reported finding with:

- source event ID;
- owner/contact confidence;
- exact or redacted response summary;
- related anchor ID;
- report version;
- consent and visibility scope.

The downstream handoff is:

```text
Owner reports pain
    ↓
Persist owner-reported finding
    ↓
Add report-safe verification summary
    ↓
Offer relevant next action
    ↓
Optionally create or link a business-audit opportunity
```

The default next action is a permission-based offer, not an automatic sale or archetype mutation:

> We heard that [business-reported concern]. We can show you what we found and outline a possible next step if you would like to explore it.

If the owner consents to further work, the finding may be linked to a paid business-audit campaign or an existing sibling campaign. The report must preserve the distinction between:

```text
platform-observed signal
owner-reported pain
business-audit recommendation
```

---

## 12. Persistence model

### 12.1 Report persistence decision

The implementation introduces one genuinely new report table:

```text
mkt_seed_intelligence_reports
```

It must not introduce `mkt_seed_report_observations`. Field-level provenance already exists in `directory_field_provenance` and must remain the source of truth for seed field provenance.

The report snapshot stores the assembled DTO, source/version metadata, and IDs of the existing provenance, audit, signal, outreach, and claim records used to build it. This gives immutable reproducibility without duplicating every field observation.

### 12.2 Suggested report table

```sql
CREATE TABLE mkt_seed_intelligence_reports (
  id                    varchar(255) PRIMARY KEY,
  seed_id               varchar(255) NOT NULL,
  version               integer NOT NULL,
  status                varchar(40) NOT NULL,
  report_mode           varchar(30) NOT NULL,
  report_data           jsonb NOT NULL,
  source_snapshot       jsonb NOT NULL,
  evidence_refs         jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at          timestamptz NOT NULL DEFAULT now(),
  published_at          timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seed_id, version)
);
```

`report_data` is the immutable `SeedIntelligenceReport` DTO snapshot. `source_snapshot` records prompt/template/source versions. `evidence_refs` references existing provenance and event IDs; it is not a second observation store.

### 12.3 Existing provenance extension

Extend `directory_field_provenance` only with additive fields required by the report contract:

```sql
ALTER TABLE directory_field_provenance
  ADD COLUMN evidence_state varchar(40),
  ADD COLUMN notes text;
```

The exact migration must first confirm current column names, constraints, and indexes. Existing rows receive a safe backfill; no row is upgraded to `owner_confirmed` without existing owner-override evidence.

Report versions retain provenance IDs in `evidence_refs`. Do not add report linkage if it can be derived from the immutable report snapshot; avoid storing duplicate relationships.

<!-- Duplicate observation DDL intentionally omitted; existing directory_field_provenance is the source of truth.

```sql
Legacy duplicate observation DDL intentionally omitted — existing directory_field_provenance is the source of truth. Legacy DDL intentionally omitted: (
  id                    varchar(255) PRIMARY KEY,
  seed_id               varchar(255) NOT NULL,
  report_id              varchar(255),
  subject               varchar(120) NOT NULL,
  field                 varchar(120) NOT NULL,
  value                 jsonb,
  evidence_state        varchar(40) NOT NULL,
  confidence            varchar(20) NOT NULL,
  source_name           varchar(255) NOT NULL,
  source_type           varchar(80) NOT NULL,
  source_url            text,
  observed_at           timestamptz,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);
```
-->

### 12.4 Suggested outreach anchor table

```sql
CREATE TABLE mkt_outreach_anchors (
  id                       varchar(255) PRIMARY KEY,
  seed_id                  varchar(255),
  campaign_id              varchar(255),
  business_prospect_id     varchar(255),
  anchor_type              varchar(50) NOT NULL,
  status                   varchar(20) NOT NULL DEFAULT 'draft',
  title                    varchar(255) NOT NULL,
  operator_thesis          text NOT NULL,
  observed_issue           text,
  evidence_summary         text,
  evidence_refs            jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification_question    text NOT NULL,
  pain_question            text,
  recommended_transition   text,
  expected_verification    varchar(30) NOT NULL,
  created_by               varchar(255) NOT NULL,
  activated_by             varchar(255),
  created_at               timestamptz NOT NULL DEFAULT now(),
  activated_at             timestamptz,
  retired_at               timestamptz
);
```

### 12.5 Outreach log integration

There are two outreach scopes and both must be preserved:

- `directory_seed_outreach_touches` is the seed-level source of truth for report-facing outreach history;
- `mkt_outreach_log` is the campaign-level source for campaign execution, scripts, and detailed call metadata.

When a campaign contact is linked to a seed, the anchor verification result must be written to the seed touch record and, when applicable, the campaign log in one service-level operation. The write must be idempotent using the contact event ID.

Add campaign-level anchor linkage only where needed:

```sql
ALTER TABLE mkt_outreach_log
  ADD COLUMN anchor_id varchar(255),
  ADD COLUMN anchor_snapshot jsonb,
  ADD COLUMN verification_results jsonb;
```

The anchor snapshot is required so historical reports remain accurate if an operator later edits or retires the anchor. The seed touch record receives a compact report-safe verification summary; private campaign notes remain campaign-scoped.

---

## 13. API surface

### 13.1 Report endpoints

```text
GET  /api/public/marketing/seed/:seedId/report/preview
GET  /api/public/marketing/seed/:seedId/report
GET  /api/public/marketing/seed/:seedId/report/pdf
GET  /api/customer/marketing/seed/:seedId/report
GET  /api/admin/marketing-ops/seeds/:seedId/report/versions
POST /api/admin/marketing-ops/seeds/:seedId/report/refresh
```

The exact route placement must align with existing public seed, customer, and marketing-ops route conventions.

### 13.2 Anchor endpoints

Anchors may be seed-scoped for claim/verification work or campaign-scoped for a specific outreach pipeline. A campaign-scoped anchor may reference its seed.

```text
GET    /api/admin/marketing-ops/seeds/:seedId/outreach-anchors
POST   /api/admin/marketing-ops/seeds/:seedId/outreach-anchors
GET    /api/admin/marketing-ops/:campaignId/outreach-anchors
POST   /api/admin/marketing-ops/:campaignId/outreach-anchors
GET    /api/admin/marketing-ops/outreach-anchors/:anchorId
PATCH  /api/admin/marketing-ops/outreach-anchors/:anchorId
POST   /api/admin/marketing-ops/outreach-anchors/:anchorId/activate
POST   /api/admin/marketing-ops/outreach-anchors/:anchorId/retire
```

The service must enforce that the operator can access the referenced seed/campaign and that a campaign anchor cannot point to an unrelated seed.

### 13.3 Call-script integration

Extend the existing call-script request with an optional anchor:

```text
GET /api/admin/marketing-ops/:campaignId/call-script?anchorId=<id>&angle=<angle>
```

Without `anchorId`, existing detected-archetype behavior remains unchanged.

### 13.4 Contact logging integration

Extend the current outreach log request:

```json
{
  "contact_channel": "phone",
  "contact_date": "2026-09-15",
  "outcome": "reached",
  "anchor_id": "anchor-123",
  "verification_results": [
    {
      "type": "identity_confirmed",
      "field": "business_identity",
      "value": true
    },
    {
      "type": "claim_accepted"
    }
  ],
  "call_details": {
    "call_result": "connected",
    "identity_verified": true,
    "operating_status_confirmed": true,
    "hook_response_notes": "Owner confirmed the address and requested the claim link."
  }
}
```

All external input must be validated with Zod. The existing outreach-log validation should be extended rather than bypassed.

### 13.5 Claim-flow handoff

The report CTA must use the existing `directory_claim_tokens` and `DirectoryClaimService` flow. It must not create a second claim mechanism.

The handoff is:

```text
Eligible report generated
    ↓
Existing active claim token resolved or issued
    ↓
Report CTA contains the tokenized claim URL
    ↓
Business opens mobile-safe claim route
    ↓
Claim form is pre-filled with seed identity fields
    ↓
Business verifies ownership through the existing claim flow
    ↓
Claim completion writes owner verification and unlocks claimed report access
```

Rules:

- A report preview may create or resolve a claim token, but token possession is not ownership verification.
- Owner unlock occurs only after verified claim completion.
- A consumed, expired, or invalid token must show a recoverable claim-start path rather than a dead end.
- The claim page must preserve the report context and return the user to the claimed seed/report after completion.
- The mobile path must work without requiring the operator to copy a URL manually.
- Claim-token issuance and owner-report access must be idempotent.
- The report CTA must be disabled for `insufficient_evidence` and `requires_identity_review` reports.

### 13.6 Report delivery by outreach channel

The report is the hook, but delivery is channel-specific:

| Channel | Primary action | Report delivery |
|---|---|---|
| Phone | Verify one fact, ask permission to send | Send claim/report link by the owner's preferred channel |
| Email | Introduce the research and claim invitation | Link to mobile-safe report preview and claim flow |
| Social | Short, respectful permission-based opener | Send link only after response or platform-appropriate permission |
| In person | Show or scan the report | QR code or short claim URL |
| Website/form | Confirm contact context | Email response with report/claim link |

Every delivery event records:

- channel;
- report version;
- claim token or report URL reference;
- anchor ID when used;
- delivery status;
- follow-up date;
- whether the report was viewed, claimed, or declined.

The report should not be attached as an untracked static file when a tokenized report URL is available. The URL preserves report version, claim context, and conversion analytics.

---

## 14. Report rendering

### 14.1 Shared report DTO

HTML, customer portal, operator views, and PDF must render from the same `SeedIntelligenceReport` DTO.

```text
Raw prompt output
  → normalized evidence
  → report DTO
  → HTML/PDF/API renderers
```

### 14.2 Free report

The free report should show:

- business identity summary;
- source trail;
- identity reconciliation;
- category/location classification;
- discovery signals;
- unresolved fields;
- verification history when available;
- claim CTA.

### 14.3 Claimed report

After verified claim, add:

- owner-confirmed fields;
- owner corrections;
- preferred contact information;
- verified website/social links;
- claim date;
- change history;
- owner-provided business description.

### 14.4 Paid report

The deeper market-intelligence report may add:

- market position;
- category density;
- gold-standard comparison;
- market gaps;
- growth opportunities;
- prioritized recommendations;
- ongoing monitoring.

The seed claim should unlock the appropriate owner access already described in `SEED_MARKET_INTEL_SIDEBAR_SPEC.md`; this report spec defines the evidence layer that makes the unlocked content explainable.

---

## 15. Claim invitation copy

### 15.1 Primary message

> We found your business across public directories, local sources, social profiles, and category-specific listings. We assembled those signals into a free business seed and documented the work in this report.

### 15.2 Claim explanation

> Claiming is free. It lets you confirm ownership, correct inaccurate information, add missing details, connect your preferred profiles, and establish the verified starting record for future intelligence.

### 15.3 Report limitation language

> This report reflects information available in the sources checked on the generation date. “Not found during discovery” means the information was not located in those sources; it does not mean the information does not exist.

### 15.4 Owner-contact language

> We contacted your business on [date] to verify [specific fact or purpose]. Your response is shown separately from public-source observations so you can see what was discovered and what was confirmed directly.

---

## 16. Automation and prompt implementation sequence

### Phase 0 — Reconcile existing substrate

- Confirm `directory_presence_seeds` as the current identity and claim-state source.
- Confirm `directory_field_provenance` as the field-provenance source.
- Confirm `directory_seed_nap_verifications` as the owner-correction history.
- Confirm `directory_seed_outreach_touches` as the seed-level outreach source.
- Confirm `mkt_signal_registry` as the signal allowlist and metadata source.
- Confirm `mkt_category_tone_presets_list` and `mkt_prompt_templates_list` as tone/template sources.
- Confirm `directory_claim_tokens` and existing claim services as the claim handoff.
- Remove the proposed duplicate observation table from implementation scope.

### Phase 1 — Contract and additive schema

- Define shared TypeScript and Zod schemas.
- Resolve `report_evidence` per candidate, not per discovery run.
- Define evidence states and confidence values.
- Add the evidence-state field to `directory_field_provenance` if schema review confirms it is absent.
- Seed the initial `INT_*` codes into `mkt_signal_registry`.
- Define report readiness and claim-hook eligibility statuses.
- Define report lint rules and acceptance fixtures.

### Phase 2 — Prompt directives

Add the report-evidence directive to relevant intelligence prompt templates:

- category discovery;
- intelligence discovery;
- category profile;
- location profile;
- platform/directory discovery;
- business analysis where report facts are needed.

Prompt changes must be additive and versioned. Existing task outputs must remain backward compatible unless a deliberate migration is approved.

Because intelligence and seed templates are persisted in the database, edited seed scripts must be re-run according to project seed discipline. Verify the live template body and version after re-seeding.

### Phase 3 — Normalization

Implement `SeedReportEvidenceService`:

- parse and validate per-candidate output;
- preserve raw prompt output and execution metadata;
- normalize source references;
- read field facts from `directory_field_provenance`;
- read current identity and claim state from `directory_presence_seeds`;
- read owner corrections from `directory_seed_nap_verifications`;
- read seed touches from `directory_seed_outreach_touches`;
- resolve conflicts without creating a duplicate observation store;
- validate signals against `mkt_signal_registry`;
- resolve category tone through existing tone presets;
- run tone and claim-safety linting;
- produce report-ready evidence references.

### Phase 4 — Versioned report builder and renderer

Implement:

```text
SeedIntelligenceReportService
SeedReportNarrativeService
SeedReportArtifactService
```

Responsibilities:

- load normalized evidence from the existing substrate;
- construct report sections;
- calculate report status and claim-hook eligibility;
- run blocking report lint checks;
- create immutable `mkt_seed_intelligence_reports` versions;
- publish only validated versions;
- produce claim-preview and claimed variants;
- render HTML first and PDF from the same DTO;
- preserve the last successful version on failure.

### Phase 5 — Claim handoff and channel delivery

- Resolve or issue existing `directory_claim_tokens`.
- Add mobile-safe report-to-claim deep links.
- Add report access after verified owner claim.
- Implement channel-specific report delivery and tracking.
- Add report version and delta references to outreach touches.

### Phase 6 — Manual anchors and verification

- Add `mkt_outreach_anchors` CRUD.
- Add anchor selection to call script.
- Add anchor snapshots to `mkt_outreach_log` where campaign scope requires them.
- Write seed-safe verification summaries to `directory_seed_outreach_touches`.
- Route owner-reported pain to an optional, permission-based business-audit opportunity.
- Add re-engagement suggestions for meaningful new report deltas.

### Phase 7 — Analytics and optimization

Track:

- reports generated;
- report views;
- source counts;
- claim invitations;
- claim starts;
- claims completed;
- owner corrections;
- owner-disputed facts;
- anchor types used;
- contact connection rates;
- verification rates;
- owner-reported pain rates;
- claim conversion by source mix and report version.

Do not optimize only for sales conversion. Verification and correction are valuable intelligence outcomes even when the business does not purchase a service.

---

## 17. Validation and acceptance criteria

### 17.1 Evidence safety

- [ ] `insufficient_evidence` and `requires_identity_review` reports are operator-internal and cannot expose a claim CTA.
- [ ] Only `provisional` or `complete` reports that pass the minimum-evidence gate can be used as business-facing claim hooks.
- [ ] A missing website is rendered as `not_found_during_discovery`, not “no website.”
- [ ] A missing Google profile is not rendered as “the business has no Google profile.”
- [ ] No report fact exists without provenance or an explicit derived-value explanation.
- [ ] Every `INT_*` signal has an evidence basis.
- [ ] Owner-reported pain is separate from platform-observed evidence.
- [ ] No-answer and declined contact outcomes do not create negative business signals.

### 17.2 Identity

- [ ] Name, address, phone, and website variants are preserved.
- [ ] Conflicts remain visible until resolved.
- [ ] Low-confidence identity cannot be presented as confirmed.
- [ ] Owner corrections create a new report version and preserve the previous fact.

### 17.3 Prompt contract

- [ ] Relevant prompts return schema-valid per-candidate `report_evidence`.
- [ ] Existing prompt outputs remain compatible.
- [ ] Prompt template ID/version, fragment kind, and resolved category-tone preset are recorded.
- [ ] Signals are validated against active `mkt_signal_registry` rows.
- [ ] Invalid evidence blocks fail safely and are surfaced as incomplete evidence.
- [ ] Report prose can be traced to evidence IDs.
- [ ] Tone and claim-safety lint blocks unsupported or alarmist report language.

### 17.4 Claim flow

- [ ] `directory_claim_tokens` and the existing claim service provide the CTA handoff.
- [ ] The report includes a claim CTA only when the minimum-evidence gate passes.
- [ ] Claim access is granted only after verified claim completion.
- [ ] Expired/consumed tokens provide a recoverable mobile-safe path.
- [ ] Claiming is idempotent.
- [ ] A claim does not erase public-source history.
- [ ] Owner-confirmed facts are visibly distinguished from public observations.
- [ ] Owner claim unlock is audited and linked to the report version.

### 17.5 Outreach

- [ ] Manual anchors do not override detected archetypes.
- [ ] Anchor snapshots are persisted with contact events.
- [ ] Seed-level verification summaries write to `directory_seed_outreach_touches`.
- [ ] Campaign-level details write to `mkt_outreach_log` only when a campaign link exists.
- [ ] Call scripts can be generated with or without an anchor.
- [ ] Verification results are structured and reportable.
- [ ] Outreach reports show the date, purpose, outcome, and response.
- [ ] Channel-specific delivery and report-version references are recorded.
- [ ] Owner-reported pain has a defined, permission-based business-audit handoff.
- [ ] Meaningful new report deltas can produce a re-engagement suggestion.

### 17.6 Rendering

- [ ] Web and PDF use the same report DTO.
- [ ] Long source names and URLs wrap safely.
- [ ] Empty sections are omitted or clearly marked unavailable.
- [ ] Report versions display generated date and status.
- [ ] Claim CTA is visible on desktop and mobile.
- [ ] The report does not require horizontal scrolling for core comprehension.

---

## 18. Testing requirements

### Unit tests

- evidence-state normalization from `directory_field_provenance`;
- source normalization;
- identity candidate scoring against `directory_presence_seeds`;
- conflict resolution;
- report status and minimum-evidence eligibility;
- signal registry validation against `mkt_signal_registry`;
- category-tone resolution against `mkt_category_tone_presets_list`;
- tone and claim-safety linting;
- peer-metric gating;
- report section generation;
- prompt-output validation per candidate;
- owner-confirmed precedence using NAP verification history;
- manual-anchor precedence and snapshotting;
- claim-token handoff and idempotency;
- report-delta and re-engagement eligibility.

### Integration tests

- prompt output → normalized evidence;
- normalized evidence → report DTO;
- seed creation → report version;
- source refresh → new report version;
- owner claim → claimed report access;
- owner correction → new report version;
- anchor selection → call-script output;
- outreach log → verification event and report update.

### Regression tests

- Existing market-intelligence sidebar remains functional.
- Existing market-intelligence PDF output remains functional.
- Existing opener/pitch/call-script behavior is unchanged when no manual anchor is selected.
- Sibling campaigns retain prospect-level research while maintaining campaign-level anchor history.
- Legacy seeds without report evidence render a provisional report rather than failing.

---

## 19. Non-goals

This specification does not define:

- a universal authoritative business database;
- automatic ownership verification without a claim flow;
- a replacement for the existing business audit;
- a competitive market leaderboard;
- a guarantee that every local business is discovered;
- a mechanism to infer business quality from review counts or digital visibility;
- automatic cold-call execution;
- automatic claims based only on link clicks;
- a requirement that every prompt generate customer-facing prose.

---

## 20. Greenfield implementation baseline

This specification is greenfield. The following decisions are normative for the first implementation unless a later approved architecture decision supersedes them.

### 20.1 System of record

The system of record is the normalized evidence graph and its immutable report snapshots.

- Raw prompt output is retained for debugging and provenance.
- Normalized observations are the queryable evidence layer.
- Report versions are immutable projections of a point-in-time evidence snapshot.
- Rendered HTML and PDF are artifacts of a report version, not independent sources of truth.
- Owner corrections create new facts and new report versions; they do not overwrite historical observations.
- Outreach anchors and contact events are separate from detected archetypes.

### 20.2 Stable identifiers

Every durable object receives a platform-generated ID:

```text
seed_id
observation_id
fragment_id
report_id
anchor_id
verification_event_id
render_artifact_id
```

A `source_snapshot_id` is a logical report-build identifier stored in the report's `source_snapshot` metadata; it does not require a new source-snapshot table in the first implementation. It groups the existing prompt execution IDs, template versions, provenance IDs, audit IDs, signal IDs, and outreach/claim event IDs used for a report version.

External URLs, business names, addresses, and source record IDs are not durable internal identifiers.

### 20.3 Evidence graph objects

The minimum durable object graph is:

```text
Seed
 ├── SourceSnapshot[]
 │    └── Observation[]
 ├── IntelligenceFragment[]
 ├── ReportVersion[]
 │    └── ReportFact[]
 ├── ManualOutreachAnchor[]
 │    └── VerificationEvent[]
 └── ClaimEvent[]
```

Every report fact must reference at least one observation, fragment, owner event, or explicitly derived calculation. Derived facts must retain their input IDs.

### 20.4 Required invariants

The implementation must enforce these invariants:

1. A report cannot be marked `complete` without a category-qualified identity candidate and geographic classification.
2. A report fact cannot be marked `owner_confirmed` without a verified claim event or a connected owner/business-representative contact event.
3. A contact attempt cannot be treated as owner verification merely because the call was placed.
4. `not_found_during_discovery` is never equivalent to `false`.
5. A low-confidence identity cannot be routed to a completed claim invitation without an identity-review warning.
6. A report version is immutable after publication.
7. A rendered artifact always identifies its report version.
8. A manual anchor never mutates the detected archetype.
9. A business-audit signal cannot be silently emitted as an `INT_*` discovery signal.
10. Public report content cannot expose private operator notes, personal data, internal prompt text, or raw contact details unless explicitly approved for that surface.
11. A failed report refresh never deletes or invalidates the last successful report version.
12. Retrying any generation, claim-unlock, or report-publication job is idempotent.

---

## 21. Prompt execution and fragment pipeline

### 21.1 Prompt output envelope

All report-contributing prompt executions should return a versioned envelope:

```ts
interface IntelligencePromptEnvelope<T> {
  contract_version: '1.0';
  task_type: string;
  task_run_id: string;
  status: 'complete' | 'partial' | 'failed';
  primary_output: T | null;
  report_evidence: ReportEvidenceOutput;
  fragments: IntelligenceFragmentDraft[];
  warnings: string[];
}
```

A prompt may have a useful primary result while its report evidence is partial. The parser must preserve both statuses instead of treating the entire execution as all-or-nothing.

### 21.2 Fragment contract

```ts
interface IntelligenceFragmentDraft {
  fragment_key: string;
  fragment_family:
    | 'business'
    | 'intelligence'
    | 'category'
    | 'location'
    | 'enrichment'
    | 'report'
    | 'outreach';
  audience: 'operator' | 'business_owner' | 'customer' | 'internal';
  title: string | null;
  body: string;
  evidence_observation_ids: string[];
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  display_state: 'ready' | 'needs_review' | 'internal_only';
}
```

Fragments are reusable narrative units, not authoritative facts. Their evidence IDs and confidence must survive composition.

### 21.3 Prompt failure handling

- Invalid JSON: retain raw output, mark task `failed`, and do not publish unsupported report facts.
- Valid primary output with invalid evidence block: retain the primary output, mark evidence `partial`, and create a report warning.
- Missing source URL: allow `null` when the source is known but URL is unavailable; do not fabricate a URL.
- Tool timeout: preserve prior report version and mark the new run incomplete.
- LLM timeout or provider failure: use deterministic fallback fragments where available; otherwise omit the fragment.
- Evidence conflict: preserve all source observations and set the normalized field to `conflicting`.

### 21.4 Prompt versioning

Every persisted prompt execution must record:

```text
prompt_template_id
prompt_template_version
fragment_contract_version
model_provider
model_name
execution_id
started_at
completed_at
```

Prompt-template edits are schema-affecting when they change output shape or evidence semantics. They require contract tests and the project's normal seed-template re-run and database verification process.

---

## 22. Report assembly architecture

### 22.1 Layering

The implementation must use this separation:

```text
Prompt execution / source ingestion
        ↓
Evidence normalization service
        ↓
Identity and conflict resolver
        ↓
Report fact builder
        ↓
Narrative composer
        ↓
Report version repository
        ↓
HTML / PDF / public API renderers
```

Routes and renderers must not interpret raw prompt output or directly decide evidence confidence.

### 22.2 Deterministic versus generative content

Deterministic code owns:

- counts;
- field values;
- confidence labels;
- evidence states;
- source lists;
- signal codes;
- claim status;
- report status;
- timestamps;
- version metadata.

The narrative composer may generate:

- introductions;
- transitions;
- plain-language explanations;
- concise opportunity summaries;
- category-aware call-to-action copy.

Generated text must be grounded in selected report facts and must pass a post-generation validation step. If validation fails, use a deterministic fallback sentence.

### 22.3 Report generation idempotency

Use a stable generation key:

```text
(seed_id, evidence_snapshot_hash, report_mode, template_version)
```

A retry with the same key must return or reuse the existing report version rather than create duplicates.

### 22.4 Publication rule

A report version is generated privately first. It becomes public only after:

1. DTO validation succeeds;
2. evidence references resolve;
3. sensitive-field filtering succeeds;
4. narrative grounding validation succeeds;
5. artifact rendering succeeds, if an artifact is required.

The previous published report remains available until the replacement is successfully published.

---

## 23. Security, privacy, and access control

### 23.1 Public report boundary

The public claim-preview report may include:

- business identity candidates;
- public source names and URLs;
- public observations;
- category and geographic classification;
- discovery signals in business-friendly language;
- unresolved verification questions;
- claim status and claim CTA.

It must not include by default:

- internal prompt text;
- raw model responses;
- operator-only notes;
- private phone or email obtained during outreach;
- personal owner data not publicly published or owner-confirmed;
- internal quality scores;
- hidden source credentials;
- other businesses' private information.

### 23.2 Claimed report boundary

A claimed owner may access owner-confirmed details associated with the claimed seed, subject to existing customer authorization and tenant scope.

Claiming must be tied to verified claim completion, not merely opening a claim link.

### 23.3 Operator boundary

Operators may access source provenance, internal warnings, raw observations, anchor notes, and verification details according to existing marketing-ops authorization.

### 23.4 Auditability

Record audit events for:

- report generation;
- report publication;
- report refresh;
- manual anchor creation, activation, and retirement;
- contact verification write-back;
- owner claim;
- owner correction;
- report access where the existing policy requires access logging.

### 23.5 Data retention

Raw prompt outputs and source snapshots should be retained long enough to reproduce published reports and investigate disputes. Retention duration must be configurable and must follow existing platform privacy and data-retention policy.

---

## 24. Background jobs and operational behavior

Report generation should be asynchronous for normal seed creation and refresh flows.

Suggested jobs:

```text
seed-report-build
seed-report-refresh
seed-report-render-pdf
seed-report-publish
seed-report-claim-unlock
```

Each job must support:

- idempotency key;
- retry policy;
- dead-letter or failed state;
- structured error detail;
- correlation ID;
- source/report version reference;
- operator-visible status.

A seed page may show the last successful report while a newer report is being generated:

```text
Showing report version 2
Refresh in progress — new evidence is being processed
```

Never show a blank report solely because a refresh failed.

### 24.1 Observability

Track at minimum:

- prompt execution success and failure rate;
- evidence-contract validation failures;
- report generation duration;
- report publication failures;
- render failures;
- report version count per seed;
- claim CTA views and completions;
- owner correction frequency;
- anchor verification outcomes;
- stale-source warnings.

Use structured logs and existing error tracking. Do not log secrets, claim tokens, or unredacted private contact details.

---

## 25. API and repository boundaries

### 25.1 Services

Recommended services:

```text
SeedReportEvidenceService
SeedIdentityResolutionService
SeedIntelligenceReportService
SeedReportNarrativeService
SeedReportArtifactService
ManualOutreachAnchorService
SeedReportAccessService
```

Responsibilities must remain separated:

| Service | Responsibility |
|---|---|
| Evidence service | Validate and normalize prompt/source evidence |
| Identity service | Resolve names, addresses, phones, and conflicts |
| Report service | Build immutable report versions |
| Narrative service | Ground and phrase report narrative |
| Artifact service | Render HTML/PDF artifacts |
| Anchor service | Manage operator-selected outreach anchors |
| Access service | Enforce public, operator, and claimed-owner access |

### 25.2 Repository requirements

Database access belongs in repositories or existing service data-access boundaries. Controllers and routes should not assemble reports or query raw prompt output directly.

All request bodies, route parameters, and query parameters require Zod validation. Report DTOs should also be schema-validated before persistence and publication.

### 25.3 API response contract

Follow the existing double-wrap response convention where applicable:

```ts
const data = result.data?.data ?? result.data;
```

Report endpoints should return stable DTOs and explicit status metadata:

```json
{
  "success": true,
  "data": {
    "report": {},
    "status": "complete",
    "version": 3,
    "generated_at": "2026-09-15T15:30:00Z",
    "claim_status": "unclaimed"
  }
}
```

---

## 26. Delivery gates

A phase is not complete merely because a report can be rendered. It must pass these gates.

### Gate 1 — Contract

- [ ] Prompt envelope and report-evidence schemas exist.
- [ ] All targeted fragment surfaces use the shared evidence and tone directives.
- [ ] Contract-version failures are observable.

### Gate 2 — Evidence

- [ ] Facts have provenance.
- [ ] Conflicts are retained.
- [ ] Missing information is not converted to negative evidence.
- [ ] Discovery and business-audit signals remain separate.

### Gate 3 — Report

- [ ] Report DTO is stable and validated.
- [ ] Report versions are immutable.
- [ ] Report generation is idempotent.
- [ ] Last successful version survives refresh failure.
- [ ] Narrative claims resolve to evidence IDs.

### Gate 4 — Security

- [ ] Public, operator, and claimed-owner views are separated.
- [ ] Private contact data is filtered from public reports.
- [ ] Claim unlock occurs only after verified claim completion.
- [ ] Audit events are recorded.

### Gate 5 — Conversion

- [ ] Report introduction explains visibility, discoverability, marketplace expectations, and business opportunity.
- [ ] Peer-effect messaging is used only when supported by observed market evidence.
- [ ] Claim CTA is clear and free of coercive language.
- [ ] Business can understand what was found and what claiming changes.

### Gate 6 — Operations

- [ ] Background jobs are retry-safe.
- [ ] Failures are visible to operators.
- [ ] Report and claim flows are monitored.
- [ ] No secrets or private data appear in logs or public artifacts.

---

## 27. Final product principle

The report is the platform's proof of work.

```text
The platform discovered the business.
The platform gathered fragmented evidence.
The platform reconciled the available identity signals.
The platform documented uncertainty instead of hiding it.
The platform optionally contacted the business to verify a focused question.
The business can now claim and correct the result.
```

The report should make the claim invitation feel earned:

> **We did the homework. Review the evidence, verify the record, and claim your seed.**
