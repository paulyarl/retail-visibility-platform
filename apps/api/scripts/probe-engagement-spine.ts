/**
 * probe-engagement-spine — read-only exercise of the engagement-brief
 * consumer lane against real campaigns (post-spine-sprint verification).
 *
 * For each campaign matching --like (business name), prints:
 *   - latest business_analysis audit (id/date) the spine resolves from
 *   - persisted engagement_brief rows (assembly, staleness, fingerprint)
 *   - loadBriefSpine result: source + stale flag
 *   - the spine's ranked pains (ref/domain/severity), primary hook,
 *     guardrails, gates, benefits count
 *   - the archetype overlay order for each declared archetype
 *
 * Usage:
 *   doppler run --config stg -- npx tsx scripts/probe-engagement-spine.ts --like "Viet Hua"
 *   doppler run --config stg -- npx tsx scripts/probe-engagement-spine.ts --campaign mcamp-xxx
 */

import { prisma } from '../src/prisma';
import { loadBriefSpine, applyArchetypeOverlay, spineToAmmunition, spineGuardrails, spinePrimaryHook, spinePromptBlock } from '../src/services/engagement-brief/brief-spine';
import { resolveDeclaredArchetype } from '../src/services/OutreachOpenerService';

const like = process.argv.find((a) => a.startsWith('--like='))?.split('=')[1]
  ?? process.argv[process.argv.indexOf('--like') + 1];
const campaignId = process.argv.includes('--campaign') ? process.argv[process.argv.indexOf('--campaign') + 1] : null;

async function main() {
  const campaigns = campaignId
    ? await prisma.mkt_campaigns_list.findMany({ where: { id: campaignId } })
    : await prisma.mkt_campaigns_list.findMany({
        where: {
          scope: 'business',
          business_name: { contains: like ?? 'Viet Hua', mode: 'insensitive' },
        },
        orderBy: { created_at: 'asc' },
      });

  console.log(`Found ${campaigns.length} campaign(s)\n`);

  for (const c of campaigns) {
    console.log('═'.repeat(78));
    console.log(`${c.business_name}  [${c.id}]`);
    console.log(`  archetype=${(c as any).archetype ?? '-'} prospect=${(c as any).business_prospect_id ?? '-'}`);

    const audits = await prisma.mkt_audits_list.findMany({
      where: { campaign_id: c.id },
      orderBy: { created_at: 'desc' },
      select: { id: true, platform: true, created_at: true, audit_data: true },
    });
    const ba = audits.filter((a) => a.platform === 'business_analysis');
    const briefs = audits.filter((a) => a.platform === 'engagement_brief');
    console.log(`  audits: ${ba.length} business_analysis, ${briefs.length} engagement_brief`);
    for (const b of briefs) {
      const d: any = b.audit_data;
      console.log(
        `    brief ${b.id.slice(0, 12)}… ${b.created_at.toISOString().slice(0, 10)}` +
          ` v${d?.brief_version ?? '?'} assembly=${d?.assembly ?? '?'} staleness=${d?.staleness ?? '?'}` +
          ` fp=${(d?.evidence_fingerprint ?? '').slice(0, 12) || '-'} src=${(d?.source_audit_id ?? 'null')?.slice(0, 12)}`,
      );
    }

    const pack = await loadBriefSpine(prisma, c.id);
    if (!pack) {
      console.log('  spine: NULL — consumer fallback lane\n');
      continue;
    }
    console.log(`  spine: source=${pack.source} stale=${pack.stale}`);

    const declared = await resolveDeclaredArchetype(c.id, undefined as any).catch(() => null);
    const archetype = (declared as any)?.archetype ?? null;
    const spine = archetype ? applyArchetypeOverlay(pack.spine, archetype) : pack.spine;
    console.log(`  declared archetype: ${archetype ?? '(none — canonical order)'}`);

    const pains: any[] = spine.pains ?? [];
    console.log(`  pains (${pains.length}):`);
    for (const p of pains.slice(0, 6)) {
      console.log(
        `    ${p.ref_id} [${p.domain ?? '?'}/${p.severity ?? '?'}] ${String(p.pain ?? p.business_consequence ?? '').slice(0, 90)}`,
      );
    }
    const hook = spinePrimaryHook(spine) as any;
    const hookText = hook?.hook ?? hook?.business_consequence ?? null;
    console.log(`  primary hook (${hook?.ref_id ?? '-'}): ${hookText ? String(hookText).slice(0, 120) : '(none)'}`);
    const ammo = spineToAmmunition(spine);
    console.log(`  ammunition rows: ${ammo.length}; benefits: ${(spine.benefits ?? []).length}`);
    const guards = spineGuardrails(spine);
    console.log(`  guardrails (${guards.length}):`);
    for (const g of guards.slice(0, 5)) console.log(`    - ${String(g).slice(0, 110)}`);
    const gates: any[] = spine.verification_gates ?? [];
    console.log(
      `  gates (${gates.length}): ${gates.map((g) => `${g.status ?? 'pending'}:${String(g.gate).slice(0, 40)}`).join(' | ')}`,
    );
    const block = spinePromptBlock(spine);
    console.log(`  prompt block: ${block.split('\n').length} lines`);
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
