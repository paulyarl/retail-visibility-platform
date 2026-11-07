import { use } from 'react';
import LinkedInSettingsClient from '@/components/settings/LinkedInSettingsClient';

export default function LinkedInSettingsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  return <LinkedInSettingsClient tenantId={tenantId} />;
}
