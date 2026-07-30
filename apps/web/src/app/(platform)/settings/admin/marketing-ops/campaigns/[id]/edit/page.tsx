import CampaignFormClient from '../../CampaignFormClient';

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CampaignFormClient mode="edit" campaignId={id} />;
}
