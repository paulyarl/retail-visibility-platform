/**
 * Hook Library — Server-side starter hook catalog (Light-Score Hooks)
 *
 * Code-defined, typed catalog of first-touch hook angles, each
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
 * The `zero_footprint` angle covers the "no usable footprint found at all"
 * case from the cold-call script's `EF_ZERO_INDEXED_PRESENCE` row; the
 * `availability_inquiry` angle covers `WC_MISSING_AVAILABILITY_INQUIRY`
 * (no stock-check channel — the WhatsApp/availability upsell play).
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
  | 'third_party_presence'
  // Website OFFERING angles (platform product-led, not gap-led) — the pitch
  // sells the platform's website capabilities: package tiers, ecommerce,
  // scaling, visibility. Spec: WEBSITE_GAP_AUDIT_PLAYBOOK_SPEC (angles).
  | 'website_tiers'
  | 'website_ecommerce'
  | 'website_scaling'
  | 'website_visibility'
  // Repair OFFERING angles (platform product-led) — the pitch sells the
  // repair playbook's capabilities: claim service, phased/tiered repair
  // (incl. done-for-you), and ongoing listing monitoring.
  | 'profile_claim_service'
  | 'repair_tiers'
  | 'listing_monitoring'
  | 'product_category_pages'
  | 'availability_inquiry'
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
  /**
   * Canonical signal-weight platform keys this angle delivers on
   * (google, yelp, facebook, apple, bbb, …). Feeds the platform-priority
   * ranking boost (CATEGORY_PLATFORM_SIGNAL_WEIGHT_SPEC §2): a hook whose
   * platform carries a high signal_weight × gap_severity score outranks
   * one on a low-scoring platform at equal signal severity — when two
   * platforms need repair, the pitch leads where the customers are.
   * Omit for website-side or channel-agnostic angles (website is not a
   * signal-weighted platform).
   */
  platforms?: string[];
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
    signals: ['DS_CLAIMED_STATUS', 'DS_MISSING_SERVICE_MENU', 'DS_OUTDATED_HOURS', 'DS_PHOTO_DEFICIT', 'DS_BROKEN_PROFILE_LINK', 'DS_OUTDATED_HOLIDAY_HOURS'],
    platforms: ['google'],
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
    signals: ['CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT', 'WC_URL_MISMATCH'],
    // NAP normalization fixes drift on every directory — score against the
    // strongest weighted platform so it tracks wherever the gap matters most.
    platforms: ['google', 'yelp', 'facebook', 'apple', 'bbb'],
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
    signals: ['DS_OUTDATED_HOURS', 'DS_OUTDATED_HOLIDAY_HOURS'],
    platforms: ['google', 'yelp', 'facebook'],
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
    archetypes: ['A4', 'A7'],
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
    archetypes: ['A3', 'A4', 'A7'],
    signals: [
      'WC_BROKEN_WEBSITE', 'WC_UNSECURED_WEBSITE', 'WC_LEGACY_BUILDER_SITE',
      'WC_STALE_WEBSITE', 'WC_POOR_SITE_QUALITY', 'WC_CATEGORY_MISMATCH',
    ],
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

  // 4c. third_party_presence — the website field is a social page / free
  //     builder subdomain / parked or unfinished domain (no owned site).
  {
    angle: 'third_party_presence',
    label: 'Web presence is a social page or free subdomain',
    archetypes: ['A7'],
    signals: ['WC_THIRD_PARTY_DOMAIN', 'WC_BUILDER_SUBDOMAIN', 'WC_PARKED_DOMAIN', 'WC_UNFINISHED_SITE'],
    subject: 'your website is a Facebook page',
    body: `{{salutation}} I went looking for your website and what I found was a social page standing in for one — nothing a customer can land on that actually looks like your business.

Totally normal for a lot of great local shops.

But when someone searches for {{category}} in {{city}} and the only thing that comes up is a social page, a chunk of them just keep scrolling to the next result — customers you'd otherwise have walking in the door.

I do simple storefront websites for shops like yours — nothing fancy, just something that shows up under your own name, loads fast, shows off what you carry, and gets people in.

Want me to sketch out what that could look like, no obligation?

-- {{sender_name}}`,
    shape: {
      score_hook: 'What I found was a social page standing in for a website',
      reassurance: 'Totally normal for a lot of great local shops.',
      quantified_upside: 'Customers keep scrolling to the next result when there is no real site',
      audit_offer: 'Simple storefront website build — your own name, loads fast, shows what you carry',
      soft_cta: 'Want me to sketch out what that could look like, no obligation?',
    },
    phone_hook: 'I went looking for your website and what I found was a social page standing in for one — nothing a customer can land on that actually looks like your business. Totally normal for a lot of great local shops. But when someone searches for {{category}} in {{city}} and the only thing that comes up is a social page, a chunk of them just keep scrolling to the next result. I do simple storefront websites for shops like yours — nothing fancy, just something that shows up under your own name, loads fast, shows off what you carry, and gets people in. Want me to sketch out what that could look like, no obligation?',
  },

  // 4d. website_tiers — platform OFFERING angle: package tiers, start simple
  //     and grow. Not a gap pitch — a "you don't have to build it all at once"
  //     angle that sells the tiered build.
  {
    angle: 'website_tiers',
    label: 'Website packages — start simple, scale up',
    archetypes: ['A7', 'A4'],
    signals: ['WC_MISSING_WEBSITE', 'WC_THIRD_PARTY_DOMAIN', 'WC_BUILDER_SUBDOMAIN', 'WC_POOR_SITE_QUALITY'],
    subject: 'you don\'t have to build the whole site at once',
    body: `{{salutation}} Quick thought on the website side — a lot of owners figure a real site means a big, expensive project, so it keeps getting pushed to "someday."

It really doesn't have to work that way.

We build these in tiers — you start with the pages that win you customers right now (services, hours, a way to get in touch), then add the rest — ordering, booking, more pages — only when it's earning its keep. Nothing big up front.

I can put together what the first tier would look like for {{business}}, no obligation.

Want me to send it over?

-- {{sender_name}}`,
    shape: {
      score_hook: 'A lot of owners figure a real site means a big, expensive project',
      reassurance: 'It really doesn\'t have to work that way.',
      quantified_upside: 'Start with the pages that win customers now, add the rest when it\'s earning',
      audit_offer: 'What the first tier would look like for {{business}} — no obligation',
      soft_cta: 'Want me to send it over?',
    },
    phone_hook: 'Quick thought on the website side — a lot of owners figure a real site means a big, expensive project, so it keeps getting pushed to "someday." It really doesn\'t have to work that way. We build these in tiers — you start with the pages that win you customers right now, then add the rest only when it\'s earning its keep. I can put together what the first tier would look like for {{business}}, no obligation. Want me to send it over?',
  },

  // 4e. website_ecommerce — platform OFFERING angle: ecommerce options.
  {
    angle: 'website_ecommerce',
    label: 'Selling online — ecommerce options',
    archetypes: ['A7', 'A6'],
    signals: ['WC_MISSING_PRODUCT_BROWSING', 'DS_MISSING_PRODUCT_CATALOG', 'WC_MISSING_WEBSITE', 'WC_THIRD_PARTY_DOMAIN'],
    subject: 'just get found, or actually sell online?',
    body: `{{salutation}} One thing I hear a lot from shops like yours — "I don't need a website, my customers just come in."

Fair enough, and that works great right up until someone wants to buy from you at 9pm, or from two towns over.

The good news is you don't have to pick one. We can start with a simple site that shows what you carry, then switch on ordering or checkout later — only once it's actually bringing in sales.

Want me to sketch what selling online could look like for {{business}}?

-- {{sender_name}}`,
    shape: {
      score_hook: '"I don\'t need a website, my customers just come in"',
      reassurance: 'That works great — right up until someone wants to buy at 9pm.',
      quantified_upside: 'You don\'t have to pick one: get found now, switch on checkout when it pays',
      audit_offer: 'Sketch what selling online could look like for {{business}}',
      soft_cta: 'Want me to sketch it out?',
    },
    phone_hook: 'One thing I hear a lot from shops like yours — "I don\'t need a website, my customers just come in." Fair enough, and that works great right up until someone wants to buy from you at 9pm, or from two towns over. The good news is you don\'t have to pick one. We can start with a simple site that shows what you carry, then switch on ordering or checkout later, only once it\'s bringing in sales. Want me to sketch what selling online could look like for {{business}}?',
  },

  // 4f. website_scaling — platform OFFERING angle: a site that grows with you.
  {
    angle: 'website_scaling',
    label: 'A site that grows with the business',
    archetypes: ['A7'],
    signals: ['WC_MISSING_WEBSITE', 'WC_POOR_SITE_QUALITY', 'WC_STALE_WEBSITE', 'WC_LEGACY_BUILDER_SITE'],
    subject: 'a site you won\'t have to redo next year',
    body: `{{salutation}} Most of the shop sites I come across were built once, years ago, and never touched since — so they slowly fall out of date.

That's the trap with a one-and-done build.

We build yours so it can grow with you: add a page when you add a service, update your hours without calling a developer, turn on booking or ordering when you're ready. No full redo in a year.

Want me to show you what that looks like for {{business}}?

-- {{sender_name}}`,
    shape: {
      score_hook: 'Built once years ago and never touched since',
      reassurance: 'That\'s the trap with a one-and-done build.',
      quantified_upside: 'Add pages, hours, booking as you grow — no full redo in a year',
      audit_offer: 'Show what a grow-with-you build looks like for {{business}}',
      soft_cta: 'Want me to show you?',
    },
    phone_hook: 'Most of the shop sites I come across were built once, years ago, and never touched since — so they slowly fall out of date. That\'s the trap with a one-and-done build. We build yours so it can grow with you: add a page when you add a service, update your hours without calling a developer, turn on booking or ordering when you\'re ready. No full redo in a year. Want me to show you what that looks like for {{business}}?',
  },

  // 4g. website_visibility — platform OFFERING angle: get found for what you
  //     sell (site-side discoverability, distinct from local_seo's listing/GBP
  //     optimization).
  {
    angle: 'website_visibility',
    label: 'Website visibility — get found for what you sell',
    archetypes: ['A7', 'A4'],
    signals: ['WC_MISSING_SERVICE_PAGES', 'WC_MISSING_WEBSITE', 'WC_POOR_SITE_QUALITY', 'WC_CATEGORY_MISMATCH'],
    subject: 'the pages that actually get you found',
    body: `{{salutation}} Here's what most shop sites miss: they've got a homepage and a contact page, and that's about it — so search engines have nothing to rank you for.

The sites that get found have a page for each thing people actually search. One for "same-day tire repair," one for "emergency plumbing in {{city}}" — that kind of thing. Those pages do the finding for you.

I can map out the handful of pages that would move the needle for {{business}}, and what each one needs to say.

Want me to send it over?

-- {{sender_name}}`,
    shape: {
      score_hook: 'A homepage and a contact page — and nothing to rank you for',
      reassurance: 'Here\'s what most shop sites miss.',
      quantified_upside: 'One page per thing people search does the finding for you',
      audit_offer: 'Map the handful of pages that would move the needle for {{business}}',
      soft_cta: 'Want me to send it over?',
    },
    phone_hook: 'Here\'s what most shop sites miss: they\'ve got a homepage and a contact page, and that\'s about it — so search engines have nothing to rank you for. The sites that get found have a page for each thing people actually search. One for "same-day tire repair," one for "emergency plumbing in {{city}}" — that kind of thing. Those pages do the finding for you. I can map out the handful of pages that would move the needle for {{business}}, and what each one needs to say. Want me to send it over?',
  },

  // 4h. profile_claim_service — repair OFFERING angle: claim & verify the
  //     listing. Not a drift pitch — sells the claim/verification service.
  {
    angle: 'profile_claim_service',
    label: 'Claim & verify your listing',
    archetypes: ['A3', 'A5'],
    signals: ['DS_CLAIMED_STATUS', 'DS_MISSING_PROFILE'],
    platforms: ['google'],
    subject: 'your Google listing isn\'t claimed yet',
    body: `{{salutation}} Quick one — I noticed your Google listing isn't claimed, which means anyone can suggest edits to it (and a couple of the directories already disagree with each other).

Happens all the time, and it's an easy fix.

An unclaimed listing is the one customers see first, and right now nobody's steering it — so your hours, photos, and category are whatever Google guessed.

I can walk you through claiming it in about ten minutes, or just do it for you if you'd rather hand it off.

Want me to send the steps?

-- {{sender_name}}`,
    shape: {
      score_hook: 'Your Google listing isn\'t claimed — anyone can suggest edits',
      reassurance: 'Happens all the time, and it\'s an easy fix.',
      quantified_upside: 'The listing customers see first is running on Google\'s guesses',
      audit_offer: 'Claim it in ~10 minutes — or we do it for you',
      soft_cta: 'Want me to send the steps?',
    },
    phone_hook: 'Quick one — I noticed your Google listing isn\'t claimed, which means anyone can suggest edits to it, and a couple of the directories already disagree with each other. Happens all the time, and it\'s an easy fix. An unclaimed listing is the one customers see first, and right now nobody\'s steering it. I can walk you through claiming it in about ten minutes, or just do it for you. Want me to send the steps?',
  },

  // 4i. repair_tiers — repair OFFERING angle: phased/tiered repair, incl. DFY.
  {
    angle: 'repair_tiers',
    label: 'Repair packages — fix the worst first, in phases',
    archetypes: ['A3', 'A5'],
    signals: ['CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT', 'DS_BROKEN_PROFILE_LINK', 'DS_CLAIMED_STATUS'],
    platforms: ['google', 'yelp', 'facebook', 'apple', 'bbb'],
    subject: 'you don\'t have to fix all of it at once',
    body: `{{salutation}} I pulled up your listings and a few things are off — the name and phone don't match everywhere, and one of your profile links is dead.

Good news: you don't have to fix all of it in one go.

We work these in phases — the single issue costing you the most customers first (usually the phone number, since that's what people act on), then the rest. And if you'd rather not touch it at all, we can do the fixes for you and just show you the before-and-after.

Want me to send the priority list?

-- {{sender_name}}`,
    shape: {
      score_hook: 'Name and phone don\'t match everywhere, and one link is dead',
      reassurance: 'You don\'t have to fix all of it in one go.',
      quantified_upside: 'Fix the issue costing you the most customers first, phase the rest',
      audit_offer: 'Priority list of what to fix first — or we handle it for you',
      soft_cta: 'Want me to send the priority list?',
    },
    phone_hook: 'I pulled up your listings and a few things are off — the name and phone don\'t match everywhere, and one of your profile links is dead. Good news: you don\'t have to fix all of it in one go. We work these in phases, the issue costing you the most customers first, usually the phone number, then the rest. And if you\'d rather not touch it at all, we can do the fixes for you. Want me to send the priority list?',
  },

  // 4j. listing_monitoring — repair OFFERING angle: ongoing sync retainer.
  {
    angle: 'listing_monitoring',
    label: 'Listing monitoring — keep it from drifting again',
    archetypes: ['A3', 'A5'],
    signals: ['CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT', 'DS_OUTDATED_HOURS', 'DS_OUTDATED_HOLIDAY_HOURS'],
    platforms: ['google', 'yelp', 'facebook', 'apple', 'bbb'],
    subject: 'who keeps your listings in sync?',
    body: `{{salutation}} Quick question — once your listings are cleaned up, who keeps them that way?

Most owners fix the drift once and then it quietly comes back: a new directory scrapes an old phone number, someone edits your hours, a listing goes stale.

We re-check yours on a schedule and catch it before a customer ever sees it — so you're not back here in six months.

Want me to show you what the monitoring covers?

-- {{sender_name}}`,
    shape: {
      score_hook: 'Once your listings are cleaned up, who keeps them that way?',
      reassurance: 'Most owners fix the drift once — then it quietly comes back.',
      quantified_upside: 'We catch new drift before a customer sees it',
      audit_offer: 'Show what the listing monitoring covers',
      soft_cta: 'Want me to show you?',
    },
    phone_hook: 'Quick question — once your listings are cleaned up, who keeps them that way? Most owners fix the drift once and then it quietly comes back: a new directory scrapes an old phone number, someone edits your hours, a listing goes stale. We re-check yours on a schedule and catch it before a customer ever sees it, so you\'re not back here in six months. Want me to show you what the monitoring covers?',
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

  // 5b. availability_inquiry — no stock-check channel (WC_MISSING_AVAILABILITY_INQUIRY)
  {
    angle: 'availability_inquiry',
    label: 'Stock / availability inquiry channel',
    archetypes: ['A6', 'A4'],
    signals: ['WC_MISSING_AVAILABILITY_INQUIRY'],
    subject: 'can customers check if you have it in stock?',
    body: `{{salutation}} I was looking at {{category}} shops in {{city}} and noticed yours has no way for a customer to check if something's in stock before coming in — no text line, no WhatsApp, no quick form.

That's the norm for local shops, so you're not behind.

But "do you have it?" is the question that decides whether someone drives over or orders from somewhere that answers instantly. For shops like yours, a simple WhatsApp or text line is usually the highest-converting answer — customers ask, you reply, they come in.

I put together a quick Availability Channel audit — it shows where that question goes today and the lowest-friction way to answer it.

Want me to send it over?

-- {{sender_name}}`,
    shape: {
      score_hook: 'No way for customers to check if something is in stock',
      reassurance: 'That\'s the norm for local shops, so you\'re not behind.',
      quantified_upside: '"Do you have it?" decides whether they drive over or order elsewhere',
      audit_offer: 'Availability Channel audit + WhatsApp inquiry line setup',
      soft_cta: 'Want me to send it over?',
    },
    phone_hook: `I was looking at {{category}} shops in {{city}} and noticed yours has no way for a customer to check if something's in stock before coming in — no text line, no WhatsApp, no quick form. That's the norm for local shops, so you're not behind. But "do you have it?" is the question that decides whether someone drives over or orders from somewhere that answers instantly. For shops like yours, a simple WhatsApp or text line is usually the highest-converting answer. I put together a quick Availability Channel audit — it shows where that question goes today and the lowest-friction way to answer it. Want me to send it over?`,
  },

  // 6. review_acquisition
  {
    angle: 'review_acquisition',
    label: 'Compliant review acquisition',
    archetypes: ['A1'],
    signals: ['RA_LOW_REVIEW_VOLUME', 'RA_REVIEW_DROUGHT'],
    platforms: ['google', 'yelp', 'facebook'],
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
    platforms: ['google', 'yelp', 'facebook'],
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
    platforms: ['google'],
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
    signals: ['DS_MISSING_PROFILE', 'DS_BROKEN_PROFILE_LINK'],
    // Expansion lands on whichever weighted platforms the business is
    // missing — score across the full directory set so the boost follows
    // the highest weight × gap surface.
    platforms: ['google', 'yelp', 'facebook', 'apple', 'bbb', 'nextdoor'],
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
    platforms: ['google', 'yelp', 'facebook'],
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
    platforms: ['google'],
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
    platforms: ['google', 'yelp', 'facebook', 'bbb'],
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
    platforms: ['google', 'yelp', 'facebook', 'apple', 'bbb'],
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

// ─── Website-playbook objection table (PB-08 / A7) ───────────────────────
//
// The website call has its own live objections — "I don't need a website",
// "I already have one", "too expensive", "I don't want an online store",
// "no time". The responses lean on the platform's website OFFERINGS
// (tiered builds, optional ecommerce, grow-with-you, done-for-you) rather
// than a generic "the rundown is free" — this is where the offering angles
// win the call. Prepended for A7 campaigns so the operator sees the
// on-point rebuttals first, then the generic five.
export const WEBSITE_CALL_SCRIPT_OBJECTIONS: ObjectionRow[] = [
  {
    objection: 'I don\'t need a website — my customers just walk in',
    response: 'Totally fair, and a lot of my best clients said the same thing. The catch is the people who *don\'t* know you yet search first — and right now they\'re finding someone else. It\'s smaller than most owners expect to fix. Want me to send what the first tier would look like?',
  },
  {
    objection: 'I already have a website',
    response: 'Good — then this is really about whether it\'s still working for you. Most of the ones I come across were built years ago and never touched since, so they quietly fall behind. The rundown shows what\'s missing and what a refresh would take — yours to keep either way.',
  },
  {
    objection: 'I can\'t afford a new website right now',
    response: 'That\'s exactly why we build these in tiers — you start with the pages that bring in customers now, and add the rest only when it\'s earning its keep. Nothing big up front. Want me to send what the first tier would look like?',
  },
  {
    objection: 'I don\'t sell online / I don\'t want an online store',
    response: 'You don\'t have to — we can keep it to a simple site that shows what you carry and how to reach you. If you ever want to switch ordering on later, it\'s a switch, not a rebuild.',
  },
  {
    objection: 'I don\'t have time to deal with a website',
    response: 'That\'s the whole point — you shouldn\'t have to. We handle the build; you give us the basics once, and we take it from there. Two minutes today is honestly about it.',
  },
];

// ─── Repair-playbook objection table (PB-01 / PB-05 / PB-06 — A3 / A5) ───
//
// The listing-repair call has its own objections — "my listing's fine",
// "I already have someone", "I don't want to give access", "I'll fix it
// myself", "isn't that Google's job?". The responses lean on the repair
// OFFERINGS (claim service, phased/tiered repair, done-for-you delegated
// access, monitoring) rather than a generic "the rundown is free".
// Prepended for A3/A5 campaigns.
export const REPAIR_CALL_SCRIPT_OBJECTIONS: ObjectionRow[] = [
  {
    objection: 'My listing\'s fine — I already checked it',
    response: 'It usually looks right on Google — that\'s the one everyone checks. The drift tends to show up on the other directories people use, and that\'s where customers get the wrong number. The rundown maps each one, worst first. Yours to keep either way.',
  },
  {
    objection: 'I already have someone handling this',
    response: 'Good — then the rundown will show you exactly what they\'re covering and where the gaps still are. It\'s still free, and it\'s yours to keep.',
  },
  {
    objection: 'I don\'t want to give anyone access to my profile',
    response: 'You don\'t have to. We start with what\'s public — no access needed to show you what\'s wrong. And if you ever want us to make the fixes, you grant a limited manager role, never a password.',
  },
  {
    objection: 'I\'ll just fix it myself',
    response: 'Honestly, you can — the rundown gives you the exact list, worst first. If it turns into a weekend of directory logins, that\'s where we can just do it for you.',
  },
  {
    objection: 'Isn\'t that Google\'s job?',
    response: 'Google mostly reflects what the other directories feed it — so the fix is on the listing side, not something you can call Google about. That\'s the part we handle.',
  },
];
