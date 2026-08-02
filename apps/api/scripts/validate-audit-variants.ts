import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { businessAnalysisSchema } from '../src/validators/business-analysis.schema';

// __dirname = apps/api/scripts -> repo root is three levels up
const promptsDir = join(__dirname, '..', '..', '..', 'docs', 'LocalBiz', 'Audit Prompts');

// Only the three agent-produced variant outputs (gpt / kimi / gemini).
// The base prompt templates (`- seek.md` without a variant label) are
// markdown documents, not JSON, and are excluded.
const variantAgents = ['gpt', 'kimi', 'gemini', 'perplexity', 'claude'];
const variants = readdirSync(promptsDir).filter((f) =>
  variantAgents.some((a) => f === `Local Business Digital Opportunity Audit - One Hour - ${a} - seek.md`),
);

let failures = 0;

for (const file of variants) {
  const raw = readFileSync(join(promptsDir, file), 'utf8').trim();
  // The variant files are JSON (some pretty-printed, some minified).
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error(`[JSON PARSE FAIL] ${file}: ${(e as Error).message}`);
    failures++;
    continue;
  }

  const result = businessAnalysisSchema.safeParse(parsed);
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

console.log(`\n${failures === 0 ? 'ALL VARIANTS VALID' : `${failures} variant(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
