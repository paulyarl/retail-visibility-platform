'use client';

import { useEffect, useState } from 'react';
import { AnimatedCard } from '@/components/ui';
import { Button } from '@mantine/core';
import { generateQrDataUrl } from '@/lib/qr-engine';
import { platformSettingsService } from '@/services/PlatformSettingsSingletonService';
import { trackBehaviorClient } from '@/utils/behaviorTracking';

/**
 * Storefront demo panel — "Same store, three doors."
 *
 * Demos the canonical ladder with a real professional-tier tenant (Place
 * Shelf, tid-25we5qgj): the SAME storefront reachable on the platform path,
 * a platform subdomain, and a custom domain. Each door carries a branded QR
 * resolving to that host form — scan any of the three, the same store
 * appears on the visitor's own device.
 *
 * Pioneer recruitment context: docs/LocalBiz/PIONEER_RECRUITMENT_SPEC.md §3.
 */

const DEMO_TENANT_ID = 'tid-25we5qgj';
const PLATFORM_ORIGIN = 'https://visibleshelf.com';

interface DemoDoor {
  key: string;
  label: string;
  hint: string;
  /** Absolute URL the QR resolves to and the link targets. */
  url: string;
}

const DOORS: DemoDoor[] = [
  {
    key: 'platform',
    label: 'On the platform',
    hint: 'visibleshelf.com/tenant/your-store',
    url: `${PLATFORM_ORIGIN}/tenant/${DEMO_TENANT_ID}`,
  },
  {
    key: 'subdomain',
    label: 'On a subdomain',
    hint: 'yourstore.visibleshelf.com',
    url: 'https://place-shelf.visibleshelf.com',
  },
  {
    key: 'domain',
    label: 'On your own web address',
    hint: 'like www.yourstore.com',
    url: 'https://placeshelf.store',
  },
];

export function StorefrontDemoPanel() {
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Platform logo resolves like the QR designer's default — the uploaded
  // platform_settings logo, not a static icon path.
  useEffect(() => {
    let cancelled = false;
    platformSettingsService
      .getPlatformSettings()
      .then((s) => {
        if (!cancelled) setLogoUrl(s?.logoUrl ?? null);
      })
      .catch(() => {
        if (!cancelled) setLogoUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        DOORS.map(async (door) => {
          try {
            const dataUrl = await generateQrDataUrl({
              data: door.url,
              exportSize: 480,
              styled: true,
              logoUrl,
              logoShape: 'circle',
            });
            return [door.key, dataUrl] as const;
          } catch {
            return [door.key, null] as const;
          }
        }),
      );
      if (!cancelled) {
        const map: Record<string, string> = {};
        for (const [key, url] of entries) if (url) map[key] = url;
        setQrs(map);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  return (
    <AnimatedCard delay={0.7} hover={true} className="mt-8 overflow-hidden">
      <div className="relative bg-gradient-to-br from-teal-600 via-cyan-600 to-sky-700 p-8 md:p-12">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-semibold mb-4">
              <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse"></span>
              Live demo
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              One store, three doors
            </h2>
            <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
              The same storefront on the platform, on its own subdomain, and on
              its own domain. Scan any code — the same store opens on your
              phone. Start on the platform, grow into your own address.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {DOORS.map((door) => (
              <a
                key={door.key}
                href={door.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackBehaviorClient({
                    entityType: 'platform',
                    entityId: `home_demo_door_${door.key}`,
                    entityName: `Demo door: ${door.label}`,
                    pageType: 'platform_home',
                  })
                }
                className="group bg-white/10 backdrop-blur-sm border-2 border-white/30 rounded-2xl p-5 text-center hover:bg-white/20 transition-all duration-200"
              >
                <div className="w-32 h-32 mx-auto mb-4 bg-white rounded-xl flex items-center justify-center overflow-hidden">
                  {qrs[door.key] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrs[door.key]}
                      alt={`QR code for ${door.label}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                <h3 className="text-white font-bold text-lg mb-1">{door.label}</h3>
                <p className="text-white/80 text-xs mb-3 break-all">{door.hint}</p>
                <span className="inline-flex items-center text-white text-sm font-semibold group-hover:underline">
                  Open this door
                  <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </a>
            ))}
          </div>

          <div className="text-center mt-8">
            <p className="text-white/80 text-sm mb-4">
              Real tenant. Real storefront. Every capability module on display.
            </p>
            <a
              href={`${PLATFORM_ORIGIN}/tenant/${DEMO_TENANT_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackBehaviorClient({
                  entityType: 'platform',
                  entityId: 'home_demo_see_live',
                  entityName: 'See a live storefront',
                  pageType: 'platform_home',
                })
              }
            >
              <Button
                variant="gradient"
                style={{ color: 'white' }}
                size="lg"
                className="bg-white text-teal-700 hover:bg-gray-50 shadow-xl font-bold px-8 py-6"
              >
                See a live storefront
              </Button>
            </a>
          </div>
        </div>
      </div>
    </AnimatedCard>
  );
}
