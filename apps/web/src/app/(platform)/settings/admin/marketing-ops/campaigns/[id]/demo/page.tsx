import DemoStorefrontClient from './DemoStorefrontClient';

export default async function DemoStorefrontPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DemoStorefrontClient campaignId={id} />;
}
