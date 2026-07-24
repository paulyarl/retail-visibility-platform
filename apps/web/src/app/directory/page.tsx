import { Suspense } from 'react';
import type { Metadata } from 'next';
import { platformSettingsService } from '@/services/PlatformSettingsSingletonService';
import { resolveDirectoryLayout, type DirectoryLayoutKey } from '@/components/directory/redesign/types';
import DirectoryShell from '@/components/directory/redesign/layouts/DirectoryShell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'VisibleShelf Directory - Find Local Stores & Products',
  description:
    'Discover local businesses and their products in the VisibleShelf directory. Browse stores by category, location, and store type.',
  openGraph: {
    title: 'VisibleShelf Directory - Find Local Stores & Products',
    description:
      'Discover local businesses and their products in the VisibleShelf directory.',
    type: 'website',
    images: [{ url: '/favicon.ico' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VisibleShelf Directory - Find Local Stores & Products',
    description:
      'Discover local businesses and their products in the VisibleShelf directory.',
    images: [{ url: '/favicon.ico' }],
  },
};

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ layout_preview?: string }>;
}) {
  const params = await searchParams;

  // Read stored layout from platform settings
  let storedLayout: string | null = null;
  try {
    const settings = await platformSettingsService.getPlatformSettings();
    storedLayout = (settings.features?.directoryHomeLayout as string) || null;
  } catch {
    // fall back to default
  }

  const layoutKey: DirectoryLayoutKey = resolveDirectoryLayout(
    storedLayout,
    params.layout_preview,
  );

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-neutral-400">Loading directory...</p>
          </div>
        </div>
      }
    >
      <DirectoryShell layoutKey={layoutKey} />
    </Suspense>
  );
}
