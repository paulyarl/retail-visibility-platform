import AuthPanel from '@/components/AuthPanel';
import Protected from '@/components/Protected';
import TenantsClient from '@/components/tenants/TenantsClient';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function TenantsPage() {
  // Fetch directly from Railway API in SSR to avoid Vercel deployment protection
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
  
  let tenants: Array<{ id: string; name: string; createdAt?: string; created_at?: string }> = [];
  let loadError: string | null = null;

  try {
    const url = `${apiBaseUrl}/tenants`;
    console.log('[TenantsPage SSR] Fetching from:', url);
    const res = await fetch(url, { cache: 'no-store' });
    console.log('[TenantsPage SSR] Response status:', res.status);
    if (!res.ok) {
      const errorText = await res.text();
      console.error('[TenantsPage SSR] Error response:', errorText);
      loadError = `Failed to load tenants (status ${res.status})`;
    } else {
      // Be tolerant of either an array or an object shape
      const data = await res.json().catch(() => null);
      if (Array.isArray(data)) {
        tenants = data as any;
      } else if (data && Array.isArray((data as any).tenants)) {
        tenants = (data as any).tenants;
      } else {
        tenants = [];
      }
    }
  } catch (_e) {
    loadError = 'Failed to load tenants';
  }

  return (
    <Protected>
      <main className="space-y-6">
        <AuthPanel />
        <h1 className="text-2xl font-semibold">Tenants</h1>
        {loadError ? (
          <div className="text-sm text-red-400">{loadError}</div>
        ) : (
          <TenantsClient initialTenants={tenants as any} />
        )}
      </main>
    </Protected>
  );
}
