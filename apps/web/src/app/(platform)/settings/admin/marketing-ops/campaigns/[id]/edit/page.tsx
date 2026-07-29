import CampaignFormClient from '../../CampaignFormClient';

export default function EditCampaignPage({ params }: { params: { id: string } }) {
  return <CampaignFormClient mode="edit" campaignId={params.id} />;
}
