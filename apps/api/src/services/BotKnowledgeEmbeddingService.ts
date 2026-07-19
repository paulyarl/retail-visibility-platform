/**
 * Bot Knowledge Embedding Service
 *
 * Manages embeddings for structured knowledge sources (badge registry, store policies)
 * in a unified bot_knowledge_embeddings table with source_type discriminator.
 * Uses pgvector for semantic search, replacing fragile keyword-gated context injection.
 */

import { getDirectPool } from '../utils/db-pool';
import { prisma } from '../prisma';
import { logger } from '../logger';
import aiProviderFactory from './ai-providers';
import BotRagService from './BotRagService';
import { getTenantBadges, type BadgeTypeMeta } from './BadgeRegistryService';
import { StorefrontPolicyService, type PolicyType } from './StorefrontPolicyService';

const SIMILARITY_THRESHOLD = 0.7;

const POLICY_TYPES: PolicyType[] = [
  'return_policy',
  'shipping_policy',
  'refund_policy',
  'privacy_policy',
  'terms_of_service',
];

const POLICY_LABELS: Record<PolicyType, string> = {
  return_policy: 'Return Policy',
  shipping_policy: 'Shipping Policy',
  refund_policy: 'Refund Policy',
  privacy_policy: 'Privacy Policy',
  terms_of_service: 'Terms of Service',
};

export interface KnowledgeRagResult {
  chunks: { sourceType: string; sourceId: string; chunkText: string; score: number }[];
}

class BotKnowledgeEmbeddingService {
  private static instance: BotKnowledgeEmbeddingService;

  private constructor() {}

