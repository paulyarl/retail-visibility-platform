import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SetTenantId from '@/components/client/SetTenantId';
import BotAnalyticsPage from '@/components/bot/BotAnalyticsPage';

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
      <BotAnalyticsPage tenantId={tenantId} />
    </>
  );
}
