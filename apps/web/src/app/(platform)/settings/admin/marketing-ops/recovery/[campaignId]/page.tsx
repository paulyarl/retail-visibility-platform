import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import RecoveryDetailClient from './RecoveryDetailClient';

export default function RecoveryDetailPage({ params }: { params: { campaignId: string } }) {
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
      <RecoveryDetailClient campaignId={params.campaignId} />
    </MarketingOpsPageShell>
  );
}
