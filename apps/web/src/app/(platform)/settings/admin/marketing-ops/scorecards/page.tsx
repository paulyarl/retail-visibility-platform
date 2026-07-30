import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import ScorecardClient from './ScorecardClient';

export default function ScorecardsPage() {
  return (
    <MarketingOpsPageShell
      title="Scorecards"
      subtitle="Performance and scorecards"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Scorecards' },
      ]}
    >
      <ScorecardClient />
    </MarketingOpsPageShell>
  );
}
