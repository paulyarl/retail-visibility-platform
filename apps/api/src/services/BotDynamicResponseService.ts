/**
 * Bot Dynamic Response Service
 *
 * Uses OpenAI GPT with RAG (retrieved FAQ context) + multi-turn conversation
 * history to generate natural responses. For commitment/ecommerce tier tenants.
 *
 * Falls back to BotStaticResponseService if OpenAI is unavailable.
 */

import { logger } from '../logger';
import { prisma } from '../prisma';
import aiProviderFactory from './ai-providers';
import BotRagService from './BotRagService';
import BotConversationService from './BotConversationService';
import BotProductCatalogService from './BotProductCatalogService';
import BotPlatformGuideService from './BotPlatformGuideService';
import BotCrmAssistantService from './BotCrmAssistantService';
import { StorefrontPolicyService } from './StorefrontPolicyService';
import BotKnowledgeEmbeddingService from './BotKnowledgeEmbeddingService';
import BotChannelSteeringService, { type SteeringChannel } from './BotChannelSteeringService';
import { resolveEffectiveCapabilities } from './EffectiveCapabilityResolver';
import type { BotMessage } from './BotConversationService';
import type { BotConfig } from './BotConfigurationService';
import type { PlatformContextSurface } from './BotPlatformGuideService';

export interface DynamicResponseResult {
  reply: string;
  responseType: 'dynamic' | 'fallback' | 'channel_steering';
  matchedFaqId: string | null;
  confidence: number;
  ragChunksUsed: number;
  productContextUsed: boolean;
  crmContextUsed: boolean;
  policyContextUsed: boolean;
  knowledgeContextUsed: boolean;
  channels?: SteeringChannel[];
}

const PRODUCT_KEYWORDS = [
  'product', 'item', 'buy', 'purchase', 'shop', 'price', 'cost', 'sale',
  'discount', 'deal', 'new', 'arrival', 'clearance', 'seasonal', 'featured',
  'category', 'catalog', 'inventory', 'stock', 'available', 'recommend',
  'best', 'popular', 'trending', 'bestseller', 'brand', 'sku', 'description',
  'specification', 'feature', 'compare', 'cart', 'checkout', 'order',
];

const SUPPORT_KEYWORDS = [
  'ticket', 'support', 'help', 'complaint', 'issue', 'problem',
  'customer service', 'contact', 'escalate', 'inquiry', 'request',
  'assistance', 'representative', 'manager', 'complain',
];

const COUPON_KEYWORDS = [
  'coupon', 'discount', 'promo', 'promo code', 'promotion code', 'voucher',
  'save', 'deal', 'offer', 'percentage off', 'percent off', 'money off',
  'free shipping', 'buy one get one', 'bogo', 'code', 'coupon code',
];

const POLICY_KEYWORDS = [
  'return policy', 'shipping policy', 'refund policy', 'privacy policy',
  'terms of service', 'terms and conditions', 'refund', 'return',
  'exchange', 'warranty', 'guarantee', 'shipping', 'delivery time',
  'how long do i have to return', 'can i get a refund', 'money back',
];

function isProductQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return PRODUCT_KEYWORDS.some(kw => lower.includes(kw));
}

function isSupportQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return SUPPORT_KEYWORDS.some(kw => lower.includes(kw));
}

function isPolicyQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return POLICY_KEYWORDS.some(kw => lower.includes(kw));
}

function isCouponQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return COUPON_KEYWORDS.some(kw => lower.includes(kw));
}

const SYSTEM_PROMPT_TEMPLATE = (config: BotConfig, surface?: string) => {
  const isDashboard = surface === 'dashboard';
  const base = `You are ${config.botName}, a helpful ${isDashboard ? 'platform assistant for a store owner' : 'shopping assistant for an online store'}.
Tone: ${config.tone}.
Response length: ${config.responseLength === 'concise' ? 'Keep answers short and to the point.' : config.responseLength === 'detailed' ? 'Provide thorough, detailed answers.' : 'Balance brevity and detail.'}`;

  if (isDashboard) {
    return `${base}

Rules:
- You are helping the MERCHANT (store owner) understand and use their platform.
- Help them navigate features, suggest next steps, and guide them to the right settings pages.
- Use the platform context to give accurate, tier-aware advice.
- Be encouraging and action-oriented. Suggest specific things they can do next.
- Do not share internal tier keys, capability keys, or technical implementation details.
- If the merchant asks about something outside the platform, gently redirect to platform-related topics.`;
  }

  return `${base}

Rules:
- Only answer questions related to the store, products, orders, policies, and shopping.
- If you don't know something, say so honestly rather than making up information.
- Be friendly and helpful.
- If the customer seems upset, offer to connect them with support.
- Do not share internal system information or technical details.
- When product catalog context is provided, use it to answer specific product questions. Only mention products that are in the context. Do not invent products, prices, or availability.
- When support ticket context is provided, reference real ticket data. Do not invent ticket numbers or statuses. Offer to create a ticket if the customer needs help.
- When store policy context is provided, use it to answer policy questions accurately. Do not invent policy details. If a policy is not configured, say so and suggest contacting the store.`;
};

