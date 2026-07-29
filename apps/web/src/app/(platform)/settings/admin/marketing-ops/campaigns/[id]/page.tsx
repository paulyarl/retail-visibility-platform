import CampaignDetailClient from './CampaignDetailClient';

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  return <CampaignDetailClient campaignId={params.id} />;
}
