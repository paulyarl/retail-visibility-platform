/**
 * Bot RAG Service
 *
 * FAQ chunking, OpenAI embeddings generation, and pgvector similarity search.
 * Used by BotDynamicResponseService to retrieve relevant FAQ context for GPT prompts.
 */

import { prisma } from '../prisma';
import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';
import aiProviderFactory from './ai-providers';
import { getTenantBadges } from './BadgeRegistryService';

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;
const CHUNK_SIZE = 500; // characters per chunk
const CHUNK_OVERLAP = 50; // overlap between chunks
const SIMILARITY_THRESHOLD = 0.7;

export interface RagResult {
  chunks: { faqId: string; question: string; chunkText: string; score: number }[];
}

export interface ProductRagResult {
  chunks: { productId: string; productName: string; chunkText: string; score: number }[];
}

class BotRagService {
  private static instance: BotRagService;
  private embeddingModelCache: string | null = null;
  private embeddingModelCacheTime: number = 0;
  private static readonly MODEL_CACHE_TTL = 60_000; // 60 seconds

  private constructor() {}

  static getInstance(): BotRagService {
    if (!BotRagService.instance) {
      BotRagService.instance = new BotRagService();
    }
    return BotRagService.instance;
  }

  /**
   * Get the configured embedding model from platform settings (cached).
   */
  async getEmbeddingModel(): Promise<string> {
    const now = Date.now();
    if (this.embeddingModelCache !== null && (now - this.embeddingModelCacheTime) < BotRagService.MODEL_CACHE_TTL) {
      return this.embeddingModelCache;
    }
    try {
      const settings = await prisma.platform_settings_list.findFirst();
      this.embeddingModelCache = settings?.bot_embedding_model ?? DEFAULT_EMBEDDING_MODEL;
      this.embeddingModelCacheTime = now;
      return this.embeddingModelCache!;
    } catch {
      return DEFAULT_EMBEDDING_MODEL;
    }
  }

  /**
   * Chunk a FAQ into smaller pieces for embedding.
   * Each chunk combines the question + a slice of the answer.
   */
  private chunkFaq(question: string, answer: string): { text: string; index: number }[] {
    const fullText = `Question: ${question}\nAnswer: ${answer}`;
    const chunks: { text: string; index: number }[] = [];

    if (fullText.length <= CHUNK_SIZE) {
      chunks.push({ text: fullText, index: 0 });
      return chunks;
    }

    let start = 0;
    let idx = 0;
    while (start < fullText.length) {
      const end = Math.min(start + CHUNK_SIZE, fullText.length);
      chunks.push({ text: fullText.slice(start, end), index: idx });
      start += CHUNK_SIZE - CHUNK_OVERLAP;
      idx++;
    }
    return chunks;
  }

