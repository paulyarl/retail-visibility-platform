-- Migration 091: Policy Templates — Compliance & Jurisdiction
-- Adds 9 multi-jurisdiction templates and 6 platform-specific templates
-- Part of Sprint 3: Compliance & Jurisdiction Awareness

-- ============================================================
-- MULTI-JURISDICTION TEMPLATES (9)
-- ============================================================

-- 1. online_privacy_gdpr (EU full, with DPO contact placeholder)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-online-privacy-gdpr-001',
  'online_privacy_gdpr',
  'privacy_policy',
  'online',
  'all',
  'all',
  'EU',
  'generic',
  'Privacy Policy (GDPR Compliant)',
  'Full GDPR-compliant privacy policy for EU customers, including DPO contact and lawful basis.',
  '## Privacy Policy

**Last updated:** [LAST_UPDATED_DATE]

[STORE_NAME] ("we", "us", "our") is committed to protecting your personal data in accordance with the General Data Protection Regulation (GDPR) (EU) 2016/679.

### Data Controller
[STORE_NAME] is the data controller. Our Data Protection Officer can be contacted at [DPO_EMAIL].

### Lawful Basis for Processing
We process your personal data under the following lawful bases:
- **Contract performance** — to fulfill your orders and provide services
- **Legal obligation** — to comply with tax and accounting requirements
- **Legitimate interest** — to improve our services and prevent fraud
- **Consent** — for marketing communications (you may withdraw at any time)

### Personal Data We Collect
- **Identity data**: Name, username
- **Contact data**: Email address, phone number, shipping address
- **Transaction data**: Order history, payment details (we do not store full card numbers)
- **Technical data**: IP address, browser type, browsing activity on our storefront

### Your Rights Under GDPR
You have the right to:
- **Access** — request a copy of your personal data
- **Rectification** — correct inaccurate or incomplete data
- **Erasure** — request deletion of your personal data ("right to be forgotten")
- **Restriction** — request we limit processing of your data
- **Portability** — receive your data in a structured, machine-readable format
- **Objection** — object to processing based on legitimate interests
- **Withdraw consent** — at any time for consent-based processing

### Data Retention
We retain personal data only as long as necessary for the purposes set out above, or as required by law.

### International Transfers
If we transfer your data outside the EU/EEA, we ensure appropriate safeguards are in place, such as Standard Contractual Clauses.

### Contact Us
For privacy questions or to exercise your rights, email us at [DPO_EMAIL]. You also have the right to lodge a complaint with your local supervisory authority.',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"DPO_EMAIL","label":"Data Protection Officer Email","type":"text","required":true,"default":null},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['GDPR','EU']::text[],
  '1.0.0',
  '2018-05-25T00:00:00Z',
  true,
  10,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 2. online_privacy_uk (UK post-Brexit, with ICO registration)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-online-privacy-uk-001',
  'online_privacy_uk',
  'privacy_policy',
  'online',
  'all',
  'all',
  'UK',
  'generic',
  'Privacy Policy (UK GDPR Compliant)',
  'UK GDPR-compliant privacy policy post-Brexit, with ICO registration reference.',
  '## Privacy Policy

**Last updated:** [LAST_UPDATED_DATE]

[STORE_NAME] ("we", "us", "our") is committed to protecting your personal data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.

### Data Controller
[STORE_NAME] is registered with the Information Commissioner''s Office (ICO). Our registration number is [ICO_REGISTRATION_NUMBER].

### Lawful Basis for Processing
- **Contract performance** — to fulfill your orders
- **Legal obligation** — to comply with UK tax and accounting laws
- **Legitimate interest** — to improve our services and prevent fraud
- **Consent** — for marketing communications (withdraw at any time)

### Personal Data We Collect
- Name, email address, phone number, shipping address
- Order history and payment details (card numbers not stored)
- IP address, browser type, browsing activity

### Your Rights Under UK GDPR
- Access, rectification, erasure, restriction, portability, objection
- Right to withdraw consent for consent-based processing

