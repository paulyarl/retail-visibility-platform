/**
 * Deliverable Construction — Prompt Templates
 *
 * Owner-voice-extended prompts for:
 *   - buildDeliverableReviewResponsePrompt — per-review owner response draft
 *   - buildOwnerVoiceInferencePrompt        — infer voice from existing responses
 *   - buildRecoveryPlaybookPrompt           — theme-clustered response templates
 *   - buildListingCorrectionsPrompt         — NAP corrections per platform
 *   - buildCtaFixesPrompt                   — website CTA recommendations
 *   - buildMobileCatalogPrompt              — mobile product-category website mockup (A6)
 *   - buildGbpPhotoOptimizationPrompt       — GBP photo optimization plan (A6)
 *   - buildAvailabilityInquiryFlowPrompt    — availability-inquiry flow design (A6)
 *   - buildFulfillmentPathwayPrompt         — pickup/delivery pathway setup (A6)
 *   - buildHoursSyncPlanPrompt              — hours + holiday-hours sync plan (A6)
 *
 * All prompts inject the owner voice profile + business context block so
 * outputs sound like the owner, not a marketing bot.
 *
 * See: docs/LocalBiz/marketing_ops_deliverable_construction_sprint_plan.md §5
 *      docs/LocalBiz/marketing_ops_universal_recalibration_sprint_plan.md §5.5
 */

// ─── Owner Voice Inference ───────────────────────────────────────────────

const VOICE_INFERENCE_PROMPT = `You are analyzing a small business owner's existing review responses to infer their writing voice.

Existing owner responses (from Google Business Profile, Yelp, etc.):
{{owner_responses}}

Task: Analyze these responses and infer the owner's voice profile. Return JSON only:

{
  "person": "first_person" | "third_person" | "we",
  "formality": "casual" | "professional" | "formal",
  "humor": "none" | "light" | "witty",
  "apology_style": "direct_apology" | "fix_first" | "acknowledge_and_pivot",
  "signoff_style": "first_name" | "full_name" | "title" | "team" | "none",
  "signature": "the actual signoff text they use (e.g., '- Sarah, Owner') or null if none"
}

Guidelines:
- person: "I" = first_person, "The team at X" = third_person, "We" = we
- formality: contractions + casual phrasing = casual; polished but natural = professional; stiff/corporate = formal
- humor: none = no humor detected; light = occasional warmth; witty = deliberate humor
- apology_style: "I'm sorry" leading = direct_apology; "Here's what we fixed" leading = fix_first; "Thanks for letting us know — and here's the fix" = acknowledge_and_pivot
- signoff_style: how they close responses
- signature: the exact text, or null

Output the JSON object only — no preamble, no explanation.`;

// ─── Deliverable Review Response (owner-voice-extended) ──────────────────

const DELIVERABLE_REVIEW_RESPONSE_PROMPT = `You are drafting an owner response to a customer review for {{business_name}}.
Write in the owner's voice — not as a marketing bot. The response should sound
like the owner personally sat down and typed it.

Owner voice profile:
- Person: {{voice_person}}
- Formality: {{voice_formality}}
- Humor: {{voice_humor}}
- Apology style: {{voice_apology_style}}
- Signoff: {{voice_signoff_style}} — {{voice_signature}}

Business context:
- Category: {{business_category}}
- Location: {{business_city}}, {{business_state}}
- Phone: {{business_phone}}
- Website: {{business_website}}

Campaign tone: {{campaign_tone}}

Customer review ({{review_platform}}, {{review_rating}} stars, {{review_date}}):
{{review_text}}

Task: Write the owner response, ≤80 words, in the owner's voice.
- Acknowledge the specific complaint (not a generic "sorry you had a bad experience")
- Name the concrete fix or what changed
- End with an invitation to return or contact directly
- Use the owner's signoff style and signature
- No exclamation points, no emojis, no pricing, no marketing language

Output the response only — no preamble, no explanation.`;

// ─── Recovery Playbook ───────────────────────────────────────────────────

