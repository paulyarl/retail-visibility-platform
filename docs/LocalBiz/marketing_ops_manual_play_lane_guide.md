# Manual Play Lane — Operator + Expansion Guide

The **Manual** tab on the outreach openers workspace
(`Settings → Admin → Marketing Ops → Openers`) is the operator playground:
a template-driven authoring lane that sits *beside* the automated detected
archetype. Everything it produces flows into the same pipeline rows the
other tabs consume — nothing about detection changes.

Roles:

| Tab | Role |
|---|---|
| Opener / Pitch Construction / Preview Deliverable / Call Script | Consumers — unchanged |
| **Manual** | Producer — author a play, save it per campaign, promote slots |

---

## Part 1 — Operator guide

### The play doc

1. Select a campaign, open the **Manual** tab.
2. Pick a **play template** from the dropdown.
   - **SUGGESTED** badge = the campaign's triage detected the template's
     trigger signal (e.g. `WC_MISSING_AVAILABILITY_INQUIRY` →
     *WhatsApp availability-check upsell*).
   - **saved** marker = a doc already exists for that template on this
     campaign — selecting it reloads your last saved version.
3. Edit the fields. Each slot is badged by where it can be promoted:

   | Badge | Promotes to |
   |---|---|
   | Opener | Opener list → Pitch Construction opener picker |
   | Header | Header list → Pitch Construction |
   | Closer | Closer list → Pitch Construction |
   | Anchor thesis | Campaign anchor → Call Script anchor picker |
   | Merge value | No promote button — substitutes `{{key}}` inside other fields / the script body |

4. Edit the **script body** — the free-form call play. Placeholders merge
   at read time: `{{business}}` `{{address}}` `{{category}}` `{{city}}`
   `{{operator_name}}` `{{sender_name}}` `{{salutation}}` `{{claim_url}}`
   plus any field key (e.g. `{{observed_gap}}`, `{{channel_pitch}}`).
   Unresolvable placeholders stay visible — never fabricated.
5. The **resolved preview** shows the merged output. Save to refresh it
   after edits.
6. **Save play** — persisted per (campaign × template). Multiple templates
   can coexist on one campaign; each keeps its own doc.

### Promoting into the pipeline

Promotion is enabled after save (and requires no unsaved changes — the
promoted text is the *resolved saved* version).

- **Use as opener** → `POST /openers/import` with the template's
  `hookAngle` for split-test attribution → lands in Pitch Construction;
  the workspace auto-switches to the pitch tab.
- **Send subject** / **Send closer** → importHeader / importCloser →
  Pitch Construction pickers.
- **Save as anchor** → creates a campaign-scoped `mkt_outreach_anchors`
  row (`draft` status) from the thesis slots — operator thesis,
  verification question, pain probe, recommended transition, observed
  issue. It appears in the Call Script tab's anchor picker and flows
  through the standard §13.4 contact-logging path (anchor snapshot,
  `used` marking, NAP write-back when seed-scoped).

Each promoted row id is stamped back on the doc (`promoted_*` columns) —
the buttons show the produced id once promoted. Editing and re-promoting
creates a *fresh* row; it never overwrites a previous promotion.

### What promotion does NOT do

- It never mutates the detected archetype, hook ranking, or triage result.
- Promoted rows carry `source: 'external'` — provenance lives on the doc
  (`template_key` + `promoted_*` ids), not on the row.

### The WhatsApp play end-to-end

1. Run Business Audit V2 → `website.has_availability_inquiry === false`
   emits `WC_MISSING_AVAILABILITY_INQUIRY`.
2. Manual tab → *WhatsApp availability-check upsell* is SUGGESTED.
3. Verify on the call (verification question is prefilled), probe how
   stock questions arrive (pain question), pivot (recommended transition).
4. Create + publish the free presence seed (prospect handoff), mint the
   claim token, send `/directory/claim/:token`.
