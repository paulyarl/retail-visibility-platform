"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// User type
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'ADMIN' | 'OWNER' | 'USER';
  emailVerified: boolean;
  tenants: {
    id: string;
    name: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
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
  currentTenantId: string | null;
  switchTenant: (tenantId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

// Token management
const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TENANT_KEY = 'current_tenant_id';

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
    try {
      // Expire cookie
      document.cookie = `access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    } catch {}
  };

  // Fetch current user
  const fetchUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        
        // Set current tenant if not set
        if (!currentTenantId && data.user.tenants.length > 0) {
          const savedTenantId = localStorage.getItem(TENANT_KEY);
          const tenantExists = data.user.tenants.find((t: any) => t.id === savedTenantId);
          setCurrentTenantId(tenantExists ? savedTenantId : data.user.tenants[0].id);
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
        await fetchUser();
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
      setUser(data.user);
      
      console.log('[AuthContext] Tokens saved to localStorage');
      
      // Set current tenant
      if (data.user.tenants.length > 0) {
        setCurrentTenantId(data.user.tenants[0].id);
        localStorage.setItem(TENANT_KEY, data.user.tenants[0].id);
      }
    } catch (error) {
      console.error('[AuthContext] Login failed:', error);
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
      console.error('[AuthContext] Registration failed:', error);
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

  // Setup token refresh interval (refresh 1 minute before expiry)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      refreshToken();
    }, 14 * 60 * 1000); // Refresh every 14 minutes (tokens expire in 15 minutes)

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
