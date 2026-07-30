# Marketing Ops — User Guide

**Scope:** This guide covers the recently implemented admin Marketing Operations module and its new pages.

**Sources:**
- `docs/LocalBiz/local_marketing_ops_gap_analysis_and_optimized_plan.md`
- `docs/LocalBiz/local_marketing_ops_sprint_plan_v3.md`
- `docs/LocalBiz/tenant_prospecting_channel_sprint_plan.md`
- `docs/LocalBiz/local_marketing_ops_payment_collection_sprint_plan.md`

---

## 1. What Marketing Ops Does

Marketing Ops turns each local business prospect into a **campaign journey**. An admin tracks the prospect from first discovery (`seek`) through preview, payment, delivery, and ultimately a recurring retainer or tenant conversion.

### Core Admin Workflows

- **Campaign intake** — capture business, audit, and contact details.
- **Pipeline tracking** — move prospects through defined stages.
- **Prompt execution** — run AI prompt templates for seek, fulfill, filter, and retainer content.
- **Deliverable generation** — produce branded, watermarked PDFs from AI output.
- **Branding control** — configure operator colors, logo, and footer for all generated PDFs.
- **Daily scorecards** — log outreach activity and revenue.
- **Tenant conversion** — link a campaign to a real or demo tenant and track first/last-touch attribution.

---

## 2. Campaign Pipeline Stages

The stage names are shown as color-coded badges across the module (`StageBadge.tsx`).

| Stage | Meaning |
|-------|---------|
| **Seek** | Prospect identified; audit data being captured. |
| **Preview Built** | A deliverable preview has been generated. |
| **Shown** | Preview presented to the business. |
| **Paid** | Payment received; full deliverable in production. |
| **Delivered** | Package delivered to the business. |
| **Retainer Pitched** | Recurring service offer presented. |
| **Retainer Won** | Active recurring revenue client. |
| **Lost** | Did not convert; can be resurrected. |
| **Dead** | No opportunity. |
| **Tenant Onboarded** | Prospect has become a platform tenant. |

Stage transitions are validated; some moves are irreversible and all transitions are logged in `mkt_stage_history_list`.

---

## 3. Getting to Marketing Ops

1. Sign in as a platform admin.
2. Open **Admin Settings**.
3. Select **Marketing Ops** in the sidebar (Megaphone icon) or use the **Marketing Ops** settings card.
4. The dashboard loads at `/settings/admin/marketing-ops`.

---

## 4. Dashboard — `/settings/admin/marketing-ops`

`MarketingOpsDashboardClient.tsx` is the module landing page.

### What You See

- **Metric cards:**
  - Total campaigns
  - Total revenue (with sub-line showing marketing revenue from online payments and payment count)
  - Retainers won
  - Conversion rate (shown → paid)
- **Weekly summary:**
  - Previews built
  - Packages delivered
  - Weekly revenue (with sub-line showing online payment revenue when available)
- **Tenant Conversion widget** (if the Tenant Prospecting Channel is enabled): total conversions, conversion rate, resurrected conversions, QR view-to-conversion rate, demo claim rate, and average days to convert.
- **Pipeline by Stage:** horizontal bars showing campaign count per stage.
- **Quick action cards:**
  - Campaign Tracker
  - New Campaign
  - Prompt Library
  - Scorecards

### Actions

- Click **Refresh** to reload data.
- Click **Export CSV** to download a CSV of campaigns.
- The dashboard auto-refreshes every 30 seconds.

---

## 5. Campaigns — `/settings/admin/marketing-ops/campaigns`

`CampaignListClient.tsx` shows the full campaign list.

### List View

Columns include:

- Business name (click to open campaign detail)
- Category, City
- Stage badge
- Tenant link status (`Linked` / `Unlinked`)
- Estimated fee and amount paid
- Assigned operator

### Kanban View

- Toggle the **table / kanban** buttons in the top right.
- Each column represents a pipeline stage.
- Cards show business name, category, city, assigned user, and estimated fee.

### Filtering and Search

