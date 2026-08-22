import { goldStandardScanSchema } from '../validators/gold-standard-scan.schema';

// Mimic the structure of the actual raw_output
const rawOutput = JSON.stringify({
  category_key: 'beautysupply',
  category_name: 'Beauty Supply',
  platform_focus: 'all',
  expected_fields: {
    universal: {
      canonical_name: 'Beauty Supply business name (brand or DBA)',
      canonical_address: 'Complete street, city, state, ZIP',
      canonical_phone: 'Local or toll-free business phone',
      hours_present: true,
      website_present: true,
      quality_gates: [
        { field: 'canonical_name', description: 'Business name must match signage and website exactly', severity: 'non_negotiable' },
        { field: 'canonical_address', description: 'Complete, deliverable address with city, state, ZIP', severity: 'non_negotiable' },
      ],
      fields: [
        { field: 'business_name', description: 'Recognizable name without keyword stuffing', severity: 'non_negotiable' },
        { field: 'address', description: 'Street, city, state, ZIP and suite/unit', severity: 'non_negotiable' },
      ],
    },
    platforms: {
      google: {
        primary_category: 'Beauty supply store',
        additional_categories: ['Cosmetics store', 'Hair care supply store'],
        required_attributes: ['hours', 'website', 'phone'],
        recommended_attributes: ['wheelchair_accessible_entrance', 'in_store_pickup'],
        description_requirements: '100-750 characters, includes product categories and target audience',
        page_type: 'Google Business Profile',
        expected_photo_count: 10,
        branding_expectations: {
          has_logo: true,
          has_cover_photo: true,
          has_profile_photo: true,
          photo_count: 10,
          photo_types: ['logo', 'cover', 'storefront', 'interior', 'product displays'],
          visual_assets: ['360 storefront photo', 'product shelf photos'],
        },
        quality_gates: [
          { field: 'primary_category', description: 'Primary category set to Beauty supply store', severity: 'non_negotiable' },
          { field: 'hours', description: 'Current weekly hours', severity: 'non_negotiable' },
        ],
        fields: [
          { field: 'primary_category', description: 'Beauty supply store', severity: 'non_negotiable' },
          { field: 'additional_categories', description: 'Relevant secondary categories', severity: 'recommended' },
        ],
      },
    },
  },
  candidates: [
    {
      business_name: 'Sally Beauty Supply',
      city: 'North Bergen',
      state: 'NJ',
      nap: { name: 'Sally Beauty', address: '8101 Tonnele Ave, North Bergen, NJ 07047', phone: '+1 201-295-0020' },
      platform_evaluations: [
        {
          platform: 'google',
          profile_url: 'https://www.google.com/maps/place/data=!3m1!4b1!4m2!3m1!1s0x89c2f7e51aae4d93:0x865fdd9083c83fde',
          quality_score: 8.5,
          quality_rationale: 'Verified Google Business Profile for a national chain location',
          is_gold_standard: true,
          branding_artifacts: {
            has_logo: true, has_cover_photo: true, has_profile_photo: true,
            photo_count: null,
            photo_types: ['logo', 'cover', 'storefront', 'product displays', 'interior'],
            visual_assets: ['brand logo', 'storefront photo', 'cover image'],
          },
          platform_config: {
            primary_category: 'Beauty supply store',
            additional_categories: ['Cosmetics store', 'Hair care supply store', 'Nail supply store'],
            description_quality: 'good',
            website: 'https://www.sallybeauty.com/',
            phone: '+1 201-295-0020',
            hours: 'Mon-Fri 9-9, Sat 9-9, Sun 10-7',
          },
          quality_gates_passed: ['canonical_name', 'canonical_address', 'canonical_phone', 'primary_category', 'hours', 'website', 'logo'],
          quality_gates_failed: ['review_response', 'photos_min_10'],
        },
      ],
      category_notes: 'National retail chain location; primary profile strength is Google and Facebook.',
    },
  ],
  scan_metadata: {
    scan_date: '2026-08-21',
    sources_consulted: ['Google Maps', 'Google web search', 'Yelp', 'Better Business Bureau (BBB)', 'Facebook public pages'],
    selection_criteria: 'Selected national chain leaders based on profile completeness',
    platforms_evaluated: ['google', 'yelp', 'facebook', 'bbb', 'apple_maps', 'bing'],
    expected_field_derivation: 'Universal and per-platform expected fields were derived from the common attributes',
    platform_focus: 'all',
  },
});

console.log('rawOutput length:', rawOutput.length);

// Test the stripLlmJsonArtifacts regex
const labelRegex = /([\[,])\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*\{/g;
const stripped = rawOutput.replace(labelRegex, '$1 {');
console.log('stripLlmJsonArtifacts regex changed the string:', stripped !== rawOutput);
if (stripped !== rawOutput) {
  for (let i = 0; i < Math.min(stripped.length, rawOutput.length); i++) {
    if (stripped[i] !== rawOutput[i]) {
      console.log('First difference at position', i);
      console.log('Original:', JSON.stringify(rawOutput.substring(Math.max(0, i - 40), i + 40)));
      console.log('Stripped:', JSON.stringify(stripped.substring(Math.max(0, i - 40), i + 40)));
      break;
    }
  }
}

// Test direct schema validation
const directParsed = JSON.parse(rawOutput);
const directResult = goldStandardScanSchema.safeParse(directParsed);
console.log('Direct schema validation:', directResult.success ? 'PASSED' : 'FAILED');
if (!directResult.success) {
  for (const issue of directResult.error.issues) {
    console.log('  ', issue.path.join('.'), ':', issue.message);
  }
}

// Test the full extractJsonCandidates + stripLlmJsonArtifacts flow
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

const candidates = extractJsonCandidates(rawOutput);
console.log('\nextractJsonCandidates found:', candidates.length, 'candidates');
for (let idx = 0; idx < candidates.length; idx++) {
  console.log(`  Candidate ${idx}: length=${candidates[idx].length}, starts with: ${JSON.stringify(candidates[idx].substring(0, 80))}`);
  const stripped2 = stripLlmJsonArtifacts(candidates[idx]);
  console.log(`  After strip: identical=${stripped2 === candidates[idx]}`);
  try {
    const parsed = JSON.parse(stripped2);
    console.log(`  Parsed keys: ${Object.keys(parsed).join(', ')}`);
    const result = goldStandardScanSchema.safeParse(parsed);
    console.log(`  Schema validation: ${result.success ? 'PASSED' : 'FAILED'}`);
    if (!result.success) {
      for (const issue of result.error.issues) {
        console.log(`    ${issue.path.join('.')}: ${issue.message}`);
      }
    }
  } catch (e) {
    console.log(`  JSON.parse failed: ${(e as Error).message}`);
  }
}
