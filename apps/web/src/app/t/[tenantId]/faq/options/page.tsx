import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import FaqOptionsPage from '@/components/faq/FaqOptionsPage';

export const metadata: Metadata = {
  title: 'FAQ Options - Store Settings',
  description: 'Configure FAQ scope, display, and knowledge base options for your store',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function FaqOptionsSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return <FaqOptionsPage tenantId={tenantId} />;
}