const DEFAULT_CHAT_MODEL = 'gpt-4o-mini';

class BotDynamicResponseService {
  private static instance: BotDynamicResponseService;
  private platformAiEnabledCache: boolean | null = null;
  private platformAiCacheTime: number = 0;
  private chatModelCache: string | null = null;
  private chatModelCacheTime: number = 0;
  private static readonly PLATFORM_AI_CACHE_TTL = 30_000; // 30 seconds
  private channelSteeringService = BotChannelSteeringService.getInstance();

  private constructor() {}

  static getInstance(): BotDynamicResponseService {
    if (!BotDynamicResponseService.instance) {
      BotDynamicResponseService.instance = new BotDynamicResponseService();
    }
    return BotDynamicResponseService.instance;
  }

  isAvailable(): boolean {
    return aiProviderFactory.isChatAvailable();
  }

  /**
   * Check if platform admin has enabled bot AI features.
   * Cached for 30 seconds to avoid hitting the DB on every message.
   */
  async isPlatformAiEnabled(): Promise<boolean> {
    const now = Date.now();
    if (this.platformAiEnabledCache !== null && (now - this.platformAiCacheTime) < BotDynamicResponseService.PLATFORM_AI_CACHE_TTL) {
      return this.platformAiEnabledCache;
    }

    try {
      const settings = await prisma.platform_settings_list.findFirst();
      this.platformAiEnabledCache = settings?.bot_ai_enabled ?? true;
      this.platformAiCacheTime = now;
      return this.platformAiEnabledCache;
    } catch {
      return true; // fail open
    }
  }