- Search by business name, category, or city.
- Filter by stage.
- Click **New Campaign** to create a campaign.

---

## 6. New Campaign — `/settings/admin/marketing-ops/campaigns/new`

`CampaignFormClient.tsx` in create mode.

### What to Enter

The form is split into four cards:

#### Business Information

- **Business Name** (required)
- **Category** (required) — select an existing category or choose `+ New category...` and enter a new one
- **Tone** (optional) — select an existing tone or choose `+ New tone...` and enter a new one
- **City** (required) — select an existing city or choose `+ New city...` and enter a new one
- **Neighborhood** (optional) — select an existing neighborhood or choose `+ New neighborhood...` and enter a new one
- **Display ID** (optional human-readable ID)
- **Assigned To** (optional) — select a platform staff user from the dropdown

#### Classification

- **Retainer** (optional) — select `Fast`, `Medium`, or `Slow` to classify the prospect's retainer timeline
- **Attributes** (optional) — checkbox list of campaign attributes: High Ticket, Upscale, Friendly, Professional, Fast Retainers

#### Contact & GBP Audit

- **Contact Method** — checkbox list; add custom methods if needed.
- **Contact Info**
- **GBP Claimed** — select `Unknown`, `Yes`, or `No` from the dropdown
- **Unaddressed Reviews**
- **Last Review Date**
- **Has Website** (e.g., `yes`, `wix`, `none`)
- **NAP Consistent** — select `Unknown`, `Yes`, or `No` from the dropdown
- **Pain Score** (1–10)

#### Pricing & Stage

- **Estimated Tier** — select an existing tier or choose `+ New tier...` and enter a new one
- **Estimated Fee (cents)**
- **Package Price (cents)** — the one-time price for the Marketing Ops package (e.g., `49900` for $499)
- **Service Category** — dropdown of service categories (e.g., review_responses, service_menu, gbp_audit). Used to validate coupons dynamically per category.
- **Coupon Code** (optional) — a coupon code to apply at checkout for the prospect
- **Subscription Tier ID** (optional) — a platform tier ID for recurring billing after the one-time payment

Click **Create Campaign** to save. You are redirected to the new campaign detail page.

---

## 7. Prompts — `/settings/admin/marketing-ops/prompts`

`PromptLibraryClient.tsx` is the template library.

### Template Types

Prompts are grouped by type:

- **Seek** — discovery/audit prompts
- **Fulfill** — content generation prompts
- **Filter** — quality-control prompts
- **Retainer** — follow-up sequence prompts
- **Category Analysis** — category-wide research
- **City Analysis** — city-wide research

### Actions

- Use the **All Types** dropdown to filter.
- Click **New Template** to create a template.
- Each card shows:
  - Name
  - Type badge
  - Default status
  - A snippet of the prompt body
  - Category (if set)
- Click **Open Workspace** to run or edit the template in `PromptWorkspaceClient.tsx`.
- Click the pencil icon to edit or the trash icon to delete.

### Creating/Editing a Template

In the modal:

1. Enter a **Name**.
2. Choose a **Prompt Type** from the dropdown.
3. Select an optional **Category** from the dropdown, or choose `+ New category...` and enter a new one.
4. Write the **Prompt Body** using `{{variable_name}}` placeholders.
5. Check **Set as default for this type** if this should be the default.
6. Click **Save**.

### Running a Prompt

Each prompt can be run in either of two modes from the **Prompt Workspace** (open via **Open Workspace** on a template card):

- **Copy-Paste Bridge (external)** — the platform renders the final prompt text with variables injected. Click **Copy**, paste the text into any external AI (OpenAI, Claude, etc.), then paste the result back into the campaign notes or deliverable content.
- **Direct API (in-platform)** — select the target campaign and click **Execute Prompt**. The platform calls the configured AI provider, stores the result as a `marketing_prompt_executions` record, and can feed it directly into deliverables or campaign files.

