/**
 * Bot RAG Service
 *
 * FAQ chunking, OpenAI embeddings generation, and pgvector similarity search.
 * Used by BotDynamicResponseService to retrieve relevant FAQ context for GPT prompts.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

const EMBEDDING_MODEL = 'text-embedding-3-small';
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
  private openai: any = null;

  private constructor() {
    if (process.env.OPENAI_API_KEY) {
      try {
        const OpenAI = require('openai').default;
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      } catch (e) {
        logger.warn('[BotRagService] Failed to init OpenAI', undefined, { error: String(e) });
      }
    }
  }

  static getInstance(): BotRagService {
    if (!BotRagService.instance) {
      BotRagService.instance = new BotRagService();
    }
    return BotRagService.instance;
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
   * Generate embeddings for a list of texts using OpenAI.
   */
  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized — set OPENAI_API_KEY');
    }

    const response = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });

    return response.data.map((d: any) => d.embedding);
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

    if (faqs.length === 0) {
      // Clean up any stale embeddings
      await prisma.$executeRaw`DELETE FROM bot_faq_embeddings WHERE tenant_id = ${tenantId}`;
      return { processed: 0, chunks: 0 };
    }

    // Delete existing embeddings for this tenant
    await prisma.$executeRaw`DELETE FROM bot_faq_embeddings WHERE tenant_id = ${tenantId}`;

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

        await prisma.$executeRaw`
          INSERT INTO bot_faq_embeddings (tenant_id, faq_id, chunk_text, chunk_index, embedding, model)
          VALUES (${tenantId}, ${chunk.faqId}::uuid, ${chunk.text}, ${chunk.index}, ${embeddingStr}::vector, ${EMBEDDING_MODEL})
        `;
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

    const results = await prisma.$queryRaw<any[]>`
      SELECT
        e.faq_id,
        f.question,
        e.chunk_text,
        1 - (e.embedding <=> ${embeddingStr}::vector) as score
      FROM bot_faq_embeddings e
      JOIN faqs f ON f.id = e.faq_id
      WHERE e.tenant_id = ${tenantId}
        AND f.is_published = true
        AND e.embedding IS NOT NULL
      ORDER BY e.embedding <=> ${embeddingStr}::vector
      LIMIT ${topK}
    `;

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
    const result = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as cnt FROM bot_faq_embeddings WHERE tenant_id = ${tenantId}
    `;
    return parseInt(result[0]?.cnt || '0') > 0;
  }

  /**
   * Chunk product catalog data into embeddings from the storefront MV.
   * Includes name, description, features, tags, and badges for rich search.
   */
  private chunkProduct(product: any): { text: string; index: number }[] {
    const parsePgArray = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      const s = String(val).replace(/^\{|\}$/g, '');
      return s ? s.split(',').map((v: string) => v.trim()) : [];
    };

    const features = parsePgArray(product.features);
    const tags = parsePgArray(product.tags);
    const badges = parsePgArray(product.featured_type_array);

    const parts = [
      `Product: ${product.product_name}`,
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
    const products = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        inventory_item_id::text as product_id,
        product_name::text as product_name,
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
      tenantId
    );

    if (products.length === 0) {
      await prisma.$executeRaw`DELETE FROM bot_product_embeddings WHERE tenant_id = ${tenantId}`;
      return { processed: 0, chunks: 0 };
    }

    // Delete existing product embeddings for this tenant
    await prisma.$executeRaw`DELETE FROM bot_product_embeddings WHERE tenant_id = ${tenantId}`;

    let totalChunks = 0;
    const batchSize = 100;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const allChunks: { productId: string; text: string; index: number }[] = [];

      for (const product of batch) {
        const chunks = this.chunkProduct(product);
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

        await prisma.$executeRaw`
          INSERT INTO bot_product_embeddings (tenant_id, product_id, chunk_text, chunk_index, embedding, model)
          VALUES (${tenantId}, ${chunk.productId}, ${chunk.text}, ${chunk.index}, ${embeddingStr}::vector, ${EMBEDDING_MODEL})
        `;
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
   */
  async searchProducts(tenantId: string, query: string, topK: number = 3): Promise<ProductRagResult> {
    const queryEmbedding = await this.generateQueryEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const results = await prisma.$queryRaw<any[]>`
      SELECT
        e.product_id,
        ii.name as product_name,
        e.chunk_text,
        1 - (e.embedding <=> ${embeddingStr}::vector) as score
      FROM bot_product_embeddings e
      JOIN inventory_items ii ON ii.id = e.product_id
      WHERE e.tenant_id = ${tenantId}
        AND ii.item_status = 'active'
        AND e.embedding IS NOT NULL
      ORDER BY e.embedding <=> ${embeddingStr}::vector
      LIMIT ${topK}
    `;

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
    const result = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as cnt FROM bot_product_embeddings WHERE tenant_id = ${tenantId}
    `;
    return parseInt(result[0]?.cnt || '0') > 0;
  }
}

export default BotRagService;
