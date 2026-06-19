/**
 * Seed script for bot guardrail rules, intents, and skill registry
 *
 * Run with: npx tsx prisma/seed-bot-data.ts
 */
/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ====================
// GUARDRAIL RULES (global, tenant_id = null)
// ====================
const GUARDRAIL_RULES = [
  {
    rule_type: 'banned_phrase',
    pattern: 'competitor1,competitor2,amazon,walmart,target',
    action: 'flag',
    severity: 'low',
    response_template: null,
  },
  {
    rule_type: 'pii_detection',
    pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
    action: 'mask',
    severity: 'high',
    response_template: 'For your security, please avoid sharing sensitive information like SSNs.',
  },
  {
    rule_type: 'pii_detection',
    pattern: '\\b(?:\\d[ -]*?){13,16}\\b',
    action: 'mask',
    severity: 'critical',
    response_template: 'For your security, please do not share credit card numbers in chat.',
  },
  {
    rule_type: 'moderation',
    pattern: 'profanity1,profanity2,profanity3,profanity4,profanity5',
    action: 'block',
    severity: 'high',
    response_template: 'Please keep our conversation respectful and appropriate.',
  },
  {
    rule_type: 'pii_detection',
    pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
    action: 'flag',
    severity: 'low',
    response_template: null,
  },
];

// ====================
// INTENTS
// ====================
const INTENTS = [
  {
    name: 'product.search',
    category: 'product',
    description: 'User wants to find or search for products',
    examples: [
      'do you have any toys',
      'looking for a gift',
      'search for blue shirts',
      'find products on sale',
      'show me what you sell',
      'looking for kids items',
      'do you sell electronics',
    ],
    confidence_threshold: 0.3,
    mapped_skill: 'product-search',
  },
  {
    name: 'inventory.check',
    category: 'product',
    description: 'User wants to check if a product is in stock',
    examples: [
      'is this in stock',
      'do you have this available',
      'is this item available',
      'when will this be back in stock',
      'is this out of stock',
      'availability check',
    ],
    confidence_threshold: 0.3,
    mapped_skill: 'inventory',
  },
  {
    name: 'order.status',
    category: 'order',
    description: 'User wants to check their order status',
    examples: [
      'where is my order',
      'order status',
      'track my order',
      'when will my order arrive',
      'has my order shipped',
      'check my order',
    ],
    confidence_threshold: 0.3,
    mapped_skill: 'order-tracking',
  },
  {
    name: 'store.hours',
    category: 'store',
    description: 'User wants to know store hours',
    examples: [
      'what are your hours',
      'are you open today',
      'when do you close',
      'what time do you open',
      'store hours',
      'are you open on weekends',
    ],
    confidence_threshold: 0.3,
    mapped_skill: 'store-hours',
  },
  {
    name: 'general.inquiry',
    category: 'general',
    description: 'General questions about the store',
    examples: [
      'help',
      'i have a question',
      'can you help me',
      'i need assistance',
      'how does this work',
      'tell me more',
    ],
    confidence_threshold: 0.3,
    mapped_skill: null,
  },
];

