import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import RecoveryTabClient from '../RecoveryTabClient';

export default function RecoveryListPage() {
  return (
    <MarketingOpsPageShell
      title="Recovery Management"
      subtitle="Dispute resolution campaigns grouped by stage"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Recovery' },
      ]}
    >
      <RecoveryTabClient />
    </MarketingOpsPageShell>
  );
}
