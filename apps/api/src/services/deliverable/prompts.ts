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

export const VOICE_INFERENCE_PROMPT = `You are analyzing a small business owner's existing review responses to infer their writing voice.

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

export const DELIVERABLE_REVIEW_RESPONSE_PROMPT = `You are drafting an owner response to a customer review for {{business_name}}.
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
- Origin: {{business_origin}}
- Location: {{business_city}}, {{business_state}}
- Phone: {{business_phone}}
- Website: {{business_website}}

Campaign tone: {{campaign_tone}}

Delivery lane (who posts this response):
{{delivery_mode}}
When that is blank the lane is not settled — write the response as finished
copy the owner can post either way.

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

export const RECOVERY_PLAYBOOK_PROMPT = `You are writing a recovery playbook for {{business_name}}, a {{business_category}} (origin: {{business_origin}}) in {{business_city}}, {{business_state}}.

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

export const LISTING_CORRECTIONS_PROMPT = `You are preparing listing correction recommendations for {{business_name}}, a {{business_category}} (origin: {{business_origin}}) in {{business_city}}, {{business_state}}.

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

export const CTA_FIXES_PROMPT = `You are preparing website CTA recommendations for {{business_name}}, a {{business_category}} (origin: {{business_origin}}) in {{business_city}}, {{business_state}}.

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
  businessOrigin: string | null;
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
    .replace('{{business_origin}}', ctx.businessOrigin ?? 'unspecified')
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
    .replace('{{business_origin}}', ctx.businessOrigin ?? 'unspecified')
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
    .replace('{{business_origin}}', ctx.businessOrigin ?? 'unspecified')
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
    .replace('{{business_origin}}', ctx.businessOrigin ?? 'unspecified')
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{website_url}}', ctx.websiteUrl ?? 'N/A')
    .replace('{{missing_ctas}}', missingCtas)
    .replace('{{conversion_opportunities}}', conversionOpportunities);
}

// ─── Mobile Catalog Preview (A6 — Product Visibility) ────────────────────

export const MOBILE_CATALOG_PROMPT = `You are preparing a mobile shelf-visibility mockup for {{business_name}}, a {{business_category}} (origin: {{business_origin}}) in {{business_city}}, {{business_state}}.

This business's storefront is indexed but its inventory is not — customers have no way to see what's on the physical shelves before visiting. The goal is a lightweight, mobile-first shelf catalog that shows what products are carried — not a full e-commerce store and never a shipping operation. Shoppers browse on their phone, then walk in and buy at the counter.

Known product categories (from GBP or audit):
{{product_categories}}

Task: Design a mobile catalog mockup with:

