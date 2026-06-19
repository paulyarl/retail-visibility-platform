import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SetTenantId from '@/components/client/SetTenantId';
import BotDashboardPage from '@/components/bot/BotDashboardPage';
import TenantBotPageShell from '@/components/bot/TenantBotPageShell';

export const metadata: Metadata = {
  title: 'Bot Dashboard',
  description: 'Chatbot overview, stats, and recent conversations',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function BotDashboard({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <>
      <SetTenantId tenantId={tenantId} />
      <TenantBotPageShell
        tenantId={tenantId}
        title="Bot Dashboard"
        subtitle="Monitor and manage your chatbot"
        breadcrumbs={[
          { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
          { label: 'Bot' },
        ]}
      >
        <BotDashboardPage tenantId={tenantId} />
      </TenantBotPageShell>
    </>
  );
}
