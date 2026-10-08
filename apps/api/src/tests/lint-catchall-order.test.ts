/**
 * lint-catchall-order — dynamic param shadowing detection
 *
 * Two behaviours are pinned here:
 *
 * 1. Aliased routers are detected. The original pattern was anchored to the
 *    literal identifier `router`, so `routes/directory-photos.ts` (which does
 *    `const r = Router()` and declares `r.put(...)`) was invisible to the lint
 *    — and a real `/:photoId` shadowing `reorder` violation shipped undetected.
 *
 * 2. Routes on different router identifiers are NOT compared. A file may hold
 *    several routers mounted under different prefixes (routes/business-hours.ts
 *    mounts `router` and `publicBusinessHoursRouter` at different paths), and
 *    comparing across them produces false positives.
 */
import { describe, it, expect, vi, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

import { extractRouteEntry, scanFileForParamShadowing } from '../scripts/lint-catchall-order';

const dir = mkdtempSync(join(tmpdir(), 'lint-catchall-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

let caseNo = 0;
function scan(source: string) {
  const file = join(dir, `case-${++caseNo}.ts`);
  writeFileSync(file, source);
  return scanFileForParamShadowing(file);
}

describe('extractRouteEntry', () => {
  it('reads routes declared on an aliased router identifier', () => {
    const entry = extractRouteEntry(
      'r.put("/:listingId/photos/reorder", requireDirectoryPhotoWrite, async (req, res) => {',
      339
    );
    expect(entry).toEqual({
      line: 339,
      routerName: 'r',
      method: 'put',
      path: '/:listingId/photos/reorder',
      raw: expect.any(String),
    });
  });

  it('ignores lines that are not route declarations', () => {
    expect(extractRouteEntry('const r = Router();', 1)).toBeNull();
  });

  it('matches inside comments — filtering them is the scanner\u2019s job', () => {
    // extractRouteEntry is a pure line matcher. scanFileForParamShadowing is
    // what skips `//` lines and block comments before calling it. Asserted so
    // the split of responsibility stays deliberate rather than accidental.
    expect(extractRouteEntry('// r.put("/x/:photoId", handler);', 2)).not.toBeNull();
  });
});

describe('scanFileForParamShadowing', () => {
  it('flags a static sibling declared after a dynamic one on the same router', () => {
    const violations = scan(
      [
        'const r = Router();',
        'r.put("/:listingId/photos/:photoId", handler);',
        'r.put("/:listingId/photos/reorder", handler);',
      ].join('\n')
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].paramLine).toBe(2);
    expect(violations[0].staticLine).toBe(3);
  });

  it('does not flag static-before-dynamic ordering', () => {
    const violations = scan(
      [
        'const r = Router();',
        'r.put("/:listingId/photos/reorder", handler);',
        'r.put("/:listingId/photos/:photoId", handler);',
      ].join('\n')
    );

    expect(violations).toHaveLength(0);
  });

  it('does not compare routes declared on different router identifiers', () => {
    // Mirrors routes/business-hours.ts: two routers, mounted under different
    // prefixes, so `:tenantId` cannot shadow `special`.
    const violations = scan(
      [
        'const router = Router();',
        'const publicBusinessHoursRouter = Router();',
        'router.get("/business-hours/:tenantId", handler);',
        'publicBusinessHoursRouter.get("/business-hours/special", handler);',
      ].join('\n')
    );

    expect(violations).toHaveLength(0);
  });

  it('still flags shadowing within a non-default alias', () => {
    const violations = scan(
      [
        'const api = Router();',
        'api.get("/stores/:storeId", handler);',
        'api.get("/stores/summary", handler);',
      ].join('\n')
    );

    expect(violations).toHaveLength(1);
  });

  it('ignores commented-out route declarations', () => {
    const violations = scan(
      [
        'const r = Router();',
        '// r.put("/:listingId/photos/:photoId", handler);',
        'r.put("/:listingId/photos/reorder", handler);',
      ].join('\n')
    );

    expect(violations).toHaveLength(0);
  });
});
