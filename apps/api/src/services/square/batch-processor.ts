/**
 * Square Batch Processor
 * Handles efficient bulk operations with rate limiting
 * Phase 3: Sync Service Implementation
 */

export interface BatchOptions {
  batchSize?: number;
  maxConcurrent?: number;
  retryAttempts?: number;
  retryDelay?: number;
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerSecond?: number;
  };
}

export interface BatchResult<T> {
  succeeded: T[];
  failed: Array<{ item: any; error: string; attempt: number }>;
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  duration: number;
}

export interface BatchProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
  estimatedTimeRemaining?: number;
}

export class BatchProcessor<T> {
  private options: Required<BatchOptions>;
  private requestTimestamps: number[];
  private progressCallback?: (progress: BatchProgress) => void;

  constructor(options: BatchOptions = {}) {
    this.options = {
      batchSize: options.batchSize || 100,
      maxConcurrent: options.maxConcurrent || 5,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      rateLimit: options.rateLimit || {
        requestsPerMinute: 100,
        requestsPerSecond: 10,
      },
    };
    this.requestTimestamps = [];
  }

  /**
   * Set progress callback
   */
  onProgress(callback: (progress: BatchProgress) => void) {
    this.progressCallback = callback;
  }

  /**
   * Process items in batches
   */
  async process<R>(
    items: T[],
    processor: (item: T) => Promise<R>
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const succeeded: R[] = [];
    const failed: Array<{ item: T; error: string; attempt: number }> = [];

    // Split into batches
    const batches = this.createBatches(items);
    const totalBatches = batches.length;

    console.log(`[BatchProcessor] Processing ${items.length} items in ${totalBatches} batches`);

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchStartTime = Date.now();

      this.updateProgress({
        total: items.length,
        processed: succeeded.length + failed.length,
        succeeded: succeeded.length,
        failed: failed.length,
        currentBatch: i + 1,
        totalBatches,
      });

      console.log(`[BatchProcessor] Processing batch ${i + 1}/${totalBatches} (${batch.length} items)`);

      // Process batch items with concurrency control
      const batchResults = await this.processBatchWithConcurrency(batch, processor);

      succeeded.push(...batchResults.succeeded);
      failed.push(...batchResults.failed);

      // Rate limiting between batches
      if (i < batches.length - 1) {
        await this.enforceRateLimit();
      }

      const batchDuration = Date.now() - batchStartTime;
      console.log(
        `[BatchProcessor] Batch ${i + 1} complete: ` +
          `${batchResults.succeeded.length} succeeded, ` +
          `${batchResults.failed.length} failed ` +
          `(${batchDuration}ms)`
      );
    }

    const duration = Date.now() - startTime;

    this.updateProgress({
      total: items.length,
      processed: items.length,
      succeeded: succeeded.length,
      failed: failed.length,
      currentBatch: totalBatches,
      totalBatches,
    });

    console.log(
      `[BatchProcessor] Complete: ${succeeded.length}/${items.length} succeeded ` +
        `(${duration}ms total)`
    );

