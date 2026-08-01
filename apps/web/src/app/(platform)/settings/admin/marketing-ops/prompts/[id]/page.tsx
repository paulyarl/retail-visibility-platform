import PromptWorkspaceClient from './PromptWorkspaceClient';

export default async function PromptWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ campaignId?: string }>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  return <PromptWorkspaceClient templateId={id} initialCampaignId={sp.campaignId} />;
}
