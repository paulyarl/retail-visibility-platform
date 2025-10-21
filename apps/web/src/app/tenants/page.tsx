import AuthPanel from '@/components/AuthPanel';
import Protected from '@/components/Protected';
import TenantsClient from '@/components/tenants/TenantsClient';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function TenantsPage() {
  // Construct absolute URL for SSR fetch
  // On Vercel, use VERCEL_URL; locally fall back to headers
  let base = '';
  if (process.env.VERCEL_URL) {
    base = `https://${process.env.VERCEL_URL}`;
  } else {
    const hdrs = await headers();
    const host = hdrs.get('host');
    const protocol = process.env.VERCEL ? 'https' : 'http';
    base = host ? `${protocol}://${host}` : 'http://localhost:3000';
  }

  let tenants: Array<{ id: string; name: string; createdAt?: string; created_at?: string }> = [];
  let loadError: string | null = null;

  try {
    const url = `${base}/api/tenants`;
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
