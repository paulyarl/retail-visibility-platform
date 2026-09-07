import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import ProvingGroundsClient from './ProvingGroundsClient';

export default function ProvingGroundsPage() {
  return (
    <MarketingOpsPageShell
      title="Proving Grounds"
      subtitle="City/category proving grounds — preflight, cadence worklists, and funnel gates"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Proving Grounds' },
      ]}
    >
      <ProvingGroundsClient />
    </MarketingOpsPageShell>
  );
}
