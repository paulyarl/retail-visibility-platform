# Marketing Ops — User Guide

**Scope:** This guide covers the recently implemented admin Marketing Operations module and its new pages, including Recovery Management and the Multi-Channel Cascade.

**Sources:**
- `docs/LocalBiz/local_marketing_ops_gap_analysis_and_optimized_plan.md`
- `docs/LocalBiz/local_marketing_ops_sprint_plan_v3.md`
- `docs/LocalBiz/tenant_prospecting_channel_sprint_plan.md`
- `docs/LocalBiz/local_marketing_ops_payment_collection_sprint_plan.md`
- `docs/RECOVERY_MANAGEMENT_ENGINE_SPRINT_PLAN.md`
- `docs/RECOVERY_MANAGEMENT_RUNBOOK.md`
- `docs/LocalBiz/PROFILE_REPAIR_INTEGRATION_SPEC.md`
- `docs/LocalBiz/PROFILE_REPAIR_RUNBOOK.md`
- `docs/LocalBiz/MARKETING_OPS_CUSTOMER_PORTAL_SPEC.md` — customer portal (§34)

---

## 1. What Marketing Ops Does

Marketing Ops turns each local business prospect into a **campaign journey**. An admin tracks the prospect from first discovery (`seek`) through preview, payment, delivery, and ultimately a recurring retainer or tenant conversion.

Campaigns belong to one of three categories:

- **Review Management** — the default pipeline (seek → preview → paid → retainer). Covers prospecting, audit, deliverable generation, payment, and tenant conversion.
- **Recovery Management** — dispute resolution for businesses that have received complaints on review platforms. The engine drafts a professional response on behalf of the owner, provides a submission guide, and delivers the approved resolution via email.
- **Triage Management** — dual-signal footprint campaigns where the business has both repair issues (NAP drift, dead URL) and review gaps (drought, unanswered reviews). Assigned by the Intelligent Triage Engine when PB-05 matches. See §31.

### Core Admin Workflows

- **Campaign intake** — capture business, audit, and contact details.
- **Pipeline tracking** — move prospects through defined stages.
- **Prompt execution** — run AI prompt templates for seek, fulfill, filter, and retainer content.
- **Deliverable generation** — produce branded, watermarked PDFs from AI output.
- **Branding control** — configure operator colors, logo, and footer for all generated PDFs.
- **Daily scorecards** — log outreach activity and revenue.
- **Tenant conversion** — link a campaign to a real or demo tenant and track first/last-touch attribution.
- **Recovery management** — generate intake links, collect owner statements, draft AI-powered resolution responses, and deliver approved resolutions to business owners.
- **Multi-channel cascade** — opt-in a review campaign to an automated email → SMS → DM outreach sequence (Day 1/2/4).
- **Intelligent triage** — the triage engine automatically matches seek-stage campaigns to the best outreach playbook based on signals detected in the audit data. Operators review, enrich, accept, or override the recommendation. See §31.
- **Prospect queue** — capture prospects from audit surfaces without leaving the audit, triage them later from a dedicated queue page (List or Board view), and create campaigns when ready. See §33.

---

## 2. Campaign Pipeline Stages

The stage names are shown as color-coded badges across the module (`StageBadge.tsx`). The stage set depends on the campaign category.

### Review Management Stages (default)

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

### Recovery Management Stages

| Stage | Meaning |
|-------|---------|
| **Audit Identified** | Complaint/dispute identified on a review platform. |
| **Framework Preview** | Response framework preview generated. |
| **Outreach Dispatched** | Intake link generated + outreach cascade begins. |
| **Awaiting Owner Intake** | Owner has received the intake link; Day 1/2/4 cascade fires. |
| **Intake Submitted** | Owner submitted their complaint statement + proposed resolution. |
| **Final Resolution Drafted** | Recovery AI Agent drafted the response + submission guide. |
| **Owner Approved** | Operator approved the draft (intermediate — auto-transitions to resolved). |
| **Resolved & Closed** | Resolution delivered to owner via email. |
| **Dead** | Intake timed out, cascade exhausted, or manually closed. |

Stage transitions are validated; some moves are irreversible and all transitions are logged in `mkt_stage_history_list`.

---

## 3. Campaign Cycle Mental Model — Review vs Recovery vs Profile Repair

Each campaign category has its own outreach cycle. The AI surfaces and workspace pages are different — operators should understand which cycle applies to which campaign type.

Profile Repair is a **third vector** that reuses both existing pipelines via a track discriminator:
- **Track A (standard):** NAP drift, unclaimed profiles, missing categories → uses the **review pipeline** (Openers, Follow-Ups, Cascade tab).
- **Track B (escalated):** suspensions, hijacks, duplicates, ownership disputes → uses the **recovery pipeline** (Recovery tab, Day 1/2/4 cascade, evidence intake, AI appeal letter).
- **Triage:** every profile repair campaign starts with no track. The triage prompt recommends a track; the operator confirms or overrides. Track can be switched mid-flight with guardrails.

### Review Management Cycle

| Stage | Surface | What happens |
|-------|---------|--------------|
| **Opener** | Openers page (`/settings/admin/marketing-ops/openers`) | AI generates a first-touch email from the campaign's `business_analysis` audit. Picks one of 4 archetypes (A1 Review Gap, A2 Negative Recovery, A3 Listing Drift, A4 CTA Gap). Operator chooses soft or direct_paid close. |
| **Follow-Up** | Follow-Ups page (`/settings/admin/marketing-ops/follow-ups`) | AI generates a follow-up email if the prospect didn't reply. Auto-selects "doing" (footprint changed) or "telling" (footprint unchanged) branch based on a fresh data snapshot diff. Inherits the opener's archetype + close variant. |
| **Reply** | Campaign detail → Stage transition | Prospect replies → operator transitions the campaign forward (e.g., `shown` → `paid`). |
| **Cascade (optional)** | Campaign detail → Cascade tab | Opt-in email → SMS → DM escalation (Day 1/2/4) for silent prospects. Bypasses the manual follow-up workspace. |

**Both Openers and Follow-Ups pages are review-pipeline only.** Recovery campaigns and escalated profile repair campaigns are filtered out. Profile repair campaigns in triage or on the standard track ARE included (they use the review pipeline).

### Recovery Management Cycle

| Stage | Surface | What happens |
|-------|---------|--------------|
| **Audit** | Recovery tab → Recovery detail | Complaint identified on a review platform. Campaign created with category "Recovery Management". |
| **Framework** | Recovery detail | Response framework preview generated. |
| **Outreach Opener** | Automatic (scheduler) | Day 1 email sent with intake link. This is the recovery equivalent of the review pipeline's Opener — but it's auto-fired by `RecoveryCascadeService`, not the Openers workspace. |
| **Follow-Ups** | Automatic (scheduler) | Day 2 SMS pointer + Day 4 DM check-in. This is the recovery equivalent of the review pipeline's Follow-Ups — but it's auto-fired by the cascade, not the Follow-Ups workspace. |
| **Intake** | Public intake page (`/recovery/intake?token=...`) | Owner submits complaint statement + proposed resolution + attachments. |
| **Resolution Draft** | Recovery detail → AI Workspace | Recovery AI Agent drafts Response Draft + Submission Guide. Dual-mode: Copy-Paste Bridge (external AI) or Direct API (in-platform). |
| **Approve & Deliver** | Recovery detail → Actions | Operator approves → campaign transitions to `resolved_and_closed` → owner receives resolution via email (tracked + auto-retried if delivery fails). |

**Recovery campaigns do NOT use the Openers or Follow-Ups pages.** Their outreach cycle is the Day 1/2/4 cascade, auto-fired by the scheduler.

### Side-by-Side Comparison

| Concept | Review Management | Recovery Management | Profile Repair (Standard) | Profile Repair (Escalated) |
|---------|-------------------|---------------------|---------------------------|----------------------------|
| **Pipeline** | Review | Recovery | Review (Track A) | Recovery (Track B) |
| **Opener** | Openers workspace (A1-A4 archetype, soft/direct_paid close) | Day 1 cascade email (intake link) — automatic | Openers workspace (A3 Listing Drift archetype) | Day 1 cascade email (evidence intake link) — automatic |
| **Follow-Up** | Follow-Ups workspace (doing/telling branch, footprint diff) | Day 2 SMS + Day 4 DM — automatic | Follow-Ups workspace | Day 2 SMS + Day 4 DM — automatic |
| **AI surface** | Prompt Workspace (Copy-Paste Bridge + Direct API) | Recovery detail → AI Workspace (Copy-Paste Bridge + Direct API) | Prompt Workspace (seek + fulfill prompts) | Recovery detail → AI Workspace (appeal letter + submission guide) |
| **Close variants** | Soft vs Direct Paid | None (intake is free) | Soft vs Direct Paid | None (intake is free) |
| **Pitch assembly** | Header + Opener + Previews + Closer + Contact | None (single intake-request email) | Header + Opener + Previews + Closer + Contact | None (single evidence-request email) |
| **Campaign filter** | `pipeline = 'review'` | `pipeline = 'recovery'` | `pipeline = 'review'` | `pipeline = 'recovery'` |
| **Deliverables** | Review responses, GBP audit, NAP report, etc. | Recovery resolution (response + submission guide) | NAP report (preview), Citation & Profile Repair Package (paid) | Reinstatement Appeal (appeal letter + submission guide) |
| **Intake** | None | Dispute intake (token-gated, owner statement + proposed resolution) | None | Evidence intake (token-gated, owner narrative + evidence payload + attachments) |

---

## 4. Getting to Marketing Ops

