# Marketing Ops — Project Proposal Spec

Status: Draft — captured for later expansion. Not in the current sprint.
Owner: Marketing Ops
Companion to: `docs/LocalBiz/marketing_ops_project_phase_spec.md` (v7), `docs/LocalBiz/marketing_ops_project_phase_sprint_plan.md`

---

## 1. Purpose

The project phase plan is the operator's internal organizing view. The Plan cockpit shows it to the operator. This spec covers the next step: how an operator turns a settled plan into a proposal the prospect can evaluate and decide on.

A proposal is a packaged, time-stamped view of the plan, delivered through a chosen channel, with a single next step for the prospect. It is the point where the platform's internal reasoning becomes an offer.

Out of scope for this spec: legal terms, contract execution, and payment processing.

## 2. Premise

The proposal is a **projection of the plan**, the same object the cockpit and gallery already consume, at a different fidelity:

- Cockpit: the operator sees everything, including suppressed phases, signal lineage, lane provenance, and gate results.
- Gallery project view: the owner sees the curated projection (verified phases only, internals stripped).
- Proposal: a frozen, owner-facing projection with a commercial summary and one next step, issued at a point in time.

The proposal never computes its own plan. It consumes one.

## 3. Audience and channels

| Audience | Channel | What it carries |
|---|---|---|
| Owner, first contact | Outreach opener (existing archetype pipeline) | One observation, one preview link. No plan, no pricing. |
| Owner, after engagement | Gallery project view (existing, flagged) | Live plan projection. Updates on each read. |
| Owner, decision point | Proposal document (this spec) | Frozen plan snapshot, commercial summary, one next step. |
| Owner, conversation | Call (existing `CallScriptService` pattern) | Talking points drawn from the same verified phases. |
| Operator, internal | Plan cockpit (existing spec §13) | Full plan with internals. Never shared. |

The proposal sits after the gallery in the sequence. An owner who has not engaged with the gallery should not receive a proposal.

## 4. Proposal anatomy

Sections appear in this order. A section with no content is omitted, not left blank.

1. **Opening: the wedge.** The seed listing as an already-built preview of the business. Frame: "Here is your listing as it would appear. Claiming it is free." Shown only when the wedge is `aligned` or `thin`. Never shown for `misaligned` or `unknown` fidelity (spec §6, §11). Stricter than the live CTA by design: the plan suppresses only `misaligned` because live surfaces are retractable and operator-supervised, while an issued proposal is a frozen attestation — `unknown` means there is no verified fidelity to attest. The operator's path is to establish fidelity first, then issue.
2. **What we found.** Verified phases only. Each phase shows its goal and the evidence behind it: the audit field, or a verbatim review quote with attribution. Suggested phases never appear here (spec §9).
3. **The plan.** Phases in catalog order, with status and next action. Blocked phases are described as platform timing ("coming when your storefront is ready"), not as business defects.
4. **Commercial summary.** Operator-only block, separate from the narrative (see section 6).
5. **The next step.** One call to action. Either the seed claim (when unclaimed and aligned), or the earliest incomplete verified phase, or the commercial decision if no phase remains.
6. **Attachments.** Gallery link and, where applicable, the seed intelligence report PDF (existing `SeedReportPdfService` output).

Length: one page for the web version. The attachment carries detail.

## 5. Framing rules

These extend spec §9 and apply to every proposal text.

- Findability framing: the business already helps customers find products in the store. The plan makes products findable before the visit.
- No verdicts about the business. Use "could be found more easily," not "is invisible."
- Scan-claimed exposures are never stated as verified facts. Use only audit-verified fields.
- Reviews are quoted verbatim with attribution. Quoted text is exempt from the forbidden-term rule (spec §9 scoping note).
- No archetype codes, signal codes, tier names, or internal stage names.
- No pressure language on phases the platform cannot yet deliver. A blocked phase is described with its timing, not with urgency.
- Sibling and pipeline mechanics are never visible to the owner.

## 6. Commercial layer

Pricing is not part of the owner-facing narrative. It appears only in a dedicated commercial block, generated and reviewed by the operator.

