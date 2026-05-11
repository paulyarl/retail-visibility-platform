/**
 * Customer Authentication Service
 * 
 * Frontend service for customer account management:
 * - Registration, login, logout
 * - OAuth authentication
 * - Cookie-based session management
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

export interface Customer {
  id: string;
  customerNumber: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  emailVerified: boolean;
}

export interface CustomerAuthResponse {
  success: boolean;
  customer?: Customer;
  isNewCustomer?: boolean;
  error?: string;
}

class CustomerAuthService extends PublicApiSingleton {
  private static instance: CustomerAuthService;
  private customer: Customer | null = null;

  private constructor() {
    super('customer-auth-service', { ttl: 0 }); // No caching for auth
  }

  static getInstance(): CustomerAuthService {
    if (!CustomerAuthService.instance) {
      CustomerAuthService.instance = new CustomerAuthService();
    }
    return CustomerAuthService.instance;
  }

  /**
   * Initialize - check for existing session via cookie
   */
  async initialize(): Promise<Customer | null> {
    if (typeof window === 'undefined') return null;

    // Check for existing session via API (cookies sent automatically)
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        customer: Customer;
      }>(
        '/api/customer-auth/me',
        {
          method: 'GET',
          credentials: 'include', // Send cookies
        },
        'customer-auth-me'
      );

      if (result.success && result.data?.customer) {
        this.customer = result.data.customer;
        return this.customer;
      }
    } catch (error) {
      console.warn('[CustomerAuth] Session validation failed:', error);
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
        return result.data;
      }

      return {
        success: false,
        error: result.data?.error || getErrorMessage(result.error) || 'Registration failed',
      };
    } catch (error: any) {
      console.error('[CustomerAuth] Register error:', error);
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
      const result = await this.makeDefaultRequest<CustomerAuthResponse>(
        '/api/customer-auth/login',
        {
          method: 'POST',
          credentials: 'include', // Send/receive cookies
          body: JSON.stringify({ email, password }),
        },
        'customer-auth-login'
      );

      if (result.success && result.data?.success) {
        this.customer = result.data.customer || null;
        return result.data;
      }

      return {
        success: false,
        error: result.data?.error || getErrorMessage(result.error) || 'Login failed',
      };
    } catch (error: any) {
      console.error('[CustomerAuth] Login error:', error);
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
        return result.data;
      }

      return {
        success: false,
        error: result.data?.error || getErrorMessage(result.error) || 'OAuth login failed',
      };
    } catch (error: any) {
      console.error('[CustomerAuth] OAuth error:', error);
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
          credentials: 'include', // Send/receive cookies
        },
        'customer-auth-logout'
      );
    } catch (error) {
      console.warn('[CustomerAuth] Logout API error:', error);
    }

    // Clear local state
    this.customer = null;
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
        return result.data;
      }

      return {
        success: false,
        error: result.data?.error || getErrorMessage(result.error) || 'Failed to update profile',
      };
    } catch (error: any) {
      console.error('[CustomerAuth] Update profile error:', error);
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
      console.error('[CustomerAuth] Change password error:', error);
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
      console.error('[CustomerAuth] Request reset error:', error);
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
          credentials: 'include', // Send/receive cookies
          body: JSON.stringify({ token, newPassword }),
        },
        'customer-auth-reset-password'
      );

      if (result.success && result.data?.success) {
        this.customer = result.data.customer || null;
        return result.data;
      }

      return {
        success: false,
        error: result.data?.error || getErrorMessage(result.error) || 'Password reset failed',
      };
    } catch (error: any) {
      console.error('[CustomerAuth] Reset password error:', error);
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
      console.error('[CustomerAuth] Verify email error:', error);
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
