'use client';

import { useEffect } from 'react';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';

export default function DynamicFavicon() {
  const { settings } = usePlatformSettings();

  useEffect(() => {
    if (settings?.faviconUrl) {
      // Update favicon
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = settings.faviconUrl;
    }

    // Update page title
    if (settings?.platformName) {
      document.title = settings.platformName;
    }
  }, [settings]);

  return null;
}
