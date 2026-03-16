"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { tenantInfoService } from '@/services/TenantInfoService';
import { securitySingletonService } from '@/services/SecuritySingletonService';
import { ApiSystemSingleton } from '@/providers/base/ApiSystemSingleton';
import { SingletonCacheOptions } from '@/providers/base/UniversalSingleton';
import cacheManager from '@/utils/cacheManager';

// User type

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_VIEWER' | 'ADMIN' | 'OWNER' | 'USER';
  emailVerified: boolean;
  tenants: {
    id: string;
    name: string;
    role: 'OWNER' | 'ADMIN' | 'SUPPORT' | 'MEMBER' | 'VIEWER';
  }[];
}

// Auth context type
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  getAccessToken: () => string | null;
  switchTenant: (tenantId: string) => void;
  currentTenantId: string | null;
}

// AuthContext Singleton Class
class AuthContextSingleton extends ApiSystemSingleton {
  private static instance: AuthContextSingleton;
  private context: React.Context<AuthContextType | undefined>;

  private constructor() {
    super('auth-context', {
      enableCache: true,
      enableEncryption: true, // Enable encryption for user data
      enablePrivateCache: true,
      authenticationLevel: 'authenticated',
      defaultTTL: 60 * 60 * 1000, // 1 hour
      enableMetrics: true,
      enableLogging: false
    });
    
    // Create React context
    this.context = createContext<AuthContextType | undefined>(undefined);
  }

  static getInstance(): AuthContextSingleton {
    if (!AuthContextSingleton.instance) {
      AuthContextSingleton.instance = new AuthContextSingleton();
    }
    return AuthContextSingleton.instance;
  }

  // Get the React context
  getContext(): React.Context<AuthContextType | undefined> {
    return this.context;
  }

  // Override validation for auth-specific user data
  protected validateCachedUserData(data: any): boolean {
    return data !== null && 
           typeof data === 'object' && 
           data.user && 
           typeof data.user === 'object' && 
           data.user.id &&
           typeof data.user.id === 'string';
  }

  // Helper method to get cached user data with proper typing
  async getCachedAuthUser(): Promise<{ user: any } | null> {
    return await this.getCachedUserData<any>('auth_user_cache');
  }

  // Helper method to set cached user data
  async setCachedAuthUser(userData: any): Promise<void> {
    await this.setCachedUserData('auth_user_cache', { user: userData });
  }

  // Helper method to clear cached auth data
  async clearCachedAuthUser(): Promise<void> {
    await this.clearCachedUserData('auth_user_cache');
  }

  // ====================
  // AUTH-SPECIFIC API METHODS
  // ====================

  // Direct API call for session info (replaces PublicAuthService.getSessionInfo)
  async getSessionInfo(): Promise<{ isAuthenticated: boolean; user?: any; token?: any; expiresAt?: string }> {
    // console.log('[AuthContextSingleton] getSessionInfo called');
    
    try {
      const result = await this.makeSystemRequest<{ 
        isAuthenticated: boolean; 
        user?: any; 
        token?: any; 
        expiresAt?: string 
      }>(
        '/api/auth/sessions',
        {},
        {
          cacheKey: 'auth-context-session',
          ttl: 5 * 60 * 1000 // 5 minutes
        }
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
      console.warn('[AuthContextSingleton] getSessionInfo error:', error);
      return { isAuthenticated: false };
    }
  }

  // Direct API call for token refresh
  async refreshToken(refreshToken: string): Promise<{ success: boolean; token?: any; message?: string }> {
    try {
      const result = await this.makeSystemRequest<{ success: boolean; token?: any; message?: string }>(
        '/api/auth/refresh',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        },
        {
          cacheKey: 'auth-context-refresh',
          ttl: 0 // No caching for refresh
        }
      );
      
      return result.data || { success: false, message: 'Refresh failed' };
    } catch (error) {
      console.warn('[AuthContextSingleton] refreshToken error:', error);
      return { success: false, message: 'Refresh failed' };
    }
  }

