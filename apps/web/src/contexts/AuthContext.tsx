"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { securitySingletonService } from '@/services/SecuritySingletonService';
import { ApiSystemSingleton } from '@/providers/base/ApiSystemSingleton';
import { SingletonCacheOptions } from '@/providers/base/UniversalSingleton';
import { clientLogger } from '@/lib/client-logger';
import { clearCorrelationId } from '@/lib/correlation-id';
import type { ServerResolvedAuth } from '@/components/tenant/ServerResolvedContextProvider';

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
  businessName?: string;
  businessType?: string;
  phone?: string;
  role: 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_VIEWER' | 'ADMIN' | 'OWNER' | 'USER';
  emailVerified: boolean;
  tenants: {
    id: string;
    name: string;
    role: 'OWNER' | 'ADMIN' | 'SUPPORT' | 'MEMBER' | 'VIEWER';
    organizationId?: string;
  }[];
  // Auth0 profile fields
  picture?: string;
  auth0Id?: string;
  onboardingCompleted?: boolean;
}

// Auth context type
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  register: () => void;
  logout: () => void;
  switchTenant: (tenantId: string) => void;
  currentTenantId: string | null;
}

// AuthContext Singleton Class - simplified for Auth0 session management
class AuthContextSingleton extends ApiSystemSingleton {
  private static instance: AuthContextSingleton;
  private context: React.Context<AuthContextType | undefined>;

  private constructor() {
    super('auth-context', {
      enableCache: true,
      enableEncryption: true,
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

  // Helper method to clear cached auth data
  async clearCachedAuthUser(): Promise<void> {
    await this.clearCachedUserData('auth_user_cache');
  }
}

// Create singleton instance
const authContextSingleton = AuthContextSingleton.getInstance();

export function AuthProvider({ children, initialUser }: { children: React.ReactNode; initialUser?: ServerResolvedAuth['user'] | null }) {
  // Initialize from server-resolved state if provided via prop (from root layout)
  const serverUser = initialUser ?? null;

  // Initialize from server-resolved state if available — skips redundant API call
  // Server-resolved auth from the root layout only contains the Auth0 profile (no DB role).
  // If the role is missing, treat the server state as incomplete and fetch the full user.
  const isServerUserComplete = !!serverUser?.role;
  const [user, setUser] = useState<User | null>(serverUser as User | null);
  const [isLoading, setIsLoading] = useState(!serverUser || !isServerUserComplete);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);

  // Track fetch errors to prevent infinite retry loops
  const fetchErrorRef = React.useRef(false);

  // Fetch current user - checks Auth0 session via API
  const fetchUser = useCallback(async (forceRefresh = false) => {
    try {
      // Only check authentication if we're in an admin context, tenant context, or have authentication tokens
      const isAdminContext = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
      const isTenantContext = typeof window !== 'undefined' && (
        window.location.pathname.startsWith('/t/') || 
        window.location.pathname.startsWith('/dashboard') ||
        window.location.pathname.startsWith('/tenants') ||
        window.location.pathname.startsWith('/settings') ||
        window.location.pathname.startsWith('/onboarding')
      );

      // Check for Auth0 cookies (non-HTTP-only) that indicate user might be authenticated
      const hasAuthCookies = typeof window !== 'undefined' && 
        (document.cookie.includes('auth0_email=') || 
         document.cookie.includes('auth0_id=') ||
         document.cookie.includes('auth0.')); // Also check for auth0 session cookies

      // Skip auth check if no auth cookies present - prevents 401 errors on public pages.
      // On protected pages, always check via API because the Auth0 session cookie
      // (appSession / auth0-session) is httpOnly and invisible to document.cookie.
      const isProtectedContext = isAdminContext || isTenantContext;
      if (!hasAuthCookies && !forceRefresh && !isProtectedContext) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Use cache for normal fetches; only bypass on explicit forceRefresh (e.g., after login redirect)
      const sessionInfo = await securitySingletonService.getSessionInfo(forceRefresh);

      if (sessionInfo.isAuthenticated && sessionInfo.user) {
        // Transform service user to context format
        const transformedUser: User = {
          id: sessionInfo.user.id,
          email: sessionInfo.user.email,
          firstName: sessionInfo.user.firstName,
          lastName: sessionInfo.user.lastName,
          businessName: sessionInfo.user.businessName,
          businessType: sessionInfo.user.businessType,
          phone: sessionInfo.user.phone,
          emailVerified: sessionInfo.user.emailVerified,
          role: sessionInfo.user.role || 'USER',
          tenants: sessionInfo.user.tenants || (sessionInfo.user.tenant ? [{
            id: sessionInfo.user.tenant.id,
            name: sessionInfo.user.tenant.name,
            role: 'OWNER',
            organizationId: sessionInfo.user.tenant.organizationId
          }] : []),
          picture: sessionInfo.user.picture,
          auth0Id: sessionInfo.user.auth0Id,
          onboardingCompleted: sessionInfo.user.onboardingCompleted,
        };

        setUser(transformedUser);
        fetchErrorRef.current = false; // Clear error on success

        // Set current tenant if available
        if (transformedUser.tenants && transformedUser.tenants.length > 0 && !currentTenantId) {
          setCurrentTenantId(transformedUser.tenants[0].id);
          localStorage.setItem('current_tenant_id', transformedUser.tenants[0].id);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      clientLogger.warn('[AuthContext] fetchUser error:', { detail: error });
      fetchErrorRef.current = true; // Mark as errored to prevent retry loop
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []); // Remove currentTenantId - it's only used for setting, not fetching

  // Login - redirects to Auth0 login
  const login = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login';
    }
  }, []);

  // Register - redirects to Auth0 signup
  const register = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/signup';
    }
  }, []);