Both modes are valid and share the same goal: producing the seek/fulfill/retainer output that drives prospecting, capturing, and conversion. Use Copy-Paste when you want manual control or the provider is outside the platform; use Direct API when you want tracked, in-platform execution tied to a campaign.

---

## 8. Scorecards — `/settings/admin/marketing-ops/scorecards`

`ScorecardClient.tsx` tracks daily activity.

### Adding a Scorecard Entry

1. Click **New Entry**.
2. Select the **User ID** from the staff dropdown.
3. Pick the **Date**.
4. Select optional **Category Focus** and **Neighborhood Focus** from the dropdowns, or choose `+ New...` and enter a new value.
5. Fill activity numbers:
   - Previews Built
   - Previews Shown
   - Packages Paid
   - Packages Delivered
   - Revenue (cents)
   - Retainers Pitched
   - Retainers Won
6. Add **Notes** if needed.
7. Click **Save Entry**.

### History Table

The table lists previous entries with:

- Date
- Focus (category · neighborhood)
- Built, Shown, Paid, Delivered
- Revenue
- Retainers (won/pitched)
- Delete action

---

## 9. Deliverable Templates — `/settings/admin/marketing-ops/deliverable-templates`

`DeliverableTemplateLibraryClient.tsx` manages PDF layout templates used to generate client deliverables.

### Deliverable Types

| Type | Use |
|------|-----|
| Review Responses | Numbered response pack + reusable templates |
| Service Menu | One-page service menu |
| GBP Audit Report | Scorecard and competitor comparison |
| Testimonial Cards | Quote cards with branding |
| NAP Consistency Report | Cross-platform NAP comparison |
| SEO Content | Service-area page content |
| Lead Magnet | PDF guide or checklist |

### Managing Templates

- Filter by type using the pill buttons.
- Click **New Template** or **Create First Template**.
- Each card shows:
  - Name
  - Type badge
  - Default status
  - Page size and orientation
  - Edit and Delete buttons

### Creating/Editing a Template

In the modal:

1. Enter a **Name**.
2. Select the **Deliverable Type** from the dropdown.
3. Select an optional **Category** from the dropdown, or choose `+ New category...` and enter a new one.
4. Choose **Page Size** (`letter`, `a4`, `legal`) and **Orientation** (`portrait`, `landscape`) from the dropdowns.
5. Edit the **Layout Spec (JSON)**.
6. Toggle **Set as default for this deliverable type**.
7. Click **Save Template**.

### Layout Spec

The layout spec is a JSON object with a `sections` array. Supported section types are:

- `heading`
- `subheading`
- `body`
- `divider`
- `spacing`

Example:

```json
{
  "sections": [
    { "type": "heading", "text": "Review Response Pack" },
    { "type": "subheading", "text": "Prepared for {{business_name}}" },
    { "type": "body", "text": "..." },
    { "type": "divider" },
    { "type": "spacing" }
  ]
}
```

---

## 10. Branding — `/settings/admin/marketing-ops/branding`

`BrandingConfigClient.tsx` controls the look of every generated deliverable PDF.

### What Branding Affects

- PDF header and footer
- Operator name and logo
- Primary, accent, and text colors
- Font family
- Footer disclaimer
- Preview watermark styling

### Managing Branding Configs

- Click **New Config** to add a new operator brand.
- Each card shows:
  - Operator name initial badge in the primary color
  - Active status
  - Color swatches
  - Footer disclaimer preview
  - Edit and Delete buttons

### Creating/Editing a Config

In the modal:

1. Enter **Operator Name**.
2. Enter an optional **Logo URL**.
3. Pick **Primary**, **Accent**, and **Text** colors.
4. Choose **Font Family** (`helvetica`, `times`, `courier`) from the dropdown.
5. Enter a **Footer Disclaimer** (e.g., confidentiality text).
6. Check **Set as active config** to make this the active brand.
7. Click **Save Config**.

Only one config is active at a time. Generated deliverables use the active config automatically.

---

## 11. Generating and Sending Deliverables

Deliverables are generated from a campaign detail page (`/settings/admin/marketing-ops/campaigns/[id]`).