const RECOVERY_PLAYBOOK_PROMPT = `You are writing a recovery playbook for {{business_name}}, a {{business_category}} in {{business_city}}, {{business_state}}.

The playbook gives the owner ready-to-use response templates for each recurring
negative theme in their reviews. These are templates the owner can adapt — not
auto-responses. They should sound like the owner wrote them.

Owner voice profile:
- Person: {{voice_person}}
- Formality: {{voice_formality}}
- Humor: {{voice_humor}}
- Apology style: {{voice_apology_style}}
- Signoff: {{voice_signoff_style}} — {{voice_signature}}

Negative review themes (from audit):
{{theme_clusters}}

For each theme, provide:

## [Theme name in plain language]
**What usually went wrong:** [1 sentence]
**Response template:**
[Fill-in-the-blank template in owner's voice, ≤80 words, with [bracketed] placeholders for specifics]
**Escalation trigger:** [When to take the conversation offline vs. respond publicly]
**Follow-up cadence:** [When to check back — e.g., "Check GBP for replies 48h after posting"]

Output as structured text with clear section breaks between themes.`;

// ─── Listing Corrections ─────────────────────────────────────────────────

const LISTING_CORRECTIONS_PROMPT = `You are preparing listing correction recommendations for {{business_name}}, a {{business_category}} in {{business_city}}, {{business_state}}.

NAP consistency audit found these variations across platforms:
{{nap_variations}}

Canonical (correct) data:
- Name: {{canonical_name}}
- Phone: {{canonical_phone}}
- Address: {{canonical_address}}

Platforms with listings:
{{platforms_list}}

Task: For each platform, list the current (incorrect) data vs. the corrected
data, and provide step-by-step correction instructions the owner can follow.

Format per platform:

## [Platform Name]
**Current:** [what's wrong — e.g., "Phone number shows (555) 123-4567"]
**Corrected:** [what it should be]
**How to fix:** [1-3 step instructions — e.g., "1. Log into GBP → Info → Phone → Update → Publish"]

Output as structured text with clear section breaks.`;

// ─── CTA/Website Fixes ───────────────────────────────────────────────────

const CTA_FIXES_PROMPT = `You are preparing website CTA recommendations for {{business_name}}, a {{business_category}} in {{business_city}}, {{business_state}}.

Website: {{website_url}}

Missing CTAs identified in audit:
{{missing_ctas}}

Conversion opportunities:
{{conversion_opportunities}}

Task: For the highest-impact missing CTA, provide:

## [CTA Name — e.g., "Online Booking Button"]
**Why it matters:** [1-2 sentences on what visitors currently can't do]
**Recommended placement:** [Where on the site — e.g., "Top-right of homepage, above the fold"]
**What it looks like:** [Description of the button/form — e.g., "Blue 'Book Now' button that opens a calendar widget"]
**Implementation path:** [1-3 steps — e.g., "1. Add Calendly embed on homepage 2. Style button to match site 3. Test on mobile"]

Keep it concrete and actionable — the owner should know exactly what to do or
what to ask their web person to do.

Output as structured text.`;

// ─── Builders ────────────────────────────────────────────────────────────

export function buildVoiceInferencePrompt(ownerResponses: string): string {
  return VOICE_INFERENCE_PROMPT.replace('{{owner_responses}}', ownerResponses);
}

export interface OwnerVoiceFields {
  person: string | null;
  formality: string | null;
  humor: string | null;
  apologyStyle: string | null;
  signoffStyle: string | null;
  signature: string | null;
}

export interface BusinessContextFields {
  businessName: string;
  businessCategory: string;
  city: string | null;
  state: string | null;
  phone: string | null;
  websiteUrl: string | null;
  campaignTone: string;
}

export function buildDeliverableReviewResponsePrompt(
  voice: OwnerVoiceFields,
  ctx: BusinessContextFields,
  review: { platform: string; rating: number | null; date: string | null; text: string },
): string {
  return DELIVERABLE_REVIEW_RESPONSE_PROMPT
    .replace('{{business_name}}', ctx.businessName)
    .replace('{{voice_person}}', voice.person ?? 'first_person')
    .replace('{{voice_formality}}', voice.formality ?? 'casual')
    .replace('{{voice_humor}}', voice.humor ?? 'none')
    .replace('{{voice_apology_style}}', voice.apologyStyle ?? 'fix_first')
    .replace('{{voice_signoff_style}}', voice.signoffStyle ?? 'first_name')
    .replace('{{voice_signature}}', voice.signature ?? '')
    .replace('{{business_category}}', ctx.businessCategory)
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{business_phone}}', ctx.phone ?? 'N/A')
    .replace('{{business_website}}', ctx.websiteUrl ?? 'N/A')
    .replace('{{campaign_tone}}', ctx.campaignTone)
    .replace('{{review_platform}}', review.platform)
    .replace('{{review_rating}}', String(review.rating ?? 'N/A'))
    .replace('{{review_date}}', review.date ?? 'N/A')
    .replace('{{review_text}}', review.text);
}

