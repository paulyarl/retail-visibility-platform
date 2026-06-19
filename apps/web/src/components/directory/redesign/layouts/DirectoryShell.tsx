'use client';

/**
 * DirectoryShell — client wrapper that runs useDirectoryData() and
 * renders the correct layout variant based on the resolved key.
 *
 * This is the single entry point for all three variants.
 * The server component (page.tsx) resolves the layout key and passes it here.
 */

import { useDirectoryData } from '../useDirectoryData';
import type { DirectoryLayoutKey } from '../types';
import DirectoryDiscoveryLayout from './DirectoryDiscoveryLayout';
import DirectoryEditorialLayout from './DirectoryEditorialLayout';
import DirectoryImmersiveLayout from './DirectoryImmersiveLayout';

export default function DirectoryShell({
  layoutKey,
}: {
  layoutKey: DirectoryLayoutKey;
}) {
  const data = useDirectoryData();

  switch (layoutKey) {
    case 'editorial':
      return <DirectoryEditorialLayout data={data} variant="editorial" />;
    case 'immersive':
      return <DirectoryImmersiveLayout data={data} variant="immersive" />;
    case 'discovery':
    default:
      return <DirectoryDiscoveryLayout data={data} variant="discovery" />;
  }
}
