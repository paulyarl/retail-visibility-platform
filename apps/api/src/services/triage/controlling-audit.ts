/**
 * Controlling-audit write path (migration 333, spec §12 amendment).
 *
 * The project-phase plan resolves its canonical signal set from the
 * prospect's business_analysis audits. Default is latest real audit wins —
 * which lets a narrower analyst run silently retract gaps a thorough run
 * detected. The operator pin overrides that: exactly ONE audit per
 * prospect group carries is_controlling = true.
 *
 * Plan-scoped by design — only resolveProspectSignals consults the pin.
 * Every other "latest audit" consumer (deliverables, call scripts,
 * openers, repair flows) keeps latest-wins.
 */
import { prisma } from '../../prisma';

export type SetControllingAuditResult =
  | { ok: true; controllingAuditId: string | null }
  | { ok: false; status: number; error: string; message: string };

/**
 * Resolve the prospect group's campaign ids. Mirrors
 * buildProjectPhasePlanForKey's fallbacks: ?campaignId= wins, then
 * business_prospect_id members, then the id itself as a singleton campaign.
 */
async function resolveGroupCampaignIds(
  prospectId: string,
  campaignIdQuery: string | null,
): Promise<string[]> {
  if (campaignIdQuery) return [campaignIdQuery];
  const rows = await prisma.mkt_campaigns_list.findMany({
    where: { business_prospect_id: prospectId },
    select: { id: true },
  });
  if (rows.length > 0) return rows.map((r) => r.id);
  const exists = await prisma.mkt_campaigns_list.findUnique({
    where: { id: prospectId },
    select: { id: true },
  });
  return exists ? [prospectId] : [];
}

/**
 * Set (auditId) or clear (auditId = null) the controlling audit for a
 * prospect group. The audit must exist, be a business_analysis audit, and
 * belong to a campaign in the group. Clear + set run in one transaction so
 * a group can never end up with two controlling audits.
 */
export async function setControllingAuditForProspect(args: {
  prospectId: string;
  campaignId?: string | null;
  auditId: string | null;
}): Promise<SetControllingAuditResult> {
  const campaignIds = await resolveGroupCampaignIds(args.prospectId, args.campaignId ?? null);
  if (campaignIds.length === 0) {
    return { ok: false, status: 404, error: 'not_found', message: 'Prospect not found' };
  }

  const { auditId } = args;
  if (auditId !== null) {
    const audit = await prisma.mkt_audits_list.findUnique({
      where: { id: auditId },
      select: { campaign_id: true, platform: true },
    });
    if (!audit || !campaignIds.includes(audit.campaign_id)) {
      return { ok: false, status: 404, error: 'not_found', message: 'Audit is not in this prospect group' };
    }
    if (audit.platform !== 'business_analysis') {
      return {
        ok: false,
        status: 400,
        error: 'invalid_audit',
        message: 'The controlling audit must be a business_analysis audit',
      };
    }
  }

  await prisma.$transaction([
    prisma.mkt_audits_list.updateMany({
      where: { campaign_id: { in: campaignIds } },
      data: { is_controlling: false },
    }),
    ...(auditId !== null
      ? [prisma.mkt_audits_list.update({ where: { id: auditId }, data: { is_controlling: true } })]
      : []),
  ]);

  return { ok: true, controllingAuditId: auditId };
}