export function buildRecoveryPlaybookPrompt(
  voice: OwnerVoiceFields,
  ctx: BusinessContextFields,
  themeClusters: string,
): string {
  return RECOVERY_PLAYBOOK_PROMPT
    .replace('{{business_name}}', ctx.businessName)
    .replace('{{business_category}}', ctx.businessCategory)
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{voice_person}}', voice.person ?? 'first_person')
    .replace('{{voice_formality}}', voice.formality ?? 'casual')
    .replace('{{voice_humor}}', voice.humor ?? 'none')
    .replace('{{voice_apology_style}}', voice.apologyStyle ?? 'fix_first')
    .replace('{{voice_signoff_style}}', voice.signoffStyle ?? 'first_name')
    .replace('{{voice_signature}}', voice.signature ?? '')
    .replace('{{theme_clusters}}', themeClusters);
}

export function buildListingCorrectionsPrompt(
  ctx: BusinessContextFields,
  napVariations: string,
  canonicalName: string,
  canonicalPhone: string,
  canonicalAddress: string,
  platformsList: string,
): string {
  return LISTING_CORRECTIONS_PROMPT
    .replace('{{business_name}}', ctx.businessName)
    .replace('{{business_category}}', ctx.businessCategory)
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{nap_variations}}', napVariations)
    .replace('{{canonical_name}}', canonicalName)
    .replace('{{canonical_phone}}', canonicalPhone)
    .replace('{{canonical_address}}', canonicalAddress)
    .replace('{{platforms_list}}', platformsList);
}

export function buildCtaFixesPrompt(
  ctx: BusinessContextFields,
  missingCtas: string,
  conversionOpportunities: string,
): string {
  return CTA_FIXES_PROMPT
    .replace('{{business_name}}', ctx.businessName)
    .replace('{{business_category}}', ctx.businessCategory)
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{website_url}}', ctx.websiteUrl ?? 'N/A')
    .replace('{{missing_ctas}}', missingCtas)
    .replace('{{conversion_opportunities}}', conversionOpportunities);
}

// ─── Mobile Catalog Preview (A6 — Product Visibility) ────────────────────

const MOBILE_CATALOG_PROMPT = `You are preparing a mobile product-category website mockup for {{business_name}}, a {{business_category}} in {{business_city}}, {{business_state}}.

This business currently has no way for customers to browse products online before visiting. The goal is a lightweight, mobile-first catalog structure that shows what products are carried — not a full e-commerce store.

Known product categories (from GBP or audit):
{{product_categories}}

Task: Design a mobile catalog mockup with:

## Recommended Category Structure
[List 5-8 top-level product categories based on the business type and known categories. Each category should be a tap-able tile on mobile.]

## Page Layout (Mobile-First)
[Describe the homepage layout: hero image, category tiles, search bar placement, click-to-call/WhatsApp/SMS action button position. Keep it simple — one screen, no scroll required for the main navigation.]

## Sample Product Category Page
[Pick one category and describe what its page looks like: product grid, item cards (photo + name + price range), back-to-categories button, inquiry CTA.]

## Action Placements
[Where to place click-to-call, WhatsApp, and SMS buttons so customers can check availability without leaving the page. Recommend the single highest-priority action for this business type.]

Keep it concrete — the owner should be able to hand this to a web person and say "build this."

Output as structured text.`;

// ─── GBP Photo Optimization (A6 — Product Visibility) ────────────────────

