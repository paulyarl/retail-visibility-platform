import { Suspense } from 'react';
import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import PromptLibraryClient from './PromptLibraryClient';

export default function PromptLibraryPage() {
  return (
    <MarketingOpsPageShell
      title="Prompts"
      subtitle="AI prompt library"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Prompts' },
      ]}
    >
      <Suspense fallback={null}>
        <PromptLibraryClient />
      </Suspense>
    </MarketingOpsPageShell>
  );
}
