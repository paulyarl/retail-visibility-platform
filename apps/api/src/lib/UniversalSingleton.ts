import { logger } from '../logger';

/**
 * Universal Singleton Base Class - API Server Version
 * 
 * Provides consistent singleton pattern, caching, and metrics
 * for server-side services
 */

// Singleton Metrics Interface
export interface SingletonMetrics {
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  cacheSize: number;
  inMemoryCacheSize: number;
  persistentCacheSize: number;
  apiCalls: number;
  errors: number;
  lastUpdated: string;
}

// Singleton Cache Options
export interface SingletonCacheOptions {
  enableCache?: boolean;
  defaultTTL?: number; // in seconds
  maxCacheSize?: number;
  enableMetrics?: boolean;
  enableLogging?: boolean;
  enableEncryption?: boolean;
  enablePrivateCache?: boolean;
  authenticationLevel?: 'public' | 'authenticated' | 'admin';
}

// Authentication Context
export interface AuthContext {
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  token?: string; // JWT token for legacy compatibility
  roles?: string[];
  permissions?: string[];
  auth0Id?: string; // Auth0 user ID
  auth0Email?: string; // Auth0 email
}

// Encryption Options
export interface EncryptionOptions {
  algorithm?: string;
  keyLength?: number;
  ivLength?: number;
  saltLength?: number;
}

/**
 * Universal Singleton Base Class
 * 
 * Provides consistent singleton pattern, caching, and metrics
 * for server-side services
 */
abstract class UniversalSingleton {
  protected readonly singletonKey: string;
  protected readonly cacheManager: any; // Would be your cache manager
  protected readonly metrics: SingletonMetrics;
  protected readonly options: SingletonCacheOptions;
  protected readonly encryptionOptions: EncryptionOptions;

  // In-memory cache for frequently accessed data
  protected memoryCache: Map<string, { data: any; expires: number; isPrivate?: boolean }> = new Map();
  
  // Private cache for sensitive data
  protected privateCache: Map<string, { data: any; expires: number; encrypted: boolean }> = new Map();
  
  // Authentication context
  protected currentAuthContext: AuthContext | null = null;

  constructor(singletonKey: string, options?: SingletonCacheOptions) {
    this.singletonKey = singletonKey;
    this.options = {
      enableCache: true,
      defaultTTL: 300, // 5 minutes
      maxCacheSize: 1000,
      enableMetrics: true,
      enableLogging: true,
      enableEncryption: false,
      enablePrivateCache: false,
      authenticationLevel: 'public',
      ...options
    };

    this.encryptionOptions = {
      algorithm: 'aes-256-gcm',
      keyLength: 32,
      ivLength: 16,
      saltLength: 16
    };

    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      cacheSize: 0,
      inMemoryCacheSize: 0,
      persistentCacheSize: 0,
      apiCalls: 0,
      errors: 0,
      lastUpdated: new Date().toISOString()
    };

