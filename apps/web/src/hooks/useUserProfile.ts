import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export interface UserRole {
  type: 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'TENANT_ADMIN' | 'TENANT_MANAGER' | 'TENANT_USER';
  label: string;
  color: string;
}

export interface UserProfileData {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  
  // Platform context
  isPlatformAdmin: boolean;
  
  // Organization context
  organizationId?: string;
  organizationName?: string;
  isOrgAdmin: boolean;
  
  // Tenant context
  tenantsCount: number;
  locationsServed: number;
  primaryTenantId?: string;
  primaryTenantName?: string;
  
  // Access summary
  canManageOrganization: boolean;
  canManageTenants: boolean;
  canManageUsers: boolean;
  
  // Activity
  lastActive?: Date;
  memberSince: Date;
}

export interface UseUserProfileReturn {
  profile: UserProfileData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Centralized User Profile Hook
 * Fetches comprehensive user context including roles, access, and activity
 * Reusable across platform and tenant dashboards
 * Falls back to auth context if profile endpoint not available yet
 */
export function useUserProfile(): UseUserProfileReturn {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // If no user in auth context, wait for auth to load
      if (!user) {
        setLoading(false);
        return;
      }

      // Try to fetch from dedicated profile endpoint
      const response = await api.get('/api/user/profile');

      if (!response.ok) {
        // Fallback to auth user data if endpoint doesn't exist yet
        if (response.status === 404 && user) {
          console.log('[useUserProfile] Using fallback auth data (profile endpoint not implemented yet)');
          const fallbackProfile = createFallbackProfile(user);
          setProfile(fallbackProfile);
          setLoading(false);
          return;
        }
        throw new Error('Failed to load user profile');
      }

      const data = await response.json();

      // Map role to display info
      const roleInfo = getRoleInfo(data.role, data.isPlatformAdmin, data.isOrgAdmin);

      const profileData: UserProfileData = {
        id: data.id,
        name: data.name || data.email,
        email: data.email,
        role: roleInfo,
        
        isPlatformAdmin: data.isPlatformAdmin || false,
        
        organizationId: data.organizationId,
        organizationName: data.organizationName,
        isOrgAdmin: data.isOrgAdmin || false,
        
        tenantsCount: data.tenantsCount || 0,
        locationsServed: data.locationsServed || 0,
        primaryTenantId: data.primaryTenantId,
        primaryTenantName: data.primaryTenantName,
        
        canManageOrganization: data.canManageOrganization || false,
        canManageTenants: data.canManageTenants || false,
        canManageUsers: data.canManageUsers || false,
        
        lastActive: data.lastActive ? new Date(data.lastActive) : undefined,
        memberSince: new Date(data.memberSince || data.createdAt)
      };

      setProfile(profileData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      setError(errorMessage);
      console.error('[useUserProfile] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return {
    profile,
    loading,
    error,
    refresh: fetchProfile
  };
}

/**
 * Create fallback profile from auth user data
 * Used when profile endpoint is not yet implemented
 */
function createFallbackProfile(user: any): UserProfileData {
  const isPlatformAdmin = user.role === 'ADMIN' || user.isPlatformAdmin || false;
  const isOrgAdmin = user.isOrgAdmin || false;
  const roleInfo = getRoleInfo(user.role, isPlatformAdmin, isOrgAdmin);
  
  // Count tenants from memberships
  const tenantsCount = user.tenantMemberships?.length || 0;
  
  // Extract name from email if not provided
  let displayName = user.name;
  if (!displayName && user.email) {
    // Extract name from email (e.g., "alice.platformadmin@testing.app" -> "Alice Platformadmin")
    const emailName = user.email.split('@')[0];
    displayName = emailName
      .split(/[._-]/)
      .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  
  return {
    id: user.id,
    name: displayName || user.email,
    email: user.email,
    role: roleInfo,
    
    isPlatformAdmin,
    
    organizationId: user.organizationId,
    organizationName: user.organizationName,
    isOrgAdmin,
    
    tenantsCount,
    locationsServed: tenantsCount, // Assume same for now
    primaryTenantId: user.tenantMemberships?.[0]?.tenantId,
    primaryTenantName: user.tenantMemberships?.[0]?.tenant?.name,
    
    canManageOrganization: isPlatformAdmin || isOrgAdmin,
    canManageTenants: isPlatformAdmin || isOrgAdmin || roleInfo.type === 'TENANT_ADMIN',
    canManageUsers: isPlatformAdmin || isOrgAdmin || roleInfo.type === 'TENANT_ADMIN',
    
    memberSince: new Date(user.createdAt || Date.now())
  };
}

/**
 * Determine role display information
 */
function getRoleInfo(
  role: string | undefined,
  isPlatformAdmin: boolean,
  isOrgAdmin: boolean
): UserRole {
  // Platform admin takes precedence
  if (isPlatformAdmin) {
    return {
      type: 'PLATFORM_ADMIN',
      label: 'Platform Admin',
      color: 'purple'
    };
  }

  // Organization admin
  if (isOrgAdmin) {
    return {
      type: 'ORG_ADMIN',
      label: 'Organization Admin',
      color: 'blue'
    };
  }

  // Tenant-level roles
  switch (role?.toUpperCase()) {
    case 'ADMIN':
    case 'TENANT_ADMIN':
      return {
        type: 'TENANT_ADMIN',
        label: 'Location Admin',
        color: 'green'
      };
    case 'MANAGER':
    case 'TENANT_MANAGER':
      return {
        type: 'TENANT_MANAGER',
        label: 'Manager',
        color: 'amber'
      };
    case 'USER':
    case 'TENANT_USER':
    default:
      return {
        type: 'TENANT_USER',
        label: 'Platform User',
        color: 'neutral'
      };
  }
}