// ====================
// SKILLS
// ====================
const SKILLS = [
  {
    name: 'product-search',
    version: '1.0.0',
    description: 'Search tenant products by keyword, category, or attributes',
    endpoint: '/api/public/tenant/:tenantId/products',
    required_capabilities: ['chatbot_skill_product_search'],
    tier_gates: ['commitment', 'ecommerce', 'omnichannel', 'professional', 'enterprise', 'organization', 'chain_starter', 'chain_professional', 'chain_enterprise'],
    capability_gates: ['chatbot_skills_enabled'],
    tenant_status_gates: ['active', 'trialing'],
    featured_aware: true,
    refresh_cadence_minutes: 15,
    status: 'active',
    skill_card_schema: {
      type: 'product_list',
      fields: ['name', 'price', 'image', 'slug'],
      max_results: 5,
    },
    default_config: { max_results: 5, fuzzy_matching: true },
  },
  {
    name: 'inventory',
    version: '1.0.0',
    description: 'Check inventory for a specific product',
    endpoint: '/api/public/tenant/:tenantId/products/:slug/inventory',
    required_capabilities: ['chatbot_skill_inventory'],
    tier_gates: ['commitment', 'ecommerce', 'omnichannel', 'professional', 'enterprise', 'organization', 'chain_starter', 'chain_professional', 'chain_enterprise'],
    capability_gates: ['chatbot_skills_enabled'],
    tenant_status_gates: ['active', 'trialing'],
    featured_aware: false,
    refresh_cadence_minutes: 5,
    status: 'active',
    skill_card_schema: {
      type: 'inventory_status',
      fields: ['in_stock', 'quantity', 'expected_restock'],
    },
    default_config: { show_restock_date: true },
  },
  {
    name: 'order-tracking',
    version: '1.0.0',
    description: 'Track order status by order number',
    endpoint: '/api/public/tenant/:tenantId/orders/track',
    required_capabilities: ['chatbot_skill_order_tracking'],
    tier_gates: ['omnichannel', 'professional', 'enterprise', 'organization', 'chain_starter', 'chain_professional', 'chain_enterprise'],
    capability_gates: ['chatbot_skills_enabled'],
    tenant_status_gates: ['active', 'trialing'],
    featured_aware: false,
    refresh_cadence_minutes: 5,
    status: 'active',
    skill_card_schema: {
      type: 'order_status',
      fields: ['status', 'tracking_number', 'estimated_delivery'],
    },
    default_config: { require_email: true },
  },
  {
    name: 'store-hours',
    version: '1.0.0',
    description: 'Get current store hours and open/closed status',
    endpoint: '/api/public/tenant/:tenantId/business-hours',
    required_capabilities: ['chatbot_skill_store_hours'],
    tier_gates: ['commitment', 'ecommerce', 'omnichannel', 'professional', 'enterprise', 'organization', 'chain_starter', 'chain_professional', 'chain_enterprise'],
    capability_gates: ['chatbot_skills_enabled'],
    tenant_status_gates: ['active', 'trialing'],
    featured_aware: false,
    refresh_cadence_minutes: 60,
    status: 'active',
    skill_card_schema: {
      type: 'store_hours',
      fields: ['is_open', 'today_hours', 'next_open'],
    },
    default_config: { timezone: 'auto' },
  },
];

async function main() {
  console.log('🌱 Seeding bot guardrail rules, intents, and skills...');

  // 1. Guardrail rules
  for (const rule of GUARDRAIL_RULES) {
    const existing = await prisma.bot_guardrail_rules.findFirst({
      where: { rule_type: rule.rule_type, pattern: rule.pattern, tenant_id: null },
    });
    if (existing) {
      await prisma.bot_guardrail_rules.update({
        where: { id: existing.id },
        data: { ...rule, is_active: true, updated_at: new Date() },
      });
    } else {
      await prisma.bot_guardrail_rules.create({
        data: { ...rule, tenant_id: null, is_active: true },
      });
    }
  }
  console.log(`✓ Seeded ${GUARDRAIL_RULES.length} guardrail rules`);

  // 2. Intents
  for (const intent of INTENTS) {
    await prisma.bot_intents.upsert({
      where: { name: intent.name },
      update: {
        category: intent.category,
        description: intent.description,
        examples: intent.examples,
        confidence_threshold: intent.confidence_threshold,
        mapped_skill: intent.mapped_skill,
        is_active: true,
        updated_at: new Date(),
      },
      create: {
        name: intent.name,
        category: intent.category,
        description: intent.description,
        examples: intent.examples,
        confidence_threshold: intent.confidence_threshold,
        mapped_skill: intent.mapped_skill,
        is_active: true,
      },
    });
  }
  console.log(`✓ Seeded ${INTENTS.length} intents`);

  // 3. Skills
  for (const skill of SKILLS) {
    await prisma.bot_skills.upsert({
      where: { name: skill.name },
      update: {
        version: skill.version,
        description: skill.description,
        endpoint: skill.endpoint,
        required_capabilities: skill.required_capabilities,
        tier_gates: skill.tier_gates,
        capability_gates: skill.capability_gates,
        tenant_status_gates: skill.tenant_status_gates,
        featured_aware: skill.featured_aware,
        refresh_cadence_minutes: skill.refresh_cadence_minutes,
        status: skill.status,
        skill_card_schema: skill.skill_card_schema as any,
        default_config: skill.default_config as any,
        updated_at: new Date(),
      },
      create: {
        name: skill.name,
        version: skill.version,
        description: skill.description,
        endpoint: skill.endpoint,
        required_capabilities: skill.required_capabilities,
        tier_gates: skill.tier_gates,
        capability_gates: skill.capability_gates,
        tenant_status_gates: skill.tenant_status_gates,
        featured_aware: skill.featured_aware,
        refresh_cadence_minutes: skill.refresh_cadence_minutes,
        status: skill.status,
        skill_card_schema: skill.skill_card_schema as any,
        default_config: skill.default_config as any,
      },
    });
  }
  console.log(`✓ Seeded ${SKILLS.length} skills`);

  console.log('✅ Bot data seeding complete!');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
