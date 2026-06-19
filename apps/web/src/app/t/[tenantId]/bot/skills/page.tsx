import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SetTenantId from '@/components/client/SetTenantId';
import BotSkillsPage from '@/components/bot/BotSkillsPage';

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
      <BotSkillsPage tenantId={tenantId} />
    </>
  );
}
