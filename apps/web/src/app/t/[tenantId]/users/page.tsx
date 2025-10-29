import SetTenantId from "@/components/client/SetTenantId";
import LegacyUsersPage from "@/app/tenants/[id]/users/page";

export default async function TenantScopedUsersPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      {/* Render the existing tenant users page directly */}
      <LegacyUsersPage />
    </>
  );
}
