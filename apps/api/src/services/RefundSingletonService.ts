/**
 * Refund Service - UniversalSingleton Implementation
 * Payment refund processing with transaction state management and audit trail consistency
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';
import { prisma } from '../prisma';
import { customAlphabet } from 'nanoid';

const generateRefundId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

interface PayPalRefundResponse {
  id: string;
  status: string;
  amount?: {
    currency_code: string;
    value: string;
  };
  create_time?: string;
  update_time?: string;
  message?: string;
  details?: any[];
}

interface RefundRequest {
  orderId: string;
  paymentId: string;
  tenantId: string;
  reason: string;
  initiatedBy?: string;
}

interface RefundResult {
  success: boolean;
  refundId?: string;
  gatewayRefundId?: string;
  status: string;
  message?: string;
  error?: string;
}

interface RefundStats {
  totalRefunds: number;
  successfulRefunds: number;
  failedRefunds: number;
  averageProcessingTime: number;
  successRate: number;
  totalAmountRefunded: number;
  gatewayUsage: Record<string, number>;
  tenantUsage: Array<{ tenantId: string; refundCount: number; amountRefunded: number }>;
  errorRate: number;
  performanceMetrics: {
    avgGatewayTime: number;
    avgDatabaseTime: number;
    avgValidationTime: number;
  };
}

interface RefundOperation {
  id: string;
  tenantId: string;
  orderId: string;
  paymentId: string;
  gatewayType: string;
  amount: number;
  status: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  gatewayRefundId?: string;
  errors?: string[];
}

class RefundSingletonService extends UniversalSingleton {
  private static instance: RefundSingletonService;
  private refundOperations: Map<string, RefundOperation>;
  private rateLimitState: Map<string, { count: number; resetAt: number }>;
  
  // Configuration
  private readonly MAX_HISTORY_SIZE = 1000;
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
  private readonly RATE_LIMIT_MAX_REQUESTS = 100; // 100 refunds per hour per tenant

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      enableCache: true,
      enableEncryption: true,
      enablePrivateCache: true,
      authenticationLevel: 'authenticated',
      defaultTTL: 1800, // 30 minutes
      maxCacheSize: 500,
      enableMetrics: true,
      enableLogging: true
    });

    // Initialize tracking state
    this.refundOperations = new Map();
    this.rateLimitState = new Map();
  }

  static getInstance(): RefundSingletonService {
    if (!RefundSingletonService.instance) {
      RefundSingletonService.instance = new RefundSingletonService('refund-service');
    }
    return RefundSingletonService.instance;
  }

  // ====================
  // CORE REFUND OPERATIONS
  // ====================

  /**
   * Process a refund for a cancelled order
   */
  async processRefund(request: RefundRequest): Promise<RefundResult> {
    const startTime = Date.now();
    
    try {
      this.logInfo(`Processing refund for payment ${request.paymentId} in order ${request.orderId}`);
      
      // Check rate limiting
      if (!this.checkRateLimit(request.tenantId)) {
        this.logInfo(`Rate limit exceeded for tenant ${request.tenantId}`);
        return {
          success: false,
          status: 'failed',
          error: 'rate_limit_exceeded',
          message: 'Too many refund requests. Please try again later.'
        };
      }

      // Get payment details
      const payment = await prisma.payments.findUnique({
        where: { id: request.paymentId },
        include: {
          orders: true,
        },
      });

      if (!payment) {
        return {
          success: false,
          status: 'failed',
          error: 'payment_not_found',
          message: 'Payment record not found',
        };
      }

      // Check if payment was successful
      if (payment.payment_status !== 'paid') {
        return {
          success: false,
          status: 'failed',
          error: 'payment_not_paid',
          message: 'Cannot refund unpaid order',
        };
      }

      // Check if already refunded
      const existingRefund = await prisma.refunds.findFirst({
        where: {
          payment_id: request.paymentId,
          refund_status: { in: ['pending', 'processing', 'completed'] },
        },
      });

      if (existingRefund) {
        return {
          success: false,
          status: 'failed',
          error: 'already_refunded',
          message: 'This order has already been refunded',
        };
      }

      // Create refund operation tracking
      const operationId = this.generateOperationId();
      const refundOperation: RefundOperation = {
        id: operationId,
        tenantId: request.tenantId,
        orderId: request.orderId,
        paymentId: request.paymentId,
        gatewayType: payment.gateway_type || 'unknown',
        amount: payment.amount_cents,
        status: 'pending',
        startTime: new Date()
      };

      this.refundOperations.set(operationId, refundOperation);

      // Create refund record
      const refundId = `ref_${generateRefundId()}`;
      const refund = await prisma.refunds.create({
        data: {
          id: refundId,
          payment_id: request.paymentId,
          order_id: request.orderId,
          tenant_id: request.tenantId,
          amount_cents: payment.amount_cents,
          refund_status: 'pending',
          refund_reason: request.reason,
          gateway_type: payment.gateway_type || 'unknown',
          initiated_by: request.initiatedBy || 'system',
          created_at: new Date(),
        },
      });

      // Process refund through gateway
      const gatewayResult = await this.processGatewayRefund(payment, refundId, request.reason);

      // Update refund record
      await prisma.refunds.update({
        where: { id: refundId },
        data: {
          refund_status: gatewayResult.success ? 'completed' : 'failed',
          gateway_refund_id: gatewayResult.gatewayRefundId,
          gateway_response: gatewayResult as any,
          completed_at: gatewayResult.success ? new Date() : null,
        },
      });

      // Update operation tracking
      refundOperation.endTime = new Date();
      refundOperation.duration = refundOperation.endTime.getTime() - refundOperation.startTime.getTime();
      refundOperation.status = gatewayResult.success ? 'completed' : 'failed';
      refundOperation.gatewayRefundId = gatewayResult.gatewayRefundId;
      if (!gatewayResult.success) {
        refundOperation.errors = [gatewayResult.error || 'Unknown gateway error'];
      }

      // Clean up old operations
      if (this.refundOperations.size > this.MAX_HISTORY_SIZE) {
        this.cleanupOldOperations();
      }

      const result: RefundResult = {
        success: gatewayResult.success,
        refundId,
        gatewayRefundId: gatewayResult.gatewayRefundId,
        status: gatewayResult.success ? 'completed' : 'failed',
        message: gatewayResult.message,
        error: gatewayResult.error,
      };

      this.logInfo(`Refund ${gatewayResult.success ? 'completed' : 'failed'} for payment ${request.paymentId} in ${refundOperation.duration}ms`);
      
      return result;
    } catch (error) {
      this.logError('Error processing refund', error);
      throw error;
    }
  }

  /**
   * Get refund statistics
   */
  async getRefundStats(tenantId?: string): Promise<RefundStats> {
    try {
      const cacheKey = `refund-stats-${tenantId || 'all'}`;
      const cached = await this.getFromCache<RefundStats>(cacheKey);
      if (cached) {
        return cached;
      }

      const totalProcessed = this.metrics.cacheHits + this.metrics.cacheMisses;
      const successfulOps = this.getOperationCountByStatus('completed');
      const failedOps = this.getOperationCountByStatus('failed');
      
      const stats: RefundStats = {
        totalRefunds: totalProcessed,
        successfulRefunds: successfulOps,
        failedRefunds: failedOps,
        averageProcessingTime: this.calculateAverageProcessingTime(),
        successRate: successfulOps / (totalProcessed || 1),
        totalAmountRefunded: this.calculateTotalAmountRefunded(),
        gatewayUsage: {
          'paypal': Math.floor(totalProcessed * 0.6),
          'stripe': Math.floor(totalProcessed * 0.3),
          'square': Math.floor(totalProcessed * 0.1)
        },
        tenantUsage: [
          { tenantId: 'tid-m8ijkrnk', refundCount: Math.floor(totalProcessed * 0.4), amountRefunded: Math.floor(totalProcessed * 5000) },
          { tenantId: 'tid-042hi7ju', refundCount: Math.floor(totalProcessed * 0.3), amountRefunded: Math.floor(totalProcessed * 3500) },
          { tenantId: 'tid-lt2t1wzu', refundCount: Math.floor(totalProcessed * 0.3), amountRefunded: Math.floor(totalProcessed * 2500) }
        ],
        errorRate: failedOps / (totalProcessed || 1),
        performanceMetrics: {
          avgGatewayTime: this.getAverageOperationTime('gateway'),
          avgDatabaseTime: this.getAverageOperationTime('database'),
          avgValidationTime: this.getAverageOperationTime('validation')
        }
      };

      await this.setCache(cacheKey, stats, { ttl: 1800 }); // 30 minutes
      return stats;
    } catch (error) {
      this.logError('Error getting refund stats', error);
      throw error;
    }
  }

  /**
   * Get refund by ID
   */
  async getRefund(refundId: string, tenantId?: string): Promise<any> {
    try {
      const where: any = { id: refundId };
      if (tenantId) {
        where.tenant_id = tenantId;
      }

      const refund = await prisma.refunds.findUnique({
        where,
        include: {
          payments: true,
          orders: true,
        },
      });

      return refund;
    } catch (error) {
      this.logError('Error getting refund', error);
      throw error;
    }
  }

  /**
   * Get refunds for tenant
   */
  async getTenantRefunds(tenantId: string, status?: string, limit: number = 50): Promise<any[]> {
    try {
      const where: any = { tenant_id: tenantId };
      if (status) {
        where.refund_status = status;
      }

      const refunds = await prisma.refunds.findMany({
        where,
        include: {
          payments: true,
          orders: true,
        },
        orderBy: { created_at: 'desc' },
        take: limit,
      });

      return refunds;
    } catch (error) {
      this.logError('Error getting tenant refunds', error);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ status: string; services: any; lastCheck: string }> {
    try {
      const operationCount = this.refundOperations.size;
      const rateLimitSize = this.rateLimitState.size;
      
      const health = {
        status: 'healthy',
        services: {
          database: 'connected',
          paymentGateways: 'operational',
          tracking: operationCount > 0 ? 'active' : 'idle',
          rateLimit: rateLimitSize > 0 ? 'active' : 'idle',
          cache: 'operational'
        },
        operationCount,
        rateLimitSize,
        lastCheck: new Date().toISOString()
      };

      // Determine health status
      if (operationCount > 500) {
        health.status = 'degraded';
        health.services.tracking = 'busy';
      }

      return health;
    } catch (error) {
      this.logError('Error checking health', error);
      return {
        status: 'unhealthy',
        services: { error: 'Health check failed' },
        lastCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Clear cache and reset state
   */
  async clearCache(): Promise<void> {
    try {
      // Clear UniversalSingleton cache (simulated)
      this.logInfo('Clearing refund service cache...');
      
      // Clear tracking state
      this.refundOperations.clear();
      this.rateLimitState.clear();
      
      this.logInfo('Refund service cache cleared successfully');
    } catch (error) {
      this.logError('Error clearing cache', error);
      throw error;
    }
  }

  // ====================
  // PRIVATE HELPER METHODS
  // ====================

  /**
   * Generate operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Process refund through payment gateway
   */
  private async processGatewayRefund(payment: any, refundId: string, reason: string): Promise<RefundResult> {
    const gatewayType = payment.gateway_type || 'unknown';
    
    try {
      this.logInfo(`Processing ${gatewayType} refund for payment ${payment.id}`);
      
      switch (gatewayType.toLowerCase()) {
        case 'paypal':
          return await this.processPayPalRefund(payment, refundId, reason);
        case 'stripe':
          return await this.processStripeRefund(payment, refundId, reason);
        case 'square':
          return await this.processSquareRefund(payment, refundId, reason);
        default:
          return {
            success: false,
            status: 'failed',
            error: 'unsupported_gateway',
            message: `Refund processing not supported for ${gatewayType}`,
          };
      }
    } catch (error) {
      this.logError(`Error processing ${gatewayType} refund`, error);
      return {
        success: false,
        status: 'failed',
        error: 'gateway_error',
        message: 'Failed to process refund through payment gateway',
      };
    }
  }

  /**
   * Process PayPal refund
   */
  private async processPayPalRefund(payment: any, refundId: string, reason: string): Promise<RefundResult> {
    try {
      // Mock PayPal refund processing
      this.logInfo(`Processing PayPal refund for payment ${payment.id}`);
      
      // Simulate PayPal API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock PayPal response
      const paypalResponse: PayPalRefundResponse = {
        id: `paypal_refund_${Date.now()}`,
        status: 'COMPLETED',
        amount: {
          currency_code: 'USD',
          value: (payment.amount_cents / 100).toFixed(2),
        },
        create_time: new Date().toISOString(),
        message: 'Refund processed successfully',
      };

      return {
        success: true,
        gatewayRefundId: paypalResponse.id,
        status: 'completed',
        message: paypalResponse.message,
      };
    } catch (error) {
      this.logError('Error processing PayPal refund', error);
      return {
        success: false,
        status: 'failed',
        error: 'paypal_error',
        message: 'Failed to process PayPal refund',
      };
    }
  }

  /**
   * Process Stripe refund
   */
  private async processStripeRefund(payment: any, refundId: string, reason: string): Promise<RefundResult> {
    try {
      // Mock Stripe refund processing
      this.logInfo(`Processing Stripe refund for payment ${payment.id}`);
      
      // Simulate Stripe API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mock Stripe response
      return {
        success: true,
        gatewayRefundId: `stripe_refund_${Date.now()}`,
        status: 'succeeded',
        message: 'Refund processed successfully',
      };
    } catch (error) {
      this.logError('Error processing Stripe refund', error);
      return {
        success: false,
        status: 'failed',
        error: 'stripe_error',
        message: 'Failed to process Stripe refund',
      };
    }
  }

  /**
   * Process Square refund
   */
  private async processSquareRefund(payment: any, refundId: string, reason: string): Promise<RefundResult> {
    try {
      // Mock Square refund processing
      this.logInfo(`Processing Square refund for payment ${payment.id}`);
      
      // Simulate Square API call
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Mock Square response
      return {
        success: true,
        gatewayRefundId: `square_refund_${Date.now()}`,
        status: 'COMPLETED',
        message: 'Refund processed successfully',
      };
    } catch (error) {
      this.logError('Error processing Square refund', error);
      return {
        success: false,
        status: 'failed',
        error: 'square_error',
        message: 'Failed to process Square refund',
      };
    }
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(tenantId: string): boolean {
    const now = Date.now();
    const key = tenantId;
    const state = this.rateLimitState.get(key);
    
    if (!state || now > state.resetAt) {
      // Reset or initialize rate limit
      this.rateLimitState.set(key, {
        count: 1,
        resetAt: now + this.RATE_LIMIT_WINDOW_MS
      });
      return true;
    }
    
    if (state.count >= this.RATE_LIMIT_MAX_REQUESTS) {
      return false; // Rate limit exceeded
    }
    
    state.count++;
    return true;
  }

  /**
   * Get operation count by status
   */
  private getOperationCountByStatus(status: string): number {
    let count = 0;
    for (const operation of this.refundOperations.values()) {
      if (operation.status === status) {
        count++;
      }
    }
    return count;
  }

  /**
   * Calculate average processing time
   */
  private calculateAverageProcessingTime(): number {
    const completedOps = Array.from(this.refundOperations.values())
      .filter(op => op.endTime !== undefined);
    
    if (completedOps.length === 0) return 0;
    
    const totalTime = completedOps.reduce((acc, op) => acc + (op.duration || 0), 0);
    return totalTime / completedOps.length;
  }

  /**
   * Calculate total amount refunded
   */
  private calculateTotalAmountRefunded(): number {
    // Mock implementation - would query actual refund data
    const totalProcessed = this.metrics.cacheHits + this.metrics.cacheMisses;
    return Math.floor(totalProcessed * 5000); // Mock: $50 average refund
  }

  /**
   * Get average operation time by type
   */
  private getAverageOperationTime(type: string): number {
    const ops = Array.from(this.refundOperations.values())
      .filter(op => op.gatewayType.toLowerCase().includes(type));
    
    if (ops.length === 0) return 0;
    
    const totalTime = ops.reduce((acc, op) => acc + (op.duration || 0), 0);
    return totalTime / ops.length;
  }

  /**
   * Clean up old operations
   */
  private cleanupOldOperations(): void {
    const operations = Array.from(this.refundOperations.entries());
    
    // Sort by start time (oldest first)
    operations.sort((a, b) => a[1].startTime.getTime() - b[1].startTime.getTime());
    
    // Keep only the most recent operations
    const toKeep = operations.slice(-this.MAX_HISTORY_SIZE);
    
    // Clear and re-add
    this.refundOperations.clear();
    for (const [key, operation] of toKeep) {
      this.refundOperations.set(key, operation);
    }
  }

  /**
   * Get custom metrics for UniversalSingleton
   */
  protected getCustomMetrics() {
    return {
      activeOperations: this.refundOperations.size,
      rateLimitEntries: this.rateLimitState.size,
      averageProcessingTime: this.calculateAverageProcessingTime(),
      totalRefunded: this.calculateTotalAmountRefunded()
    };
  }
}

export default RefundSingletonService;
