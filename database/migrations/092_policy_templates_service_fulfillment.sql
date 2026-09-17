-- Migration 092: Policy Templates — Service & Fulfillment Awareness
-- Adds 8 service storefront templates for cancellation, refund, appointment, and consultation policies
-- Part of Sprint 4: Enrichment (Fulfillment Awareness + Versioning + Bot AI)

-- ============================================================
-- SERVICE-SPECIFIC TEMPLATES (8)
-- ============================================================

-- 1. service_cancellation_policy (48h full refund, 24h 50%, no-refund within 2h)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-service-cancellation-001',
  'service_cancellation_policy',
  'return_policy',
  'service',
  'service',
  'service',
  'GLOBAL',
  'generic',
  'Cancellation Policy (Sliding Scale)',
  'Service cancellation policy with sliding scale refund based on notice given.',
  '# Cancellation & Refund Policy

**Effective Date:** [LAST_UPDATED_DATE]

## Cancellation Windows

At [STORE_NAME], we understand that plans change. Our cancellation policy is designed to be fair to both you and our service providers.

### More Than 48 Hours Notice
If you cancel your appointment **more than 48 hours** before the scheduled time, you will receive a **full refund** of any deposit paid.

### 24–48 Hours Notice
If you cancel **between 24 and 48 hours** before the scheduled time, you will receive a **50% refund** of any deposit paid.

### Less Than 24 Hours Notice
If you cancel **less than 24 hours** before the scheduled time, or fail to show up, **no refund** will be issued.

## How to Cancel
To cancel your appointment, please contact us at [CONTACT_EMAIL] or call [CONTACT_PHONE] at least 48 hours before your scheduled time.

## Rescheduling
Rescheduling is free of charge if done more than 24 hours before the appointment. Rescheduling within 24 hours is subject to availability and may incur a [RESCHEDULING_FEE] fee.

## Emergency Exceptions
We understand that emergencies happen. Please contact us as soon as possible and we will review your case on an individual basis.

### Contact
[STORE_NAME] — [CONTACT_EMAIL]',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null},
    {"key":"CONTACT_PHONE","label":"Contact Phone","type":"text","required":false,"default":null},
    {"key":"RESCHEDULING_FEE","label":"Rescheduling Fee","type":"text","required":false,"default":"$25"},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['Cancellation','Sliding_Scale_Refund']::text[],
  '1.0.0',
  NULL,
  true,
  30,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 2. service_privacy_standard (US-only service privacy)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-service-privacy-001',
  'service_privacy_standard',
  'privacy_policy',
  'service',
  'service',
  'service',
  'US',
  'generic',
  'Privacy Policy (Service Business)',
  'Privacy policy for service-based businesses collecting customer scheduling and contact data.',
  '# Privacy Policy

**Last Updated:** [LAST_UPDATED_DATE]

## Information We Collect

[STORE_NAME] collects the following information when you book or use our services:

- **Contact Information:** Name, email address, phone number
- **Scheduling Information:** Appointment dates, times, and service preferences
- **Payment Information:** Billing details for deposits and payments (processed securely through our payment provider)
- **Service Notes:** Information relevant to providing our services (e.g., preferences, allergies, specifications)

## How We Use Your Information

- To schedule and confirm appointments
- To communicate about your bookings
- To process payments and refunds
- To improve our services and customer experience
- To send marketing communications (you may opt out at any time)

## Information Sharing

We do not sell your personal information. We may share information with:
- Payment processors (for transaction processing)
- Scheduling software providers (for appointment management)
- Legal authorities when required by law

## Your Rights

You have the right to:
- Access your personal information
- Request correction of inaccurate information
- Request deletion of your information
- Opt out of marketing communications

## Data Retention

We retain customer information for [RETENTION_PERIOD] after your last appointment for business and legal purposes.

## Contact Us

