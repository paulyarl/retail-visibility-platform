import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const CHECKS: Array<[string, string]> = [
  ['old-rubric', 'profile appears maintained or status is unavailable'],
  ['new-rubric', '0 points when the profile is verified maintained'],
  ['c3', 'platform verified absent per render control'],
  ['ac-null', 'emit `action_classification: null` instead of defaulting to BALANCED_HEALTHY'],
  ['syndication', 'is recorded `partial`, with the capture path noted'],
  ['conflicts-rule', 'Do NOT record notes about which prompt blocks were present or absent'],
];

(async () => {
  const rows = await (p as any).mkt_prompt_templates_list.findMany({
    where: { id: { in: ['mpt-j9bbem3l', 'mpt-6oeuiizo', 'mpt-je6m7ru6'] } },
    select: { id: true, body: true },
  });
  for (const r of rows) {
    const parts = CHECKS.map(([label, needle]) => `${label}:${r.body.split(needle).length - 1}`);
    console.log(r.id, '| marker-4:', r.body.includes('availability-scoring-4'), '|', parts.join(' '));
  }
  await p.$disconnect();
})().catch(async (e) => {
  console.error('FAILED:', e?.message ?? e);
  await p.$disconnect();
  process.exit(1);
});