### Contact Us
For privacy questions, email [PRIVACY_CONTACT_EMAIL]. You may also complain to the ICO at ico.org.uk.',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"ICO_REGISTRATION_NUMBER","label":"ICO Registration Number","type":"text","required":true,"default":null},
    {"key":"PRIVACY_CONTACT_EMAIL","label":"Privacy Contact Email","type":"text","required":true,"default":null},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['UK_GDPR','DPA_2018']::text[],
  '1.0.0',
  '2021-01-01T00:00:00Z',
  true,
  11,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 3. online_privacy_lgpd (Brazil)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-online-privacy-lgpd-001',
  'online_privacy_lgpd',
  'privacy_policy',
  'online',
  'all',
  'all',
  'BR',
  'generic',
  'Privacy Policy (LGPD Compliant)',
  'Brazilian General Data Protection Law (LGPD) compliant privacy policy.',
  '## Política de Privacidade / Privacy Policy

**Última atualização:** [LAST_UPDATED_DATE]

[STORE_NAME] ("nós", "nosso") está comprometido em proteger seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD) - Lei nº 13.709/2018.

### Dados que Coletamos
- Nome, e-mail, telefone, endereço de entrega
- Histórico de pedidos e dados de pagamento
- Endereço IP, tipo de navegador, atividade de navegação

### Base Legal
- **Execução de contrato** — para processar seus pedidos
- **Obrigação legal** — para cumprir obrigações fiscais
- **Consentimento** — para comunicações de marketing (você pode revogar a qualquer momento)

### Seus Direitos (LGPD)
- Acesso, retificação, eliminação, portabilidade, oposição
- Revogação de consentimento

### Contato
Para questões de privacidade, entre em contato: [PRIVACY_CONTACT_EMAIL]. Você também pode apresentar reclamação à ANPD (autoridade.nacional.ih.gov.br).',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"PRIVACY_CONTACT_EMAIL","label":"Privacy Contact Email","type":"text","required":true,"default":null},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['LGPD','Brazil']::text[],
  '1.0.0',
  '2020-09-18T00:00:00Z',
  true,
  12,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 4. online_privacy_pdpa (Singapore)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-online-privacy-pdpa-001',
  'online_privacy_pdpa',
  'privacy_policy',
  'online',
  'all',
  'all',
  'SG',
  'generic',
  'Privacy Policy (PDPA Compliant)',
  'Singapore Personal Data Protection Act (PDPA) compliant privacy policy.',
  '## Privacy Policy

**Last updated:** [LAST_UPDATED_DATE]

[STORE_NAME] ("we", "us", "our") is committed to protecting your personal data in accordance with the Personal Data Protection Act 2012 (PDPA) of Singapore.

### Personal Data We Collect
- Name, email address, phone number, shipping address
- Order history and payment details
- Browsing activity and device information

### Purposes of Collection
- To process and fulfill your orders
- To communicate with you about your orders
- To improve our products and services
- For marketing (with consent, withdrawable at any time)

### Your Rights Under PDPA
- Access and correction of your personal data
- Withdrawal of consent for collection, use, or disclosure
- Request for deletion of personal data (subject to legal retention requirements)

### Data Protection Officer (DPO)
Our DPO can be contacted at [DPO_EMAIL]. You may also lodge a complaint with the Personal Data Protection Commission (PDPC) at pdpc.gov.sg.

### Contact Us
For privacy questions, email [DPO_EMAIL].',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"DPO_EMAIL","label":"DPO Email","type":"text","required":true,"default":null},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['PDPA','Singapore']::text[],
  '1.0.0',
  '2014-07-02T00:00:00Z',
  true,
  13,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 5. online_privacy_pipeda (Canada)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-online-privacy-pipeda-001',
  'online_privacy_pipeda',
  'privacy_policy',
  'online',
  'all',
  'all',
  'CA',
  'generic',
  'Privacy Policy (PIPEDA Compliant)',
  'Canadian Personal Information Protection and Electronic Documents Act (PIPEDA) compliant privacy policy.',
  '## Privacy Policy

**Last updated:** [LAST_UPDATED_DATE]

[STORE_NAME] ("we", "us", "our") is committed to protecting your personal information in accordance with the Personal Information Protection and Electronic Documents Act (PIPEDA).

### Personal Information We Collect
- Name, email address, phone number, shipping address
- Order history and payment details (card numbers not stored)
- Browsing activity and device information

