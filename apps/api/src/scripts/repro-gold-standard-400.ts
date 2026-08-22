/**
 * Reproduction script for the 400 validation_error on
 * POST /api/admin/marketing-ops/prompts/executions/external
 *
 * Simulates the exact parsing flow:
 *   extractJsonCandidates -> stripLlmJsonArtifacts -> JSON.parse -> schema.safeParse
 */
import { goldStandardScanSchema } from '../validators/gold-standard-scan.schema';

function stripLlmJsonArtifacts(raw: string): string {
  try {
    let text = raw;
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/i);
    if (fenceMatch) {
      text = fenceMatch[1].trim();
    }
    const firstBrace = text.search(/[{[]/);
    if (firstBrace > 0) {
      const openChar = text[firstBrace];
      const closeChar = openChar === '{' ? '}' : ']';
      let depth = 0;
      let inString = false;
      let escape = false;
      let endIdx = -1;
      for (let i = firstBrace; i < text.length; i++) {
        const ch = text[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === openChar) depth++;
        else if (ch === closeChar) {
          depth--;
          if (depth === 0) { endIdx = i; break; }
        }
      }
      if (endIdx > firstBrace) {
        text = text.substring(firstBrace, endIdx + 1);
      }
    }
    text = text.replace(/([\[,])\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*\{/g, '$1 {');
    return text;
  } catch {
    return raw;
  }
}

function extractJsonCandidates(raw: string): string[] {
  const candidates: string[] = [];
  let text = raw;
  const fenceGlobal = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/gi;
  const fenceMatches = [...text.matchAll(fenceGlobal)];
  if (fenceMatches.length > 0) {
    text = fenceMatches.map((m) => m[1]).join('\n');
  }
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '{' || ch === '[') {
      const openChar = ch;
      const closeChar = openChar === '{' ? '}' : ']';
      let depth = 0;
      let inString = false;
      let escape = false;
      let endIdx = -1;
      for (let j = i; j < text.length; j++) {
        const c = text[j];
        if (escape) { escape = false; continue; }
        if (c === '\\' && inString) { escape = true; continue; }
        if (c === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (c === openChar) depth++;
        else if (c === closeChar) {
          depth--;
          if (depth === 0) { endIdx = j; break; }
        }
      }
      if (endIdx > i) {
        candidates.push(text.substring(i, endIdx + 1));
        i = endIdx + 1;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }
  return candidates;
}

async function main() {
  // Read the raw_output from the file we saved
  const fs = await import('fs');
  const rawOutput = fs.readFileSync(__dirname + '/repro-raw-output.json', 'utf8');

  console.log('raw_output length:', rawOutput.length);
  console.log('raw_output starts with:', JSON.stringify(rawOutput.substring(0, 80)));
  console.log();

  const candidates = extractJsonCandidates(rawOutput);
  console.log('Number of JSON candidates:', candidates.length);
  for (let idx = 0; idx < candidates.length; idx++) {
    console.log(`  Candidate ${idx}: length=${candidates[idx].length}, starts with: ${JSON.stringify(candidates[idx].substring(0, 80))}`);
  }
  console.log();

  for (let idx = 0; idx < candidates.length; idx++) {
    const candidate = candidates[idx];
    const stripped = stripLlmJsonArtifacts(candidate);
    console.log(`Candidate ${idx} after stripLlmJsonArtifacts:`);
    console.log(`  length: ${stripped.length}`);
    console.log(`  starts with: ${JSON.stringify(stripped.substring(0, 80))}`);
    console.log(`  identical to original: ${stripped === candidate}`);

    let parsed: any;
    try {
      parsed = JSON.parse(stripped);
    } catch (e) {
      console.log(`  JSON.parse FAILED: ${(e as Error).message}`);
      continue;
    }

    console.log(`  JSON.parse succeeded. Top-level keys: ${Object.keys(parsed).join(', ')}`);
    console.log(`  category_key: ${JSON.stringify(parsed.category_key)}`);
    console.log(`  category_name: ${JSON.stringify(parsed.category_name)}`);
    console.log(`  platform_focus: ${JSON.stringify(parsed.platform_focus)}`);

    const result = goldStandardScanSchema.safeParse(parsed);
    if (result.success) {
      console.log(`  Schema validation: PASSED`);
    } else {
      console.log(`  Schema validation: FAILED`);
      for (const issue of result.error.issues) {
        console.log(`    ${issue.path.join('.')}: ${issue.message} (code: ${issue.code})`);
      }
    }
    console.log();
  }
}

main().catch(console.error);
