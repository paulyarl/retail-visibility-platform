/**
 * Manual Play Templates — code-defined catalog for the Manual tab
 *
 * The Manual tab on the outreach openers workspace is the operator
 * playground / producer lane: the operator picks a template, edits the
 * field slots + script body, saves it per campaign
 * (mkt_campaign_manual_scripts), then promotes slots into the shared
 * pipeline rows the other tabs consume:
 *   role 'opener'  → POST /openers/import   → Pitch Construction opener list
 *   role 'header'  → importHeader           → Pitch Construction header list
 *   role 'closer'  → importCloser           → Pitch Construction closer list
 *   role 'thesis'  → createCampaignAnchor   → Call Script anchor picker
 *   role 'note'    → merge values only (embedded in script_body via {{key}})
 *
 * `suggestedWhenSignal` marks the template "suggested" in the dropdown when
 * the campaign's triage result detected that signal.
 *
 * Merge placeholders resolved at read time by ManualOutreachScriptService:
 *   {{business}} {{address}} {{category}} {{city}} {{operator_name}}
 *   {{sender_name}} (alias of operator_name) {{salutation}} {{claim_url}}
 *   {{analyst_hook}} (latest briefing/audit opener hook — Phase 2.3)
 *   plus any field key ({{observed_gap}} resolves from the field value).
 *
 * No DB access, no async, no side effects — pure data module.
 * Mirrors hook-library.ts / GalleryArchetypeDefaults.ts pattern.
 */

// ─── Types ──────────────────────────────────────────────────────────────

export type ManualFieldRole = 'opener' | 'header' | 'closer' | 'thesis' | 'note';

export interface ManualPlayField {
  /** Slot key — stored in fields jsonb, usable as {{key}} in script_body. */
  key: string;
  label: string;
  role: ManualFieldRole;
  placeholder: string;
  /** Prefill value loaded into the slot when the template is selected. */
  defaultValue: string;
}

export interface ManualPlayTemplate {
  key: string;
  label: string;
  description: string;
  /** Anchor type used when the doc is promoted to a campaign anchor. */
  anchorType: string;
  /** Hook angle stamped on openers promoted from this template (attribution). */
  hookAngle?: string;
  /** Detected signal that marks this template "suggested" in the dropdown. */
  suggestedWhenSignal?: string;
  fields: ManualPlayField[];
  scriptBody: string;
}

// ─── Catalog ────────────────────────────────────────────────────────────