## First Five Shelf Slots
[Structure the free-claim entry point: the first five product slots should be the high-velocity signature items and specialty products customers already call to verify — the items that make this shop worth the trip. Use observed products from the audit when available; name categories the business plausibly carries when not, but NEVER invent specific inventory or brands that weren't observed.]

## Recommended Category Structure
[List 5-8 top-level product categories based on the business type and known categories. Each category should be a tap-able tile on mobile.]

## Page Layout (Mobile-First)
[Describe the homepage layout: hero image, category tiles, search bar placement, click-to-call/WhatsApp/SMS action button position, and a visible "pick up at our counter" cue. Keep it simple — one screen, no scroll required for the main navigation.]

## Sample Product Category Page
[Pick one category and describe what its page looks like: product grid, item cards (photo + name + price range), back-to-categories button, availability-inquiry CTA.]

## Action Placements
[Where to place click-to-call, WhatsApp, and SMS buttons so customers can check availability without leaving the page, plus the counter-pickup cue. Recommend the single highest-priority action for this business type.]

Keep it concrete — the owner should be able to hand this to a web person and say "build this."

Output as structured text.`;

// ─── GBP Photo Optimization (A6 — Product Visibility) ────────────────────

export const GBP_PHOTO_OPTIMIZATION_PROMPT = `You are preparing a Google Business Profile photo optimization plan for {{business_name}}, a {{business_category}} (origin: {{business_origin}}) in {{business_city}}, {{business_state}}.

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

export const AVAILABILITY_INQUIRY_FLOW_PROMPT = `You are designing an availability-inquiry flow for {{business_name}}, a {{business_category}} (origin: {{business_origin}}) in {{business_city}}, {{business_state}}.

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

export const FULFILLMENT_PATHWAY_PROMPT = `You are preparing a counter-fulfillment pathway setup plan for {{business_name}}, a {{business_category}} (origin: {{business_origin}}) in {{business_city}}, {{business_state}}.

Current fulfillment status:
{{fulfillment_status}}

The strategic frame: the physical store counter IS the fulfillment center. The store already owns the shelves, the stock, the staff, and the pickup point — walk-in traffic and counter pickup convert online visibility into sales with zero delivery logistics and zero marketplace commission. Delivery marketplaces take roughly a quarter to a third of basket value; counter pickup keeps all of it. Delivery is an optional later step, never the foundation.

Task: Create a fulfillment setup plan with:

## Recommended Fulfillment Options
[Rank counter pickup first for this business type — it is the zero-logistics path that uses the store the owner already runs. Curbside pickup is an optional step 2 for businesses whose customers expect it. Local delivery is optional step 3 at most — flag the commission cost of marketplace apps if it comes up. Justify each recommendation.]

## Why the Counter Wins
[Explain in 3-4 sentences why the physical counter beats delivery logistics for this business: no driver coordination, no packaging overhead, no marketplace commission, and the customer who walks in to pick up often leaves with more than they ordered. Only claim the impulse-item/basket expansion benefit if the business type supports it — a grocery or specialty market yes, a single-item shop maybe not.]

## Platform Setup Steps
[For the top-recommended option, provide step-by-step setup instructions:
- What to enable on GBP (e.g., "In-store pickup" / "Curbside pickup" attributes)
- What to add to the shelf catalog — a simple "Reserve for counter pickup" or phone-based ordering path
- Payment handling — cash or card at the counter vs. Stripe link vs. phone payment
Keep it to 5-7 steps total.]

## Order Flow SOP
[Standard operating procedure for the owner when an order or reservation comes in:
1. Receive order (channel)
2. Confirm availability on the shelf
3. Set aside / pick
4. Notify customer (ready at the counter)
5. Handoff at the counter
6. Payment collection at the register
Keep it as a simple checklist the owner can tape to the counter.]

Keep it realistic for a one-person or small-team operation — the whole point is that the store already does this every day.

Output as structured text.`;

// ─── Hours Sync Plan (A6 — Product Visibility) ───────────────────────────

export const HOURS_SYNC_PLAN_PROMPT = `You are preparing an hours + holiday-hours synchronization plan for {{business_name}}, a {{business_category}} (origin: {{business_origin}}) in {{business_city}}, {{business_state}}.

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
    .replace('{{business_origin}}', ctx.businessOrigin ?? 'unspecified')
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
    .replace('{{business_origin}}', ctx.businessOrigin ?? 'unspecified')
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
    .replace('{{business_origin}}', ctx.businessOrigin ?? 'unspecified')
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
    .replace('{{business_origin}}', ctx.businessOrigin ?? 'unspecified')
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
    .replace('{{business_origin}}', ctx.businessOrigin ?? 'unspecified')
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{regular_hours_status}}', regularHoursStatus || 'Not assessed')
    .replace('{{special_hours_status}}', specialHoursStatus || 'Not present on GBP')
    .replace('{{business_type}}', businessType || 'Unknown');
}

// ─── Website Gap (A7 — PB-08) ────────────────────────────────────────────

export const POSITIONING_REPORT_PROMPT = `You are preparing a web-presence positioning report for {{business_name}}, a {{business_category}} (origin: {{business_origin}}) in {{business_city}}, {{business_state}}.

Current web-presence state: {{presence_state}}
Known website-gap findings: {{gap_findings}}

Task: Write the positioning report the owner reads first. Cover:

## Where You Stand Today
[In plain language, describe the current web presence — no site, a social page standing in, a free subdomain, or a dead link — and what a customer experiences when they search for the business.]

## What Customers Expect From a {{business_category}} Site
[Benchmark against what a category-leading site must contain: the pages, the proof, the actions a customer should be able to take (menu/booking for restaurants, service pages + quote form for contractors, product browsing + hours for retailers).]

## The Conversion Cost
[One or two concrete consequences: "customers can't see your menu, so they call or leave", "the 2019 copyright makes people question whether you're still open".]

## What We'll Build
[A short scope summary: the pages and features the new site will have.]

Keep it specific to this business and category. No pricing.

Output as structured text.`;

