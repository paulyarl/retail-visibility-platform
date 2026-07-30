import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import DeliverableTemplateLibraryClient from './DeliverableTemplateLibraryClient';

export default function DeliverableTemplatesPage() {
  return (
    <MarketingOpsPageShell
      title="Deliverable Templates"
      subtitle="Reusable content templates"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Deliverable Templates' },
      ]}
    >
      <DeliverableTemplateLibraryClient />
    </MarketingOpsPageShell>
  );
}
