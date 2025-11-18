import SetTenantId from "@/components/client/SetTenantId";
import ItemsPageClient from "@/components/items/ItemsPageClient";

export default async function TenantScopedItemsPreviewPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <ItemsPageClient tenantId={tenantId} />
    </>
  );
}
