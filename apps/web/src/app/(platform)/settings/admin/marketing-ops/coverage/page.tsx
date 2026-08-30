import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import CoverageClient from './CoverageClient';

export default function CoveragePage() {
  return (
    <MarketingOpsPageShell
      title="Intelligence Coverage"
      subtitle="Profile coverage map — see which categories have active intelligence profiles, which have gaps, and fill them in the right order."
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Coverage' },
      ]}
    >
      <CoverageClient />
    </MarketingOpsPageShell>
  );
}
