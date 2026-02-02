import SetTenantId from "@/components/client/SetTenantId";
import ItemsPageClient from "@/components/items/ItemsPageClient";
import CartButton from "@/components/inventory/CartButton";
import { Button } from '@mantine/core';

export default async function TenantScopedItemsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <ItemsPageClient tenantId={tenantId} />
      <CartButton tenantId={tenantId} />
    </>
  );
}
