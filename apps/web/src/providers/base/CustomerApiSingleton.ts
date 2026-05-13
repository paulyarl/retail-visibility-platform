/**
 * Customer API Singleton
 * 
 * Extends FlexibleApiSingleton with customer-specific defaults
 * Handles customer JWT context validation and enhanced request processing
 * Provides customer-specific caching, header management, and identity tracking
 * 
 * Parallel to TenantApiSingleton — both sit at the same level extending FlexibleApiSingleton
 * Customer auth uses JWT tokens (localStorage) vs Tenant auth which uses Auth0 (cookies)
 */

import { FlexibleApiSingleton, RequestType, RequestTarget, SingletonCacheOptions, CustomerRequestOptions, PublicRequestOptions } from './FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '../../utils/contextCacheManager';

// ====================
// CUSTOMER API SINGLETON
// ====================

export abstract class CustomerApiSingleton extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType = RequestType.CUSTOMER;
  protected defaultRequestTarget: RequestTarget = RequestTarget.API;
  protected defaultContext: AppContext = AppContext.CUSTOMER;
  protected defaultIsolation: CacheIsolation = CacheIsolation.CUSTOMER;
  protected cacheTTL: number = 10 * 60 * 1000; // 10 minutes for customer operations
  protected currentCustomerId?: string;
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      ttl: 10 * 60 * 1000, // 10 minutes for customer operations
      ...cacheOptions
    });
  }

  /**
   * Abstract cache contract for customer services
   * Each customer service MUST implement to declare its cache keys
   */
  public abstract getServiceCachePatterns(): string[];

  /**
   * Abstract cache invalidation method
   * Each customer service MUST implement to provide its invalidation contract
   */
  public abstract invalidateServiceCaches(customerId?: string, ...params: any[]): Promise<void>;

  /**
   * Set current customer context
   * Stores customer identity in localStorage for cross-service access
   */
  setCurrentCustomer(customerId: string, identity?: { email?: string; firstName?: string; lastName?: string }): void {
    this.currentCustomerId = customerId;
    // Keep localStorage in sync for base class onCustomerRequest hook
    if (typeof window !== 'undefined') {
      localStorage.setItem('customer_identity_cache', JSON.stringify({
        id: customerId,
        email: identity?.email,
        firstName: identity?.firstName,
        lastName: identity?.lastName,
      }));
    }
  }

  /**
   * Get current customer context — checks instance var then localStorage
   */
  getCurrentCustomer(): string | undefined {
    if (this.currentCustomerId) return this.currentCustomerId;
    // Fallback: read from localStorage cache
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('customer_identity_cache');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.id) {
            this.currentCustomerId = parsed.id;
            return parsed.id;
          }
        }
      } catch {}
    }
    return undefined;
  }

  /**
   * Clear current customer context
   */
  clearCurrentCustomer(): void {
    this.currentCustomerId = undefined;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('customer_identity_cache');
    }
  }

  /**
   * Check if a customer is currently authenticated (has JWT token)
   */
  isCustomerAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('customer_auth_token');
  }

  /**
   * Get customer JWT token
   */
  getCustomerToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('customer_auth_token');
  }

  /**
   * Get customer identity from cache
   */
  getCustomerIdentity(): { id: string; email?: string; firstName?: string; lastName?: string } | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('customer_identity_cache');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  /**
   * Make customer request with automatic JWT and identity headers
   * All requests flow through makeDefaultRequest which delegates to onCustomerRequest
   */
  protected async makeCustomerRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number
  ): Promise<any> {
    const customerOptions: CustomerRequestOptions = {
      customerId: this.currentCustomerId || this.getCurrentCustomer(),
      cacheKey,
      ttl: customTTL,
      requestTarget: this.defaultRequestTarget,
    };
    const modifiedOptions = await this.onCustomerRequest(url, options, customerOptions);
    return super.makeDefaultRequest(url, modifiedOptions, cacheKey, customTTL, {
      requestType: RequestType.CUSTOMER,
      requestTarget: this.defaultRequestTarget
    });
  }

  /**
   * Override hook for customer request behavior
   * Adds JWT Bearer token and x-customer-id header automatically
   * This is called by the base FlexibleApiSingleton for all CUSTOMER request types
   */
  protected async onCustomerRequest<T>(
    url: string,
    options: RequestInit,
    requestOptions?: CustomerRequestOptions
  ): Promise<RequestInit> {
    // Call parent to add base customer headers (JWT token, x-customer-id)
    let modifiedOptions = await super.onCustomerRequest(url, options, requestOptions);

    // Add customer context headers
    const customerId = requestOptions?.customerId || this.currentCustomerId || this.getCurrentCustomer();
    if (customerId) {
      modifiedOptions = {
        ...modifiedOptions,
        headers: {
          ...modifiedOptions.headers,
          'X-Customer-ID': customerId,
          'X-Request-Context': 'customer',
        },
      };
    }

    return modifiedOptions;
  }

  /**
   * Get custom metrics for customer operations
   */
  protected getCustomMetrics(): Record<string, any> {
    return {
      requestType: 'customer',
      defaultTTL: this.cacheTTL,
      customerRequests: this.apiCalls,
      currentCustomerId: this.currentCustomerId,
      isAuthenticated: this.isCustomerAuthenticated()
    };
  }
}

export default CustomerApiSingleton;
