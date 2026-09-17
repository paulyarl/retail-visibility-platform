import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import BronzeCatalogClient from './BronzeCatalogClient';

export default function BronzeCatalogPage() {
  return (
    <MarketingOpsPageShell
      title="Bronze Reason Catalog"
      subtitle="Discovery blind spots the bronze standard hunts — author, scope, and deprecate reasons; check profile coverage gaps; probe a single reason."
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Bronze Catalog' },
      ]}
    >
      <BronzeCatalogClient />
    </MarketingOpsPageShell>
  );
}