### Purposes of Collection
- To process and fulfill your orders
- To communicate about your orders
- To improve our services
- For marketing (with consent, withdrawable at any time)

### Your Rights Under PIPEDA
- Access and correct your personal information
- Withdraw consent for collection, use, or disclosure
- File a complaint with the Office of the Privacy Commissioner of Canada

### Contact Us
For privacy questions or to exercise your rights, contact us at [PRIVACY_CONTACT_EMAIL]. You may also complain to the Privacy Commissioner at priv.gc.ca.',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"PRIVACY_CONTACT_EMAIL","label":"Privacy Contact Email","type":"text","required":true,"default":null},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['PIPEDA','Canada']::text[],
  '1.0.0',
  '2001-01-01T00:00:00Z',
  true,
  14,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 6. online_terms_eu_consumer_rights (EU Consumer Rights Directive compliant)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-online-terms-eu-consumer-001',
  'online_terms_eu_consumer_rights',
  'terms_of_service',
  'online',
  'all',
  'all',
  'EU',
  'generic',
  'Terms of Service (EU Consumer Rights Directive)',
  'Terms of service compliant with EU Consumer Rights Directive 2011/83/EU.',
  '## Terms of Service

**Last updated:** [LAST_UPDATED_DATE]

By placing an order with [STORE_NAME], you agree to these terms and conditions.

### Ordering and Pricing
- All prices include VAT where applicable and are displayed in [CURRENCY]
- We reserve the right to correct pricing errors
- Order acceptance occurs when we dispatch your items

### Right of Withdrawal (EU Consumer Rights Directive)
Under Directive 2011/83/EU, you have the right to withdraw from this contract within 14 days without giving any reason. The withdrawal period expires 14 days after you receive the goods.

To exercise your right of withdrawal, you must inform us at [CONTACT_EMAIL] of your decision to withdraw by an unequivocal statement.

### Conformity of Goods
Goods must be in conformity with the contract. If goods are defective, you have the right to a remedy (repair, replacement, price reduction, or termination of contract) under Directive 1999/44/EC.

### Delivery
We will deliver within [DELIVERY_DAYS] days of order acceptance unless otherwise agreed.

### Applicable Law
These terms are governed by the laws of [GOVERNING_COUNTRY]. Disputes may be submitted to the European Online Dispute Resolution platform at ec.europa.eu/consumers/odr.

### Contact
[STORE_NAME] — [CONTACT_EMAIL]',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null},
    {"key":"CURRENCY","label":"Currency (e.g. EUR)","type":"text","required":true,"default":"EUR"},
    {"key":"DELIVERY_DAYS","label":"Delivery Days","type":"number","required":true,"default":"30"},
    {"key":"GOVERNING_COUNTRY","label":"Governing Country","type":"text","required":true,"default":null},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['EU_Consumer_Rights','Directive_2011_83']::text[],
  '1.0.0',
  '2014-06-13T00:00:00Z',
  true,
  15,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 7. online_return_eu_14_day (EU 14-day withdrawal right)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-online-return-eu-14day-001',
  'online_return_eu_14_day',
  'return_policy',
  'online',
  'physical',
  'all',
  'EU',
  'generic',
  'Return Policy (EU 14-Day Withdrawal Right)',
  'Return policy aligned with EU 14-day right of withdrawal under Directive 2011/83/EU.',
  '## Return Policy (EU Right of Withdrawal)

**Last updated:** [LAST_UPDATED_DATE]

### Your Right of Withdrawal
Under EU law (Directive 2011/83/EU), you have the right to withdraw from your purchase within 14 days of receiving the goods, without giving any reason.

### How to Withdraw
To exercise your right of withdrawal, notify us at [CONTACT_EMAIL] with:
- Your name and order number
- A clear statement that you wish to withdraw

### Return Conditions
- Goods must be returned within 14 days of notifying us
- Goods should be in original condition where possible
- You bear the direct cost of returning the goods (estimated at [RETURN_COST_ESTIMATE])
- We will refund all payments, including standard delivery costs, within 14 days of receiving the returned goods

### Exceptions
The right of withdrawal does not apply to:
- Sealed goods opened after delivery (e.g. hygiene products)
- Goods made to your specifications or clearly personalized
- Digital content if you consented to download and the download started

