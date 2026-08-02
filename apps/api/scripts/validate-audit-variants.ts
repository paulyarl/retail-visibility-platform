import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { businessAnalysisSchema } from '../src/validators/business-analysis.schema';
import { cityCategoryOpportunitySchema } from '../src/validators/city-category-opportunity.schema';

// __dirname = apps/api/scripts -> repo root is three levels up
const promptsDir = join(__dirname, '..', '..', '..', 'docs', 'LocalBiz', 'Audit Prompts');

// Agent providers we calibrate against.
const variantAgents = ['gpt', 'kimi', 'gemini', 'perplexity', 'claude'];

/**
 * A calibration group: a human label, a file-name prefix, a Zod schema, and
 * the list of agent variant suffixes to discover. Add a new group here when
 * calibrating a new prompt output shape.
 */
const calibrationGroups: {
  label: string;
  filePrefix: string;
  schema: ReturnType<typeof Object>;
}[] = [
  {
    label: 'business_analysis',
    filePrefix: 'Local Business Digital Opportunity Audit - One Hour',
    schema: businessAnalysisSchema,
  },
  {
    label: 'city_category_opportunity',
    filePrefix: 'City Category Digital Audit',
    schema: cityCategoryOpportunitySchema,
  },
];

let failures = 0;
let totalChecked = 0;

for (const group of calibrationGroups) {
  console.log(`\n=== ${group.label} ===`);
  const variants = readdirSync(promptsDir).filter((f) =>
    variantAgents.some((a) => f.startsWith(`${group.filePrefix} - ${a} -`) && f.endsWith('- seek.md')),
  );

  if (variants.length === 0) {
    console.log('  (no variant files found yet)');
    continue;
  }

  for (const file of variants) {
    totalChecked++;
    const raw = readFileSync(join(promptsDir, file), 'utf8').trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error(`[JSON PARSE FAIL] ${file}: ${(e as Error).message}`);
      failures++;
      continue;
    }

    const result = (group.schema as any).safeParse(parsed);
    if (result.success) {
      console.log(`[PASS] ${file}`);
    } else {
      failures++;
      console.error(`[SCHEMA FAIL] ${file}`);
      for (const issue of result.error.issues) {
        console.error(`  - ${issue.path.join('.')}: ${issue.message} (code=${issue.code})`);
      }
    }
  }
}

console.log(`\n${failures === 0 ? 'ALL VARIANTS VALID' : `${failures} of ${totalChecked} variant(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
