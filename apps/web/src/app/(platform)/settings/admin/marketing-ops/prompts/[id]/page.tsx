import PromptWorkspaceClient from './PromptWorkspaceClient';

export default async function PromptWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PromptWorkspaceClient templateId={id} />;
}
