/**
 * GBP Review Reply — Prompt Builder
 *
 * Purpose-built prompt for live Google Business Profile review responses.
 * Produces 3 distinct angle-variant drafts in a single LLM call:
 *   1. warm/direct
 *   2. professional/concise
 *   3. empathetic/detailed
 *
 * Tone source hierarchy (per spec §4 Subsystem 2 Tier A):
 *   1. Owner voice profile (PRIMARY) — from OwnerVoiceService.getProfile
 *   2. Category tone preset (SECONDARY) — augments voice
 *   3. Campaign tone (FALLBACK) — when voice profile unavailable
 *
 * Sentiment-aware rules + category guardrails are injected into the prompt
 * so the LLM produces review-grounded, sentiment-appropriate, category-safe
 * responses.
 *
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE2.md Task 2
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface OwnerVoiceProfile {
  person: string | null;
  formality: string | null;
  humor: string | null;
  apologyStyle: string | null;
  signoffStyle: string | null;
  signature: string | null;
}

export interface CategoryTonePreset {
  tone: string;
  description?: string | null;
}

export interface GbpReviewReplyPromptInput {
  reviewerName: string;
  starRating: number; // 1–5 (Int, post-migration 238)
  comment: string | null;
  reviewTime: string | null;
  businessName: string;
  businessCategory: string;
  ownerVoiceProfile: OwnerVoiceProfile | null; // PRIMARY tone source
  categoryTonePreset: CategoryTonePreset | null; // SECONDARY augmentation
  campaignTone: string | null; // FALLBACK
}

// ── Sentiment-aware rules ────────────────────────────────────────────────

function buildSentimentRules(starRating: number, comment: string | null): string {
  if (starRating >= 5) {
    if (comment && comment.trim().length > 0) {
      return [
        'SENTIMENT RULES (5★ + comment):',
        '- This is a glowing review with specific praise.',
        '- Mention what was praised (reference the comment content).',
        '- Express genuine gratitude — do NOT use a generic "thanks for your review" template.',
        '- Invite them back warmly.',
      ].join('\n');
    }
    return [
      'SENTIMENT RULES (5★ no comment):',
      '- This is a top rating with no written feedback.',
      '- Express genuine thanks with business/category context (e.g., "We love welcoming fellow [category] lovers").',
      '- Do NOT use a generic template — reference the business name and category.',
      '- Keep it warm and brief.',
    ].join('\n');
  }
  if (starRating >= 3) {
    return [
      'SENTIMENT RULES (3–4★):',
      '- This is a mixed/positive review with room for improvement.',
      '- Acknowledge the positive aspects first.',
      '- Address any specific feedback or suggestions constructively.',
      '- Signal commitment to improvement without being defensive.',
    ].join('\n');
  }
  return [
    'SENTIMENT RULES (1–2★):',
    '- This is a negative review.',
    '- Apologize sincerely — do NOT argue or make excuses.',
    '- Name a specific fix or next step where appropriate.',
    '- Redirect the conversation offline (e.g., "Please reach us at [phone/email] so we can make this right").',
    '- Keep the response professional and empathetic.',
  ].join('\n');
}

// ── Category guardrails ──────────────────────────────────────────────────

function buildCategoryGuardrails(category: string): string {
  const normalized = category.trim().toLowerCase();

  if (normalized.includes('medical') || normalized.includes('doctor') || normalized.includes('clinic') || normalized.includes('health') || normalized.includes('dental') || normalized.includes('dentist')) {
    return [
      'CATEGORY GUARDRAILS (Medical/Health):',
      '- Do NOT discuss any health details, diagnoses, or treatment specifics publicly.',
      '- Do NOT confirm or deny that the reviewer was a patient.',
      '- Redirect clinical concerns to a private channel (phone/portal).',
      '- Keep the response to general service/experience acknowledgment only.',
    ].join('\n');
  }

  if (normalized.includes('legal') || normalized.includes('law') || normalized.includes('attorney') || normalized.includes('lawyer')) {
    return [
      'CATEGORY GUARDRAILS (Legal):',
      '- Do NOT discuss any case details, legal advice, or client specifics publicly.',
      '- Do NOT confirm or deny an attorney-client relationship.',
      '- Redirect case-specific concerns to a private consultation.',
      '- Keep the response to general service acknowledgment only.',
    ].join('\n');
  }

  if (normalized.includes('restaurant') || normalized.includes('food') || normalized.includes('cafe') || normalized.includes('dining') || normalized.includes('bar') || normalized.includes('bakery')) {
    return [
      'CATEGORY GUARDRAILS (Food/Restaurant):',
      '- You may reference the menu, dishes, or service experience mentioned in the review.',
      '- You may mention specific food items the reviewer praised.',
      '- Keep food safety / health claims general (no medical promises).',
    ].join('\n');
  }

  if (normalized.includes('retail') || normalized.includes('store') || normalized.includes('shop') || normalized.includes('boutique')) {
    return [
      'CATEGORY GUARDRAILS (Retail):',
      '- You may reference products, brands, or staff assistance mentioned in the review.',
      '- You may mention specific items the reviewer purchased or praised.',
      '- Keep promotional language natural, not pushy.',
    ].join('\n');
  }

  return 'CATEGORY GUARDRAILS: No special category restrictions — keep responses professional and on-topic.';
}

// ── Tone source assembly ─────────────────────────────────────────────────

function buildToneBlock(input: GbpReviewReplyPromptInput): string {
  const lines: string[] = ['TONE SOURCE:'];

  // PRIMARY: owner voice profile
  if (input.ownerVoiceProfile) {
    const v = input.ownerVoiceProfile;
    lines.push('Owner voice profile (PRIMARY — sound like this owner):');
    lines.push(`- Person: ${v.person ?? 'first_person'}`);
    lines.push(`- Formality: ${v.formality ?? 'casual'}`);
    lines.push(`- Humor: ${v.humor ?? 'none'}`);
    lines.push(`- Apology style: ${v.apologyStyle ?? 'fix_first'}`);
    lines.push(`- Signoff style: ${v.signoffStyle ?? 'first_name'}`);
    if (v.signature) lines.push(`- Signature: ${v.signature}`);

    // SECONDARY: category tone preset augments
    if (input.categoryTonePreset) {
      lines.push('');
      lines.push(`Category tone preset (SECONDARY — augments voice): ${input.categoryTonePreset.tone}`);
      if (input.categoryTonePreset.description) {
        lines.push(`- ${input.categoryTonePreset.description}`);
      }
    }
  } else if (input.campaignTone) {
    // FALLBACK: campaign tone
    lines.push(`Campaign tone (FALLBACK — no owner voice profile available): ${input.campaignTone}`);
    if (input.categoryTonePreset) {
      lines.push('');
      lines.push(`Category tone preset (SECONDARY): ${input.categoryTonePreset.tone}`);
      if (input.categoryTonePreset.description) {
        lines.push(`- ${input.categoryTonePreset.description}`);
      }
    }
  } else if (input.categoryTonePreset) {
    lines.push(`Category tone preset (default): ${input.categoryTonePreset.tone}`);
    if (input.categoryTonePreset.description) {
      lines.push(`- ${input.categoryTonePreset.description}`);
    }
  } else {
    lines.push('Default: warm, professional, first-person, casual formality.');
  }

  return lines.join('\n');
}

// ── Main prompt builder ──────────────────────────────────────────────────

const GBP_REVIEW_REPLY_PROMPT = `You are writing public review responses on behalf of a small business owner on Google Business Profile.

BUSINESS CONTEXT:
- Business name: {{business_name}}
- Business category: {{business_category}}

REVIEW DETAILS:
- Reviewer: {{reviewer_name}}
- Star rating: {{star_rating}} / 5
- Comment: {{comment}}
- Review time: {{review_time}}

{{tone_block}}

{{sentiment_rules}}

{{category_guardrails}}

TASK: Write THREE distinct draft responses to this review. Each draft must use a different angle:

1. "warm_direct" — Warm and direct. Conversational, genuine, gets to the point.
2. "professional_concise" — Professional and concise. Polished, brief, on-brand.
3. "empathetic_detailed" — Empathetic and detailed. Acknowledges feelings, addresses specifics, longer.

Rules for ALL drafts:
- Sound like the owner (use the owner voice profile above), not a marketing bot.
- Reference the reviewer by name when natural.
- Reference specific content from the comment when available.
- Never use generic "Dear valued customer" openers.
- Stay within the category guardrails above.
- Each draft must be distinct in tone and length — not a rewording of the same response.
- Do NOT include the angle label in the draft text itself.

Return ONLY a JSON array of 3 objects, each with "angle" and "text" keys:
[
  { "angle": "warm_direct", "text": "..." },
  { "angle": "professional_concise", "text": "..." },
  { "angle": "empathetic_detailed", "text": "..." }
]

Output the JSON array only — no preamble, no explanation, no markdown fences.`;

/**
 * Build the GBP review reply prompt for the Tier A 3-draft generation flow.
 */
