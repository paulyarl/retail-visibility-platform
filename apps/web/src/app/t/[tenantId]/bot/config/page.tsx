import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SetTenantId from '@/components/client/SetTenantId';
import BotConfigPage from '@/components/bot/BotConfigPage';

export const metadata: Metadata = {
  title: 'Bot Configuration',
  description: 'Configure your chatbot name, tone, greeting, and widget appearance',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function BotConfig({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <>
      <SetTenantId tenantId={tenantId} />
      <BotConfigPage tenantId={tenantId} />
    </>
  );
}