1. Open a campaign.
2. Go to the **Deliverables** tab.
3. Click **Generate Deliverable**.
4. Select:
   - Deliverable template
   - Deliverable type
   - **Preview** or **Paid**
   - Optional execution ID or raw content
5. Click **Generate**.
6. Download the PDF or click **Mark as Sent** with a send method.

- **Preview** PDFs include a diagonal `PREVIEW` watermark.
- **Paid** PDFs remove the watermark and include the full content.

---

## 12. Tenant Prospecting and Conversion

If the Tenant Prospecting Channel is enabled, Marketing Ops becomes a tenant acquisition tool.

### Key Capabilities

- **Demo Storefront** — generate a category-matched demo tenant from campaign data.
- **QR Deliverables** — generated PDFs include a QR code linking to a public preview page.
- **Public Preview Page** — shows a watermarked deliverable and a signup CTA.
- **Token-Only Attribution** — public links carry a `ptoken`; campaign and source are resolved server-side.
- **Demo-to-Real Conversion** — a demo tenant can become the prospect's real tenant on signup.
- **Trial Grant** — a matching BSaaS trial can be granted on conversion.

### Campaign-to-Tenant Flow

1. From a campaign detail, click **Generate Demo Storefront** or create a deliverable with a QR preview link.
2. The prospect scans the QR or visits the demo URL.
3. They sign up with the token in the URL.
4. The platform links the campaign to the new tenant and sets `tenant_onboarded`.
5. The `marketing_campaign_converted` notification fires.

### Attribution Fields

- `first_touch_source` — write-once, first recorded interaction.
- `last_touch_source` — last interaction before conversion.
- `campaign_origin` — `prospect` (new acquisition) or `upsell` (existing tenant).

---

## 13. Common Tasks

### Create a New Prospect

1. Dashboard → **New Campaign**.
2. Fill the **Business Information** and **Contact & GBP Audit** cards.
3. Click **Create Campaign**.

### Move a Campaign Forward

1. Open the campaign from **Campaign Tracker**.
2. Use the stage pipeline on the campaign detail page or edit the campaign.
3. Add a note when prompted.

### Run a Prompt

1. Go to **Prompt Library**.
2. Click **Open Workspace** on a template.
3. Enter or confirm variables.
4. Choose a mode:
   - **Copy-Paste** — click **Copy**, run the prompt in an external AI, and paste the result back.
   - **In-Platform** — select the campaign and click **Execute Prompt**.
5. Review the AI output and save it to the campaign.

### Brand a Deliverable

1. Go to **Branding**.
2. Create or edit an active config with operator name, colors, and logo.
3. Generate a deliverable from a campaign; the active brand is applied automatically.

---

## 14. Field Reference

### Campaign Fields

| Field | Purpose |
|-------|---------|
| `business_name` | Prospect business name |
| `category` | Business category |
| `city` / `neighborhood` | Location |
| `contact_method` / `contact_info` | How to reach the prospect |
| `gbp_claimed` | Whether Google Business Profile is claimed |
| `unaddressed_reviews` | Number of unresponded reviews |
| `has_website` | Website status/technology |
| `nap_consistent` | Name/Address/Phone consistency across platforms |
| `estimated_tier` / `estimated_fee_cents` | Pricing estimate |
| `package_price_cents` | One-time package price for the Marketing Ops package |
| `service_category` | Service category for coupon validation (e.g., review_responses, service_menu) |
| `coupon_code` | Optional coupon code applied at checkout |
| `subscription_tier_id` | Optional platform tier ID for recurring billing after one-time payment |
| `tone` | Optional tone classification for the campaign |
| `retainer` | Retainer timeline classification: Fast, Medium, or Slow |
| `attributes` | Array of campaign attribute tags (High Ticket, Upscale, Friendly, Professional, Fast Retainers) |
| `pain_score` | 1–10 sales qualification score |
| `stage` | Current pipeline stage |
| `amount_paid_cents` | Money collected |
| `package_delivered` | Description of delivered package |
| `retainer_status` / `retainer_amount_cents` / `retainer_start_date` | Retainer details |
| `assigned_to` | Platform user assigned to the campaign |

