/**
 * Hook Library — Server-side starter hook catalog (Light-Score Hooks)
 *
 * Code-defined, typed catalog of 13 proven first-touch hook angles, each
 * following the same five-beat shape:
 *   diagnostic hook → reassurance → bridge/quantified upside → audit offer → soft CTA
 *
 * The catalog stores **templatized** versions of the operator-authored
 * samples (African grocery stores, Indianapolis) — niche-specific nouns
 * become `{{category}}` / `{{city}}` placeholders, the greeting becomes
 * `{{salutation}}`, and the signoff becomes `{{sender_name}}`. Generic
 * phrasings that work across niches ("local shops", "shops like yours",
 * "your shop") stay verbatim. See §13.2 of the sprint plan for the three
 * phrasing categories.
 *
 * Each template carries both an email-channel body (`subject` + `body`)
 * and a phone-channel spoken line (`phone_hook`) — Stage 2 of the
 * cold-call script. The phone merge set is `{{business}}`, `{{address}}`,
 * `{{category}}`, `{{city}}`, `{{operator_name}}` (no `{{salutation}}` —
 * Stage 1 speaks the business name, not a greeting).
 *
 * The 13th angle (`zero_footprint`) covers the "no usable footprint found
 * at all" case from the cold-call script's `EF_ZERO_INDEXED_PRESENCE` row.
 *
 * No DB access, no async, no side effects — pure data module.
 * Mirrors `GalleryArchetypeDefaults.ts` pattern.
 *
 * See: docs/LocalBiz/marketing_ops_outreach_intelligence_prep_sprint_plan.md §11–§13
 *      docs/LocalBiz/marketing_ops_cold_call_channel_sprint_plan.md §5.1
 *      docs/LocalBiz/operator_hook_samples.md (rendered reference output)
 */

import type { ArchetypeCode } from './archetype-selection';

// ─── Types ──────────────────────────────────────────────────────────────

export type HookAngle =
  | 'gbp_verification'
  | 'nap_normalization'
  | 'hours_sync'
  | 'website_foundation'
  | 'website_repair'
  | 'product_category_pages'
  | 'review_acquisition'
  | 'testimonial_amplification'
  | 'local_seo'
  | 'cross_platform_expansion'
  | 'photo_content_setup'
  | 'click_to_call'
  | 'reputation_monitoring'
  | 'zero_footprint';

export interface HookTemplate {
  angle: HookAngle;
  label: string;
  /** Archetype affinity (A1–A6) — drives ranking. */
  archetypes: ArchetypeCode[];
  /** Signal-taxonomy codes that boost rank when detected. */
  signals: string[];
  /** Email subject line — merge placeholders allowed. */
  subject: string;
  /** Five-beat body — merge placeholders allowed. */
  body: string;
  /** Annotated beats for the picker UI. */
  shape: {
    score_hook: string;
    reassurance: string;
    quantified_upside: string;
    audit_offer: string;
    soft_cta: string;
  };
  /**
   * Stage 2 spoken line for the cold-call script — merge placeholders
   * allowed ({{category}}, {{city}}, {{business}}, {{operator_name}}).
   * Bypasses the opener quality gate (spoken copy has no
   * salutation/signoff/preview-attachment requirements).
   */
  phone_hook: string;
}

// ─── Merge placeholders ─────────────────────────────────────────────────
//
// {{salutation}}   — from OutreachIntelligenceService.recommended_salutation
//                    (Sprint 1), resolved via primary-sibling inheritance.
//                    Falls back through the salutation chain inline when no
//                    worksheet exists.
// {{category}}     — campaign service_category, lowercased for in-sentence use.
// {{city}}         — campaign city.
// {{sender_name}}  — assigned operator display name (falls back to platform
//                    sender identity).
// {{business}}     — campaign business_name. Defined but unused in seed hooks
//                    (they use generic "your shop" / "your business" phrasing).
//                    Available for future hooks that address the business by name.

// ─── Catalog ────────────────────────────────────────────────────────────

