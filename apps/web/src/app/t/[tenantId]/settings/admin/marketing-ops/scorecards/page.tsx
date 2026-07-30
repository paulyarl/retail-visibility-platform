import ScorecardsPage from '@/app/(platform)/settings/admin/marketing-ops/scorecards/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedScorecards({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <ScorecardsPage />
    </>
  );
}
