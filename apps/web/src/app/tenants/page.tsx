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
      {loadError ? (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-6 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Error Loading Tenants</h2>
                <p className="text-sm text-neutral-600">{loadError}</p>
              </div>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-white font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <TenantsClient initialTenants={tenants as any} />
      )}
    </Protected>
  );
}
