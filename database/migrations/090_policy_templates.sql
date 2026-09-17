-- 090_policy_templates.sql
-- Storefront Policy Templates — template catalog + tenant usage audit trail
-- Provides pre-defined, customizable policy content grouped by storefront type

-- ============================================================
-- 1. policy_templates table
-- ============================================================

CREATE TABLE IF NOT EXISTS policy_templates (
  id                        VARCHAR(255) PRIMARY KEY,
  template_key              VARCHAR(100) NOT NULL UNIQUE,
  policy_type               VARCHAR(50) NOT NULL,
  storefront_type           VARCHAR(50) NOT NULL DEFAULT 'all',
  product_type              VARCHAR(50) NOT NULL DEFAULT 'all',
  fulfillment_mode          VARCHAR(50) NOT NULL DEFAULT 'all',
  jurisdiction              VARCHAR(10) NOT NULL DEFAULT 'GLOBAL',
  platform                  VARCHAR(50) NOT NULL DEFAULT 'generic',
  title                     VARCHAR(200) NOT NULL,
  description               TEXT,
  content_markdown          TEXT NOT NULL,
  placeholder_schema        JSONB DEFAULT '[]'::jsonb,
  compliance_tags           TEXT[] DEFAULT '{}'::text[],
  version                   VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  regulatory_effective_date TIMESTAMPTZ(6),
  is_active                 BOOLEAN NOT NULL DEFAULT true,
  sort_order                INT NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_policy_templates_storefront_type
  ON policy_templates (storefront_type, policy_type, is_active);

CREATE INDEX IF NOT EXISTS idx_policy_templates_jurisdiction
  ON policy_templates (jurisdiction, is_active);

CREATE INDEX IF NOT EXISTS idx_policy_templates_platform
  ON policy_templates (platform, is_active);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_policy_templates_updated_at') THEN
    CREATE TRIGGER trg_policy_templates_updated_at
      BEFORE UPDATE ON policy_templates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- 2. tenant_policy_template_usage table
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_policy_template_usage (
  id                  VARCHAR(255) PRIMARY KEY,
  tenant_id           VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id         VARCHAR(255) NOT NULL REFERENCES policy_templates(id) ON DELETE CASCADE,
  policy_type         VARCHAR(50) NOT NULL,
  template_version    VARCHAR(20) NOT NULL,
  applied_at          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  customized          BOOLEAN NOT NULL DEFAULT false,
  placeholder_values  JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_policy_template_usage_tenant
  ON tenant_policy_template_usage (tenant_id);

CREATE INDEX IF NOT EXISTS idx_policy_template_usage_template
  ON tenant_policy_template_usage (template_id);

CREATE INDEX IF NOT EXISTS idx_policy_template_usage_tenant_policy
  ON tenant_policy_template_usage (tenant_id, policy_type);

-- ============================================================
-- 3. RLS Policies
-- ============================================================

-- policy_templates: public can read active, admin can write
ALTER TABLE policy_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'policy_templates_public_read' AND polrelid = 'policy_templates'::regclass) THEN
    CREATE POLICY policy_templates_public_read ON policy_templates
      FOR SELECT USING (is_active = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'policy_templates_admin_all' AND polrelid = 'policy_templates'::regclass) THEN
    CREATE POLICY policy_templates_admin_all ON policy_templates
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- tenant_policy_template_usage: tenant-scoped read, admin read-all
ALTER TABLE tenant_policy_template_usage ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'policy_template_usage_tenant_read' AND polrelid = 'tenant_policy_template_usage'::regclass) THEN
    CREATE POLICY policy_template_usage_tenant_read ON tenant_policy_template_usage
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'policy_template_usage_admin_all' AND polrelid = 'tenant_policy_template_usage'::regclass) THEN
    CREATE POLICY policy_template_usage_admin_all ON tenant_policy_template_usage
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- 4. Seed 15 high-priority templates
-- ============================================================