1. Sign in as a platform admin.
2. Open **Admin Settings**.
3. Select **Marketing Ops** in the sidebar (Megaphone icon) or use the **Marketing Ops** settings card.
4. The dashboard loads at `/settings/admin/marketing-ops`.
5. For recovery campaigns, select **Recovery** under Marketing Ops in the sidebar, or click the **Recovery** tab on the dashboard. The recovery list is at `/settings/admin/marketing-ops/recovery`.

---

## 5. Dashboard — `/settings/admin/marketing-ops`

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
- **Widget grid:** Follow-ups Due, Hot Prospects, and Prospect Queue widgets — each shows a count + top entries + a link to the full list. The Prospect Queue widget (§33) shows the queued-prospect count and top 3 entries with a "Work the queue →" link.
- **Quick action cards:**
  - Campaign Tracker
  - New Campaign
  - Prompt Library
  - Scorecards

### Actions

- Click **Refresh** to reload data.
- Click **Export CSV** to download a CSV of campaigns.
- The dashboard auto-refreshes every 30 seconds.

### Dashboard Tabs

The dashboard has two tabs at the top:

- **Dashboard** — the default metric cards, pipeline overview, and quick actions described above.
- **Recovery** — links to the standalone Recovery list page at `/settings/admin/marketing-ops/recovery`. See §25 for details.

---

## 6. Campaigns — `/settings/admin/marketing-ops/campaigns`

`CampaignListClient.tsx` shows the full campaign list.

### List View

Columns include:

- Business name (click to open campaign detail)
- Category, Tone, City
- Stage badge
- Retainer (Fast / Medium / Slow)
- Attributes (e.g., High Ticket, Upscale, Friendly, Professional, Fast Retainers)
- Tenant link status (`Linked` / `Unlinked`)
- Estimated fee and amount paid
- Assigned operator

### Kanban View

- Toggle the **table / kanban** buttons in the top right.
- Each column represents a pipeline stage.
- Cards show business name, category, city, tone, retainer, attributes, assigned user, and estimated fee.

### Filtering and Search

- Search by business name, category, or city.
- Filter by stage, tone, retainer, and attribute.
- Click **New Campaign** to create a campaign.

---

## 7. New Campaign — `/settings/admin/marketing-ops/campaigns/new`

`CampaignFormClient.tsx` in create mode.

### What to Enter

The form is split into four cards:

#### Business Information

- **Campaign Category** (required) — select **Review Management** (default) or **Recovery Management**. This choice determines the campaign's stages, prompt templates, AI workflows, and deliverable types. The form shows an inline explainer below the selector with the specific stages, prompts, AI workflows, and deliverables for the selected category. See §3 for the full mental model.

  | Category | Stages | Prompts | AI Workflows | Deliverables |
  |----------|--------|---------|--------------|--------------|
  | **Review Management** | Seek → Preview Built → Shown → Paid → Delivered → Retainer → Tenant Onboarded | Seek, Fulfill, Filter, Retainer | Openers workspace (A1-A4 + close variant) → Follow-Ups workspace (doing/telling) → optional Cascade | Review responses, service menu, GBP audit, NAP report, SEO content, lead magnet |
  | **Recovery Management** | Audit Identified → Framework Preview → Outreach Dispatched → Awaiting Intake → Intake Submitted → Final Resolution Drafted → Resolved & Closed | Recovery Resolution | Recovery detail → AI Workspace (Copy-Paste Bridge + Direct API). Outreach = Day 1/2/4 cascade (automatic) | Recovery resolution (response draft + submission guide, emailed to owner) |
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

## 8. Prompts — `/settings/admin/marketing-ops/prompts`

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
  - Tone (if set)
- Click **Open Workspace** to run or edit the template in `PromptWorkspaceClient.tsx`.
- Click the pencil icon to edit or the trash icon to delete.

### Creating/Editing a Template

In the modal:

1. Enter a **Name**.
2. Choose a **Prompt Type** from the dropdown.
3. Select an optional **Category** from the dropdown, or choose `+ New category...` and enter a new one.
4. Select an optional **Tone** from the dropdown, or choose `+ New tone...` and enter a new one.
5. Write the **Prompt Body** using `{{variable_name}}` placeholders. `{{tone}}` and `{{attributes}}` are auto-filled from the selected campaign when run.
6. Check **Set as default for this type** if this should be the default.
7. Click **Save**.

### Running a Prompt

Each prompt can be run in either of two modes from the **Prompt Workspace** (open via **Open Workspace** on a template card):

- **Copy-Paste Bridge (external)** — the platform renders the final prompt text with variables injected. Click **Copy**, paste the text into any external AI (OpenAI, Claude, etc.), then paste the result back into the campaign notes or deliverable content.
- **Direct API (in-platform)** — select the target campaign and click **Execute Prompt**. The platform calls the configured AI provider, stores the result as a `marketing_prompt_executions` record, and can feed it directly into deliverables or campaign files.

Both modes are valid and share the same goal: producing the seek/fulfill/retainer output that drives prospecting, capturing, and conversion. Use Copy-Paste when you want manual control or the provider is outside the platform; use Direct API when you want tracked, in-platform execution tied to a campaign.

---

## 9. Scorecards — `/settings/admin/marketing-ops/scorecards`

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

## 10. Deliverable Templates — `/settings/admin/marketing-ops/deliverable-templates`

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

## 11. Branding — `/settings/admin/marketing-ops/branding`

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

## 12. Generating and Sending Deliverables

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

## 13. Tenant Prospecting and Conversion

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

## 14. Common Tasks

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

## 15. Field Reference

### Campaign Fields

| Field | Purpose |
|-------|---------|
| `campaign_category` | Campaign type: `review_management` (default) or `recovery_management` |
| `cascade_enabled` | Whether the multi-channel cascade is active for this campaign (review campaigns only) |
| `cascade_config` | Optional JSON config for custom cascade step timing/channels |
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

## 16. Troubleshooting

| Problem | Likely Cause | Fix |
|---------|--------------|-----|
| Marketing Ops not in sidebar | `navigation_links` table not seeded | Run the `128_marketing_ops.sql` seed or check the admin settings card. |
| Deliverable generation fails | Invalid JSON layout spec or missing active branding config | Check the template layout spec JSON and verify an active branding config exists. |
| Campaign stage won't change | Transition is not in `VALID_TRANSITIONS` | Review allowed stage moves in the campaign detail; some transitions are irreversible. |
| QR preview link 404s | Preview token expired | Generate a new preview token from the campaign deliverables tab. |
| Dashboard conversion widget missing | `tenant_prospecting_channel` migration not applied | Apply migration `129_tenant_prospecting_channel.sql`. |
| Recovery tab is empty | No campaigns with `campaign_category = 'recovery_management'` | Create a new campaign and select "Recovery Management" as the category. |
| Recovery campaign stuck in Awaiting Owner Intake | Intake token expired (7-day TTL) or cascade exhausted | Wait for the timeout sweep (token TTL + 4 days) or manually transition to `dead`. See `docs/RECOVERY_MANAGEMENT_RUNBOOK.md`. |
| Recovery AI agent output failed | Schema validation mismatch | Check `mkt_filter_flags_list` for the failed execution. Edit the intake statement and click **Regenerate Draft**. |
| Owner didn't receive resolution email | Email delivery failed or no email destination | Open the recovery detail page → check the **Delivery Status** panel. If `retrying`, the scheduler will auto-retry (max 3). If `failed`, click **Resend Email**. If "No email destination available", add an email to the campaign or intake first. |
| Cascade tab missing | Campaign is a recovery campaign | The cascade tab only appears on review campaigns. Recovery campaigns have their own outreach cascade. |
| Cascade step shows "SKIPPED" | Missing contact info for that channel AND no email fallback | Add the missing contact info (email, phone, or social_profiles) to the campaign. The cascade will not re-attempt this step. |
| Cascade step shows "FALLBACK" | Primary channel unavailable, fell back to email | This is expected behavior. Add phone or social profile info to enable the primary channel. |
| Cascade shows "BLOCKED" | No contact channels at all on the campaign | Add email, phone, or social profile info via the Business Contact card. The cascade will fire on the next scheduler pass. |
| Cascade not firing | Campaign not in `preview_built` or `shown` stage, or latest contact was a response | The cascade only fires for hot-prospect stages with no-response latest contacts. |

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
- **Checklist** — the campaign's playbook operator checklist: step-by-step execution with check-off progress (visible once a playbook is assigned via triage; see §32).
- **Stage History** — chronological transition log.
- **Cascade** — multi-channel cascade controls (see §17).

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

### Use Case: Recovery Management — Dispute Resolution

1. **Identify** — a business has an active complaint on Google Business Profile, BBB, or Yelp. Create a campaign with category "Recovery Management".
2. **Audit** — run an audit to identify the complaint details. Transition to `audit_identified`.
3. **Framework** — generate a response framework preview. Transition to `framework_preview_generated`.
4. **Outreach** — transition to `outreach_dispatched`. The platform auto-generates an intake link and starts the Day 1/2/4 outreach cascade.
5. **Intake** — the owner clicks the intake link, submits their complaint statement + proposed resolution + attachments. Campaign transitions to `intake_submitted`.
6. **Draft** — the Recovery AI Agent generates a Response Draft + Submission Guide. Campaign transitions to `final_resolution_drafted`.
7. **Review** — open the Recovery tab → click the campaign → review the draft. Edit if needed.
8. **Approve** — click **Approve & Deliver**. Campaign transitions to `resolved_and_closed`. Owner receives the resolution via email. The delivery is tracked — see **Delivery Status** below.

### Use Case: Multi-Channel Cascade — Re-engaging a Silent Prospect

