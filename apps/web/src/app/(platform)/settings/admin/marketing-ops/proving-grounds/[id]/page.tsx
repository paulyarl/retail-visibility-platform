import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import ProvingGroundCockpitClient from './ProvingGroundCockpitClient';

export default function ProvingGroundPage({ params }: { params: { id: string } }) {
  return (
    <MarketingOpsPageShell
      title="Proving Ground"
      subtitle="City/category proving ground — preflight, cadence worklist, funnel gates"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Proving Ground' },
      ]}
    >
      <ProvingGroundCockpitClient campaignId={params.id} />
    </MarketingOpsPageShell>
  );
}
