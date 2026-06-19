import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SetTenantId from '@/components/client/SetTenantId';
import BotWidgetSetupPage from '@/components/bot/BotWidgetSetupPage';
import TenantBotPageShell from '@/components/bot/TenantBotPageShell';

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
      <TenantBotPageShell
        tenantId={tenantId}
        title="Widget Setup"
        subtitle="Embed the chatbot widget on your storefront"
        breadcrumbs={[
          { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
          { label: 'Bot', href: `/t/${tenantId}/bot` },
          { label: 'Widget' },
        ]}
      >
        <BotWidgetSetupPage tenantId={tenantId} />
      </TenantBotPageShell>
    </>
  );
}
