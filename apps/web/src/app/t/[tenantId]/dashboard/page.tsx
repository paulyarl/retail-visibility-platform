import TenantDashboard from "@/components/dashboard/TenantDashboard";
import SetTenantId from "@/components/client/SetTenantId";

export default async function TenantScopedDashboard({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  
  return (
    <>
      {/* Set tenantId in localStorage for context */}
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      
      {/* Dedicated tenant dashboard - knows its context */}
      <TenantDashboard tenantId={tenantId} />
    </>
  );
}