export const HOMEPAGE_MOCKUP_PROMPT = `You are preparing a homepage mockup description for {{business_name}}, a {{business_category}} (origin: {{business_origin}}) in {{business_city}}, {{business_state}}.

Current web-presence state: {{presence_state}}
Must-have pages: {{must_have_pages}}

Task: Describe the proposed homepage in enough detail that the owner can picture it. Cover:

## Above the Fold
[Business name, one-line positioning, the single primary action (call / book / browse / order), hours or "open now" cue, city.]

## The Sections, In Order
[Each section: what it shows, why it earns its place for this category. Use the must-have pages as the anchor.]

## What Makes It Look Like *This* Business
[Category-specific trust signals: menu, service areas, product categories, project photos, testimonials, cultural/community context where relevant.]

## What We Deliberately Left Out
[What a generic template would include that this business doesn't need — keeps the build focused.]

Output as structured text.`;

export const DOMAIN_MIGRATION_PLAN_PROMPT = `You are preparing a domain migration plan for {{business_name}}, a {{business_category}} (origin: {{business_origin}}) in {{business_city}}, {{business_state}}.

Current web-presence state: {{presence_state}}
{{build_scope}}
Task: Write the plan to move the business onto an owned domain and point every profile at it. Cover:

## Domain
[Recommend a domain pattern based on the business name and city. Note whether the business already owns one, and the check to run before buying.]

## Build & Launch
[The sequence: build the site on the new domain, verify it loads fast on mobile, then cut over.]

## Point Every Profile At It
[Checklist: Google Business Profile, Yelp, Facebook/Instagram, Apple Maps, Bing Places — replace the social page or free subdomain URL with the canonical domain on each.]

## Redirects & Don't-Break-Anything
[Keep the old links working, update email signatures and print materials, keep the social page alive as a secondary channel.]

Keep it practical — the owner should be able to work through this in one sitting.

Output as structured text.`;

export function buildPositioningReportPrompt(
  ctx: BusinessContextFields,
  presenceState: string,
  gapFindings: string,
): string {
  return POSITIONING_REPORT_PROMPT
    .replace('{{business_name}}', ctx.businessName)
    .replace('{{business_category}}', ctx.businessCategory)
    .replace('{{business_origin}}', ctx.businessOrigin ?? 'unspecified')
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{presence_state}}', presenceState || 'No owned website detected')
    .replace('{{gap_findings}}', gapFindings || 'None recorded');
}

export function buildHomepageMockupPrompt(
  ctx: BusinessContextFields,
  presenceState: string,
  mustHavePages: string,
): string {
  return HOMEPAGE_MOCKUP_PROMPT
    .replace('{{business_name}}', ctx.businessName)
    .replace('{{business_category}}', ctx.businessCategory)
    .replace('{{business_origin}}', ctx.businessOrigin ?? 'unspecified')
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{presence_state}}', presenceState || 'No owned website detected')
    .replace('{{must_have_pages}}', mustHavePages || 'Home, Services/Products, About, Contact');
}

export function buildDomainMigrationPlanPrompt(
  ctx: BusinessContextFields,
  presenceState: string,
  buildScope?: string,
): string {
  return DOMAIN_MIGRATION_PLAN_PROMPT
    .replace('{{business_name}}', ctx.businessName)
    .replace('{{business_category}}', ctx.businessCategory)
    .replace('{{business_origin}}', ctx.businessOrigin ?? 'unspecified')
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{presence_state}}', presenceState || 'No owned website detected')
    .replace('{{build_scope}}', buildScope ? `Recommended build scope: ${buildScope}` : '');
}

// ─── Profile Presence (A8 — PB-09) ───────────────────────────────────────

export const PRESENCE_MAP_PROMPT = `You are preparing a profile-presence map for {{business_name}}, a {{business_category}} (origin: {{business_origin}}) in {{business_city}}, {{business_state}}.

Platform-by-platform state:
{{platform_states}}

Summary: {{presence_summary}}

Task: Write the presence map the owner reads first. Cover:

## Where Customers Look — And Where You Are
[A plain-language walk through each platform customers check for a {{business_category}} (Google, Yelp, Facebook, Apple Maps, Bing, Nextdoor): whether the business has a profile there, and what a customer experiences when they search — found, found-but-unclaimed, or nothing at all.]

## Why Each Platform Is a Door
[One line per missing or unclaimed platform on what it actually delivers: the searches it answers, the maps it appears in, the reviews it collects. Frame absence as discovery the business is missing — not a defect to feel guilty about. Most owners don't know these listings are free.]

## The Compounding Cost
[What an incomplete footprint costs: every missing profile is a stream of searches that ends at a competitor; every unclaimed profile is a listing anyone can edit.]

Keep it specific to this business and category. No pricing.

Output as structured text.`;