    // Initialize cache manager
    this.cacheManager = this.initializeCacheManager();
  }

  /**
   * Initialize cache manager (can be overridden by child classes)
   */
  protected initializeCacheManager(): any {
    // Default implementation - can be overridden for specific cache backends
    return null;
  }

  // ====================
  // AUTHENTICATION METHODS
  // ====================

  /**
   * Set authentication context
   */
  setAuthContext(authContext: AuthContext): void {
    this.currentAuthContext = authContext;
    this.logInfo('Authentication context set', { userId: authContext.userId, tenantId: authContext.tenantId });
  }

  /**
   * Get current authentication context
   */
  getAuthContext(): AuthContext | null {
    return this.currentAuthContext;
  }

  /**
   * Check if user has required role
   */
  hasRole(role: string): boolean {
    return this.currentAuthContext?.roles?.includes(role) || false;
  }

  /**
   * Check if user has required permission
   */
  hasPermission(permission: string): boolean {
    return this.currentAuthContext?.permissions?.includes(permission) || false;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.currentAuthContext?.token;
  }

  /**
   * Validate authentication level
   */
  validateAuthLevel(requiredLevel: 'public' | 'authenticated' | 'admin'): boolean {
    if (!this.currentAuthContext) {
      return requiredLevel === 'public';
    }

    switch (requiredLevel) {
      case 'public':
        return true;
      case 'authenticated':
        return this.isAuthenticated();
      case 'admin':
        return this.hasRole('admin') || this.hasPermission('admin_access');
      default:
        return false;
    }
  }

  // ====================
  // LOGGING METHODS
  // ====================

  /**
   * Log info message
   */
  protected logInfo(message: string, metadata?: any): void {
    if (this.options.enableLogging) {
      console.log(`[${this.singletonKey}] INFO: ${message}`, metadata || '');
    }
  }

  /**
   * Log warning message
   */
  protected logWarning(message: string, metadata?: any): void {
    if (this.options.enableLogging) {
      console.warn(`[${this.singletonKey}] WARNING: ${message}`, metadata || '');
    }
  }

  /**
   * Log error message
   */
  protected logError(message: string, error?: any): void {
    if (this.options.enableLogging) {
      logger.error(`[${this.singletonKey}] ERROR: ${message}`, undefined, { error: { name: 'Error', message: String(error || '') } });
    }
  }

  // ====================
  // UTILITY METHODS
  // ====================

  /**
   * Generate unique ID
   */
  protected generateId(): string {
    return `${this.singletonKey}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ====================
  // ENCRYPTION METHODS
  // ====================

  /**
   * Encrypt data
   */
  protected async encrypt(data: any): Promise<string> {
    if (!this.options.enableEncryption) {
      return JSON.stringify(data);
    }

    try {
      const crypto = require('crypto');
      const key = crypto.randomBytes(this.encryptionOptions.keyLength!);
      const iv = crypto.randomBytes(this.encryptionOptions.ivLength!);
      
      const cipher = crypto.createCipher(this.encryptionOptions.algorithm!, key, iv);
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine key, iv, and encrypted data
      const combined = key.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
      return Buffer.from(combined).toString('base64');
    } catch (error) {
      this.logError('Encryption error:', error);
      throw error;
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  protected async encryptData(data: string): Promise<{ encrypted: string; iv: string; tag: string }> {
    const crypto = require('crypto');
    const key = crypto.randomBytes(this.encryptionOptions.keyLength!);
    const iv = crypto.randomBytes(this.encryptionOptions.ivLength!);
    
    const cipher = crypto.createCipher(this.encryptionOptions.algorithm!, key, iv);
    cipher.setAAD(Buffer.from('singleton-data'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  protected async decryptData(encryptedData: { encrypted: string; iv: string; tag: string }): Promise<string> {
    const crypto = require('crypto');
    const key = crypto.randomBytes(this.encryptionOptions.keyLength!);
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    
    const decipher = crypto.createDecipher(this.encryptionOptions.algorithm!, key, iv);
    decipher.setAAD(Buffer.from('singleton-data'));
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Decrypt data
   */
  protected async decrypt(encryptedData: string): Promise<any> {
    if (!this.options.enableEncryption) {
      return JSON.parse(encryptedData);
    }

    try {
      const crypto = require('crypto');
      const combined = Buffer.from(encryptedData, 'base64').toString('utf8');
      const [keyHex, ivHex, encrypted] = combined.split(':');
      
      const key = Buffer.from(keyHex, 'hex');
      const iv = Buffer.from(ivHex, 'hex');
      
      const decipher = crypto.createDecipher(this.encryptionOptions.algorithm!, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      this.logError('Decryption error:', error);
      throw error;
    }
  }

  // ====================
  // PRIVATE CACHE METHODS
  // ====================

  /**
   * Get data from private cache (encrypted)
   */
  protected async getFromPrivateCache<T>(key: string): Promise<T | null> {
    if (!this.options.enablePrivateCache) {
      return null;
    }

    // Validate authentication
    if (!this.validateAuthLevel(this.options.authenticationLevel!)) {
      this.logWarning('Unauthorized access to private cache', { key });
      return null;
    }

    try {
      const cached = this.privateCache.get(key);
      if (cached && cached.expires > Date.now()) {
        this.metrics.cacheHits++;
        
        // Decrypt if encrypted
        if (cached.encrypted) {
          return await this.decrypt(cached.data) as T;
        }
        
        return cached.data as T;
      }

      this.metrics.cacheMisses++;
      return null;
    } catch (error) {
      this.logError('Private cache get error:', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Set data in private cache (optionally encrypted)
   */
  protected async setPrivateCache<T>(key: string, data: T, options?: { 
    ttl?: number; 
    encrypt?: boolean;
  }): Promise<void> {
    if (!this.options.enablePrivateCache) {
      return;
    }

    // Validate authentication
    if (!this.validateAuthLevel(this.options.authenticationLevel!)) {
      this.logWarning('Unauthorized access to private cache', { key });
      return;
    }

    try {
      const ttl = options?.ttl || this.options.defaultTTL!;
      const expires = Date.now() + (ttl * 1000);
      const shouldEncrypt = options?.encrypt ?? this.options.enableEncryption;

      let processedData: any = data;
      if (shouldEncrypt) {
        processedData = await this.encrypt(data);
      }

      this.privateCache.set(key, {
        data: processedData,
        expires,
        encrypted: shouldEncrypt!
      });

      this.metrics.cacheSize = this.privateCache.size;
      this.updateMetrics();
    } catch (error) {
      this.logError('Private cache set error:', error);
      this.metrics.errors++;
    }
  }

  /**
   * Clear private cache
   */
  protected async clearPrivateCache(key?: string): Promise<void> {
    try {
      if (key) {
        this.privateCache.delete(key);
      } else {
        this.privateCache.clear();
      }

      this.metrics.cacheSize = this.privateCache.size;
      this.updateMetrics();
    } catch (error) {
      this.logError('Private cache clear error:', error);
      this.metrics.errors++;
    }
  }

  // ====================
  // API REQUEST METHODS
  // ====================

  /**
   * Make authenticated API request
   * Migrated to Auth0 cookie-based authentication
   */
  protected async makeAuthenticatedRequest<T>(
    url: string,
    options: RequestInit = {},
    authLevel: 'public' | 'authenticated' | 'admin' = 'authenticated'
  ): Promise<T> {
    // Validate authentication level
    if (!this.validateAuthLevel(authLevel)) {
      throw new Error(`Insufficient authentication level for ${authLevel} request`);
    }

    // Add Auth0 authentication headers
    const headers = new Headers(options.headers || {});
    
    if (this.currentAuthContext?.auth0Id) {
      headers.set('x-auth0-id', this.currentAuthContext.auth0Id);
    }
    
    if (this.currentAuthContext?.auth0Email) {
      headers.set('x-auth0-email', this.currentAuthContext.auth0Email);
    }
    
    if (this.currentAuthContext?.tenantId) {
      headers.set('X-Tenant-ID', this.currentAuthContext.tenantId);
    }
    
    if (this.currentAuthContext?.userId) {
      headers.set('X-User-ID', this.currentAuthContext.userId);
    }

    const requestOptions: RequestInit = {
      ...options,
      headers
    };

    this.metrics.apiCalls++;
    
    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      this.metrics.errors++;
      this.logError('API request error:', error);
      throw error;
    }
  }

  /**
   * Make public API request (no authentication required)
   */
  protected async makePublicRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    return this.makeAuthenticatedRequest<T>(url, options, 'public');
  }

  /**
   * Make admin API request (admin authentication required)
   */
  protected async makeAdminRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    return this.makeAuthenticatedRequest<T>(url, options, 'admin');
  }

  /**
   * Make encrypted API request (payload is encrypted)
   */
  protected async makeEncryptedRequest<T>(
    url: string,
    payload: any,
    options: RequestInit = {},
    authLevel: 'public' | 'authenticated' | 'admin' = 'authenticated'
  ): Promise<T> {
    // Validate authentication level
    if (!this.validateAuthLevel(authLevel)) {
      throw new Error(`Insufficient authentication level for ${authLevel} request`);
    }

    // Encrypt the payload
    const encryptedPayload = await this.encrypt(payload);
    
    // Add encryption header to indicate encrypted payload
    const headers = new Headers(options.headers || {});
    headers.set('X-Encrypted-Payload', 'true');
    headers.set('Content-Type', 'application/json');

    const requestOptions: RequestInit = {
      ...options,
      headers,
      body: JSON.stringify({ encrypted: encryptedPayload })
    };

    return this.makeAuthenticatedRequest<T>(url, requestOptions, authLevel);
  }

  /**
   * Make private encrypted API request (admin + encryption)
   */
  protected async makePrivateRequest<T>(
    url: string,
    payload: any,
    options: RequestInit = {}
  ): Promise<T> {
    return this.makeEncryptedRequest<T>(url, payload, options, 'admin');
  }

  /**
   * Make request with cache bypass (no caching)
   */
  protected async makeBypassRequest<T>(
    url: string,
    options: RequestInit = {},
    authLevel: 'public' | 'authenticated' | 'admin' = 'authenticated'
  ): Promise<T> {
    // Add cache bypass header
    const headers = new Headers(options.headers || {});
    headers.set('X-Cache-Bypass', 'true');
    headers.set('Cache-Control', 'no-cache');

    const requestOptions: RequestInit = {
      ...options,
      headers
    };

    return this.makeAuthenticatedRequest<T>(url, requestOptions, authLevel);
  }

  /**
   * Make fresh request (bypass cache and clear existing cache)
   */
  protected async makeFreshRequest<T>(
    url: string,
    options: RequestInit = {},
    authLevel: 'public' | 'authenticated' | 'admin' = 'authenticated'
  ): Promise<T> {
    // Clear cache for this URL first
    const cacheKey = this.generateCacheKey(url, options);
    await this.clearCache(cacheKey);

    // Then make bypass request
    return this.makeBypassRequest<T>(url, options, authLevel);
  }

  /**
   * Make request with custom cache behavior
   */
  protected async makeCachedRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheOptions: {
      enable?: boolean;
      ttl?: number;
      key?: string;
    } = {},
    authLevel: 'public' | 'authenticated' | 'admin' = 'authenticated'
  ): Promise<T> {
    // If caching disabled, make bypass request
    if (cacheOptions.enable === false) {
      return this.makeBypassRequest<T>(url, options, authLevel);
    }

    // Custom cache key
    const cacheKey = cacheOptions.key || this.generateCacheKey(url, options);

    // Check cache first
    const cached = await this.getFromCache<T>(cacheKey);
    if (cached) {
      return cached;
    }

    // Make request
    const data = await this.makeAuthenticatedRequest<T>(url, options, authLevel);

    // Cache with custom TTL
    if (cacheOptions.enable === true) {
      await this.setCache(cacheKey, data, { ttl: cacheOptions.ttl });
    }

    return data;
  }

  /**
   * Generate cache key from URL and options
   */
  private generateCacheKey(url: string, options: RequestInit): string {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  // ====================
  // CACHE-BYPASS COUNTERPARTS
  // ====================

  /**
   * Make public API request without caching (no authentication required)
   */
  protected async makePublicRequestNoCache<T>(url: string, options: RequestInit = {}): Promise<T> {
    return this.makeBypassRequest<T>(url, options, 'public');
  }

  /**
   * Make authenticated API request without caching
   */
  protected async makeAuthenticatedRequestNoCache<T>(url: string, options: RequestInit = {}): Promise<T> {
    return this.makeBypassRequest<T>(url, options, 'authenticated');
  }

  /**
   * Make admin API request without caching (admin authentication required)
   */
  protected async makeAdminRequestNoCache<T>(url: string, options: RequestInit = {}): Promise<T> {
    return this.makeBypassRequest<T>(url, options, 'admin');
  }

  /**
   * Make encrypted API request without caching (payload is encrypted, no response caching)
   */
  protected async makeEncryptedRequestNoCache<T>(
    url: string,
    payload: any,
    options: RequestInit = {},
    authLevel: 'public' | 'authenticated' | 'admin' = 'authenticated'
  ): Promise<T> {
    // Encrypt the payload
    const encryptedPayload = await this.encrypt(payload);
    
    // Add encryption header and cache bypass
    const headers = new Headers(options.headers || {});
    headers.set('X-Encrypted-Payload', 'true');
    headers.set('X-Cache-Bypass', 'true');
    headers.set('Cache-Control', 'no-cache');
    headers.set('Content-Type', 'application/json');

    const requestOptions: RequestInit = {
      ...options,
      headers,
      body: JSON.stringify({ encrypted: encryptedPayload })
    };

    return this.makeAuthenticatedRequest<T>(url, requestOptions, authLevel);
  }

  /**
   * Make private encrypted API request without caching (admin + encryption, no response caching)
   */
  protected async makePrivateRequestNoCache<T>(
    url: string,
    payload: any,
    options: RequestInit = {}
  ): Promise<T> {
    return this.makeEncryptedRequestNoCache<T>(url, payload, options, 'admin');
  }

  // ====================
  // CACHING METHODS
  // ====================
  protected async getCache<T>(key: string): Promise<T | null> {
    return this.getFromCache(key) as T;
  }
  protected async getFromCache<T>(key: string): Promise<T | null> {
    if (!this.options.enableCache) {
      return null;
    }

    try {
      // Check memory cache first
      const memoryCached = this.memoryCache.get(key);
      if (memoryCached && memoryCached.expires > Date.now()) {
        this.metrics.cacheHits++;
        return memoryCached.data as T;
      }

      // Check persistent cache
      if (this.cacheManager) {
        const persistentCached = await this.cacheManager.get(key);
        if (persistentCached) {
          // Store in memory cache with TTL
          const ttl = this.options.defaultTTL! * 1000; // Convert to milliseconds
          this.memoryCache.set(key, {
            data: persistentCached,
            expires: Date.now() + ttl
          });
          this.metrics.cacheHits++;
          return persistentCached as T;
        }
      }

      this.metrics.cacheMisses++;
      return null;
    } catch (error) {
      this.logError('Cache get error:', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Set data in cache (both memory and persistent)
   */
  protected async setToCache<T>(key: string, data: T, options?: { ttl?: number }): Promise<void> {
       await this.setCache(key,data,options);
    }
  protected async setCache<T>(key: string, data: T, options?: { ttl?: number }): Promise<void> {
    if (!this.options.enableCache) {
      return;
    }

    try {
      const ttl = options?.ttl || this.options.defaultTTL!;
      const expires = Date.now() + (ttl * 1000); // Convert to milliseconds

      // Store in memory cache
      this.memoryCache.set(key, { data, expires });

      // Store in persistent cache
      if (this.cacheManager) {
        await this.cacheManager.set(key, data, { ttl });
      }

      this.metrics.cacheSize = this.memoryCache.size;
      this.updateMetrics();
    } catch (error) {
      this.logError('Cache set error:', error);
      this.metrics.errors++;
    }
  }

  /**
   * Clear cache (specific key or all)
   */
  protected async clearCache(key?: string): Promise<void> {
    try {
      if (key) {
        // Clear specific key
        this.memoryCache.delete(key);
        if (this.cacheManager) {
          await this.cacheManager.delete(key);
        }
      } else {
        // Clear all cache
        this.memoryCache.clear();
        if (this.cacheManager) {
          await this.cacheManager.clear();
        }
      }

      this.metrics.cacheSize = this.memoryCache.size;
      this.updateMetrics();
    } catch (error) {
      this.logError('Cache clear error:', error);
      this.metrics.errors++;
    }
  }

  /**
   * Clean up expired cache entries
   */
  protected async cleanupExpiredCache(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    // Use Array.from() for better compatibility with older TypeScript targets
    Array.from(this.memoryCache.entries()).forEach(([key, value]) => {
      if (value.expires < now) {
        expiredKeys.push(key);
      }
    });

    for (const key of expiredKeys) {
      this.memoryCache.delete(key);
    }

    if (expiredKeys.length > 0) {
      this.metrics.cacheSize = this.memoryCache.size;
      this.updateMetrics();
    }
  }

  // ====================
  // METRICS METHODS
  // ====================

  /**
   * Get singleton metrics
   */
  getMetrics(): SingletonMetrics & Record<string, any> {
    const customMetrics = this.getCustomMetrics();
    return {
      ...this.metrics,
      ...customMetrics
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics.cacheHits = 0;
    this.metrics.cacheMisses = 0;
    this.metrics.cacheHitRate = 0;
    this.metrics.errors = 0;
    this.metrics.lastUpdated = new Date().toISOString();
    this.updateMetrics();
  }

  /**
   * Update metrics calculations
   */
  private updateMetrics(): void {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    this.metrics.cacheHitRate = total > 0 ? this.metrics.cacheHits / total : 0;
    this.metrics.lastUpdated = new Date().toISOString();
  }

  /**
   * Get custom metrics (to be overridden by child classes)
   */
  protected getCustomMetrics(): Record<string, any> {
    return {};
  }

  /**
   * Sleep for specified milliseconds
   */
  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  // ====================
  // TENANT AUTO ID FUNCTIONALITY
  // ====================

  /**
   * Generate a 4-character alphanumeric auto ID from tenant ID
   * Uses the same algorithm as the SKU generator for consistency
   */
  public generateTenantAutoId(tenantId: string): string {
    if (!tenantId) return 'UNKN';
    
    // Use a simple hash to create consistent 4-char key from tenant ID
    let hash = 0;
    for (let i = 0; i < tenantId.length; i++) {
      hash = ((hash << 5) - hash) + tenantId.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert hash to 4-character alphanumeric key
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars (0, O, 1, I)
    let tempHash = Math.abs(hash);
    let key = '';
    for (let i = 0; i < 4; i++) {
      key += chars[tempHash % chars.length];
      tempHash = Math.floor(tempHash / chars.length);
    }
    
    return key;
  }

  /**
   * Get cached tenant auto ID for performance
   */
  public getCachedTenantAutoId(tenantId: string): string {
    const cacheKey = `tenant_auto_id:${tenantId}`;
    
    // Check memory cache first
    if (this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey);
      if (cached && Date.now() < cached.expires) {
        this.metrics.cacheHits++;
        return cached.data;
      }
      this.memoryCache.delete(cacheKey);
    }
    
    // Generate and cache new auto ID
    const autoId = this.generateTenantAutoId(tenantId);
    const defaultTTL = this.options.defaultTTL || 300; // Default to 5 minutes
    const expires = Date.now() + (defaultTTL * 1000);
    
    this.memoryCache.set(cacheKey, { data: autoId, expires });
    this.metrics.cacheMisses++;
    
    return autoId;
  }

  /**
   * Get all possible identifiers for a tenant (tenantId, slug, autoId)
   */
  public getTenantIdentifiers(tenantId: string, slug?: string): {
    tenantId: string;
    slug?: string;
    autoId: string;
  } {
    return {
      tenantId,
      slug,
      autoId: this.getCachedTenantAutoId(tenantId)
    };
  }

  /**
   * Validate if an identifier is a tenant auto ID
   */
  protected isTenantAutoId(identifier: string): boolean {
    const pattern = /^[A-Z0-9]{4}$/;
    return pattern.test(identifier);
  }

  /**
   * Resolve tenant by any identifier (tenantId, slug, or autoId)
   * This will be useful for shop URL routing
   */
  public async resolveTenantByIdentifier(identifier: string): Promise<{
    tenantId?: string;
    slug?: string;
    autoId?: string;
    found: boolean;
  }> {
    // Try to resolve as tenantId first
    try {
      // This would need to be implemented based on your tenant lookup logic
      // For now, we'll return the identifier as a potential tenantId
      if (identifier.startsWith('tid-')) {
        return {
          tenantId: identifier,
          autoId: this.getCachedTenantAutoId(identifier),
          found: true
        };
      }
    } catch (error) {
      // Tenant lookup failed
    }
    
    // Try to resolve as autoId
    if (this.isTenantAutoId(identifier)) {
      // This would need reverse lookup - for now return as autoId
      return {
        autoId: identifier,
        found: false // Would need reverse lookup
      };
    }
    
    // Try to resolve as slug
    try {
      // This would need slug lookup logic
      return {
        slug: identifier,
        found: false // Would need slug lookup
      };
    } catch (error) {
      // Slug lookup failed
    }
    
    return { found: false };
  }

  // ====================
  // CLEANUP
  // ====================

  /**
   * Cleanup singleton resources
   */
  async cleanup(): Promise<void> {
    // Clear cache
    await this.clearCache();
    
    // Reset metrics
    this.resetMetrics();
    
    // Log cleanup
    this.logInfo('Singleton cleaned up');
  }
}

export { UniversalSingleton };
export default UniversalSingleton;