  /**
   * Generate embeddings for a list of texts using the configured AI provider.
   */
  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const result = await aiProviderFactory.generateEmbeddings({ inputs: texts });
    return result.embeddings;
  }

  /**
   * Generate embedding for a single query text.
   */
  async generateQueryEmbedding(text: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0];
  }

  /**
   * Re-embed all FAQs for a tenant.
   * Called when FAQs are created/updated/deleted (via webhook) or manually.
   */
  async refreshEmbeddings(tenantId: string): Promise<{ processed: number; chunks: number }> {
    const faqs = await prisma.faqs.findMany({
      where: { tenant_id: tenantId, status: 'published' },
      select: { id: true, question: true, answer: true },
    });

    const pool = getDirectPool();

    if (faqs.length === 0) {
      // Clean up any stale embeddings
      await pool.query('DELETE FROM bot_faq_embeddings WHERE tenant_id = $1', [tenantId]);
      return { processed: 0, chunks: 0 };
    }

    // Delete existing embeddings for this tenant
    await pool.query('DELETE FROM bot_faq_embeddings WHERE tenant_id = $1', [tenantId]);

    const embeddingModel = await this.getEmbeddingModel();
    let totalChunks = 0;

    // Process in batches of 100 FAQs to avoid API limits
    const batchSize = 100;
    for (let i = 0; i < faqs.length; i += batchSize) {
      const batch = faqs.slice(i, i + batchSize);
      const allChunks: { faqId: string; text: string; index: number }[] = [];

      for (const faq of batch) {
        const chunks = this.chunkFaq(faq.question, faq.answer);
        for (const chunk of chunks) {
          allChunks.push({ faqId: faq.id, text: chunk.text, index: chunk.index });
        }
      }

      if (allChunks.length === 0) continue;

      // Generate embeddings for this batch
      const embeddings = await this.generateEmbeddings(allChunks.map(c => c.text));

      // Insert into database
      for (let j = 0; j < allChunks.length; j++) {
        const chunk = allChunks[j];
        const embedding = embeddings[j];
        const embeddingStr = `[${embedding.join(',')}]`;

        await pool.query(
          `INSERT INTO bot_faq_embeddings (tenant_id, faq_id, chunk_text, chunk_index, embedding, model)
           VALUES ($1, $2::uuid, $3, $4, $5::vector, $6)`,
          [tenantId, chunk.faqId, chunk.text, chunk.index, embeddingStr, embeddingModel]
        );
      }

      totalChunks += allChunks.length;
    }

    logger.info('[BotRagService] Refreshed embeddings', undefined, {
      tenantId,
      faqs: faqs.length,
      chunks: totalChunks,
    });

    return { processed: faqs.length, chunks: totalChunks };
  }

  /**
   * Search for similar FAQ chunks using pgvector cosine similarity.
   */
  async search(tenantId: string, query: string, topK: number = 3): Promise<RagResult> {
    const queryEmbedding = await this.generateQueryEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const pool = getDirectPool();
    const results = (await pool.query(
      `SELECT
        e.faq_id,
        f.question,
        e.chunk_text,
        (1 - (e.embedding <=> $1::vector))::text as score
      FROM bot_faq_embeddings e
      JOIN faqs f ON f.id = e.faq_id
      WHERE e.tenant_id = $2
        AND f.is_published = true
        AND e.embedding IS NOT NULL
      ORDER BY e.embedding <=> $1::vector
      LIMIT $3`,
      [embeddingStr, tenantId, topK]
    )).rows;

    const chunks = results
      .filter((r: any) => parseFloat(r.score) >= SIMILARITY_THRESHOLD)
      .map((r: any) => ({
        faqId: r.faq_id,
        question: r.question,
        chunkText: r.chunk_text,
        score: parseFloat(r.score),
      }));

    return { chunks };
  }

  /**
   * Check if FAQ embeddings exist for a tenant.
   */
  async hasEmbeddings(tenantId: string): Promise<boolean> {
    const pool = getDirectPool();
    const result = await pool.query(
      'SELECT COUNT(*)::text as cnt FROM bot_faq_embeddings WHERE tenant_id = $1',
      [tenantId]
    );
    return parseInt(result.rows[0]?.cnt || '0', 10) > 0;
  }

  /**
   * Chunk product catalog data into embeddings from the storefront MV.
   * Includes name, description, features, tags, product type, and enriched badges for rich search.
   * Badge keys are enriched with label + description from the badge registry.
   */
  private chunkProduct(product: any, badgeMap?: Map<string, string>): { text: string; index: number }[] {
    const parsePgArray = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      const s = String(val).replace(/^\{|\}$/g, '');
      return s ? s.split(',').map((v: string) => v.trim()) : [];
    };

    const features = parsePgArray(product.features);
    const tags = parsePgArray(product.tags);
    const badgeKeys = parsePgArray(product.featured_type_array);
    const badges = badgeMap
      ? badgeKeys.map(k => badgeMap.get(k) || k)
      : badgeKeys;

    const parts = [
      `Product: ${product.product_name}`,
      product.product_type ? `Type: ${product.product_type}` : '',
      product.brand ? `Brand: ${product.brand}` : '',
      product.product_category ? `Category: ${product.product_category}` : '',
      product.product_description ? `Description: ${product.product_description}` : '',
      product.marketing_description ? `Marketing: ${product.marketing_description}` : '',
      features.length > 0 ? `Features: ${features.join(', ')}` : '',
      tags.length > 0 ? `Tags: ${tags.join(', ')}` : '',
      badges.length > 0 ? `Badges: ${badges.join(', ')}` : '',
      product.sku ? `SKU: ${product.sku}` : '',
    ].filter(Boolean);

    const fullText = parts.join('\n');
    const chunks: { text: string; index: number }[] = [];

    if (fullText.length <= CHUNK_SIZE) {
      chunks.push({ text: fullText, index: 0 });
      return chunks;
    }

    let start = 0;
    let idx = 0;
    while (start < fullText.length) {
      const end = Math.min(start + CHUNK_SIZE, fullText.length);
      chunks.push({ text: fullText.slice(start, end), index: idx });
      start += CHUNK_SIZE - CHUNK_OVERLAP;
      idx++;
    }
    return chunks;
  }

  /**
   * Re-embed all active public products for a tenant using mv_storefront_discovery.
   * Called by merchant catalog webhooks or periodic refresh jobs.
   */
  async refreshProductEmbeddings(tenantId: string): Promise<{ processed: number; chunks: number }> {
    const pool = getDirectPool();
    const productsResult = await pool.query(
      `SELECT
        inventory_item_id::text as product_id,
        product_name::text as product_name,
        COALESCE(product_type::text, '') as product_type,
        COALESCE(product_description::text, '') as product_description,
        COALESCE(marketing_description::text, '') as marketing_description,
        COALESCE(brand::text, '') as brand,
        COALESCE(product_category::text, '') as product_category,
        COALESCE(sku::text, '') as sku,
        COALESCE(features::text, '') as features,
        COALESCE(tags::text, '') as tags,
        COALESCE(featured_type_array::text, '') as featured_type_array,
        COALESCE(product_slug::text, '') as product_slug
      FROM mv_storefront_discovery
      WHERE tenant_id = $1
        AND item_status = 'active'
        AND visibility = 'public'
        AND stock_status IN ('in_stock', 'low_stock')`,
      [tenantId]
    );
    const products = productsResult.rows;

    if (products.length === 0) {
      await pool.query('DELETE FROM bot_product_embeddings WHERE tenant_id = $1', [tenantId]);
      return { processed: 0, chunks: 0 };
    }

    // Load badge registry to enrich badge keys with descriptions
    let badgeMap: Map<string, string> | undefined;
    try {
      const tenantBadges = await getTenantBadges(tenantId);
      badgeMap = new Map<string, string>();
      for (const badge of tenantBadges) {
        const enriched = badge.description
          ? `${badge.label} (${badge.description})`
          : badge.label;
        badgeMap.set(badge.key, enriched);
      }
    } catch (err) {
      logger.warn('[BotRagService] Failed to load badge registry for enrichment, using raw keys', undefined, {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Delete existing product embeddings for this tenant
    await pool.query('DELETE FROM bot_product_embeddings WHERE tenant_id = $1', [tenantId]);

    const embeddingModel = await this.getEmbeddingModel();
    let totalChunks = 0;
    const batchSize = 100;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const allChunks: { productId: string; text: string; index: number }[] = [];

      for (const product of batch) {
        const chunks = this.chunkProduct(product, badgeMap);
        for (const chunk of chunks) {
          allChunks.push({ productId: product.product_id, text: chunk.text, index: chunk.index });
        }
      }

      if (allChunks.length === 0) continue;

      const embeddings = await this.generateEmbeddings(allChunks.map(c => c.text));

      for (let j = 0; j < allChunks.length; j++) {
        const chunk = allChunks[j];
        const embedding = embeddings[j];
        const embeddingStr = `[${embedding.join(',')}]`;

        await pool.query(
          `INSERT INTO bot_product_embeddings (tenant_id, product_id, chunk_text, chunk_index, embedding, model)
           VALUES ($1, $2, $3, $4, $5::vector, $6)`,
          [tenantId, chunk.productId, chunk.text, chunk.index, embeddingStr, embeddingModel]
        );
      }

      totalChunks += allChunks.length;
    }

    logger.info('[BotRagService] Refreshed product embeddings', undefined, {
      tenantId,
      products: products.length,
      chunks: totalChunks,
    });

    return { processed: products.length, chunks: totalChunks };
  }

  /**
   * Search for similar product chunks using pgvector cosine similarity.
   * Optionally filter by product_type.
   */
  async searchProducts(
    tenantId: string,
    query: string,
    topK: number = 3,
    productTypes?: string[]
  ): Promise<ProductRagResult> {
    const queryEmbedding = await this.generateQueryEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const pool = getDirectPool();

    let sql: string;
    let params: any[];

    if (productTypes && productTypes.length > 0) {
      sql = `SELECT
        e.product_id,
        ii.name as product_name,
        e.chunk_text,
        (1 - (e.embedding <=> $1::vector))::text as score
      FROM bot_product_embeddings e
      JOIN inventory_items ii ON ii.id = e.product_id
      WHERE e.tenant_id = $2
        AND ii.item_status = 'active'
        AND e.embedding IS NOT NULL
        AND ii.product_type = ANY($4)
      ORDER BY e.embedding <=> $1::vector
      LIMIT $3`;
      params = [embeddingStr, tenantId, topK, productTypes];
    } else {
      sql = `SELECT
        e.product_id,
        ii.name as product_name,
        e.chunk_text,
        (1 - (e.embedding <=> $1::vector))::text as score
      FROM bot_product_embeddings e
      JOIN inventory_items ii ON ii.id = e.product_id
      WHERE e.tenant_id = $2
        AND ii.item_status = 'active'
        AND e.embedding IS NOT NULL
      ORDER BY e.embedding <=> $1::vector
      LIMIT $3`;
      params = [embeddingStr, tenantId, topK];
    }

    const results = (await pool.query(sql, params)).rows;

    const chunks = results
      .filter((r: any) => parseFloat(r.score) >= SIMILARITY_THRESHOLD)
      .map((r: any) => ({
        productId: r.product_id,
        productName: r.product_name,
        chunkText: r.chunk_text,
        score: parseFloat(r.score),
      }));

    return { chunks };
  }

  /**
   * Check if product embeddings exist for a tenant.
   */
  async hasProductEmbeddings(tenantId: string): Promise<boolean> {
    const pool = getDirectPool();
    const result = await pool.query(
      `SELECT COUNT(*)::text as cnt FROM bot_product_embeddings WHERE tenant_id = $1`,
      [tenantId]
    );
    return parseInt(result.rows[0]?.cnt || '0', 10) > 0;
  }

  /**
   * Get product type breakdown from product embeddings.
   * Returns counts per product_type by joining bot_product_embeddings with inventory_items.
   */
  async getProductTypeBreakdown(tenantId: string): Promise<{ productType: string; count: number }[]> {
    const pool = getDirectPool();
    const result = await pool.query(
      `SELECT
        COALESCE(ii.product_type, 'unknown') as product_type,
        COUNT(DISTINCT e.product_id)::text as cnt
      FROM bot_product_embeddings e
      JOIN inventory_items ii ON ii.id = e.product_id
      WHERE e.tenant_id = $1
      GROUP BY ii.product_type
      ORDER BY cnt DESC`,
      [tenantId]
    );
    return result.rows.map((r: any) => ({
      productType: r.product_type,
      count: parseInt(r.cnt, 10),
    }));
  }
}

export default BotRagService;
