'use client';

/**
 * SeedPreviewOwnerContact — D-1 owner contact path on demo storefronts.
 * Renders the banner's "Own this business?" line as a toggle that expands
 * the shared anonymous PublicInquiryForm (math CAPTCHA + honeypot).
 *
 * The inquiry posts to /api/public/inquiries with tenant_id='platform' (same
 * routing as the /place claim form) and preview_slug=<shop slug>; the API
 * resolves the seed_preview demo tenant → source seed, appends claim context
 * (seed id + admin review link) to the inquiry body, and logs the contact on
 * the seed's outreach-touches timeline — so the request lands in the CRM
 * Requests Hub AND on the seed page the operator is already watching.
 */

import PublicInquiryForm from '@/components/crm/PublicInquiryForm';

export default function SeedPreviewOwnerContact({
  slug,
  businessName,
}: {
  slug: string;
  businessName?: string;
}) {
  return (
    <div className="max-w-xl mx-auto text-left">
      <PublicInquiryForm
        tenantId="platform"
        tenantName="VisibleShelf"
        sourceLabel="Preview"
        sourceTag="seed_preview_owner"
        previewSlug={slug}
        defaultSubject={`Preview storefront — claim or removal — ${businessName || slug}`}
        collapsedTitle={`Own ${businessName || 'this business'}?`}
        collapsedSubtitle="Claim this page or ask us to take it down — tell us here."
        requestFields
        showFaqs={false}
      />
    </div>
  );
}
