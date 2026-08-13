import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import CampaignDetailClient from './CampaignDetailClient';

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; focus?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
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
      <CampaignDetailClient campaignId={id} initialTab={query.tab} focusStage={query.focus} />
    </MarketingOpsPageShell>
  );
}