1. **Identify** — a review campaign in `preview_built` or `shown` hasn't responded to the initial email.
2. **Check readiness** — verify the **Channel Readiness** widget shows "Cascade Ready" (email + phone/social). If "Partial" (email only), SMS/DM steps will fall back to email. If "Blocked", add contact info first.
3. **Enable** — open the campaign → **Cascade** tab → click **Enable Cascade**.
4. **Day 1** — the cascade fires the primary email (frame preview + grade impact + CTA).
5. **Day 2** — if unopened, the cascade fires an SMS pointer referencing the email. Falls back to email if no phone.
6. **Day 4** — if still unopened, the cascade fires a DM administrative check-in. Falls back to email if no social.
7. **Response** — if the prospect responds at any point, disable the cascade and continue manually.
8. **Exhaustion** — if all three steps fire with no response, consider transitioning to `lost`.

### Advice for Prompts

- Start with the **Copy-Paste Bridge** when testing a new AI provider or prompt wording; switch to **Direct API** once the template is stable and you want execution history.
- Use `{{variable_name}}` placeholders for anything that changes per campaign (business name, city, category).
- Set a **default template per prompt type** so the workspace pre-selects the right one.
- Keep prompts concise — long prompts cost more tokens and take longer to execute.
- For the `business_analysis` (seek) output shape, prefer the providers ranked in **§29 External Audit Calibration** when running external audits. Not all providers produce the same depth of verified platform data; the calibration table documents which providers reliably populate Google/Yelp/BBB metrics versus those that return null audits.

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

### Advice for Recovery Management

- **Create recovery campaigns** with category "Recovery Management" when a business has an active dispute on a review platform.
- **Review the intake carefully** before approving — the owner's statement and proposed resolution shape the AI-generated response.
- **Edit the draft** if the AI response doesn't match the owner's tone or the platform's requirements. The editable textareas let you refine before approving.
- **Use Regenerate** if the owner updates their intake statement after the initial draft was generated. The old draft is archived, not deleted.
- **Approve promptly** — the owner is waiting for the resolution. Once approved, the response is emailed automatically.
- **Monitor the Recovery tab** for campaigns stuck in `awaiting_owner_intake` — the cascade fires automatically, but if the owner doesn't respond, the campaign will time out to `dead`.

### Advice for the Multi-Channel Cascade

- **Ensure contact info is complete** before enabling the cascade. If `phone` or `social_profiles` are missing, those steps will be skipped.
- **Use the cascade for high-value prospects** who haven't responded to the initial email — the channel escalation (email → SMS → DM) increases touchpoints without manual effort.
- **Disable the cascade** once the prospect responds — the auto-follow-up scheduler will resume if the campaign is still a hot prospect.
- **Monitor the contact log** — if all three steps fire with no response, consider a manual follow-up or transition the campaign to `lost`.

### Known Gaps and Potential Frictions

> **Production readiness sprint plan:** `docs/RECOVERY_PRODUCTION_READINESS_SPRINT_PLAN.md` tracks the work to close the P0 gaps below before go-live.

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
- **Recovery resolution email delivery is tracked + auto-retried.** Failed deliveries retry up to 3 times (15min/30min/45min backoff). After 3 failures, the operator can manually resend via the **Resend Email** button on the recovery detail page. The approval still succeeds regardless of delivery outcome.
- **Cascade step content is template-based, not AI-generated.** The Day 1/2/4 messages use hardcoded templates per channel. AI-generated cascade content is a future enhancement.
- **Cascade custom config is API-only.** The UI enables the cascade with default settings. Custom step timing via `cascade_config` JSON requires an API call.
- **Cascade falls back to email when primary channel is unavailable.** If a step's primary channel (phone/social) is missing, the cascade fires on email instead. This is logged as `FALLBACK` in the outreach log.
- **Recovery E2E tests cover the UI flow.** The Playwright spec `recovery-ops.spec.ts` tests the recovery list, detail page, Channel Readiness widget, AI Workspace panel, navigation, and intake form.

---

## 24. Public Pay Page — `/marketing/pay`

`PayPageClient.tsx` is the public-facing payment page for Marketing Ops packages.

### How It Works

1. The prospect receives a pay link (via QR code, demo storefront, or direct URL) containing a `ptoken`.
2. The page resolves the token server-side to load campaign details, package price, and service category.
3. The prospect can optionally enter a **coupon code** — the page validates it server-side and shows the discounted total.
4. If the prospect is already authenticated (has a customer account), a **"Save this card"** checkbox appears (Phase 3, §6.3). When checked, the card is saved to their platform-scoped wallet for future one-click portal checkout.
5. The prospect enters payment details via Stripe Elements and clicks **Pay**.
6. The backend creates a Stripe PaymentIntent (with `setup_future_usage: 'off_session'` if save-card was opted in), confirms the payment, and transitions the campaign to `paid`.
7. On success, the page shows a confirmation with a **Download Receipt** button (PDF receipt generated server-side) and, for anonymous payers, a **"Create your free account"** CTA to claim the purchase (Path A, §34.2).
8. Deliverables are automatically upgraded from preview to paid (watermarks removed).
9. A receipt email is sent fire-and-forget (idempotent via `receipt_emailed_at`).

### Admin Setup

To enable payment collection on a campaign:
1. Set the **Package Price** on the campaign form (in cents, e.g., `49900` for $499).
2. Optionally set a **Service Category** (for coupon validation) and **Coupon Code**.
3. Optionally set a **Subscription Tier ID** for recurring billing after the one-time payment.
4. Share the pay link with the prospect via QR code, demo storefront, or direct URL.

---

## 25. Recovery Management — Dispute Resolution Pipeline

Recovery Management handles dispute resolution for local businesses that have received complaints on review platforms (Google Business Profile, BBB, Yelp, etc.). The engine drafts a professional response on behalf of the business owner, provides a submission guide, and delivers the approved resolution via email.

### Recovery List — `/settings/admin/marketing-ops/recovery`

`RecoveryTabClient.tsx` shows recovery campaigns grouped by stage. Accessible via:
- The **Recovery** link in the admin sidebar (under Marketing Ops)
- The **Recovery** link in the in-module nav panel
- The **Recovery** tab on the Marketing Ops dashboard (links to the standalone route)

- Campaigns are listed under their current stage badge (Awaiting Owner Intake, Intake Submitted, Final Resolution Drafted, etc.).
- Click a campaign to open the recovery detail view.
- Empty state shows a **New Campaign** CTA if no recovery campaigns exist.

### Recovery Detail — `/settings/admin/marketing-ops/recovery/[campaignId]`

`RecoveryDetailClient.tsx` is the recovery campaign workspace.

#### Layout

- **Left column — Owner Intake panel:**
  - Owner Statement (the complaint description from the business owner)
  - Proposed Resolution (what the owner wants)
  - Service Date, Status Flag, Submitted timestamp
  - Owner Email + Owner Phone (captured at intake submission)
- **Left column — Attachments panel:**
  - Lists files uploaded by the owner with the intake (screenshots, receipts, etc.)
- **Left column — Channel Readiness widget:**
  - Shows email/phone/social/website availability with green/gray badges
  - Cascade readiness indicator (Ready / Partial / Blocked)
  - Intake email status (captured vs. not yet submitted)
- **Right column — Resolution Draft panel:**
  - **Response Draft** — editable textarea with the AI-generated response
  - **Submission Guide** — editable textarea with step-by-step submission instructions
  - Click **Edit** to modify either section inline
  - Stage badge shows whether the draft is in `final_resolution_drafted` or `resolved_and_closed`
- **Right column — Delivery Status panel** (visible after approval):
  - Green "Delivered" badge with timestamp on success
  - Amber "Retrying" badge with attempts count + next retry time on transient failure
  - Red "Delivery Failed (Permanent)" badge with error details + **Resend Email** button after 3 failed attempts

#### Actions

- **Approve & Deliver** — transitions the campaign to `resolved_and_closed` and emails the approved resolution to the owner. The delivery destination priority is: intake email → campaign email → logged as failed if neither. Confirmation dialog before executing.
- **Regenerate Draft** — archives the current draft and re-runs the Recovery AI Agent. A new draft will be available within ~5 minutes (next scheduler pass). Confirmation dialog before executing.
- **Save Changes** (in edit mode) — saves inline edits to the Response Draft and Submission Guide sections.
- **Resend Email** (visible after failed delivery) — manually re-attempts delivery. Resets the retry counter and forces a new delivery attempt immediately.

#### Delivery Tracking + Retry

- Every delivery attempt is tracked in `mkt_outreach_log` with `delivery_status` (`pending`/`sent`/`failed`/`retrying`), `delivery_attempts`, `last_delivery_error`, and `retry_after`.
- The **delivery retry scheduler** runs every 15 minutes and automatically retries failed deliveries up to 3 times with exponential backoff (15min → 30min → 45min).
- After 3 failed attempts, the delivery is permanently `failed` and the operator can manually resend via the **Resend Email** button.
- The deliverable record is also marked with `delivery_status` + `delivered_at` timestamp.

#### Recovery AI Agent

- Uses the `recovery_resolution` prompt template (seeded by migration 150).
- Output schema: `deliverableText` (80–300 words) + `submissionGuide` (50–200 words).
- Output is validated against a Zod schema. Invalid output → filter flags created, operator can regenerate.

### Owner Intake Form (Public)

The intake form is a public page at `/recovery/intake?token=...`. The owner receives the link via the outreach cascade (Day 1 email).

- The owner enters their complaint statement, proposed resolution, service date, and optional status flag.
- **Owner email** (required) — the owner provides their email address. This is the primary delivery destination for the approved resolution.
- **Owner phone** (optional) — the owner provides their phone number for SMS follow-up.
- Attachments can be uploaded (images, PDFs, text files up to 10MB each).
- On submission, the Recovery AI Agent is automatically enqueued.
- If the link expires (7-day TTL), the owner sees an expired page with a **Request New Link** button.