  // Direct API call for login
  async login(credentials: { email: string; password: string }): Promise<{ success: boolean; user?: any; token?: any; message?: string }> {
    try {
      const result = await this.makeSystemRequest<{ success: boolean; user?: any; token?: any; message?: string }>(
        '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials)
        },
        {
          cacheKey: 'auth-context-login',
          ttl: 0 // No caching for login
        }
      );
      
      return result.data || { success: false, message: 'Login failed' };
    } catch (error) {
      console.warn('[AuthContextSingleton] login error:', error);
      return { success: false, message: 'Login failed' };
    }
  }

  // Direct API call for register
  async register(userData: { email: string; password: string; firstName?: string; lastName?: string }): Promise<{ success: boolean; user?: any; token?: any; message?: string }> {
    try {
      const result = await this.makeSystemRequest<{ success: boolean; user?: any; token?: any; message?: string }>(
        '/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        },
        {
          cacheKey: 'auth-context-register',
          ttl: 0 // No caching for register
        }
      );
      
      return result.data || { success: false, message: 'Registration failed' };
    } catch (error) {
      console.warn('[AuthContextSingleton] register error:', error);
      return { success: false, message: 'Registration failed' };
    }
  }

  // Direct API call for logout
  async logout(): Promise<{ success: boolean; message?: string }> {
    try {
      const result = await this.makeSystemRequest<{ success: boolean; message?: string }>(
        '/api/auth/logout',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        },
        {
          cacheKey: 'auth-context-logout',
          ttl: 0 // No caching for logout
        }
      );
      
      return result.data || { success: false, message: 'Logout failed' };
    } catch (error) {
      console.warn('[AuthContextSingleton] logout error:', error);
      return { success: false, message: 'Logout failed' };
    }
  }
}

// Create singleton instance
const authContextSingleton = AuthContextSingleton.getInstance();
const USER_CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

// Simple encryption/decryption for client-side caching
function encrypt(text: string): string {
  try {
    // Use btoa for simple base64 encoding (not true encryption, but obscures data)
    return btoa(encodeURIComponent(text));
  } catch {
    return text;
  }
}

function decrypt(text: string): string {
  try {
    return decodeURIComponent(atob(text));
  } catch {
    return text;
  }
}

interface CachedUser {
  user: User;
  tenantId: string | null;
  timestamp: number;
}


