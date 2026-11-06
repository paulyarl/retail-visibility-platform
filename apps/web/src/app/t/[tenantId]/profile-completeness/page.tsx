import { redirect } from 'next/navigation';

// Folded into the Content hub — the completeness score now lives in the
// /content header (same calculateSEOReadiness function, so the two surfaces
// can't disagree). See docs/LocalBiz/TENANT_CONTENT_HUB_SPEC.md §3.1.
export default async function ProfileCompletenessPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  redirect(`/t/${tenantId}/content`);
}