export const PROFILE_BUILD_PLAN_PROMPT = `You are preparing a profile build plan for {{business_name}}, a {{business_category}} (origin: {{business_origin}}) in {{business_city}}, {{business_state}}.

Current platform state:
{{platform_states}}

Platforms with no profile: {{missing_platforms}}

Task: Write the build plan — the profiles to create, in the order that builds discovery fastest. Cover:

## Build Order
[The platforms to build first, ranked by how much discovery they unlock for a {{business_category}} in {{business_city}}. Google first almost always — it feeds Maps and Search — then the category-relevant directories and the social platform where this business's customers actually are.]

## What Each Profile Carries
[Per platform, the complete profile spec built to the gold-standard field set for a {{business_category}}: the canonical name/address/phone, hours, categories, the description tuned to that platform, and the photos or content the benchmark listings carry (menu for restaurants, service list for contractors, product categories for retailers). The point is a complete profile, not a bare listing.]

## Two Ways to Get There
[The same blueprint delivers two ways: the profiles can be built for the owner, or the owner can build them with this plan in hand — same canonical record, same field spec, same order. Say it plainly so the owner knows the plan works either way.]

## The First Week on Each Platform
[What a new profile needs to start working — the first photos, the first post, asking the first happy customers for a review — so the listing doesn't sit empty.]

Keep it practical — the owner should see a build sequence, not a lecture. No pricing.

Output as structured text.`;

export const OWNERSHIP_CLAIM_GUIDE_PROMPT = `You are preparing an ownership and claim guide for {{business_name}}, a {{business_category}} (origin: {{business_origin}}) in {{business_city}}, {{business_state}}.

Claim actions needed:
{{claim_actions}}

Integrity issues found:
{{integrity_issues}}

Task: Write the guide that puts every profile under the owner's control. Cover:

## Claim What Already Exists
[For each unclaimed or unmanaged listing: how the claim works on that platform, what verification it asks for (postcard, phone, email), and roughly how long each takes. Plain steps an owner can follow — no platform jargon.]

## Clear the Integrity Blocks
[For each integrity issue found — suspension, duplicate, dispute, hijack, verification block, broken link — what it means in plain language and the resolution path. Suspensions and disputes come first: no build work matters while a platform won't show the business. For a DUPLICATE, present the fork explicitly: MERGE (consolidate into one owner-approved profile) or RETIRE the duplicate. State that the OWNER picks which profile survives, and give the criteria — which listing is older (usually the platform's original), which one the owner actually controls (you can only act on a listing you have claimed), which carries the reviews, and which name matches the business's own signage and website. Say plainly that review transfer on a merge is not guaranteed: the reviews that count are the ones on the survivor. Flag the cross-platform consequence too — a duplicate usually carries the business's linked social and directory profiles on one listing and none on the other, so "missing profile" findings on the bare listing are the SPLIT, not real absence, and consolidating restores the links.]

## Keeping Control
[What "claimed" protects: only the owner can edit hours, phone, and address; the owner sees customer questions and reviews first; competitors and strangers can't suggest changes.]

Keep it practical — this is paperwork, not engineering. No pricing.

Output as structured text.`;

export const KEYWORD_SURFACE_PLAN_PROMPT = `You are preparing a keyword surface plan for {{business_name}}, a {{business_category}} (origin: {{business_origin}}) in {{business_city}}, {{business_state}}.

Identity tokens observed for this business — from its real-world names, its signage, and the profiles and directories it appears on:
{{identity_tokens}}

Other names this business is known by:
{{alternate_names}}

{{duplicate_listing_note}}

Where each token belongs:
{{keyword_placements}}

Task: Write the plan that puts every word this business cares about where the platform actually reads it. Cover:

## The Words You're Known By
[Name the tokens plainly and say where each was observed — the storefront sign, a trade name, a directory, a category. This is the owner's own identity reflected back, not a list of search terms. If the business is known by more than one name, say so without judgement: that is normal for a business whose community and its paperwork use different words.]

## Where Each Word Belongs
[A placement walk-through, one field at a time: primary + additional categories, services / service menu, products, business description, attributes. For each, name the tokens that go there and why that field is indexed and searchable. Be concrete — the owner should be able to open their profile and fill each field from this section.]

## The One Place It Must Not Go
[The business name. Explain plainly: a profile name is the real-world name, and adding category, specialty, or location words to it is against the platform's guidelines. Everything the name was being asked to do for search can be done in the fields above — legally, durably, and without risking the profile. Do not moralise; the instinct to be findable is correct.]

## One Profile, Every Surface
[The consolidation: one profile carrying every category, service, product, attribute, and description loses nothing. Say what the split is costing — reviews and ratings divided across two half-profiles, neither ranking as strongly as one complete profile would.]

Keep it practical and specific to this business. No pricing.

Output as structured text.`;

