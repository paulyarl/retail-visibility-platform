/**
 * Public Auth Service
 * 
 * Handles public authentication operations for login, registration, and session management
 * Extends PublicApiSingleton for proper caching and context management
 * 
 * MIGRATION: Replaces direct fetch calls in:
 * - /src/contexts/AuthContext.tsx
 * - /src/app/api/auth/login/route.ts
 * - /src/app/api/auth/register/route.ts
 * - /src/app/api/auth/refresh/route.ts
 * - /src/app/api/auth/logout/route.ts
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  tenantId?: string;
  invitationToken?: string;
}

export interface AuthResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
    isActive: boolean;
    tenantId?: string;
    tenant?: {
      id: string;
      name: string;
      slug: string;
      logo?: string;
    };
    roles: string[];
    permissions: string[];
  };
  token?: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
  };
  message?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  token?: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
  };
  user?: AuthResponse['user'];
  message?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
  nextStep?: 'email_sent' | 'reset_completed';
  token?: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface SessionInfo {
  isAuthenticated: boolean;
  user?: AuthResponse['user'];
  token?: AuthResponse['token'];
  expiresAt?: string;
  lastActivity?: string;
}

export interface UserStats {
  loginCount: number;
  lastLogin?: string;
  registrationDate: string;
  activeSessions: number;
  failedLogins: number;
  lastFailedLogin?: string;
}

export class PublicAuthService extends PublicApiSingleton {
  private static instance: PublicAuthService;

  private constructor() {
    super('PublicAuthService');
  }

  static getInstance(): PublicAuthService {
    if (!PublicAuthService.instance) {
      PublicAuthService.instance = new PublicAuthService();
    }
    return PublicAuthService.instance;
  }

  /**
   * PILOT: Declare cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'public-auth-*',
      'public-user-*',
      'public-session-*',
      'public-token-*'
    ];
  }

  /**
   * PILOT: Implement cache invalidation contract
   */
  public async invalidateServiceCaches(userId?: string, ...params: any[]): Promise<void> {
    if (userId) {
      await this.invalidateCache(`public-user-${userId}`);
      await this.invalidateCache(`public-session-${userId}`);
    } else {
      await this.invalidateCache('public-auth-*');
      await this.invalidateCache('public-user-*');
      await this.invalidateCache('public-session-*');
      await this.invalidateCache('public-token-*');
    }
  }

  /**
   * Login user
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const result = await this.makeDefaultRequest<AuthResponse>(
      '/api/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      },
      'public-auth-login'
    );
    
    if (!result.success) {
      console.log(`Failed to login: ${result.error}`);
      return { success: false, message: typeof result.error === 'string' ? result.error : 'Login failed', user: {
        id: '',
        email: '',
        firstName: '',
        lastName: '',
        emailVerified: false,
        isActive: false,
        roles: [],
        permissions: []
      }};
    }
    
    // Store session info in cache
    if (result.success && result.data && result.data.token) {
      await this.storeSessionInfo(result.data);
    }
    
    return result.data || { success: false, message: 'Login failed', user: {
      id: '',
      email: '',
      firstName: '',
      lastName: '',
      emailVerified: false,
      isActive: false,
      roles: [],
      permissions: []
    }};
  }

  /**
   * Register new user
   */
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const result = await this.makeDefaultRequest<AuthResponse>(
      '/api/auth/register',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      },
      'public-auth-register'
    );
    
    if (!result.success) {
      console.log(`Failed to register: ${result.error}`);
      return { success: false, message: typeof result.error === 'string' ? result.error : 'Registration failed', user: {
        id: '',
        email: '',
        firstName: '',
        lastName: '',
        emailVerified: false,
        isActive: false,
        roles: [],
        permissions: []
      }};
    }
    
    // Store session info in cache
    if (result.success && result.data && result.data.token) {
      await this.storeSessionInfo(result.data);
    }
    
    return result.data || { success: false, message: 'Registration failed', user: {
      id: '',
      email: '',
      firstName: '',
      lastName: '',
      emailVerified: false,
      isActive: false,
      roles: [],
      permissions: []
    }};
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const result = await this.makeDefaultRequest<RefreshTokenResponse>(
      '/api/auth/refresh',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      },
      'public-auth-refresh'
    );
    
    if (!result.success) {
      console.log(`Failed to refresh token: ${result.error}`);
      return { success: false, message: typeof result.error === 'string' ? result.error : 'Token refresh failed' };
    }
    
    // Update session info in cache
    if (result.success && result.data && result.data.token) {
      await this.updateSessionToken(result.data.token);
    }
    
    return result.data || { success: false, message: 'Token refresh failed' };
  }

  /**
   * Logout user
   */
  async logout(): Promise<{ success: boolean; message: string }> {
    const result = await this.makeDefaultRequest<{ success: boolean; message: string }>(
      '/api/auth/logout',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      'public-auth-logout'
    );
    
    // Clear session info from cache
    await this.clearSessionInfo();
    
    return result.data || { success: false, message: 'Logout failed' };
  }

  /**
   * Get current session info
   */
  async getSessionInfo(): Promise<SessionInfo> {
    try {
      const result = await this.makeDefaultRequest<SessionInfo>(
        '/api/auth/sessions',
        {},
        'public-auth-session'
      );
      
      if (!result.success) {
        // Handle authentication errors gracefully
        const errorCode = typeof result.error === 'object' ? result.error?.code : undefined;
        const errorStatus = typeof result.error === 'object' ? result.error?.status : undefined;
        
        if (errorCode === 'authentication_required' || errorStatus === 401) {
          // This is expected for unauthenticated users on public pages
          return { isAuthenticated: false };
        }
        
        // For other errors, also return unauthenticated state
        return { isAuthenticated: false };
      }
      
      return result.data || { isAuthenticated: false };
    } catch (error) {
      // Handle any unexpected errors
      console.warn('[PublicAuthService] getSessionInfo error:', error);
      return { isAuthenticated: false };
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const session = await this.getSessionInfo();
      return session.isAuthenticated && !!session.token && (session.expiresAt ? new Date(session.expiresAt) > new Date() : true);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<AuthResponse['user'] | null> {
    try {
      const session = await this.getSessionInfo();
      return session.user || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<PasswordResetResponse> {
    const result = await this.makeDefaultRequest<PasswordResetResponse>(
      '/api/auth/password-reset',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      },
      'public-auth-password-reset'
    );
    
    return result.data || { success: false, message: 'Password reset request failed' };
  }

  /**
   * Confirm password reset
   */
  async confirmPasswordReset(token: string, password: string, confirmPassword: string): Promise<AuthResponse> {
    const result = await this.makeDefaultRequest<AuthResponse>(
      '/api/auth/password-reset/confirm',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password, confirmPassword }),
      },
      `public-auth-password-reset-confirm-${token}`
    );
    
    if (!result.success) {
      console.log(`Failed to confirm password reset: ${result.error}`);
      return { success: false, message: typeof result.error === 'string' ? result.error : 'Password reset confirmation failed', user: {
        id: '',
        email: '',
        firstName: '',
        lastName: '',
        emailVerified: false,
        isActive: false,
        roles: [],
        permissions: []
      }};
    }
    
    // Store session info if login occurred after reset
    if (result.success && result.data && result.data.token) {
      await this.storeSessionInfo(result.data);
    }
    
    return result.data || { success: false, message: 'Password reset confirmation failed', user: {
      id: '',
      email: '',
      firstName: '',
      lastName: '',
      emailVerified: false,
      isActive: false,
      roles: [],
      permissions: []
    }};
  }

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<AuthResponse> {
    const result = await this.makeDefaultRequest<AuthResponse>(
      '/api/auth/change-password',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      },
      'public-auth-change-password'
    );
    
    if (!result.success) {
      console.log(`Failed to change password: ${result.error}`);
      return { success: false, message: typeof result.error === 'string' ? result.error : 'Password change failed', user: {
        id: '',
        email: '',
        firstName: '',
        lastName: '',
        emailVerified: false,
        isActive: false,
        roles: [],
        permissions: []
      }};
    }
    
    return result.data || { success: false, message: 'Password change failed', user: {
      id: '',
      email: '',
      firstName: '',
      lastName: '',
      emailVerified: false,
      isActive: false,
      roles: [],
      permissions: []
    }};
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: {
    firstName?: string;
    lastName?: string;
    email?: string;
  }): Promise<AuthResponse> {
    const result = await this.makeDefaultRequest<AuthResponse>(
      '/api/auth/profile',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      },
      'public-auth-update-profile'
    );
    
    if (!result.success) {
      console.log(`Failed to update profile: ${result.error}`);
      return { success: false, message: typeof result.error === 'string' ? result.error : 'Profile update failed', user: {
        id: '',
        email: '',
        firstName: '',
        lastName: '',
        emailVerified: false,
        isActive: false,
        roles: [],
        permissions: []
      }};
    }
    
    // Update user info in cache
    if (result.success && result.data && result.data.user) {
      await this.updateUserInfo(result.data.user);
    }
    
    return result.data || { success: false, message: 'Profile update failed', user: {
      id: '',
      email: '',
      firstName: '',
      lastName: '',
      emailVerified: false,
      isActive: false,
      roles: [],
      permissions: []
    }};
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<UserStats> {
    const result = await this.makeDefaultRequest<UserStats>(
      '/api/auth/stats',
      {},
      'public-user-stats'
    );
    
    if (!result.success) {
      console.log(`Failed to get user stats: ${result.error}`);
      return { 
        loginCount: 0, 
        registrationDate: new Date().toISOString(), 
        activeSessions: 0, 
        failedLogins: 0 
      };
    }
    
    return result.data || { 
      loginCount: 0, 
      registrationDate: new Date().toISOString(), 
      activeSessions: 0, 
      failedLogins: 0 
    };
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const result = await this.makeDefaultRequest<{ success: boolean; message: string }>(
      `/api/auth/verify-email/${token}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      `public-auth-verify-email-${token}`
    );
    
    return result.data || { success: false, message: 'Email verification failed' };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
    const result = await this.makeDefaultRequest<{ success: boolean; message: string }>(
      '/api/auth/resend-verification',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      },
      'public-auth-resend-verification'
    );
    
    return result.data || { success: false, message: 'Verification email resend failed' };
  }

  /**
   * Store session info in cache
   */
  private async storeSessionInfo(authResponse: AuthResponse): Promise<void> {
    if (authResponse.token) {
      const sessionInfo: SessionInfo = {
        isAuthenticated: true,
        user: authResponse.user,
        token: authResponse.token,
        expiresAt: new Date(Date.now() + (authResponse.token.expiresIn * 1000)).toISOString(),
        lastActivity: new Date().toISOString()
      };
      
      // Store in cache with appropriate TTL
      await this.makeDefaultRequest<SessionInfo>(
        '/api/auth/sessions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authResponse.token.accessToken}`,
          },
          body: JSON.stringify(sessionInfo),
        },
        'public-auth-session-store',
        authResponse.token.expiresIn * 1000 // Cache until token expires
      );
    }
  }

  /**
   * Update session token in cache
   */
  private async updateSessionToken(token: AuthResponse['token']): Promise<void> {
    const currentSession = await this.getSessionInfo();
    if (currentSession.isAuthenticated && currentSession.user && token) {
      const updatedSession: SessionInfo = {
        ...currentSession,
        token,
        expiresAt: new Date(Date.now() + (token.expiresIn * 1000)).toISOString(),
        lastActivity: new Date().toISOString()
      };
      
      await this.makeDefaultRequest<SessionInfo>(
        '/api/auth/sessions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token.accessToken}`,
          },
          body: JSON.stringify(updatedSession),
        },
        'public-auth-session-update',
        token.expiresIn * 1000 // Cache until token expires
      );
    }
  }

  /**
   * Update user info in cache
   */
  private async updateUserInfo(user: AuthResponse['user']): Promise<void> {
    const currentSession = await this.getSessionInfo();
    if (currentSession.isAuthenticated && currentSession.token) {
      const updatedSession: SessionInfo = {
        ...currentSession,
        user
      };
      
      await this.makeDefaultRequest<SessionInfo>(
        '/api/auth/sessions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentSession.token.accessToken}`,
          },
          body: JSON.stringify(updatedSession),
        },
        'public-auth-session-update-user'
      );
    }
  }

  /**
   * Clear session info from cache
   */
  private async clearSessionInfo(): Promise<void> {
    await this.invalidateServiceCaches();
  }

  /**
   * Validate token format
   */
  private validateToken(token: string): boolean {
    try {
      // Basic JWT token validation (header.payload.signature)
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));
      
      // Check if token is expired
      return payload.exp * 1000 > Date.now();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get token from cache or cookies
   */
  private async getToken(): Promise<string | null> {
    try {
      // Try to get token from cache first
      const session = await this.getSessionInfo();
      if (session.isAuthenticated && session.token) {
        // Validate token before returning
        if (this.validateToken(session.token.accessToken)) {
          return session.token.accessToken;
        } else {
          // Token is expired, clear session
          await this.clearSessionInfo();
          return null;
        }
      }
      
      // Try to get token from cookies as fallback
      if (typeof window !== 'undefined' && window.document) {
        const cookies = document.cookie.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          if (key === 'access_token') return value;
          return acc;
        }, '');
        
        if (cookies) {
          if (this.validateToken(cookies)) {
            return cookies;
          } else {
            // Token is invalid, clear cookies
            document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            return null;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  /**
   * Set token in cookies
   */
  private setTokenInCookies(token: string, expiresIn: number): void {
    const expires = new Date(Date.now() + (expiresIn * 1000));
    const expiresStr = expires.toUTCString();
    
    if (typeof window !== 'undefined' && window.document) {
      document.cookie = `access_token=${token}; expires=${expiresStr}; path=/; SameSite=Lax;`;
    }
  }

  /**
   * Clear token from cookies
   */
  private clearTokenFromCookies(): void {
    if (typeof window !== 'undefined' && window.document) {
      document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax;';
    }
  }
}

// Export singleton instance
export default PublicAuthService.getInstance();