export const HOOK_LIBRARY: HookTemplate[] = [
  // 1. gbp_verification
  {
    angle: 'gbp_verification',
    label: 'Google Business Profile verification & optimization',
    archetypes: ['A3', 'A4'],
    signals: ['DS_CLAIMED_STATUS', 'DS_MISSING_SERVICE_MENU', 'DS_OUTDATED_HOURS', 'DS_PHOTO_DEFICIT'],
    subject: 'quick question about your Google listing',
    body: `{{salutation}} I was looking up {{category}} in {{city}} earlier and noticed your Google listing is probably sitting around a C-minus for completeness — hours, categories, photos, that kind of thing.

Honestly, most local shops are in that range, so nothing to worry about.

But an incomplete listing usually means you're missing out on 20-30% of the "near me" searches that should be finding you first — people who are already looking for exactly what you sell.

Good news — you're already listed in our directory, so most of the groundwork is done. You can verify and correct your info here: {{claim_url}}

I do quick Google Listing Audits that show exactly what's missing and what to fix first. Takes me about a day, and it's yours to keep either way.

Want me to send over what I found?

-- {{sender_name}}`,
    shape: {
      score_hook: 'Google listing probably sitting around a C-minus for completeness',
      reassurance: 'Most local shops are in that range, so nothing to worry about.',
      quantified_upside: 'Missing out on 20-30% of "near me" searches',
      audit_offer: 'Quick Google Listing Audit + directory claim link — takes about a day, yours to keep',
      soft_cta: 'Want me to send over what I found?',
    },
    phone_hook: 'I was looking up {{category}} in {{city}} earlier and noticed your Google listing is probably sitting around a C-minus for completeness — hours, categories, photos, that kind of thing. Most local shops are in that range, so nothing to worry about. But an incomplete listing usually means you\'re missing out on 20-30% of the "near me" searches that should be finding you first. Good news — you\'re already listed in our directory, so most of the groundwork is done. You can verify and correct your info through the link I\'ll send. I do quick Google Listing Audits that show exactly what\'s missing — takes about a day, yours to keep either way. Want me to send over what I found?',
  },

  // 2. nap_normalization
  {
    angle: 'nap_normalization',
    label: 'Business-name and NAP normalization',
    archetypes: ['A3'],
    signals: ['CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT'],
    subject: 'your business shows up a little differently everywhere',
    body: `{{salutation}} Quick one — I pulled up your business across a few directories (Google, Yelp, Facebook) and noticed the name and phone number don't quite match everywhere.

Super common, nothing broken.

But it can quietly confuse Google about which listing to trust and rank — which means fewer people finding the right number to actually call you.

I put together a fast NAP Consistency Check that maps out every mismatch and the fix for each. Takes about a day, free to keep.

Want me to send it over?

-- {{sender_name}}`,
    shape: {
      score_hook: 'Name and phone number don\'t quite match across directories',
      reassurance: 'Super common, nothing broken.',
      quantified_upside: 'Confuses Google about which listing to trust and rank',
      audit_offer: 'NAP Consistency Check — maps every mismatch, takes about a day',
      soft_cta: 'Want me to send it over?',
    },
    phone_hook: 'Quick one — I pulled up your business across a few directories (Google, Yelp, Facebook) and noticed the name and phone number don\'t quite match everywhere. Super common, nothing broken. But it can quietly confuse Google about which listing to trust and rank — which means fewer people finding the right number to actually call you. I put together a fast NAP Consistency Check that maps out every mismatch and the fix for each. Want me to send it over?',
  },

  // 3. hours_sync
  {
    angle: 'hours_sync',
    label: 'Hours synchronization',
    archetypes: ['A3'],
    signals: ['DS_OUTDATED_HOURS'],
    subject: 'are your hours right everywhere?',
    body: `{{salutation}} I noticed your posted hours aren't quite the same across your listings — one place says open, another's a little different.

Most local shops have this somewhere, so don't sweat it.

But it's one of the top reasons customers show up to a locked door — and leave a review about it instead of coming back.

I can run a quick Hours Accuracy Check across your main listings and hand you a simple fix list. Takes about a day, no cost, yours either way.

Want me to send it?

-- {{sender_name}}`,
    shape: {
      score_hook: 'Posted hours aren\'t the same across listings',
      reassurance: 'Most local shops have this somewhere, so don\'t sweat it.',
      quantified_upside: 'Top reason customers show up to a locked door',
      audit_offer: 'Hours Accuracy Check — simple fix list, takes about a day',
      soft_cta: 'Want me to send it?',
    },
    phone_hook: 'I noticed your posted hours aren\'t quite the same across your listings — one place says open, another\'s a little different. Most local shops have this somewhere, so don\'t sweat it. But it\'s one of the top reasons customers show up to a locked door — and leave a review about it instead of coming back. I can run a quick Hours Accuracy Check across your main listings and hand you a simple fix list. Want me to send it?',
  },

  // 4. website_foundation — for missing website (no URL found at all)
  {
    angle: 'website_foundation',
    label: 'Website creation or modernization',
    archetypes: ['A4'],
    signals: ['WC_MISSING_WEBSITE', 'EF_ZERO_INDEXED_PRESENCE'],
    subject: 'quick question about your website',
    body: `{{salutation}} I went looking for your website earlier and had a hard time finding one — or if it's there, it's not showing up where customers would expect.

Totally normal for a lot of great local shops.

But it means a chunk of people checking you out online just stop looking the moment they can't find one — customers you'd otherwise have walking in the door.

I do simple storefront website builds for shops like yours — nothing fancy, just something that shows up, loads fast, shows off what you carry, and gets people in.

Want me to sketch out what that could look like for you, no obligation?

-- {{sender_name}}`,
    shape: {
      score_hook: 'Hard time finding your website — or it\'s not showing up where customers expect',
      reassurance: 'Totally normal for a lot of great local shops.',
      quantified_upside: 'Customers stop looking the moment they can\'t find one',
      audit_offer: 'Storefront website build — shows up, loads fast, shows off what you carry',
      soft_cta: 'Want me to sketch out what that could look like, no obligation?',
    },
    phone_hook: 'I went looking for your website earlier and had a hard time finding one — or if it\'s there, it\'s not showing up where customers would expect. Totally normal for a lot of great local shops. But it means a chunk of people checking you out online just stop looking the moment they can\'t find one. I do simple storefront website builds for shops like yours — nothing fancy, just something that shows up, loads fast, shows off what you carry, and gets people in. Want me to sketch out what that could look like, no obligation?',
  },

  // 4b. website_repair — for broken website (URL exists but doesn't load)
  {
    angle: 'website_repair',
    label: 'Broken website repair',
    archetypes: ['A3', 'A4'],
    signals: ['WC_BROKEN_WEBSITE'],
    subject: 'your website link isn\'t loading',
    body: `{{salutation}} I clicked through to your website from Google earlier and hit a dead page — the link's there but it isn't loading.

Not uncommon — links break quietly and nobody notices for weeks.

But anyone who searches for you, clicks through, and hits a dead page just moves on to the next result. That's customers you'd already have walking in the door.

I can run a quick Website Health Check that pinpoints what's broken — and if it's time for a fresh start, I build simple storefront sites that load fast, show off what you carry, and actually get people in the door. Takes about a day, yours to keep either way.

Want me to send over what I found?

-- {{sender_name}}`,
    shape: {
      score_hook: 'Clicked through from Google and hit a dead page — link isn\'t loading',
      reassurance: 'Not uncommon — links break quietly and nobody notices for weeks.',
      quantified_upside: 'Anyone who clicks through and hits a dead page just moves on',
      audit_offer: 'Website Health Check + storefront site option — loads fast, shows off what you carry',
      soft_cta: 'Want me to send over what I found?',
    },
    phone_hook: 'I clicked through to your website from Google earlier and hit a dead page — the link\'s there but it isn\'t loading. Not uncommon — links break quietly and nobody notices for weeks. But anyone who searches for you, clicks through, and hits a dead page just moves on to the next result. I can run a quick Website Health Check that pinpoints what\'s broken — and if it\'s time for a fresh start, I build simple storefront sites that load fast, show off what you carry, and actually get people in the door. Takes about a day, yours to keep either way. Want me to send over what I found?',
  },

  // 5. product_category_pages
  {
    angle: 'product_category_pages',
    label: 'Product-category pages',
    archetypes: ['A6'],
    signals: ['WC_MISSING_SERVICE_PAGES', 'DS_MISSING_SERVICE_MENU'],
    subject: 'do people know everything you carry?',
    body: `{{salutation}} Love what you've got going — but I noticed there's nowhere online that actually lists what you carry.

A lot of shops don't have this yet, so you're not behind.

But it means you're leaving an easy win on the table — those exact product searches are how new customers find a shop like yours in the first place.

I can put together simple category pages that capture that search traffic.

Want me to show you a sample?

-- {{sender_name}}`,
    shape: {
      score_hook: 'Nowhere online that actually lists what you carry',
      reassurance: 'A lot of shops don\'t have this yet, so you\'re not behind.',
      quantified_upside: 'Product searches are how new customers find you',
      audit_offer: 'Simple category pages that capture search traffic',
      soft_cta: 'Want me to show you a sample?',
    },
    phone_hook: 'Love what you\'ve got going — but I noticed there\'s nowhere online that actually lists what you carry. A lot of shops don\'t have this yet, so you\'re not behind. But it means you\'re leaving an easy win on the table — those exact product searches are how new customers find a shop like yours in the first place. I can put together simple category pages that capture that search traffic. Want me to show you a sample?',
  },

  // 6. review_acquisition
  {
    angle: 'review_acquisition',
    label: 'Compliant review acquisition',
    archetypes: ['A1'],
    signals: ['RA_LOW_REVIEW_VOLUME', 'RA_REVIEW_DROUGHT'],
    subject: 'noticed you don\'t have many reviews up yet',
    body: `{{salutation}} I checked your online reviews and noticed there aren't many up yet.

Usually that just means happy customers haven't been asked — not that they're not out there.

Reviews are honestly one of the fastest ways for a shop like yours to build trust with new customers fast, before they've ever walked in.

I've got a simple, fully compliant system for gently asking satisfied customers to leave one.

Want me to walk you through how it works?

-- {{sender_name}}`,
    shape: {
      score_hook: 'Not many reviews up yet',
      reassurance: 'Usually just means happy customers haven\'t been asked.',
      quantified_upside: 'One of the fastest ways to build trust with new customers',
      audit_offer: 'Compliant system for gently asking satisfied customers',
      soft_cta: 'Want me to walk you through how it works?',
    },
    phone_hook: 'I checked your online reviews and noticed there aren\'t many up yet. Usually that just means happy customers haven\'t been asked — not that they\'re not out there. Reviews are honestly one of the fastest ways for a shop like yours to build trust with new customers fast, before they\'ve ever walked in. I\'ve got a simple, fully compliant system for gently asking satisfied customers to leave one. Want me to walk you through how it works?',
  },

  // 7. testimonial_amplification
  {
    angle: 'testimonial_amplification',
    label: 'Trust and testimonial amplification',
    archetypes: ['A1', 'A2'],
    signals: ['RA_UNADDRESSED_POSITIVE_BACKLOG'],
    subject: 'you\'ve got fans and nobody knows it',
    body: `{{salutation}} From what I found, people genuinely love your shop — good word of mouth, a few glowing mentions here and there.

Problem is, none of that is showing up where new customers are looking first.

That kind of trust is hard to earn and easy to waste if it's invisible — a little visibility here goes a long way toward turning regulars' good word into new faces in the door.

I put together simple Testimonial Amplification packages that take the praise you're already earning and put it front and center online.

Want me to show you what that'd look like?

-- {{sender_name}}`,
    shape: {
      score_hook: 'People genuinely love your shop — good word of mouth',
      reassurance: 'Trust is hard to earn and easy to waste if it\'s invisible.',
      quantified_upside: 'Turns regulars\' good word into new faces in the door',
      audit_offer: 'Testimonial Amplification packages — put praise front and center',
      soft_cta: 'Want me to show you what that\'d look like?',
    },
    phone_hook: 'From what I found, people genuinely love your shop — good word of mouth, a few glowing mentions here and there. Problem is, none of that is showing up where new customers are looking first. That kind of trust is hard to earn and easy to waste if it\'s invisible. I put together simple Testimonial Amplification packages that take the praise you\'re already earning and put it front and center online. Want me to show you what that\'d look like?',
  },

  // 8. local_seo
  {
    angle: 'local_seo',
    label: 'Local SEO',
    archetypes: ['A5', 'A6'],
    signals: ['RA_LOW_REVIEW_VOLUME', 'DS_MISSING_PROFILE'],
    subject: 'a quick look at how easy you are to find',
    body: `{{salutation}} I did a quick search for {{category}} near me in {{city}} and your shop wasn't showing up on the first page.

Pretty common for shops that haven't had any SEO work done — nothing to worry about.

But it likely means you're missing a good chunk of nearby customers who are actively looking for exactly what you sell.

I run quick Local SEO Audits that show exactly what's holding you back and what to fix first.

Want me to send mine over?

-- {{sender_name}}`,
    shape: {
      score_hook: 'Shop wasn\'t showing up on the first page for a local search',
      reassurance: 'Pretty common for shops that haven\'t had any SEO work done.',
      quantified_upside: 'Missing nearby customers actively looking for what you sell',
      audit_offer: 'Local SEO Audit — shows what\'s holding you back',
      soft_cta: 'Want me to send mine over?',
    },
    phone_hook: 'I did a quick search for {{category}} near me in {{city}} and your shop wasn\'t showing up on the first page. Pretty common for shops that haven\'t had any SEO work done — nothing to worry about. But it likely means you\'re missing a good chunk of nearby customers who are actively looking for exactly what you sell. I run quick Local SEO Audits that show exactly what\'s holding you back and what to fix first. Want me to send mine over?',
  },

  // 9. cross_platform_expansion
  {
    angle: 'cross_platform_expansion',
    label: 'Cross-platform profile expansion',
    archetypes: ['A3', 'A5'],
    signals: ['DS_MISSING_PROFILE'],
    subject: 'you\'re on Google — but that might be it',
    body: `{{salutation}} Looked you up and found you on one platform, but not much beyond that — Yelp, Facebook, Nextdoor, that sort of thing.

Totally normal starting point.

But each of those is a different door customers walk through to find you — and right now a few of those doors are closed to people who'd otherwise find you there first.

I can map out exactly which platforms would matter most for a shop like yours and get you set up.

Want me to send the list?

-- {{sender_name}}`,
    shape: {
      score_hook: 'On one platform, but not much beyond that',
      reassurance: 'Totally normal starting point.',
      quantified_upside: 'Each platform is a different door customers walk through',
      audit_offer: 'Map out which platforms matter most and get you set up',
      soft_cta: 'Want me to send the list?',
    },
    phone_hook: 'Looked you up and found you on one platform, but not much beyond that — Yelp, Facebook, Nextdoor, that sort of thing. Totally normal starting point. But each of those is a different door customers walk through to find you — and right now a few of those doors are closed to people who\'d otherwise find you there first. I can map out exactly which platforms would matter most for a shop like yours and get you set up. Want me to send the list?',
  },

  // 10. photo_content_setup
  {
    angle: 'photo_content_setup',
    label: 'Photo and storefront-content setup',
    archetypes: ['A6'],
    signals: ['DS_PHOTO_DEFICIT', 'VP_MISSING_PROJECT_PHOTOS'],
    subject: 'your listing could use a few more photos',
    body: `{{salutation}} Noticed your online listings are pretty light on photos — maybe none at all.

Really common, but customers lean on photos hard when deciding whether to try a new shop, especially a specialty one.

A few good shots of the shelves and storefront can be the difference between a scroll-past and someone deciding you're worth the drive.

I can put together a simple photo/content setup plan — what to shoot, where it goes — that takes almost no time on your end.

Want me to send it over?

-- {{sender_name}}`,
    shape: {
      score_hook: 'Listings are pretty light on photos — maybe none at all',
      reassurance: 'Really common.',
      quantified_upside: 'Photos can be the difference between a scroll-past and a visit',
      audit_offer: 'Photo/content setup plan — what to shoot, where it goes',
      soft_cta: 'Want me to send it over?',
    },
    phone_hook: 'Noticed your online listings are pretty light on photos — maybe none at all. Really common, but customers lean on photos hard when deciding whether to try a new shop, especially a specialty one. A few good shots of the shelves and storefront can be the difference between a scroll-past and someone deciding you\'re worth the drive. I can put together a simple photo/content setup plan — what to shoot, where it goes — that takes almost no time on your end. Want me to send it over?',
  },

  // 11. click_to_call
  {
    angle: 'click_to_call',
    label: 'Mobile click-to-call optimization',
    archetypes: ['A4'],
    signals: ['WC_MOBILE_FRICTION', 'WC_MISSING_CTA'],
    subject: 'quick test on your listing from my phone',
    body: `{{salutation}} I tried calling your shop straight from your Google listing on my phone, and it wasn't a one-tap call — had to dig for the number.

Small thing, honestly.

But on mobile, that little bit of friction is often the difference between a customer calling right then and just giving up and moving on to the next result.

I can do a quick Click-to-Call Audit across your listings and site to fix that. Takes about a day, yours to keep.

Want me to send it?

-- {{sender_name}}`,
    shape: {
      score_hook: 'Wasn\'t a one-tap call from the Google listing on mobile',
      reassurance: 'Small thing, honestly.',
      quantified_upside: 'Mobile friction is often the difference between a call and giving up',
      audit_offer: 'Click-to-Call Audit — takes about a day, yours to keep',
      soft_cta: 'Want me to send it?',
    },
    phone_hook: 'I tried calling your shop straight from your Google listing on my phone, and it wasn\'t a one-tap call — had to dig for the number. Small thing, honestly. But on mobile, that little bit of friction is often the difference between a customer calling right then and just giving up and moving on to the next result. I can do a quick Click-to-Call Audit across your listings and site to fix that. Want me to send it?',
  },

  // 12. reputation_monitoring
  {
    angle: 'reputation_monitoring',
    label: 'Reputation monitoring',
    archetypes: ['A1', 'A2'],
    signals: ['RA_UNANSWERED_COMPLAINTS', 'VP_STALE_SOCIAL_ACTIVITY'],
    subject: 'who\'s watching your reviews?',
    body: `{{salutation}} Quick question — is anyone keeping an eye on new reviews as they come in across your listings?

A lot of shop owners are heads-down running the business and miss them for weeks at a time.

That's an easy fix, but an unanswered bad review sitting there for a month can quietly cost you customers who never even mention it — they just move on.

I offer a simple Reputation Monitoring setup so you get notified right away and never miss a chance to respond.

Want me to show you how it'd work for your shop?

-- {{sender_name}}`,
    shape: {
      score_hook: 'Is anyone keeping an eye on new reviews as they come in?',
      reassurance: 'A lot of shop owners miss them for weeks at a time.',
      quantified_upside: 'An unanswered bad review can quietly cost you customers',
      audit_offer: 'Reputation Monitoring setup — notified right away',
      soft_cta: 'Want me to show you how it\'d work for your shop?',
    },
    phone_hook: 'Quick question — is anyone keeping an eye on new reviews as they come in across your listings? A lot of shop owners are heads-down running the business and miss them for weeks at a time. That\'s an easy fix, but an unanswered bad review sitting there for a month can quietly cost you customers who never even mention it — they just move on. I offer a simple Reputation Monitoring setup so you get notified right away and never miss a chance to respond. Want me to show you how it\'d work for your shop?',
  },

  // 13. zero_footprint — "no usable footprint found at all"
  {
    angle: 'zero_footprint',
    label: 'Zero footprint — no online presence found',
    archetypes: ['A3', 'A4'],
    signals: ['WC_MISSING_WEBSITE', 'DS_MISSING_PROFILE', 'CP_MISSING_CONTACT_INFO', 'EF_ZERO_INDEXED_PRESENCE', 'DS_ZERO_INDEXED_PRESENCE'],
    subject: 'couldn\'t find you online at all',
    body: `{{salutation}} I went looking for {{business}} online — Google, your own website, the usual places — and honestly couldn't find much of anything.

Not a knock on what you do — a lot of great local shops just never had a reason to be online before now.

But it means when someone searches for {{category}} in {{city}}, you're invisible to them — they find your competitors instead, even if you're the better choice.

I can put together a quick Online Footprint Audit that shows exactly what's missing and where to start. Takes about a day, yours to keep.

Want me to send it over?

-- {{sender_name}}`,
    shape: {
      score_hook: 'Couldn\'t find you online at all',
      reassurance: 'A lot of great local shops just never had a reason to be online.',
      quantified_upside: 'When someone searches, you\'re invisible — they find competitors instead',
      audit_offer: 'Online Footprint Audit — shows what\'s missing and where to start',
      soft_cta: 'Want me to send it over?',
    },
    phone_hook: 'I went looking for {{business}} online — Google, your own website, the usual places — and honestly couldn\'t find much of anything. Not a knock on what you do — a lot of great local shops just never had a reason to be online before now. But it means when someone searches for {{category}} in {{city}}, you\'re invisible to them — they find your competitors instead, even if you\'re the better choice. I can put together a quick Online Footprint Audit that shows exactly what\'s missing and where to start. Want me to send it over?',
  },
];

