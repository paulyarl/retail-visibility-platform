import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SetTenantId from '@/components/client/SetTenantId';
import BotDashboardPage from '@/components/bot/BotDashboardPage';

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
      <BotDashboardPage tenantId={tenantId} />
    </>
  );
}
