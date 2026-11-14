import { prisma } from '../src/prisma';
async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT platform, count(*)::int AS n, count(distinct campaign_id)::int AS campaigns
    FROM mkt_audits_list GROUP BY platform ORDER BY n DESC`);
  console.table(rows);
  const briefs = await prisma.$queryRawUnsafe<any[]>(`
    SELECT a.campaign_id, c.business_name,
           a.audit_data->>'brief_version' AS v,
           a.audit_data->>'assembly' AS assembly,
           a.audit_data->>'staleness' AS staleness
    FROM mkt_audits_list a JOIN mkt_campaigns_list c ON c.id = a.campaign_id
    WHERE a.platform = 'engagement_brief'`);
  console.log('engagement_brief rows:', briefs.length);
  for (const b of briefs) console.log(`  ${b.campaign_id} v${b.v ?? '?'} assembly=${b.assembly ?? '-'} stale=${b.staleness ?? '-'} "${b.business_name}"`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
