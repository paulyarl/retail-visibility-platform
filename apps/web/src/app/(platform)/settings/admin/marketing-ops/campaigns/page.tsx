import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import CampaignListClient from './CampaignListClient';

interface PageProps {
  // proving_ground + stage support the cockpit's stage-distribution
  // drill-down (PG stage-culture fit §6.4). Optional — the tenant-scoped
  // wrapper at /t/[tenantId]/... renders this page without props.
  searchParams?: Promise<{ proving_ground?: string; stage?: string }>;
}

export default async function CampaignsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
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
      <CampaignListClient initialProvingGroundId={params.proving_ground} initialStage={params.stage} />
    </MarketingOpsPageShell>
  );
}
