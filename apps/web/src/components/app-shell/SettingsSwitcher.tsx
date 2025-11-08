"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isPlatformAdmin } from "@/lib/auth/access-control";

type SettingsScope = "platform" | "tenant";

export default function SettingsSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, currentTenantId } = useAuth();
  const [currentScope, setCurrentScope] = useState<SettingsScope>("platform");

  // Determine if user is a platform user (admin or support)
  const isPlatformUser = user ? isPlatformAdmin(user) : false;

  // Only show for platform users
  if (!isPlatformUser) return null;

  // Determine current scope from pathname
  useEffect(() => {
    if (pathname?.startsWith('/t/')) {
      setCurrentScope("tenant");
    } else if (pathname?.startsWith('/settings')) {
      setCurrentScope("platform");
    }
  }, [pathname]);

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
      >
        <option value="platform">Platform</option>
        <option value="tenant">Tenant</option>
      </select>
    </div>
  );
}
