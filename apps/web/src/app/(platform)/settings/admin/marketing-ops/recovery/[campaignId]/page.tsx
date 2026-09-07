import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import RecoveryDetailClient from './RecoveryDetailClient';

export default async function RecoveryDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  return (
    <MarketingOpsPageShell
      title="Recovery Campaign"
      subtitle="Dispute resolution workspace"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Recovery' },
      ]}
    >
      <RecoveryDetailClient campaignId={campaignId} />
    </MarketingOpsPageShell>
  );
}
