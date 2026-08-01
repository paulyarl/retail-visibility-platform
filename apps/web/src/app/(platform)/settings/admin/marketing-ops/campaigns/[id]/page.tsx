import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import CampaignDetailClient from './CampaignDetailClient';

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <MarketingOpsPageShell
      title="Campaign Details"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Campaigns', href: '/settings/admin/marketing-ops/campaigns' },
        { label: 'Details' },
      ]}
    >
      <CampaignDetailClient campaignId={id} />
    </MarketingOpsPageShell>
  );
}
