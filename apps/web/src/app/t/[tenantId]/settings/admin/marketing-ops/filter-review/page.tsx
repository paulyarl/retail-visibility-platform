import FilterReviewPage from '@/app/(platform)/settings/admin/marketing-ops/filter-review/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedFilterReview({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <FilterReviewPage />
    </>
  );
}
