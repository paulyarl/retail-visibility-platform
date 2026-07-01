import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SetTenantId from '@/components/client/SetTenantId';
import BotConfigPage from '@/components/bot/BotConfigPage';
import TenantBotPageShell from '@/components/bot/TenantBotPageShell';
import { TenantGuard } from '@/components/tenant/TenantGuard';

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
    <TenantGuard tenantId={tenantId}>
      <SetTenantId tenantId={tenantId} />
      <TenantBotPageShell
        tenantId={tenantId}
        title="Bot Configuration"
        subtitle="Customize your chatbot's behavior and appearance"
        breadcrumbs={[
          { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
          { label: 'Bot', href: `/t/${tenantId}/bot` },
          { label: 'Config' },
        ]}
      >
        <BotConfigPage tenantId={tenantId} />
      </TenantBotPageShell>
    </TenantGuard>
  );
}
