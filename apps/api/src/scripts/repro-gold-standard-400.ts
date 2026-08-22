/**
 * Reproduction script for the 400 validation_error on
 * POST /api/admin/marketing-ops/prompts/executions/external
 *
 * Usage:
 *   doppler run --config local -- npx tsx src/scripts/repro-gold-standard-400.ts < path/to/request-body.json
 *
 * Or save the request body to a file and pass the path:
 *   doppler run --config local -- npx tsx src/scripts/repro-gold-standard-400.ts path/to/request-body.json
 */
import { goldStandardScanSchema } from '../validators/gold-standard-scan.schema';

// ─── Copied from MarketingPromptService.ts (keep in sync) ────────────────

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
        // Unbalanced opener — log and skip
        console.log(`  [extractJsonCandidates] UNBALANCED '${openChar}' at position ${i}, skipping`);
        i++;
      }
    } else {
      i++;
    }
  }
  return candidates;
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const fs = await import('fs');

  // Read request body from file arg or stdin
  let bodyText: string;
  const fileArg = process.argv[2];
  if (fileArg) {
    bodyText = fs.readFileSync(fileArg, 'utf8');
  } else {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    bodyText = Buffer.concat(chunks).toString('utf8');
  }

  console.log('=== Request Body Analysis ===\n');
  console.log(`Body length: ${bodyText.length} chars`);

  // Parse the outer request body JSON
  let body: any;
  try {
    body = JSON.parse(bodyText);
  } catch (e) {
    console.log('FAILED to parse request body as JSON:', (e as Error).message);
    console.log('First 200 chars:', JSON.stringify(bodyText.substring(0, 200)));
    return;
  }

  const rawOutput = body.raw_output;
  console.log(`raw_output type: ${typeof rawOutput}`);
  console.log(`raw_output length: ${rawOutput?.length}`);

  if (typeof rawOutput !== 'string') {
    console.log('raw_output is NOT a string! Value:', JSON.stringify(rawOutput)?.substring(0, 200));
    return;
  }

  console.log(`raw_output first 120 chars: ${JSON.stringify(rawOutput.substring(0, 120))}`);
  console.log(`raw_output last 80 chars: ${JSON.stringify(rawOutput.substring(rawOutput.length - 80))}`);
  console.log();

  // Check if raw_output is itself valid JSON
  try {
    const directParse = JSON.parse(rawOutput);
    console.log('=== Direct JSON.parse(raw_output) ===');
    console.log(`Success! Top-level type: ${typeof directParse}`);
    if (typeof directParse === 'object' && directParse !== null) {
      console.log(`Top-level keys: ${Object.keys(directParse).join(', ')}`);
      console.log(`category_key: ${JSON.stringify(directParse.category_key)}`);
      console.log(`category_name: ${JSON.stringify(directParse.category_name)}`);
      console.log(`platform_focus: ${JSON.stringify(directParse.platform_focus)}`);
    } else {
      console.log(`WARNING: Parsed value is ${typeof directParse}, not an object!`);
      console.log(`Value (first 200): ${JSON.stringify(String(directParse).substring(0, 200))}`);
    }
    console.log();
  } catch (e) {
    console.log('=== Direct JSON.parse(raw_output) FAILED ===');
    console.log(`Error: ${(e as Error).message}`);
    console.log();
  }

  // Run through extractJsonCandidates
  console.log('=== extractJsonCandidates ===');
  const candidates = extractJsonCandidates(rawOutput);
  console.log(`Found ${candidates.length} candidate(s)`);
  console.log();

  let firstValidationIssues: string | null = null;
  let parsedJson: any | null = null;

  for (let idx = 0; idx < candidates.length; idx++) {
    const candidate = candidates[idx];
    console.log(`--- Candidate ${idx} ---`);
    console.log(`  length: ${candidate.length}`);
    console.log(`  first 120 chars: ${JSON.stringify(candidate.substring(0, 120))}`);
    console.log(`  last 80 chars: ${JSON.stringify(candidate.substring(candidate.length - 80))}`);

    const stripped = stripLlmJsonArtifacts(candidate);
    const changed = stripped !== candidate;
    console.log(`  stripLlmJsonArtifacts changed: ${changed}`);
    if (changed) {
      console.log(`  stripped first 120: ${JSON.stringify(stripped.substring(0, 120))}`);
    }

    let candidateJson: any;
    try {
      candidateJson = JSON.parse(stripped);
    } catch (e) {
      console.log(`  JSON.parse FAILED: ${(e as Error).message}`);
      console.log();
      continue;
    }

    console.log(`  JSON.parse succeeded. Type: ${typeof candidateJson}`);
    if (typeof candidateJson === 'object' && candidateJson !== null) {
      console.log(`  Top-level keys: ${Object.keys(candidateJson).join(', ')}`);
      console.log(`  category_key: ${JSON.stringify(candidateJson.category_key)}`);
      console.log(`  category_name: ${JSON.stringify(candidateJson.category_name)}`);
      console.log(`  platform_focus: ${JSON.stringify(candidateJson.platform_focus)}`);
    } else {
      console.log(`  WARNING: Parsed value is ${typeof candidateJson}, not an object!`);
      console.log(`  Value (first 200): ${JSON.stringify(String(candidateJson).substring(0, 200))}`);
    }

    const result = goldStandardScanSchema.safeParse(candidateJson);
    console.log(`  Schema validation: ${result.success ? 'PASSED' : 'FAILED'}`);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      console.log(`  Issues: ${issues}`);
      if (!firstValidationIssues) {
        firstValidationIssues = issues;
      }
    } else {
      parsedJson = candidateJson;
    }
    console.log();
  }

  console.log('=== Final Result ===');
  if (parsedJson) {
    console.log('SUCCESS: A candidate validated against goldStandardScanSchema');
  } else if (firstValidationIssues) {
    console.log(`FAILED: No candidate validated. First candidate issues:`);
    console.log(`  ${firstValidationIssues}`);
    console.log();
    console.log('This matches the production error:');
    console.log(`  External result does not match the "gold_standard_scan" output schema: ${firstValidationIssues}`);
  } else {
    console.log('FAILED: No valid JSON found in any candidate');
  }
}

main().catch(console.error);
