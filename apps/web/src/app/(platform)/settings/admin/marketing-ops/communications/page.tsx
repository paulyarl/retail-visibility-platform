import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import ProspectCommunicationsClient from './ProspectCommunicationsClient';

interface PageProps {
  // ?prospect=<queueEntryId> prefills the selector on load (the openers /
  // follow-ups deep-link pattern).
  searchParams: Promise<{ prospect?: string }>;
}

export default async function ProspectCommunicationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <MarketingOpsPageShell
      title="Prospect Communications"
      subtitle="Full communication history for a prospect — pre-campaign touches through campaign outreach"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Prospect Communications' },
      ]}
    >
      <ProspectCommunicationsClient initialProspectId={params.prospect} />
    </MarketingOpsPageShell>
  );
}
