import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import FilterReviewClient from './FilterReviewClient';

export default function FilterReviewPage() {
  return (
    <MarketingOpsPageShell
      title="Filter Review"
      subtitle="Review and approve filters"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Filter Review' },
      ]}
    >
      <FilterReviewClient />
    </MarketingOpsPageShell>
  );
}
