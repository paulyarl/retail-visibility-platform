import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import CampaignListClient from './CampaignListClient';

export default function CampaignsPage() {
  return (
    <MarketingOpsPageShell
      title="Campaigns"
      subtitle="Manage marketing campaigns"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Campaigns' },
      ]}
    >
      <CampaignListClient />
    </MarketingOpsPageShell>
  );
}
