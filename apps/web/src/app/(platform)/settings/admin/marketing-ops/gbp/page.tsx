import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import GbpMonitorClient from './GbpMonitorClient';

export default function GbpMonitorPage() {
  return (
    <MarketingOpsPageShell
      title="GBP Monitor"
      subtitle="Cross-tenant Google Business Profile health — connections, verification, reviews, posts, and job status"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'GBP Monitor' },
      ]}
    >
      <GbpMonitorClient />
    </MarketingOpsPageShell>
  );
}