### Outreach Cascade (Recovery)

Recovery campaigns in `awaiting_owner_intake` receive an automated outreach sequence:

| Day | Channel | Content | Fallback |
|-----|---------|---------|----------|
| 1   | email   | Frame preview + grade impact + CTA = intake link | None (email is primary) |
| 2   | phone (SMS) | Short SMS pointer to email | Falls back to email if no phone |
| 4   | social (DM) | Administrative check-in | Falls back to email if no social |

**Channel availability + fallback:** If a step's primary channel is unavailable (no phone for SMS, no social for DM), the cascade falls back to email. If email is also missing, the step is skipped. If the campaign has no contact channels at all, the cascade is blocked until contact info is added.

**Channel Readiness widget:** Both the campaign detail and recovery detail pages show a Channel Readiness widget with 4 badges (Email, Phone, Social, Website) and a cascade readiness indicator:
- **Green "Cascade Ready"** — email + at least one secondary channel
- **Amber "Partial"** — email only (SMS/DM steps will fall back to email)
- **Red "Blocked"** — no email (cascade cannot fire)

After Day 4 with no response, the cascade is exhausted. The intake timeout sweep transitions the campaign to `dead` 4 days after the intake token expires.

For the full recovery management technical reference, see `docs/RECOVERY_MANAGEMENT_RUNBOOK.md`.

---

## 26. Multi-Channel Cascade — Review Campaigns

The Multi-Channel Cascade is an opt-in automated outreach sequence for review campaigns. It escalates across channels (email → SMS → DM) based on time elapsed without a response.

### Cascade Tab — Campaign Detail

`CascadePanel.tsx` is rendered in the **Cascade** tab on any review campaign's detail page.

#### Cascade Flow

| Step | Day | Channel | Content |
|------|-----|---------|---------|
| 1    | 1   | Email   | Frame preview + grade impact + CTA |
| 2    | 2   | SMS     | Short reference to email + drop link |
| 3    | 4   | DM      | Administrative check-in |

#### Enabling the Cascade

1. Open a review campaign → click the **Cascade** tab.
2. Click **Enable Cascade**.
3. The cascade starts on the next scheduler pass (runs every 6 hours).
4. Steps fire automatically based on elapsed time since the previous step (or since `stage_entered_at` for step 1).

#### What You See

- **Flow diagram** — three cards showing Day 1 (Email), Day 2 (SMS), Day 4 (DM). Each card shows:
  - Green checkmark if the step was fired
  - Gray X if the step was skipped (missing contact info for that channel)
  - Empty if the step is pending
- **Progress summary** — steps fired / remaining / total
- **Contact log** — chronological list of cascade contacts with channel icon, timestamp, and notes
- **Active/Inactive badge** — shows whether the cascade is currently enabled

#### Channel Availability

The cascade checks contact info before firing each step:

- **Email** — requires `email` on the campaign
- **SMS** — requires `phone` on the campaign
- **DM** — requires at least one entry in `social_profiles`

If a channel's contact info is missing, that step is logged as **SKIPPED** (not fired) so it isn't re-evaluated every pass.

#### Disabling the Cascade

- Click **Disable Cascade** to stop the sequence.
- Previously fired contacts remain in the log.
- The `MarketingAutoFollowUpScheduler` automatically resumes handling the campaign if it's a hot prospect.

#### Custom Step Config (Optional)

When enabling the cascade, operators can pass a custom `cascade_config` JSON to override the default Day 1/2/4 timing:

```json
{
  "steps": [
    { "day": 1, "channel": "email", "label": "Custom Day 1" },
    { "day": 3, "channel": "phone", "label": "Custom Day 3 SMS" },
    { "day": 7, "channel": "social", "label": "Custom Day 7 DM" }
  ]
}
```

If no config is provided, the default Day 1/2/4 sequence is used.

#### Interaction with Auto-Follow-Up

