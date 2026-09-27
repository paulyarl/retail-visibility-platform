import { PrismaClient } from '@prisma/client';
async function main() {
  const p = new PrismaClient();
  const t = await p.mkt_prompt_templates_list.findUnique({ where: { id: 'mpt-seed-seek-001' } }) as any;
  console.log(JSON.stringify({
    body_len: t.body.length,
    parity2: t.body.includes('parity-2'),
    exception_count: (t.body.match(/Exception: when the Platform Availability/g) || []).length,
    business_sections: (t.body.match(/## Business\b/g) || []).length,
    is_default: t.is_default,
  }));
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
