import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import GalleryDashboardClient from './GalleryDashboardClient';

export default function GalleryDashboardPage() {
  return (
    <MarketingOpsPageShell
      title="Gallery Analytics Dashboard"
      subtitle="Cross-campaign diagnostic gallery engagement"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Gallery Dashboard' },
      ]}
    >
      <GalleryDashboardClient />
    </MarketingOpsPageShell>
  );
}
