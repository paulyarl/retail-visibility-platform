import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import FollowUpWorkspaceClient from './FollowUpWorkspaceClient';

export default function FollowUpsPage() {
  return (
    <MarketingOpsPageShell
      title="Follow-Ups"
      subtitle="Follow-up message generation for prospects who didn't reply to the opener"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Follow-Ups' },
      ]}
    >
      <FollowUpWorkspaceClient />
    </MarketingOpsPageShell>
  );
}
