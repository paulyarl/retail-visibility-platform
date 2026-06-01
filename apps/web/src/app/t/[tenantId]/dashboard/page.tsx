import TenantDashboardV2 from "@/components/dashboard/TenantDashboardV2";
import SetTenantId from "@/components/client/SetTenantId";

export default async function TenantScopedDashboard({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  return (
    <>
      {/* Set tenantId in localStorage for context */}
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}

      {/* New redesigned tenant dashboard */}
      <TenantDashboardV2 tenantId={tenantId} />
    </>
  );
}