// Helper function to get user ID from context (reusable across services)
function getUserIdFromContext(): string | null {
  if (typeof window === 'undefined') return null;

  // Try localStorage first
  const userId = localStorage.getItem('userId');
  if (userId) return userId;

  // Try session storage
  const sessionUserId = sessionStorage.getItem('userId');
  if (sessionUserId) return sessionUserId;

  // Try cookie
  const cookies = document.cookie.split(';');
  const userIdCookie = cookies.find(cookie => cookie.trim().startsWith('userId='));
  if (userIdCookie) {
    return userIdCookie.split('=')[1]?.trim();
  }

  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);

  // Get tokens from localStorage
  const getAccessToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  };

  const getRefreshToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refresh_token');
  };

  const setTokens = (accessToken: string, refreshToken: string) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    // Also set a non-HttpOnly cookie for SSR guard
    try {
      const isSecure = window.location.protocol === 'https:';
      const cookieString = `access_token=${encodeURIComponent(accessToken)}; path=/; SameSite=Lax${isSecure ? '; Secure' : ''}; max-age=${7 * 24 * 60 * 60}`; // 7 days
      document.cookie = cookieString;
    } catch (error) {
      console.error('[AuthContext] Failed to set cookie:', error);
    }
  };

  const clearTokens = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_tenant_id');
    
    // Clear cached user data using the singleton method
    authContextSingleton.clearCachedAuthUser().catch(error => {
      console.warn('[AuthContext] Failed to clear cached auth data:', error);
    });
    
    try {
      // Expire cookie
      document.cookie = `access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    } catch {}
  };

  // Fetch current user - uses local storage instead of API calls (like behaviorTracking)
  const fetchUser = useCallback(async (forceRefresh = false) => {
    // console.log('[AuthContext] fetchUser called', { forceRefresh, pathname: typeof window !== 'undefined' ? window.location.pathname : 'server' });
    
    try {
      // Only check authentication if we're in an admin context, tenant context, or have authentication tokens
      const isAdminContext = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
      const isTenantContext = typeof window !== 'undefined' && (
        window.location.pathname.startsWith('/t/') || 
        window.location.pathname.startsWith('/dashboard') ||
        window.location.pathname.startsWith('/tenants')
      );
      const hasAuthToken = typeof window !== 'undefined' && !!localStorage.getItem('access_token');
      
      // console.log('[AuthContext] Context check', { 
      //   isAdminContext, 
      //   isTenantContext,
      //   hasAuthToken, 
      //   pathname: typeof window !== 'undefined' ? window.location.pathname : 'server',
      //   tokenValue: hasAuthToken ? '***TOKEN_PRESENT***' : 'NO_TOKEN',
      //   localStorageKeys: typeof window !== 'undefined' ? Object.keys(localStorage) : []
      // });
      
      // Skip auth check for public pages without tokens
      if (!isAdminContext && !isTenantContext && !hasAuthToken) {
        // console.log('[AuthContext] Skipping auth check - public page without tokens');
        setUser(null);
        setIsLoading(false);
        return;
      }
      
      // Additional check: Skip auth API calls on public pages even if we have tokens
      // Only make auth API calls if we're in admin context, tenant context, OR explicitly forcing refresh
      if (!isAdminContext && !isTenantContext && !forceRefresh) {
        // console.log('[AuthContext] Skipping auth API call - public page (even with tokens)');
        
        // Clear any potentially stale tokens on public pages to prevent future issues
        if (hasAuthToken) {
          // console.log('[AuthContext] Clearing stale tokens from public page');
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
        
        setUser(null);
        setIsLoading(false);
        return;
      }
      
      // FOLLOW BEHAVIOR_TRACKING PATTERN: Use singleton methods for user caching
      let user: User | null = null;
      
      // Try to get cached user data using the singleton method
      // console.log('[AuthContext] Attempting to get cached user data');
      const cachedUserData = await authContextSingleton.getCachedAuthUser();
      // console.log('[AuthContext] Cached user data result', { 
      //   hasCachedData: !!cachedUserData,
      //   hasUser: !!cachedUserData?.user,
      //   userId: cachedUserData?.user?.id || 'NO_USER_ID'
      // });
      if (cachedUserData && cachedUserData.user) {
        const userData = cachedUserData.user;
        user = {
          id: userData.id,
          email: userData.email || '',
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          emailVerified: userData.emailVerified || false,
          role: 'USER' as const,
          tenants: userData.tenant ? [{
            id: userData.tenant.id,
            name: userData.tenant.name || '',
            role: 'OWNER' as const
          }] : []
        };
      }
      
      // If we have cached user and not forcing refresh, use it
      if (user && !forceRefresh) {
        setUser(user);
        setIsLoading(false);
        return;
      }
      
      // ONLY MAKE API CALL IF: 
      // 1. We're in admin context, OR
      // 2. We're in tenant context, OR  
      // 3. We're forcing refresh (explicit user action)
      // NOTE: We no longer check for tokens on public pages due to the stricter logic above
      if (isAdminContext || isTenantContext || forceRefresh) {
        // console.log('[AuthContext] Making API call', { 
        //   reason: isAdminContext ? 'admin context' : isTenantContext ? 'tenant context' : 'force refresh',
        //   isAdminContext, 
        //   isTenantContext,
        //   forceRefresh, 
        //   hasAuthToken, 
        //   hasCachedUser: !!user 
        // });
        
        const sessionInfo = isAdminContext || isTenantContext || forceRefresh
          ? await securitySingletonService.getSessionInfo()
          : await authContextSingleton.getSessionInfo(); // Use singleton method for both admin and tenant contexts
        
        if (sessionInfo.isAuthenticated && sessionInfo.user) {
          // Transform service user to context format
          const transformedUser: User = {
            id: sessionInfo.user.id,
            email: sessionInfo.user.email,
            firstName: sessionInfo.user.firstName,
            lastName: sessionInfo.user.lastName,
            emailVerified: sessionInfo.user.emailVerified,
            role: 'USER' as const, // Default role, can be enhanced based on roles array
            // Map service tenants to context format
            tenants: sessionInfo.user.tenant ? [{
              id: sessionInfo.user.tenant.id,
              name: sessionInfo.user.tenant.name,
              role: 'OWNER' as const // Default role for now
            }] : []
          };
          
          setUser(transformedUser);
          
          // Cache the user data using the singleton method (like behaviorTracking does)
          await authContextSingleton.setCachedAuthUser(sessionInfo.user);
        } else {
          setUser(null);
        }
      } else {
        console.log('[AuthContext] Skipping API call', { 
          reason: 'no reason to call API',
          isAdminContext, 
          forceRefresh, 
          hasAuthToken, 
          hasCachedUser: !!user 
        });
        setUser(user);
      }
    } catch (error) {
      console.warn('[AuthContext] fetchUser error:', error);
      console.error('[AuthContext] Failed to fetch user:', error);
      console.log('[AuthContext] Authentication failed (user not authenticated):', error instanceof Error ? error.message : 'Unknown error');
      // Clear invalid tokens and treat as unauthenticated view
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh access token
  const refreshToken = useCallback(async () => {
    const refresh = getRefreshToken();
    if (!refresh) {
      clearTokens();
      setUser(null);
      return;
    }

    try {
      // Use singleton method instead of PublicAuthService
      const refreshResponse = await authContextSingleton.refreshToken(refresh);

      if (refreshResponse.success && refreshResponse.token) {
        localStorage.setItem('access_token', refreshResponse.token.accessToken);
        try { 
          const isSecure = window.location.protocol === 'https:';
          const cookieString = `access_token=${encodeURIComponent(refreshResponse.token.accessToken)}; path=/; SameSite=Lax${isSecure ? '; Secure' : ''}; max-age=${7 * 24 * 60 * 60}`;
          document.cookie = cookieString;
          // console.log('[AuthContext] Refreshed cookie:', cookieString);
        } catch (error) {
          console.error('[AuthContext] Failed to set refresh cookie:', error);
        }
        
        // After token refresh, fetch fresh user data and update cache
        // console.log('[AuthContext] Token refreshed, updating cached user data');
        await fetchUser(true); // Force refresh to get updated user data
      } else {
        // Only clear tokens if refresh endpoint explicitly says unauthorized
        if (!refreshResponse.success) {
          clearTokens();
        }
        setUser(null);
      }
    } catch (error) {
      console.error('[AuthContext] Failed to refresh token:', error);
      clearTokens();
      setUser(null);
    }
  }, [fetchUser]);

  // Login
  const login = async (email: string, password: string) => {
    try {
      // Use singleton method instead of PublicAuthService
      const authResponse = await authContextSingleton.login({ email, password });

      if (!authResponse.success) {
        throw new Error(authResponse.message || 'Login failed');
      }

      // console.log('[AuthContext] Login response:', { 
      //   hasAccessToken: !!authResponse.token?.accessToken, 
      //   hasRefreshToken: !!authResponse.token?.refreshToken,
      //   hasUser: !!authResponse.user 
      // });
      
      if (authResponse.token) {
        setTokens(authResponse.token.accessToken, authResponse.token.refreshToken);
      }

      // Transform API response from service format to context format
      const transformedUser = authResponse.user ? {
        id: authResponse.user.id,
        email: authResponse.user.email,
        firstName: authResponse.user.firstName,
        lastName: authResponse.user.lastName,
        emailVerified: authResponse.user.emailVerified,
        role: 'USER' as const, // Default role, can be enhanced based on roles array
        // Map service tenants to context format
        tenants: authResponse.user.tenant ? [{
          id: authResponse.user.tenant.id,
          name: authResponse.user.tenant.name,
          role: 'OWNER' as const // Default role for now
        }] : []
      } : null;

      setUser(transformedUser);
      
      // Set current tenant if available
      if (transformedUser && transformedUser.tenants && transformedUser.tenants.length > 0) {
        setCurrentTenantId(transformedUser.tenants[0].id);
        localStorage.setItem('current_tenant_id', transformedUser.tenants[0].id);
      }
      
      // console.log('[AuthContext] Tokens and user data cached locally');
    } catch (error) {
      // Don't log to console - error will be caught and displayed in UI
      throw error;
    }
  };

  // Register
  const register = async (email: string, password: string, firstName?: string, lastName?: string) => {
    try {
      // Use singleton method instead of PublicAuthService
      const authResponse = await authContextSingleton.register({
        email,
        password,
        firstName: firstName || '',
        lastName: lastName || ''
      });

      if (!authResponse.success) {
        throw new Error(authResponse.message || 'Registration failed');
      }

      // After registration, automatically log in
      await login(email, password);
    } catch (error) {
      // Don't log to console - error will be caught and displayed in UI
      throw error;
    }
  };

  // Logout
  const logout = async () => {
    try {
      // Use singleton method instead of PublicAuthService
      const logoutResponse = await authContextSingleton.logout();
      
      if (!logoutResponse.success) {
        console.error('[AuthContext] Logout failed:', logoutResponse.message);
      }
    } catch (error) {
      console.error('[AuthContext] Logout request failed:', error);
    } finally {
      // Always clear local tokens and user data
      clearTokens();
      setUser(null);
      setCurrentTenantId(null);
    }
  };

  // Switch tenant
  const switchTenant = (tenantId: string) => {
    if (user?.tenants.find(t => t.id === tenantId)) {
      setCurrentTenantId(tenantId);
      localStorage.setItem('current_tenant_id', tenantId);
    }
  };

  // Load user on mount
  useEffect(() => {
    // console.log('[AuthContext] useEffect triggered - calling fetchUser');
    fetchUser();
  }, []); // Empty dependency array - only run once on mount

  // Setup token refresh interval - less aggressive with caching
  // Tokens expire in 365 days, so refresh every 6 hours instead of 24
  // This provides better UX while still being secure
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      // console.log('[AuthContext] Periodic token refresh (every 6 hours)');
      refreshToken();
    }, 6 * 60 * 60 * 1000); // Refresh every 6 hours

    return () => clearInterval(interval);
  }, [user, refreshToken]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshToken,
    getAccessToken,
    currentTenantId,
    switchTenant,
  };

  const AuthContext = authContextSingleton.getContext();

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Export the context for external use if needed
export { authContextSingleton as AuthContextSingleton };

// Hook to use auth context

export function useAuth() {
  const context = useContext(authContextSingleton.getContext());
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
