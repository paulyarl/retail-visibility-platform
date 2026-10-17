'use client';

/**
 * FlyerShareKit — caption + QR share assets (spec §4.3 share kit).
 *
 * Customer QR resolves the stable always-current flyer URL; the merchant QR
 * links back to this settings page (auth-gated) for managing specials.
 */

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Copy, Download, QrCode, Share2 } from 'lucide-react';
import { flyerService, type TenantFlyer, type FlyerShareAssets } from '@/services/FlyerService';
import { generateQrDataUrl } from '@/lib/qr-engine';
import { clientLogger } from '@/lib/client-logger';

interface Props {
  tenantId: string;
  flyer: TenantFlyer | null;
  onClose: () => void;
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export default function FlyerShareKit({ tenantId, flyer, onClose }: Props) {
  const [assets, setAssets] = useState<FlyerShareAssets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerQr, setCustomerQr] = useState<string | null>(null);
  const [merchantQr, setMerchantQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'caption' | null>(null);

  useEffect(() => {
    if (!flyer) { setAssets(null); setCustomerQr(null); setMerchantQr(null); return; }
    let cancelled = false;
    setAssets(null); setError(null);
    (async () => {
      try {
        const a = await flyerService.getShareAssets(tenantId, flyer.id);
        if (cancelled) return;
        setAssets(a);
        const opts = { exportSize: 240, styled: false as const, errorCorrection: 'M' as const };
        const [cq, mq] = await Promise.all([
          a.qrPayloadCustomer ? generateQrDataUrl({ data: a.qrPayloadCustomer, ...opts }) : Promise.resolve(null),
          a.qrPayloadMerchant ? generateQrDataUrl({ data: a.qrPayloadMerchant, ...opts }) : Promise.resolve(null),
        ]);
        if (!cancelled) { setCustomerQr(cq); setMerchantQr(mq); }
      } catch (err) {
        clientLogger.error('[FlyerShareKit] failed to load share assets', { detail: err });
        if (!cancelled) setError('Failed to load share assets');
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId, flyer]);

  const copy = async (text: string, which: 'link' | 'caption') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <Modal isOpen={!!flyer} onClose={onClose} title={`Share "${flyer?.title ?? 'flyer'}"`} size="lg">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!assets && !error && <p className="text-sm text-neutral-500">Loading share assets…</p>}
      {assets && (
        <div className="space-y-5">
          {/* Link */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Flyer link — always shows your current specials</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-neutral-100 dark:bg-neutral-800 rounded px-2 py-1.5 truncate">{assets.stableUrl ?? assets.url}</code>
              <Button variant="outline" size="sm" onClick={() => copy(assets.stableUrl ?? assets.url, 'link')}>
                <Copy className="w-3.5 h-3.5 mr-1" />{copied === 'link' ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Caption */}
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Caption — ready for WhatsApp / socials</p>
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
              <p className="text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap">{assets.caption}</p>
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => copy(assets.caption, 'caption')}>
              <Copy className="w-3.5 h-3.5 mr-1" />{copied === 'caption' ? 'Copied' : 'Copy caption'}
            </Button>
          </div>

          {/* QR pair */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 text-center">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Customer card (front)</p>
              {customerQr ? (
                <img src={customerQr} alt="Customer QR" className="mx-auto rounded" width={180} height={180} />
              ) : (
                <div className="h-[180px] flex items-center justify-center text-neutral-400"><QrCode className="w-8 h-8" /></div>
              )}
              <p className="text-xs text-neutral-500 mt-2">Scan → your live specials</p>
              {customerQr && (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => downloadDataUrl(customerQr, `flyer-${flyer?.id}-customer-qr.png`)}>
                  <Download className="w-3.5 h-3.5 mr-1" />Download
                </Button>
              )}
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 text-center">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Merchant card (back)</p>
              {merchantQr ? (
                <img src={merchantQr} alt="Merchant QR" className="mx-auto rounded" width={180} height={180} />
              ) : (
                <div className="h-[180px] flex items-center justify-center text-neutral-400"><QrCode className="w-8 h-8" /></div>
              )}
              <p className="text-xs text-neutral-500 mt-2">Scan → manage specials / reorder cards</p>
              {merchantQr && (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => downloadDataUrl(merchantQr, `flyer-${flyer?.id}-merchant-qr.png`)}>
                  <Download className="w-3.5 h-3.5 mr-1" />Download
                </Button>
              )}
            </div>
          </div>

          <p className="text-xs text-neutral-400 flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5" />
            The link and QR always resolve to whatever flyer is live right now — print once, reuse every week.
          </p>
        </div>
      )}
    </Modal>
  );
}
