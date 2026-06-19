import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SetTenantId from '@/components/client/SetTenantId';
import BotOptionsPage from '@/components/bot/BotOptionsPage';

export const metadata: Metadata = {
  title: 'Chatbot Options',
  description: 'Toggle chatbot features and capabilities for your tier',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function BotOptions({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <>
      <SetTenantId tenantId={tenantId} />
      <BotOptionsPage tenantId={tenantId} />
    </>
  );
}
