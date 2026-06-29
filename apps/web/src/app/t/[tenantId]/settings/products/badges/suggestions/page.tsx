import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import BadgeSuggestionsClient from './BadgeSuggestionsClient';

export const metadata: Metadata = {
  title: 'Badge Suggestions - Store Settings',
  description: 'Auto-promotion suggestions for product badges based on rules',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function BadgeSuggestionsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return <BadgeSuggestionsClient tenantId={tenantId} />;
}
