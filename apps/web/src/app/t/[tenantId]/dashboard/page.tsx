import TenantDashboardV2 from "@/components/dashboard/TenantDashboardV2";
import SetTenantId from "@/components/client/SetTenantId";
import TenantAuthGate from "@/components/tenant/TenantAuthGate";

export default async function TenantScopedDashboard({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  console.log(`[dashboard/page] render tenantId=${tenantId}`);

  return (
    <>
      {/* Set tenantId in localStorage for context */}
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}

      {/* Client-side auth gate: mirrors /tenants layout session-revival logic */}
      <TenantAuthGate>
        <TenantDashboardV2 tenantId={tenantId} />
      </TenantAuthGate>
    </>
  );
}
