import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import PlaybookCatalogClient from './PlaybookCatalogClient';

export default function PlaybooksPage() {
  return (
    <MarketingOpsPageShell
      title="Playbook Catalog"
      subtitle="Triage engine rules, signal registry, and cascade ordering"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Playbooks' },
      ]}
    >
      <PlaybookCatalogClient />
    </MarketingOpsPageShell>
  );
}