const GBP_PHOTO_OPTIMIZATION_PROMPT = `You are preparing a Google Business Profile photo optimization plan for {{business_name}}, a {{business_category}} in {{business_city}}, {{business_state}}.

Current GBP photo audit:
- Total photos: {{photo_count}}
- Photo types present: {{photo_types_present}}
- Photo types missing: {{photo_types_missing}}

Task: Create a photo optimization plan with:

## Shot List
[List the photos to add, prioritized by impact. For each: type (storefront exterior, interior, product close-up, team, signage), 1-line description, and why it matters for this business type. Aim for 8-12 shots total.]

## Captions
[Write Google-optimized captions for each shot — keyword-rich, location-aware, ≤100 characters. Example: "Fresh produce aisle at Indy African Market, Indianapolis — weekly restocks from local farms"]

## Upload Priority Order
[Rank the shots 1-N by which to upload first. Top priority = the photo that most closes the "can't see the store" gap.]

## GBP Attributes to Enable
[Recommend relevant GBP attributes for this business type — e.g., "Women-led", "Identifies as Black-owned", "Small business", "In-store shopping", "Curbside pickup". Only suggest attributes the business can legitimately claim.]

Keep it actionable — the owner should be able to take the photos with a phone and upload them.

Output as structured text.`;

// ─── Availability Inquiry Flow (A6 — Product Visibility) ─────────────────

const AVAILABILITY_INQUIRY_FLOW_PROMPT = `You are designing an availability-inquiry flow for {{business_name}}, a {{business_category}} in {{business_city}}, {{business_state}}.

Current contact methods:
{{contact_methods}}

The problem: customers have no way to check if a specific product is in stock before visiting. They either show up and hope, or don't show up at all.

Task: Design an availability-inquiry flow with:

## Recommended Inquiry Channel
[Pick the single best channel for this business — click-to-call, WhatsApp, SMS, or web form. Justify based on the business type, owner's likely phone habits, and customer demographics. For African grocery stores, WhatsApp or click-to-call is usually best.]

## Flow Design
[Step-by-step customer journey: customer wants to know if X is in stock → [action] → [owner response] → [outcome]. Keep it to 3-4 steps max.]

## Response Templates
[2-3 ready-to-use templates the owner can copy-paste:
- "Yes, we have it" template
- "No, but we can order it" template
- "No, but [alternative product] is in stock" template
Each ≤50 words, in a warm but efficient tone.]

## Staffing Considerations
[Who handles inquiries, how often to check the channel, expected response time. Be realistic — this is a small business owner, not a dedicated support team.]

Keep it simple enough that the owner can start today with a phone.

Output as structured text.`;

// ─── Fulfillment Pathway (A6 — Product Visibility) ───────────────────────

const FULFILLMENT_PATHWAY_PROMPT = `You are preparing a pickup/delivery pathway setup plan for {{business_name}}, a {{business_category}} in {{business_city}}, {{business_state}}.

Current fulfillment status:
{{fulfillment_status}}

Task: Create a fulfillment setup plan with:

## Recommended Fulfillment Options
[Rank in-store pickup, curbside pickup, and local delivery by feasibility for this business type. For a small grocery store, in-store pickup is usually step 1; curbside is step 2; local delivery is optional step 3. Justify each recommendation.]

## Platform Setup Steps
[For the top-recommended option, provide step-by-step setup instructions:
- What to enable on GBP (e.g., "Curbside pickup" attribute)
- What to add to the website (if any) — a simple "Order for pickup" form or phone-based ordering
- Payment handling — cash on pickup vs. Stripe link vs. phone payment
Keep it to 5-7 steps total.]

## Order Flow SOP
[Standard operating procedure for the owner when an order comes in:
1. Receive order (channel)
2. Confirm availability
3. Pick/pack
4. Notify customer (ready for pickup)
5. Handoff (in-store or curbside)
6. Payment collection
Keep it as a simple checklist the owner can tape to the counter.]

Keep it realistic for a one-person or small-team operation.

Output as structured text.`;

// ─── Hours Sync Plan (A6 — Product Visibility) ───────────────────────────