### Refunds
Refunds will be issued to your original payment method within 14 days of receiving the returned goods.

### Contact
[STORE_NAME] — [CONTACT_EMAIL]',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null},
    {"key":"RETURN_COST_ESTIMATE","label":"Return Cost Estimate","type":"text","required":false,"default":"standard shipping rates"},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['EU_Consumer_Rights','14_day_withdrawal']::text[],
  '1.0.0',
  '2014-06-13T00:00:00Z',
  true,
  16,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 8. retail_privacy_ccpa_pos (CCPA with POS data collection)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-retail-privacy-ccpa-pos-001',
  'retail_privacy_ccpa_pos',
  'privacy_policy',
  'retail',
  'all',
  'pickup',
  'US',
  'generic',
  'Privacy Policy (CCPA — In-Store POS)',
  'CCPA-compliant privacy policy for retail stores with point-of-sale data collection.',
  '## Privacy Policy

**Last updated:** [LAST_UPDATED_DATE]

[STORE_NAME] ("we", "us", "our") respects your privacy. This policy explains how we collect and use your information in-store and online.

### Information We Collect
- **In-store**: Name, email, phone number (for receipts, loyalty programs, returns)
- **Point of sale**: Payment method, purchase history
- **Online**: Browsing activity, device information, IP address

### How We Use Your Information
- To process transactions and issue receipts
- To manage returns and exchanges
- To communicate about your orders and loyalty rewards
- To improve our products and services

### Your Rights (California Residents — CCPA)
- **Know**: What personal data we collect about you
- **Delete**: Request deletion of your personal data
- **Opt-out**: Of the sale of your personal data (we do not sell your data)
- **Non-discrimination**: For exercising your rights

### Contact Us
For privacy questions or to exercise your rights, email [PRIVACY_CONTACT_EMAIL] or ask in-store.',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"PRIVACY_CONTACT_EMAIL","label":"Privacy Contact Email","type":"text","required":true,"default":null},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['CCPA','POS']::text[],
  '1.0.0',
  '2020-01-01T00:00:00Z',
  true,
  17,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 9. service_privacy_hipaa_aware (HIPAA-aware for medical/spa services)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-service-privacy-hipaa-001',
  'service_privacy_hipaa_aware',
  'privacy_policy',
  'service',
  'all',
  'service',
  'US',
  'generic',
  'Privacy Policy (HIPAA-Aware)',
  'HIPAA-aware privacy policy for service businesses handling health-related information (medical, spa, wellness).',
  '## Privacy Policy

**Last updated:** [LAST_UPDATED_DATE]

[STORE_NAME] ("we", "us", "our") is committed to protecting your personal and health information.

### Protected Health Information (PHI)
If you are a patient or client receiving health-related services, we handle your Protected Health Information (PHI) in accordance with the Health Insurance Portability and Accountability Act (HIPAA).

### Information We Collect
- **Health information**: Treatment records, appointment history, health concerns
- **Contact information**: Name, email, phone, address
- **Payment information**: Insurance details, billing history

### How We Use Your Information
- To provide and coordinate your services/treatment
- For billing and insurance claims
- For appointment reminders and follow-ups
- As required by law

### Your Rights
- Access and obtain a copy of your health records
- Request corrections to your records
- Request restrictions on certain uses and disclosures
- Receive confidential communications
- File a complaint with the U.S. Department of Health and Human Services

### Notice of Privacy Practices
A detailed Notice of Privacy Practices is available at [PRACTICES_URL] or in-store. Please review it for complete information about how we handle PHI.

### Contact Us
For privacy questions, contact our Privacy Officer at [PRIVACY_OFFICER_EMAIL].',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"PRIVACY_OFFICER_EMAIL","label":"Privacy Officer Email","type":"text","required":true,"default":null},
    {"key":"PRACTICES_URL","label":"Notice of Privacy Practices URL","type":"text","required":false,"default":null},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['HIPAA','Health']::text[],
  '1.0.0',
  '2003-04-14T00:00:00Z',
  true,
  18,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- ============================================================
-- PLATFORM-SPECIFIC TEMPLATES (6)
-- ============================================================

