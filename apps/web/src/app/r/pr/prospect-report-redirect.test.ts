import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';

const { resolveCode } = vi.hoisted(() => ({ resolveCode: vi.fn() }));
vi.mock('@/services/ProspectReportPublicService', async (importOriginal) => {
  const mod = await importOriginal<any>();
  return {
    ...mod,
    default: { resolveCode },
    prospectReportPublicService: { resolveCode },
  };
});

// next/navigation stubs — redirect/notFound throw sentinel errors.
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import ProspectReportShortPage from './[code]/page';

describe('/r/pr/[code] redirect page', () => {
  beforeEach(() => {
    resolveCode.mockReset();
  });

  it('static /r/pr/[code] page exists alongside /r/[shortCode] (static wins in App Router)', () => {
    const appDir = path.resolve(__dirname, '..', '..');
    expect(existsSync(path.join(appDir, 'r', 'pr', '[code]', 'page.tsx'))).toBe(true);
    // The legacy catch-all also exists — the fixture assertion pins that
    // both routes coexist; Next.js resolves the static 'pr' segment first.
    expect(existsSync(path.join(appDir, 'r', '[shortCode]'))).toBe(true);
  });

  it('redirects to the signed-token report URL for a valid code', async () => {
    resolveCode.mockResolvedValue('/prospect-report/abc.def');
    await expect(
      ProspectReportShortPage({ params: Promise.resolve({ code: 'K7M2XN' }) }),
    ).rejects.toThrow('NEXT_REDIRECT:/prospect-report/abc.def');
    expect(resolveCode).toHaveBeenCalledWith('K7M2XN');
  });

  it('notFounds on an unknown/revoked code', async () => {
    resolveCode.mockResolvedValue(null);
    await expect(
      ProspectReportShortPage({ params: Promise.resolve({ code: 'BAD123' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
