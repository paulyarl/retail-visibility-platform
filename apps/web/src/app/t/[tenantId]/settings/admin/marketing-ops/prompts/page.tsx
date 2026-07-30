import PromptLibraryPage from '@/app/(platform)/settings/admin/marketing-ops/prompts/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedPromptLibrary({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <PromptLibraryPage />
    </>
  );
}
