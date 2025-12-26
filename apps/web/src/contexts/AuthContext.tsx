"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, API_BASE_URL as API_URL } from '@/lib/api';

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
  currentTenantId: string | null;
  switchTenant: (tenantId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

// Token management
const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TENANT_KEY = 'current_tenant_id';
const USER_CACHE_KEY = 'auth_user_cache';
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


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);

  // Get tokens from localStorage
  const getAccessToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  };

  const getRefreshToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  };

  const setTokens = (accessToken: string, refreshToken: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    // Also set a non-HttpOnly cookie for SSR guard
    try {
      document.cookie = `access_token=${encodeURIComponent(accessToken)}; path=/; SameSite=Lax`;
    } catch {}
  };

  const clearTokens = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TENANT_KEY);
    localStorage.removeItem(USER_CACHE_KEY); // Clear cached user data
    try {
      // Expire cookie
      document.cookie = `access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    } catch {}
  };

  // Cache management functions
  const getCachedUser = (): CachedUser | null => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(USER_CACHE_KEY);
      if (!cached) return null;
      
      const decrypted = decrypt(cached);
      const parsed: CachedUser = JSON.parse(decrypted);
      
      // Check if cache is expired
      if (Date.now() - parsed.timestamp > USER_CACHE_TTL) {
        localStorage.removeItem(USER_CACHE_KEY);
        return null;
      }
      
      return parsed;
    } catch {
      // Clear corrupted cache
      localStorage.removeItem(USER_CACHE_KEY);
      return null;
    }
  };

  const setCachedUser = (user: User | null, tenantId: string | null) => {
    if (typeof window === 'undefined' || !user) return;
    
    const cached: CachedUser = {
      user,
      tenantId,
      timestamp: Date.now()
    };
    
    try {
      const encrypted = encrypt(JSON.stringify(cached));
      localStorage.setItem(USER_CACHE_KEY, encrypted);
    } catch (error) {
      console.warn('[AuthContext] Failed to cache user:', error);
    }
  };

  // Fetch current user - now uses encrypted caching to minimize API calls
  const fetchUser = useCallback(async (forceRefresh = false) => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    // Try to use cached user data first (unless force refresh is requested)
    if (!forceRefresh) {
      const cached = getCachedUser();
      if (cached) {
        console.log('[AuthContext] Using cached user data (avoiding API call)');
        setUser(cached.user);
        setCurrentTenantId(cached.tenantId);
        setIsLoading(false);
        return;
      }
    }

    try {
      // Only make API call if no valid cache or force refresh requested
      console.log('[AuthContext] Fetching fresh user data from API');
      const response = await api.get(`${API_BASE_URL}/auth/me`);

      if (response.ok) {
        const data = await response.json();

        // Transform API response from snake_case to camelCase
        const transformedUser = {
          ...data.user,
          firstName: data.user.first_name,
          lastName: data.user.last_name,
          emailVerified: data.user.email_verified,
          // Remove snake_case fields
          first_name: undefined,
          last_name: undefined,
          email_verified: undefined,
        };

        setUser(transformedUser);
        
        // Cache the authenticated user data
        setCachedUser(transformedUser, currentTenantId);
        
        // Set current tenant if not set
        if (!currentTenantId && transformedUser && transformedUser.tenants && transformedUser.tenants.length > 0) {
          const savedTenantId = localStorage.getItem(TENANT_KEY);
          const tenantExists = transformedUser.tenants.find((t: any) => t.id === savedTenantId);
          const newTenantId = tenantExists ? savedTenantId : transformedUser.tenants[0].id;
          setCurrentTenantId(newTenantId);
          // Update cache with tenant info
          setCachedUser(transformedUser, newTenantId);
        }
      } else if (response.status === 401) {
        // Token expired, try to refresh
        await refreshToken();
      } else {
        // Do not clear tokens on transient/non-401 errors
        setUser(null);
      }
    } catch (error) {
      console.error('[AuthContext] Failed to fetch user:', error);
      // Keep tokens; treat as unauthenticated view until next successful call
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenantId]);

  // Refresh access token
  const refreshToken = useCallback(async () => {
    const refresh = getRefreshToken();
    if (!refresh) {
      clearTokens();
      setUser(null);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        try { document.cookie = `access_token=${encodeURIComponent(data.accessToken)}; path=/; SameSite=Lax`; } catch {}
        
        // After token refresh, fetch fresh user data and update cache
        console.log('[AuthContext] Token refreshed, updating cached user data');
        await fetchUser(true); // Force refresh to get updated user data
      } else {
        // Only clear tokens if refresh endpoint explicitly says unauthorized
        if (response.status === 401) {
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
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();
      console.log('[AuthContext] Login response:', { 
        hasAccessToken: !!data.accessToken, 
        hasRefreshToken: !!data.refreshToken,
        hasUser: !!data.user 
      });
      
      setTokens(data.accessToken, data.refreshToken);

      // Transform API response from snake_case to camelCase
      const transformedUser = data.user ? {
        ...data.user,
        firstName: data.user.first_name,
        lastName: data.user.last_name,
        emailVerified: data.user.email_verified,
        // Remove snake_case fields
        first_name: undefined,
        last_name: undefined,
        email_verified: undefined,
      } : null;

      setUser(transformedUser);
      
      // Cache the authenticated user data immediately after login
      if (transformedUser) {
        const tenantId = transformedUser.tenants && transformedUser.tenants.length > 0 ? transformedUser.tenants[0].id : null;
        setCachedUser(transformedUser, tenantId);
        setCurrentTenantId(tenantId);
        if (tenantId) {
          localStorage.setItem(TENANT_KEY, tenantId);
        }
      }
      
      console.log('[AuthContext] Tokens and user data cached locally');
    } catch (error) {
      // Don't log to console - error will be caught and displayed in UI
      throw error;
    }
  };

  // Register
  const register = async (email: string, password: string, firstName?: string, lastName?: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
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
    const token = getAccessToken();
    
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
        });
      } catch (error) {
        console.error('[AuthContext] Logout request failed:', error);
      }
    }

    clearTokens();
    setUser(null);
    setCurrentTenantId(null);
  };

  // Switch tenant
  const switchTenant = (tenantId: string) => {
    if (user?.tenants.find(t => t.id === tenantId)) {
      setCurrentTenantId(tenantId);
      localStorage.setItem(TENANT_KEY, tenantId);
    }
  };

  // Load user on mount
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Setup token refresh interval - less aggressive with caching
  // Tokens expire in 365 days, so refresh every 6 hours instead of 24
  // This provides better UX while still being secure
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      console.log('[AuthContext] Periodic token refresh (every 6 hours)');
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
