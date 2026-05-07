import PlatformSettings from '@/components/settings/PlatformSettings';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return <PlatformSettings />;
}