  static getInstance(): BotKnowledgeEmbeddingService {
    if (!BotKnowledgeEmbeddingService.instance) {
      BotKnowledgeEmbeddingService.instance = new BotKnowledgeEmbeddingService();
    }
    return BotKnowledgeEmbeddingService.instance;
  }

  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const result = await aiProviderFactory.generateEmbeddings({ inputs: texts });
    return result.embeddings;
  }

  // ─── Badge Registry Embeddings ───

  /**
   * Refresh badge registry embeddings for a tenant.
   * Reads system + custom badges from BadgeRegistryService, chunks each into text,
   * and embeds into bot_knowledge_embeddings with source_type='badge_registry'.
   */
  async refreshBadgeRegistryEmbeddings(tenantId: string): Promise<{ processed: number; chunks: number }> {
    let badges: BadgeTypeMeta[];
    try {
      badges = await getTenantBadges(tenantId);
    } catch (err) {
      logger.warn('[BotKnowledgeEmbeddingService] Failed to load badge registry', undefined, {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { processed: 0, chunks: 0 };
    }

    const pool = getDirectPool();

    // Delete existing badge_registry embeddings for this tenant
    await pool.query(
      "DELETE FROM bot_knowledge_embeddings WHERE tenant_id = $1 AND source_type = 'badge_registry'",
      [tenantId]
    );

    if (badges.length === 0) {
      return { processed: 0, chunks: 0 };
    }

    const embeddingModel = await BotRagService.getInstance().getEmbeddingModel();
    const chunks: { sourceId: string; text: string }[] = [];

    for (const badge of badges) {
      const text = this.chunkBadge(badge);
      chunks.push({ sourceId: badge.key, text });
    }

    const embeddings = await this.generateEmbeddings(chunks.map(c => c.text));

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      const embeddingStr = `[${embedding.join(',')}]`;

      await pool.query(
        `INSERT INTO bot_knowledge_embeddings (tenant_id, source_type, source_id, chunk_text, chunk_index, embedding, model)
         VALUES ($1, 'badge_registry', $2, $3, 0, $4::vector, $5)
         ON CONFLICT (tenant_id, source_type, source_id, chunk_index) DO UPDATE SET
           chunk_text = EXCLUDED.chunk_text,
           embedding = EXCLUDED.embedding,
           model = EXCLUDED.model,
           updated_at = now()`,
        [tenantId, chunk.sourceId, chunk.text, embeddingStr, embeddingModel]
      );
    }

    logger.info('[BotKnowledgeEmbeddingService] Refreshed badge registry embeddings', undefined, {
      tenantId,
      badges: badges.length,
      chunks: chunks.length,
    });

    return { processed: badges.length, chunks: chunks.length };
  }

  private chunkBadge(badge: BadgeTypeMeta): string {
    const parts = [
      `Badge: ${badge.label}`,
      `Key: ${badge.key}`,
      badge.description ? `Description: ${badge.description}` : '',
      `Group: ${badge.group}${badge.isSystem ? ' (system)' : ' (custom)'}`,
      badge.autoAssignRule ? `Auto-assign rule: ${JSON.stringify(badge.autoAssignRule)}` : '',
      badge.conflictWith && badge.conflictWith.length > 0
        ? `Conflicts with: ${badge.conflictWith.join(', ')}`
        : '',
    ].filter(Boolean);
    return parts.join('\n');
  }

  // ─── Policy Embeddings ───

  /**
   * Refresh store policy embeddings for a tenant.
   * Reads tenant_storefront_policies, chunks each policy into text,
   * and embeds into bot_knowledge_embeddings with source_type='policy'.
   */
  async refreshPolicyEmbeddings(tenantId: string): Promise<{ processed: number; chunks: number }> {
    const policies = await StorefrontPolicyService.getInstance().getPolicies(tenantId);

    const pool = getDirectPool();

    // Delete existing policy embeddings for this tenant
    await pool.query(
      "DELETE FROM bot_knowledge_embeddings WHERE tenant_id = $1 AND source_type = 'policy'",
      [tenantId]
    );

    const chunks: { sourceId: string; text: string }[] = [];

    for (const policyType of POLICY_TYPES) {
      const text = policies[policyType];
      if (text && text.trim().length > 0) {
        chunks.push({
          sourceId: policyType,
          text: `${POLICY_LABELS[policyType]}:\n${text}`,
        });
      }
    }

    if (chunks.length === 0) {
      return { processed: 0, chunks: 0 };
    }

    const embeddingModel = await BotRagService.getInstance().getEmbeddingModel();
    const embeddings = await this.generateEmbeddings(chunks.map(c => c.text));

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      const embeddingStr = `[${embedding.join(',')}]`;

      await pool.query(
        `INSERT INTO bot_knowledge_embeddings (tenant_id, source_type, source_id, chunk_text, chunk_index, embedding, model)
         VALUES ($1, 'policy', $2, $3, 0, $4::vector, $5)
         ON CONFLICT (tenant_id, source_type, source_id, chunk_index) DO UPDATE SET
           chunk_text = EXCLUDED.chunk_text,
           embedding = EXCLUDED.embedding,
           model = EXCLUDED.model,
           updated_at = now()`,
        [tenantId, chunk.sourceId, chunk.text, embeddingStr, embeddingModel]
      );
    }

    logger.info('[BotKnowledgeEmbeddingService] Refreshed policy embeddings', undefined, {
      tenantId,
      policies: chunks.length,
    });

    return { processed: chunks.length, chunks: chunks.length };
  }

  // ─── Business Info Embeddings ───

  /**
   * Refresh business info embeddings for a tenant.
   * Reads tenant_business_profiles_list and chunks into a single embedding
   * with source_type='business_info'.
   */
  async refreshBusinessInfoEmbeddings(tenantId: string): Promise<{ processed: number; chunks: number }> {
    const profile = await prisma.tenant_business_profiles_list.findUnique({
      where: { tenant_id: tenantId },
    });

    const pool = getDirectPool();

    // Delete existing business_info embeddings for this tenant
    await pool.query(
      "DELETE FROM bot_knowledge_embeddings WHERE tenant_id = $1 AND source_type = 'business_info'",
      [tenantId]
    );

    if (!profile) {
      return { processed: 0, chunks: 0 };
    }

    const text = this.chunkBusinessInfo(profile);
    if (!text) {
      return { processed: 0, chunks: 0 };
    }

    const embeddingModel = await BotRagService.getInstance().getEmbeddingModel();
    const embeddings = await this.generateEmbeddings([text]);
    const embeddingStr = `[${embeddings[0].join(',')}]`;

    await pool.query(
      `INSERT INTO bot_knowledge_embeddings (tenant_id, source_type, source_id, chunk_text, chunk_index, embedding, model)
       VALUES ($1, 'business_info', 'business_profile', $2, 0, $3::vector, $4)
       ON CONFLICT (tenant_id, source_type, source_id, chunk_index) DO UPDATE SET
         chunk_text = EXCLUDED.chunk_text,
         embedding = EXCLUDED.embedding,
         model = EXCLUDED.model,
         updated_at = now()`,
      [tenantId, text, embeddingStr, embeddingModel]
    );

    logger.info('[BotKnowledgeEmbeddingService] Refreshed business info embeddings', undefined, {
      tenantId,
    });

    return { processed: 1, chunks: 1 };
  }

  private chunkBusinessInfo(profile: any): string | null {
    const parts: string[] = ['Store Information:'];

    if (profile.business_name) parts.push(`Name: ${profile.business_name}`);
    if (profile.business_description) parts.push(`Description: ${profile.business_description}`);

    const addressParts = [
      profile.address_line1,
      profile.address_line2,
      profile.city,
      profile.state,
      profile.postal_code,
      profile.country_code,
    ].filter(Boolean);
    if (addressParts.length > 0) {
      parts.push(`Address: ${addressParts.join(', ')}`);
    }

    if (profile.phone_number) parts.push(`Phone: ${profile.phone_number}`);
    if (profile.email) parts.push(`Email: ${profile.email}`);
    if (profile.website) parts.push(`Website: ${profile.website}`);

    const social = profile.social_links as Record<string, string> | null;
    if (social) {
      const socialParts: string[] = [];
      for (const [platform, url] of Object.entries(social)) {
        if (url) socialParts.push(`${platform}: ${url}`);
      }
      if (socialParts.length > 0) parts.push(`Social: ${socialParts.join(', ')}`);
    }

    return parts.length > 1 ? parts.join('\n') : null;
  }

  // ─── Business Hours Embeddings ───

  /**
   * Refresh business hours embeddings for a tenant.
   * Reads business_hours_list and business_hours_special_list, chunks into
   * a single embedding with source_type='hours'.
   */
  async refreshHoursEmbeddings(tenantId: string): Promise<{ processed: number; chunks: number }> {
    const regularHours = await prisma.business_hours_list.findUnique({
      where: { tenant_id: tenantId },
    });

    const specialHours = await prisma.business_hours_special_list.findMany({
      where: { tenant_id: tenantId },
      orderBy: { date: 'asc' },
    });

    const pool = getDirectPool();

    // Delete existing hours embeddings for this tenant
    await pool.query(
      "DELETE FROM bot_knowledge_embeddings WHERE tenant_id = $1 AND source_type = 'hours'",
      [tenantId]
    );

    if (!regularHours && specialHours.length === 0) {
      return { processed: 0, chunks: 0 };
    }

    const text = this.chunkHours(regularHours, specialHours);
    if (!text) {
      return { processed: 0, chunks: 0 };
    }

    const embeddingModel = await BotRagService.getInstance().getEmbeddingModel();
    const embeddings = await this.generateEmbeddings([text]);
    const embeddingStr = `[${embeddings[0].join(',')}]`;

    await pool.query(
      `INSERT INTO bot_knowledge_embeddings (tenant_id, source_type, source_id, chunk_text, chunk_index, embedding, model)
       VALUES ($1, 'hours', 'business_hours', $2, 0, $3::vector, $4)
       ON CONFLICT (tenant_id, source_type, source_id, chunk_index) DO UPDATE SET
         chunk_text = EXCLUDED.chunk_text,
         embedding = EXCLUDED.embedding,
         model = EXCLUDED.model,
         updated_at = now()`,
      [tenantId, text, embeddingStr, embeddingModel]
    );

    logger.info('[BotKnowledgeEmbeddingService] Refreshed hours embeddings', undefined, {
      tenantId,
      hasSpecial: specialHours.length > 0,
    });

    return { processed: 1, chunks: 1 };
  }

  private chunkHours(regular: any, special: any[]): string | null {
    const parts: string[] = ['Business Hours:'];

    if (regular?.timezone) {
      parts.push(`Timezone: ${regular.timezone}`);
    }

    const periods = regular?.periods as any[] | null;
    if (periods && Array.isArray(periods) && periods.length > 0) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayMap = new Map<string, { open: string; close: string }[]>();

      for (const period of periods) {
        const dayIdx = typeof period.day === 'number' ? period.day : parseInt(period.day, 10);
        const dayName = dayNames[dayIdx] || period.day;
        if (!dayMap.has(dayName)) dayMap.set(dayName, []);
        dayMap.get(dayName)!.push({ open: period.open, close: period.close });
      }

      for (const dayName of dayNames) {
        const dayPeriods = dayMap.get(dayName);
        if (dayPeriods && dayPeriods.length > 0) {
          const hoursStr = dayPeriods.map(p => `${p.open}-${p.close}`).join(', ');
          parts.push(`${dayName}: ${hoursStr}`);
        } else {
          parts.push(`${dayName}: Closed`);
        }
      }
    }

    if (special.length > 0) {
      parts.push('Special Hours:');
      for (const sh of special) {
        const dateStr = sh.date instanceof Date ? sh.date.toISOString().slice(0, 10) : String(sh.date);
        if (sh.isClosed) {
          parts.push(`${dateStr}: Closed${sh.note ? ` (${sh.note})` : ''}`);
        } else if (sh.open && sh.close) {
          parts.push(`${dateStr}: ${sh.open}-${sh.close}${sh.note ? ` (${sh.note})` : ''}`);
        }
      }
    }

    return parts.length > 1 ? parts.join('\n') : null;
  }

  // ─── Fulfillment Settings Embeddings ───

  /**
   * Refresh fulfillment settings embeddings for a tenant.
   * Reads tenant_fulfillment_settings and chunks into a single embedding
   * with source_type='fulfillment'.
   */
  async refreshFulfillmentEmbeddings(tenantId: string): Promise<{ processed: number; chunks: number }> {
    const settings = await prisma.tenant_fulfillment_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const pool = getDirectPool();

    // Delete existing fulfillment embeddings for this tenant
    await pool.query(
      "DELETE FROM bot_knowledge_embeddings WHERE tenant_id = $1 AND source_type = 'fulfillment'",
      [tenantId]
    );

    if (!settings) {
      return { processed: 0, chunks: 0 };
    }

    const text = this.chunkFulfillment(settings);
    if (!text) {
      return { processed: 0, chunks: 0 };
    }

    const embeddingModel = await BotRagService.getInstance().getEmbeddingModel();
    const embeddings = await this.generateEmbeddings([text]);
    const embeddingStr = `[${embeddings[0].join(',')}]`;

    await pool.query(
      `INSERT INTO bot_knowledge_embeddings (tenant_id, source_type, source_id, chunk_text, chunk_index, embedding, model)
       VALUES ($1, 'fulfillment', 'fulfillment_settings', $2, 0, $3::vector, $4)
       ON CONFLICT (tenant_id, source_type, source_id, chunk_index) DO UPDATE SET
         chunk_text = EXCLUDED.chunk_text,
         embedding = EXCLUDED.embedding,
         model = EXCLUDED.model,
         updated_at = now()`,
      [tenantId, text, embeddingStr, embeddingModel]
    );

    logger.info('[BotKnowledgeEmbeddingService] Refreshed fulfillment embeddings', undefined, {
      tenantId,
    });

    return { processed: 1, chunks: 1 };
  }

  private chunkFulfillment(settings: any): string | null {
    const parts: string[] = ['Fulfillment Options:'];

    // Pickup
    if (settings.pickup_enabled) {
      const pickupParts = ['Pickup: Available'];
      if (settings.pickup_instructions) pickupParts.push(`Instructions: ${settings.pickup_instructions}`);
      if (settings.pickup_ready_time_minutes != null) {
        pickupParts.push(`Ready in ${settings.pickup_ready_time_minutes} minutes`);
      }
      parts.push(pickupParts.join(', '));
    } else {
      parts.push('Pickup: Not available');
    }

    // Delivery
    if (settings.delivery_enabled) {
      const deliveryParts = ['Delivery: Available'];
      if (settings.delivery_radius_miles != null) {
        deliveryParts.push(`Radius: ${settings.delivery_radius_miles} miles`);
      }
      if (settings.delivery_fee_cents != null && settings.delivery_fee_cents > 0) {
        deliveryParts.push(`Fee: $${(settings.delivery_fee_cents / 100).toFixed(2)}`);
      } else {
        deliveryParts.push('Fee: Free');
      }
      if (settings.delivery_min_free_cents != null) {
        deliveryParts.push(`Free over $${(settings.delivery_min_free_cents / 100).toFixed(2)}`);
      }
      if (settings.delivery_time_hours != null) {
        deliveryParts.push(`Estimated time: ${settings.delivery_time_hours} hours`);
      }
      if (settings.delivery_instructions) {
        deliveryParts.push(`Instructions: ${settings.delivery_instructions}`);
      }
      parts.push(deliveryParts.join(', '));
    } else {
      parts.push('Delivery: Not available');
    }

    // Shipping
    if (settings.shipping_enabled) {
      const shippingParts = ['Shipping: Available'];
      if (settings.shipping_flat_rate_cents != null) {
        shippingParts.push(`Flat rate: $${(settings.shipping_flat_rate_cents / 100).toFixed(2)}`);
      }
      if (settings.shipping_min_free_cents != null) {
        shippingParts.push(`Free over $${(settings.shipping_min_free_cents / 100).toFixed(2)}`);
      }
      if (settings.shipping_handling_days != null) {
        shippingParts.push(`Handling time: ${settings.shipping_handling_days} days`);
      }
      if (settings.shipping_provider) {
        shippingParts.push(`Provider: ${settings.shipping_provider}`);
      }
      parts.push(shippingParts.join(', '));
    } else {
      parts.push('Shipping: Not available');
    }

    return parts.length > 1 ? parts.join('\n') : null;
  }

  // ─── Feature Purchase Embeddings ───

  /**
   * Refresh BSaaS feature purchase embeddings for a tenant.
   * Reads active tenant_feature_purchases (source='bsaas') and chunks each
   * into bot_knowledge_embeddings with source_type='feature_purchase'.
   */
  async refreshFeaturePurchaseEmbeddings(tenantId: string): Promise<{ processed: number; chunks: number }> {
    const pool = getDirectPool();

    // Delete existing feature_purchase embeddings for this tenant
    await pool.query(
      "DELETE FROM bot_knowledge_embeddings WHERE tenant_id = $1 AND source_type = 'feature_purchase'",
      [tenantId]
    );

    const result = await pool.query(
      `SELECT
        tfp.id,
        tfp.feature_key,
        tfp.status,
        tfp.source,
        tfp.billing_cycle,
        tfp.price_cents,
        tfp.trial_ends_at,
        tfp.current_period_end,
        bc.marketing_name,
        bc.description
      FROM tenant_feature_purchases tfp
      LEFT JOIN bsaas_catalog bc ON bc.feature_key = tfp.feature_key
      WHERE tfp.tenant_id = $1
        AND tfp.status = 'active'
        AND tfp.source = 'bsaas'
      ORDER BY tfp.created_at`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return { processed: 0, chunks: 0 };
    }

    const embeddingModel = await BotRagService.getInstance().getEmbeddingModel();
    const texts: string[] = [];
    const sourceIds: string[] = [];

    for (const row of result.rows) {
      const text = this.chunkFeaturePurchase(row);
      if (text) {
        texts.push(text);
        sourceIds.push(row.id);
      }
    }

    if (texts.length === 0) {
      return { processed: 0, chunks: 0 };
    }

    const embeddings = await this.generateEmbeddings(texts);

    for (let i = 0; i < texts.length; i++) {
      const embeddingStr = `[${embeddings[i].join(',')}]`;
      await pool.query(
        `INSERT INTO bot_knowledge_embeddings (tenant_id, source_type, source_id, chunk_text, chunk_index, embedding, model)
         VALUES ($1, 'feature_purchase', $2, $3, 0, $4::vector, $5)
         ON CONFLICT (tenant_id, source_type, source_id, chunk_index) DO UPDATE SET
           chunk_text = EXCLUDED.chunk_text,
           embedding = EXCLUDED.embedding,
           model = EXCLUDED.model,
           updated_at = now()`,
        [tenantId, sourceIds[i], texts[i], embeddingStr, embeddingModel]
      );
    }

    logger.info('[BotKnowledgeEmbeddingService] Refreshed feature purchase embeddings', undefined, {
      tenantId,
      count: texts.length,
    });

    return { processed: result.rows.length, chunks: texts.length };
  }

  private chunkFeaturePurchase(row: any): string | null {
    const parts: string[] = ['Feature Store Purchase:'];
    const name = row.marketing_name || row.feature_key;
    parts.push(`Feature: ${name}`);
    if (row.description) {
      parts.push(`Description: ${row.description}`);
    }
    parts.push(`Status: ${row.status}`);
    if (row.billing_cycle) {
      parts.push(`Billing: ${row.billing_cycle}`);
    }
    if (row.price_cents) {
      parts.push(`Price: $${(row.price_cents / 100).toFixed(2)}/${row.billing_cycle || 'cycle'}`);
    }
    if (row.trial_ends_at) {
      parts.push(`Trial ends: ${new Date(row.trial_ends_at).toLocaleDateString()}`);
    }
    if (row.current_period_end) {
      parts.push(`Current period ends: ${new Date(row.current_period_end).toLocaleDateString()}`);
    }
    return parts.join('\n');
  }

  // ─── Featured Placement Embeddings ───

  /**
   * Refresh featured placement embeddings for a tenant.
   * Reads active featured_placement_purchases and chunks each into
   * bot_knowledge_embeddings with source_type='featured_placement'.
   */
  async refreshFeaturedPlacementEmbeddings(tenantId: string): Promise<{ processed: number; chunks: number }> {
    const pool = getDirectPool();

    // Delete existing featured_placement embeddings for this tenant
    await pool.query(
      "DELETE FROM bot_knowledge_embeddings WHERE tenant_id = $1 AND source_type = 'featured_placement'",
      [tenantId]
    );

    const result = await pool.query(
      `SELECT
        fpp.id,
        fpp.plan_key,
        fpp.surface,
        fpp.status,
        fpp.price_cents,
        fpp.duration_days,
        fpp.activated_at,
        fpp.expires_at,
        ii.name as product_name
      FROM featured_placement_purchases fpp
      LEFT JOIN inventory_items ii ON ii.id = fpp.inventory_item_id
      WHERE fpp.tenant_id = $1
        AND fpp.status = 'active'
      ORDER BY fpp.activated_at DESC`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return { processed: 0, chunks: 0 };
    }

    const embeddingModel = await BotRagService.getInstance().getEmbeddingModel();
    const texts: string[] = [];
    const sourceIds: string[] = [];

    for (const row of result.rows) {
      const text = this.chunkFeaturedPlacement(row);
      if (text) {
        texts.push(text);
        sourceIds.push(row.id);
      }
    }

    if (texts.length === 0) {
      return { processed: 0, chunks: 0 };
    }

    const embeddings = await this.generateEmbeddings(texts);

    for (let i = 0; i < texts.length; i++) {
      const embeddingStr = `[${embeddings[i].join(',')}]`;
      await pool.query(
        `INSERT INTO bot_knowledge_embeddings (tenant_id, source_type, source_id, chunk_text, chunk_index, embedding, model)
         VALUES ($1, 'featured_placement', $2, $3, 0, $4::vector, $5)
         ON CONFLICT (tenant_id, source_type, source_id, chunk_index) DO UPDATE SET
           chunk_text = EXCLUDED.chunk_text,
           embedding = EXCLUDED.embedding,
           model = EXCLUDED.model,
           updated_at = now()`,
        [tenantId, sourceIds[i], texts[i], embeddingStr, embeddingModel]
      );
    }

    logger.info('[BotKnowledgeEmbeddingService] Refreshed featured placement embeddings', undefined, {
      tenantId,
      count: texts.length,
    });

    return { processed: result.rows.length, chunks: texts.length };
  }

  private chunkFeaturedPlacement(row: any): string | null {
    const parts: string[] = ['Featured Store Placement:'];
    if (row.product_name) {
      parts.push(`Product: ${row.product_name}`);
    }
    parts.push(`Plan: ${row.plan_key}`);
    parts.push(`Surface: ${row.surface}`);
    parts.push(`Status: ${row.status}`);
    if (row.duration_days) {
      parts.push(`Duration: ${row.duration_days} days`);
    }
    if (row.price_cents) {
      parts.push(`Price: $${(row.price_cents / 100).toFixed(2)}`);
    }
    if (row.activated_at) {
      parts.push(`Activated: ${new Date(row.activated_at).toLocaleDateString()}`);
    }
    if (row.expires_at) {
      parts.push(`Expires: ${new Date(row.expires_at).toLocaleDateString()}`);
    }
    return parts.join('\n');
  }

  // ─── Funnel Embeddings ───

  /**
   * Refresh sales funnel embeddings for a tenant.
   * Reads active tenant_sales_funnels and their steps, chunks into text,
   * and embeds into bot_knowledge_embeddings with source_type='funnel'.
   */
  async refreshFunnelEmbeddings(tenantId: string): Promise<{ processed: number; chunks: number }> {
    const pool = getDirectPool();

    await pool.query(
      "DELETE FROM bot_knowledge_embeddings WHERE tenant_id = $1 AND source_type = 'funnel'",
      [tenantId]
    );

    const funnels = await prisma.tenant_sales_funnels.findMany({
      where: { tenant_id: tenantId, is_active: true },
      include: {
        tenant_funnel_steps: {
          where: { is_active: true },
          orderBy: { sort_order: 'asc' },
          include: { inventory_items: { select: { name: true, description: true } } },
        },
      },
    });

    if (funnels.length === 0) {
      return { processed: 0, chunks: 0 };
    }

    const embeddingModel = await BotRagService.getInstance().getEmbeddingModel();
    const chunks: { sourceId: string; text: string }[] = [];

    for (const funnel of funnels) {
      const parts = [
        `Sales Funnel: ${funnel.name}`,
        funnel.entry_item_id ? `Attached to product: ${funnel.entry_item_id}` : 'Storewide trigger',
        `Trigger: ${funnel.trigger_type}`,
      ];

      if (funnel.tenant_funnel_steps.length > 0) {
        const stepDescriptions = funnel.tenant_funnel_steps.map((step, index) => {
          const offerName = step.inventory_items?.name || step.offer_item_id;
          const lines = [`${index + 1}. ${step.step_type}: ${step.display_title || offerName}`];
          if (step.display_description) lines.push(`   Description: ${step.display_description}`);
          if (step.price_cents) lines.push(`   Offer price: $${(step.price_cents / 100).toFixed(2)}`);
          if (step.discount_cents) lines.push(`   Discount: $${(step.discount_cents / 100).toFixed(2)}`);
          return lines.join('\n');
        });
        parts.push(`Steps:\n${stepDescriptions.join('\n')}`);
      }

      chunks.push({ sourceId: funnel.id, text: parts.join('\n') });
    }

    const embeddings = await this.generateEmbeddings(chunks.map((c) => c.text));

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      const embeddingStr = `[${embedding.join(',')}]`;

      await pool.query(
        `INSERT INTO bot_knowledge_embeddings (tenant_id, source_type, source_id, chunk_text, chunk_index, embedding, model)
         VALUES ($1, 'funnel', $2, $3, 0, $4::vector, $5)
         ON CONFLICT (tenant_id, source_type, source_id, chunk_index) DO UPDATE SET
           chunk_text = EXCLUDED.chunk_text,
           embedding = EXCLUDED.embedding,
           model = EXCLUDED.model,
           updated_at = now()`,
        [tenantId, chunk.sourceId, chunk.text, embeddingStr, embeddingModel]
      );
    }

    logger.info('[BotKnowledgeEmbeddingService] Refreshed funnel embeddings', undefined, {
      tenantId,
      funnels: funnels.length,
      chunks: chunks.length,
    });

    return { processed: funnels.length, chunks: chunks.length };
  }

  // ─── Unified Refresh ───

  /**
   * Refresh directory promotion embeddings for a tenant.
   * Reads the active promotion from directory_listings_list and chunks into
   * a single embedding with source_type='promotion'.
   */
  async refreshPromotionEmbeddings(tenantId: string): Promise<{ processed: number; chunks: number }> {
    const pool = getDirectPool();

    // Delete existing promotion embeddings for this tenant
    await pool.query(
      "DELETE FROM bot_knowledge_embeddings WHERE tenant_id = $1 AND source_type = 'promotion'",
      [tenantId]
    );

    const result = await pool.query(
      `SELECT
        is_promoted,
        promotion_tier,
        promotion_started_at,
        promotion_expires_at,
        promotion_impressions,
        promotion_clicks
      FROM directory_listings_list
      WHERE tenant_id = $1
        AND (business_hours IS NULL OR business_hours::text != 'null')
      LIMIT 1`,
      [tenantId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_promoted) {
      return { processed: 0, chunks: 0 };
    }

    const listing = result.rows[0];
    const text = this.chunkPromotion(listing);
    if (!text) {
      return { processed: 0, chunks: 0 };
    }

    const embeddingModel = await BotRagService.getInstance().getEmbeddingModel();
    const embeddings = await this.generateEmbeddings([text]);
    const embeddingStr = `[${embeddings[0].join(',')}]`;

    await pool.query(
      `INSERT INTO bot_knowledge_embeddings (tenant_id, source_type, source_id, chunk_text, chunk_index, embedding, model)
       VALUES ($1, 'promotion', 'directory_promotion', $2, 0, $3::vector, $4)
       ON CONFLICT (tenant_id, source_type, source_id, chunk_index) DO UPDATE SET
         chunk_text = EXCLUDED.chunk_text,
         embedding = EXCLUDED.embedding,
         model = EXCLUDED.model,
         updated_at = now()`,
      [tenantId, text, embeddingStr, embeddingModel]
    );

    logger.info('[BotKnowledgeEmbeddingService] Refreshed promotion embeddings', undefined, {
      tenantId,
    });

    return { processed: 1, chunks: 1 };
  }

  private chunkPromotion(listing: any): string | null {
    const tierLabels: Record<string, string> = {
      basic: 'Basic',
      premium: 'Premium',
      featured: 'Featured',
    };

    const tierFeatures: Record<string, string[]> = {
      basic: ['gold marker on map', 'promoted badge', 'higher visibility in directory'],
      premium: ['featured in search results', 'homepage carousel spot', 'advanced analytics', 'priority support'],
      featured: ['guaranteed top 3 position', 'custom marker icon', 'sponsored content placement', 'dedicated account manager'],
    };

    const tier = listing.promotion_tier || 'basic';
    const parts: string[] = ['Directory Promotion:'];

    parts.push(`Status: Active`);
    parts.push(`Tier: ${tierLabels[tier] || tier}`);

    if (listing.promotion_started_at) {
      parts.push(`Started: ${new Date(listing.promotion_started_at).toLocaleDateString()}`);
    }
    if (listing.promotion_expires_at) {
      parts.push(`Expires: ${new Date(listing.promotion_expires_at).toLocaleDateString()}`);
    }

    const features = tierFeatures[tier] || tierFeatures.basic;
    parts.push(`Features: ${features.join(', ')}`);

    if (listing.promotion_impressions > 0 || listing.promotion_clicks > 0) {
      parts.push(`Performance: ${listing.promotion_impressions || 0} impressions, ${listing.promotion_clicks || 0} clicks`);
    }

    return parts.join('\n');
  }

  // ─── Coupon Embeddings ───

  /**
   * Refresh coupon embeddings for a tenant.
   * Reads active tenant_coupons, chunks each into text,
   * and embeds into bot_knowledge_embeddings with source_type='coupon'.
   */
  async refreshCouponEmbeddings(tenantId: string): Promise<{ processed: number; chunks: number }> {
    const pool = getDirectPool();

    await pool.query(
      "DELETE FROM bot_knowledge_embeddings WHERE tenant_id = $1 AND source_type = 'coupon'",
      [tenantId]
    );

    const coupons = await prisma.tenant_coupons.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: {
        id: true,
        code: true,
        discount_type: true,
        discount_value: true,
        max_redemptions: true,
        expires_at: true,
        is_active: true,
      },
    });

    if (coupons.length === 0) {
      return { processed: 0, chunks: 0 };
    }

    const embeddingModel = await BotRagService.getInstance().getEmbeddingModel();
    const chunks: { sourceId: string; text: string }[] = [];

    for (const coupon of coupons) {
      const parts = [
        `Coupon: ${coupon.code}`,
        `Discount: ${coupon.discount_type === 'percentage' ? `${coupon.discount_value}% off` : coupon.discount_type === 'fixed' ? `$${(coupon.discount_value / 100).toFixed(2)} off` : coupon.discount_type === 'free_shipping' ? 'Free shipping' : coupon.discount_type === 'bogo' ? 'Buy one get one' : coupon.discount_type}`,
      ];

      if (coupon.max_redemptions) {
        parts.push(`Max redemptions: ${coupon.max_redemptions}`);
      }
      if (coupon.expires_at) {
        parts.push(`Expires: ${new Date(coupon.expires_at).toLocaleDateString()}`);
      }
      parts.push(`Status: ${coupon.is_active ? 'Active' : 'Inactive'}`);

      chunks.push({ sourceId: coupon.id, text: parts.join('\n') });
    }

    for (const chunk of chunks) {
      const embedding = await aiProviderFactory.generateQueryEmbedding(chunk.text);
      const embeddingStr = JSON.stringify(embedding);

      await pool.query(
        `INSERT INTO bot_knowledge_embeddings (tenant_id, source_type, source_id, chunk_text, embedding, embedding_model)
         VALUES ($1, 'coupon', $2, $3, $4, $5)`,
        [tenantId, chunk.sourceId, chunk.text, embeddingStr, embeddingModel]
      );
    }

    logger.info('[BotKnowledgeEmbeddingService] Refreshed coupon embeddings', undefined, {
      tenantId,
      coupons: coupons.length,
      chunks: chunks.length,
    });

    return { processed: coupons.length, chunks: chunks.length };
  }

  /**
   * Refresh knowledge embeddings by source type (or all if not specified).
   */
  async refreshKnowledgeEmbeddings(
    tenantId: string,
    sourceType?: 'badge_registry' | 'policy' | 'business_info' | 'hours' | 'fulfillment' | 'promotion' | 'feature_purchase' | 'featured_placement' | 'policy_template' | 'funnel' | 'coupon'
  ): Promise<{ processed: number; chunks: number }> {
    if (sourceType === 'badge_registry') {
      return this.refreshBadgeRegistryEmbeddings(tenantId);
    }
    if (sourceType === 'policy') {
      return this.refreshPolicyEmbeddings(tenantId);
    }
    if (sourceType === 'business_info') {
      return this.refreshBusinessInfoEmbeddings(tenantId);
    }
    if (sourceType === 'hours') {
      return this.refreshHoursEmbeddings(tenantId);
    }
    if (sourceType === 'fulfillment') {
      return this.refreshFulfillmentEmbeddings(tenantId);
    }
    if (sourceType === 'promotion') {
      return this.refreshPromotionEmbeddings(tenantId);
    }
    if (sourceType === 'feature_purchase') {
      return this.refreshFeaturePurchaseEmbeddings(tenantId);
    }
    if (sourceType === 'featured_placement') {
      return this.refreshFeaturedPlacementEmbeddings(tenantId);
    }
    if (sourceType === 'policy_template') {
      return this.refreshPolicyTemplateEmbeddings(tenantId);
    }
    if (sourceType === 'funnel') {
      return this.refreshFunnelEmbeddings(tenantId);
    }
    if (sourceType === 'coupon') {
      return this.refreshCouponEmbeddings(tenantId);
    }

    const badgeResult = await this.refreshBadgeRegistryEmbeddings(tenantId);
    const policyResult = await this.refreshPolicyEmbeddings(tenantId);
    const bizResult = await this.refreshBusinessInfoEmbeddings(tenantId);
    const hoursResult = await this.refreshHoursEmbeddings(tenantId);
    const fulfillmentResult = await this.refreshFulfillmentEmbeddings(tenantId);
    const promotionResult = await this.refreshPromotionEmbeddings(tenantId);
    const featurePurchaseResult = await this.refreshFeaturePurchaseEmbeddings(tenantId);
    const featuredPlacementResult = await this.refreshFeaturedPlacementEmbeddings(tenantId);
    const policyTemplateResult = await this.refreshPolicyTemplateEmbeddings(tenantId);
    const funnelResult = await this.refreshFunnelEmbeddings(tenantId);
    const couponResult = await this.refreshCouponEmbeddings(tenantId);
    return {
      processed: badgeResult.processed + policyResult.processed + bizResult.processed + hoursResult.processed + fulfillmentResult.processed + promotionResult.processed + featurePurchaseResult.processed + featuredPlacementResult.processed + policyTemplateResult.processed + funnelResult.processed + couponResult.processed,
      chunks: badgeResult.chunks + policyResult.chunks + bizResult.chunks + hoursResult.chunks + fulfillmentResult.chunks + promotionResult.chunks + featurePurchaseResult.chunks + featuredPlacementResult.chunks + policyTemplateResult.chunks + funnelResult.chunks + couponResult.chunks,
    };
  }

  // ─── Policy Template Embeddings ───

  /**
   * Refresh policy template embeddings for a tenant.
   * Reads recommended templates for the tenant and chunks template metadata
   * (title, description, compliance tags, policy type) into bot_knowledge_embeddings
   * with source_type='policy_template'.
   */
  async refreshPolicyTemplateEmbeddings(tenantId: string): Promise<{ processed: number; chunks: number }> {
    const pool = getDirectPool();

    // Delete existing policy template embeddings for this tenant
    await pool.query(
      "DELETE FROM bot_knowledge_embeddings WHERE tenant_id = $1 AND source_type = 'policy_template'",
      [tenantId]
    );

    // Get recommended templates for this tenant
    const { PolicyTemplateService } = await import('./PolicyTemplateService');
    const service = PolicyTemplateService.getInstance();
    const templates = await service.getRecommendedTemplates(tenantId);

    if (templates.length === 0) {
      return { processed: 0, chunks: 0 };
    }

    const chunks: string[] = [];
    for (const t of templates) {
      const parts = [
        `Policy Template: ${t.title}`,
        `Policy Type: ${t.policyType.replace(/_/g, ' ')}`,
        `Storefront: ${t.storefrontType}`,
        `Version: ${t.version}`,
      ];
      if (t.description) parts.push(`Description: ${t.description}`);
      if (t.complianceTags.length > 0) parts.push(`Compliance: ${t.complianceTags.join(', ')}`);
      if (t.jurisdiction !== 'GLOBAL') parts.push(`Jurisdiction: ${t.jurisdiction}`);
      if (t.fulfillmentMode !== 'all') parts.push(`Fulfillment: ${t.fulfillmentMode}`);
      chunks.push(parts.join('\n'));
    }

    const embeddingModel = await BotRagService.getInstance().getEmbeddingModel();
    const embeddings = await this.generateEmbeddings(chunks);

    for (let i = 0; i < chunks.length; i++) {
      const embeddingStr = `[${embeddings[i].join(',')}]`;
      await pool.query(
        `INSERT INTO bot_knowledge_embeddings (tenant_id, source_type, source_id, chunk_text, chunk_index, embedding, model)
         VALUES ($1, 'policy_template', $2, $3, $4, $5::vector, $6)
         ON CONFLICT (tenant_id, source_type, source_id, chunk_index) DO UPDATE SET
           chunk_text = EXCLUDED.chunk_text,
           embedding = EXCLUDED.embedding,
           model = EXCLUDED.model,
           updated_at = now()`,
        [tenantId, templates[i].id, chunks[i], i, embeddingStr, embeddingModel]
      );
    }

    logger.info('[BotKnowledgeEmbeddingService] Refreshed policy template embeddings', undefined, {
      tenantId,
      chunks: chunks.length,
    });

    return { processed: templates.length, chunks: chunks.length };
  }

  // ─── Search ───

  /**
   * Search for similar knowledge chunks using pgvector cosine similarity.
   * Optionally filtered by source_type(s).
   */
  async searchKnowledge(
    tenantId: string,
    query: string,
    sourceTypes?: string[],
    topK: number = 3
  ): Promise<KnowledgeRagResult> {
    const ragService = BotRagService.getInstance();
    const queryEmbedding = await ragService.generateQueryEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const pool = getDirectPool();

    let sql: string;
    let params: any[];

    if (sourceTypes && sourceTypes.length > 0) {
      sql = `SELECT
        source_type,
        source_id,
        chunk_text,
        (1 - (embedding <=> $1::vector))::text as score
      FROM bot_knowledge_embeddings
      WHERE tenant_id = $2
        AND source_type = ANY($3)
        AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $4`;
      params = [embeddingStr, tenantId, sourceTypes, topK];
    } else {
      sql = `SELECT
        source_type,
        source_id,
        chunk_text,
        (1 - (embedding <=> $1::vector))::text as score
      FROM bot_knowledge_embeddings
      WHERE tenant_id = $2
        AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3`;
      params = [embeddingStr, tenantId, topK];
    }

    const results = (await pool.query(sql, params)).rows;

    const chunks = results
      .filter((r: any) => parseFloat(r.score) >= SIMILARITY_THRESHOLD)
      .map((r: any) => ({
        sourceType: r.source_type,
        sourceId: r.source_id,
        chunkText: r.chunk_text,
        score: parseFloat(r.score),
      }));

    return { chunks };
  }

  // ─── Status ───

  /**
   * Check if knowledge embeddings exist for a tenant, optionally filtered by source_type.
   */
  async hasKnowledgeEmbeddings(tenantId: string, sourceType?: string): Promise<boolean> {
    const pool = getDirectPool();
    if (sourceType) {
      const result = await pool.query(
        'SELECT COUNT(*)::text as cnt FROM bot_knowledge_embeddings WHERE tenant_id = $1 AND source_type = $2',
        [tenantId, sourceType]
      );
      return parseInt(result.rows[0]?.cnt || '0', 10) > 0;
    }
    const result = await pool.query(
      'SELECT COUNT(*)::text as cnt FROM bot_knowledge_embeddings WHERE tenant_id = $1',
      [tenantId]
    );
    return parseInt(result.rows[0]?.cnt || '0', 10) > 0;
  }

  /**
   * Get counts per source_type for a tenant.
   */
  async getKnowledgeEmbeddingCounts(tenantId: string): Promise<{ sourceType: string; count: number }[]> {
    const pool = getDirectPool();
    const result = await pool.query(
      `SELECT source_type, COUNT(*)::text as cnt
       FROM bot_knowledge_embeddings
       WHERE tenant_id = $1
       GROUP BY source_type
       ORDER BY source_type`,
      [tenantId]
    );
    return result.rows.map((r: any) => ({
      sourceType: r.source_type,
      count: parseInt(r.cnt, 10),
    }));
  }
}

export default BotKnowledgeEmbeddingService;
