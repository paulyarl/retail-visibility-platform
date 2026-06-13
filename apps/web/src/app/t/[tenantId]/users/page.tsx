import { redirect } from 'next/navigation';

export default async function TenantScopedUsersPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  redirect(`/t/${tenantId}/settings/users`);
}
