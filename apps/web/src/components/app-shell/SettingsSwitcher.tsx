"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isPlatformUser } from "@/lib/auth/access-control";

type SettingsScope = "platform" | "tenant";

export default function SettingsSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, currentTenantId } = useAuth();
  
  // Determine initial scope from pathname to prevent hydration mismatch
  const getInitialScope = (): SettingsScope => {
    if (pathname?.startsWith('/t/')) return "tenant";
    if (pathname?.startsWith('/settings')) return "platform";
    return "platform";
  };
  
  const [currentScope, setCurrentScope] = useState<SettingsScope>(getInitialScope);

  // Determine if user is a platform user (admin, support, or viewer)
  const showSwitcher = user ? isPlatformUser(user) : false;

  // Only show for platform users
  if (!showSwitcher) return null;

  // Update scope when pathname changes
  useEffect(() => {
    const newScope = getInitialScope();
    if (newScope !== currentScope) {
      setCurrentScope(newScope);
    }
  }, [pathname, currentScope]);

  const onChange = (scope: SettingsScope) => {
    setCurrentScope(scope);
    
    if (scope === "platform") {
      // Go to platform settings
      router.push('/settings');
    } else {
      // Go to tenant settings
      if (currentTenantId) {
        router.push(`/t/${currentTenantId}/settings`);
      } else {
        // If no tenant selected, try to get from localStorage
        const storedTenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
        if (storedTenantId) {
          router.push(`/t/${storedTenantId}/settings`);
        } else if (user?.tenants && user.tenants.length > 0) {
          // Use first tenant
          router.push(`/t/${user.tenants[0].id}/settings`);
        } else {
          // Fallback to tenant selection
          router.push('/tenants');
        }
      }
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <label htmlFor="settings-switcher" className="text-xs text-neutral-500">
        Settings
      </label>
      <select
        id="settings-switcher"
        className="px-2 py-1 border border-neutral-300 rounded-md text-sm bg-white hover:bg-neutral-50 transition-colors cursor-pointer"
        value={currentScope}
        onChange={(e) => onChange(e.target.value as SettingsScope)}
        suppressHydrationWarning
      >
        <option value="platform">Platform</option>
        <option value="tenant">Tenant</option>
      </select>
    </div>
  );
}
