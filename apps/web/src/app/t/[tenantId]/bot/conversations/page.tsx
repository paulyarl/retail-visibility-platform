import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SetTenantId from '@/components/client/SetTenantId';
import BotConversationsPage from '@/components/bot/BotConversationsPage';
import TenantBotPageShell from '@/components/bot/TenantBotPageShell';

export const metadata: Metadata = {
  title: 'Bot Conversations',
  description: 'View and manage chatbot conversations',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function BotConversations({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <>
      <SetTenantId tenantId={tenantId} />
      <TenantBotPageShell
        tenantId={tenantId}
        title="Conversations"
        subtitle="Browse and review chatbot conversations"
        breadcrumbs={[
          { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
          { label: 'Bot', href: `/t/${tenantId}/bot` },
          { label: 'Conversations' },
        ]}
      >
        <BotConversationsPage tenantId={tenantId} />
      </TenantBotPageShell>
    </>
  );
}
