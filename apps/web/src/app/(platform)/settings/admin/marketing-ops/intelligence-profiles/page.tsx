import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import IntelligenceProfilesClient from './IntelligenceProfilesClient';

export default function IntelligenceProfilesPage() {
  return (
    <MarketingOpsPageShell
      title="Intelligence Profiles"
      subtitle="Manage category intelligence profiles and non-business campaigns (category, city, intelligence scope)"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Intelligence Profiles' },
      ]}
    >
      <IntelligenceProfilesClient />
    </MarketingOpsPageShell>
  );
}
