import PlatformSettings from '@/components/admin/PlatformSettings';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function PlatformSettingsPage() {
  return <PlatformSettings />;
}
