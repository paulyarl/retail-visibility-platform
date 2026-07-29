import DemoStorefrontClient from './DemoStorefrontClient';

export default function DemoStorefrontPage({ params }: { params: { id: string } }) {
  return <DemoStorefrontClient campaignId={params.id} />;
}
