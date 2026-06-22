"use client";

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { tenantInfoService } from '@/services/TenantInfoService';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { useAuth } from '@/contexts/AuthContext';
import { canSwitchToTenant } from '@/lib/auth/access-control';
import { navigateToTenant } from '@/lib/tenant-navigation';
import { securitySingletonService } from '@/services/SecuritySingletonService';
import { adminSecurityMonitoringService } from '@/services/AdminSecurityMonitoringSingletonService';
import { clientTenantContextManager } from '@/lib/clientTenantContext';

interface TenantScopeHeaderProps {
  tenantId: string;
  pageTitle?: string;
  showPageTitle?: boolean;
}

/**
 * Tenant Scope Header Component
 * Provides a consistent branded header across all tenant-scoped pages
 * Shows tenant logo, name, and optional page title
 * Uses centralized tenant context for consistency
 */
export default function TenantScopeHeader({ 
  tenantId, 
  pageTitle,
  showPageTitle = true 
}: TenantScopeHeaderProps) {
  const pathname = usePathname();
  const [tenantData, setTenantData] = useState<any>(null);
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [availableTenants, setAvailableTenants] = useState<any[]>([]);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasFetchedTenantDataRef = useRef<string | null>(null);
  const { user, isAuthenticated, switchTenant } = useAuth();

  // Load tenant data and business profile once per tenantId
  useEffect(() => {
    const loadTenantData = async () => {
      if (!tenantId || hasFetchedTenantDataRef.current === tenantId) return;
      hasFetchedTenantDataRef.current = tenantId;

      try {
        setLoading(true);

        // Fetch both tenant info and business profile in parallel
        const [info, profile] = await Promise.all([
          tenantInfoService.getTenantInfo(tenantId),
          platformHomeService.getTenantProfile(tenantId)
        ]);

        setTenantData(info);
        setBusinessProfile(profile);
      } catch (error) {
        console.error('[TenantScopeHeader] Error loading tenant data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTenantData();
  }, [tenantId]);

  // Load available tenants for dropdown
  const userRole = user?.role;
  const userEmail = user?.email;
  useEffect(() => {
    const loadAvailableTenants = async () => {
      if (!isAuthenticated || !userEmail) return;
      
      try {
        let list: any[] = [];
        
        // PLATFORM_ADMIN gets all tenants (active and inactive)
        if (userRole === 'PLATFORM_ADMIN') {
          const allTenants = await adminSecurityMonitoringService.getAvailableTenants();
          list = allTenants.map((t: any) => ({
            id: t.id,
            name: t.name,
            locationStatus: t.subscriptionStatus === 'expired' || t.subscriptionStatus === 'cancelled' ? 'inactive' : 'active',
            subscriptionStatus: t.subscriptionStatus
          }));
        } else {
          // Regular users get their assigned tenants
          const sessionInfo = await securitySingletonService.getSessionInfo();
          
          if (sessionInfo.isAuthenticated && sessionInfo.user?.tenants) {
            list = sessionInfo.user.tenants.map((t: any) => ({
              id: t.id,
              name: t.name,
              locationStatus: t.locationStatus
            }));
          }
        }
        
        setAvailableTenants(list);
      } catch (error) {
        console.error('[TenantScopeHeader] Error loading available tenants:', error);
      }
    };

    loadAvailableTenants();
  }, [isAuthenticated, userRole, userEmail]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  // Handle tenant switch
  const handleTenantSwitch = async (newTenantId: string) => {
    if (newTenantId === tenantId || switching) return;

    // Check permissions
    if (!user || (user.role !== 'PLATFORM_ADMIN' && !canSwitchToTenant(user, newTenantId))) {
      return;
    }

    // Check if tenant is inactive and show confirmation
    const targetTenant = availableTenants.find(t => t.id === newTenantId);
    if (targetTenant?.locationStatus !== 'active') {
      const statusText = targetTenant.locationStatus === 'inactive' 
        ? 'inactive due to subscription issues'
        : `currently ${targetTenant.locationStatus}`;
      
      const confirmed = window.confirm(
        `⚠️ Non-Active Location\n\n"${targetTenant.name}" is ${statusText}.\n\nDo you want to switch there to manage this location?`
      );
      if (!confirmed) return;
    }

    try {
      setSwitching(true);
      setDropdownOpen(false);
      
      // Update centralized tenant context
      clientTenantContextManager.setTenantContext(newTenantId, 'localStorage');
      
      // Update auth context
      switchTenant(newTenantId);

      // Navigate to new tenant dashboard
      await navigateToTenant(newTenantId, {
        preserveCurrentPage: false,
        navigate: (url) => {
          window.location.href = url;
        }
      });
    } catch (error) {
      console.error('[TenantScopeHeader] Error switching tenant:', error);
      setSwitching(false);
    }
  };

  // Auto-generate page title from pathname if not provided
  const autoPageTitle = pathname
    ? pathname
        .split('/')
        .filter(Boolean)
        .pop()
        ?.split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || 'Dashboard'
    : 'Dashboard';

  const displayTitle = pageTitle || autoPageTitle;
  const tenantName = tenantData?.name || businessProfile?.business_name || 'Loading...';
  const logoUrl = businessProfile?.logo_url;

  if (loading && !tenantData) {
    return (
      <div className="sticky top-0 z-40 bg-white border-b border-neutral-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-neutral-200 rounded-lg animate-pulse" />
            <div className="flex-1">
              <div className="h-5 w-32 bg-neutral-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-neutral-200 shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Logo and Tenant Name */}
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={tenantName}
                className="h-10 w-10 object-contain rounded-lg border border-neutral-200 bg-white flex-shrink-0"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="h-10 w-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg border border-neutral-300 flex items-center justify-center flex-shrink-0">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            )}
            
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-neutral-900 truncate">
                {tenantName}
              </h1>
              {showPageTitle && displayTitle && (
                <p className="text-sm text-neutral-500 truncate">
                  {displayTitle}
                </p>
              )}
            </div>
          </div>

          {/* Right: Interactive Tenant Switcher Dropdown */}
          {availableTenants.length > 1 ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                disabled={switching}
                className="hidden md:flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-primary-50 to-primary-100 hover:from-primary-100 hover:to-primary-200 border border-primary-200 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-primary-900">
                    {availableTenants.find(t => t.id === tenantId)?.name || tenantName}
                  </span>
                </div>
                <svg 
                  className={`w-4 h-4 text-primary-600 transition-transform duration-200 ${
                    dropdownOpen ? 'rotate-180' : ''
                  }`}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-neutral-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-3 py-2 border-b border-neutral-100">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Switch Location</p>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {availableTenants.map((tenant) => {
                      const isActive = tenant.id === tenantId;
                      const isInactive = tenant.locationStatus !== 'active';
                      const role = user?.tenants?.find((t: any) => t.id === tenant.id)?.role;
                      
                      return (
                        <div
                          key={tenant.id}
                          onClick={() => handleTenantSwitch(tenant.id)}
                          className={`w-full px-4 py-3 text-left transition-all duration-150 ${
                            isActive
                              ? 'bg-primary-50 border-l-4 border-primary-500'
                              : isInactive
                              ? 'bg-red-50 border-l-4 border-red-200 hover:bg-red-100 cursor-pointer'
                              : 'hover:bg-neutral-50 border-l-4 border-transparent hover:border-neutral-300 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm font-medium truncate ${
                                  isActive ? 'text-primary-900' : isInactive ? 'text-red-700' : 'text-neutral-900'
                                }`}>
                                  {tenant.name}
                                </p>
                                {isActive && (
                                  <svg className="w-4 h-4 text-primary-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                                {isInactive && (
                                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              {role && (
                                <p className={`text-xs mt-0.5 ${
                                  isInactive ? 'text-red-600' : 'text-neutral-500'
                                }`}>
                                  {role.replace('_', ' ').toLowerCase()}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {isInactive && (
                                <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 flex-shrink-0 animate-pulse capitalize">
                                  {tenant.locationStatus || 'Inactive'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {user?.role === 'PLATFORM_ADMIN' && (
                    <div className="px-3 py-2 border-t border-neutral-100 mt-1">
                      <p className="text-xs text-neutral-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        Platform Admin Mode
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-neutral-100 rounded-md">
              <span className="text-xs font-mono text-neutral-600">{tenantId}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
