/**
 * Body-skeleton ↔ schema parity guard.
 *
 * `business_analysis` sits in `LEGACY_NO_SUFFIX_SCHEMAS`
 * (`MarketingExecutionService.resolvePrompt`), so the validator's
 * `BUSINESS_ANALYSIS_PROMPT_SUFFIX` is NEVER appended to a rendered prompt —
 * the embedded JSON skeleton in `business-audit-default-body.md` is the model's
 * only output contract. Agreement between that skeleton and
 * `businessAnalysisSchema` was previously checked by hand (the "parity" passes);
 * this guards it.
 *
 * STRUCTURAL, not value-level: the skeleton's enum fields carry `|`-list
 * placeholders (`"confirmed|ambiguous|mismatched"`) on purpose, so the model
 * does not read them as echoable defaults — those values are deliberately
 * invalid and a `safeParse` of the raw skeleton can never pass. What must hold
 * is that every key the schema declares has a slot in the skeleton.
 *
 * See: AGENTS.md "Default business audit — parity rewrite".
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { businessAnalysisSchema } from '../business-analysis.schema';

const BODY = readFileSync(
  join(__dirname, '../../scripts/business-audit-default-body.md'),
  'utf8',
);

function extractSkeleton(body: string): any {
  const match = body.match(/```json\n([\s\S]*?)\n```/);
  if (!match) throw new Error('no fenced json skeleton found in the audit body');
  return JSON.parse(match[1]);
}

/** Strip optional / nullable / default / readonly / catch / pipe wrappers (zod v4). */
function unwrap(schema: any): any {
  let s = schema;
  for (let i = 0; i < 8 && s?._def; i++) {
    const type = s._def.type;
    if (['optional', 'nullable', 'default', 'readonly', 'catch'].includes(type)) {
      s = s._def.innerType;
      continue;
    }
    if (type === 'pipe') {
      s = s._def.in;
      continue;
    }
    break;
  }
  return s;
}

/** Declared keys of an object node, or null when the node is not an object. */
function objectKeys(schema: any): string[] | null {
  const s = unwrap(schema);
  return s?._def?.type === 'object' && s.shape ? Object.keys(s.shape) : null;
}

const skeleton = extractSkeleton(BODY);
const rootShape = unwrap(businessAnalysisSchema).shape;
const rootKeys = objectKeys(businessAnalysisSchema);
const platformsKeys = objectKeys(rootShape.platforms);
const googleKeys = objectKeys(rootShape.platforms.shape.google);

describe('business-audit body skeleton ↔ schema parity', () => {
  it('extracts a single parseable JSON skeleton', () => {
    expect(typeof skeleton).toBe('object');
    expect(skeleton.platforms?.google).toBeTruthy();
  });

  it('resolves the schema shape for the blocks under test', () => {
    expect(rootKeys).toContain('platforms');
    expect(platformsKeys).toEqual(expect.arrayContaining(['google', 'yelp', 'facebook']));
    expect(googleKeys).toContain('alternate_profiles');
  });

  it('declares alternate_profiles on every primary platform block', () => {
    // The DS_DUPLICATE_LISTING directive names platforms.<platform>.alternate_profiles[],
    // so the skeleton must not imply Google-only — a duplicate can exist on any
    // platform. (This is the drift this guard was added to catch.)
    for (const platform of ['google', 'yelp', 'facebook']) {
      expect(skeleton.platforms[platform], `${platform} block missing`).toHaveProperty(
        'alternate_profiles',
      );
    }
  });

  it('gives every schema top-level key a slot in the skeleton', () => {
    // The skeleton IS the model's output contract — a schema field with no slot
    // here goes unexplained (the parity-2 summary-field defect).
    const missing = (rootKeys ?? []).filter((k) => !(k in skeleton));
    expect(missing).toEqual([]);
  });

  it('gives every google-block schema key a slot in the skeleton', () => {
    const missing = (googleKeys ?? []).filter((k) => !(k in skeleton.platforms.google));
    expect(missing).toEqual([]);
  });
});
