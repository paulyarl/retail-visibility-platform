/**
 * Phase 5.2 — the generated doc blocks are build artefacts of the fixture.
 *
 * For every registered block in scripts/gen-tier-doc-blocks.cjs, re-render it
 * from shared/tier-contract.json and diff against the on-disk marker content.
 * A stale doc fails here — fix with:
 *   node apps/api/scripts/gen-tier-doc-blocks.cjs --write
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import gen from '../../../scripts/gen-tier-doc-blocks.cjs';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');

describe('5.2 — generated doc blocks match the fixture', () => {
  for (const [relPath, blocks] of Object.entries(gen.TARGETS as Record<string, string[]>)) {
    const abs = path.join(ROOT, relPath);
    describe(relPath, () => {
      it('file exists', () => {
        expect(existsSync(abs), `${relPath} is missing`).toBe(true);
      });
      for (const name of blocks) {
        it(`${name} block is in sync`, () => {
          const text = readFileSync(abs, 'utf8');
          const have = gen.extractBlock(text, name);
          expect(have, `${name} markers missing from ${relPath}`).not.toBeNull();
          expect(
            have,
            `${name} is stale — regenerate with: node apps/api/scripts/gen-tier-doc-blocks.cjs --write`,
          ).toBe(gen.renderBlock(name));
        });
      }
    });
  }
});
