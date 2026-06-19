import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SetTenantId from '@/components/client/SetTenantId';
import BotSkillsPage from '@/components/bot/BotSkillsPage';
import TenantBotPageShell from '@/components/bot/TenantBotPageShell';

export const metadata: Metadata = {
  title: 'Bot Skills',
  description: 'Manage chatbot skills and their configuration',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function BotSkills({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <>
      <SetTenantId tenantId={tenantId} />
      <TenantBotPageShell
        tenantId={tenantId}
        title="Bot Skills"
        subtitle="Enable and configure chatbot skills"
        breadcrumbs={[
          { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
          { label: 'Bot', href: `/t/${tenantId}/bot` },
          { label: 'Skills' },
        ]}
      >
        <BotSkillsPage tenantId={tenantId} />
      </TenantBotPageShell>
    </>
  );
}
