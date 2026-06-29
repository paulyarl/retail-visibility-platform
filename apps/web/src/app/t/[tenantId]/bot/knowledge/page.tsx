import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SetTenantId from '@/components/client/SetTenantId';
import BotKnowledgePage from '@/components/bot/BotKnowledgePage';
import TenantBotPageShell from '@/components/bot/TenantBotPageShell';

export const metadata: Metadata = {
  title: 'Bot Knowledge Base',
  description: 'Manage FAQ and product embeddings for your chatbot',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function BotKnowledge({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <>
      <SetTenantId tenantId={tenantId} />
      <TenantBotPageShell
        tenantId={tenantId}
        title="Knowledge Base"
        subtitle="FAQ and product embedding status for your chatbot"
        breadcrumbs={[
          { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
          { label: 'Bot', href: `/t/${tenantId}/bot` },
          { label: 'Knowledge' },
        ]}
      >
        <BotKnowledgePage tenantId={tenantId} />
      </TenantBotPageShell>
    </>
  );
}
