import { redirect, notFound } from 'next/navigation';
import { platformOrigin } from '@/lib/storefront-routing';
import prospectReportPublicService from '@/services/ProspectReportPublicService';

export const dynamic = 'force-dynamic';

/**
 * Prospect-report short-link redirect — /r/pr/{code}.
 *
 * Static /r/pr/* namespace, so this page wins over the dynamic
 * /r/[shortCode] catch-all (Next.js prefers static segments) — report codes
 * never collide with claim/report-delivery codes. The scan is recorded
 * server-side by the pr-scan endpoint under the link's prospect_report_*
 * channel surface before returning the signed-token report URL.
 *
 * Spec: docs/LocalBiz/WEBSITE_GAP_OWNER_REPORT_SPEC.md §5.2a
 */
export default async function ProspectReportShortPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const url = await prospectReportPublicService.resolveCode(code);
  if (!url) {
    notFound();
  }
  // The prospect report is a `public` surface — platform host only. resolveCode
  // returns a platform-relative path; emit it absolute so it never renders
  // under a tenant's custom domain.
  redirect(url.startsWith('/') ? `${platformOrigin()}${url}` : url);
}
