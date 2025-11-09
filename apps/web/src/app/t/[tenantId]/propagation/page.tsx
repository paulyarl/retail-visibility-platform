import PropagationHub from '@/components/propagation/PropagationHub';

export default async function PropagationPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  
  return <PropagationHub tenantId={tenantId} />;
}
