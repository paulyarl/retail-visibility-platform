/**
 * Stub business_analysis audit detection.
 *
 * Placeholder audit rows are seeded at queue-promotion / campaign-derivation
 * time so the triage engine has detected_signals to work with before a real
 * audit runs. They carry only `audit_metadata` + `detected_signals`
 * (+ optional `attributes`) — NOT the business_analysis output-schema
 * contract — and must never be treated as a real audit by consumers that
 * read "the campaign's latest business_analysis audit" (audit cards, seed
 * creation, outreach generation, sync, triage's business_analysis
 * preference).
 *
 * Sources that produce stubs:
 *   - manual_queue        — MarketingProspectQueueService (queued signals)
 *   - queue_promotion     — MarketingProspectQueueService (attribute handoff)
 *   - derived_from_parent — MarketingCampaignService (spawn pre-triaged)
 */
export const STUB_BUSINESS_ANALYSIS_AUDIT_SOURCES = [
  'manual_queue',
  'queue_promotion',
  'derived_from_parent',
] as const;

export function isStubBusinessAnalysisAudit(
  audit: { platform?: string | null; audit_data?: any } | null | undefined,
): boolean {
  if (!audit || audit.platform !== 'business_analysis') return false;
  const source = audit.audit_data?.audit_metadata?.source;
  return (
    typeof source === 'string' &&
    (STUB_BUSINESS_ANALYSIS_AUDIT_SOURCES as readonly string[]).includes(source)
  );
}
