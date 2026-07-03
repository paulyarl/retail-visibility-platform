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

  /**
   * Refresh knowledge embeddings by source type (or all if not specified).
   */
  async refreshKnowledgeEmbeddings(
    tenantId: string,
    sourceType?: 'badge_registry' | 'policy' | 'business_info' | 'hours' | 'fulfillment' | 'promotion'
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

    const badgeResult = await this.refreshBadgeRegistryEmbeddings(tenantId);
    const policyResult = await this.refreshPolicyEmbeddings(tenantId);
    const bizResult = await this.refreshBusinessInfoEmbeddings(tenantId);
    const hoursResult = await this.refreshHoursEmbeddings(tenantId);
    const fulfillmentResult = await this.refreshFulfillmentEmbeddings(tenantId);
    const promotionResult = await this.refreshPromotionEmbeddings(tenantId);
    return {
      processed: badgeResult.processed + policyResult.processed + bizResult.processed + hoursResult.processed + fulfillmentResult.processed + promotionResult.processed,
      chunks: badgeResult.chunks + policyResult.chunks + bizResult.chunks + hoursResult.chunks + fulfillmentResult.chunks + promotionResult.chunks,
    };
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