  // Logout - redirects to Auth0 logout
  const logout = useCallback(() => {
    try {
      // Clear local state
      setUser(null);
      setCurrentTenantId(null);
      localStorage.removeItem('current_tenant_id');
      clearCorrelationId();
      clientLogger.setTenantId(undefined);
      clientLogger.setUserId(undefined);
      
      // Clear cached auth data
      authContextSingleton.clearCachedAuthUser().catch(() => {});
      
      // Clear auth0 cookies - these are used for API authentication
      if (typeof window !== 'undefined') {
        // Clear auth0_id cookie
        document.cookie = 'auth0_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        // Clear auth0_email cookie
        document.cookie = 'auth0_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        
        // Redirect to Auth0 logout (handled by Auth0 SDK middleware)
        window.location.href = '/auth/logout';
      }
    } catch (error) {
      clientLogger.error('[AuthContext] Logout failed:', { detail: error });
      // Still redirect to Auth0 logout even if local clear fails
      if (typeof window !== 'undefined') {
        // Still try to clear cookies
        document.cookie = 'auth0_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'auth0_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        window.location.href = '/auth/logout';
      }
    }
  }, []);

  // Switch tenant
  const switchTenant = useCallback((tenantId: string) => {
    if (user?.tenants.find(t => t.id === tenantId)) {
      setCurrentTenantId(tenantId);
      localStorage.setItem('current_tenant_id', tenantId);
    }
  }, [user?.tenants]);

  // Load user on mount — skip if server already provided complete auth state
  const hasFetchedRef = React.useRef(false);
  const serverProvidedRef = React.useRef(isServerUserComplete);
  
  useEffect(() => {
    // If server already resolved auth with a complete user, skip the initial API fetch
    if (serverProvidedRef.current) {
      hasFetchedRef.current = true;
      console.log('[AuthProvider] mount — skipping fetchUser (server provided complete user)');
      return;
    }
    // Only fetch once on mount
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      console.log('[AuthProvider] mount — calling fetchUser (no complete server state)');
      fetchUser();
    }
  }, [fetchUser]);

  // Re-fetch auth state when navigating to a protected page
  // Uses a separate ref to avoid double-fetching on initial mount (the mount effect above handles the first fetch)
  const pathname = usePathname();
  const hasReFetchedRef = React.useRef(false);
  
  useEffect(() => {
    if (!pathname) return;
    
    const isProtected = pathname.startsWith('/admin') ||
      pathname.startsWith('/t/') ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/tenants') ||
      pathname.startsWith('/settings') ||
      pathname.startsWith('/onboarding');
    
    // Only re-fetch if: protected page, no user, initial mount fetch already ran,
    // no previous fetch error, and we haven't already re-fetched for this pathname.
    // This prevents both infinite loops and double-fetching on initial mount.
    // Also skip if server provided auth state (no need to re-fetch what server already resolved).
    if (isProtected && !user && hasFetchedRef.current && !fetchErrorRef.current && !hasReFetchedRef.current && !serverProvidedRef.current) {
      hasReFetchedRef.current = true;
      console.log('[AuthProvider] protected-page refetch — calling fetchUser');
      fetchUser();
    }
  }, [pathname, user, fetchUser]);

  // Sync clientLogger tenant/user context
  useEffect(() => {
    clientLogger.setTenantId(currentTenantId || undefined);
    clientLogger.setUserId(user?.id);
  }, [currentTenantId, user?.id]);

  const value: AuthContextType = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    currentTenantId,
    switchTenant,
  }), [user, isLoading, currentTenantId, login, register, logout, switchTenant]);

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