    return {
      succeeded,
      failed,
      totalProcessed: items.length,
      totalSucceeded: succeeded.length,
      totalFailed: failed.length,
      duration,
    };
  }

  /**
   * Process a single batch with concurrency control
   */
  private async processBatchWithConcurrency<R>(
    batch: T[],
    processor: (item: T) => Promise<R>
  ): Promise<{
    succeeded: R[];
    failed: Array<{ item: T; error: string; attempt: number }>;
  }> {
    const succeeded: R[] = [];
    const failed: Array<{ item: T; error: string; attempt: number }> = [];

    // Process items with concurrency limit
    const chunks = this.createChunks(batch, this.options.maxConcurrent);

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map((item) => this.processWithRetry(item, processor))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          succeeded.push(result.value);
        } else {
          failed.push({
            item: chunk[index],
            error: result.reason?.message || 'Unknown error',
            attempt: this.options.retryAttempts,
          });
        }
      });
    }

    return { succeeded, failed };
  }

  /**
   * Process single item with retry logic
   */
  private async processWithRetry<R>(
    item: T,
    processor: (item: T) => Promise<R>,
    attempt: number = 1
  ): Promise<R> {
    try {
      await this.enforceRateLimit();
      return await processor(item);
    } catch (error: any) {
      if (attempt < this.options.retryAttempts) {
        console.log(
          `[BatchProcessor] Retry ${attempt}/${this.options.retryAttempts} for item after error: ${error.message}`
        );
        await this.delay(this.options.retryDelay * attempt); // Exponential backoff
        return this.processWithRetry(item, processor, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Create batches from items
   */
  private createBatches(items: T[]): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += this.options.batchSize) {
      batches.push(items.slice(i, i + this.options.batchSize));
    }
    return batches;
  }

  /**
   * Create chunks for concurrent processing
   */
  private createChunks(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Enforce rate limiting
   */
  private async enforceRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneSecondAgo = now - 1000;

    // Clean old timestamps
    this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > oneMinuteAgo);

    // Check per-minute limit
    if (this.requestTimestamps.length >= this.options.rateLimit.requestsPerMinute) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = 60000 - (now - oldestTimestamp);
      if (waitTime > 0) {
        console.log(`[BatchProcessor] Rate limit: waiting ${waitTime}ms`);
        await this.delay(waitTime);
      }
    }

    // Check per-second limit
    if (this.options.rateLimit.requestsPerSecond) {
      const recentRequests = this.requestTimestamps.filter((ts) => ts > oneSecondAgo);
      if (recentRequests.length >= this.options.rateLimit.requestsPerSecond) {
        const oldestRecentTimestamp = recentRequests[0];
        const waitTime = 1000 - (now - oldestRecentTimestamp);
        if (waitTime > 0) {
          await this.delay(waitTime);
        }
      }
    }

    // Record this request
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Delay for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update progress
   */
  private updateProgress(progress: Omit<BatchProgress, 'estimatedTimeRemaining'>) {
    if (this.progressCallback) {
      const estimatedTimeRemaining = this.calculateEstimatedTime(progress);
      this.progressCallback({
        ...progress,
        estimatedTimeRemaining,
      });
    }
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateEstimatedTime(progress: Omit<BatchProgress, 'estimatedTimeRemaining'>): number | undefined {
    if (progress.processed === 0) return undefined;

    const itemsRemaining = progress.total - progress.processed;
    const averageTimePerItem = Date.now() / progress.processed;
    return Math.round(itemsRemaining * averageTimePerItem);
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): {
    requestsInLastMinute: number;
    requestsInLastSecond: number;
    canMakeRequest: boolean;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneSecondAgo = now - 1000;

    const requestsInLastMinute = this.requestTimestamps.filter((ts) => ts > oneMinuteAgo).length;
    const requestsInLastSecond = this.requestTimestamps.filter((ts) => ts > oneSecondAgo).length;

    const canMakeRequest =
      requestsInLastMinute < this.options.rateLimit.requestsPerMinute &&
      (!this.options.rateLimit.requestsPerSecond ||
        requestsInLastSecond < this.options.rateLimit.requestsPerSecond);

    return {
      requestsInLastMinute,
      requestsInLastSecond,
      canMakeRequest,
    };
  }

  /**
   * Reset rate limit tracking
   */
  resetRateLimit() {
    this.requestTimestamps = [];
  }
}

/**
 * Create a batch processor with default Square API rate limits
 */
export function createSquareBatchProcessor<T>(options: BatchOptions = {}): BatchProcessor<T> {
  return new BatchProcessor<T>({
    batchSize: 100, // Square supports up to 1000, but 100 is safer
    maxConcurrent: 5,
    retryAttempts: 3,
    retryDelay: 1000,
    rateLimit: {
      requestsPerMinute: 100, // Square API limit
      requestsPerSecond: 10,
    },
    ...options,
  });
}
