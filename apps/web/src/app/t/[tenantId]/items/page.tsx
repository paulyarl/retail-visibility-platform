import SetTenantId from "@/components/client/SetTenantId";
import ItemsClient from "@/components/items/ItemsClientWrapper";

export default async function TenantScopedItemsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      {/* Render Items directly within tenant shell to avoid redirects */}
      <ItemsClient initialItems={[]} initialTenantId={tenantId} />
    </>
  );
}
