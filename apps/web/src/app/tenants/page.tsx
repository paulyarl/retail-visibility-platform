import AuthPanel from '@/components/AuthPanel';
import Protected from '@/components/Protected';
import TenantsClient from '@/components/tenants/TenantsClient';

export default async function TenantsPage() {
  const res = await fetch('http://localhost:3000/api/tenants', { cache: 'no-store' });
  const data = await res.json();
  const tenants: Array<{ id: string; name: string; createdAt?: string; created_at?: string }>
    = Array.isArray(data.tenants) ? data.tenants : [];

  return (
    <Protected>
      <main className="space-y-6">
        <AuthPanel />
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <TenantsClient initialTenants={tenants as any} />
      </main>
    </Protected>
  );
}
