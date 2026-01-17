import { Metadata } from 'next';
import PlatformSettings from '@/components/admin/PlatformSettings';

export const metadata: Metadata = {
  title: 'Platform Settings - Admin',
  description: 'Platform-wide configuration and settings',
};

export default function PlatformSettingsPage() {
  return <PlatformSettings />;
}
