import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import ProspectQueueClient from './ProspectQueueClient';

export default function ProspectQueuePage() {
  return (
    <MarketingOpsPageShell
      title="Prospect Queue"
      subtitle="Capture and triage prospects from audits before creating campaigns"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Queue' },
      ]}
    >
      <ProspectQueueClient />
    </MarketingOpsPageShell>
  );
}
