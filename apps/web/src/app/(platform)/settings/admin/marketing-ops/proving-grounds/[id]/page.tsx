import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import ProvingGroundCockpitClient from './ProvingGroundCockpitClient';

export default async function ProvingGroundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
      <ProvingGroundCockpitClient campaignId={id} />
    </MarketingOpsPageShell>
  );
}
