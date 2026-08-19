/**
 * Diagnostic: Audit all prompt templates for output_schema registration status.
 *
 * Lists every prompt template in the DB, shows whether output_schema is set,
 * whether the declared schema name is registered in OUTPUT_SCHEMA_REGISTRY,
 * and flags templates that would fail importExternalResult() validation.
 *
 * Usage:
 *   doppler run --config prd -- npx tsx src/scripts/diagnose-template-output-schemas.ts
 */

import { prisma } from '../prisma';
import { OUTPUT_SCHEMA_REGISTRY } from '../validators/market-analysis.schema';
import { logger } from '../logger';

async function main(): Promise<void> {
  const templates = await prisma.mkt_prompt_templates_list.findMany({
    select: {
      id: true,
      name: true,
      prompt_type: true,
      scope: true,
      category: true,
      output_schema: true,
      is_active: true,
    },
    orderBy: { id: 'asc' },
  });

  logger.info(`Found ${templates.length} prompt templates\n`);

  const registeredNames = Object.keys(OUTPUT_SCHEMA_REGISTRY);
  console.log(`Registered output_schema names: ${registeredNames.join(', ')}\n`);

  const rows: Array<{
    id: string;
    name: string;
    type: string;
    scope: string | null;
    category: string | null;
    schemaName: string | null;
    registered: boolean;
    active: boolean;
    issue: string | null;
  }> = [];

  let okCount = 0;
  let missingCount = 0;
  let unregisteredCount = 0;

  for (const t of templates) {
    const schemaObj = t.output_schema as any;
    const schemaName = schemaObj?.name ?? null;
    const registered = schemaName ? OUTPUT_SCHEMA_REGISTRY[schemaName] != null : false;

    let issue: string | null = null;
    if (!schemaName) {
      issue = 'NO output_schema — importExternalResult() will reject with validation_error';
      missingCount++;
    } else if (!registered) {
      issue = `output_schema "${schemaName}" NOT in registry — importExternalResult() will reject`;
      unregisteredCount++;
    } else {
      okCount++;
    }

    rows.push({
      id: t.id,
      name: t.name,
      type: t.prompt_type,
      scope: t.scope,
      category: t.category,
      schemaName,
      registered,
      active: t.is_active,
      issue,
    });
  }

  // Print full table
  console.log(
    'ID'.padEnd(50) +
      ' | ' +
      'Name'.padEnd(45) +
      ' | ' +
      'Type'.padEnd(10) +
      ' | ' +
      'Scope'.padEnd(12) +
      ' | ' +
      'Schema'.padEnd(28) +
      ' | ' +
      'Reg'.padEnd(4) +
      ' | ' +
      'Active'.padEnd(7) +
      ' | Issue',
  );
  console.log('-'.repeat(180));

  for (const r of rows) {
    console.log(
      r.id.padEnd(50) +
        ' | ' +
        (r.name ?? '').slice(0, 45).padEnd(45) +
        ' | ' +
        (r.type ?? '').padEnd(10) +
        ' | ' +
        (r.scope ?? '-').padEnd(12) +
        ' | ' +
        (r.schemaName ?? 'NULL').padEnd(28) +
        ' | ' +
        (r.registered ? 'Y' : 'N').padEnd(4) +
        ' | ' +
        (r.active ? 'Y' : 'N').padEnd(7) +
        ' | ' +
        (r.issue ?? 'OK'),
    );
  }

  console.log('\n' + '='.repeat(80));
  console.log(`Summary: ${okCount} OK, ${missingCount} missing output_schema, ${unregisteredCount} unregistered schema name`);
  console.log('='.repeat(80));

  // Print just the problematic ones
  const problematic = rows.filter((r) => r.issue);
  if (problematic.length > 0) {
    console.log(`\nTemplates that would FAIL importExternalResult():`);
    for (const r of problematic) {
      console.log(`  - ${r.id} (${r.name})`);
      console.log(`    prompt_type: ${r.type}, scope: ${r.scope}, category: ${r.category}`);
      console.log(`    current output_schema: ${r.schemaName ?? 'NULL'}`);
      console.log(`    issue: ${r.issue}`);
      console.log('');
    }
  } else {
    console.log('\nAll templates have registered output_schema. No issues found.');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