INSERT INTO policy_templates (id, template_key, policy_type, storefront_type, product_type, fulfillment_mode, jurisdiction, platform, title, description, content_markdown, placeholder_schema, compliance_tags, version, is_active, sort_order)
VALUES
  -- ── Online Storefront (8) ──
  (
    'polcat-online-return-001',
    'online_standard_return',
    'return_policy',
    'online',
    'physical',
    'shipping',
    'US',
    'generic',
    'Standard Return Policy (Online)',
    'A standard 30-day return policy for online stores shipping physical goods.',
    '## Return Policy

We want you to be happy with your purchase from [STORE_NAME]. If you''re not completely satisfied, we accept returns within [RETURN_WINDOW_DAYS] days of delivery.

### Return Conditions
- Items must be in their original condition, unworn and unwashed
- Items must have all original tags and packaging
- Proof of purchase is required (order confirmation or receipt)

### How to Initiate a Return
1. Email us at [CONTACT_EMAIL] with your order number
2. We will send you a return shipping label
3. Package your items securely and ship them back

### Return Shipping
[RETURN_SHIPPING_RESPONSIBILITY] pays for return shipping.

### Refund Processing
Refunds are processed within [REFUND_PROCESSING_DAYS] business days to your original payment method.',
    '[{"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},{"key":"RETURN_WINDOW_DAYS","label":"Return Window (days)","type":"number","required":true,"default":30},{"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null},{"key":"RETURN_SHIPPING_RESPONSIBILITY","label":"Who pays return shipping?","type":"select","options":["The customer","We (the store)"],"required":true,"default":"The customer"},{"key":"REFUND_PROCESSING_DAYS","label":"Refund Processing (days)","type":"number","required":true,"default":7}]'::jsonb,
    ARRAY['FTC_MAIL_ORDER'],
    '1.0.0',
    true,
    1
  ),
  (
    'polcat-online-shipping-001',
    'online_shipping_domestic',
    'shipping_policy',
    'online',
    'physical',
    'shipping',
    'US',
    'generic',
    'Domestic Shipping Policy (Online)',
    'Standard domestic shipping policy with flat-rate and free-shipping threshold.',
    '## Shipping Policy

### Processing Time
Orders are processed within [SHIPPING_HANDLING_DAYS] business days of receipt.

### Shipping Methods
- **Standard Shipping**: [STANDARD_SHIPPING_DAYS] business days — [STANDARD_SHIPPING_COST]
- **Express Shipping**: [EXPRESS_SHIPPING_DAYS] business days — [EXPRESS_SHIPPING_COST]
- **Free Shipping**: Available on orders over [FREE_SHIPPING_THRESHOLD]

### Order Tracking
Once your order ships, you will receive a tracking number via email.

### Shipping Restrictions
We currently ship within the United States only. We do not ship to P.O. boxes or APO/FPO addresses.',
    '[{"key":"SHIPPING_HANDLING_DAYS","label":"Handling Time (days)","type":"number","required":true,"default":2},{"key":"STANDARD_SHIPPING_DAYS","label":"Standard Shipping (days)","type":"number","required":true,"default":5},{"key":"STANDARD_SHIPPING_COST","label":"Standard Shipping Cost","type":"text","required":true,"default":"$5.95"},{"key":"EXPRESS_SHIPPING_DAYS","label":"Express Shipping (days)","type":"number","required":true,"default":2},{"key":"EXPRESS_SHIPPING_COST","label":"Express Shipping Cost","type":"text","required":true,"default":"$14.95"},{"key":"FREE_SHIPPING_THRESHOLD","label":"Free Shipping Threshold","type":"text","required":true,"default":"$50"}]'::jsonb,
    ARRAY['FTC_MAIL_ORDER'],
    '1.0.0',
    true,
    2
  ),
  (
    'polcat-online-privacy-ccpa-001',
    'online_privacy_ccpa',
    'privacy_policy',
    'online',
    'all',
    'all',
    'US',
    'generic',
    'Privacy Policy (CCPA Compliant)',
    'Privacy policy compliant with California Consumer Privacy Act (CCPA).',
    '## Privacy Policy

[STORE_NAME] ("we", "us", "our") respects your privacy and is committed to protecting your personal data. This privacy policy explains how we collect, use, and disclose your information.

### Information We Collect
- **Contact Information**: Name, email address, phone number, shipping address
- **Order Information**: Purchase history, payment method (we do not store full card numbers)
- **Usage Data**: Browsing activity on our storefront, device information

### How We Use Your Information
- To process and fulfill your orders
- To communicate with you about your orders
- To improve our products and services
- To send marketing emails (you may opt out at any time)

### Your Rights (California Residents)
Under the California Consumer Privacy Act (CCPA), you have the right to:
- Know what personal data we collect about you
- Request deletion of your personal data
- Opt out of the sale of your personal data (we do not sell your data)
- Non-discrimination for exercising your rights

### Contact Us
For privacy questions or requests, email us at [PRIVACY_CONTACT_EMAIL].',
    '[{"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},{"key":"PRIVACY_CONTACT_EMAIL","label":"Privacy Contact Email","type":"text","required":true,"default":null}]'::jsonb,
    ARRAY['CCPA'],
    '1.0.0',
    true,
    3
  ),
  (
    'polcat-online-terms-001',
    'online_terms_standard',
    'terms_of_service',
    'online',
    'all',
    'all',
    'US',
    'generic',
    'Terms of Service (Online Store)',
    'Standard terms of service for an online storefront.',
    '## Terms of Service

By placing an order with [STORE_NAME], you agree to these Terms of Service.

### Orders
- All orders are subject to acceptance and availability
- Prices are listed in [CURRENCY] and are subject to change without notice
- We reserve the right to refuse or cancel any order

### Payment
- Payment is due at the time of order placement
- We accept [ACCEPTED_PAYMENT_METHODS]

### Product Information
- We strive for accuracy in product descriptions and images
- Colors may vary slightly due to monitor settings
- We are not liable for typographical errors in pricing

### Liability
- Our liability is limited to the purchase price of products
- We are not liable for indirect or consequential damages

### Governing Law
These terms are governed by the laws of [GOVERNING_STATE].',
    '[{"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},{"key":"CURRENCY","label":"Currency","type":"text","required":true,"default":"USD"},{"key":"ACCEPTED_PAYMENT_METHODS","label":"Accepted Payment Methods","type":"text","required":true,"default":"all major credit cards and PayPal"},{"key":"GOVERNING_STATE","label":"Governing State","type":"text","required":true,"default":"your state"}]'::jsonb,
    ARRAY[]::text[],
    '1.0.0',
    true,
    4
  ),
  (
    'polcat-online-refund-001',
    'online_refund_standard',
    'refund_policy',
    'online',
    'physical',
    'shipping',
    'US',
    'generic',
    'Standard Refund Policy (Online)',
    'Standard refund policy for online stores with physical goods.',
    '## Refund Policy

### Refund Eligibility
- Refunds are available for items returned within [RETURN_WINDOW_DAYS] days of delivery
- Items must be in original condition with all tags and packaging

### Refund Process
1. We process refunds within [REFUND_PROCESSING_DAYS] business days of receiving your return
2. Refunds are issued to your original payment method
3. You will receive an email confirmation when your refund is processed

### Refund Types
- **Full Refund**: Issued for returned items in original condition
- **Partial Refund**: Issued for items with minor damage or missing packaging
- **Store Credit**: Available as an alternative to refund to original payment method

### Non-Refundable Items
- Gift cards
- Final sale items
- Personalized or custom orders

### Questions?
Contact us at [CONTACT_EMAIL] for any refund-related questions.',
    '[{"key":"RETURN_WINDOW_DAYS","label":"Return Window (days)","type":"number","required":true,"default":30},{"key":"REFUND_PROCESSING_DAYS","label":"Refund Processing (days)","type":"number","required":true,"default":7},{"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null}]'::jsonb,
    ARRAY[]::text[],
    '1.0.0',
    true,
    5
  ),
  (
    'polcat-online-refund-digital-001',
    'online_digital_refund',
    'refund_policy',
    'online',
    'digital',
    'all',
    'US',
    'generic',
    'Digital Goods Refund Policy',
    'Refund policy for digital products and downloadable content.',
    '## Refund Policy (Digital Goods)

### Digital Product Refunds
Due to the nature of digital products, all sales are generally final. However, we offer refunds in the following cases:

- **Technical Issues**: If the product is defective or cannot be downloaded, contact us within [TECH_ISSUE_WINDOW_DAYS] days for a full refund or replacement
- **Duplicate Purchase**: If you accidentally purchased the same item twice, contact us for a refund of the duplicate

### Non-Refundable
- Digital products that have been downloaded or accessed
- Subscription fees for partial billing periods
- Products purchased during a sale or promotion

### How to Request a Refund
Email us at [CONTACT_EMAIL] with your order number and a description of the issue.',
    '[{"key":"TECH_ISSUE_WINDOW_DAYS","label":"Technical Issue Window (days)","type":"number","required":true,"default":14},{"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null}]'::jsonb,
    ARRAY[]::text[],
    '1.0.0',
    true,
    6
  ),
  (
    'polcat-online-privacy-gdpr-001',
    'online_privacy_gdpr',
    'privacy_policy',
    'online',
    'all',
    'all',
    'EU',
    'generic',
    'Privacy Policy (GDPR Compliant)',
    'Privacy policy compliant with EU General Data Protection Regulation (GDPR).',
    '## Privacy Policy

[STORE_NAME] ("we", "us", "our") is committed to protecting your personal data in compliance with the General Data Protection Regulation (GDPR).

### Data Controller
[STORE_NAME] is the data controller for your personal data. For data protection inquiries, contact our Data Protection Officer at [DPO_CONTACT_EMAIL].

### Lawful Basis for Processing
We process your personal data under the following lawful bases:
- **Contract**: To fulfill your orders and provide customer service
- **Consent**: For marketing communications (you may withdraw consent at any time)
- **Legitimate Interest**: To improve our services and prevent fraud

### Data Subject Rights
Under GDPR, you have the right to:
- Access your personal data
- Rectify inaccurate data
- Erase your personal data ("right to be forgotten")
- Restrict processing
- Data portability
- Object to processing
- Withdraw consent at any time

### Data Retention
We retain personal data only as long as necessary for the purposes described, typically [RETENTION_PERIOD] years after your last interaction.

### International Transfers
Your data may be transferred outside the EU/EEA. We ensure appropriate safeguards are in place, including Standard Contractual Clauses.',
    '[{"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},{"key":"DPO_CONTACT_EMAIL","label":"Data Protection Officer Email","type":"text","required":true,"default":null},{"key":"RETENTION_PERIOD","label":"Data Retention Period (years)","type":"number","required":true,"default":7}]'::jsonb,
    ARRAY['GDPR'],
    '1.0.0',
    true,
    7
  ),
  (
    'polcat-online-privacy-comprehensive-001',
    'online_privacy_comprehensive',
    'privacy_policy',
    'online',
    'all',
    'all',
    'GLOBAL',
    'generic',
    'Privacy Policy (Multi-Jurisdiction)',
    'Comprehensive privacy policy covering CCPA, GDPR, and LGPD requirements.',
    '## Privacy Policy

[STORE_NAME] ("we", "us", "our") respects your privacy. This policy explains our data practices in compliance with CCPA, GDPR, LGPD, and other applicable privacy laws.

### Information We Collect
- **Identity**: Name, email, phone number
- **Contact**: Shipping address, billing address
- **Transaction**: Order history, payment method (card numbers not stored)
- **Technical**: IP address, browser type, browsing activity

### How We Use Your Data
- Process and ship your orders
- Provide customer support
- Send order updates and (with consent) marketing emails
- Improve our storefront and product offerings
- Prevent fraud and abuse

### Your Rights
Depending on your jurisdiction, you may have the right to:
- **Access**: Request a copy of your personal data
- **Delete**: Request erasure of your personal data
- **Correct**: Request correction of inaccurate data
- **Port**: Receive your data in a portable format
- **Object**: Object to certain processing activities
- **Opt Out**: Unsubscribe from marketing at any time

### Data Retention
We retain data only as long as necessary — typically [RETENTION_PERIOD] years after your last transaction.

### Contact
For privacy requests, email [PRIVACY_CONTACT_EMAIL]. We respond within 30 days.',
    '[{"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},{"key":"PRIVACY_CONTACT_EMAIL","label":"Privacy Contact Email","type":"text","required":true,"default":null},{"key":"RETENTION_PERIOD","label":"Retention Period (years)","type":"number","required":true,"default":7}]'::jsonb,
    ARRAY['CCPA','GDPR','LGPD'],
    '1.0.0',
    true,
    8
  ),

  -- ── Universal (4) ──
  (
    'polcat-univ-privacy-min-001',
    'universal_privacy_minimal',
    'privacy_policy',
    'all',
    'all',
    'all',
    'GLOBAL',
    'generic',
    'Minimal Privacy Policy',
    'Bare-minimum privacy disclosure suitable for trial-tier or simple storefronts.',
    '## Privacy Policy

[STORE_NAME] collects basic information (name, email, order details) to process your orders. We do not sell your personal information. Contact us at [CONTACT_EMAIL] with any privacy questions.',
    '[{"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},{"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null}]'::jsonb,
    ARRAY[]::text[],
    '1.0.0',
    true,
    100
  ),
  (
    'polcat-univ-terms-min-001',
    'universal_terms_minimal',
    'terms_of_service',
    'all',
    'all',
    'all',
    'GLOBAL',
    'generic',
    'Minimal Terms of Service',
    'Bare-minimum terms of service for trial-tier or simple storefronts.',
    '## Terms of Service

By using this storefront, you agree to: (1) provide accurate information when placing orders, (2) pay for all items purchased, and (3) acknowledge that prices may change without notice. All sales are subject to applicable taxes.',
    '[]'::jsonb,
    ARRAY[]::text[],
    '1.0.0',
    true,
    101
  ),
  (
    'polcat-univ-return-min-001',
    'universal_return_minimal',
    'return_policy',
    'all',
    'physical',
    'all',
    'GLOBAL',
    'generic',
    'Minimal Return Policy',
    'Simple 7-day return policy for basic storefronts.',
    '## Return Policy

Items can be returned within 7 days of purchase if in original condition. Contact us at [CONTACT_EMAIL] to arrange a return.',
    '[{"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null}]'::jsonb,
    ARRAY[]::text[],
    '1.0.0',
    true,
    102
  ),
  (
    'polcat-univ-refund-min-001',
    'universal_refund_minimal',
    'refund_policy',
    'all',
    'all',
    'all',
    'GLOBAL',
    'generic',
    'Minimal Refund Policy',
    'Simple refund-to-original-payment policy for basic storefronts.',
    '## Refund Policy

Refunds are issued to your original payment method within 5-7 business days. Contact us at [CONTACT_EMAIL] with any refund questions.',
    '[{"key":"CONTACT_EMAIL","label":"Contact Email","type":"text","required":true,"default":null}]'::jsonb,
    ARRAY[]::text[],
    '1.0.0',
    true,
    103
  ),

  -- ── Social (3) ──
  (
    'polcat-social-return-meta-001',
    'social_return_meta',
    'return_policy',
    'social',
    'physical',
    'shipping',
    'US',
    'meta',
    'Return Policy (Meta Commerce Compliant)',
    'Return policy compliant with Meta Commerce Merchant Quality guidelines.',
    '## Return Policy

We accept returns within [RETURN_WINDOW_DAYS] days of delivery, in accordance with Meta Commerce policies.

### Return Conditions
- Items must be in original condition with tags attached
- Proof of purchase required (order confirmation from Instagram/Facebook)

### How to Return
1. Go to your Instagram or Facebook order history
2. Select the item you want to return
3. Follow the return instructions provided

### Refunds
Refunds are processed within [REFUND_PROCESSING_DAYS] business days to your original payment method.

### Meta Commerce Buyer Protection
Purchases made through Instagram Shopping and Facebook Shop are covered by Meta Commerce''s Buyer Protection Policy.',
    '[{"key":"RETURN_WINDOW_DAYS","label":"Return Window (days)","type":"number","required":true,"default":30},{"key":"REFUND_PROCESSING_DAYS","label":"Refund Processing (days)","type":"number","required":true,"default":7}]'::jsonb,
    ARRAY['META_COMMERCE'],
    '1.0.0',
    true,
    200
  ),
  (
    'polcat-social-return-tiktok-001',
    'social_return_tiktok',
    'return_policy',
    'social',
    'physical',
    'shipping',
    'US',
    'tiktok',
    'Return Policy (TikTok Shop Compliant)',
    'Return policy compliant with TikTok Shop Seller Policies.',
    '## Return Policy

We accept returns within [RETURN_WINDOW_DAYS] days of delivery, in accordance with TikTok Shop return policies.

### Return Conditions
- Items must be unused and in original packaging
- All accessories and tags must be included
- TikTok Shop order number required for processing

### How to Return
1. Open the TikTok app and go to your order
2. Tap "Return/Refund" and follow the instructions
3. Ship the item back using the provided return label

### Refunds
Refunds are processed within [REFUND_PROCESSING_DAYS] business days. The refund will be issued to your original payment method used on TikTok Shop.',
    '[{"key":"RETURN_WINDOW_DAYS","label":"Return Window (days)","type":"number","required":true,"default":30},{"key":"REFUND_PROCESSING_DAYS","label":"Refund Processing (days)","type":"number","required":true,"default":7}]'::jsonb,
    ARRAY['TIKTOK_SHOP'],
    '1.0.0',
    true,
    201
  ),
  (
    'polcat-social-privacy-001',
    'social_privacy_social',
    'privacy_policy',
    'social',
    'all',
    'all',
    'GLOBAL',
    'generic',
    'Privacy Policy (Social Commerce)',
    'Privacy policy with social platform data sharing disclosures.',
    '## Privacy Policy

[STORE_NAME] respects your privacy. This policy explains how we handle data when you shop through our social media storefronts (Instagram, Facebook, TikTok).

### Information We Collect
- Order details from social commerce platforms (Instagram Shopping, Facebook Shop, TikTok Shop)
- Your name, shipping address, and contact information as provided by the platform
- Product viewing and interaction data on our social storefronts

### Social Platform Data
When you purchase through a social platform:
- The platform shares your order information with us for fulfillment
- We do not have access to your social media account or activity
- Each platform''s privacy policy governs your data on their service

### How We Use Your Data
- Process and ship your orders
- Provide customer service for your purchases
- We do not use your data for marketing without your consent

### Your Rights
You may request access to, correction of, or deletion of your personal data. Contact us at [PRIVACY_CONTACT_EMAIL].

### Data Sharing
We do not sell your personal information. We share data only with shipping carriers and payment processors as necessary to fulfill your orders.',
    '[{"key":"STORE_NAME","label":"Store Name","type":"text","required":true,"default":null},{"key":"PRIVACY_CONTACT_EMAIL","label":"Privacy Contact Email","type":"text","required":true,"default":null}]'::jsonb,
    ARRAY['CCPA'],
    '1.0.0',
    true,
    202
  )
ON CONFLICT (template_key) DO NOTHING;
