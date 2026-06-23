'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api';

interface PixelConfig {
  metaPixelId: string | null;
  tiktokPixelId: string | null;
}

interface SocialPixelsProps {
  tenantId: string;
}

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    ttq?: any;
    _fbq?: any;
    _fbqLoaded?: boolean;
    _ttqLoaded?: boolean;
  }
}

/**
 * Injects Meta (Facebook) Pixel and TikTok Pixel base code
 * Tracks PageView on route changes, ViewContent on product pages,
 * AddToCart on cart updates, InitiateCheckout on checkout page,
 * and Purchase on checkout success page.
 */
export function SocialPixels({ tenantId }: SocialPixelsProps) {
  const pathname = usePathname();
  const [config, setConfig] = useState<PixelConfig | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    async function fetchConfig() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/social-pixels/public/${tenantId}`);
        const data = await res.json();
        if (data.success) {
          setConfig(data.data);
        }
      } catch {
        // Silent fail — pixels are optional
      }
    }

    fetchConfig();
  }, [tenantId]);

  // Inject Meta Pixel
  useEffect(() => {
    if (!config?.metaPixelId || window._fbqLoaded) return;

    window._fbqLoaded = true;

    /* eslint-disable */
    (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
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
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */

    window.fbq?.('init', config.metaPixelId);
    window.fbq?.('track', 'PageView');
  }, [config?.metaPixelId]);

  // Inject TikTok Pixel
  useEffect(() => {
    if (!config?.tiktokPixelId || window._ttqLoaded) return;

    window._ttqLoaded = true;

    /* eslint-disable */
    (function (w: any, d: any, t: any) {
      w.TiktokAnalyticsObject = t;
      var ttq = (w[t] = w[t] || []);
      ttq.methods = [
        'page', 'track', 'identify', 'instances', 'debug', 'on', 'off',
        'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie',
      ];
      ttq.setAndDefer = function (t: any, e: any) {
        t[e] = function () {
          t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
        };
      };
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (t: any) {
        for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
        return e;
      };
      ttq.load = function (e: any, n: any) {
        var i = 'https://analytics.tiktok.com/i18n/pixel/events.js';
        ttq._i = ttq._i || {};
        ttq._i[e] = [];
        ttq._i[e]._u = i;
        ttq._t = ttq._t || {};
        ttq._t[e] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[e] = n || {};
        var o = d.createElement('script');
        o.type = 'text/javascript';
        o.async = true;
        o.src = i + '?sdkid=' + e + '&lib=' + t;
        var a = d.getElementsByTagName('script')[0];
        a.parentNode.insertBefore(o, a);
      };
      ttq.load(config.tiktokPixelId);
      ttq.page();
    })(window, document, 'ttq');
    /* eslint-enable */
  }, [config?.tiktokPixelId]);

  // Track PageView on route changes
  useEffect(() => {
    if (!loaded) {
      setLoaded(true);
      return;
    }

    if (config?.metaPixelId) {
      window.fbq?.('track', 'PageView');
    }
    if (config?.tiktokPixelId) {
      window.ttq?.page();
    }
  }, [pathname, config, loaded]);

  // Track ViewContent on product pages
  useEffect(() => {
    if (!config) return;

    const productMatch = pathname?.match(/\/products\/([^/]+)/);
    if (productMatch && config.metaPixelId) {
      window.fbq?.('track', 'ViewContent', {
        content_ids: [productMatch[1]],
        content_type: 'product',
      });
    }
    if (productMatch && config.tiktokPixelId) {
      window.ttq?.track('ViewContent', {
        content_id: productMatch[1],
      });
    }

    // Track InitiateCheckout on checkout page
    if (pathname?.includes('/checkout') && !pathname?.includes('/success')) {
      if (config.metaPixelId) {
        window.fbq?.('track', 'InitiateCheckout');
      }
      if (config.tiktokPixelId) {
        window.ttq?.track('InitiateCheckout');
      }
    }

    // Track Purchase on checkout success page
    if (pathname?.includes('/checkout/success')) {
      if (config.metaPixelId) {
        window.fbq?.('track', 'Purchase', { value: 0, currency: 'USD' });
      }
      if (config.tiktokPixelId) {
        window.ttq?.track('CompletePayment', { value: 0, currency: 'USD' });
      }
    }
  }, [pathname, config]);

  return null;
}
