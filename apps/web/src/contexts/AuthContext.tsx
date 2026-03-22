"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { securitySingletonService } from '@/services/SecuritySingletonService';
import { ApiSystemSingleton } from '@/providers/base/ApiSystemSingleton';
import { SingletonCacheOptions } from '@/providers/base/UniversalSingleton';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);

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
         document.cookie.includes('auth0_id='));

      // Skip auth check for public pages only if no auth cookies present
      // This allows public page components (like reviews) to query isAuthenticated
      if (!isAdminContext && !isTenantContext && !hasAuthCookies && !forceRefresh) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Always bypass cache to ensure fresh auth state
      // This is critical after Auth0 login redirects back to the app
      const sessionInfo = await securitySingletonService.getSessionInfo(true);
      

      // console.log(`AuthContext fetchUser sessionInfo: ${JSON.stringify(sessionInfo)}`);
      
      
      if (sessionInfo.isAuthenticated && sessionInfo.user) {
        // Transform service user to context format
        const transformedUser: User = {
          id: sessionInfo.user.id,
          email: sessionInfo.user.email,
          firstName: sessionInfo.user.firstName,
          lastName: sessionInfo.user.lastName,
          emailVerified: sessionInfo.user.emailVerified,
          role: sessionInfo.user.role || 'USER',
          tenants: sessionInfo.user.tenants || (sessionInfo.user.tenant ? [{
            id: sessionInfo.user.tenant.id,
            name: sessionInfo.user.tenant.name,
            role: 'OWNER'
          }] : []),
          picture: sessionInfo.user.picture,
          auth0Id: sessionInfo.user.auth0Id,
          onboardingCompleted: sessionInfo.user.onboardingCompleted,
        };
        
        // console.log(`AuthContext fetchUser transformedUser: ${JSON.stringify(transformedUser)}`);
      
        
        setUser(transformedUser);
        
        // Set current tenant if available
        if (transformedUser.tenants && transformedUser.tenants.length > 0 && !currentTenantId) {
          setCurrentTenantId(transformedUser.tenants[0].id);
          localStorage.setItem('current_tenant_id', transformedUser.tenants[0].id);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.warn('[AuthContext] fetchUser error:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenantId]);

  // Login - redirects to Auth0 login
  const login = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login';
    }
  };

  // Register - redirects to Auth0 signup
  const register = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/signup';
    }
  };

  // Logout - redirects to Auth0 logout
  const logout = () => {
    try {
      // Clear local state
      setUser(null);
      setCurrentTenantId(null);
      localStorage.removeItem('current_tenant_id');
      
      // Clear cached auth data
      authContextSingleton.clearCachedAuthUser().catch(() => {});
      
      // Redirect to Auth0 logout (handled by Auth0 SDK middleware)
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/logout';
      }
    } catch (error) {
      console.error('[AuthContext] Logout failed:', error);
      // Still redirect to Auth0 logout even if local clear fails
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/logout';
      }
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
    fetchUser();
  }, []); // Empty dependency array - only run once on mount

  // Re-fetch auth state when navigating to a protected page
  const pathname = usePathname();
  
  useEffect(() => {
    if (!pathname) return;
    
    const isProtected = pathname.startsWith('/admin') ||
      pathname.startsWith('/t/') ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/tenants') ||
      pathname.startsWith('/settings') ||
      pathname.startsWith('/onboarding');
    
    if (isProtected && !user) {
      fetchUser();
    }
  }, [pathname, user]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
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
