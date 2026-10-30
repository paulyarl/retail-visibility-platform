/**
 * GBP post suggest — prompt builder for AI-drafted post copy.
 *
 * The composer asks for copy aligned to an attached photo plus an optional
 * directive: tone, CTA, structure theme, and a topic anchor. Topics can be
 * seeded from the merchant's active feature purchases — the platform's own
 * feature library doubles as an unlimited content bank (a tenant with the
 * flyer module gets "weekly specials flyer" posts, etc.).
 */

export type GbpPostTone = 'friendly' | 'professional' | 'playful' | 'urgent' | 'informative';
export type GbpPostCta = 'call' | 'visit' | 'learn_more' | 'order' | 'book' | 'none';
export type GbpPostTheme =
  | 'problem_solution'
  | 'announcement'
  | 'offer'
  | 'tip'
  | 'seasonal'
  | 'feature_highlight';

export interface GbpPostSuggestDirective {
  businessName: string;
  category: string;
  photoDescription?: string | null;
  tone?: GbpPostTone;
  cta?: GbpPostCta;
  theme?: GbpPostTheme;
  topic?: string | null;
}

const TONE_LINES: Record<GbpPostTone, string> = {
  friendly: 'Warm and welcoming, like a neighbor recommending the shop.',
  professional: 'Polished and trustworthy, no slang.',
  playful: 'Light and fun — a little personality is welcome.',
  urgent: 'Creates gentle urgency (limited time, while supplies last) without being pushy.',
  informative: 'Helpful and educational — teach the customer something useful.',
};

const CTA_LINES: Record<GbpPostCta, string> = {
  call: 'End with a call to action inviting the reader to call the business.',
  visit: 'End with a call to action inviting the reader to visit in person.',
  learn_more: 'End with a call to action inviting the reader to learn more online.',
  order: 'End with a call to action inviting the reader to order or shop.',
  book: 'End with a call to action inviting the reader to book or schedule.',
  none: 'Do not include an explicit call to action.',
};

const THEME_LINES: Record<GbpPostTheme, string> = {
  problem_solution:
    'Structure: name a problem the customer likely has (the hook), then present the business as the solution.',
  announcement: 'Structure: announce something newsworthy — new stock, new hours, an update customers should know.',
  offer: 'Structure: lead with the offer or deal, then one supporting detail, then the action.',
  tip: 'Structure: share one practical tip related to what the business sells — position the business as the expert.',
  seasonal: 'Structure: tie the post to the current season or an upcoming occasion customers are thinking about.',
  feature_highlight: 'Structure: highlight one thing the business offers that customers may not know about.',
};

export const GBP_POST_SUGGEST_SYSTEM =
  'You write short Google Business Profile update posts for local businesses. ' +
  'Return only the post text — 1-3 sentences, no hashtags, no markdown, max 500 characters.';

export function buildGbpPostSuggestPrompt(d: GbpPostSuggestDirective): string {
  const lines = [
    `Write a Google Business Profile update post for ${d.businessName}, a ${d.category}.`,
  ];
  if (d.photoDescription) {
    lines.push(
      `The post will be paired with a photo showing: ${d.photoDescription}. ` +
        'Write copy that naturally fits what a customer would see in that photo.'
    );
  }
  if (d.topic) lines.push(`Topic: ${d.topic}.`);
  lines.push(`Tone: ${TONE_LINES[d.tone ?? 'friendly']}`);
  lines.push(THEME_LINES[d.theme ?? 'announcement']);
  lines.push(CTA_LINES[d.cta ?? 'visit']);
  return lines.join('\n');
}

/** Map a feature key + marketing name into a human post topic. */
export function featureKeyToTopic(featureKey: string, marketingName?: string | null): string {
  if (marketingName) return marketingName;
  return featureKey
    .replace(/^(gbp|flyer|crm|faq|qr|social)_?/, '')
    .replace(/_/g, ' ')
    .trim();
}