When `cascade_enabled = true`, the `MarketingAutoFollowUpScheduler` skips the campaign — the cascade takes over follow-ups. Disabling the cascade returns the campaign to the auto-follow-up scheduler (if it's still a hot prospect).

---

## 28. Profile Repair — Triage-First Dual-Track Pipeline

Profile Repair is the third Marketing Ops service vector. It covers fixing unclaimed profiles, inconsistent NAP data, hijacked/duplicate listings, and suspended-profile reinstatements.

### Key Insight: Two Tracks, One Category

Profile repair is not one pipeline — it is two. The nature of the issue determines which existing campaign pattern it maps to:

- **Track A (standard):** Routine damage — NAP drift, unclaimed profile, missing categories, platform gaps. Uses the **review pipeline** (Seek → Preview → Shown → Paid → Delivered). Pitched as a package via the Openers workspace.
- **Track B (escalated):** Severe damage — suspensions, hijacked/duplicate listings, ownership disputes, address verification blocks. Uses the **recovery pipeline** (Audit Identified → … → Resolved & Closed). Evidence intake + AI-drafted appeal letter.

### Triage-First: The Track is a Decision, Not a Fork

1. **Create in triage.** Every profile repair campaign starts with `repair_track = NULL` in `seek`. Creation only requires the business identity + the raw audit signal.
2. **Audit analysis recommends a track.** The `profile_repair_triage` prompt runs against the audit payload and returns a severity score (1-10), recommended track, issue type, and rationale. Heuristic guardrails backstop the AI:
   - Any `suspension` / `hijacked_listing` / `duplicate_listing` / `ownership_dispute` signal → recommend `escalated`.
   - `nap_drift` / `unclaimed_profile` / `missing_category` / `platform_gap` only → recommend `standard`.
3. **Operator confirms or overrides.** The recommendation is advisory. The operator picks the track on the campaign detail page (Repair Track Panel).
4. **Switch later if the picture changes.** A NAP-drift case that turns out to be a hijacked listing escalates mid-flight; an apparent suspension that resolves to a simple unclaimed profile de-escalates.

### Track Switching — Guardrails

| Move | Allowed? | Notes |
|------|----------|-------|
| Triage/standard → escalated (before `paid`) | Yes | Escalate freely early |
| Standard → escalated (after `paid`) | **Blocked** | Refund first, then create a new linked campaign |
| Escalated → standard (before `intake_submitted`) | Yes | De-escalate only before evidence is collected |
| Escalated → standard (after `intake_submitted`) | **Blocked** | Evidence payload only makes sense on the recovery track |

**Side effects on switch:**
- Switching TO escalated while entering `outreach_dispatched` → auto-generates the intake link with `intake_kind = 'profile_repair'`.
- Switching AWAY from escalated during `awaiting_owner_intake` → voids the outstanding intake token (sets `expires_at = now()`).
- Every switch is logged in stage history with `trigger_type = 'track_switch'` and the mandatory reason.

### Campaign Form

When creating a profile repair campaign:
- **Category:** Profile Repair
- **Initial Issue Type:** Select the diagnosis from the dropdown (standard: nap_drift, unclaimed_profile, missing_category, missing_hours, platform_gap; escalated: suspension, duplicate_listing, hijacked_listing, ownership_dispute, address_verification_block). This is revisable.
- **No track selector on the create form.** Campaigns are created in triage; the track is confirmed on the detail page after analysis.

### Campaign Detail — Repair Track Panel

For profile repair campaigns, the detail page shows a **Repair Track Panel**:
- **Triage state** (no track set): amber banner — "Run the triage prompt to get an AI recommendation, then confirm a track."
- **Track confirmed:** green (standard) or red (escalated) banner showing the current track + issue type + decided-at + reason.
- **Switch Track button:** opens a dialog with mandatory reason + optional issue-type revision. Blocked moves are rejected with an explanation.

### Track A Walkthrough (Standard)

| Stage | What happens |
|-------|--------------|
| `seek` (triage) | Audit captured; triage prompt returns severity + recommended track; operator confirms `standard` |
| `preview_built` | Watermarked Listing Drift & Audit Report generated (`nap_report` deliverable) |
| `shown` | Opener sent (A3 Listing Drift archetype, soft or direct_paid close) via Openers workspace |
| `paid` | Owner pays via `/marketing/pay`; coupon validated against `profile_repair_package` |
| `delivered` | Full Citation & Profile Repair Package delivered (`citation_repair_package` deliverable) |
| `retainer_pitched` → … | Standard retainer / tenant-conversion flow, unchanged |

### Track B Walkthrough (Escalated)

| Stage | What happens |
|-------|--------------|
| `audit_identified` | Suspension/duplicate/hijack flagged; issue type recorded |
| `framework_preview_generated` | Reinstatement strategy preview drafted |
| `outreach_dispatched` | Intake link auto-generated (`intake_kind = 'profile_repair'`) |
| `awaiting_owner_intake` | Day 1 email → Day 2 SMS → Day 4 DM cascade (profile repair copy: frames profile issue + requests evidence) |
| `intake_submitted` | Owner submitted narrative + evidence payload + attachments; AI Agent enqueued |
| `final_resolution_drafted` | Appeal letter + submission guide drafted (`reinstatement_appeal` deliverable) |
| `owner_approved` | Operator approves (auto-transitions) |
| `resolved_and_closed` | Appeal package emailed to owner (tracked + auto-retried) |

### Evidence Intake (Track B)

The public intake page (`/recovery/intake`) renders a profile-repair-specific form variant when `intake_kind = 'profile_repair'`:
- **Owner narrative** (reuses `owner_statement`)
- **Issue type** selector (suspension, duplicate, hijack, ownership dispute, address verification block)
- **Google profile ID or URL** (for identifying the correct listing)
- **Suspension notice details** (date + quoted reason — for suspension appeals)
- **Duplicate/hijacked listing URL** (for duplicate/hijack appeals)
- **Evidence documents** (required — business license, utility bill, storefront photos; PDF/PNG/JPEG up to 10MB)

Issue-type-specific validation rejects missing evidence (e.g., suspension appeals require the notice details + Google profile ID; duplicate/hijack appeals require the duplicate URL + storefront photos).

### Service Categories + Coupons

Three new service category values for per-vector coupon validation:
- `profile_repair_audit` — for the preview/audit phase
- `profile_repair_package` — for the paid Track A package
- `profile_repair_appeal` — for Track B (if monetized as a paid package)

### Deliverable Types

| Type | Track | Phase | Description |
|------|-------|-------|-------------|
| `nap_report` | A | Preview | Watermarked NAP consistency report (existing) |
| `citation_repair_package` | A | Paid | Per-platform fix instructions, claim links, corrected NAP canonical record |
| `reinstatement_appeal` | B | Paid | Appeal letter + step-by-step Google Support submission guide |

### Prompt Templates

| Template | Type | Track | Purpose |
|----------|------|-------|---------|
| `profile_repair_triage` | seek | Both | Analyzes audit signals, recommends track + severity score |
| `profile_repair_nap_drift` | seek | A | NAP drift audit — inconsistent platforms, recommended fixes, opener angle |
| `profile_repair_unclaimed` | seek | A | Unclaimed profile audit — missed features, competitor gap, opener angle |
| `profile_repair_platform_gap` | seek | A | Platform gap audit — missing platforms, reach loss, opener angle |
| `citation_repair_package` | fulfill | A | Constructs the paid Citation & Profile Repair Package |
| `profile_repair_resolution` | recovery_resolution | B | Drafts reinstatement appeal letter + submission guide (issue-type-specific framing) |

---

## 29. External Audit Calibration — `business_analysis` Seek Prompt

This section documents the **onset calibration** of the `business_analysis` seek prompt across five external AI providers. The calibration was performed against a single target business (One Hour Heating & Air Conditioning, Plainfield, Indiana) and validates both **schema conformance** (the output parses against `businessAnalysisSchema`) and **semantic alignment** (the output actually contains verified external data across the standard audit scope: Google, Yelp, Facebook, BBB, website, NAP, alignment scoring, sources).

### Why calibration matters

The `business_analysis` schema is intentionally permissive about extra properties (`.passthrough()`) and coerces common agent synonyms (e.g. `"verified"` → `true` for boolean fields, `"verified"` → `"yes"` for `mobile_friendly`). This means a variant can **pass schema validation while containing no actual audit findings** — every field set to `null` / `unable_to_verify` with zero sources. Schema conformance is necessary but not sufficient. The calibration below ranks providers by **external data quality**: how much verified platform data they actually surfaced, source coverage, and analytical honesty about what could not be verified.

### Calibration method

1. Each provider received the same rendered `business_analysis` seek prompt for the same target business.
2. Each variant's raw JSON output was saved under `docs/LocalBiz/Audit Prompts/Local Business Digital Opportunity Audit - One Hour - <provider> - seek.md`.
3. The validator script `apps/api/scripts/validate-audit-variants.ts` parses each file and runs `businessAnalysisSchema.safeParse` to confirm structural conformance.
4. Semantic alignment was assessed against the standard scope defined in the base prompt template (`docs/LocalBiz/Audit Prompts/Local Business Digital Opportunity Audit - seek.md`): identity verification, per-platform review metrics (Google/Yelp/Facebook/BBB), combined review counts, website assessment, NAP consistency, alignment scoring with MI breakdown, negative review themes, digital opportunity score with component breakdown, recommended tier + fee, data quality block, and structured sources.

### Provider ranking by external data quality

| Rank | Provider | Schema | Google | Yelp | BBB customer rating + count | Website | NAP | Sources | Verdict |
|------|----------|--------|--------|------|------------------------------|---------|-----|---------|---------|
| 1 | **GPT** | PASS | 4.8 / 8076 | 2.0 / 84 | 4.76 / 50 | working, all 7 booleans verified | major_inconsistencies, 5 phone variations | 10 | Strongest raw verified data volume; full category set; complete website boolean verification. |
| 2 | **Claude** | PASS | 4.8 / null (documented conflict) | null (documented duplicates) | 4.77 / 52 | working, detailed template-error issues | major_inconsistencies, duplicate Yelp listing at different address | 7+ | Strongest analytical depth; honestly reported *why* Google review count couldn't be verified (aggregator conflicts 858–7700+, corporate fallback 192,609); found duplicate Yelp listing at a different street address. |
| 3 | **Kimi** | PASS | 4.8 / 8113 | 1.9 / 89 | **null / null** (gap) | working, all booleans "yes", empty issues | major_inconsistencies, phone variations only | 5 | Solid Google + Yelp data but missing BBB customer rating and review count; less thorough website issue documentation. |
| — | Perplexity | PASS | null | null | null / null | working, `mobile_friendly: likely` | minor_variations | 4 | Sparse verified data; Google/Yelp/BBB customer metrics all null; only 4 sources; NAP classified as minor rather than major despite phone variations. |
| — | Gemini | PASS | null | null | null / null | unable_to_verify (all) | unable_to_verify (empty) | 0 | Null audit — no research performed ("No external web browsing or live data fetching performed"). Structurally valid but semantically empty; `BALANCED_HEALTHY` is a default fallback, not a verified assessment. |

### Schema fixes applied during calibration

Several variants emitted values outside the documented enums. Rather than reject the audits, the schema was extended with tolerant coercion (matching the existing `coercedBooleanNullableTolerant` pattern) so that semantically-correct audits are not blocked by synonym drift:

- `website.mobile_friendly` — added `mobileFriendlyCoerced` preprocessor: `"verified"`/`"present"`/`"confirmed"` → `"yes"`, `"not_verified"`/`"absent"` → `"no"`, `"unverified"`/`"unknown"`/`"n/a"` → `"unable_to_verify"`. The prompt suffix was strengthened to explicitly state `mobile_friendly` must be `"yes"` (not `"verified"`).
- Variant files were also corrected where the agent emitted non-enum values that could not be coerced: Perplexity `"likely_good"` → `"likely"`; Claude `"working"` (https) → `"verified"`, `"conflicting_third_party_data"` / `"duplicate_listings_observed"` / `"partially_verified"` (data_status) → `"partial"`; GPT `"verified"` (mobile_friendly) → `"yes"`; Gemini all-null `matched_business` object → `null`.

### Recommended provider selection

For production `business_analysis` seek audits via the **Copy-Paste Bridge** or **Direct API**:

1. **Primary: GPT** — highest verified data yield. Use when you need maximum platform metric coverage (Google review count, full category set, complete website boolean verification) and the most sources for traceability.
2. **Secondary: Claude** — highest analytical rigor. Use when data conflicts are expected (duplicate listings, aggregator discrepancies) and you need the audit to document *why* a field could not be verified rather than silently returning null. Claude is the only variant that surfaced the duplicate Yelp listing at a different street address and the Cincinnati booking-link misroute.
3. **Tertiary: Kimi** — acceptable fallback. Use only when GPT and Claude are unavailable; expect a missing BBB customer rating/review count and thinner website issue documentation.

**Avoid Gemini for seek audits** — it performed no external research and returned a null audit. **Use Perplexity with caution** — it confirmed identity and BBB accreditation but could not verify Google, Yelp, or BBB customer review metrics, yielding a thinner audit.

### Re-running the calibration

```bash
cd apps/api
doppler run --config local -- npx tsx scripts/validate-audit-variants.ts
```

This script discovers all `Local Business Digital Opportunity Audit - One Hour - <provider> - seek.md` files, parses each as JSON, and validates against `businessAnalysisSchema`. Add new provider variants by dropping a new file into `docs/LocalBiz/Audit Prompts/` following the same naming convention and adding the provider name to `variantAgents` in the script.

---

## 30. References

- `docs/LocalBiz/local_marketing_ops_gap_analysis_and_optimized_plan.md`
- `docs/LocalBiz/local_marketing_ops_sprint_plan_v3.md`
- `docs/LocalBiz/tenant_prospecting_channel_sprint_plan.md`
- `docs/LocalBiz/local_marketing_ops_payment_collection_sprint_plan.md`
- `docs/LocalBiz/MARKETING_OPS_USER_GUIDE_GAP_CLOSE_SPRINT.md`
- `docs/RECOVERY_MANAGEMENT_ENGINE_SPRINT_PLAN.md`
- `docs/RECOVERY_MANAGEMENT_RUNBOOK.md`
- `docs/LocalBiz/PROFILE_REPAIR_INTEGRATION_SPEC.md`
- `docs/LocalBiz/PROFILE_REPAIR_RUNBOOK.md`
- `docs/LocalBiz/Audit Prompts/Local Business Digital Opportunity Audit - seek.md` (base prompt template — standard scope)
- `docs/LocalBiz/Audit Prompts/Local Business Digital Opportunity Audit - One Hour - gpt - seek.md` (calibration variant — rank 1)
- `docs/LocalBiz/Audit Prompts/Local Business Digital Opportunity Audit - One Hour - claude - seek.md` (calibration variant — rank 2)
- `docs/LocalBiz/Audit Prompts/Local Business Digital Opportunity Audit - One Hour - kimi - seek.md` (calibration variant — rank 3)
- `docs/LocalBiz/Audit Prompts/Local Business Digital Opportunity Audit - One Hour - perplexity - seek.md` (calibration variant — not ranked)
- `docs/LocalBiz/Audit Prompts/Local Business Digital Opportunity Audit - One Hour - gemini - seek.md` (calibration variant — not ranked)
- `apps/api/scripts/validate-audit-variants.ts` (calibration validator)
- `apps/api/src/validators/business-analysis.schema.ts` (single source of truth for `business_analysis` output shape)
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/MarketingOpsDashboardClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/RecoveryTabClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/recovery/[campaignId]/RecoveryDetailClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/filter-review/FilterReviewClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/PromptLibraryClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/[id]/PromptWorkspaceClient.tsx`
- `apps/web/src/app/marketing/pay/PayPageClient.tsx`
- `apps/web/src/app/recovery/intake/IntakePageClient.tsx`
- `apps/web/src/services/MarketingOpsService.ts`
- `apps/web/src/services/RecoveryOpsService.ts`
- `apps/web/src/components/marketing-ops/StageBadge.tsx`
- `apps/web/src/components/marketing-ops/CascadePanel.tsx`
- `apps/web/src/components/marketing-ops/RepairTrackPanel.tsx`
- `apps/api/src/services/MarketingCampaignService.ts`
- `apps/api/src/services/RecoveryResolutionService.ts`
- `apps/api/src/services/RecoveryCascadeService.ts`
- `apps/api/src/services/ReviewCascadeService.ts`
- `apps/api/src/services/DisputeIntakeService.ts`
- `apps/api/src/routes/marketing-ops-public.ts`
- `apps/api/src/routes/recovery-intake-public.ts`
- `apps/api/src/services/subscription/SubscriptionBillingService.ts`
- `docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md`
- `docs/LocalBiz/marketing_ops_triage_admin_runbook.md`
- `apps/api/src/services/triage/TriageEngineService.ts`
- `apps/api/src/services/triage/signal-extractor.ts`
- `apps/api/src/services/triage/signal-taxonomy.ts`
- `apps/api/src/services/CampaignTriageService.ts`
- `apps/api/src/services/MarketingPlaybookCatalogService.ts`
- `apps/api/src/services/MarketingSignalRegistryService.ts`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/playbooks/PlaybookCatalogClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/playbooks/RuleBuilder.tsx`
- `apps/web/src/components/marketing-ops/IntelligentTriageCard.tsx`
- `apps/web/src/components/marketing-ops/SignalEnrichmentPanel.tsx`

---

## 31. Intelligent Playbook Catalog & Triage Engine

**Pages:** `/settings/admin/marketing-ops/playbooks` (admin config) · Campaign detail triage card (operator workflow)

The Intelligent Triage Engine automatically matches business campaigns to the best outreach playbook based on signals detected in the audit data. This replaces manual category selection with a data-driven, rules-based recommendation that the operator reviews, enriches, and accepts or overrides.

### How It Works

```
Business Analysis Audit (AI scan)
  → detected_signals[] (24 known signal codes across 5 families)
  → Signal Extractor (emits SignalCode[] from audit + campaign fields)
  → Triage Engine (generic DSL evaluator: any/all/none/dual clauses)
  → Playbook Catalog (6 seeded playbooks, ordered by priority_rank)
  → Recommended Playbook (code, archetype, FITD offer, retainer pitch)
  → Operator decision: Accept / Override / Enrich signals
  → Opener generation (archetype-specific prompt → LLM → quality gate)
```

### Campaign Categories

The triage engine can assign one of three campaign categories:

| Category | When | Archetypes |
|----------|------|------------|
| **Review Management** | Default — unanswered reviews, review drought | A1 (gap), A2 (negative theme) |
| **Recovery Management** | Crisis — BBB grade suppression, unanswered complaints | A2 (crisis recovery) |
| **Triage Management** | Dual-signal footprint — repair + review signals combined | A5 (dual triage) |

### Signal Families

Signals are grouped into 5 families, each color-coded in the UI:

| Code | Family | Color | Examples |
|------|--------|-------|----------|
| RA | Reputation & Administrative | Red | `RA_REVIEW_DROUGHT`, `RA_UNANSWERED_GAP`, `RA_BBB_GRADE_SUPPRESSION` |
| DS | Digital Surface & Profile | Orange | `DS_GBP_UNCLAIMED`, `DS_GBP_INACTIVE_POSTS` |
| WC | Website & Conversion | Blue | `WC_NO_CTA`, `WC_DEAD_URL`, `WC_URL_MISMATCH` |
| CP | Cross-Platform & NAP | Purple | `CP_NAP_DRIFT_NAME`, `CP_NAP_DRIFT_ADDRESS` |
| VP | Content & Visual Proof | Teal | `VP_NO_RECENT_PHOTOS`, `VP_LOW_PHOTO_COUNT` |

### Operator Workflow (Campaign Detail — Seek Stage)

When a campaign is in the `seek` stage, the **Intelligent Triage** card appears above the tabs on the campaign detail page. This is a prerequisite gate — the triage decision should be made before moving to `preview_built`.

1. **Evaluate** — Click the Evaluate button to run the signal extractor + triage engine. The card displays:
   - Recommended playbook (code, name, category, archetype)
   - **Rule Confidence** (signal match strength, NOT ML probability)
   - Triggered signals (color-coded family badges)
   - Plain-language rationale
   - FITD offer + retainer fee preview

2. **BBB Pre-Flight (optional)** — If BBB data is needed for the crisis playbook (PB-04), expand the BBB pre-flight inputs and enter the BBB grade (A–F or NR) and unanswered complaint count. This is manual — the platform does not auto-ingest BBB data.

3. **Signal Enrichment (optional)** — If the AI scan missed signals or flagged false positives:
   - Click **Enrich signals**
   - Use the dropdown picker to add known signals (sourced from the signal registry — no free-text)
   - Click X on any signal to remove it (false positive correction)
   - Click **Re-run triage** to re-evaluate with the enriched set

4. **Accept** — Re-categorizes the campaign to the playbook's category and applies the FITD fee. The opener generation will use the triage-derived archetype (including A5, which the deterministic selector never produces).

5. **Override** — If the operator disagrees with the recommendation, they can select a different playbook from the dropdown. An optional reason can be provided.

### Playbook Catalog Admin (`/settings/admin/marketing-ops/playbooks`)

The Playbook Catalog page has two tabs:

#### Playbooks Tab

- **Table view:** code, name, category badge, archetype, FITD fee, retainer fee, active status, priority rank
- **Reorder:** up/down arrows swap priority ranks. The triage engine evaluates in ascending order (lowest rank = highest priority). First match wins.
- **Edit/Create modal:** all playbook fields + the **Rule Builder**

#### Rule Builder

Structured visual editor for the matching rules DSL — no raw JSON required:

- **ANY (trigger):** Match if at least ONE signal is present
- **ALL (required):** Match only if ALL signals are present
- **NONE (guard):** Block match if ANY signal is present (crisis guard)
- **DUAL (cross-family):** Match if ≥1 from groupA AND ≥1 from groupB (e.g. repair + review)
- **Confidence slider:** 0–100% (labeled "Rule Confidence / Signal Match Strength")
- **Plain-language preview:** "Matches when ANY of … is present AND NONE of … is present"
- **Raw JSON toggle:** Advanced escape hatch with round-trip validation

#### Signals Tab

- **Table view:** code badge, family, label, detection source, active toggle
- **Register Signal modal:** code (FAMILY_UPPER_SNAKE), family, label, description, detection source
- **Warning:** `derived` signals need extractor code in `signal-extractor.ts` to fire automatically. Registering here makes the code available in the Rule Builder, but it won't be auto-detected until the extractor is updated.

### Seeded Playbook Cascade (Default)

| Rank | Code | Name | Archetype | Category | Key Rule |
|------|------|------|-----------|----------|----------|
| 1 | PB-04 | Crisis Reputation Recovery | A2 | recovery_management | ANY: BBB crisis signals |
| 2 | PB-01 | Review Response Gap | A1 | review_management | ANY: RA_UNANSWERED_GAP |
| 3 | PB-02 | Negative Review Recovery | A2 | review_management | ANY: RA_NEGATIVE_THEME_CLUSTER |
| 4 | PB-05 | Dual-Signal Footprint Triage | A5 | triage_management | DUAL: repair + review |
| 5 | PB-06 | Listing Inconsistency Repair | A3 | recovery_management | ANY: CP_NAP_DRIFT_* |
| 99 | PB-03 | Review Response Gap (Fallback) | A1 | review_management | ANY: RA_UNANSWERED_GAP (catch-all) |

### Opener Generation (Triage-Accepted Archetype)

When the triage recommendation is accepted, the opener generation service uses the triage-derived archetype instead of the deterministic `selectArchetype` function. This is the only way the A5 (Dual-Signal Triage) archetype reaches the opener prompt — `selectArchetype` never returns A5.

The A5 opener combines repair-signal context (NAP drift, dead URL) with review-gap context (drought, unaddressed count) without stacking stats. The hook leads with the combined footprint as a single observation, with only ONE number appearing (either day count OR unaddressed count, never both).

### Key Distinction: Profile Repair Triage vs Intelligent Triage

The profile repair pipeline (§28) has its own triage system for choosing between `standard` and `escalated` repair tracks. The Intelligent Triage Engine (§31) is a separate system that matches campaigns to outreach playbooks. They coexist:

- **Profile Repair Triage** (§28): Decides repair track severity (standard vs escalated) for `profile_repair` campaigns.
- **Intelligent Triage** (§31): Decides outreach playbook (PB-01 through PB-06) for `seek`-stage campaigns across all categories.

### See Also

- `docs/LocalBiz/marketing_ops_triage_admin_runbook.md` — detailed admin runbook with troubleshooting
- `docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md` — full sprint plan and architecture
- §32 — Operator Playbook Checklists (step-by-step execution per playbook)

---

## 32. Operator Playbook Checklists

**Pages:** `/settings/admin/marketing-ops/playbooks` → **Operator Checklist** tab (builder) · Campaign detail → **Checklist** tab (execution)

Playbooks define *what* to do for a campaign; checklists define *how to execute it, step by step*. Each playbook can carry an ordered operator checklist — some playbooks require systematic execution where a missed step (an unchecked listing, an unsent message) silently degrades the outcome. The checklist makes the playbook's operations explicit, and each campaign checks steps off as it progresses.

### Step Types

Steps are heterogeneous — a checklist can mix any of these:

| Type | What the operator does | Optional inline action |
|------|------------------------|------------------------|
| **Manual** | Follow the written instructions and check the box | — |
| **URL Check** | Verify something on a live site (GBP listing, website CTA, directory profile) | **Open site** button |
| **AI Prompt** | Run a specific prompt template for the campaign | **Run prompt** — jumps to the Prompts tab with the template preselected |
| **Deliverable** | Create/send a deliverable of a given type | **Open deliverables** — jumps to the Deliverables tab |
| **Outreach** | Send a message on a given channel and log it | **Log outreach** — jumps to the outreach logger |
| **Credentials** | Retrieve credentials needed for the task | Shows a **reference label** (e.g. "1Password › LocalBiz › GBP vault") with a copy button. The checklist stores *where the credentials live*, never the credentials themselves |

Inline actions are conveniences, not requirements — every step can be completed by hand and checked off.

### Building a Checklist (Playbooks Page → Operator Checklist Tab)

1. Select a playbook from the dropdown. Its **operations overview** appears: code, name, category, archetype, FITD offer, retainer pitch, and description — full playbook context without leaving the tab.
2. Add steps with **Add Step**: title (short imperative, e.g. "Verify GBP listing is claimed"), instructions (what to check, what "done" looks like), step type, type-specific config, and whether the step is **required**.
3. Reorder steps with the up/down arrows (same pattern as playbook priority ranking).
4. Deactivate steps rather than deleting them once campaigns have checked them off — deletion is blocked when progress exists, to preserve the audit trail.

### Executing a Checklist (Campaign Detail → Checklist Tab)

When a campaign has an effective playbook — triage **accepted** or **overridden** (§31) — the **Checklist** tab appears with that playbook's steps:

- **Header:** playbook chip (code, name, category), an "Overridden from PB-XX" indicator when the operator overrode the recommendation, and a progress bar (`x / y steps`, with a required-steps sub-count). The tab badge shows remaining required steps.
- **Steps:** checkbox, order number, type badge, title, expandable instructions, and the inline action button for the step type. Checking a step records who completed it and when; an optional note captures evidence (a link, a result summary). Unchecking reopens the step while keeping the audit trail.
- **Empty states:** no triage decision yet → "run Intelligent Triage above to assign a playbook"; playbook has no steps → deep-link to the builder tab to define them.

### Soft Gate on Stage Transitions

Advancing a campaign's stage with **incomplete required steps** triggers a warning dialog listing the missing steps:

- **Go to Checklist** — jump to the Checklist tab and finish the work.
- **Continue anyway** — proceed with the transition; the acknowledgment is recorded in the stage history.

The gate never hard-blocks. Optional steps never trigger it, and campaigns without an effective playbook (or whose playbook has no required steps) are unaffected.

### Suggesting Improvements (Operator Feedback Loop)

Checklists are governed, but not rigid. Operators executing checklist-aware campaigns are the ones who discover efficiencies in the field — a verification step that's missing, a better URL to check, a step that's redundant. The suggestion loop turns those discoveries into playbook improvements:

**From a campaign (suggest):**

1. On any step in the Checklist tab, click **Suggest improvement** and choose:
   - **Add a step** — tagged *before this step*, *after this step*, or *instead of this step (supersede)*. Fill in the proposed title, instructions, type, and config.
   - **Change this step** — edit a pre-filled copy of the step; only your changes are submitted.
   - **Remove this step** — explain why it's unnecessary.
   - Or use **Suggest a step** at the bottom of the list for a general addition at the end of the playbook.
2. **Rationale is required** — "What did you discover?" A suggestion without the *why* can't be reviewed.
3. Submit. Your suggestion appears in the tab with a **pending** status chip, so you know it's in the queue.

**On the playbook's Operator Checklist tab (review):**

- A **review queue** panel (with a pending-count badge) lists suggestions for the selected playbook. Each card shows the proposal, the anchor step it's tagged against ("after step 3"), your rationale, and a link to the campaign where you discovered it. Modification suggestions render as a field-by-field diff against the step's current values.
- An **admin accepts** (optionally amending the proposal first — tightening a title, fixing a URL) or **rejects** with a reason.
  - *Accept — add*: the step is inserted at the tagged position.
  - *Accept — supersede*: the new step takes the old step's place; the old step is deactivated, never deleted, so campaign history stays intact.
  - *Accept — change/remove*: the patch is applied / the step is deactivated.
  - If the step changed since the suggestion was submitted, the reviewer is warned to re-review rather than applying blindly.

**Closing the loop:** you see the outcome on your suggestion — **accepted** (and every future campaign on that playbook inherits your improvement) or **rejected** with the reviewer's reason, which helps calibrate future suggestions.

Operators can't edit playbook templates directly from a campaign — suggestions are the write path. This keeps every playbook improvement reviewed while making the operator's field experience the primary driver of playbook quality.

### Relationship to the Triage Engine

The checklist **follows the triage decision**: whichever playbook is effective for the campaign (recommended-and-accepted, or overridden) supplies the checklist. Overriding to a different playbook swaps the checklist; progress on the previous playbook's steps is retained for audit and restored if the operator overrides back.

### See Also

- `docs/LocalBiz/marketing_ops_operator_checklist_sprint_plan.md` — full sprint plan: data model, API, UI, soft-gate mechanics, testing
- §31 — Intelligent Playbook Catalog & Triage Engine (how campaigns get their playbook)

---

## 33. Prospect Queue — `/settings/admin/marketing-ops/queue`

**Page:** `/settings/admin/marketing-ops/queue` · Nav: **Queue** (📥, directly after Dashboard) · Dashboard widget: **Prospect Queue (n)**

The Prospect Queue is the operator's "start of day" surface for capturing and triaging prospects *before* committing to a campaign. Every audit surface (City Category Analysis, Category Analysis, Sync Report) has an **Add to Queue** button next to the existing **Campaign** (spawn) button. Queueing captures the prospect with a full snapshot — no navigation, no campaign created — so the operator can keep working the audit and decide later.

### Add to Queue vs. Spawn — when to use which

| Action | When | What happens |
|--------|------|--------------|
| **Campaign** (spawn) | You're ready to act *now* — the prospect is hot, you have time to run the seek prompt and build a preview today | A business-scope campaign is created immediately, triaged, and enters the pipeline at `seek` |
| **Queue** | You see an opportunity but can't act on it right now — you're working through a batch of audits, the prospect is one of several, or you want to review the full set before committing | The prospect is saved to the queue with its audit snapshot (signals, rating, address, source). No campaign is created. You triage it later from the queue page |

**Rule of thumb:** act now → **Campaign**; act later → **Queue**.

### The Queue Page

The page has two view modes, toggled in the header. The toggle persists in `localStorage`, so you land on your preferred view each day.

#### List View (default)

A dense table — one row per queued prospect. Columns:

| Column | Content |
|--------|---------|
| **Business** | Name (bold) + city/state; flame icon if the snapshot implies hot |
| **Signals** | Signal-count badge + first 2 signal codes (crisis signals render red); tooltip for the rest |
| **Rating** | ★ rating · review_count |
| **Source** | Source kind (Category Analysis / City Category Audit / Scan Unmatched) with a link to the parent campaign |
| **Queued** | Relative time ("yesterday", "3d ago") + who queued it |
| **Priority** | `high` / `normal` toggle (Flag icon) — click to flip |
| **Assigned** | Operator display name or "Unassigned" with inline assign-to-me / unassign |
| **Note** | Inline pencil edit — "call after Tuesday", "asked for by name" |
| **Actions** | **Create Campaign** (primary, violet) · **Dismiss** (ghost, opens reason dropdown) |

**Header controls:**
- **Status tabs:** Queued (n) · Created · Dismissed. Default is Queued.
- **Assigned to me** toggle (default on for Queued) — shows your claimed prospects + anything unclaimed. Flip off to see the whole team queue.
- **Category / city filters** — same pattern as the campaign list.

**Create from queue:** spinner → the row flips in-place to a "View campaign →" link. No forced navigation — you stay on the queue and keep working.

**Dismiss:** opens a reason dropdown (`already_customer` / `bad_fit` / `duplicate` / `other`). Dismissed entries leave the default view but remain in the Dismissed tab for audit trail. A dismissed business can be re-queued later (new row).

#### Board View — the queue as a mini kanban

The same data, rendered as columns. The board answers: *"what happened to every prospect I've queued?"* — from capture through conversion, at a glance.

**Pipeline toggle (Review / Recovery):** the board renders one pipeline at a time, mirroring the two cycles in §3. Review is default.

**Module-aware columns** — column sets are not hard-coded; they come from the same transition maps the backend uses (`transitionsFor(category, repair_track)`):

| Board mode | Columns |
|-----------|---------|
| **Review pipeline** | Queued → Seek → Preview Built → Shown → Paid → Delivered → Retainer Pitched → Retainer Won → Tenant Onboarded → (Lost / Dead collapsed) |
| **Recovery pipeline** | Queued → Audit Identified → Framework Preview → Outreach Dispatched → Awaiting Owner Intake → Intake Submitted → Final Resolution Drafted → Owner Approved → Resolved & Closed → (Dead collapsed) |

A campaign's pipeline is determined by its category + repair track — `recovery_management` or `profile_repair` + `escalated` → Recovery; everything else → Review. If a profile-repair campaign switches tracks mid-flight, its card simply appears in the other board mode on next fetch.

**The Queued column is always first** — same `status='queued'` entries as the List view, with the same **Create Campaign** / **Dismiss** actions.

**Cards are audit-aware** — everything you need to decide *before* hitting Create Campaign is on the card, captured from the source audit at queue time:

| Field | Rendering |
|-------|-----------|
| **Business** | Name (bold) + city/state; flame if hot |
| **Priority** | Flag toggle (red when `high`) — adjustable in place |
| **Assignee** | Display name chip or "Unassigned" with assign-to-me / unassign |
| **Audit date** | Date chip ("audit: Jul 28"); amber tint when > 14 days stale — the finding may have drifted |
| **Category** | Text badge |
| **Scope** | Small badge (`category` / `city`) — the audit's blast radius |
| **Signals** | Up to 3 signal-code chips (crisis = red) + overflow tooltip + count badge |
| **Rating / reviews** | ★ rating · review_count |
| **Queued** | Relative time + who captured it (distinct from the assignee) |
| **Note** | Inline pencil preview |
| **Days in stage** | Chip on campaign cards — amber after 7 days, red after 14 (staleness is the kanban's main signal) |

**Click-to-advance (v1):** each campaign card has an **Advance** overflow menu listing only the valid next stages for its current pipeline. Selecting one calls the existing `POST /:id/transition` endpoint:

- **Success** → card moves columns.
- **`checklist_incomplete` (409)** → the soft-gate dialog (§32) lists incomplete required steps with **Proceed anyway**.
- **Invalid transition** → toast; the card snaps back. Only possible if the stage maps drifted or the campaign changed mid-session — the backend is authoritative.

`lost` / `dead` / `closed` / `resolved_and_closed` columns are collapsed behind a **Show closed** toggle to keep the board narrow.

**What the board does not do (v1):** no drag-and-drop (click-to-advance only), no WIP limits, no swimlanes — priority flag + staleness chips carry the signal. The board is not a global pipeline board — only queue-sourced campaigns appear.

### Nav Badge + Dashboard Widget

- **Nav:** the Queue item shows a live count badge (number of `status='queued'` entries) so the queue is unmissable at the start of day.
- **Dashboard:** the Prospect Queue widget shows the count + top 3 queued entries (name, signal badge, relative time) with a "Work the queue →" link.

### Queue Entries Are Pre-Campaign

Queue entries are not campaigns and do not appear in pipeline metrics. They are a capture + triage layer *before* the pipeline. Once you hit **Create Campaign** from a queue entry, the resulting campaign enters the pipeline normally and the entry is marked `campaign_created` (with a link to the campaign). The entry is retained for the audit trail — it's how you trace "where did this campaign come from?"

### See Also

- `docs/LocalBiz/marketing_ops_prospect_queue_sprint_plan.md` — full sprint plan: data model, API, UI, board mechanics, testing
- §3 — Campaign Cycle Mental Model (Review vs Recovery vs Profile Repair)
- §19 — Stage Transitions and Rules (the transition tables the board columns mirror)
- §32 — Operator Playbook Checklists (the soft gate that board stage advances go through)

---

## 34. Customer Portal — `/account/marketing`

The customer portal is the authenticated self-service surface for business owners who have paid for Marketing Ops campaigns. It extends the existing customer architecture (same JWT, same `CustomerApiSingleton` base) — no parallel auth system.

**Spec:** `docs/LocalBiz/MARKETING_OPS_CUSTOMER_PORTAL_SPEC.md`

### 34.1 Who sees the portal

The portal is **signal-gated** (§4.2). A customer sees the "My Services" nav group only when they have `platform` context — meaning at least one campaign is claimed (linked to their customer account). Storefront-only shoppers never see it; both-context customers see both "Shopping" and "My Services" groups.

Server-side enforcement: every `/api/customer/marketing/*` route returns `403 context_required` for customers without platform context. The gate is not just hidden nav — it's enforced on every request.

### 34.2 Account creation paths (Phase 1)

Three paths link a payment to a customer account:

| Path | Trigger | Flow |
|------|---------|------|
| **A (at payment)** | Pay page success screen | "Create your free account" → register/login → `claimViaPayRegister` / `claimViaPayLogin` → all eligible campaigns linked |
| **B (email awareness)** | Customer visits `/marketing/claim` | Enters email → receives claim link → `/marketing/claim/[token]` → register/login → all past campaigns with that email linked |
| **C (registration sweep)** | Customer registers/verifies email independently | `registrationClaimSweep` runs fire-and-forget at email verification → links any matching campaigns |

All three paths call `MarketingCustomerService.claimAllEligible` — one action links **all** eligible campaigns for the email, not just one.

### 34.3 Portal overview — `/account/marketing`

The landing page shows:
- **Summary cards:** total spent, active engagements, deliverables ready
- **Campaigns list:** customer-safe projection (no internal stages, pain scores, or notes)
- **Recent purchases:** latest payment history entries

### 34.4 Campaign detail — `/account/marketing/campaigns/[id]`

Shows:
- Business name, service category, city, order reference
- **Customer-facing status** (not internal stage): "Payment received" → "We're working on it" → "Delivered" → "Active service plan"
- **Progress timeline** with dates
- **Deliverables** (paid only — preview/watermarked versions never shown)
- **Receipts** with PDF download links
- **"Purchase again / Upgrade" button** (Phase 3) — links to portal checkout when a follow-on package price is set

### 34.5 Receipts — `/account/marketing/receipts/[revenueId]`

- Full HTML receipt view with line items, discount, total, payment date
- **QR code** on every receipt — scans to the customer's asset URL (carries their uploaded logo when provided)
- PDF download with the same QR embedded
- Billing address block rendered when snapshotted at checkout or set as default billing

### 34.6 Branding settings — `/account/marketing/settings`

Customers can personalize their receipts:
- **Logo upload** (≤2MB, PNG/JPG/SVG) — composited onto the QR code
- **Asset URL** — the destination the QR scans to (validated: http/https only, no platform-internal hosts)
- **Brand color** — applied to receipt accents (with contrast fallback)
- **Live QR preview** — updates instantly as settings change

When no branding is set, receipts fall back to platform branding.

### 34.7 Support tickets — `/account/marketing/support`

Customers file support tickets against the platform (not a tenant):
- **Create ticket** with title, description, category, and optional campaign link ("Which service is this about?")
- **Thread view** at `/account/marketing/support/[ticketId]` — customer replies reopen waiting tickets
- Internal notes (`is_internal`) are stripped at the service layer, never visible to customers
- Tickets land in the **existing operator personal CRM hub** (platform-scope aggregation already built)

### 34.8 Alerts — `/account/marketing/alerts`

Platform alerts from the operator:
- **Targeted** (one customer) or **broadcast** (all platform-context customers)
- Unread badge on the sidebar "Notifications" link (refreshes every 60s)
- Mark read / dismiss individually, or mark all read
- Storefront-only customers see neither the badge nor the alerts page

### 34.9 Saved cards + repeat purchase (Phase 3)

**Saving a card at payment time (§6.3):**
- On the pay page (`/marketing/pay`), authenticated customers see a **"Save this card"** checkbox
- When checked, the PaymentIntent is created with `setup_future_usage: 'off_session'`
- After successful payment, the card is attached to the customer's platform-scoped Stripe customer
- Saved cards are manageable in `/account/payment-methods` (filtered to platform scope)

**Portal checkout — `/account/marketing/campaigns/[id]/checkout`:**
- Accessible from the campaign detail "Purchase again / Upgrade" button
- **Saved card selection** — default card preselected for one-click off-session charge
- **Coupon application** — applicable wallet coupons listed with one-click apply + discount preview; ad-hoc code entry also supported
- **SCA fallback** — if a saved card requires authentication (Stripe `authentication_required`), the page falls back to interactive Stripe Elements checkout
- **Order summary** with discount + total before confirming
- On success: campaign marked paid, receipt emailed, wallet coupon flipped to `redeemed`

**Coupon parity (§7.5):**
- Platform coupons saved to the existing wallet (`/account/coupons`) under "VisibleShelf services" group
- Save-by-code accepts platform coupon codes (from operator campaigns, receipt emails, retainer pitches)
- Applicable coupons surfaced at portal checkout with one-click apply
- Wallet row flips to `redeemed` on successful checkout; savings shown on the receipt

### 34.10 Address wallet — `/account/addresses`

Addresses are customer-global (no tenant scoping). Platform-only customers use the same address book as storefront customers — typically one entry: their business billing address. The portal checkout offers wallet addresses for the billing address field, prefilled from the default billing address.

### 34.11 Operator touchpoints

Operators interact with the customer portal indirectly:
- **Payment Link panel** (§8.1) — shows pay link + QR + status (viewed/paid)
- **Send claim invite** (§8.2) — emails a claim link to a paid, unclaimed campaign's email
- **Personal CRM hub** — platform-scope support tickets already aggregate here
- **Alert composer** (§8.3) — send targeted or broadcast alerts to platform-context customers
- **Campaign detail** — shows support ticket chip when `campaign_id`-linked tickets exist

### 34.12 See Also

- `docs/LocalBiz/MARKETING_OPS_CUSTOMER_PORTAL_SPEC.md` — full functional spec
- §24 — Public Pay Page (the pre-account payment surface)
- `AGENTS.md` — "Marketing Ops Customer Portal" sections (Phase 1, 2, 3) for implementation details
