-- ============================================================
-- Migration 130: Marketing Ops Default Prompt Template Seeds
-- ============================================================
-- Description: Seeds 8 default prompt templates (seek, fulfill, filter, retainer)
--   as specified in the Sprint Plan v2 §6.1 Default Template Set.
-- Prerequisite: 128_marketing_ops.sql applied
-- Date: 2026-07-29
-- Design doc: docs/LocalBiz/local_marketing_ops_sprint_plan_v2.md
-- ============================================================

-- Use explicit IDs so re-running is idempotent via ON CONFLICT
-- ID format: mpt-seed-{type}-{seq}

-- ============================================================
-- Seek Templates
-- ============================================================

INSERT INTO mkt_prompt_templates_list (id, name, prompt_type, category, version, body, variables, is_active, is_default, created_by, created_at, updated_at)
VALUES (
  'mpt-seed-seek-001',
  'Seek: Business Audit',
  'seek',
  NULL,
  1,
  'You are a local business marketing analyst. Research the following business and provide a structured audit:

Business: {{business_name}}
City: {{city}}
Category: {{category}}

Provide:
1. Google Business Profile status (claimed/unclaimed, rating, review count)
2. Website assessment (working/broken/none, mobile-friendly)
3. NAP consistency (name/address/phone across directories)
4. Top 3 unaddressed negative reviews (with dates)
5. Pain score (0-10) based on: unclaimed GBP, low review response rate, no website, NAP inconsistencies
6. Recommended tier (tier_1: high pain + budget, tier_2: medium, tier_3: low)
7. Estimated monthly fee range

Format as structured JSON.',
  '["business_name","city","category"]'::jsonb,
  true,
  true,
  'system',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  is_active = true,
  is_default = true,
  updated_at = NOW();

INSERT INTO mkt_prompt_templates_list (id, name, prompt_type, category, version, body, variables, is_active, is_default, created_by, created_at, updated_at)
VALUES (
  'mpt-seed-seek-002',
  'Seek: Category Analysis',
  'seek',
  NULL,
  1,
  'You are a local market research analyst. Analyze the {{category}} landscape in {{city}}.

Provide:
1. Total businesses in this category in {{city}} (approximate)
2. Average GBP rating and review count
3. Percentage with claimed GBP profiles
4. Percentage with websites
5. Top 5 competitors by review count and rating
6. Common pain points (reviews, photos, hours accuracy)
7. Opportunity gaps (underserved neighborhoods, missing services)
8. Recommended outreach angle for prospecting

Format as structured JSON.',
  '["category","city"]'::jsonb,
  true,
  false,
  'system',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  is_active = true,
  updated_at = NOW();

INSERT INTO mkt_prompt_templates_list (id, name, prompt_type, category, version, body, variables, is_active, is_default, created_by, created_at, updated_at)
VALUES (
  'mpt-seed-seek-003',
  'Seek: City Ecosystem',
  'seek',
  NULL,
  1,
  'You are a local market ecosystem analyst. Provide an overview of the business landscape in {{city}}.

Provide:
1. Top 10 business categories by density in {{city}}
2. Categories with highest average GBP ratings
3. Categories with most unclaimed GBP profiles (opportunity)
4. Neighborhoods with the most businesses
5. Average review counts per category
6. Categories with the worst review response rates
7. Top 3 categories recommended for prospecting (high pain, high budget, high density)

Format as structured JSON.',
  '["city"]'::jsonb,
  true,
  false,
  'system',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  is_active = true,
  updated_at = NOW();

-- ============================================================
-- Fulfill Templates
-- ============================================================

INSERT INTO mkt_prompt_templates_list (id, name, prompt_type, category, version, body, variables, is_active, is_default, created_by, created_at, updated_at)
VALUES (
  'mpt-seed-fulfill-001',
  'Fulfill: Review Responses',
  'fulfill',
  NULL,
  1,
  'You are a professional review response writer for local businesses. Write responses to the following reviews for {{business_name}} in {{city}}, a {{category}} business.

Business voice/tone: {{voice}}

Reviews to respond to:
{{reviews}}

Guidelines:
- Thank the reviewer by name if available
- Reference a specific detail from their review
- Match the business voice ({{voice}})
- Negative reviews: acknowledge concern without defensiveness, offer resolution, max 75 words
- Positive reviews: express gratitude, mention specific detail, max 50 words
- Do NOT include promotions, review requests, or disclosures
- Do NOT invent details not in the review
- Ensure proper grammar and spelling

Format: Number each response to match the review number.',
  '["business_name","city","category","voice","reviews"]'::jsonb,
  true,
  true,
  'system',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  is_active = true,
  is_default = true,
  updated_at = NOW();

INSERT INTO mkt_prompt_templates_list (id, name, prompt_type, category, version, body, variables, is_active, is_default, created_by, created_at, updated_at)
VALUES (
  'mpt-seed-fulfill-002',
  'Fulfill: Service Menu',
  'fulfill',
  NULL,
  1,
  'You are a professional copywriter for local businesses. Create a compelling service menu for {{business_name}}, a {{category}} business.

Services offered:
{{services}}

Provide:
1. Business name and tagline
2. 5-8 core services with descriptions (2-3 sentences each)
3. Pricing tiers if applicable (Basic/Standard/Premium)
4. Call-to-action for booking
5. Contact information placeholder
6. Brief "Why choose us" section (3 bullet points)

Tone: Professional, approachable, locally-rooted. Avoid jargon.',
  '["business_name","category","services"]'::jsonb,
  true,
  false,
  'system',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  is_active = true,
  updated_at = NOW();

INSERT INTO mkt_prompt_templates_list (id, name, prompt_type, category, version, body, variables, is_active, is_default, created_by, created_at, updated_at)
VALUES (
  'mpt-seed-fulfill-003',
  'Fulfill: GBP Optimization',
  'fulfill',
  NULL,
  1,
  'You are a Google Business Profile optimization expert. Create an optimization plan for {{business_name}}, a {{category}} business in {{city}}.

Services offered:
{{services}}

Provide:
1. Optimized business description (750 chars max, keyword-rich, natural)
2. Recommended GBP categories (primary + 2 secondary)
3. Service area description
4. 5 suggested GBP posts (What''s New format, 100-300 words each)
5. Attributes to enable (e.g., "Women-led", "Identifies as Black-owned")
6. Q&A section: 5 common questions with answers
7. Photo recommendations: types and captions for 5 photos

Format as structured JSON.',
  '["business_name","city","category","services"]'::jsonb,
  true,
  false,
  'system',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  is_active = true,
  updated_at = NOW();

-- ============================================================
-- Filter Templates
-- ============================================================

INSERT INTO mkt_prompt_templates_list (id, name, prompt_type, category, version, body, variables, is_active, is_default, created_by, created_at, updated_at)
VALUES (
  'mpt-seed-filter-001',
  'Filter: Response Quality',
  'filter',
  NULL,
  1,
  'You are a quality assurance reviewer for AI-generated review responses. Evaluate the following responses for {{business_name}}.

Business voice: {{voice}}

Responses to review:
{{responses}}

For EACH response, check:
1. Name usage: Does it thank the reviewer by name? (if name available)
2. Specific reference: Does it mention a detail from the review?
3. Tone match: Does it match the "{{voice}}" voice?
4. Length compliance: Negative ≤75 words? Positive ≤50 words?
5. Negative handling: Acknowledges without defensiveness?
6. Fact safety: No invented details?
7. Platform compliance: No promos, review requests, or disclosures?
8. Grammar/spelling: Any errors?

For each response, output:
- Response number
- Pass/fail for each check
- Suggested fix (if any check fails)

End with: Overall pass rate (X/N responses passed all checks).',
  '["business_name","voice","responses"]'::jsonb,
  true,
  true,
  'system',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  is_active = true,
  is_default = true,
  updated_at = NOW();

-- ============================================================
-- Retainer Templates
-- ============================================================

INSERT INTO mkt_prompt_templates_list (id, name, prompt_type, category, version, body, variables, is_active, is_default, created_by, created_at, updated_at)
VALUES (
  'mpt-seed-retainer-001',
  'Retainer: Follow-up Sequence',
  'retainer',
  NULL,
  1,
  'You are a customer success strategist for local business marketing services. Create a 4-week follow-up sequence for {{business_name}}, a {{category}} business in {{city}} that just received their marketing deliverable.

Provide:
1. Week 1: Check-in email (deliverable received, initial results, ask for feedback)
2. Week 2: Value-add email (share a relevant industry insight or tip)
3. Week 3: Case study email (share a success story from a similar business)
4. Week 4: Retainer pitch email (propose ongoing monthly services with clear ROI)

For each email:
- Subject line
- Body (150-250 words)
- Clear CTA
- Professional but warm tone

Include a summary of the retainer offer:
- Monthly fee range
- Services included (GBP monitoring, review responses, monthly reports, content posts)
- Value proposition (time saved, consistent online presence)',
  '["business_name","category","city"]'::jsonb,
  true,
  true,
  'system',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  is_active = true,
  is_default = true,
  updated_at = NOW();

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- SELECT name, prompt_type, is_default, is_active FROM mkt_prompt_templates_list
--   WHERE id LIKE 'mpt-seed-%' ORDER BY prompt_type, name;
