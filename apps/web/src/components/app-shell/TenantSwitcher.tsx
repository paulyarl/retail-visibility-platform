"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { useAuth } from "@/contexts/AuthContext";

type Tenant = { id: string; name: string };

export default function TenantSwitcher() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const load = async () => {
      // Skip if unauthenticated
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('access_token');
        if (!token) return;
      }
      try {
        const res = await api.get("/api/tenants", { skipAuthRedirect: true });
        if (!res.ok) return;
        const data: Tenant[] = await res.json();
        // Limit to authorized memberships to avoid confusion
        const memberIds = (user?.tenants || []).map(t => t.id);
        const filtered = memberIds.length > 0 ? data.filter(t => memberIds.includes(t.id)) : data;
        setTenants(filtered);
        // Determine current from localStorage or first tenant
        const stored = typeof window !== "undefined" ? localStorage.getItem("tenantId") : null;
        const selected = filtered.find((t) => t.id === stored)?.id || filtered[0]?.id || null;
        if (selected) {
          setCurrent(selected);
          if (stored !== selected) localStorage.setItem("tenantId", selected);
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
    localStorage.setItem("tenantId", tenantId);

    // Gate by membership: allow ADMIN or membership in selected tenant (any role)
    const isAdmin = user?.role === 'ADMIN';
    const isMember = !!user?.tenants?.find(t => t.id === tenantId);
    const allowed = isAdmin || isMember;
    if (!allowed) {
      window.location.href = '/tenants';
      return;
    }

    // Onboarding-first: fetch profile to determine completeness
    try {
      const res = await api.get(`/api/tenant/profile?tenant_id=${encodeURIComponent(tenantId)}`, { skipAuthRedirect: true });
      if (res.ok) {
        const p = await res.json();
        const nameOk = !!(p.business_name && String(p.business_name).trim().length >= 2);
        const addrOk = !!(p.address_line1 && String(p.address_line1).trim().length >= 3);
        const cityOk = !!(p.city && String(p.city).trim().length >= 2);
        const postalOk = !!(p.postal_code && String(p.postal_code).trim().length >= 3);
        const countryOk = !!(p.country_code && String(p.country_code).trim().length === 2);
        const emailOk = !!(p.email && String(p.email).includes('@'));

        const needsOnboarding = !(nameOk && addrOk && cityOk && postalOk && countryOk && emailOk);
        if (needsOnboarding) {
          window.location.href = `/onboarding?tenantId=${encodeURIComponent(tenantId)}`;
          return;
        }
      }
    } catch {
      // Ignore errors and fall through to settings
    }

    // Default destination: tenant-scoped settings
    window.location.href = `/t/${encodeURIComponent(tenantId)}/settings`;
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
        <button onClick={() => onChange(only.id)} className="px-2 py-1 rounded-md hover:bg-neutral-50">
          <span className="font-medium text-neutral-900">{only.name}</span>
          {role && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-2xs border border-neutral-300 text-neutral-600">
              {role}
            </span>
          )}
        </button>
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
          return (
            <option key={t.id} value={t.id}>
              {t.name}{role ? ` — ${role.toLowerCase()}` : ''}
            </option>
          );
        })}
      </select>
    </div>
  );
}