### Branding Fields

| Field | Purpose |
|-------|---------|
| `operator_name` | Header/footer name |
| `operator_logo_url` | Header logo image |
| `primary_color` | Header/primary accent |
| `accent_color` | Highlights/dividers |
| `text_color` | Body text |
| `font_family` | Typography |
| `footer_disclaimer` | Legal/notice text |
| `is_active` | Whether this is the active brand |

---

## 15. Troubleshooting

| Problem | Likely Cause | Fix |
|---------|--------------|-----|
| Marketing Ops not in sidebar | `navigation_links` table not seeded | Run the `128_marketing_ops.sql` seed or check the admin settings card. |
| Deliverable generation fails | Invalid JSON layout spec or missing active branding config | Check the template layout spec JSON and verify an active branding config exists. |
| Campaign stage won't change | Transition is not in `VALID_TRANSITIONS` | Review allowed stage moves in the campaign detail; some transitions are irreversible. |
| QR preview link 404s | Preview token expired | Generate a new preview token from the campaign deliverables tab. |
| Dashboard conversion widget missing | `tenant_prospecting_channel` migration not applied | Apply migration `129_tenant_prospecting_channel.sql`. |

---

## 17. Campaign Detail — `/settings/admin/marketing-ops/campaigns/[id]`

`CampaignDetailClient.tsx` is the single-campaign workspace.

### Header

- Business name, category, city, neighborhood, and display ID.
- Current stage badge.
- **Demo Active** badge if a demo storefront exists.

### Actions

- **Demo Storefront** — generate or refresh a demo tenant and preview URL.
- **Link Tenant** — link the campaign to an existing platform tenant.
- **Edit** — open the campaign form.
- **Delete** — remove the campaign.
- **Refresh** — reload campaign data.

### Stage Pipeline

- A horizontal row of all 10 stages.
- Past stages are blue, the current stage is filled, and future stages are gray.
- Click a stage to attempt a transition. Invalid moves are rejected with an error.

### Tabs

- **Overview** — campaign summary, pricing & payment details (package price, service category, coupon code, subscription tier), revenue records with receipt download links, conversion attribution, retainer details, and notes.
- **Audits** — `marketing_audits` records (e.g., GBP scores, pain score).
- **Files** — attached campaign files.
- **Deliverables** — generate, download, and mark deliverables as sent.
- **Stage History** — chronological transition log.

---

## 18. Filter Review — `/settings/admin/marketing-ops/filter-review`

`FilterReviewClient.tsx` is the AI output review queue.

### What It Does

After a `fulfill` prompt runs, a `filter` prompt can auto-audit the AI output. Failed checks create `marketing_filter_flags` for human review.

### Review Queue

- Filter by status: **All**, **Pending**, **Fixed**, **Approved As-Is**.
- The header shows pending count, total flags, and pass rate.
- **Fix All** / **Approve All** batch buttons for pending flags.

### Per-Flag Actions

- **Mark Fixed** — accept the suggested fix and set the status to `fixed`.
- **Approve As-Is** — keep the output and set the status to `approved_as_is`.
- **Edit Override** — manually enter a corrected response, then **Save & Mark Fixed**.
- View the failed checks, suggested fix, and the execution / response number that generated the flag.

---

## 19. Stage Transitions and Rules

Campaign stage moves are governed by `VALID_TRANSITIONS` in `MarketingCampaignService.ts`.

### Manual Transitions

- From the campaign detail stage pipeline, click the desired stage.
- Each transition is logged in `mkt_stage_history_list` with timestamp, user, and an optional note.

### Irreversible and Invalid Moves

- Some transitions cannot be undone (e.g., `paid` cannot revert to `seek`).
- Invalid moves display an error; no state change is recorded.

### Automated and Resurrection Transitions

