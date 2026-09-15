# Seed Intelligence Report Smoke-Test Guide

> **Purpose:** Verify the end-to-end Automated Seed Intelligence Report path across database, API, public report, claim invitation, QR delivery, manual outreach anchors, owner verification, and report refresh.
>
> **Scope:** Seed report implementation from migrations 271–274 and related report/anchor work.
>
> **Safety:** Use a dedicated local or staging test seed. Do not run destructive cleanup against shared or production data.

---

## 1. What this smoke test proves

The smoke test should prove this flow works:

```text
Existing seed/substrate
    ↓
Report refresh
    ↓
Published report version
    ↓
Public preview/full/PDF surfaces
    ↓
Claim CTA and token gating
    ↓
Report delivery QR/short URL
    ↓
Seed or campaign manual anchor
    ↓
Contact verification event
    ↓
Canonical listing/provenance write-back
    ↓
New report version or idempotent reuse
    ↓
Re-engagement suggestion
```

This is not a market-quality test. It verifies that the platform can safely assemble, publish, deliver, verify, and refresh a seed intelligence report.

---

## 2. Preconditions

### 2.1 Working-tree checks

Before beginning, confirm the expected implementation is present:

```bash
git status --short
```

Review any unrelated changes before running the smoke test. Do not reset, discard, or overwrite user changes.

### 2.2 Required migrations

The following migrations must exist and be applied to the target database:

```text
271_directory_field_provenance_evidence_state.sql
272_mkt_outreach_log_anchor_columns.sql
273_mkt_seed_intelligence_reports.sql
274_mkt_outreach_anchors.sql
```

Apply them according to the project’s manual SQL migration policy:

```bash
# Run from the repository root; use the appropriate Doppler/database context.
psql "$DATABASE_URL" -f database/migrations/271_directory_field_provenance_evidence_state.sql
psql "$DATABASE_URL" -f database/migrations/272_mkt_outreach_log_anchor_columns.sql
psql "$DATABASE_URL" -f database/migrations/273_mkt_seed_intelligence_reports.sql
psql "$DATABASE_URL" -f database/migrations/274_mkt_outreach_anchors.sql
```

Do not use `prisma migrate dev`, `prisma db push`, or `prisma migrate reset` for this workflow.

After the migration is applied to the target environment:

```bash
cd apps/api
npx prisma db pull
npx prisma generate
```

### 2.3 Database schema checks

Run read-only verification queries:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'directory_field_provenance'
  AND column_name IN ('evidence_state', 'notes');

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'mkt_outreach_log'
  AND column_name IN ('anchor_id', 'anchor_snapshot', 'verification_results');

SELECT to_regclass('public.mkt_seed_intelligence_reports');
SELECT to_regclass('public.mkt_outreach_anchors');

SELECT data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'directory_seed_outreach_touches'
  AND column_name = 'id';
```

Expected:

- `evidence_state` and `notes` exist.
- All three anchor columns exist on `mkt_outreach_log`.
- Both new report/anchor tables exist.
- `directory_seed_outreach_touches.id` remains UUID-compatible.

### 2.4 Test seed requirements

Choose a seed with:

- a valid `directory_presence_seeds.id`;
- a linked listing;
- category and city values;
- at least one provenance row;
- a tenant ID;
- an active or issuable claim token;
- no production customer-sensitive data.

Capture:

```text
SEED_ID
LISTING_SLUG
TENANT_ID
CAMPAIGN_ID (optional)
CLAIM_TOKEN (do not paste into logs or commit it)
```

The seed should be test-owned or staging-owned. Do not use a real prospect for destructive write-back testing.

---

## 3. Pre-flight application checks

Run both application typechecks:

```bash
pnpm checkapi
pnpm checkweb
```

Run focused unit tests:

```bash
cd apps/api

doppler run --config local -- npx vitest run \
  src/services/__tests__/PromptComposerService.test.ts \
  src/services/__tests__/SeedReportEvidenceService.test.ts \
  src/services/__tests__/SeedReportDeliveryService.test.ts \
  src/validators/__tests__/seed-report-lint.test.ts \
  --reporter=dot