For privacy questions or to exercise your rights, contact us at [PRIVACY_CONTACT_EMAIL].',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"PRIVACY_CONTACT_EMAIL","label":"Privacy Contact Email","type":"text","required":true,"default":null},
    {"key":"RETENTION_PERIOD","label":"Data Retention Period","type":"text","required":false,"default":"2 years"},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['CCPA','US_Privacy']::text[],
  '1.0.0',
  NULL,
  true,
  31,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 3. service_terms_standard (Generic service terms with deposits)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-service-terms-001',
  'service_terms_standard',
  'terms_of_service',
  'service',
  'service',
  'service',
  'GLOBAL',
  'generic',
  'Terms of Service (Service Business)',
  'Standard terms of service for service-based businesses with deposit requirements.',
  '# Terms of Service

**Effective Date:** [LAST_UPDATED_DATE]

## Acceptance of Terms

By booking an appointment or using any service from [STORE_NAME], you agree to these Terms of Service.

## Services

We provide [SERVICE_DESCRIPTION]. All services are subject to availability and scheduling.

## Booking & Deposits

- A deposit of [DEPOSIT_AMOUNT] may be required to secure your appointment
- Deposits are non-refundable within 24 hours of the scheduled appointment (see our Cancellation Policy)
- Full payment is due at the time of service unless otherwise agreed

## Pricing

All prices are listed in [CURRENCY]. Prices may change without notice. Any quoted price is valid for [QUOTE_VALIDITY_DAYS] days from the quote date.

## Customer Responsibilities

- Provide accurate information when booking
- Arrive on time for scheduled appointments
- Provide any required materials or access as agreed
- Communicate any changes or cancellations promptly

## Limitation of Liability

[STORE_NAME] is not liable for:
- Delays caused by factors outside our control
- Damage resulting from customer-provided materials
- Consequential or indirect damages

## Governing Law

These terms are governed by the laws of [GOVERNING_JURISDICTION].

## Changes to Terms

We may update these terms at any time. Continued use of our services constitutes acceptance of updated terms.

### Contact
[STORE_NAME] — [CONTACT_EMAIL]',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null},
    {"key":"SERVICE_DESCRIPTION","label":"Service Description","type":"textarea","required":true,"default":null},
    {"key":"DEPOSIT_AMOUNT","label":"Deposit Amount","type":"text","required":false,"default":"50% of service total"},
    {"key":"CURRENCY","label":"Currency","type":"text","required":true,"default":"USD"},
    {"key":"QUOTE_VALIDITY_DAYS","label":"Quote Validity (days)","type":"number","required":false,"default":"30"},
    {"key":"GOVERNING_JURISDICTION","label":"Governing Jurisdiction","type":"text","required":true,"default":null},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['Service_Terms']::text[],
  '1.0.0',
  NULL,
  true,
  32,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 4. service_refund_sliding (Sliding scale refund based on completion)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-service-refund-001',
  'service_refund_sliding',
  'refund_policy',
  'service',
  'service',
  'service',
  'GLOBAL',
  'generic',
  'Refund Policy (Sliding Scale by Completion)',
  'Refund policy with sliding scale based on service completion percentage.',
  '# Refund Policy

**Effective Date:** [LAST_UPDATED_DATE]

## Refund Eligibility

Refunds for [STORE_NAME] services are calculated based on the stage of completion at the time of cancellation or dispute.

## Sliding Scale Refunds

| Completion Stage | Refund Percentage |
|---|---|
| Service not started | 100% refund |
| Service less than 25% complete | 75% refund |
| Service 25–50% complete | 50% refund |
| Service 50–75% complete | 25% refund |
| Service more than 75% complete | No refund |

## Refund Processing

- Approved refunds will be processed within [REFUND_PROCESSING_DAYS] business days
- Refunds will be issued to the original payment method
- Any non-refundable deposits will be deducted from the refund amount

## Disputes

If you are unsatisfied with the service provided, please contact us within [DISPUTE_WINDOW_DAYS] days of the service completion. We will review your case and work toward a fair resolution.

## Non-Refundable Items

