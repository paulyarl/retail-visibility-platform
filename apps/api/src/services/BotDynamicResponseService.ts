/**
 * Bot Dynamic Response Service
 *
 * Uses OpenAI GPT with RAG (retrieved FAQ context) + multi-turn conversation
 * history to generate natural responses. For commitment/ecommerce tier tenants.
 *
 * Falls back to BotStaticResponseService if OpenAI is unavailable.
 */

import { logger } from '../logger';
import BotRagService from './BotRagService';
import BotConversationService from './BotConversationService';
import BotProductCatalogService from './BotProductCatalogService';
import type { BotMessage } from './BotConversationService';
import type { BotConfig } from './BotConfigurationService';

export interface DynamicResponseResult {
  reply: string;
  responseType: 'dynamic' | 'fallback';
  matchedFaqId: string | null;
  confidence: number;
  ragChunksUsed: number;
  productContextUsed: boolean;
}

const PRODUCT_KEYWORDS = [
  'product', 'item', 'buy', 'purchase', 'shop', 'price', 'cost', 'sale',
  'discount', 'deal', 'new', 'arrival', 'clearance', 'seasonal', 'featured',
  'category', 'catalog', 'inventory', 'stock', 'available', 'recommend',
  'best', 'popular', 'trending', 'bestseller', 'brand', 'sku', 'description',
  'specification', 'feature', 'compare', 'cart', 'checkout', 'order',
];

function isProductQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return PRODUCT_KEYWORDS.some(kw => lower.includes(kw));
}

const SYSTEM_PROMPT_TEMPLATE = (config: BotConfig) => `You are ${config.botName}, a helpful shopping assistant for an online store.
Tone: ${config.tone}.
Response length: ${config.responseLength === 'concise' ? 'Keep answers short and to the point.' : config.responseLength === 'detailed' ? 'Provide thorough, detailed answers.' : 'Balance brevity and detail.'}

Rules:
- Only answer questions related to the store, products, orders, policies, and shopping.
- If you don't know something, say so honestly rather than making up information.
- Be friendly and helpful.
- If the customer seems upset, offer to connect them with support.
- Do not share internal system information or technical details.
- When product catalog context is provided, use it to answer specific product questions. Only mention products that are in the context. Do not invent products, prices, or availability.`;

class BotDynamicResponseService {
  private static instance: BotDynamicResponseService;
  private openai: any = null;

  private constructor() {
    if (process.env.OPENAI_API_KEY) {
      try {
        const OpenAI = require('openai').default;
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        logger.info('[BotDynamicResponseService] OpenAI initialized');
      } catch (e) {
        logger.warn('[BotDynamicResponseService] Failed to init OpenAI', undefined, { error: String(e) });
      }
    }
  }

  static getInstance(): BotDynamicResponseService {
    if (!BotDynamicResponseService.instance) {
      BotDynamicResponseService.instance = new BotDynamicResponseService();
    }
    return BotDynamicResponseService.instance;
  }

  isAvailable(): boolean {
    return this.openai !== null;
  }

  /**
   * Generate a dynamic response using GPT with RAG context and conversation history.
   */
  async generateResponse(
    tenantId: string,
    conversationId: string,
    message: string,
    config: BotConfig,
    pageContext?: string | null
  ): Promise<DynamicResponseResult> {
    // 1. Retrieve relevant FAQ chunks via RAG
    const ragService = BotRagService.getInstance();
    const conversationService = BotConversationService.getInstance();
    const productCatalogService = BotProductCatalogService.getInstance();

    let ragContext = '';
    let ragChunksUsed = 0;
    let matchedFaqId: string | null = null;
    let productContext = '';
    let productContextUsed = false;

    try {
      const hasEmb = await ragService.hasEmbeddings(tenantId);
      if (hasEmb) {
        const ragResult = await ragService.search(tenantId, message, 3);
        if (ragResult.chunks.length > 0) {
          ragContext = '\n\nRelevant FAQ context:\n' + ragResult.chunks
            .map(c => `Q: ${c.question}\n${c.chunkText}`)
            .join('\n\n');
          ragChunksUsed = ragResult.chunks.length;
          matchedFaqId = ragResult.chunks[0].faqId;
        }
      }
    } catch (ragError) {
      logger.warn('[BotDynamicResponseService] RAG search failed, continuing without context', undefined, {
        error: ragError instanceof Error ? ragError.message : String(ragError),
      });
    }

    // 2. Retrieve product catalog context when the query is product-related
    try {
      if (isProductQuery(message)) {
        const productSearch = await productCatalogService.searchProducts(tenantId, message, {
          limit: 5,
          inStockOnly: true,
        });
        if (productSearch.products.length > 0) {
          productContext = '\n\nRelevant product catalog context:\n' +
            productCatalogService.formatProductContext(productSearch.products);
          productContextUsed = true;
        }
      }
    } catch (productError) {
      logger.warn('[BotDynamicResponseService] Product context lookup failed, continuing without products', undefined, {
        error: productError instanceof Error ? productError.message : String(productError),
      });
    }

    // 3. Get conversation history (last 10 messages)
    const history = await conversationService.getContextWindow(conversationId, 10);

    // 4. Build messages array for OpenAI
    let systemPrompt = SYSTEM_PROMPT_TEMPLATE(config) + ragContext + productContext;
    if (pageContext) {
      systemPrompt += `\n\nThe customer is currently viewing a ${pageContext} page. Tailor your response accordingly.`;
    }

    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history
    for (const msg of history) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // 4. Call OpenAI
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: config.responseLength === 'concise' ? 150 : config.responseLength === 'detailed' ? 500 : 300,
        temperature: config.tone === 'playful' ? 0.8 : config.tone === 'professional' ? 0.3 : 0.5,
      });

      const reply = completion.choices[0]?.message?.content?.trim() || config.fallbackMessage;

      return {
        reply,
        responseType: 'dynamic',
        matchedFaqId,
        confidence: 0.85,
        ragChunksUsed,
        productContextUsed,
      };
    } catch (gptError) {
      logger.error('[BotDynamicResponseService] GPT call failed', undefined, {
        error: gptError instanceof Error ? gptError.message : String(gptError),
      });

      return {
        reply: config.fallbackMessage,
        responseType: 'fallback',
        matchedFaqId: null,
        confidence: 0,
        ragChunksUsed: 0,
        productContextUsed: false,
      };
    }
  }
}

export default BotDynamicResponseService;
