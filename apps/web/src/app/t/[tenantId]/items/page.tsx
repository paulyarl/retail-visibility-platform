import ItemsPage from "@/app/items/page";
import SetTenantId from "@/components/client/SetTenantId";

export default async function TenantScopedItemsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {/* Set client-side tenantId context */}
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      {/* Render the server Items page directly */}
      <ItemsPage searchParams={{ tenantId }} />
    </>
  );
}