const HOURS_SYNC_PLAN_PROMPT = `You are preparing an hours + holiday-hours synchronization plan for {{business_name}}, a {{business_category}} in {{business_city}}, {{business_state}}.

Current hours status:
- GBP regular hours: {{regular_hours_status}}
- Special/holiday hours present: {{special_hours_status}}
- Business type: {{business_type}}

Task: Create an hours sync plan with:

## Regular Hours Update
[Recommend the canonical weekly hours for this business type. If the audit didn't capture them, provide a template the owner can fill in. Flag any common mistakes — e.g., "Don't list 'Open 9-9' if you close at 8:30 for cleanup; list 8:30 so customers don't arrive at 8:55 expecting full service."]

## Holiday Hours Calendar (Next 12 Months)
[List the holidays that matter for this business type and location. For ethnic markets (African, Asian, Latino grocery stores), include both US federal holidays AND culturally relevant holidays. For each:
- Holiday name + date
- Recommended hours (open/closed/reduced)
- When to update GBP (1 week before)

Example for an African grocery store:
- New Year's Day (Jan 1) — Closed
- MLK Day (Jan 15) — Normal hours
- Easter Sunday — Reduced 10-4
- Eid al-Fitr (date varies) — Closed or reduced
- Juneteenth (Jun 19) — Normal hours
- Independence Day (Jul 4) — Reduced 10-6
- Labor Day — Closed
- Thanksgiving — Closed
- Christmas Eve — Reduced 10-4
- Christmas Day — Closed
- Kwanzaa (Dec 26-Jan 1) — Normal hours with festive signage]

## Directory Sync Checklist
[List every platform/directory where hours should be synchronized:
- Google Business Profile
- Website (if any)
- Yelp (if listed)
- Facebook (if listed)
- Apple Maps (if claimed)
- Bing Places (if claimed)
For each, note how to update hours and how often to verify.]

Keep it practical — the owner should be able to work through this in one sitting.

Output as structured text.`;

// ─── A6 Prompt Builders ──────────────────────────────────────────────────

export function buildMobileCatalogPrompt(
  ctx: BusinessContextFields,
  productCategories: string,
): string {
  return MOBILE_CATALOG_PROMPT
    .replace('{{business_name}}', ctx.businessName)
    .replace('{{business_category}}', ctx.businessCategory)
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{product_categories}}', productCategories || 'Not specified — infer from business category (e.g., for a grocery store: Produce, Grains & Rice, Spices & Seasonings, Sauces & Condiments, Frozen Foods, Beverages, Household Goods)');
}

export function buildGbpPhotoOptimizationPrompt(
  ctx: BusinessContextFields,
  photoCount: number | string,
  photoTypesPresent: string,
  photoTypesMissing: string,
): string {
  return GBP_PHOTO_OPTIMIZATION_PROMPT
    .replace('{{business_name}}', ctx.businessName)
    .replace('{{business_category}}', ctx.businessCategory)
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{photo_count}}', String(photoCount ?? 'Unknown'))
    .replace('{{photo_types_present}}', photoTypesPresent || 'None detected')
    .replace('{{photo_types_missing}}', photoTypesMissing || 'All types needed');
}

export function buildAvailabilityInquiryFlowPrompt(
  ctx: BusinessContextFields,
  contactMethods: string,
): string {
  return AVAILABILITY_INQUIRY_FLOW_PROMPT
    .replace('{{business_name}}', ctx.businessName)
    .replace('{{business_category}}', ctx.businessCategory)
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{contact_methods}}', contactMethods || 'Phone only (click-to-call from GBP)');
}

export function buildFulfillmentPathwayPrompt(
  ctx: BusinessContextFields,
  fulfillmentStatus: string,
): string {
  return FULFILLMENT_PATHWAY_PROMPT
    .replace('{{business_name}}', ctx.businessName)
    .replace('{{business_category}}', ctx.businessCategory)
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{fulfillment_status}}', fulfillmentStatus || 'No pickup or delivery options currently offered');
}

export function buildHoursSyncPlanPrompt(
  ctx: BusinessContextFields,
  regularHoursStatus: string,
  specialHoursStatus: string,
  businessType: string,
): string {
  return HOURS_SYNC_PLAN_PROMPT
    .replace('{{business_name}}', ctx.businessName)
    .replace('{{business_category}}', ctx.businessCategory)
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{regular_hours_status}}', regularHoursStatus || 'Not assessed')
    .replace('{{special_hours_status}}', specialHoursStatus || 'Not present on GBP')
    .replace('{{business_type}}', businessType || 'Unknown');
}
