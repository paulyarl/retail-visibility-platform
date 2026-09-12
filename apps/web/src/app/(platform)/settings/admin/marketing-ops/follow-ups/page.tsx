import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import FollowUpWorkspaceClient from './FollowUpWorkspaceClient';

interface PageProps {
  // ?campaign=<id> prefills the campaign dropdown on load — the openers
  // deep-link pattern, used by the PG cockpit's artifact chips (§6.4).
  searchParams: Promise<{ campaign?: string }>;
}

export default async function FollowUpsPage({ searchParams }: PageProps) {
  const params = await searchParams;
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
      <FollowUpWorkspaceClient initialCampaignId={params.campaign} />
    </MarketingOpsPageShell>
  );
}