// ─── Lookup helpers ─────────────────────────────────────────────────────

const HOOK_BY_ANGLE = new Map<HookAngle, HookTemplate>(
  HOOK_LIBRARY.map((h) => [h.angle, h]),
);

/**
 * Get a hook template by angle. Returns undefined for unknown angles.
 */
export function getHook(angle: HookAngle): HookTemplate | undefined {
  return HOOK_BY_ANGLE.get(angle);
}

/**
 * All valid hook angle keys (for Zod validation + attribution).
 */
export const HOOK_ANGLE_KEYS: readonly HookAngle[] = HOOK_LIBRARY.map((h) => h.angle);

/**
 * Check whether a string is a valid HookAngle.
 */
export function isValidHookAngle(s: string): s is HookAngle {
  return HOOK_BY_ANGLE.has(s as HookAngle);
}

// ─── Cold-call script fixed stages ──────────────────────────────────────
//
// The cold-call script has five fixed stages: Verify → Hook → Bridge →
// Ask → Close. Only Stage 2 (the Hook) varies per angle — it comes from
// the `phone_hook` field on each HookTemplate. Stages 1, 3, 4, and 5 are
// code-defined constants that never change per campaign (the script's
// core scaling claim).
//
// Phone merge placeholders (not the email set — no {{salutation}}):
//   {{business}}       — campaign business_name (required for Stage 1)
//   {{address}}        — formatted from address_line1/city/state
//   {{category}}       — campaign service_category, lowercased
//   {{city}}           — campaign city
//   {{operator_name}}  — assigned operator display name

