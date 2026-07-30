import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import MarketingOpsDashboardClient from './MarketingOpsDashboardClient';

export default function MarketingOpsDashboardPage() {
  return (
    <MarketingOpsPageShell
      title="Marketing Ops Dashboard"
      subtitle="Campaign and pipeline overview"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops' },
      ]}
    >
      <MarketingOpsDashboardClient />
    </MarketingOpsPageShell>
  );
}
