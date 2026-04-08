import InvoiceHistoryPage from '@/app/(platform)/settings/billing/invoices/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedInvoiceHistory({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <InvoiceHistoryPage />
    </>
  );
}
