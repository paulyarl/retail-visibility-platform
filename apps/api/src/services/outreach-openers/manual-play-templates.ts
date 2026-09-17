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
    hookAngle: 'footprint_verification',
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
    hookAngle: 'footprint_verification',
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