export const MANUAL_PLAY_TEMPLATES: ManualPlayTemplate[] = [
  {
    key: 'whatsapp_availability_upsell',
    label: 'WhatsApp availability-check upsell',
    description:
      'Audit flagged no stock-check channel → verify the gap on the call, ' +
      'probe how stock questions arrive today, pivot to a WhatsApp inquiry ' +
      'line wired into the listing.',
    anchorType: 'customer_discovery_problem',
    hookAngle: 'availability_inquiry',
    suggestedWhenSignal: 'WC_MISSING_AVAILABILITY_INQUIRY',
    fields: [
      {
        key: 'subject',
        label: 'Subject / header',
        role: 'header',
        placeholder: 'Email subject or pitch header',
        defaultValue: 'can customers check if you have it in stock?',
      },
      {
        key: 'opener_text',
        label: 'Opener (first-touch)',
        role: 'opener',
        placeholder: 'First-touch opener text',
        defaultValue: `{{salutation}} I was looking at {{category}} shops in {{city}} and noticed yours has no way for a customer to check if something's in stock before they come in — no text line, no WhatsApp, no quick form.

That's the norm for local shops, so you're not behind. But "do you have it?" is the question that decides whether someone drives over or orders from somewhere that answers instantly.

For shops like yours, {{channel_pitch}} is usually the highest-converting answer — customers ask, you reply, they come in. I can wire it straight into your listing page.

I put together a short preview of how it would look for {{business}} — want me to send it over?

— {{sender_name}}`,
      },
      {
        key: 'closer_text',
        label: 'Closer',
        role: 'closer',
        placeholder: 'Close line / offer',
        defaultValue:
          'The availability line is a small add — we wire {{channel_pitch}} into your listing and customers get an answer before they make the trip. Want me to scope it?',
      },
      {
        key: 'operator_thesis',
        label: 'Operator thesis',
        role: 'thesis',
        placeholder: 'What this play is trying to accomplish',
        defaultValue:
          'Audit shows no availability-inquiry channel. Verify the gap with the owner, probe how stock questions arrive today, then pivot to the WhatsApp inquiry line upsell.',
      },
      {
        key: 'verification_question',
        label: 'Verification question',
        role: 'thesis',
        placeholder: 'Question that confirms the audit finding',
        defaultValue:
          'I noticed customers have no way to check if a product is in stock before coming in — no text line, no form. Is that right?',
      },
      {
        key: 'pain_question',
        label: 'Pain probe',
        role: 'thesis',
        placeholder: 'Question that surfaces the pain',
        defaultValue:
          'When someone wants to know if you have something in stock, how do they usually reach you today?',
      },
      {
        key: 'recommended_transition',
        label: 'Recommended transition',
        role: 'thesis',
        placeholder: 'Pivot from verification into the pitch',
        defaultValue:
          'That gap is exactly what I wanted to talk about — we can build an availability inquiry line into your listing so customers get an answer on WhatsApp before they make the trip.',
      },
      {
        key: 'observed_gap',
        label: 'Observed gap',
        role: 'note',
        placeholder: 'What the audit showed, in operator words',
        defaultValue:
          'no way for customers to check if a product is in stock — no text, WhatsApp, or form',
      },
      {
        key: 'channel_pitch',
        label: 'Channel pitch',
        role: 'note',
        placeholder: 'The channel you are leading with',
        defaultValue: 'a WhatsApp inquiry line',
      },
    ],
    scriptBody: `Hi, is this {{business}}? … Great, am I speaking with the owner or manager?

The reason I'm calling — I work with {{category}} businesses in {{city}} on their online presence. We ran a visibility check on {{business}} and flagged something specific: {{observed_gap}}.

Quick question — when someone wants to know if you have something in stock, how do they usually reach you today?

[If they confirm the gap]
For shops like yours, {{channel_pitch}} is the highest-converting answer — customers ask, you reply on your phone, they come in. We can build that straight into your listing page.

I can send you the report first — it shows exactly where that question goes today. What's the best email — or I can text you the link?
The report is here if you want to look now: {{report_url}} (or scan the card I left — {{qr_url_report_in_person}}).

— {{operator_name}}`,
  },
  {
    key: 'walkin_card_handoff',
    label: 'Walk-in card handoff',
    description:
      'In-person leave-behind: hand over the 4x6 claim card, point at the ' +
      'tracked QR, and log the visit. The QR records the scan before the ' +
      'owner lands on the claim page.',
    anchorType: 'customer_discovery_problem',
    hookAngle: 'nap_normalization',
    fields: [
      {
        key: 'card_line',
        label: 'Card line (spoken)',
        role: 'opener',
        placeholder: 'What you say as you hand over the card',
        defaultValue: `{{salutation}} I stopped by because I put together a free listing for {{business}} on the local {{category}} directory — address, phone, and hours from public sources. Nothing to sign up for.
If anything's off, this code goes straight to the listing so you can fix it yourself: {{qr_url_walkin}}
I'll leave the card — scan it whenever, or I can email you the report at {{report_url}}.`,
      },
      {
        key: 'leave_behind_note',
        label: 'Leave-behind note',
        role: 'note',
        placeholder: 'Note logged with the visit touch',
        defaultValue: 'Left the claim card; pointed at the tracked QR.',
      },
      {
        key: 'operator_thesis',
        label: 'Operator thesis',
        role: 'thesis',
        placeholder: 'What this play is trying to accomplish',
        defaultValue:
          'Same-town walk-in. Hand over the claim card, get the scan, log a visit touch so the cadence advances.',
      },
      {
        key: 'verification_question',
        label: 'Verification question',
        role: 'thesis',
        placeholder: 'Question that confirms the listing details',
        defaultValue: 'I have {{business}} at {{address}} — is that still the right address and phone?',
      },
      {
        key: 'recommended_transition',
        label: 'Recommended transition',
        role: 'thesis',
        placeholder: 'Pivot from verification into the report',
        defaultValue:
          'The full report shows where {{business}} appears across public sources — it is free, and the card has the code.',
      },
    ],
    scriptBody: `Hi, are you the owner of {{business}}? — I won't take your time.

I put together a free listing for {{business}} on the local {{category}} directory in {{city}} — pulled from public sources. No signup, nothing owed.

I have {{business}} at {{address}} — is that still right? And is this the best number?

[Hand over the card]
This card has a code that goes straight to the listing — scan it whenever and fix anything that's off, or view the free report at {{report_url}}.

Thanks — I'll leave it with you.

— {{operator_name}}`,
  },
  {
    key: 'report_qr_followup',
    label: 'Report link follow-up (text / email)',
    description:
      'Post-call follow-up: send the tracked report link on the channel the ' +
      'owner preferred. The tracked URL records the view so the cadence sees ' +
      'delivered → viewed.',
    anchorType: 'customer_discovery_problem',
    hookAngle: 'gbp_verification',
    fields: [
      {
        key: 'subject',
        label: 'Subject / header',
        role: 'header',
        placeholder: 'Email subject or first line',
        defaultValue: 'the free report for {{business}}',
      },
      {
        key: 'followup_text',
        label: 'Follow-up (text)',
        role: 'opener',
        placeholder: 'Short text message body',
        defaultValue: `{{salutation}} as promised — here's the free report for {{business}}: {{qr_url_report_text}}
It shows where {{business}} appears across public sources. If anything looks off you can claim the listing and fix it yourself: {{claim_short_url}}`,
      },
      {
        key: 'email_text',
        label: 'Follow-up (email)',
        role: 'closer',
        placeholder: 'Longer email body',
        defaultValue: `Hi — thanks for the call.

Here is the free report we put together for {{business}}: {{report_url}}
It documents what public sources show for your address, phone, and category — and what was missing.

If anything is wrong, you can claim the listing and correct it yourself here: {{claim_url}} — it takes about two minutes and there is no cost.

— {{sender_name}}`,
      },
      {
        key: 'operator_thesis',
        label: 'Operator thesis',
        role: 'thesis',
        placeholder: 'What this play is trying to accomplish',
        defaultValue:
          'Deliver the report on the owner\'s preferred channel using the tracked link; the scan/view drives the next cadence move.',
      },
    ],
    scriptBody: `{{salutation}} — following up from our call.

Here's the free report for {{business}}: {{qr_url_report_text}}

It shows how {{business}} appears across public sources and what was missing. If anything looks off, claim the listing and fix it yourself — {{claim_short_url}} (about two minutes, no cost).

— {{operator_name}}`,
  },
  {
    key: 'shelf_visibility_claim',
    label: 'Physical shelf visibility & 5 free slots',
    description:
      'Audit/scan flagged a physical retailer whose shelves are invisible to ' +
      'local search — Google sees the building, not the inventory. Lead with ' +
      'the analyst hook, offer the free claim + 5 shelf slots, and anchor ' +
      'walk-in foot traffic with counter pickup.',
    anchorType: 'customer_discovery_problem',
    hookAngle: 'product_category_pages',
    suggestedWhenSignal: 'DS_MISSING_PRODUCT_CATALOG',
    fields: [
      {
        key: 'subject',
        label: 'Subject / header',
        role: 'header',
        placeholder: 'Email subject or pitch header',
        defaultValue: 'your shelves are invisible to local shoppers',
      },
      {
        key: 'opener_text',
        label: 'Opener (first-touch)',
        role: 'opener',
        placeholder: 'First-touch opener text',
        defaultValue: `{{analyst_hook}}

Google knows your building, but it has no idea what is on your shelves. When nearby shoppers search for items you actually carry — like {{signature_item}} — they get sent to Amazon or the big-box chains.

We set up your store page with 5 free shelf slots so local searchers see what you have in stock and walk into your store to buy. Customers browse online and pick up at your counter — no delivery fees, no commissions.

I put together a quick preview for {{business}} — want me to send it over?

— {{sender_name}}`,
      },
      {
        key: 'closer_text',
        label: 'Closer',
        role: 'closer',
        placeholder: 'Close line / offer',
        defaultValue:
          'The first 5 shelf slots are free on your claimed listing — pick the items customers call about most and we index them for local search: {{claim_url}}',
      },
      {
        key: 'operator_thesis',
        label: 'Operator thesis',
        role: 'thesis',
        placeholder: 'What this play is trying to accomplish',
        defaultValue:
          'Audit/scan shows a physical retailer with unindexed shelf inventory. Verify the gap with the owner, then pivot to the free claim + 5 shelf slots with counter pickup.',
      },
      {
        key: 'verification_question',
        label: 'Verification question',
        role: 'thesis',
        placeholder: 'Question that confirms the audit finding',
        defaultValue:
          'I noticed customers searching for items like {{signature_item}} near {{city}} cannot see that you carry them — is that right?',
      },
      {
        key: 'pain_question',
        label: 'Pain probe',
        role: 'thesis',
        placeholder: 'Question that surfaces the pain',
        defaultValue:
          'When someone nearby searches for a specialty item you stock, how do they find out you have it today?',
      },
      {
        key: 'recommended_transition',
        label: 'Recommended transition',
        role: 'thesis',
        placeholder: 'Pivot from verification into the pitch',
        defaultValue:
          'That gap is exactly what I wanted to talk about — we can put 5 of your signature items on your free listing so local searchers see what is in stock and walk through your door.',
      },
      {
        key: 'observed_gap',
        label: 'Observed gap',
        role: 'note',
        placeholder: 'What the audit/scan showed, in operator words',
        defaultValue:
          'physical shelves invisible to local search — the building is indexed, the inventory is not',
      },
      {
        key: 'signature_item',
        label: 'Signature item',
        role: 'note',
        placeholder: 'A signature/specialty item the analyst spotted (e.g. cassava flour, halal ribeye)',
        defaultValue: 'your specialty items',
      },
    ],
    scriptBody: `Hi, are you the owner or manager of {{business}}? — I will keep it quick.

I work with local {{category}} retailers in {{city}}. We ran a visibility scan on {{business}} and noticed something specific: Google knows your building, but it has no idea what is on your shelves. When someone nearby searches for items you actually carry — like {{signature_item}} — they get sent to a big-box chain.

Quick question — when someone nearby searches for a specialty item you stock, how do they find out you have it today?

[If they confirm the gap]
We set up your listing with 5 free product slots so shoppers see your stock and walk through your door. Customers browse online, reserve, and pick up at your counter — no delivery fees, no commissions.

I can send you the preview first — it shows exactly what local shoppers see today. What is the best email — or I can text you the link?
The claim link is here if you want to look now: {{claim_url}} (or scan the card I left — {{qr_url_walkin}}).

— {{operator_name}}`,
  },
  {
    key: 'delivery_app_margin_recapture',
    label: 'Delivery app margin recapture',
    description:
      'Physical retailer is active on delivery apps and losing 20–30% of ' +
      'every basket to marketplace commissions. Pitch the store as the ' +
      'fulfillment hub: a direct mobile ordering channel with counter ' +
      'pickup at 0% commission.',
    anchorType: 'customer_discovery_problem',
    hookAngle: 'availability_inquiry',
    suggestedWhenSignal: 'WC_MISSING_PICKUP_DELIVERY',
    fields: [
      {
        key: 'subject',
        label: 'Subject / header',
        role: 'header',
        placeholder: 'Email subject or pitch header',
        defaultValue: 'keep the margin delivery apps take',
      },
      {
        key: 'opener_text',
        label: 'Opener (first-touch)',
        role: 'opener',
        placeholder: 'First-touch opener text',
        defaultValue: `{{salutation}} Love what you have built at {{business}} in {{city}}. I noticed you are active on delivery apps, which means you are giving up 20% to 30% of your basket on every order.

For a physical shop, your store is already the fulfillment hub — customers would gladly pick up at your counter if they had a 1-click mobile menu. We set up your private ordering app with 0% commission so you keep 100% of your retail margin.

Here is a preview of how your counter pickup app looks: {{report_url}}. Want to chat for 2 minutes?

— {{sender_name}}`,
      },
      {
        key: 'closer_text',
        label: 'Closer',
        role: 'closer',
        placeholder: 'Close line / offer',
        defaultValue:
          'Every order through your own app keeps the full basket margin — the customer picks up at your counter. Want me to scope it? {{claim_url}}',
      },
      {
        key: 'operator_thesis',
        label: 'Operator thesis',
        role: 'thesis',
        placeholder: 'What this play is trying to accomplish',
        defaultValue:
          'Retailer pays marketplace commissions on orders their own counter could fulfill. Probe how much volume runs through delivery apps, then pivot to the direct ordering channel at 0% commission.',
      },
      {
        key: 'verification_question',
        label: 'Verification question',
        role: 'thesis',
        placeholder: 'Question that confirms the audit finding',
        defaultValue:
          'I saw {{business}} listed on the delivery apps — how much of your weekly volume runs through them?',
      },
      {
        key: 'pain_question',
        label: 'Pain probe',
        role: 'thesis',
        placeholder: 'Question that surfaces the pain',
        defaultValue:
          'On a typical basket that goes through a delivery app, how much of it do you actually keep after their cut?',
      },
      {
        key: 'recommended_transition',
        label: 'Recommended transition',
        role: 'thesis',
        placeholder: 'Pivot from verification into the pitch',
        defaultValue:
          'That commission is exactly what I wanted to talk about — your regulars would order direct and pick up at your counter if they had a 1-click app, and you keep the whole basket.',
      },
      {
        key: 'observed_gap',
        label: 'Observed gap',
        role: 'note',
        placeholder: 'What the audit/scan showed, in operator words',
        defaultValue:
          'active on delivery apps with no direct ordering channel — marketplace commission on every basket',
      },
    ],
    scriptBody: `Hi, is this {{business}}? Quick question for the owner — I will keep it under a minute.

On a typical $60 grocery basket ordered through a delivery app, the marketplace keeps $15 to $18 in commission fees. Your physical store already has the stock and the staff — why pay a delivery fleet for local customers who can pick up at your counter?

We build direct mobile ordering apps for local retailers with zero commission cuts — customers browse your aisles on their phone, order ahead, and pick up at your register.

I have a preview of your store menu ready — what is the best email or cell to send it to?
The report is here if you want to look now: {{report_url}}.

— {{operator_name}}`,
  },
];

// ─── Lookup helpers ─────────────────────────────────────────────────────

const TEMPLATE_BY_KEY = new Map<string, ManualPlayTemplate>(
  MANUAL_PLAY_TEMPLATES.map((t) => [t.key, t]),
);

export function getManualPlayTemplate(key: string): ManualPlayTemplate | undefined {
  return TEMPLATE_BY_KEY.get(key);
}

export function isValidManualPlayTemplate(key: string): boolean {
  return TEMPLATE_BY_KEY.has(key);
}
