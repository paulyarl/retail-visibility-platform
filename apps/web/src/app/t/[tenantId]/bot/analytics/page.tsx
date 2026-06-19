import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SetTenantId from '@/components/client/SetTenantId';
import BotAnalyticsPage from '@/components/bot/BotAnalyticsPage';
import TenantBotPageShell from '@/components/bot/TenantBotPageShell';

export const metadata: Metadata = {
  title: 'Bot Analytics',
  description: 'Chatbot performance analytics and insights',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function BotAnalytics({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <>
      <SetTenantId tenantId={tenantId} />
      <TenantBotPageShell
        tenantId={tenantId}
        title="Bot Analytics"
        subtitle="Performance metrics and insights"
        breadcrumbs={[
          { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
          { label: 'Bot', href: `/t/${tenantId}/bot` },
          { label: 'Analytics' },
        ]}
      >
        <BotAnalyticsPage tenantId={tenantId} />
      </TenantBotPageShell>
    </>
  );
}