export const CALL_SCRIPT_VERIFY = `Hi, is this {{business}}? … Great, am I speaking with the owner or manager?`;

export const CALL_SCRIPT_BRIDGE = `The reason I'm calling — I work with {{category}} businesses in {{city}} on their online presence. I noticed something specific about yours that's costing you customers, and I wanted to walk you through it.`;

export const CALL_SCRIPT_ASK = `I've put together a quick rundown of exactly what I found — the gaps, what they're costing you, and what to fix first. I can send it over today, no cost, yours to keep either way. What's the best email to send it to?`;

export const CALL_SCRIPT_ASK_DECLINE_FALLBACK = `No problem — I can leave my number and you can text me if you want it later.`;

export const CALL_SCRIPT_CLOSE = `Either way, the rundown is yours whenever you want it. Thanks for your time — {{operator_name}}.`;

// ─── Objection table ────────────────────────────────────────────────────
//
// The five objection/response rows from the operator script. Code-defined,
// never changes per campaign. Rendered as an accordion in the Call Script
// panel.

export interface ObjectionRow {
  objection: string;
  response: string;
}

export const CALL_SCRIPT_OBJECTIONS: ObjectionRow[] = [
  {
    objection: 'I\'m not interested',
    response: 'Totally fair — can I ask, is that because you\'ve already got someone handling your online presence, or because it\'s just not a priority right now?',
  },
  {
    objection: 'I don\'t have time for this',
    response: 'I hear you — this literally takes two minutes and I\'m done. The rundown I send takes me about a day to put together, and you can look at it whenever you have time. What\'s the best email?',
  },
  {
    objection: 'How much does this cost?',
    response: 'The rundown itself is free — I send it, you look at it, and if anything in it is useful, we can talk about what it would take to fix. No obligation either way. What\'s the best email?',
  },
  {
    objection: 'I already have a website / SEO guy',
    response: 'Good to hear — then the rundown will show you exactly what they\'re covering well and where the gaps still are. It\'s still free and yours to keep. What\'s the best email?',
  },
  {
    objection: 'Just send me an email',
    response: 'Will do — what\'s the best address? And if you have a minute later, I\'d love to walk you through the one or two things that stood out most.',
  },
];
