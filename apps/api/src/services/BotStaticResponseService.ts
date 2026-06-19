/**
 * Bot Static Response Service
 *
 * Free tier: exact-match / keyword lookup against FAQ table.
 * No AI — pure database queries.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

export interface StaticResponseResult {
  reply: string;
  responseType: 'static' | 'fallback';
  matchedFaqId: string | null;
  confidence: number;
}

export class BotStaticResponseService {
  private static instance: BotStaticResponseService;

  static getInstance(): BotStaticResponseService {
    if (!BotStaticResponseService.instance) {
      BotStaticResponseService.instance = new BotStaticResponseService();
    }
    return BotStaticResponseService.instance;
  }

  /**
   * Find a FAQ answer for the user's message.
   * Strategy: exact match on question → keyword match on question → keyword match on answer.
   */
  async findResponse(
    tenantId: string,
    message: string,
    pageContext?: string
  ): Promise<StaticResponseResult> {
    const normalized = message.trim().toLowerCase();

    // 1. Exact match on question
    const exactMatch = await prisma.$queryRaw<any[]>`
      SELECT id, question, answer
      FROM faqs
      WHERE tenant_id = ${tenantId}
        AND is_published = true
        AND LOWER(TRIM(question)) = ${normalized}
      LIMIT 1
    `;

    if (exactMatch.length > 0) {
      logger.debug('[BotStaticResponseService] Exact match found', undefined, { tenantId, faqId: exactMatch[0].id });
      return {
        reply: exactMatch[0].answer,
        responseType: 'static',
        matchedFaqId: exactMatch[0].id,
        confidence: 1.0,
      };
    }

    // 2. Keyword match on question (Jaccard similarity)
    const keywords = this.extractKeywords(normalized);
    if (keywords.length > 0) {
      const keywordMatch = await prisma.$queryRaw<any[]>`
        SELECT id, question, answer,
          similarity(LOWER(question), ${normalized}) as sim_score
        FROM faqs
        WHERE tenant_id = ${tenantId}
          AND is_published = true
          AND similarity(LOWER(question), ${normalized}) > 0.3
        ORDER BY sim_score DESC
        LIMIT 1
      `;

      if (keywordMatch.length > 0 && keywordMatch[0].sim_score > 0.3) {
        logger.debug('[BotStaticResponseService] Keyword match found', undefined, {
          tenantId,
          faqId: keywordMatch[0].id,
          score: keywordMatch[0].sim_score,
        });
        return {
          reply: keywordMatch[0].answer,
          responseType: 'static',
          matchedFaqId: keywordMatch[0].id,
          confidence: Math.min(keywordMatch[0].sim_score, 1.0),
        };
      }

      // 3. Fallback: keyword search in answer text
      const answerMatch = await prisma.$queryRaw<any[]>`
        SELECT id, question, answer,
          similarity(LOWER(answer), ${normalized}) as sim_score
        FROM faqs
        WHERE tenant_id = ${tenantId}
          AND is_published = true
          AND similarity(LOWER(answer), ${normalized}) > 0.3
        ORDER BY sim_score DESC
        LIMIT 1
      `;

      if (answerMatch.length > 0 && answerMatch[0].sim_score > 0.3) {
        logger.debug('[BotStaticResponseService] Answer match found', undefined, {
          tenantId,
          faqId: answerMatch[0].id,
          score: answerMatch[0].sim_score,
        });
        return {
          reply: answerMatch[0].answer,
          responseType: 'static',
          matchedFaqId: answerMatch[0].id,
          confidence: Math.min(answerMatch[0].sim_score * 0.8, 1.0),
        };
      }
    }

    // 4. No match — return fallback
    const config = await prisma.bot_configurations.findUnique({
      where: { tenant_id: tenantId },
    });

    return {
      reply: config?.fallback_message || "I'm not sure about that. Let me connect you with support.",
      responseType: 'fallback',
      matchedFaqId: null,
      confidence: 0,
    };
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'need', 'i', 'you', 'he',
      'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these',
      'those', 'what', 'when', 'where', 'why', 'how', 'who', 'which',
      'to', 'of', 'in', 'on', 'at', 'for', 'with', 'about', 'from',
      'and', 'or', 'but', 'not', 'no', 'yes', 'so', 'if', 'then',
    ]);

    return text
      .split(/\s+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length > 2 && !stopWords.has(w));
  }
}

export default BotStaticResponseService;
