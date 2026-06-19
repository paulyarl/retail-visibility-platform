/**
 * Bot BERT Intent Service
 *
 * Uses Transformers.js (@huggingface/transformers) to run zero-shot
 * classification for intent detection with BERT/DistilBERT.
 *
 * Falls back to the existing keyword-based BotIntentService if the model
 * is unavailable or not yet loaded.
 */

import { logger } from '../logger';

type ZeroShotResult = { label: string; score: number }[];

class BotBertIntentService {
  private static instance: BotBertIntentService;
  private pipeline: any = null;
  private initPromise: Promise<void> | null = null;

  // Intent labels aligned with the bot_intents table
  private static readonly INTENT_LABELS = [
    'product inquiry',
    'order status',
    'return or refund',
    'shipping information',
    'store hours',
    'contact support',
    'pricing or discount',
    'general question',
  ];

  private constructor() {}

  static getInstance(): BotBertIntentService {
    if (!BotBertIntentService.instance) {
      BotBertIntentService.instance = new BotBertIntentService();
    }
    return BotBertIntentService.instance;
  }

  /**
   * Lazily load the zero-shot classification model.
   * Uses Xenova/distilbert-base-uncased-mnli (zero-shot NLI).
   */
  private async ensureModel(): Promise<void> {
    if (this.pipeline || this.initPromise) {
      if (this.initPromise) await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      try {
        const { pipeline, env } = await import('@huggingface/transformers');
        env.allowLocalModels = false;

        this.pipeline = await pipeline(
          'zero-shot-classification',
          'Xenova/distilbert-base-uncased-mnli',
          { quantized: true } as any
        );
        logger.info('[BotBertIntent] Model loaded: Xenova/distilbert-base-uncased-mnli');
      } catch (error) {
        logger.warn('[BotBertIntent] Failed to load model, will use keyword fallback', undefined, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    await this.initPromise;
  }

  isAvailable(): boolean {
    return this.pipeline !== null;
  }

  /**
   * Classify the user's message into one of the known intents.
   * Returns the top intent label and confidence score.
   */
  async classify(message: string): Promise<{ intent: string; confidence: number }> {
    if (!this.pipeline) {
      await this.ensureModel();
    }

    if (!this.pipeline) {
      // Model not available — defer to keyword-based intent service
      return { intent: 'general_question', confidence: 0 };
    }

    try {
      const result = await this.pipeline(
        message,
        BotBertIntentService.INTENT_LABELS
      ) as ZeroShotResult;

      if (!result || result.length === 0) {
        return { intent: 'general_question', confidence: 0 };
      }

      const top = result[0];
      // Map label to intent name (replace spaces with underscores)
      const intent = top.label.replace(/\s+/g, '_');
      return { intent, confidence: top.score };
    } catch (error) {
      logger.warn('[BotBertIntent] Classification failed', undefined, {
        error: error instanceof Error ? error.message : String(error),
      });
      return { intent: 'general_question', confidence: 0 };
    }
  }
}

export default BotBertIntentService;