export function buildGbpReviewReplyPrompt(input: GbpReviewReplyPromptInput): string {
  return GBP_REVIEW_REPLY_PROMPT
    .replace('{{business_name}}', input.businessName)
    .replace('{{business_category}}', input.businessCategory)
    .replace('{{reviewer_name}}', input.reviewerName || 'a customer')
    .replace('{{star_rating}}', String(input.starRating))
    .replace('{{comment}}', input.comment ?? '(no written comment)')
    .replace('{{review_time}}', input.reviewTime ?? '(unknown date)')
    .replace('{{tone_block}}', buildToneBlock(input))
    .replace('{{sentiment_rules}}', buildSentimentRules(input.starRating, input.comment))
    .replace('{{category_guardrails}}', buildCategoryGuardrails(input.businessCategory));
}

// ── Draft preview prompt (unentitled — single preview draft) ─────────────

const GBP_REVIEW_REPLY_PREVIEW_PROMPT = `You are writing a single preview draft review response on behalf of a small business owner on Google Business Profile.

BUSINESS CONTEXT:
- Business name: {{business_name}}
- Business category: {{business_category}}

REVIEW DETAILS:
- Reviewer: {{reviewer_name}}
- Star rating: {{star_rating}} / 5
- Comment: {{comment}}

{{tone_block}}

{{sentiment_rules}}

{{category_guardrails}}

TASK: Write ONE warm, genuine draft response to this review. Sound like the owner, not a bot.

Return ONLY a JSON object with "angle" and "text" keys:
{ "angle": "preview", "text": "..." }

Output the JSON object only — no preamble, no explanation, no markdown fences.`;

/**
 * Build a single-draft preview prompt for unentitled users (draft-preview mode).
 */
export function buildGbpReviewReplyPreviewPrompt(input: GbpReviewReplyPromptInput): string {
  return GBP_REVIEW_REPLY_PREVIEW_PROMPT
    .replace('{{business_name}}', input.businessName)
    .replace('{{business_category}}', input.businessCategory)
    .replace('{{reviewer_name}}', input.reviewerName || 'a customer')
    .replace('{{star_rating}}', String(input.starRating))
    .replace('{{comment}}', input.comment ?? '(no written comment)')
    .replace('{{tone_block}}', buildToneBlock(input))
    .replace('{{sentiment_rules}}', buildSentimentRules(input.starRating, input.comment))
    .replace('{{category_guardrails}}', buildCategoryGuardrails(input.businessCategory));
}
