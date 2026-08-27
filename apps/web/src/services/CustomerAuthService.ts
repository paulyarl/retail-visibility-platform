/**
 * Customer Authentication Service
 * 
 * Frontend service for customer account management:
 * - Registration, login, logout
 * - OAuth authentication
 * - Cookie-based session management
 */

import { CustomerApiSingleton } from '@/providers/base/CustomerApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface Customer {
  id: string;
  customerNumber: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  emailVerified: boolean;
}

export interface CustomerContexts {
  storefront: boolean;
  platform: boolean;
}

export interface CustomerPendingClaim {
  id: string;
  seed_id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  business_name: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
}

export interface CustomerAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface CustomerAuthResponse {
  success: boolean;
  customer?: Customer;
  contexts?: CustomerContexts;
  tenantId?: string;
  isNewCustomer?: boolean;
  tokens?: CustomerAuthTokens;
  error?: string;
}

class CustomerAuthService extends CustomerApiSingleton {
  private static instance: CustomerAuthService;
  private customer: Customer | null = null;
  private tenantId: string | null = null;
  private pendingClaims: CustomerPendingClaim[] = [];

  private constructor() {
    super('customer-auth-service', { ttl: 0 }); // No caching for auth
  }

  getServiceCachePatterns(): string[] {
    return ['customer-auth-me', 'customer-auth-register', 'customer-auth-login'];
  }

  async invalidateServiceCaches(customerId?: string): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  static getInstance(): CustomerAuthService {
    if (!CustomerAuthService.instance) {
      CustomerAuthService.instance = new CustomerAuthService();
    }
    return CustomerAuthService.instance;
  }

  /**
   * Apply external auth result — persists JWT tokens + customer from an
   * auth flow that didn't go through register/login/oauthLogin (e.g. the
   * Marketing Ops claim endpoints, which return tokens + customer directly).
   *
   * Mirrors the post-success block in register/login/oauthLogin: stores the
   * access token in localStorage, sets the in-memory customer, and registers
   * the customer context for downstream authenticated requests.
   */
  applyExternalAuth(customer: Customer, tokens?: { accessToken: string; refreshToken: string }): void {
    this.customer = customer;
    if (tokens?.accessToken) {
      this.setToken(tokens.accessToken);
    }
    this.setCurrentCustomer(customer.id, customer);
  }