```

Expected:

- Zero TypeScript errors.
- All focused test files pass.

---

## 4. Surface map

Use the surfaces in this order.

### 4.1 Operator report refresh

```text
POST /api/admin/directory/presence-seeds/:id/report/refresh
```

Example:

```bash
curl -X POST \
  "$API_BASE/api/admin/directory/presence-seeds/$SEED_ID/report/refresh" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Expected response:

```json
{
  "success": true,
  "data": {
    "report_id": "sir-...",
    "version": 1,
    "status": "provisional|complete|claimed",
    "published": true,
    "lint_passed": true,
    "reused": false
  }
}
```

A report with `insufficient_evidence` or `requires_identity_review` may be generated for operator review but must not become a public claim hook.

### 4.2 Report version history

```text
GET /api/admin/directory/presence-seeds/:id/report/versions
```

Verify:

- version 1 exists;
- `generated_at` is populated;
- `published_at` is populated only when lint passed;
- evidence count and status are present;
- report versions are ordered newest first.

### 4.3 Public preview

```text
GET /api/public/marketing/seed/:seedId/report/preview
```

Expected for an eligible report:

- HTTP 200;
- business identity summary;
- source counts;
- category and location classification;
- intelligence signals;
- `next_actions.cta_eligible = true` when claim eligibility passes;
- active claim token and short code only when CTA eligibility is true.

Expected for an ineligible report:

- HTTP 404 `no_published_report`;
- no claim token returned;
- no internal report details returned.

### 4.4 Public full report

```text
GET /api/public/marketing/seed/:seedId/report
```

Verify:

- it returns the same report version as preview;
- it includes the full public-safe DTO;
- it does not expose raw prompt output, lint findings, operator-only notes, or private contact data;
- claim token exposure matches preview behavior.

### 4.5 Public PDF

```text
GET /api/public/marketing/seed/:seedId/report/pdf
```

Verify:

- HTTP 200 for an eligible published report;
- `Content-Type: application/pdf`;
- report version matches the API report;
- claim QR/URL appears only when claim CTA eligibility permits it;
- internal-only reports return 404.

### 4.6 Public web page

Open:

```text
/seed-report/:seedId
```

Verify:

- loading state appears before data resolves;
- report-not-available state is clear and non-alarming;
- identity summary is readable on mobile;
- “How we found this business” explains source effort;
- claim CTA appears only when eligible;
- QR is generated only when a claim short code exists;
- no internal state labels or raw evidence IDs are visible;
- no horizontal overflow at 320px and 390px widths.

### 4.7 Seed listing preview

Open the public listing page:

```text
/place/:slug
```

Verify:

- the report preview appears only when a published report exists;
- the preview uses the same report version as `/seed-report/:seedId`;
- the claim CTA links to the existing claim flow;
- no report preview appears for an internal-only report;
- the listing remains usable if the report endpoint returns 404.

### 4.8 Admin report delivery kit

Metadata:

```text
GET /api/admin/directory/presence-seeds/:id/report-qr-kit
```

QR PNG:

```text
GET /api/admin/directory/presence-seeds/:id/report-qr-kit/png?channel=email
```

Postcard PDF:

```text
GET /api/admin/directory/presence-seeds/:id/report-qr-kit/postcard?channel=in_person
```

Verify:

- report must be published;
- QR URLs point to the correct channel route;
- QR/short-code resolution lands on `/seed-report/:seedId`;
- invalid channels fall back safely to `in_person`;
- delivery touch uses a UUID ID;
- repeated recording of the same report version/channel does not create duplicate touches.

---

## 5. Manual anchor smoke test

### 5.1 Create a seed-scoped anchor

```text
POST /api/admin/directory-presence/presence-seeds/:id/outreach-anchors
```

Example body:

```json
{
  "anchorType": "seed_claim_invitation",
  "title": "Invite business to claim prepared seed",
  "operatorThesis": "Public business signals were reconciled into a preliminary seed, but ownership is not yet verified.",
  "observedIssue": "The business record was found across multiple public sources.",
  "verificationQuestion": "Is this still the correct business information?",
  "painQuestion": "Do customers ever have trouble finding accurate information about the business online?",
  "recommendedTransition": "We assembled a free seed from the public information we found. Would you like to review and claim it?",
  "expectedVerification": "claim"
}
```

Expected:

