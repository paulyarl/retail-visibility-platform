/**
 * Bot Intent Service
 *
 * Keyword-based only (Phase 1A): match user input against bot_intents.examples.
 * Confidence scoring via Jaccard similarity. BERT upgrade in Phase 3.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

export interface IntentResult {
  intent: string | null;
  confidence: number;
  mappedSkill: string | null;
}

export class BotIntentService {
  private static instance: BotIntentService;

  static getInstance(): BotIntentService {
    if (!BotIntentService.instance) {
      BotIntentService.instance = new BotIntentService();
    }
    return BotIntentService.instance;
  }

  /**
   * Detect intent from user message using keyword matching + Jaccard similarity.
   */
  async detectIntent(message: string): Promise<IntentResult> {
    const normalized = this.normalize(message);
    const messageTokens = this.tokenize(normalized);

    if (messageTokens.size === 0) {
      return { intent: null, confidence: 0, mappedSkill: null };
    }

    const intents = await prisma.bot_intents.findMany({
      where: { is_active: true },
    });

    let bestIntent: IntentResult = { intent: null, confidence: 0, mappedSkill: null };

    for (const intent of intents) {
      let maxSimilarity = 0;

      for (const example of intent.examples) {
        const exampleTokens = this.tokenize(this.normalize(example));
        const similarity = this.jaccardSimilarity(messageTokens, exampleTokens);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      if (maxSimilarity > bestIntent.confidence) {
        bestIntent = {
          intent: intent.name,
          confidence: maxSimilarity,
          mappedSkill: intent.mapped_skill,
        };
      }
    }

    // Apply confidence threshold
    const intentRecord = intents.find(i => i.name === bestIntent.intent);
    const threshold = intentRecord?.confidence_threshold || 0.85;

    if (bestIntent.confidence < threshold) {
      logger.debug('[BotIntentService] Below threshold', undefined, {
        intent: bestIntent.intent,
        confidence: bestIntent.confidence,
        threshold,
      });
      return { intent: null, confidence: bestIntent.confidence, mappedSkill: null };
    }

    logger.debug('[BotIntentService] Intent detected', undefined, {
      intent: bestIntent.intent,
      confidence: bestIntent.confidence,
    });

    return bestIntent;
  }

  private normalize(text: string): string {
    return text.toLowerCase().trim();
  }

  private tokenize(text: string): Set<string> {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'i', 'you',
      'my', 'your', 'what', 'when', 'where', 'why', 'how', 'who', 'do',
      'does', 'can', 'could', 'would', 'will', 'to', 'of', 'in', 'on',
      'at', 'for', 'with', 'about', 'from', 'and', 'or', 'but', 'not',
      'me', 'it', 'this', 'that', 'these', 'those',
    ]);

    return new Set(
      text
        .split(/\s+/)
        .map(w => w.replace(/[^a-z0-9]/g, ''))
        .filter(w => w.length > 1 && !stopWords.has(w))
    );
  }

  private jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const item of setA) {
      if (setB.has(item)) intersection++;
    }

    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
}

export default BotIntentService;
