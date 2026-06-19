/**
 * Bot BERT Guardrail Service
 *
 * Uses Transformers.js (@huggingface/transformers) to run BERT-based
 * text classification for toxicity/profanity detection.
 *
 * Falls back to the existing rule-based BotGuardrailService if the model
 * is unavailable or not yet loaded.
 */

import { logger } from '../logger';

type ClassificationResult = { label: string; score: number };

class BotBertGuardrailService {
  private static instance: BotBertGuardrailService;
  private pipeline: any = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): BotBertGuardrailService {
    if (!BotBertGuardrailService.instance) {
      BotBertGuardrailService.instance = new BotBertGuardrailService();
    }
    return BotBertGuardrailService.instance;
  }

  /**
   * Lazily load the toxicity classification model.
   * Uses Xenova/toxic-bert (fine-tuned for toxicity detection).
   */
  private async ensureModel(): Promise<void> {
    if (this.pipeline || this.initPromise) {
      if (this.initPromise) await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      try {
        const { pipeline, env } = await import('@huggingface/transformers');
        // Allow local cache
        env.allowLocalModels = false;

        this.pipeline = await pipeline(
          'text-classification',
          'Xenova/toxic-bert',
          { quantized: true } as any
        );
        logger.info('[BotBertGuardrail] Model loaded: Xenova/toxic-bert');
      } catch (error) {
        logger.warn('[BotBertGuardrail] Failed to load model, will use rule-based fallback', undefined, {
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
   * Check if a message is toxic using BERT classification.
   * Returns true if the message should be blocked.
   */
  async isToxic(message: string): Promise<{ toxic: boolean; score: number }> {
    if (!this.pipeline) {
      await this.ensureModel();
    }

    if (!this.pipeline) {
      // Model not available — defer to rule-based guardrails
      return { toxic: false, score: 0 };
    }

    try {
      const result = await this.pipeline(message) as ClassificationResult[];
      const topResult = Array.isArray(result) ? result[0] : result;

      // toxic-bert labels: 'toxic', 'severe_toxic', 'obscene', 'threat', 'insult', 'identity_hate'
      const isToxic = topResult.label === 'toxic' && topResult.score > 0.7;
      return { toxic: isToxic, score: topResult.score };
    } catch (error) {
      logger.warn('[BotBertGuardrail] Classification failed', undefined, {
        error: error instanceof Error ? error.message : String(error),
      });
      return { toxic: false, score: 0 };
    }
  }
}

export default BotBertGuardrailService;
