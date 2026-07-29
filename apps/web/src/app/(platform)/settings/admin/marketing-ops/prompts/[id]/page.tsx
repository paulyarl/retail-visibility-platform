import PromptWorkspaceClient from './PromptWorkspaceClient';

export default function PromptWorkspacePage({ params }: { params: { id: string } }) {
  return <PromptWorkspaceClient templateId={params.id} />;
}
