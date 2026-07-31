/**
 * Deliverable Construction — Prompt Templates
 *
 * Owner-voice-extended prompts for:
 *   - buildDeliverableReviewResponsePrompt — per-review owner response draft
 *   - buildOwnerVoiceInferencePrompt        — infer voice from existing responses
 *   - buildRecoveryPlaybookPrompt           — theme-clustered response templates
 *   - buildListingCorrectionsPrompt         — NAP corrections per platform
 *   - buildCtaFixesPrompt                   — website CTA recommendations
 *
 * All prompts inject the owner voice profile + business context block so
 * outputs sound like the owner, not a marketing bot.
 *
 * See: docs/LocalBiz/marketing_ops_deliverable_construction_sprint_plan.md §5
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
