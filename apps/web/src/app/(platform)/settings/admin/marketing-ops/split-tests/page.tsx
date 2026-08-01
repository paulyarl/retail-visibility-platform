import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import SplitTestsClient from './SplitTestsClient';

export default function SplitTestsPage() {
  return (
    <MarketingOpsPageShell
      title="Split Tests"
      subtitle="Cohort comparison for opener close-variant experiments"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Split Tests' },
      ]}
    >
      <SplitTestsClient />
    </MarketingOpsPageShell>
  );
}