- Custom or personalized services once work has begun
- Rush order fees
- Travel or delivery charges incurred during service

### Contact
[STORE_NAME] — [CONTACT_EMAIL]',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null},
    {"key":"REFUND_PROCESSING_DAYS","label":"Refund Processing (days)","type":"number","required":true,"default":"5"},
    {"key":"DISPUTE_WINDOW_DAYS","label":"Dispute Window (days)","type":"number","required":false,"default":"14"},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['Sliding_Scale_Refund']::text[],
  '1.0.0',
  NULL,
  true,
  33,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 5. service_terms_appointment (Appointment-based terms)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-service-terms-appt-001',
  'service_terms_appointment',
  'terms_of_service',
  'service',
  'service',
  'service',
  'GLOBAL',
  'generic',
  'Terms of Service (Appointment-Based)',
  'Terms of service for appointment-based businesses like salons, spas, and consulting.',
  '# Terms of Service — Appointment Bookings

**Effective Date:** [LAST_UPDATED_DATE]

## Booking Appointments

By booking an appointment with [STORE_NAME], you agree to these terms.

### Appointment Confirmation
- All appointments are subject to availability
- Bookings are confirmed once you receive a confirmation email or message
- We reserve the right to decline or reschedule bookings

### Arrival Time
- Please arrive [ARRIVAL_BUFFER_MINUTES] minutes before your scheduled appointment
- Arrivals more than [LATE_TOLERANCE_MINUTES] minutes late may be rescheduled
- Repeated late arrivals may require prepayment for future bookings

## Service Duration

- Service durations are estimates and may vary based on individual needs
- Extended sessions may incur additional charges at [HOURLY_RATE] per hour

## Group Bookings

- Group bookings require a non-refundable deposit of [GROUP_DEPOSIT_PERCENT]% of the total
- Cancellations for group bookings must be made at least 72 hours in advance
- One person may be substituted in a group booking without additional charge

## Gift Cards & Vouchers

- Gift cards expire [GIFT_CARD_VALIDITY_MONTHS] months from purchase date
- Vouchers must be presented at the time of service
- Gift cards and vouchers are non-transferable and non-refundable

## Health & Safety

- Please inform us of any health conditions, allergies, or sensitivities before your appointment
- We reserve the right to refuse service if there are health or safety concerns

### Contact
[STORE_NAME] — [CONTACT_EMAIL]',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null},
    {"key":"ARRIVAL_BUFFER_MINUTES","label":"Arrival Buffer (minutes)","type":"number","required":false,"default":"10"},
    {"key":"LATE_TOLERANCE_MINUTES","label":"Late Tolerance (minutes)","type":"number","required":false,"default":"15"},
    {"key":"HOURLY_RATE","label":"Hourly Rate for Extensions","type":"text","required":false,"default":"$75"},
    {"key":"GROUP_DEPOSIT_PERCENT","label":"Group Deposit (%)","type":"number","required":false,"default":"50"},
    {"key":"GIFT_CARD_VALIDITY_MONTHS","label":"Gift Card Validity (months)","type":"number","required":false,"default":"12"},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['Appointment_Terms']::text[],
  '1.0.0',
  NULL,
  true,
  34,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 6. service_privacy_scheduling (Privacy with scheduling data collection)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-service-privacy-sched-001',
  'service_privacy_scheduling',
  'privacy_policy',
  'service',
  'service',
  'service',
  'GLOBAL',
  'generic',
  'Privacy Policy (Scheduling Data)',
  'Privacy policy for businesses collecting scheduling, appointment, and customer preference data.',
  '# Privacy Policy

**Last Updated:** [LAST_UPDATED_DATE]

## Overview

[STORE_NAME] is committed to protecting your privacy. This policy explains how we collect, use, and protect your information when you use our scheduling and booking services.

## Information We Collect

### Scheduling Data
- Appointment history and preferences
- Service provider preferences
- Booking frequency and patterns
- Cancellation and rescheduling history

