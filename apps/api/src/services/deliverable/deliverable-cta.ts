/**
 * Deliverable CTA — claim-and-fix closing text for fulfill prompts.
 *
 * Neutral module (no service imports) so BOTH the deliverable path
 * (DeliverableSourceService) and the generic prompt render path
 * (MarketingExecutionService.resolvePrompt) can share one definition without
 * creating an import cycle.
 *
 * Spec: docs/LocalBiz/marketing_ops_deliverable_source_material_spec.md §5.6
 */

/**
 * Build the claim-and-fix CTA text for a fulfill prompt. When a claim URL
 * resolves, the CTA carries it; otherwise a link-less variant is used so the
 * body never renders a literal `{{claim_url}}` placeholder.
 */
export function buildClaimCta(claimUrl: string | null): string {
  return claimUrl
    ? `Claim your listing and correct it here: ${claimUrl} — it takes about two minutes and there is no cost.`
    : 'Ask your contact to claim this listing on your behalf — it takes about two minutes and there is no cost.';
}
