"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { canSwitchToTenant } from "@/lib/auth/access-control";
import { navigateToTenant } from "@/lib/tenant-navigation";
import { clientTenantContextManager } from "@/lib/clientTenantContext";
import { securitySingletonService } from "@/services/SecuritySingletonService";
import { adminSecurityMonitoringService } from "@/services/AdminSecurityMonitoringSingletonService";
import MobileCapacityIndicator from "@/components/capacity/MobileCapacityIndicator";
import ChangeLocationStatusModal from '@/components/tenant/ChangeLocationStatusModal';
import { platformHomeService } from "@/services/PlatformHomeSingletonService";

type Tenant = { 
  id: string; 
  name: string;
  locationStatus?: 'pending' | 'active' | 'inactive' | 'closed' | 'archived';
};

const getStatusBadge = (status?: string) => {
  if (!status || status === 'active') return null;
  
  const badges: Record<string, { label: string; color: string; icon: string }> = {
    pending: { label: 'Opening Soon', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '🚧' },
    inactive: { label: 'Temp Closed', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: '⏸️' },
    closed: { label: 'Closed', color: 'bg-red-100 text-red-800 border-red-300', icon: '🔒' },
    archived: { label: 'Archived', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: '📦' },
  };
  
  const badge = badges[status];
  if (!badge) return null;
  
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs border ${badge.color}`}>
      <span>{badge.icon}</span>
      <span>{badge.label}</span>
    </span>
  );
};



export default function TenantSwitcher() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const { user,isAuthenticated,currentTenantId,switchTenant } = useAuth();
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      // Skip if unauthenticated
      if (typeof window === 'undefined') return;
      
      // Skip if on onboarding pages to avoid redirect loops
      if (window.location.pathname === '/onboarding' || window.location.pathname.includes('/onboarding')) {
        return;
      }
      
      if (!isAuthenticated) return;
      try {
        let list: Tenant[] = [];
        
        // PLATFORM_ADMIN gets all active tenants
        if (user?.role === 'PLATFORM_ADMIN') {
          const allTenants = await adminSecurityMonitoringService.getAvailableTenants();
          list = allTenants
            .filter((t: any) => t.subscriptionStatus === 'active' || t.subscriptionStatus === 'trial_discovery')
            .map((t: any) => ({
              id: t.id,
              name: t.name,
              locationStatus: t.subscriptionStatus === 'expired' ? 'inactive' : 'active'
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
        
        setTenants(list);
        
        // Use centralized tenant context manager
        const currentContext = clientTenantContextManager.getTenantContext();
        const selected = currentContext.tenantId || list[0]?.id || null;
        setCurrent(selected);
        
        // Sync with auth context if needed
        if (selected && selected !== currentTenantId) {
          switchTenant(selected);
        }
      } catch (e) {
        // ignore for header
      }
    };
    load();
  }, []);

  const onChange = async (tenantId: string) => {
    setCurrent(tenantId);
    if (typeof window === "undefined") return;

    // PLATFORM_ADMIN can switch to any tenant
    // Other users need permission check
    if (!user || (user.role !== 'PLATFORM_ADMIN' && !canSwitchToTenant(user, tenantId))) {
      window.location.href = '/tenants';
      return;
    }

    // Update centralized tenant context
    clientTenantContextManager.setTenantContext(tenantId, 'localStorage');
    
    // Update auth context
    switchTenant(tenantId);

    // Use centralized navigation utility with preserveCurrentPage: false
    // This ensures dropdown switching always goes to dashboard, not last remembered path
    await navigateToTenant(tenantId, {
      preserveCurrentPage: false, // Always go to dashboard when switching via dropdown
      navigate: (url) => {
        window.location.href = url;
      }
    });
  };

  // Render container consistently for tests and UX
  if (!tenants.length) {
    return (
      <div id="tenant-switcher" className="inline-flex items-center gap-2 text-sm">
        <span className="inline-block h-4 w-24 bg-neutral-200 rounded animate-pulse" />
        <a href="/tenants" className="text-primary-600 hover:text-primary-700">Select location</a>
      </div>
    );
  }

  // Single tenant: show label instead of select
  if (tenants.length === 1) {
    const only = tenants[0];
    const role = user?.tenants?.find(t => t.id === only.id)?.role;
    return (
      <div className="inline-flex items-center gap-2 text-sm">
        <span className="text-xs text-neutral-500">Location</span>
        <button
          onClick={() => setIsStatusModalOpen(true)}
          className="px-2 py-1 rounded-md hover:bg-neutral-50 flex items-center gap-2"
        >
          <span className="font-medium text-neutral-900">{only.name}</span>
          {getStatusBadge(only.locationStatus)}
          <MobileCapacityIndicator tenantId={only.id} showText={false} />
          {role && (
            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-2xs border border-neutral-300 text-neutral-600">
              {role}
            </span>
          )}
        </button>
        {isStatusModalOpen && (
          <ChangeLocationStatusModal
            isOpen={isStatusModalOpen}
            onClose={() => setIsStatusModalOpen(false)}
            tenantId={only.id}
            tenantName={only.name}
            initialStatus={only.locationStatus || 'active'}
            onStatusChanged={() => {
              // Refresh data after status change
              const load = async () => {
                // Skip if unauthenticated
                if (typeof window === 'undefined') return;
                
                if (!isAuthenticated) return;
                try {
                  // Use SecuritySingletonService to get updated tenant list
                  const sessionInfo = await securitySingletonService.getSessionInfo();
                  
                  if (sessionInfo.isAuthenticated && sessionInfo.user?.tenants) {
                    const list = sessionInfo.user.tenants.map((t: any) => ({
                      id: t.id,
                      name: t.name,
                      locationStatus: t.locationStatus
                    }));
                    setTenants(list);
                  }
                } catch (e) {
                  // ignore for header
                }
              };
              load();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div id="tenant-switcher" className="inline-flex items-center gap-2">
      <label htmlFor="tenant-switcher" className="text-xs text-neutral-500">Location</label>
      <select
        id="tenant-switcher"
        className="px-2 py-1 border border-neutral-300 rounded-md text-sm bg-white"
        value={current ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {tenants.map((t) => {
          const role = user?.tenants?.find(x => x.id === t.id)?.role;
          const statusLabel = t.locationStatus && t.locationStatus !== 'active' 
            ? ` [${t.locationStatus.toUpperCase()}]` 
            : '';
          return (
            <option key={t.id} value={t.id}>
              {t.name}{statusLabel}{role ? ` — ${role.toLowerCase()}` : ''}
            </option>
          );
        })}
      </select>
    </div>
  );
}
