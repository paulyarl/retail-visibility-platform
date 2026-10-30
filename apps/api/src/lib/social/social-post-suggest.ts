/**
 * Social post suggest — prompt builder for AI-drafted post copy.
 *
 * Spec: SOCIAL_POSTING_SUITE_SPEC.md §4.3 — dual pattern (renderOnly returns
 * the built prompt for the merchant's own LLM; otherwise the platform
 * resolves via aiProviderFactory). Mirrors gbp-post-suggest.ts with
 * platform-conditioned length/format rules.
 */

import type { SocialPlatform } from './types';

export type SocialPostTone = 'friendly' | 'professional' | 'playful' | 'urgent' | 'informative';
export type SocialPostTheme =
  | 'problem_solution'
  | 'announcement'
  | 'offer'
  | 'tip'
  | 'seasonal'
  | 'feature_highlight';

export interface SocialPostSuggestDirective {
  platform: SocialPlatform;
  businessName: string;
  category: string;
  photoDescription?: string | null;
  tone?: SocialPostTone;
  theme?: SocialPostTheme;
  topic?: string | null;
  linkUrl?: string | null;
}

const TONE_LINES: Record<SocialPostTone, string> = {
  friendly: 'Warm and welcoming, like a neighbor recommending the shop.',
  professional: 'Polished and trustworthy, no slang.',
  playful: 'Light and fun — a little personality is welcome.',
  urgent: 'Creates gentle urgency (limited time, while supplies last) without being pushy.',
  informative: 'Helpful and educational — teach the customer something useful.',
};

const THEME_LINES: Record<SocialPostTheme, string> = {
  problem_solution:
    'Structure: name a problem the customer likely has (the hook), then present the business as the solution.',
  announcement: 'Structure: announce something newsworthy — new stock, new hours, an update customers should know.',
  offer: 'Structure: lead with the offer or deal, then one supporting detail, then the action.',
  tip: 'Structure: share one practical tip related to what the business sells — position the business as the expert.',
  seasonal: 'Structure: tie the post to the current season or an upcoming occasion customers are thinking about.',
  feature_highlight: 'Structure: highlight one thing the business offers that customers may not know about.',
};

const PLATFORM_RULES: Partial<Record<SocialPlatform, { label: string; maxChars: number; style: string }>> = {
  meta_facebook: {
    label: 'Facebook Page post',
    maxChars: 2000,
    style: 'Conversational, community-facing. 1-3 short paragraphs max. A question at the end works well.',
  },
  meta_instagram: {
    label: 'Instagram caption',
    maxChars: 2200,
    style: 'Visual-first caption — short hook line, 1-2 supporting sentences, then a block of 3-8 relevant hashtags on the last line.',
  },
  meta_threads: {
    label: 'Threads post',
    maxChars: 450,
    style: 'One punchy thought — casual, no hashtags, no fluff. Must fit comfortably under the 500-char limit.',
  },
};

export const SOCIAL_POST_SUGGEST_SYSTEM =
  'You write social media posts for local brick-and-mortar businesses. ' +
  'Return only the post text — no markdown, no preamble, no quotation marks.';

export function buildSocialPostSuggestPrompt(d: SocialPostSuggestDirective): string {
  const rules = PLATFORM_RULES[d.platform];
  const lines = [
    `Write a ${rules?.label || 'social media post'} for ${d.businessName}, a ${d.category}.`,
  ];
  if (rules) {
    lines.push(`Format rules: ${rules.style} Hard limit ${rules.maxChars} characters.`);
  }
  if (d.photoDescription) {
    lines.push(
      `The post will be paired with media showing: ${d.photoDescription}. ` +
        'Write copy that naturally fits what a customer would see there.'
    );
  }
  if (d.topic) lines.push(`Topic anchor: ${d.topic}.`);
  if (d.theme) lines.push(THEME_LINES[d.theme]);
  if (d.tone) lines.push(`Tone: ${TONE_LINES[d.tone]}`);
  if (d.linkUrl) lines.push(`Reference this link naturally if the surface supports it: ${d.linkUrl}`);
  lines.push('Write one post. Output only the post text.');
  return lines.join('\n');
}