### Personal Information
- Name, email, phone number
- Billing address and payment information
- Profile preferences and notes

### Optional Information
- Health-related information relevant to services (provided voluntarily)
- Photos or reference images (for visual services)
- Special requests or accommodations

## How We Use Your Information

- To schedule and manage appointments
- To send appointment reminders and confirmations
- To personalize your service experience
- To maintain service history for quality continuity
- For internal analytics and service improvement

## Automated Communications

By using our booking system, you consent to receiving:
- Appointment confirmations via [COMMUNICATION_CHANNEL]
- Reminder messages [REMINDER_HOURS_BEFORE] hours before appointments
- Follow-up messages after appointments

You may opt out of marketing communications at any time.

## Data Security

- All payment information is processed through PCI-compliant payment processors
- Scheduling data is encrypted in transit and at rest
- Access to your information is restricted to authorized staff only

## Your Rights

You may request to:
- Access or export your data
- Correct inaccurate information
- Delete your account and associated data
- Opt out of communications

### Contact
[STORE_NAME] — [PRIVACY_CONTACT_EMAIL]',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"PRIVACY_CONTACT_EMAIL","label":"Privacy Contact Email","type":"text","required":true,"default":null},
    {"key":"COMMUNICATION_CHANNEL","label":"Communication Channel","type":"text","required":false,"default":"email and SMS"},
    {"key":"REMINDER_HOURS_BEFORE","label":"Reminder Hours Before","type":"number","required":false,"default":"24"},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['Scheduling_Privacy']::text[],
  '1.0.0',
  NULL,
  true,
  35,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 7. service_cancellation_medical (Medical/spa services, HIPAA-aware)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-service-cancel-medical-001',
  'service_cancellation_medical',
  'return_policy',
  'service',
  'service',
  'service',
  'US',
  'generic',
  'Cancellation Policy (Medical/Spa Services)',
  'Cancellation policy for medical, spa, and wellness services with HIPAA-aware language.',
  '# Cancellation & Refund Policy

**Effective Date:** [LAST_UPDATED_DATE]

## Appointment Cancellation

At [STORE_NAME], we allocate dedicated time and resources for each appointment. Our cancellation policy ensures we can serve all patients efficiently.

### Cancellation Windows

| Notice Period | Refund/Reschedule |
|---|---|
| More than 48 hours | Full refund or free reschedule |
| 24–48 hours | 50% refund of deposit |
| Less than 24 hours | No refund (deposit forfeited) |
| No-show | Full service charge may apply |

### Medical Emergency Exceptions

If you need to cancel due to a medical emergency, please contact us as soon as possible. Medical emergencies with documentation will receive a full refund or free reschedule.

## Late Arrivals

- Arrivals more than 15 minutes late may be rescheduled
- Late arrivals will receive remaining scheduled time only
- Repeated late arrivals may require prepayment

## Refund Processing

- Approved refunds are processed within [REFUND_PROCESSING_DAYS] business days
- Refunds are issued to the original payment method
- Deposits are applied to the final service cost

## Package & Series Cancellations

- Prepaid packages are valid for [PACKAGE_VALIDITY_MONTHS] months
- Unused sessions in a package are refundable on a prorated basis minus a [PACKAGE_CANCELLATION_FEE] processing fee
- Series treatments (e.g., multi-session) may have specific cancellation terms discussed at consultation

## Health Information Privacy

Your health information is protected under HIPAA. Our Notice of Privacy Practices is available at [PRACTICES_URL] or in our office.

