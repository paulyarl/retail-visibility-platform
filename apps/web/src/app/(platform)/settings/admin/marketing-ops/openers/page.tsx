import OpenerWorkspaceClient from './OpenerWorkspaceClient';

interface PageProps {
  searchParams: Promise<{ campaign?: string; tab?: string }>;
}

export default async function OpenerWorkspacePage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <OpenerWorkspaceClient initialCampaignId={params.campaign} initialTab={params.tab} />;
}