- `shown` campaigns with no response after 7 days can auto-advance to `lost` (configurable).
- `lost`, `dead`, and `retainer_won` campaigns can be resurrected to `tenant_onboarded` through the Tenant Prospecting Channel.

---

## 20. Prompt Versioning and Execution Metadata

`PromptLibraryClient.tsx` and `PromptWorkspaceClient.tsx` track the prompt lifecycle.

### Template Versioning

- Each template card shows a version number.
- Saves to a template create a new version while preserving execution history from prior versions.

### Execution Record

When a prompt is executed, `MarketingOpsService` records:

- `campaign_id` and `template_id`
- `variables_used`
- `raw_output` and `filtered_output`
- `status`
- `pass_rate` and `flagged_count`
- `tokens_used`
- `cost_cents`
- `ai_provider` and `ai_model`
- `executed_at`

The Prompt Workspace shows the 10 most recent executions with status, pass rate, and flagged count.

---

## 21. Deliverable Public Preview and QR Conversion Flow

The Tenant Prospecting Channel adds public, watermarked previews to deliverables.

### How It Works

1. Generate a **preview** deliverable from the campaign.
2. The platform creates a public preview token (30-day default).
3. A QR code linking to the public preview page is embedded in the deliverable.
4. The prospect scans the QR, sees the watermarked deliverable, and sees a signup CTA.
5. If the prospect signs up, the campaign is linked to the new tenant and `tenant_onboarded` is set.

### Demo Storefront Alternative

- Click **Demo Storefront** on a campaign to create a demo tenant.
- The demo has its own 30-day preview URL.
- Use **Copy Demo URL**, **Open Demo**, or **Preview** to share it.

### Attribution

- `first_touch_source` is written once on the first recorded interaction.
- `last_touch_source` is updated on every subsequent touch and represents the final conversion driver.

---

## 22. Campaign Audits and Files

### Audits Tab

- Lists `marketing_audits` records attached to the campaign.
- Each audit stores response data, scores, and metadata from a prompt execution or manual intake.

### Files Tab

- Lists `marketing_files` records attached to the campaign.
- Files can include uploaded PDFs, screenshots, or exported deliverables.

---

## 23. Best Practices, Use Cases, and Known Frictions

### Use Case: From First Contact to Retainer

1. **Prospecting** — use a `seek` prompt to find a local business and capture category, GBP status, reviews, and pain points in the campaign form.
2. **Preview** — run a `fulfill` prompt to generate a deliverable (review responses, service menu, GBP audit). Use **Filter Review** to catch compliance issues.
3. **Presentation** — generate a **watermarked preview** deliverable and share the QR code or demo storefront with the prospect.
4. **Payment** — set the **Package Price** and optional **Coupon Code** on the campaign. The prospect pays via the public pay page (QR code, demo storefront, or direct link). Payment is processed through Stripe; the campaign automatically transitions to `paid` and revenue is recorded.
5. **Delivery** — once paid, deliverables are automatically upgraded from preview to paid (watermarks removed). Generate the unmarked paid deliverable.
6. **Retention** — transition to `retainer_pitched` and `retainer_won` using a `retainer` prompt.
7. **Attribution** — `first_touch_source` and `last_touch_source` track which deliverable or demo drove the conversion.

### Advice for Prompts

- Start with the **Copy-Paste Bridge** when testing a new AI provider or prompt wording; switch to **Direct API** once the template is stable and you want execution history.
- Use `{{variable_name}}` placeholders for anything that changes per campaign (business name, city, category).
- Set a **default template per prompt type** so the workspace pre-selects the right one.
- Keep prompts concise — long prompts cost more tokens and take longer to execute.

### Advice for Campaigns

- Update the stage immediately after the real-world event happens (e.g., `shown` only after the business has actually seen the preview).
- Add notes on every stage transition; the **Stage History** becomes your source of truth.
- Use **Demo Storefront** for high-value prospects who need to see the product live.
- Use **Link Tenant** as soon as the prospect signs a paid agreement so data flows into the platform.

### Advice for Deliverables and Branding

