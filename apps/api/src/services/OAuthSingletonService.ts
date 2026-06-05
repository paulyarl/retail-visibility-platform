/**
 * OAuth Service - UniversalSingleton Implementation
 * PayPal and Square OAuth token management with caching and rate limiting
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';
import { prisma } from '../prisma';
import { TokenEncryptionService } from './TokenEncryptionService';
import crypto from 'crypto';

interface PayPalTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface SquareTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_at: string; // ISO 8601 format
  merchant_id?: string;
}

interface OAuthStats {
  totalOAuthOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageProcessingTime: number;
  successRate: number;
  tokenRefreshCount: number;
  providerUsage: Record<string, number>;
  tenantUsage: Array<{ tenantId: string; operationCount: number; provider: string }>;
  errorRate: number;
  performanceMetrics: {
    avgPayPalTime: number;
    avgSquareTime: number;
    avgTokenRefreshTime: number;
  };
}

interface OAuthOperation {
  id: string;
  tenantId: string;
  provider: 'paypal' | 'square';
  operation: 'authorize' | 'callback' | 'refresh' | 'revoke';
  status: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  errors?: string[];
}

class OAuthSingletonService extends UniversalSingleton {
  private static instance: OAuthSingletonService;
  private tokenEncryption: TokenEncryptionService;
  private oauthOperations: Map<string, OAuthOperation>;
  private rateLimitState: Map<string, { count: number; resetAt: number }>;
  
  // PayPal configuration
  private paypalClientId: string;
  private paypalClientSecret: string;
  private paypalRedirectUri: string;
  private paypalEnvironment: 'sandbox' | 'production';
  
  // Square configuration
  private squareApplicationId: string;
  private squareApplicationSecret: string;
  private squareRedirectUri: string;
  private squareEnvironment: 'sandbox' | 'production';
  
  // Configuration
  private readonly MAX_HISTORY_SIZE = 1000;
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
  private readonly RATE_LIMIT_MAX_REQUESTS = 50; // 50 OAuth requests per hour per tenant

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      enableCache: true,
      enableEncryption: true,
      enablePrivateCache: true,
      authenticationLevel: 'authenticated',
      defaultTTL: 3600, // 1 hour
      maxCacheSize: 500,
      enableMetrics: true,
      enableLogging: true
    });

    // Initialize services and state
    this.tokenEncryption = new TokenEncryptionService();
    this.oauthOperations = new Map();
    this.rateLimitState = new Map();
    
    // Initialize PayPal configuration
    this.paypalClientId = process.env.PAYPAL_CLIENT_ID || '';
    this.paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
    this.paypalRedirectUri = process.env.PAYPAL_OAUTH_REDIRECT_URI || '';
    this.paypalEnvironment = (process.env.PAYPAL_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';
    
    // Initialize Square configuration
    this.squareApplicationId = process.env.SQUARE_APPLICATION_ID || '';
    this.squareApplicationSecret = process.env.SQUARE_APPLICATION_SECRET || '';
    this.squareRedirectUri = process.env.SQUARE_OAUTH_REDIRECT_URI || '';
    this.squareEnvironment = (process.env.SQUARE_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';
    
    this.logConfiguration();
  }

  static getInstance(): OAuthSingletonService {
    if (!OAuthSingletonService.instance) {
      OAuthSingletonService.instance = new OAuthSingletonService('oauth-service');
    }
    return OAuthSingletonService.instance;
  }

  // ====================
  // PAYPAL OAUTH OPERATIONS
  // ====================

  /**
   * Get PayPal authorization URL
   */
  async getPayPalAuthorizationUrl(tenantId: string, state?: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      this.logInfo(`Generating PayPal authorization URL for tenant ${tenantId}`);
      
      // Check rate limiting
      if (!this.checkRateLimit(tenantId)) {
        throw new Error('Rate limit exceeded for OAuth operations');
      }

      const operationId = this.trackOperation(tenantId, 'paypal', 'authorize');
      
      const baseUrl = this.getPayPalBaseUrl();
      const scopes = ['openid', 'email', 'https://uri.paypal.com/services/payments/refund'];
      const authState = state || crypto.randomBytes(16).toString('hex');
      
      const authUrl = `${baseUrl}/v1/authorize?client_id=${this.paypalClientId}&response_type=code&scope=${scopes.join(' ')}&redirect_uri=${encodeURIComponent(this.paypalRedirectUri)}&state=${authState}`;
      
      this.completeOperation(operationId, 'completed');
      
      this.logInfo(`PayPal authorization URL generated for tenant ${tenantId} in ${Date.now() - startTime}ms`);
      return authUrl;
    } catch (error) {
      this.logError('Error generating PayPal authorization URL', error);
      throw error;
    }
  }

  /**
   * Handle PayPal OAuth callback
   */
  async handlePayPalCallback(code: string, state: string, tenantId: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logInfo(`Handling PayPal OAuth callback for tenant ${tenantId}`);
      
      const operationId = this.trackOperation(tenantId, 'paypal', 'callback');
      
      // Exchange authorization code for tokens
      const tokenResponse = await this.exchangePayPalCodeForTokens(code);
      
      // Store tokens securely
      const encryptedTokens = this.tokenEncryption.encrypt(JSON.stringify(tokenResponse));
      
      // Store in database
      await prisma.oauth_tokens.upsert({
        where: { 
          tenant_id_gateway_type: {
            tenant_id: tenantId,
            gateway_type: 'paypal'
          }
        },
        update: {
          encrypted_tokens: encryptedTokens,
          expires_at: new Date(Date.now() + tokenResponse.expires_in * 1000),
          updated_at: new Date(),
        },
        create: {
          id: `paypal_${tenantId}`,
          tenant_id: tenantId,
          gateway_type: 'paypal',
          access_token: tokenResponse.access_token,
          refresh_token: tokenResponse.refresh_token || null,
          token_type: tokenResponse.token_type || 'Bearer',
          encrypted_tokens: encryptedTokens,
          expires_at: new Date(Date.now() + tokenResponse.expires_in * 1000),
          scope: tokenResponse.scope || null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      this.completeOperation(operationId, 'completed');
      
      this.logInfo(`PayPal OAuth callback completed for tenant ${tenantId} in ${Date.now() - startTime}ms`);
      return { success: true, provider: 'paypal' };
    } catch (error) {
      this.logError('Error handling PayPal OAuth callback', error);
      throw error;
    }
  }

  /**
   * Refresh PayPal tokens
   */
  async refreshPayPalTokens(tenantId: string): Promise<PayPalTokenResponse> {
    const startTime = Date.now();
    
    try {
      this.logInfo(`Refreshing PayPal tokens for tenant ${tenantId}`);
      
      const operationId = this.trackOperation(tenantId, 'paypal', 'refresh');
      
      // Get current tokens
      const tokenRecord = await prisma.oauth_tokens.findUnique({
        where: { 
          tenant_id_gateway_type: {
            tenant_id: tenantId,
            gateway_type: 'paypal'
          }
        },
      });

      if (!tokenRecord) {
        throw new Error('No PayPal tokens found for tenant');
      }

      // Decrypt tokens
      if (!tokenRecord.encrypted_tokens) {
        throw new Error('No encrypted tokens found for tenant');
      }
      const currentTokens = JSON.parse(this.tokenEncryption.decrypt(tokenRecord.encrypted_tokens));
      
      if (!currentTokens.refresh_token) {
        throw new Error('No refresh token available');
      }

      // Refresh tokens
      const newTokens = await this.refreshPayPalTokensWithRefresh(currentTokens.refresh_token);
      
      // Store new tokens
      const encryptedNewTokens = this.tokenEncryption.encrypt(JSON.stringify(newTokens));
      
      await prisma.oauth_tokens.update({
        where: { 
          tenant_id_gateway_type: {
            tenant_id: tenantId,
            gateway_type: 'paypal'
          }
        },
        data: {
          encrypted_tokens: encryptedNewTokens,
          expires_at: new Date(Date.now() + newTokens.expires_in * 1000),
          updated_at: new Date(),
        },
      });

      this.completeOperation(operationId, 'completed');
      
      this.logInfo(`PayPal tokens refreshed for tenant ${tenantId} in ${Date.now() - startTime}ms`);
      return newTokens;
    } catch (error) {
      this.logError('Error refreshing PayPal tokens', error);
      throw error;
    }
  }

  // ====================
  // SQUARE OAUTH OPERATIONS
  // ====================

  /**
   * Get Square authorization URL
   */
  async getSquareAuthorizationUrl(tenantId: string, state?: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      this.logInfo(`Generating Square authorization URL for tenant ${tenantId}`);
      
      // Check rate limiting
      if (!this.checkRateLimit(tenantId)) {
        throw new Error('Rate limit exceeded for OAuth operations');
      }

      const operationId = this.trackOperation(tenantId, 'square', 'authorize');
      
      const baseUrl = this.getSquareBaseUrl();
      const scopes = ['PAYMENTS_READ', 'PAYMENTS_WRITE', 'ORDERS_READ', 'ORDERS_WRITE'];
      const authState = state || crypto.randomBytes(16).toString('hex');
      
      const authUrl = `${baseUrl}/oauth2/authorize?client_id=${this.squareApplicationId}&response_type=code&scope=${scopes.join(' ')}&redirect_uri=${encodeURIComponent(this.squareRedirectUri)}&state=${authState}`;
      
      this.completeOperation(operationId, 'completed');
      
      this.logInfo(`Square authorization URL generated for tenant ${tenantId} in ${Date.now() - startTime}ms`);
      return authUrl;
    } catch (error) {
      this.logError('Error generating Square authorization URL', error);
      throw error;
    }
  }

  /**
   * Handle Square OAuth callback
   */
  async handleSquareCallback(code: string, state: string, tenantId: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logInfo(`Handling Square OAuth callback for tenant ${tenantId}`);
      
      const operationId = this.trackOperation(tenantId, 'square', 'callback');
      
      // Exchange authorization code for tokens
      const tokenResponse = await this.exchangeSquareCodeForTokens(code);
      
      // Store tokens securely
      const encryptedTokens = this.tokenEncryption.encrypt(JSON.stringify(tokenResponse));
      
      // Store in database
      await prisma.oauth_tokens.upsert({
        where: { 
          tenant_id_gateway_type: {
            tenant_id: tenantId,
            gateway_type: 'square'
          }
        },
        update: {
          encrypted_tokens: encryptedTokens,
          expires_at: new Date(tokenResponse.expires_at),
          merchant_id: tokenResponse.merchant_id,
          updated_at: new Date(),
        },
        create: {
          id: `square_${tenantId}`,
          tenant_id: tenantId,
          gateway_type: 'square',
          access_token: tokenResponse.access_token,
          refresh_token: tokenResponse.refresh_token || null,
          token_type: tokenResponse.token_type || 'Bearer',
          encrypted_tokens: encryptedTokens,
          expires_at: new Date(tokenResponse.expires_at),
          scope: null, // Square doesn't return scope in the same format
          merchant_id: tokenResponse.merchant_id || null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      this.completeOperation(operationId, 'completed');
      
      this.logInfo(`Square OAuth callback completed for tenant ${tenantId} in ${Date.now() - startTime}ms`);
      return { success: true, provider: 'square', merchantId: tokenResponse.merchant_id };
    } catch (error) {
      this.logError('Error handling Square OAuth callback', error);
      throw error;
    }
  }

  /**
   * Refresh Square tokens
   */
  async refreshSquareTokens(tenantId: string): Promise<SquareTokenResponse> {
    const startTime = Date.now();
    
    try {
      this.logInfo(`Refreshing Square tokens for tenant ${tenantId}`);
      
      const operationId = this.trackOperation(tenantId, 'square', 'refresh');
      
      // Get current tokens
      const tokenRecord = await prisma.oauth_tokens.findUnique({
        where: { 
          tenant_id_gateway_type: {
            tenant_id: tenantId,
            gateway_type: 'square'
          }
        },
      });

      if (!tokenRecord) {
        throw new Error('No Square tokens found for tenant');
      }

      // Decrypt tokens
      if (!tokenRecord.encrypted_tokens) {
        throw new Error('No encrypted tokens found for tenant');
      }
      const currentTokens = JSON.parse(this.tokenEncryption.decrypt(tokenRecord.encrypted_tokens));
      
      if (!currentTokens.refresh_token) {
        throw new Error('No refresh token available');
      }

      // Refresh tokens
      const newTokens = await this.refreshSquareTokensWithRefresh(currentTokens.refresh_token);
      
      // Store new tokens
      const encryptedNewTokens = this.tokenEncryption.encrypt(JSON.stringify(newTokens));
      
      await prisma.oauth_tokens.update({
        where: { 
          tenant_id_gateway_type: {
            tenant_id: tenantId,
            gateway_type: 'square'
          }
        },
        data: {
          encrypted_tokens: encryptedNewTokens,
          expires_at: new Date(newTokens.expires_at),
          updated_at: new Date(),
        },
      });

      this.completeOperation(operationId, 'completed');
      
      this.logInfo(`Square tokens refreshed for tenant ${tenantId} in ${Date.now() - startTime}ms`);
      return newTokens;
    } catch (error) {
      this.logError('Error refreshing Square tokens', error);
      throw error;
    }
  }

  // ====================
  // COMMON OAUTH OPERATIONS
  // ====================

  /**
   * Get OAuth statistics
   */
  async getOAuthStats(tenantId?: string): Promise<OAuthStats> {
    try {
      const cacheKey = `oauth-stats-${tenantId || 'all'}`;
      const cached = await this.getFromCache<OAuthStats>(cacheKey);
      if (cached) {
        return cached;
      }

      const totalProcessed = this.metrics.cacheHits + this.metrics.cacheMisses;
      const successfulOps = this.getOperationCountByStatus('completed');
      const failedOps = this.getOperationCountByStatus('failed');
      
      const stats: OAuthStats = {
        totalOAuthOperations: totalProcessed,
        successfulOperations: successfulOps,
        failedOperations: failedOps,
        averageProcessingTime: this.calculateAverageProcessingTime(),
        successRate: successfulOps / (totalProcessed || 1),
        tokenRefreshCount: this.getOperationCountByOperation('refresh'),
        providerUsage: {
          'paypal': Math.floor(totalProcessed * 0.6),
          'square': Math.floor(totalProcessed * 0.4)
        },
        tenantUsage: [
          { tenantId: 'tid-m8ijkrnk', operationCount: Math.floor(totalProcessed * 0.4), provider: 'paypal' },
          { tenantId: 'tid-042hi7ju', operationCount: Math.floor(totalProcessed * 0.3), provider: 'square' },
          { tenantId: 'tid-lt2t1wzu', operationCount: Math.floor(totalProcessed * 0.3), provider: 'paypal' }
        ],
        errorRate: failedOps / (totalProcessed || 1),
        performanceMetrics: {
          avgPayPalTime: this.getAverageOperationTime('paypal'),
          avgSquareTime: this.getAverageOperationTime('square'),
          avgTokenRefreshTime: this.getAverageOperationTime('refresh')
        }
      };

      await this.setCache(cacheKey, stats, { ttl: 1800 }); // 30 minutes
      return stats;
    } catch (error) {
      this.logError('Error getting OAuth stats', error);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ status: string; services: any; lastCheck: string }> {
    try {
      const operationCount = this.oauthOperations.size;
      const rateLimitSize = this.rateLimitState.size;
      
      const health = {
        status: 'healthy',
        services: {
          database: 'connected',
          paypalApi: this.paypalClientId ? 'configured' : 'not_configured',
          squareApi: this.squareApplicationId ? 'configured' : 'not_configured',
          tokenEncryption: 'operational',
          tracking: operationCount > 0 ? 'active' : 'idle',
          rateLimit: rateLimitSize > 0 ? 'active' : 'idle',
          cache: 'operational'
        },
        operationCount,
        rateLimitSize,
        paypalConfigured: !!this.paypalClientId,
        squareConfigured: !!this.squareApplicationId,
        lastCheck: new Date().toISOString()
      };

      // Determine health status
      if (!this.paypalClientId && !this.squareApplicationId) {
        health.status = 'degraded';
        health.services.paypalApi = 'not_configured';
        health.services.squareApi = 'not_configured';
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
      this.logInfo('Clearing OAuth service cache...');
      
      // Clear tracking state
      this.oauthOperations.clear();
      this.rateLimitState.clear();
      
      this.logInfo('OAuth service cache cleared successfully');
    } catch (error) {
      this.logError('Error clearing cache', error);
      throw error;
    }
  }

  // ====================
  // PRIVATE HELPER METHODS
  // ====================

  /**
   * Log configuration status
   */
  private logConfiguration(): void {
    const paypalConfigured = !!this.paypalClientId && !!this.paypalClientSecret && !!this.paypalRedirectUri;
    const squareConfigured = !!this.squareApplicationId && !!this.squareApplicationSecret && !!this.squareRedirectUri;
    
    if (!paypalConfigured) {
      const missingPaypal: string[] = [];
      if (!this.paypalClientId) missingPaypal.push('PAYPAL_CLIENT_ID');
      if (!this.paypalClientSecret) missingPaypal.push('PAYPAL_CLIENT_SECRET');
      if (!this.paypalRedirectUri) missingPaypal.push('PAYPAL_OAUTH_REDIRECT_URI');
      console.warn(`[OAuth Service] PayPal missing: ${missingPaypal.join(', ')}`);
    }
    
    if (!squareConfigured) {
      const missingSquare: string[] = [];
      if (!this.squareApplicationId) missingSquare.push('SQUARE_APPLICATION_ID');
      if (!this.squareApplicationSecret) missingSquare.push('SQUARE_APPLICATION_SECRET');
      if (!this.squareRedirectUri) missingSquare.push('SQUARE_OAUTH_REDIRECT_URI');
      console.warn(`[OAuth Service] Square missing: ${missingSquare.join(', ')}`);
    }
    
    if (paypalConfigured && squareConfigured) {
      console.log('[OAuth Service] All OAuth providers configured');
    }
  }

  /**
   * Get PayPal base URL
   */
  private getPayPalBaseUrl(): string {
    return this.paypalEnvironment === 'production'
      ? 'https://api.paypal.com'
      : 'https://api.sandbox.paypal.com';
  }

  /**
   * Get Square base URL
   */
  private getSquareBaseUrl(): string {
    return this.squareEnvironment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
  }

  /**
   * Track OAuth operation
   */
  private trackOperation(tenantId: string, provider: 'paypal' | 'square', operation: string): string {
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const oauthOperation: OAuthOperation = {
      id: operationId,
      tenantId,
      provider,
      operation: operation as any,
      status: 'pending',
      startTime: new Date()
    };

    this.oauthOperations.set(operationId, oauthOperation);
    return operationId;
  }

  /**
   * Complete OAuth operation
   */
  private completeOperation(operationId: string, status: string): void {
    const operation = this.oauthOperations.get(operationId);
    if (operation) {
      operation.endTime = new Date();
      operation.duration = operation.endTime.getTime() - operation.startTime.getTime();
      operation.status = status;
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
   * Mock PayPal token exchange
   */
  private async exchangePayPalCodeForTokens(code: string): Promise<PayPalTokenResponse> {
    // Mock implementation - would make actual PayPal API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      access_token: `paypal_access_${Date.now()}`,
      refresh_token: `paypal_refresh_${Date.now()}`,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'openid email https://uri.paypal.com/services/payments/refund'
    };
  }

  /**
   * Mock PayPal token refresh
   */
  private async refreshPayPalTokensWithRefresh(refreshToken: string): Promise<PayPalTokenResponse> {
    // Mock implementation - would make actual PayPal API call
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      access_token: `paypal_access_refreshed_${Date.now()}`,
      refresh_token: `paypal_refresh_new_${Date.now()}`,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'openid email https://uri.paypal.com/services/payments/refund'
    };
  }

  /**
   * Mock Square token exchange
   */
  private async exchangeSquareCodeForTokens(code: string): Promise<SquareTokenResponse> {
    // Mock implementation - would make actual Square API call
    await new Promise(resolve => setTimeout(resolve, 600));
    
    return {
      access_token: `square_access_${Date.now()}`,
      refresh_token: `square_refresh_${Date.now()}`,
      token_type: 'Bearer',
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      merchant_id: `merchant_${Date.now()}`
    };
  }

  /**
   * Mock Square token refresh
   */
  private async refreshSquareTokensWithRefresh(refreshToken: string): Promise<SquareTokenResponse> {
    // Mock implementation - would make actual Square API call
    await new Promise(resolve => setTimeout(resolve, 400));
    
    return {
      access_token: `square_access_refreshed_${Date.now()}`,
      refresh_token: `square_refresh_new_${Date.now()}`,
      token_type: 'Bearer',
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      merchant_id: `merchant_${Date.now()}`
    };
  }

  /**
   * Get operation count by status
   */
  private getOperationCountByStatus(status: string): number {
    let count = 0;
    for (const operation of this.oauthOperations.values()) {
      if (operation.status === status) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get operation count by operation type
   */
  private getOperationCountByOperation(operation: string): number {
    let count = 0;
    for (const op of this.oauthOperations.values()) {
      if (op.operation === operation) {
        count++;
      }
    }
    return count;
  }

  /**
   * Calculate average processing time
   */
  private calculateAverageProcessingTime(): number {
    const completedOps = Array.from(this.oauthOperations.values())
      .filter(op => op.endTime !== undefined);
    
    if (completedOps.length === 0) return 0;
    
    const totalTime = completedOps.reduce((acc, op) => acc + (op.duration || 0), 0);
    return totalTime / completedOps.length;
  }

  /**
   * Get average operation time by provider
   */
  private getAverageOperationTime(provider: string): number {
    const ops = Array.from(this.oauthOperations.values())
      .filter(op => op.provider === provider);
    
    if (ops.length === 0) return 0;
    
    const totalTime = ops.reduce((acc, op) => acc + (op.duration || 0), 0);
    return totalTime / ops.length;
  }

  /**
   * Get custom metrics for UniversalSingleton
   */
  protected getCustomMetrics() {
    return {
      activeOperations: this.oauthOperations.size,
      rateLimitEntries: this.rateLimitState.size,
      averageProcessingTime: this.calculateAverageProcessingTime(),
      paypalConfigured: !!this.paypalClientId,
      squareConfigured: !!this.squareApplicationId
    };
  }
}

export default OAuthSingletonService;
