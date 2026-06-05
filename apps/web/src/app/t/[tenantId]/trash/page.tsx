import SetTenantId from "@/components/client/SetTenantId";
import TrashBinClient from "@/components/trash/TrashBinClient";

export default async function TrashBinPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <TrashBinClient tenantId={tenantId} />
    </>
  );
}