- Always keep an **active branding config**; otherwise deliverable generation may fail.
- Use **preview** mode for prospecting; use **paid** mode only after payment is collected.
- Regenerate the preview token / QR if it expires (default 30 days).
- Match brand colors and logo to the operator's identity; the paid deliverable should look like it came from the sales rep.

### Advice for Scorecards

- Enter scorecards daily, even on zero-activity days, so the dashboard and conversion metrics stay current.
- Use **Category Focus** and **Neighborhood Focus** to spot which verticals and territories convert best.
- Align scorecard numbers with real campaign stage transitions so pipeline math stays honest.

### Known Gaps and Potential Frictions

- **Cost tracking is backend-only.** `cost_cents` and `tokens_used` are recorded for every execution, but there is no UI dashboard for per-prompt or per-campaign spend yet.
- **Prompt version rollbacks are not in the UI.** The database stores versions, but the library does not yet let you view or restore an older version.
- **Batch prompt execution is planned for v1.1.** For now, prompts are run one campaign at a time.
- **Filter Review requires an active `filter` prompt.** If no filter template is configured, no flags are generated and the review queue stays empty.
- **Demo Storefront and Public Preview depend on demo-tenant infrastructure.** If the demo storefront service or templates are not configured, these actions may fail.
- **Link Tenant uses a raw tenant ID prompt.** There is no search or autocomplete, so you need the exact tenant ID.
- **Attribution is only captured through the public preview or demo flow.** Manual signups must be linked manually with **Link Tenant**.
- **Route coverage warnings** in the test suite (duplicate mount paths) are a pre-existing platform-wide concern and not specific to Marketing Ops.
- **Payment receipts require a completed payment.** The receipt PDF download link only appears on the campaign detail when revenue records exist.
- **Coupon validation is server-side only.** The public pay page validates coupons via the backend; client-side total mismatches are rejected.

---

## 24. Public Pay Page — `/marketing/pay`

`PayPageClient.tsx` is the public-facing payment page for Marketing Ops packages.

### How It Works

1. The prospect receives a pay link (via QR code, demo storefront, or direct URL) containing a `ptoken`.
2. The page resolves the token server-side to load campaign details, package price, and service category.
3. The prospect can optionally enter a **coupon code** — the page validates it server-side and shows the discounted total.
4. The prospect enters payment details via Stripe Elements and clicks **Pay**.
5. The backend creates a Stripe PaymentIntent, confirms the payment, and transitions the campaign to `paid`.
6. On success, the page shows a confirmation with a **Download Receipt** button (PDF receipt generated server-side).
7. Deliverables are automatically upgraded from preview to paid (watermarks removed).

### Admin Setup

To enable payment collection on a campaign:
1. Set the **Package Price** on the campaign form (in cents, e.g., `49900` for $499).
2. Optionally set a **Service Category** (for coupon validation) and **Coupon Code**.
3. Optionally set a **Subscription Tier ID** for recurring billing after the one-time payment.
4. Share the pay link with the prospect via QR code, demo storefront, or direct URL.

---

## 25. References

- `docs/LocalBiz/local_marketing_ops_gap_analysis_and_optimized_plan.md`
- `docs/LocalBiz/local_marketing_ops_sprint_plan_v3.md`
- `docs/LocalBiz/tenant_prospecting_channel_sprint_plan.md`
- `docs/LocalBiz/local_marketing_ops_payment_collection_sprint_plan.md`
- `docs/LocalBiz/MARKETING_OPS_USER_GUIDE_GAP_CLOSE_SPRINT.md`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/filter-review/FilterReviewClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/PromptLibraryClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/[id]/PromptWorkspaceClient.tsx`
- `apps/web/src/app/marketing/pay/PayPageClient.tsx`
- `apps/web/src/services/MarketingOpsService.ts`
- `apps/web/src/components/marketing-ops/StageBadge.tsx`
- `apps/api/src/services/MarketingCampaignService.ts`
- `apps/api/src/routes/marketing-ops-public.ts`
- `apps/api/src/services/subscription/SubscriptionBillingService.ts`
