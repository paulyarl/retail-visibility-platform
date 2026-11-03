/**
 * Completion gate (spec §12.5): no Content API for Shopping literals may
 * survive in apps/api/src. A line may opt out ONLY with an explicit
 * `// completion-gate-allow:` marker + reason (the gmc.ts authinfo interim).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../..');
const FORBIDDEN = [
  'shoppingcontent.googleapis.com',
  'content/v2.1',
  'custombatch',
  'products/batch',
  'online:en:',
];

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(entry.name === '.' ? dir : dir, entry.name);
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'generated') continue;
      yield* walk(full);
    } else if (/\.(ts|js)$/.test(entry.name)) {
      yield full;
    }
  }
}

describe('Content API completion gate', () => {
  it('no unmarked Content API literals in apps/api/src', () => {
    const violations: string[] = [];
    for (const file of walk(SRC)) {
      if (file === __filename) continue;
      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, i) => {
        if (line.includes('completion-gate-allow')) return;
        for (const needle of FORBIDDEN) {
          if (line.includes(needle)) {
            violations.push(`${path.relative(SRC, file)}:${i + 1} contains '${needle}'`);
          }
        }
      });
    }
    expect(violations).toEqual([]);
  });
});