  /**
   * Get the configured chat model from platform settings (cached).
   */
  async getChatModel(): Promise<string> {
    const now = Date.now();
    if (this.chatModelCache !== null && (now - this.chatModelCacheTime) < BotDynamicResponseService.PLATFORM_AI_CACHE_TTL) {
      return this.chatModelCache;
    }
    try {
      const settings = await prisma.platform_settings_list.findFirst();
      this.chatModelCache = settings?.bot_chat_model ?? DEFAULT_CHAT_MODEL;
      this.chatModelCacheTime = now;
      return this.chatModelCache!;
    } catch {
      return DEFAULT_CHAT_MODEL;
    }
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

    // Resolve effective capabilities once for skill gating
    let allowedSkills: string[] = [];
    let effectiveProductTypes: string[] | undefined;
    try {
      const caps = await resolveEffectiveCapabilities(tenantId);
      if (caps?.effective?.chatbot) {
        allowedSkills = caps.effective.chatbot.allowed_skill_types || [];
      }
      if (caps?.effective?.product_types) {
        effectiveProductTypes = caps.effective.product_types.effective_types;
      }
    } catch (capError) {
      logger.warn('[BotDynamicResponseService] Failed to resolve capabilities, allowing all skills', undefined, {
        tenantId,
        error: capError instanceof Error ? capError.message : String(capError),
      });
    }

    const hasSkill = (skill: string) => allowedSkills.length === 0 || allowedSkills.includes(skill);

    let ragContext = '';
    let ragChunksUsed = 0;
    let matchedFaqId: string | null = null;
    let productContext = '';
    let productContextUsed = false;
    let crmContext = '';
    let crmContextUsed = false;
    let policyContext = '';
    let policyContextUsed = false;
    let knowledgeContext = '';
    let knowledgeContextUsed = false;

    // 1. FAQ RAG — gated by chatbot_skill_policy_faq
    try {
      if (hasSkill('chatbot_skill_policy_faq')) {
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
      }
    } catch (ragError) {
      logger.warn('[BotDynamicResponseService] RAG search failed, continuing without context', undefined, {
        error: ragError instanceof Error ? ragError.message : String(ragError),
      });
    }

    // 2. Retrieve product catalog context — gated by chatbot_skill_product_search
    try {
      if (hasSkill('chatbot_skill_product_search') && isProductQuery(message)) {
        const productSearch = await productCatalogService.searchProducts(tenantId, message, {
          limit: 5,
          inStockOnly: true,
          productTypes: effectiveProductTypes,
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

    // 2.5. Retrieve CRM ticket context — gated by chatbot_skill_crm_assistant
    try {
      if (hasSkill('chatbot_skill_crm_assistant') && isSupportQuery(message)) {
        const crmAssistantService = BotCrmAssistantService.getInstance();
        // We don't have customer email in this context, so inject general CRM availability
        // The actual ticket lookup happens via the CRM skill endpoints
        if (pageContext === 'dashboard') {
          crmContext = '\n\nCRM context: This tenant has a CRM system. The merchant may have open support tickets. Offer to check ticket status or create a new ticket if needed. App Store related issues (purchases, billing, feature activation, refunds) can be escalated to an App Store support ticket with category "app_store".';
        } else {
          crmContext = '\n\nCRM context: This tenant has a CRM system. The customer may have open support tickets. Offer to check ticket status or create a new ticket if needed.';
        }
        crmContextUsed = true;
      }
    } catch (crmError) {
      logger.warn('[BotDynamicResponseService] CRM context lookup failed, continuing without CRM context', undefined, {
        error: crmError instanceof Error ? crmError.message : String(crmError),
      });
    }

    // 2.6. Knowledge RAG — badge registry + store policies via semantic search
    // Replaces fragile keyword-gated injection with pgvector similarity search.
    try {
      const knowledgeService = BotKnowledgeEmbeddingService.getInstance();

      // Badge registry knowledge — gated by chatbot_skill_product_search
      if (hasSkill('chatbot_skill_product_search')) {
        const hasBadgeEmb = await knowledgeService.hasKnowledgeEmbeddings(tenantId, 'badge_registry');
        if (hasBadgeEmb) {
          const badgeResult = await knowledgeService.searchKnowledge(tenantId, message, ['badge_registry'], 3);
          if (badgeResult.chunks.length > 0) {
            knowledgeContext += '\n\nBadge knowledge context:\n' +
              badgeResult.chunks.map(c => c.chunkText).join('\n\n');
            knowledgeContextUsed = true;
          }
        }
      }

      // Policy knowledge — gated by chatbot_skill_policy_faq
      if (hasSkill('chatbot_skill_policy_faq')) {
        const hasPolicyEmb = await knowledgeService.hasKnowledgeEmbeddings(tenantId, 'policy');
        if (hasPolicyEmb) {
          const policyResult = await knowledgeService.searchKnowledge(tenantId, message, ['policy'], 3);
          if (policyResult.chunks.length > 0) {
            policyContext = '\n\nStore policies context:\n' +
              policyResult.chunks.map(c => c.chunkText).join('\n\n');
            policyContextUsed = true;
          }
        }
      }

      // Business info + hours knowledge — gated by chatbot_skill_store_hours
      if (hasSkill('chatbot_skill_store_hours')) {
        const hasBizInfo = await knowledgeService.hasKnowledgeEmbeddings(tenantId, 'business_info');
        const hasHours = await knowledgeService.hasKnowledgeEmbeddings(tenantId, 'hours');
        const bizSourceTypes: string[] = [];
        if (hasBizInfo) bizSourceTypes.push('business_info');
        if (hasHours) bizSourceTypes.push('hours');
        if (bizSourceTypes.length > 0) {
          const bizResult = await knowledgeService.searchKnowledge(tenantId, message, bizSourceTypes, 3);
          if (bizResult.chunks.length > 0) {
            knowledgeContext += '\n\nBusiness info context:\n' +
              bizResult.chunks.map(c => c.chunkText).join('\n\n');
            knowledgeContextUsed = true;
          }
        }
      }

      // Fulfillment settings knowledge — gated by chatbot_skill_inventory
      if (hasSkill('chatbot_skill_inventory')) {
        const hasFulfillment = await knowledgeService.hasKnowledgeEmbeddings(tenantId, 'fulfillment');
        if (hasFulfillment) {
          const fulfillmentResult = await knowledgeService.searchKnowledge(tenantId, message, ['fulfillment'], 3);
          if (fulfillmentResult.chunks.length > 0) {
            knowledgeContext += '\n\nFulfillment context:\n' +
              fulfillmentResult.chunks.map(c => c.chunkText).join('\n\n');
            knowledgeContextUsed = true;
          }
        }
      }

      // Directory promotion knowledge — always available when promotion embeddings exist
      try {
        const hasPromotion = await knowledgeService.hasKnowledgeEmbeddings(tenantId, 'promotion');
        if (hasPromotion) {
          const promotionResult = await knowledgeService.searchKnowledge(tenantId, message, ['promotion'], 2);
          if (promotionResult.chunks.length > 0) {
            knowledgeContext += '\n\nPromotion context:\n' +
              promotionResult.chunks.map(c => c.chunkText).join('\n\n');
            knowledgeContextUsed = true;
          }
        }
      } catch (promoError) {
        logger.warn('[BotDynamicResponseService] Promotion RAG search failed, continuing without it', undefined, {
          error: promoError instanceof Error ? promoError.message : String(promoError),
        });
      }

      // Feature store purchase knowledge — always available when feature_purchase embeddings exist
      try {
        const hasFeaturePurchase = await knowledgeService.hasKnowledgeEmbeddings(tenantId, 'feature_purchase');
        if (hasFeaturePurchase) {
          const featurePurchaseResult = await knowledgeService.searchKnowledge(tenantId, message, ['feature_purchase'], 3);
          if (featurePurchaseResult.chunks.length > 0) {
            knowledgeContext += '\n\nFeature Store purchases context:\n' +
              featurePurchaseResult.chunks.map(c => c.chunkText).join('\n\n');
            knowledgeContextUsed = true;
          }
        }
      } catch (featurePurchaseError) {
        logger.warn('[BotDynamicResponseService] Feature purchase RAG search failed, continuing without it', undefined, {
          error: featurePurchaseError instanceof Error ? featurePurchaseError.message : String(featurePurchaseError),
        });
      }

      // Featured store placement knowledge — always available when featured_placement embeddings exist
      try {
        const hasFeaturedPlacement = await knowledgeService.hasKnowledgeEmbeddings(tenantId, 'featured_placement');
        if (hasFeaturedPlacement) {
          const featuredPlacementResult = await knowledgeService.searchKnowledge(tenantId, message, ['featured_placement'], 3);
          if (featuredPlacementResult.chunks.length > 0) {
            knowledgeContext += '\n\nFeatured Store placements context:\n' +
              featuredPlacementResult.chunks.map(c => c.chunkText).join('\n\n');
            knowledgeContextUsed = true;
          }
        }
      } catch (featuredPlacementError) {
        logger.warn('[BotDynamicResponseService] Featured placement RAG search failed, continuing without it', undefined, {
          error: featuredPlacementError instanceof Error ? featuredPlacementError.message : String(featuredPlacementError),
        });
      }

      // Policy template context
      try {
        const hasPolicyTemplate = await knowledgeService.hasKnowledgeEmbeddings(tenantId, 'policy_template');
        if (hasPolicyTemplate) {
          const policyTemplateResult = await knowledgeService.searchKnowledge(tenantId, message, ['policy_template'], 3);
          if (policyTemplateResult.chunks.length > 0) {
            knowledgeContext += '\n\nPolicy template recommendations context:\n' +
              policyTemplateResult.chunks.map(c => c.chunkText).join('\n\n');
            knowledgeContextUsed = true;
          }
        }
      } catch (policyTemplateError) {
        logger.warn('[BotDynamicResponseService] Policy template RAG search failed, continuing without it', undefined, {
          error: policyTemplateError instanceof Error ? policyTemplateError.message : String(policyTemplateError),
        });
      }

      // Funnel offer context — inject when customer asks about products
      try {
        const hasFunnel = await knowledgeService.hasKnowledgeEmbeddings(tenantId, 'funnel');
        if (hasFunnel && isProductQuery(message)) {
          const funnelResult = await knowledgeService.searchKnowledge(tenantId, message, ['funnel'], 3);
          if (funnelResult.chunks.length > 0) {
            knowledgeContext += '\n\nActive sales funnel offers context (mention these offers when relevant to product questions):\n' +
              funnelResult.chunks.map(c => c.chunkText).join('\n\n');
            knowledgeContextUsed = true;
          }
        }
      } catch (funnelError) {
        logger.warn('[BotDynamicResponseService] Funnel RAG search failed, continuing without funnel context', undefined, {
          error: funnelError instanceof Error ? funnelError.message : String(funnelError),
        });
      }

      // Coupon offer context — inject when customer asks about coupons/discounts
      try {
        const hasCoupon = await knowledgeService.hasKnowledgeEmbeddings(tenantId, 'coupon');
        if (hasCoupon && isCouponQuery(message)) {
          const couponResult = await knowledgeService.searchKnowledge(tenantId, message, ['coupon'], 3);
          if (couponResult.chunks.length > 0) {
            knowledgeContext += '\n\nActive coupon offers context (only mention coupons listed here; do not invent codes, discounts, or expiry dates):\n' +
              couponResult.chunks.map(c => c.chunkText).join('\n\n');
            knowledgeContextUsed = true;
          }
        }
      } catch (couponError) {
        logger.warn('[BotDynamicResponseService] Coupon RAG search failed, continuing without coupon context', undefined, {
          error: couponError instanceof Error ? couponError.message : String(couponError),
        });
      }
    } catch (knowledgeError) {
      logger.warn('[BotDynamicResponseService] Knowledge RAG search failed, continuing without knowledge context', undefined, {
        error: knowledgeError instanceof Error ? knowledgeError.message : String(knowledgeError),
      });
    }

    // 3. Get conversation history (last 10 messages)
    const history = await conversationService.getContextWindow(conversationId, 10);

    // 3.5. Inject platform context (capability + tier awareness)
    let platformContext = '';
    try {
      const platformGuideService = BotPlatformGuideService.getInstance();
      const ctxSurface: PlatformContextSurface = pageContext === 'dashboard' ? 'dashboard' : 'storefront';
      platformContext = await platformGuideService.buildPromptContext(tenantId, ctxSurface);
    } catch (platformError) {
      logger.warn('[BotDynamicResponseService] Platform context lookup failed, continuing without it', undefined, {
        error: platformError instanceof Error ? platformError.message : String(platformError),
      });
    }

    // 4. Build messages array for OpenAI
    const surface = pageContext === 'dashboard' ? 'dashboard' : undefined;
    let systemPrompt = SYSTEM_PROMPT_TEMPLATE(config, surface) + ragContext + productContext + knowledgeContext + crmContext + policyContext + platformContext;
    if (pageContext) {
      systemPrompt += `\n\nThe customer is currently viewing a ${pageContext} page. Tailor your response accordingly.`;
    }

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
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

    // 4. Call AI provider
    try {
      const result = await aiProviderFactory.generateChatCompletion({
        messages,
        maxTokens: config.responseLength === 'concise' ? 150 : config.responseLength === 'detailed' ? 500 : 300,
        temperature: config.tone === 'playful' ? 0.8 : config.tone === 'professional' ? 0.3 : 0.5,
      });

      const reply = result.content.trim();
      if (!reply) {
        // Empty AI response -> steer to available human channels
        const steering = await this.channelSteeringService.steer(tenantId, config.botName);
        return {
          reply: steering.reply,
          responseType: 'channel_steering',
          matchedFaqId: null,
          confidence: 0,
          ragChunksUsed: 0,
          productContextUsed: false,
          crmContextUsed: false,
          policyContextUsed: false,
          knowledgeContextUsed: false,
          channels: steering.channels,
        };
      }

      return {
        reply,
        responseType: 'dynamic',
        matchedFaqId,
        confidence: 0.85,
        ragChunksUsed,
        productContextUsed,
        crmContextUsed,
        policyContextUsed,
        knowledgeContextUsed,
      };
    } catch (gptError) {
      logger.error('[BotDynamicResponseService] Chat completion failed', undefined, {
        error: gptError instanceof Error ? gptError.message : String(gptError),
      });

      // AI provider error -> steer to available human channels
      const steering = await this.channelSteeringService.steer(tenantId, config.botName);
      return {
        reply: steering.reply,
        responseType: 'channel_steering',
        matchedFaqId: null,
        confidence: 0,
        ragChunksUsed: 0,
        productContextUsed: false,
        crmContextUsed: false,
        policyContextUsed: false,
        knowledgeContextUsed: false,
        channels: steering.channels,
      };
    }
  }
}

export default BotDynamicResponseService;
