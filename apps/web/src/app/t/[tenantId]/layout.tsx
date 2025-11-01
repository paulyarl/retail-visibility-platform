import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import RememberTenantRoute from '@/components/client/RememberTenantRoute';
import TenantShell from '@/components/tenant/TenantShell';

export default async function TenantLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tenantId: string }> | { tenantId: string } }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  const resolvedParams = (params && typeof params === 'object' && 'then' in (params as any)) 
    ? await (params as Promise<{ tenantId: string }>) 
    : (params as { tenantId: string });
  const tenantId = resolvedParams?.tenantId;
  if (!token) {
    redirect(`/login?next=/t/${tenantId}`);
  }
  if (!tenantId) {
    notFound();
  }

  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
  let tenantList: Array<{ id: string; name: string }> = [];
  try {
    const res = await fetch(`${apiBaseUrl}/tenants`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      redirect('/tenants');
    }
    const list: Array<{ id: string; name: string }> = await res.json();
    tenantList = Array.isArray(list) ? list : [];
    const isMember = Array.isArray(tenantList) && tenantList.some(t => t.id === tenantId);
    if (!isMember) {
      // Membership guard
      redirect('/tenants');
    }
  } catch {
    redirect('/tenants');
  }

  // Resolve current tenant friendly name
  const current = tenantList.find(t => t.id === tenantId);
  const tenantName = current?.name || tenantId;

  const nav = [
    { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
    { label: 'Items', href: `/t/${tenantId}/items` },
    { label: 'Categories', href: `/t/${tenantId}/categories` },
    { label: 'Feed Validation', href: `/t/${tenantId}/feed-validation` },
    { label: 'Profile Completeness', href: `/t/${tenantId}/profile-completeness` },
    { label: 'Settings', href: `/t/${tenantId}/settings/tenant` },
  ];

  return (
    <>
      {/* Persist last visited tenant route for restore-after-login UX */}
      <RememberTenantRoute tenantId={tenantId} />
      <TenantShell tenantId={tenantId} tenantName={tenantName} nav={nav} tenants={tenantList}>
        {children}
      </TenantShell>
    </>
  );
}
