"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/useTranslation";

type Tenant = {
  id: string;
  name: string;
  region?: string;
  language?: string;
  currency?: string;
  data_policy_accepted?: boolean;
};

export default function TenantSettingsPage() {
  const { t } = useTranslation();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTenant = async () => {
      try {
        // Get tenantId from localStorage (same pattern as ItemsClient)
        const tenantId = typeof window !== "undefined" ? localStorage.getItem("tenantId") : null;
        if (!tenantId) {
          setError("No tenant selected. Please select a tenant first.");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/tenants");
        const tenants: Tenant[] = await res.json();
        const found = tenants.find((t) => t.id === tenantId);
        
        if (found) {
          setTenant(found);
        } else {
          setError("Tenant not found");
        }
      } catch (e) {
        setError("Failed to load tenant settings");
      } finally {
        setLoading(false);
      }
    };

    loadTenant();
  }, []);

  if (loading) {
    return (
      <main className="space-y-6">
        <h1 className="text-2xl font-semibold">{t('settings.tenant.title', 'Tenant Settings')}</h1>
        <p className="text-sm opacity-80">{t('common.loading', 'Loading...')}</p>
      </main>
    );
  }

  if (error || !tenant) {
    return (
      <main className="space-y-6">
        <h1 className="text-2xl font-semibold">{t('settings.tenant.title', 'Tenant Settings')}</h1>
        <p className="text-sm text-red-400">{error || t('common.error', 'Error')}</p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('settings.tenant.title', 'Tenant Settings')}</h1>
      
      <div className="max-w-2xl space-y-4 p-6 border rounded bg-white/5">
        <p className="text-sm opacity-60 italic">
          {t('settings.tenant.readOnly', 'These settings are read-only for now')}
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <label className="w-32 text-sm font-medium">{t('settings.tenant.region', 'Region')}:</label>
            <span className="text-sm opacity-80">{tenant.region || 'us-east-1'}</span>
          </div>

          <div className="flex items-center gap-4">
            <label className="w-32 text-sm font-medium">{t('settings.tenant.language', 'Language')}:</label>
            <span className="text-sm opacity-80">{tenant.language || 'en-US'}</span>
          </div>

          <div className="flex items-center gap-4">
            <label className="w-32 text-sm font-medium">{t('settings.tenant.currency', 'Currency')}:</label>
            <span className="text-sm opacity-80">{tenant.currency || 'USD'}</span>
          </div>

          <div className="flex items-center gap-4">
            <label className="w-32 text-sm font-medium">{t('settings.tenant.dataPolicy', 'Data Policy Accepted')}:</label>
            <input
              type="checkbox"
              checked={tenant.data_policy_accepted || false}
              disabled
              className="opacity-50 cursor-not-allowed"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
