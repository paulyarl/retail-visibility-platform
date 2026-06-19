import { Suspense } from 'react';
import { platformSettingsService } from '@/services/PlatformSettingsSingletonService';
import { resolveDirectoryLayout, type DirectoryLayoutKey } from '@/components/directory/redesign/types';
import DirectoryShell from '@/components/directory/redesign/layouts/DirectoryShell';

export const dynamic = 'force-dynamic';

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