export function buildPresenceMapPrompt(
  ctx: BusinessContextFields,
  platformStates: string,
  presenceSummary: string,
): string {
  return PRESENCE_MAP_PROMPT
    .replace('{{business_name}}', ctx.businessName)
    .replace('{{business_category}}', ctx.businessCategory)
    .replace('{{business_origin}}', ctx.businessOrigin ?? 'unspecified')
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{platform_states}}', platformStates || 'No platform data recorded')
    .replace('{{presence_summary}}', presenceSummary || 'Presence not assessed');
}

export function buildProfileBuildPlanPrompt(
  ctx: BusinessContextFields,
  platformStates: string,
  missingPlatforms: string,
): string {
  return PROFILE_BUILD_PLAN_PROMPT
    .replace('{{business_name}}', ctx.businessName)
    .replace('{{business_category}}', ctx.businessCategory)
    .replace('{{business_origin}}', ctx.businessOrigin ?? 'unspecified')
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{platform_states}}', platformStates || 'No platform data recorded')
    .replace('{{missing_platforms}}', missingPlatforms || 'None detected');
}

export function buildOwnershipClaimGuidePrompt(
  ctx: BusinessContextFields,
  claimActions: string,
  integrityIssues: string,
): string {
  return OWNERSHIP_CLAIM_GUIDE_PROMPT
    .replace('{{business_name}}', ctx.businessName)
    .replace('{{business_category}}', ctx.businessCategory)
    .replace('{{business_origin}}', ctx.businessOrigin ?? 'unspecified')
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{claim_actions}}', claimActions || 'No unclaimed or blocked profiles detected')
    .replace('{{integrity_issues}}', integrityIssues || 'None detected');
}

export function buildKeywordSurfacePlanPrompt(
  ctx: BusinessContextFields,
  identityTokens: string,
  alternateNames: string,
  duplicateListingNote: string,
  keywordPlacements: string,
): string {
  return KEYWORD_SURFACE_PLAN_PROMPT
    .replace('{{business_name}}', ctx.businessName)
    .replace('{{business_category}}', ctx.businessCategory)
    .replace('{{business_origin}}', ctx.businessOrigin ?? 'unspecified')
    .replace('{{business_city}}', ctx.city ?? '')
    .replace('{{business_state}}', ctx.state ?? '')
    .replace('{{identity_tokens}}', identityTokens || 'None observed')
    .replace('{{alternate_names}}', alternateNames || 'None observed — one name only')
    .replace('{{duplicate_listing_note}}', duplicateListingNote)
    .replace('{{keyword_placements}}', keywordPlacements || 'None derived');
}

// ─── Execution-layer variable maps ─────────────────────────────────────────
// The prompt constants above are seeded into mpt_prompt_templates_list (see
// src/scripts/seed-deliverable-construction-templates.ts) and rendered through
// MarketingExecutionService.resolvePrompt. These maps produce the {{variable}}
// values passed as `variables` — the same substitution semantics (and the same
// defaults) as the legacy .replace() builders above.

export function ownerVoiceVariables(voice: OwnerVoiceFields): Record<string, string> {
  return {
    voice_person: voice.person ?? 'first_person',
    voice_formality: voice.formality ?? 'casual',
    voice_humor: voice.humor ?? 'none',
    voice_apology_style: voice.apologyStyle ?? 'fix_first',
    voice_signoff_style: voice.signoffStyle ?? 'first_name',
    voice_signature: voice.signature ?? '',
  };
}

export function businessContextVariables(ctx: BusinessContextFields): Record<string, string> {
  return {
    business_name: ctx.businessName,
    business_category: ctx.businessCategory,
    business_origin: ctx.businessOrigin ?? 'unspecified',
    business_city: ctx.city ?? '',
    business_state: ctx.state ?? '',
    business_phone: ctx.phone ?? 'N/A',
    business_website: ctx.websiteUrl ?? 'N/A',
    campaign_tone: ctx.campaignTone,
  };
}
