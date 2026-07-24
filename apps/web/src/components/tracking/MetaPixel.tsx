'use client';

import { useEffect } from 'react';

// Window.fbq types are declared in SocialPixels.tsx.

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/**
 * Meta (Facebook/Instagram) Pixel base loader.
 *
 * Loads `fbevents.js` and fires `PageView` once per session when
 * `NEXT_PUBLIC_META_PIXEL_ID` is configured. Noops otherwise.
 */
export function MetaPixel() {
  useEffect(() => {
    if (typeof window === 'undefined' || !META_PIXEL_ID) return;
    if (window.fbq) return;

    (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
      if (f.fbq) return;
      n = f.fbq = function (...args: any[]) {
        if (n.callMethod) n.callMethod.apply(n, args);
        else n.queue.push(args);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      if (s && s.parentNode) s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    (window as any).fbq?.('init', META_PIXEL_ID);
    (window as any).fbq?.('track', 'PageView');
  }, []);

  if (!META_PIXEL_ID) return null;

  return (
    <noscript>
      <img
        height="1"
        width="1"
        style={{ display: 'none' }}
        src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        alt=""
      />
    </noscript>
  );
}

/**
 * Fire a standard or custom Meta Pixel event from any client component.
 */
export function metaTrack(event: string, params?: Record<string, any>) {
  if (typeof window === 'undefined' || !window.fbq) return;
  const fbq = (window as any).fbq;
  if (params) {
    fbq?.('track', event, params);
  } else {
    fbq?.('track', event);
  }
}
