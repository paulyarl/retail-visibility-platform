import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SetTenantId from '@/components/client/SetTenantId';
import BotWidgetSetupPage from '@/components/bot/BotWidgetSetupPage';

export const metadata: Metadata = {
  title: 'Bot Widget Setup',
  description: 'Embed the chatbot widget on your storefront',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function BotWidgetSetup({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <>
      <SetTenantId tenantId={tenantId} />
      <BotWidgetSetupPage tenantId={tenantId} />
    </>
  );
}