- HTTP 201;
- status `draft`;
- seed ID populated;
- no detected archetype mutation.

### 5.2 Activate anchor

```text
POST /api/admin/directory-presence/outreach-anchors/:anchorId/activate
```

Verify:

- status changes from `draft` to `active`;
- activation actor and timestamp are populated;
- the anchor is available to the call-script surface.

### 5.3 Verify call-script injection

For a campaign-scoped anchor:

```text
GET /api/admin/marketing-ops/:campaignId/call-script?anchorId=:anchorId
```

Verify the returned script contains:

- anchor title;
- verification question;
- recommended transition;
- existing detected-archetype hook;
- no replacement of the detected archetype.

### 5.4 Record seed-scoped contact

```text
POST /api/admin/directory-presence/outreach-anchors/:anchorId/contact
```

Example body:

```json
{
  "seedId": "seed-...",
  "callResult": "connected",
  "verificationResults": [
    {
      "type": "fact_confirmed",
      "field": "address",
      "value": "1 Main St, Fort Wayne, IN"
    },
    {
      "type": "pain_not_present",
      "field": "customer_discoverability",
      "owner_response": "Customers generally find us through community referrals."
    }
  ],
  "notes": "Owner confirmed the address and requested the claim link."
}
```

Verify:

- one seed outreach touch is created;
- the touch has a UUID ID;
- the touch contains channel, outcome, notes, and operator ID;
- a connected `fact_confirmed` result creates a verification record;
- the report refreshes once;
- the anchor becomes `used`;
- retrying the same contact event does not create a duplicate touch.

### 5.5 Record campaign-scoped contact

```text
POST /api/admin/marketing-ops/:campaignId/outreach-anchors/:anchorId/contact
```

Example body:

```json
{
  "seedId": "seed-...",
  "channel": "phone",
  "callResult": "connected",
  "verificationResults": [],
  "notes": "Campaign-scoped anchor contact."
}
```

Verify `mkt_outreach_log` contains:

```text
stage_at_time
contact_channel
contact_date
outcome
contacted_by
call_details
anchor_id
anchor_snapshot
verification_results
```

The log must not reference nonexistent columns such as `call_result` or `created_by`.

### 5.6 No-answer safety test

Repeat with:

```json
{
  "callResult": "no_answer",
  "verificationResults": [
    {
      "type": "fact_confirmed",
      "field": "address",
      "value": "1 Main St"
    }
  ]
}
```

Verify:

- outreach touch is recorded;
- no owner-confirmed NAP verification is created;
- no canonical field is updated;
- no report-visible owner confirmation is created.

---

## 6. Canonical write-back verification

Before contact, capture:

```sql
SELECT business_name, address, phone, website
FROM directory_listings_list dl
JOIN directory_presence_seeds dps ON dps.listing_id = dl.id
WHERE dps.id = '<SEED_ID>';

SELECT field_key, value, evidence_state, override_by
FROM directory_field_provenance
WHERE seed_id = '<SEED_ID>'
ORDER BY field_key;
```

After a connected `fact_corrected` event, verify:

```sql
SELECT business_name, address, phone, website, updated_at
FROM directory_listings_list dl
JOIN directory_presence_seeds dps ON dps.listing_id = dl.id
WHERE dps.id = '<SEED_ID>';

SELECT field_key, value, evidence_state, override_by, override_at
FROM directory_field_provenance
WHERE seed_id = '<SEED_ID>'
  AND field_key = '<CORRECTED_FIELD>';

SELECT source, changed_fields, owner_corrected, created_at
FROM directory_seed_nap_verifications
WHERE seed_id = '<SEED_ID>'
ORDER BY created_at DESC;
```

Expected:

- canonical listing value is updated;
- provenance value matches the corrected value;
- provenance state is `owner_corrected`;
- `override_by` is populated;
- NAP verification history preserves the previous and corrected values.

---

## 7. Report refresh and versioning

After owner verification:

```text
POST /api/admin/directory/presence-seeds/:id/report/refresh
```

Verify:

- a new version is created when report-visible facts changed;
- the new report contains verification activity;
- corrected fields show owner-corrected evidence state;
- the previous report version remains immutable;
- repeating refresh with unchanged inputs returns `reused: true` or otherwise does not create a duplicate version.