### Contact
[STORE_NAME] — [CONTACT_EMAIL] | [CONTACT_PHONE]',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null},
    {"key":"CONTACT_PHONE","label":"Contact Phone","type":"text","required":false,"default":null},
    {"key":"REFUND_PROCESSING_DAYS","label":"Refund Processing (days)","type":"number","required":true,"default":"7"},
    {"key":"PACKAGE_VALIDITY_MONTHS","label":"Package Validity (months)","type":"number","required":false,"default":"6"},
    {"key":"PACKAGE_CANCELLATION_FEE","label":"Package Cancellation Fee","type":"text","required":false,"default":"$25"},
    {"key":"PRACTICES_URL","label":"Privacy Practices URL","type":"text","required":false,"default":null},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['HIPAA','Medical_Cancellation']::text[],
  '1.0.0',
  '2003-04-14T00:00:00Z',
  true,
  36,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 8. service_terms_consultation (Professional consultation services)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-service-terms-consult-001',
  'service_terms_consultation',
  'terms_of_service',
  'service',
  'service',
  'service',
  'GLOBAL',
  'generic',
  'Terms of Service (Professional Consultation)',
  'Terms for professional consulting, coaching, and advisory services with confidentiality clauses.',
  '# Terms of Service — Professional Consultation

**Effective Date:** [LAST_UPDATED_DATE]

## Engagement Terms

These terms govern the professional consultation services provided by [STORE_NAME] ("Consultant").

## Scope of Services

The Consultant agrees to provide [SERVICE_DESCRIPTION]. The specific deliverables, timeline, and milestones shall be as agreed in a separate engagement letter or proposal.

## Fees & Payment

- Consultation fees are [HOURLY_RATE] per hour unless otherwise agreed
- Fixed-fee engagements are due as specified in the proposal
- Invoices are due within [PAYMENT_TERMS_DAYS] days of issuance
- Late payments may incur a [LATE_FEE_PERCENT]% monthly interest charge

## Confidentiality

Both parties agree to maintain confidentiality of all information shared during the consultation. This includes:
- Business strategies and proprietary information
- Financial data and projections
- Customer and employee information
- Trade secrets and intellectual property

Confidentiality obligations survive termination of the engagement for [CONFIDENTIALITY_PERIOD].

## Intellectual Property

- Pre-existing IP remains the property of the originating party
- Work product created during the engagement is transferred to the Client upon full payment
- The Consultant retains the right to use general methodologies and frameworks

## Professional Disclaimer

The Consultant provides professional advice based on expertise and available information. The Consultant does not guarantee specific outcomes. The Client is responsible for implementing recommendations and making final business decisions.

## Termination

- Either party may terminate with [TERMINATION_NOTICE_DAYS] days written notice
- Fees for work completed up to termination are due and payable
- Terminated engagements do not entitle the Client to refund of completed work

## Limitation of Liability

The Consultant''s liability is limited to the total fees paid under the engagement. The Consultant is not liable for consequential, indirect, or lost profit damages.

## Governing Law

These terms are governed by the laws of [GOVERNING_JURISDICTION].

### Contact
[STORE_NAME] — [CONTACT_EMAIL]',
  '[
    {"key":"STORE_NAME","label":"Store/Business Name","type":"text","required":true,"default":null},
    {"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null},
    {"key":"SERVICE_DESCRIPTION","label":"Service Description","type":"textarea","required":true,"default":null},
    {"key":"HOURLY_RATE","label":"Hourly Rate","type":"text","required":false,"default":"$150"},
    {"key":"PAYMENT_TERMS_DAYS","label":"Payment Terms (days)","type":"number","required":false,"default":"30"},
    {"key":"LATE_FEE_PERCENT","label":"Late Fee (%)","type":"number","required":false,"default":"1.5"},
    {"key":"CONFIDENTIALITY_PERIOD","label":"Confidentiality Period","type":"text","required":false,"default":"3 years"},
    {"key":"TERMINATION_NOTICE_DAYS","label":"Termination Notice (days)","type":"number","required":false,"default":"14"},
    {"key":"GOVERNING_JURISDICTION","label":"Governing Jurisdiction","type":"text","required":true,"default":null},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['Consultation_Terms','Confidentiality']::text[],
  '1.0.0',
  NULL,
  true,
  37,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- ============================================================
-- DONE: 8 service-specific templates seeded
-- ============================================================