-- 10. online_return_meta_commerce (Meta Commerce compliant return policy)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-online-return-meta-001',
  'online_return_meta_commerce',
  'return_policy',
  'online',
  'physical',
  'shipping',
  'GLOBAL',
  'meta_commerce',
  'Return Policy (Meta Commerce Compliant)',
  'Return policy compliant with Meta Commerce policies for Instagram Shopping and Facebook Shop.',
  '## Return Policy

**Last updated:** [LAST_UPDATED_DATE]

### Return Window
Items can be returned within [RETURN_WINDOW_DAYS] days of delivery, in original condition with tags attached.

### How to Start a Return
1. Message us through Instagram or Facebook, or email [CONTACT_EMAIL]
2. Provide your order number and reason for return
3. We will provide a return shipping label

### Return Shipping
- [RETURN_SHIPPING_POLICY]
- Refunds are processed within [REFUND_PROCESSING_DAYS] business days of receiving the returned item

### Refunds
Refunds are issued to your original payment method. Shipping costs are [SHIPPING_COST_POLICY].

### Exchanges
To exchange an item, please return the original item and place a new order.

### Damaged or Defective Items
If you receive a damaged or defective item, contact us within 48 hours with photos for a replacement or full refund.

### Contact
[STORE_NAME] — [CONTACT_EMAIL]',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null},
    {"key":"RETURN_WINDOW_DAYS","label":"Return Window (days)","type":"number","required":true,"default":"30"},
    {"key":"RETURN_SHIPPING_POLICY","label":"Return Shipping Policy","type":"textarea","required":true,"default":"Buyer pays return shipping unless the item is damaged or defective"},
    {"key":"REFUND_PROCESSING_DAYS","label":"Refund Processing (days)","type":"number","required":true,"default":"5"},
    {"key":"SHIPPING_COST_POLICY","label":"Shipping Cost Policy","type":"text","required":false,"default":"non-refundable"},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['Meta_Commerce','Instagram_Shopping']::text[],
  '1.0.0',
  NULL,
  true,
  20,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 11. online_shipping_meta_commerce (Meta Commerce compliant shipping policy)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-online-shipping-meta-001',
  'online_shipping_meta_commerce',
  'shipping_policy',
  'online',
  'physical',
  'shipping',
  'GLOBAL',
  'meta_commerce',
  'Shipping Policy (Meta Commerce Compliant)',
  'Shipping policy compliant with Meta Commerce policies.',
  '## Shipping Policy

**Last updated:** [LAST_UPDATED_DATE]

### Processing Time
Orders are processed within [PROCESSING_DAYS] business days (excluding weekends and holidays).

### Shipping Methods & Rates
- **Standard Shipping**: [STANDARD_RATE] — [STANDARD_DELIVERY_DAYS] business days
- **Express Shipping**: [EXPRESS_RATE] — [EXPRESS_DELIVERY_DAYS] business days
- **International Shipping**: [INTERNATIONAL_RATE] — [INTERNATIONAL_DELIVERY_DAYS] business days

### Order Tracking
You will receive a tracking number via email once your order ships.

### Shipping Destinations
We ship to: [SHIPPING_DESTINATIONS]

### Delays
We are not responsible for shipping delays caused by the carrier, weather, customs, or other factors outside our control.

### Lost or Stolen Packages
If your package is lost or stolen, contact us at [CONTACT_EMAIL] within 7 days of the expected delivery date. We will work with the carrier to resolve the issue.

### Contact
[STORE_NAME] — [CONTACT_EMAIL]',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null},
    {"key":"PROCESSING_DAYS","label":"Processing Days","type":"number","required":true,"default":"2"},
    {"key":"STANDARD_RATE","label":"Standard Shipping Rate","type":"text","required":true,"default":null},
    {"key":"STANDARD_DELIVERY_DAYS","label":"Standard Delivery (days)","type":"number","required":true,"default":"5"},
    {"key":"EXPRESS_RATE","label":"Express Shipping Rate","type":"text","required":true,"default":null},
    {"key":"EXPRESS_DELIVERY_DAYS","label":"Express Delivery (days)","type":"number","required":true,"default":"2"},
    {"key":"INTERNATIONAL_RATE","label":"International Shipping Rate","type":"text","required":false,"default":"Calculated at checkout"},
    {"key":"INTERNATIONAL_DELIVERY_DAYS","label":"International Delivery (days)","type":"number","required":false,"default":"10"},
    {"key":"SHIPPING_DESTINATIONS","label":"Shipping Destinations","type":"textarea","required":true,"default":null},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['Meta_Commerce','Instagram_Shopping']::text[],
  '1.0.0',
  NULL,
  true,
  21,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 12. online_privacy_meta_commerce (Meta Commerce compliant privacy policy)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-online-privacy-meta-001',
  'online_privacy_meta_commerce',
  'privacy_policy',
  'online',
  'all',
  'all',
  'GLOBAL',
  'meta_commerce',
  'Privacy Policy (Meta Commerce Compliant)',
  'Privacy policy compliant with Meta Commerce and Instagram Shopping data handling requirements.',
  '## Privacy Policy