  /**
   * Get stored token from localStorage
   */
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('customer_auth_token');
  }

  /**
   * Store token in localStorage
   */
  private setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('customer_auth_token', token);
  }

  /**
   * Remove token from localStorage
   */
  private clearToken(): void {
    if (typeof window === 'undefined') return;
    console.log('[CustomerAuthService] Clearing token');
    localStorage.removeItem('customer_auth_token');
  }

  /**
   * Build headers with Authorization token
   */
  getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Initialize - check for existing session via token or cookie
   */
  async initialize(): Promise<Customer | null> {
    if (typeof window === 'undefined') {
      // console.log('[CustomerAuthService] Window is undefined, skipping initialization');
      return null;
    }

    // Skip API call if no token exists - avoids unnecessary 401s on public pages
    const token = this.getToken();
    if (!token) {
      // console.log('[CustomerAuthService] No token found, skipping API call');
      this.customer = null;
      return null;
    }

    // Check for existing session via API
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        customer: Customer;
      }>(
        '/api/customer-auth/me',
        {
          method: 'GET',
          credentials: 'include', // Send cookies for backward compatibility
        },
        'customer-auth-me'
      );

      if (!result.success) {
        console.log('[CustomerAuthService] Initialize failed:', result.error);
        const status = (result.error as any)?.status;
        if (status === 401) {
          this.clearToken();
        }
        return null;
      }

      if (result.data?.customer) {
        this.customer = result.data.customer;
        this.setCurrentCustomer(this.customer.id, this.customer);
        this.tenantId = (result.data as any).tenantId || null;
        // console.log('[CustomerAuthService] Customer initialized:', this.customer);
        return this.customer;
      }
    } catch (error: any) {
      console.log(`[CustomerAuthService] Initialize error: ${error}`);
    }

    return null;
  }

  /**
   * Register new customer
   */
  async register(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    phone?: string
  ): Promise<CustomerAuthResponse> {
    try {
      const result = await this.makeDefaultRequest<CustomerAuthResponse>(
        '/api/customer-auth/register',
        {
          method: 'POST',
          credentials: 'include', // Send/receive cookies
          body: JSON.stringify({ email, password, firstName, lastName, phone }),
        },
        'customer-auth-register'
      );

      if (result.success && result.data?.success) {
        this.customer = result.data.customer || null;
        // Store JWT token in localStorage
        if (result.data.tokens?.accessToken) {
          this.setToken(result.data.tokens.accessToken);
        }
        if (this.customer) this.setCurrentCustomer(this.customer.id, this.customer);
        return result.data;
      }

      return {
        success: false,
        error: result.data?.error || getErrorMessage(result.error) || 'Registration failed',
      };
    } catch (error: any) {
      clientLogger.error('[CustomerAuth] Register error:', { detail: error });
      return {
        success: false,
        error: 'Failed to register. Please try again.',
      };
    }
  }

  /**
   * Login with email/password
   */
  async login(email: string, password: string): Promise<CustomerAuthResponse> {
    try {
      const result = await this.makeDefaultRequest<CustomerAuthResponse & { tokens?: { accessToken: string; refreshToken: string } }>(
        '/api/customer-auth/login',
        {
          method: 'POST',
          credentials: 'include', // Send/receive cookies for backward compatibility
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        },
        'customer-auth-login'
      );

      if (result.success && result.data?.success) {
        this.customer = result.data.customer || null;
        // Store JWT token in localStorage
        if (result.data.tokens?.accessToken) {
          this.setToken(result.data.tokens.accessToken);
        }
        if (this.customer) this.setCurrentCustomer(this.customer.id, this.customer);
        return result.data;
      }

      return {
        success: false,
        error: result.data?.error || getErrorMessage(result.error) || 'Login failed',
      };
    } catch (error: any) {
      clientLogger.error('[CustomerAuth] Login error:', { detail: error });
      return {
        success: false,
        error: 'Failed to log in. Please try again.',
      };
    }
  }

  /**
   * OAuth login
   */
  async oauthLogin(
    provider: 'google' | 'facebook' | 'apple',
    oauthId: string,
    email: string,
    firstName?: string,
    lastName?: string
  ): Promise<CustomerAuthResponse> {
    try {
      const result = await this.makeDefaultRequest<CustomerAuthResponse>(
        `/api/customer-auth/oauth/${provider}`,
        {
          method: 'POST',
          credentials: 'include', // Send/receive cookies
          body: JSON.stringify({ oauthId, email, firstName, lastName }),
        },
        `customer-auth-oauth-${provider}`
      );

      if (result.success && result.data?.success) {
        this.customer = result.data.customer || null;
        // Store JWT token in localStorage
        if (result.data.tokens?.accessToken) {
          this.setToken(result.data.tokens.accessToken);
        }
        if (this.customer) this.setCurrentCustomer(this.customer.id, this.customer);
        return result.data;
      }

      return {
        success: false,
        error: result.data?.error || getErrorMessage(result.error) || 'OAuth login failed',
      };
    } catch (error: any) {
      clientLogger.error('[CustomerAuth] OAuth error:', { detail: error });
      return {
        success: false,
        error: 'Failed to authenticate with social account.',
      };
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await this.makeDefaultRequest(
        '/api/customer-auth/logout',
        {
          method: 'POST',
          credentials: 'include',
        },
        'customer-auth-logout'
      );
    } catch (error) {
      clientLogger.warn('[CustomerAuth] Logout API error:', { detail: error });
    }

    // Clear local state, token, and customer context
    this.customer = null;
    this.clearToken();
    this.clearCurrentCustomer();
  }

  /**
   * Update profile (name, phone)
   */
  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<CustomerAuthResponse> {
    try {
      const result = await this.makeDefaultRequest<CustomerAuthResponse>(
        '/api/customer-auth/profile',
        {
          method: 'PUT',
          credentials: 'include',
          body: JSON.stringify(data),
        },
        'customer-auth-update-profile'
      );

      if (result.success && result.data?.success) {
        this.customer = result.data.customer || null;
        if (this.customer) this.setCurrentCustomer(this.customer.id, this.customer);
        return result.data;
      }

      return {
        success: false,
        error: result.data?.error || getErrorMessage(result.error) || 'Failed to update profile',
      };
    } catch (error: any) {
      clientLogger.error('[CustomerAuth] Update profile error:', { detail: error });
      return {
        success: false,
        error: 'Failed to update profile. Please try again.',
      };
    }
  }

  /**
   * Change password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean; error?: string }>(
        '/api/customer-auth/password',
        {
          method: 'PUT',
          credentials: 'include',
          body: JSON.stringify({ currentPassword, newPassword }),
        },
        'customer-auth-change-password'
      );

      return result.data || { success: false, error: 'Failed to change password' };
    } catch (error: any) {
      clientLogger.error('[CustomerAuth] Change password error:', { detail: error });
      return {
        success: false,
        error: 'Failed to change password. Please try again.',
      };
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean }>(
        '/api/customer-auth/request-reset',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        },
        'customer-auth-request-reset'
      );

      return { success: result.success };
    } catch (error: any) {
      clientLogger.error('[CustomerAuth] Request reset error:', { detail: error });
      return { success: false, error: 'Failed to request reset.' };
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<CustomerAuthResponse> {
    try {
      const result = await this.makeDefaultRequest<CustomerAuthResponse>(
        '/api/customer-auth/reset-password',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword }),
        },
        'customer-auth-reset-password'
      );

      if (result.success && result.data?.success) {
        this.customer = result.data.customer || null;
        if (this.customer) this.setCurrentCustomer(this.customer.id, this.customer);
        return result.data;
      }

      return {
        success: false,
        error: result.data?.error || getErrorMessage(result.error) || 'Password reset failed',
      };
    } catch (error: any) {
      clientLogger.error('[CustomerAuth] Reset password error:', { detail: error });
      return {
        success: false,
        error: 'Failed to reset password.',
      };
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean; error?: string }>(
        '/api/customer-auth/verify-email',
        {
          method: 'POST',
          body: JSON.stringify({ token }),
        },
        'customer-auth-verify-email'
      );

      return result.data || { success: false, error: 'Verification failed' };
    } catch (error: any) {
      clientLogger.error('[CustomerAuth] Verify email error:', { detail: error });
      return { success: false, error: 'Failed to verify email.' };
    }
  }

  /**
   * Get current customer
   */
  getCustomer(): Customer | null {
    return this.customer;
  }

  /**
   * Fetch context signals from /api/customer-auth/me (§4.2).
   * Called after initialize and after claim/purchase events to refresh
   * the storefront/platform context flags for sidebar gating.
   */
  async getContexts(): Promise<CustomerContexts | null> {
    if (!this.getToken()) return null;
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        contexts?: CustomerContexts;
        tenantId?: string;
        pendingClaims?: CustomerPendingClaim[];
      }>(
        '/api/customer-auth/me',
        { method: 'GET', credentials: 'include' },
        'customer-auth-me',
      );
      if (result.success && result.data?.contexts) {
        this.tenantId = result.data.tenantId || null;
        this.pendingClaims = result.data.pendingClaims || [];
        return result.data.contexts;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get the customer's pending/recent directory claim requests.
   * Populated by getContexts() — call getContexts() first.
   */
  getPendingClaims(): CustomerPendingClaim[] {
    return this.pendingClaims;
  }

  /**
   * Get the owned tenant ID for the current customer (resolved from
   * user_tenants via linked_user_id on the backend). Used by the sidebar
   * to link to the tenant dashboard and directory listing.
   */
  getTenantId(): string | null {
    return this.tenantId;
  }

  /**
   * Set the initial platform password for a customer who was promoted to a
   * platform user (e.g. via directory seed claim) but had no password
   * (OAuth-only customer). Returns platform JWT tokens on success so the
   * frontend can store them and transition to platform auth.
   *
   * Only works if the platform user doesn't already have a password —
   * use changePassword for that case.
   */
  async setupPlatformPassword(
    newPassword: string,
  ): Promise<{ success: boolean; userTokens?: { accessToken: string; refreshToken: string }; error?: string }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        userTokens?: { accessToken: string; refreshToken: string };
        error?: string;
      }>(
        '/api/customer-auth/setup-platform-password',
        {
          method: 'POST',
          body: JSON.stringify({ newPassword }),
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        },
        'customer-auth-setup-platform-password',
      );
      return {
        success: result.success,
        userTokens: result.data?.userTokens,
        error: result.success ? undefined : (result.data?.error || result.error as string),
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to set platform password' };
    }
  }

  /**
   * Check if logged in
   */
  isAuthenticated(): boolean {
    return !!this.customer;
  }

  /**
   * Refresh session (re-validate with server via cookie)
   * Returns true if session is still valid
   */
  async refreshToken(): Promise<boolean> {
    const customer = await this.initialize();
    return !!customer;
  }
}

export const customerAuthService = CustomerAuthService.getInstance();
export default customerAuthService;