- The commercial block is structurally separate from the narrative. The narrative gate (spec §11) does not scan it, and the commercial block cannot inject text into the narrative.
- The commercial block is operator-authored in v1. Automated fee estimation is out of scope. The `estimated_monthly_service_fee` field in the business analysis schema is not used for proposals.
- Close lines reuse the existing outreach close variants (`soft` and `direct_paid` in `archetype-prompts.ts`). The `direct_paid` variant names the commercial nature without a figure, consistent with the first-touch rule.
- The gallery's existing "View Pricing" CTA remains available below the project view. It is not repeated inside the proposal narrative.

Open: the commercial structure itself (one-time, retainer, phase-by-phase, or a mix) is a business decision, not defined here.

## 7. Proposal lifecycle

A proposal is a versioned, immutable artifact. It is not a stage on the sibling pipelines.

| State | Meaning |
|---|---|
| `draft` | Operator assembling. Uses the live plan projection; not visible to the owner. |
| `reviewed` | Operator has checked the content and the commercial block. |
| `issued` | Snapshot frozen and delivered. Gets a version number and an issue timestamp. |
| `viewed` | Owner opened it. Recorded from gallery-style events. |
| `accepted` / `declined` | Owner response. Recorded by the operator or from the next step. |
| `superseded` | A newer version was issued for the same prospect. |