**Last updated:** [LAST_UPDATED_DATE]

[STORE_NAME] ("we", "us", "our") respects your privacy. This policy explains how we collect and use your information when you shop with us through Instagram Shopping or Facebook Shop.

### Information We Collect
- Name, email, shipping address, phone number
- Order history and payment details (card numbers not stored)
- Browsing activity on our storefront
- Data shared by Meta Platforms (name, email, shipping address) when you place an order through Instagram or Facebook

### How We Use Your Information
- To process and fulfill your orders
- To communicate with you about your orders
- To improve our products and services
- For marketing (with your consent, withdrawable at any time)

### Data Sharing with Meta
When you place an order through Instagram Shopping or Facebook Shop, Meta Platforms processes the transaction. We receive your order details from Meta to fulfill your order. Meta''s privacy policy applies to data collected by Meta: facebook.com/privacy/policy

### Your Rights
- Access and request a copy of your personal data
- Request deletion of your personal data
- Opt out of marketing communications
- Non-discrimination for exercising your rights

### Contact Us
For privacy questions, email [PRIVACY_CONTACT_EMAIL].',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"PRIVACY_CONTACT_EMAIL","label":"Privacy Contact Email","type":"text","required":true,"default":null},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['Meta_Commerce','Instagram_Shopping','Facebook_Shop']::text[],
  '1.0.0',
  NULL,
  true,
  22,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 13. online_terms_tiktok_shop (TikTok Shop Seller Policy compliant terms)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-online-terms-tiktok-001',
  'online_terms_tiktok_shop',
  'terms_of_service',
  'online',
  'all',
  'shipping',
  'GLOBAL',
  'tiktok_shop',
  'Terms of Service (TikTok Shop Compliant)',
  'Terms of service compliant with TikTok Shop Seller Policies.',
  '## Terms of Service

**Last updated:** [LAST_UPDATED_DATE]

By placing an order with [STORE_NAME] through TikTok Shop, you agree to these terms.

### Ordering
- All orders are subject to acceptance and availability
- Prices are displayed in [CURRENCY] and include applicable taxes
- We reserve the right to refuse or cancel orders

### TikTok Shop Policies
As a TikTok Shop seller, we comply with TikTok Shop Seller Policies, including:
- Authentic products only — no counterfeit or replica goods
- Accurate product descriptions and images
- Prohibited items are not sold
- Compliance with TikTok Community Guidelines

### Payment
- Payment is processed through TikTok Shop''s payment system
- We do not store your payment card details

### Shipping
Orders are shipped within [SHIPPING_DAYS] business days. See our shipping policy for details.

### Returns
Returns are accepted within [RETURN_DAYS] days. See our return policy for details.

### Intellectual Property
All content on our storefront is owned by [STORE_NAME]. TikTok and TikTok Shop are trademarks of TikTok Inc.

### Governing Law
These terms are governed by the laws of [GOVERNING_JURISDICTION].

### Contact
[STORE_NAME] — [CONTACT_EMAIL]',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null},
    {"key":"CURRENCY","label":"Currency","type":"text","required":true,"default":"USD"},
    {"key":"SHIPPING_DAYS","label":"Shipping Days","type":"number","required":true,"default":"3"},
    {"key":"RETURN_DAYS","label":"Return Window (days)","type":"number","required":true,"default":"30"},
    {"key":"GOVERNING_JURISDICTION","label":"Governing Jurisdiction","type":"text","required":true,"default":null},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['TikTok_Shop','Seller_Policy']::text[],
  '1.0.0',
  NULL,
  true,
  23,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 14. online_return_tiktok_shop (TikTok Shop return window compliant)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-online-return-tiktok-001',
  'online_return_tiktok_shop',
  'return_policy',
  'online',
  'physical',
  'shipping',
  'GLOBAL',
  'tiktok_shop',
  'Return Policy (TikTok Shop Compliant)',
  'Return policy compliant with TikTok Shop return requirements.',
  '## Return Policy

