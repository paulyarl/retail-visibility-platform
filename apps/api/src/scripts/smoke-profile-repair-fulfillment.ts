/**
 * Smoke: Profile Repair Fulfillment write paths against the real DB.
 *
 * Exercises the service layer end-to-end on an existing (dead-stage)
 * profile_repair campaign:
 *   1. updateRepairFulfillment — config PATCH deep-merge + SLA default
 *   2. generateIntakeLink(profile_repair_access) — short-code mint + tenant cascade
 *   3. resolveShortCode — /i/{code} resolution to live token
 *   4. updatePlatformStatus — verified_at stamp
 *   5. buildCompletionReport — assembled content
 *   6. escalatePlatform — atomic sibling spawn + parent stamp
 *
 * Usage (from apps/api):
 *   doppler run --config local -- npx tsx src/scripts/smoke-profile-repair-fulfillment.ts [campaignId]
 */

import RepairFulfillmentService from '../services/RepairFulfillmentService';
import DisputeIntakeService from '../services/DisputeIntakeService';
import { prisma } from '../prisma';
import { logger } from '../logger';

const campaignId = process.argv[2] || 'mcamp-g3ibvnrf';
let failures = 0;

function check(name: string, cond: boolean, detail?: any) {
  if (cond) {
    console.log(`  PASS ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}`, detail ?? '');
  }
}

async function main() {
  console.log(`Smoke: profile-repair fulfillment on ${campaignId}\n`);

  const campaign = await prisma.mkt_campaigns_list.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('campaign not found');
  if (campaign.campaign_category !== 'profile_repair' || campaign.repair_track !== 'standard') {
    throw new Error('campaign is not Track A profile_repair — pick another');
  }

  // 1. Config PATCH
  console.log('1. updateRepairFulfillment (tier=standard, mode=dfy)');
  const patched = await RepairFulfillmentService.updateRepairFulfillment(campaignId, {
    tier: 'standard',
    mode: 'dfy',
  });
  const rf1 = patched.repair_fulfillment;
  check('tier stored', rf1.tier === 'standard');
  check('mode stored', rf1.mode === 'dfy');
  check('sla_hours defaulted', rf1.sla_hours === 48, rf1.sla_hours);
  check('platforms populated', Array.isArray(rf1.platforms) && rf1.platforms.length > 0, rf1.platforms);
  check('access intake minted', !!patched.access_intake?.shortUrl, patched.access_intake);

  // 2. Intake link — short code + tenant cascade
  console.log('2. generateIntakeLink(profile_repair_access)');
  const link = await DisputeIntakeService.generateIntakeLink(campaignId, undefined, 'profile_repair_access');
  check('short URL minted', /^https?:\/\/.+\/i\/[A-Z0-9]{6}$/.test(link.shortUrl), link.shortUrl);
  const intakeRow = await prisma.mkt_dispute_intake.findUnique({ where: { id: link.intakeId } });
  check('intake kind', intakeRow?.intake_kind === 'profile_repair_access');
  check('short_code persisted', /^[A-HJ-NP-Z2-9]{6}$/.test(intakeRow?.short_code ?? ''), intakeRow?.short_code);

  // 3. Short-code resolution
  console.log('3. resolveShortCode');
  const resolved = await DisputeIntakeService.resolveShortCode(intakeRow!.short_code!);
  check('resolves to live token', resolved?.token === intakeRow!.access_token);
  check('kind returned', resolved?.intakeKind === 'profile_repair_access');
  check('tenant resolved', !!resolved?.tenantId, resolved?.tenantId);
  check('unknown code → null', (await DisputeIntakeService.resolveShortCode('ZZZZZZ')) === null);

  // 4. Platform status write
  console.log('4. updatePlatformStatus');
  const ps = await RepairFulfillmentService.updatePlatformStatus(campaignId, 'google', {
    status: 'verified',
    note: 'smoke test',
  });
  check('status stored', ps.entry.status === 'verified');
  check('verified_at stamped', !!ps.entry.verified_at);
  try {
    await RepairFulfillmentService.updatePlatformStatus(campaignId, 'google', { status: 'bogus' as any });
    check('invalid status rejected', false);
  } catch {
    check('invalid status rejected', true);
  }

  // 5. Completion report assembly
  console.log('5. buildCompletionReport');
  const report = await RepairFulfillmentService.buildCompletionReport(campaignId);
  check('content non-empty', report.content.length > 100, report.content.slice(0, 80));
  check('platform outcome rendered', report.content.includes('google — verified'));
  check('retainer pitch present', report.content.includes('listing-synchronization retainer'));

  // 6. Escalation — atomic sibling + parent stamp
  console.log('6. escalatePlatform(yelp → suspension)');
  const esc = await RepairFulfillmentService.escalatePlatform(campaignId, 'yelp', {
    issueType: 'suspension',
    notes: 'smoke test escalation',
  });
  const sibling = await prisma.mkt_campaigns_list.findUnique({ where: { id: esc.sibling.id } });
  check('sibling persisted', !!sibling);
  check('sibling escalated track', sibling?.repair_track === 'escalated');
  check('sibling initial stage', sibling?.stage === 'audit_identified');
  check('sibling inherits prospect', sibling?.business_prospect_id === (campaign.business_prospect_id ?? sibling?.business_prospect_id));
  check('sibling escalated_from stamp', (sibling?.repair_fulfillment as any)?.escalated_from?.campaign_id === campaignId);
  check('parent platform stamped escalated', esc.platform_status.status === 'escalated' && esc.platform_status.escalated_campaign_id === esc.sibling.id);

  // Double-spawn guard
  await RepairFulfillmentService.escalatePlatform(campaignId, 'yelp', { issueType: 'suspension' })
    .then(() => check('double-spawn blocked', false))
    .catch((e) => check('double-spawn blocked', /already escalated/i.test(e.message)));

  // 7. Read model
  console.log('7. getRepairExecution');
  const exec = await RepairFulfillmentService.getRepairExecution(campaignId);
  check('read model tier', exec.tier === 'standard');
  check('platform_status carried', exec.platform_status?.google?.status === 'verified');
  check('access intake surfaced', !!exec.access_intake?.short_url, exec.access_intake);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  logger.error('smoke failed', undefined, { error: e.message });
  console.error(e);
  process.exit(1);
});
