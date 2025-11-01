import Home from "@/app/(platform)/page";
import SetTenantId from "@/components/client/SetTenantId";

export default async function TenantScopedDashboard({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <Home embedded />
    </>
  );
}