**Last updated:** [LAST_UPDATED_DATE]

### Return Window
Items can be returned within [RETURN_WINDOW_DAYS] days of delivery, in original condition.

### How to Return
1. Go to your TikTok Shop order history
2. Select the order and tap "Return/Refund"
3. Select the item(s) and reason for return
4. We will review and approve your request

### Return Conditions
- Items must be unused and in original packaging
- Tags and labels must be attached
- Original receipt or proof of purchase required

### Refund Processing
- Approved refunds are processed within [REFUND_DAYS] business days
- Refunds are issued to your original payment method through TikTok Shop

### Return Shipping
- [RETURN_SHIPPING_POLICY]
- Defective or wrong items: we cover return shipping

### Non-Returnable Items
- Personal care products (opened)
- Custom or personalized items
- Gift cards

### Contact
[STORE_NAME] — [CONTACT_EMAIL]',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null},
    {"key":"RETURN_WINDOW_DAYS","label":"Return Window (days)","type":"number","required":true,"default":"30"},
    {"key":"REFUND_DAYS","label":"Refund Processing (days)","type":"number","required":true,"default":"5"},
    {"key":"RETURN_SHIPPING_POLICY","label":"Return Shipping Policy","type":"textarea","required":true,"default":"Buyer pays return shipping for change-of-mind returns"},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['TikTok_Shop']::text[],
  '1.0.0',
  NULL,
  true,
  24,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- 15. online_return_google_shopping (Google Merchant Center compliant return)
INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, regulatory_effective_date, is_active, sort_order, created_at, updated_at)
VALUES (
  'ptmpl-online-return-google-001',
  'online_return_google_shopping',
  'return_policy',
  'online',
  'physical',
  'shipping',
  'GLOBAL',
  'google_shopping',
  'Return Policy (Google Merchant Center Compliant)',
  'Return policy compliant with Google Merchant Center return policy requirements.',
  '## Return Policy

**Last updated:** [LAST_UPDATED_DATE]

### Return Window
We accept returns within [RETURN_WINDOW_DAYS] days of delivery.

### How to Return
1. Email [CONTACT_EMAIL] with your order number and reason for return
2. We will send you a return authorization and instructions
3. Ship the item(s) back to: [RETURN_ADDRESS]

### Return Conditions
- Items must be in original condition with tags attached
- Include the original packaging
- Provide proof of purchase

### Refunds
- Refunds are processed within [REFUND_DAYS] business days of receiving the returned item
- Refunds are issued to the original payment method

### Return Shipping Costs
- [RETURN_SHIPPING_POLICY]
- We cover return shipping for defective or incorrect items

### Exchanges
To exchange an item, return the original and place a new order.

### Contact
[STORE_NAME] — [CONTACT_EMAIL]',
  '[
    {"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},
    {"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null},
    {"key":"RETURN_WINDOW_DAYS","label":"Return Window (days)","type":"number","required":true,"default":"30"},
    {"key":"RETURN_ADDRESS","label":"Return Address","type":"textarea","required":true,"default":null},
    {"key":"REFUND_DAYS","label":"Refund Processing (days)","type":"number","required":true,"default":"5"},
    {"key":"RETURN_SHIPPING_POLICY","label":"Return Shipping Policy","type":"textarea","required":true,"default":"Buyer pays return shipping unless item is defective"},
    {"key":"LAST_UPDATED_DATE","label":"Last Updated Date","type":"date","required":true,"default":null}
  ]'::jsonb,
  ARRAY['Google_Merchant_Center','Google_Shopping']::text[],
  '1.0.0',
  NULL,
  true,
  25,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO NOTHING;

-- ============================================================
-- DONE: 15 templates seeded (9 multi-jurisdiction + 6 platform-specific)
-- ============================================================
