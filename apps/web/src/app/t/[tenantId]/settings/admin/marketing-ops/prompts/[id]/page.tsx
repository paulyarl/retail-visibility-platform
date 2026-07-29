import PromptWorkspacePage from '@/app/(platform)/settings/admin/marketing-ops/prompts/[id]/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedPromptWorkspace({ params }: { params: Promise<{ tenantId: string; id: string }> }) {
  const { tenantId, id } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <PromptWorkspacePage params={{ id }} />
    </>
  );
}
