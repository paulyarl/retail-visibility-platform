'use client';

import { TenantQRCode } from '@/components/public/TenantQRCode';

export interface ClaimedReportCtaProps {
  /** The originating seed — the report lives at /seed-report/{seedId}. */
  seedId: string;
  /** Claimed tenant — its storefront_qr capabilities govern the QR render
   *  (styled variant, logo, gradients) per the resolved tier. */
  tenantId: string;
  /** Absolute origin used to encode the tracked URL in the QR. */
  baseUrl: string;
  downloadName?: string;
  /** Dark-section variant (immersive layout). */
  dark?: boolean;
  className?: string;
}

/**
 * ClaimedReportCta — the post-claim report surface on /directory/{slug}.
 *
 * The prospect's second report (the claimed/published seed report) stays
 * reachable through the same tracked redirect family: the CTA + QR encode
 * /api/public/r/seed/{seedId}/claimed, which records a `report_claimed`
 * scan — its own surface, outside both the pre-claim `report_banner`
 * surface and the operator `report_delivery_*` funnel — then 302s to the
 * report.
 *
 * The QR renders through TenantQRCode so the claimed tenant's storefront_qr
 * merchant preferences apply — including any design the operator persisted
 * on the tenant's row from the seed designer — gated by the claimed tier's
 * effective capabilities. The wrapping layout supplies the card chrome.
 */
export function ClaimedReportCta({
  seedId,
  tenantId,
  baseUrl,
  downloadName,
  dark = false,
  className = '',
}: ClaimedReportCtaProps) {
  const trackedPath = `/api/public/r/seed/${seedId}/claimed`;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <h3 className={`text-lg font-semibold mb-1 ${dark ? 'text-white' : 'text-neutral-900'}`}>
        Business report
      </h3>
      <p className={`text-sm text-center mb-4 ${dark ? 'text-gray-400' : 'text-neutral-600'}`}>
        See how this business shows up across public directories — the full VisibleShelf report.
      </p>
      <TenantQRCode
        url={`${baseUrl}${trackedPath}`}
        tenantId={tenantId}
        label="Scan for the report"
        downloadName={downloadName}
        size={160}
        showDownload={false}
        pageType="directory"
        isPublic
      />
      {/* Plain anchor — the tracked path is an API redirect, not an app route
          (next/link would issue RSC navigation + prefetch phantom scans). */}
      <a
        href={trackedPath}
        className={`mt-3 text-sm font-medium hover:underline ${dark ? 'text-sky-400' : 'text-blue-600'}`}
      >
        View the report →
      </a>
    </div>
  );
}

export default ClaimedReportCta;
