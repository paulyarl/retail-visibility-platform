import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import BrandingConfigClient from './BrandingConfigClient';

export default function BrandingPage() {
  return (
    <MarketingOpsPageShell
      title="Branding"
      subtitle="Brand asset configuration"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Branding' },
      ]}
    >
      <BrandingConfigClient />
    </MarketingOpsPageShell>
  );
}