5. Promote the play: opener into Pitch Construction for the email
   sequence, anchor into Call Script for the call.
6. Log contact with the anchor selected → anchor snapshot +
   verification results land on the outreach log.

---

## Part 2 — Expansion guide (adding the next template)

Adding a template = **one catalog entry, zero schema/route changes.**

### Step 1 — catalog entry

`apps/api/src/services/outreach-openers/manual-play-templates.ts` —
append a `ManualPlayTemplate` to `MANUAL_PLAY_TEMPLATES`:

```ts
{
  key: 'my_new_play',                        // stable — persisted on docs
  label: 'My new play',
  description: 'Shown under the dropdown.',
  anchorType: 'customer_discovery_problem',  // any MANUAL_ANCHOR_TYPES value
  hookAngle: 'availability_inquiry',         // optional — stamped on promoted openers
  suggestedWhenSignal: 'SOME_SIGNAL_CODE',   // optional — drives the SUGGESTED badge
  fields: [
    { key: 'subject',  label: 'Subject / header',  role: 'header', placeholder: '…', defaultValue: '…' },
    { key: 'opener_text', label: 'Opener',          role: 'opener', placeholder: '…', defaultValue: '…' },
    { key: 'closer_text', label: 'Closer',          role: 'closer', placeholder: '…', defaultValue: '…' },
    { key: 'operator_thesis', label: 'Operator thesis', role: 'thesis', … },
    { key: 'verification_question', …, role: 'thesis', … },
    { key: 'pain_question', …, role: 'thesis', … },
    { key: 'recommended_transition', …, role: 'thesis', … },
    { key: 'some_merge_value', …, role: 'note', … },
  ],
  scriptBody: `…{{business}}…{{some_merge_value}}…`,
}
```

Field conventions:

- `role` controls the promote buttons automatically — `opener`/`header`/
  `closer`/`thesis` each render their button; `note` is merge-only.
- Anchor promotion reads thesis slots by **key**: `operator_thesis`,
  `verification_question`, `pain_question`, `recommended_transition`,
  and the note slot `observed_gap` → `observedIssue`. Keep those keys.
- `defaultValue` prefills the slot on fresh selection.
- Write opener defaults **quality-gate-shaped** (salutation, preview
  reference, close, signoff) so the imported opener passes green.
- `suggestedWhenSignal` must be a real detected-signal code
  (`signal-extractor.ts` taxonomy); omit it for always-available plays.

### Step 2 — nothing else

- The catalog is validated by `getManualPlayTemplate()` — unknown
  `template_key` → 400 with the valid list. No enum/CHECK to sync
  (deliberate — enum-drift rule, migrations 256/264/270).
- `listTemplatesForCampaign`, the dropdown, role badges, promote buttons,
  and merge resolution all derive from the entry — no frontend change.

### When you DO need more than a catalog entry

| Need | Change |
|---|---|
| New merge placeholder | Extend `buildMergeContext` in `ManualOutreachScriptService.ts` |
| New anchor type | Add to `MANUAL_ANCHOR_TYPES` (ManualOutreachAnchorService) — and CHECK `mkt_outreach_anchors` constraints per AGENTS.md enum-sync rule |
| New field role / promote target | `ManualFieldRole` (backend + `MarketingOpsService.ts`), `ROLE_BADGES` + promote handler in `ManualScriptPanel.tsx` |
| Different persistence (e.g. prospect-scoped) | New migration — the table is campaign-scoped by design |

### Testing

- `HookSuggestionService`/`CallScriptService` tests pin catalog counts —
  templates are NOT hooks, so no count bumps needed for new templates.
- Service-level tests for the lane: upsert round-trip, template
  validation, `suggested` flag, merge resolution
  (`ManualOutreachScriptService` — follow the CallScriptService test's
  mock pattern).
- Verify: `pnpm checkapi`, `pnpm checkweb`, focused vitest run.
