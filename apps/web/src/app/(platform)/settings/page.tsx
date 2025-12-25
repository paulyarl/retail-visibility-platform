import PlatformSettings from '@/components/settings/PlatformSettings';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return <PlatformSettings />;
}