For a metadata-only event, such as activating an anchor without new evidence:

- no new report version should be created;
- the anchor audit history may still update.

---

## 8. Re-engagement check

```text
GET /api/admin/directory/presence-seeds/:id/report/reengagement
```

Expected `suggested: true` only when all are true:

- a prior report was delivered;
- the seed is unclaimed;
- a newer report version exists;
- the newer version has a meaningful delta;
- the previous report was not viewed and did not produce a response;
- no decline/opt-out blocks contact;
- the quiet period has elapsed.

Otherwise the response should include explicit reasons such as:

```text
prior report was never delivered
seed is already claimed
latest version has no meaningful delta
quiet window until YYYY-MM-DD
```

---

## 9. Database verification checklist

| Check | Expected | Result |
|---|---|---|
| Migration 271 applied | `evidence_state` and `notes` exist | [ ] |
| Migration 272 applied | anchor columns exist on `mkt_outreach_log` | [ ] |
| Migration 273 applied | report table exists | [ ] |
| Migration 274 applied | anchor table exists | [ ] |
| Seed touch ID type | UUID | [ ] |
| Report version uniqueness | `(seed_id, version)` enforced | [ ] |
| Anchor scope constraint | seed/campaign/prospect required | [ ] |
| Public report indexes | seed/version and published lookup work | [ ] |
| Prisma introspection | matches applied database | [ ] |
| Prisma generation | completes successfully | [ ] |

---

## 10. Application verification checklist

| Check | Expected | Result |
|---|---|---|
| API typecheck | zero errors | [ ] |
| Web typecheck | zero errors | [ ] |
| Evidence tests | pass | [ ] |
| Lint tests | pass | [ ] |
| Prompt composer tests | pass | [ ] |
| Delivery idempotency test | pass | [ ] |
| Public report route tests | pass | [ ] |
| Report refresh | creates/reuses version correctly | [ ] |
| Public preview | correct eligibility and token behavior | [ ] |
| Public PDF | correct eligibility and claim QR behavior | [ ] |
| QR delivery | correct channel URL | [ ] |
| Seed anchor contact | touch + verification + refresh | [ ] |
| Campaign anchor contact | valid campaign outreach log | [ ] |
| NAP write-back | listing + provenance + history | [ ] |
| Re-engagement | delta and quiet-window behavior | [ ] |

---

## 11. Safe cleanup

Do not delete or truncate shared tables.

For a dedicated disposable test seed, use the existing seed/service lifecycle to retire or suppress the test record. If database cleanup is required, obtain explicit approval for the exact deletion scope first.

Safe cleanup should prefer:

- expire the test claim token;
- retire the test anchor;
- mark the test report/seed as internal or unpublished;
- retain report versions for debugging until verification is complete.

Never run:

```text
DROP TABLE
TRUNCATE
DELETE FROM directory_presence_seeds
DELETE FROM mkt_seed_intelligence_reports
```

against a shared environment as part of a smoke test.

---

## 12. Smoke-test completion record

```text
Environment: __________________________
Database: _____________________________
Seed ID: ______________________________
Listing slug: _________________________
Campaign ID: __________________________
Operator: _____________________________
Started: ______________________________
Completed: ____________________________

Report version created: _______________
Report version after verification: ____
Claim CTA eligible: ___________________
Delivery channel tested: ______________
Anchor ID: ____________________________
Contact event ID: _____________________
Seed touch ID: ________________________
NAP field corrected: ___________________
Re-engagement suggested: ______________

Blocking failures:
__________________________________________________
__________________________________________________

Evidence/screenshots/log references:
__________________________________________________
__________________________________________________
```

---

## 13. Exit criteria

The smoke test passes only when:

- migrations are applied and schema-aligned;
- both typechecks pass;
- focused tests pass;
- an eligible report can be refreshed and viewed publicly;
- an ineligible report cannot be publicly claimed;
- report delivery creates a valid, non-duplicate seed touch;
- seed and campaign anchor contacts write to the correct surfaces;
- no-answer does not create owner confirmation;
- connected owner correction updates canonical listing and provenance;
- report refresh creates a meaningful new version or safely reuses the prior version;
- re-engagement output reflects actual delivery, view, response, delta, and quiet-window state;
- no shared data was destructively deleted.