Snapshot requirement: issuing a proposal freezes the owner-facing projection (the operator's selected phase subset), `predicateSeedVersion`, `sourceAuditId`, `signalLanes`, and the plan's `generatedAt` evaluation timestamp — the issue timestamp and version number are recorded separately. Spec §13 defers plan snapshotting for the gallery, but a proposal cannot be deferred. If the plan recomputes after issue, the proposal would describe a plan the owner never saw. Re-issue creates a new version; it never mutates an issued one.

Expiry: proposals carry a validity date, set by the operator. The default is open.

## 8. Packaging workflow

1. **Select.** Operator reviews the cockpit and chooses which verified phases to propose, within the tier cap (spec §5). Suppressed phases stay internal.
2. **Assemble.** The system fills the anatomy (section 4) from the chosen phases, their evidence, and the copy keys from the predicate seed.
3. **Commercial.** Operator completes the commercial block.
4. **Gate.** `runProjectPhaseGate` runs on the narrative. The gate also checks: commercial block isolated from the narrative, no `suggested` phases, snapshot fields complete, single next step present.
5. **Review.** Operator previews the owner-facing render (the same mode as the gallery preview).
6. **Issue.** Snapshot is frozen. The delivery link and attachments are generated.
7. **Follow up.** Operator uses the call script and the gallery; both draw from the same verified phases.

No step writes to sibling pipelines, triage, or seeds. Issuing a proposal does not change any stage.

## 9. Communication sequence

| Step | Channel | Trigger |
|---|---|---|
| 1 | Outreach opener with preview link | Existing archetype pipeline |
| 2 | Gallery project view | Owner opens the preview |
| 3 | Call | Operator decision, using the verified phases |
| 4 | Proposal | Owner shows interest in a next step |
| 5 | Follow-up | Operator, after `viewed` with no response |

Follow-up timing and cadence are not defined here. They belong to the outreach pipeline.

## 10. Quality gate additions

On top of spec §11:

- Proposal narrative passes the forbidden-term check (quotes exempt).
- Commercial block is separate and does not appear in the narrative.
- Every phase in the proposal is `verified`.
- The wedge CTA is absent when fidelity is `misaligned` or `unknown`.
- Snapshot fields are present and match the plan at issue time.
- Exactly one next step is present.

## 11. Metrics

Reuse the existing gallery event model with a proposal identifier added:

- Proposal issued, viewed, accepted, declined.
- Attachment opens (seed report PDF).
- Next-step clicks, split by step type (wedge claim, phase, commercial).

The wedge claim rate is already measured separately (spec §13 attribution). Proposal metrics sit alongside it, not in place of it.

## 12. Reuse map

| Existing component | Role in proposals |
|---|---|
| `archetype-prompts.ts` close variants | Commercial close lines |
| `CallScriptService` | Call talking points |
| `SeedReportPdfService` | Attachment |
| `MultiGalleryPage` | Live project view |
| `runProjectPhaseGate` (planned) | Narrative gate |
| Plan cockpit (planned) | Operator selection and review |

## 13. Built-in checklist

The checklist is rendered in the operator's review step. Items marked **[auto]** are enforced by the system and block the next state. Items marked **[manual]** are attested by the operator and recorded with the review.

### Pre-issue (must pass before `issued`)

- [ ] **[auto]** Plan evaluated at the current predicate seed, and `predicateSeedVersion` recorded.
- [ ] **[auto]** At least one verified phase is selected, or a valid next step exists (empty plans cannot be issued).
- [ ] **[auto]** Every phase's evidence is present and dated. Quotes are verbatim and attributed.
- [ ] **[auto]** Wedge section is present only when fidelity is `aligned` or `thin` and the seed is `published` or `invited`.
- [ ] **[auto]** Forbidden-term gate passes on the narrative (quotes exempt).
- [ ] **[auto]** Commercial block is complete and isolated from the narrative.
- [ ] **[auto]** Exactly one next step is selected.
- [ ] **[auto]** Snapshot fields are populated and match the plan at issue time.
- [ ] **[auto]** No `suggested` phase is in the owner projection.
- [ ] **[manual]** Blocked phases are described as platform timing, not defects.
- [ ] **[manual]** Attachments were generated and opened once by the operator.
- [ ] **[manual]** Validity date is set, or the operator has recorded that it is open.
- [ ] **[manual]** Operator review recorded, with the reviewer's name and time.

### Post-issue

- [ ] **[auto]** `viewed` event is recorded when the owner opens the link.
- [ ] **[manual]** Follow-up is scheduled per the outreach pipeline, if no response.
- [ ] **[auto]** Response (`accepted` or `declined`) is recorded against the version.
- [ ] **[auto]** A superseding version marks the prior version `superseded`.

## 14. Scripts

Each channel has a built-in script template. Slots are filled only from the proposal snapshot, never from the live plan, except where the call script is noted below.

| Script | Channel | Slots | Length and rules |
|---|---|---|---|
| Opener | Outreach opener | `{observation}`, `{preview_link}` | About 80 words. Reuses the archetype opener constraints: one stat, no pricing, no jargon. |
| Gallery nudge | Email or message | `{verified_phase_names}`, `{gallery_link}` | Two sentences. Names phases in owner terms only. |
| Call | Phone | Opening wedge line, up to three talking points from verified phases, one owner question, close | Talking points come from the live verified projection at call time. Close uses the `soft` or `direct_paid` variant. Objections reuse the existing call-script objection library. |
| Cover note | Proposal delivery | `{owner_first_name}`, `{attachment_list}`, `{next_step}` | Three sentences maximum. |
| Follow-up | Message, after `viewed` with no response | `{single_phase}`, `{gallery_link}` | One follow-up per version. Introduces no new claims. |

Script rules:

- No slot may contain a signal code, archetype code, tier name, or stage name.
- A slot with no value drops its whole sentence. It is never filled with a fallback phrase.
- Scripts are versioned with the proposal template, so a sent script can be reconstructed.

## 15. Sequential dependencies

Each step depends on the step before it. The system blocks a step until its dependency is met.

```
Opener sent
   └─► Gallery viewed
          └─► Call completed (optional)
                 └─► Proposal selected ─► Assembled ─► Commercial completed
                                                          └─► Gated ─► Reviewed ─► Issued
                                                                                    └─► Viewed
                                                                                          ├─► Accepted / Declined
                                                                                          └─► Follow-up (once)
```

| # | Step | Requires | Blocks |
|---|---|---|---|
| D1 | Proposal selected | At least one verified phase, or an aligned wedge | Empty plans cannot advance |
| D2 | Commercial completed | Phase selection (commercial scope follows the chosen phases) | Gating |
| D3 | Issued | Gate pass, review recorded, required checklist items checked | Viewing |
| D4 | Issued → Viewed | Issued version exists | Follow-up |
| D5 | Follow-up | `viewed` with no response within the operator's window; no prior follow-up on this version | A second follow-up on the same version |
| D6 | Accepted / Declined | Issued version | Responses against a superseded version |
| D7 | Re-issue | A plan change, evidence change, or predicate version change | Re-issue when the snapshot is identical (no new version is created) |
| D8 | Call completed | Verified phase list read at call time | Nothing (the call is optional, but if held, it is logged) |

Rules:

- Re-issue is always a new version. An identical snapshot is rejected, so the owner never receives two versions that say the same thing.
- A superseded version cannot be accepted. A response to it is recorded against the version the owner actually saw, and the operator is prompted to confirm the current version.
- The gallery view is the default prerequisite for issue. An operator may bypass it only with a recorded reason (for example, a live call already covered the same ground).

## 16. Open questions

1. Proposal format: web-only, PDF, or both. The web version is the default; the PDF is an attachment.
2. Commercial structure: one-time, retainer, phase-by-phase, or a mix.
3. Validity period default, if any.
4. Operator sign-off: is the operator's review sufficient, or does a second reviewer apply to commercial terms.
5. Currency and tax handling. Likely out of scope until the commercial structure is set.
6. Whether a proposal is allowed for a `tier_3` plan at all, or only once a second verified phase exists. Follows from the settled tier_3 rule (spec §16.4): tier_3 plans are shown capped at two phases — is a one-or-two-phase proposal commercially worth issuing?

## 17. Expansion path

Phased, for later sprints:

1. Proposal data model and immutable snapshot table, following the plan endpoint pattern.
2. Operator selection UI inside the Plan cockpit.
3. Narrative gate extension and commercial block.
4. Web proposal render, reusing the gallery page components.
5. PDF attachment via the existing report PDF service.
6. Proposal metrics on the gallery event model.
7. Checklist enforcement (auto items as gates), script templates, and dependency guards (D1–D8).

Each step is independently useful. Steps 1–3 deliver the operator workflow. Steps 4–6 deliver the owner-facing artifact.

## 18. Cockpit surfaces: presentation, proposal, execution

The cockpit separates the plan's three roles into three tabs on the same prospect-keyed surface. All three read the same plan object. Each tab writes only to its own tables.

Hash convention: `#presentation`, `#proposal`, `#execution`, matching the existing cockpit hash-tab pattern. `#plan` from the phase spec resolves to `#presentation`.

| Tab | Role | Reads | Writes | Owner-facing |
|---|---|---|---|---|
| Presentation | The plan as computed now. Shows what the owner sees (projection) and what the operator sees (full internals). | Live plan | Nothing | Via gallery twin |
| Proposal | Assembles, reviews, and issues versioned proposals (sections 4–10). Shows version list, states, snapshot diffs between versions, and `viewed` / response events. | Live plan, proposal versions | Proposal tables only | Via proposal delivery |
| Execution | Shows the accepted scope against the live plan once a proposal is accepted. | Execution baseline, live plan | Nothing on the baseline | Via gallery twin, if the operator chooses |

### Execution baseline

- Created only when the owner accepts a proposal version. Acceptance creates the baseline and nothing else. It creates no siblings, seeds, or pipeline changes.
- Immutable. One active baseline per prospect. A newer accepted version archives the prior baseline and creates a new one.
- Stores: `proposal_version_id`, accepted phase keys, the accepted next step, `predicateSeedVersion` at acceptance, `accepted_at`, and `accepted_by`.

### Drift

The Execution tab compares the baseline to the live plan and reports four drift types:

| Drift | Meaning | Operator action |
|---|---|---|
| `scope_added` | A verified phase appeared after acceptance | Shown as a candidate. Not added to scope automatically. |
| `scope_dropped` | An accepted phase no longer triggers | Shown as resolved or evidence-changed, for the operator to confirm. |
| `status_changed` | Live status differs from the status at acceptance | Informational. Links to the owning sibling or seed. |
| `capability_blocked` | An accepted phase's capability is now disabled | Shown as platform timing, linked to the capability fix. |

Handoff: any work an accepted scope implies runs through the existing sibling and seed pipelines. The Execution tab links to those surfaces and does not start them.

### Lifecycle across tabs

Presentation → Proposal (select, assemble, issue) → Execution (on acceptance). A proposal can return to Presentation at any point without changing either the plan or the baseline.
