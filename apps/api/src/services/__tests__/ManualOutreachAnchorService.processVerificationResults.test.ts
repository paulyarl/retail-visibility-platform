/**
 * ManualOutreachAnchorService.processVerificationResults — the anchor-path
 * NAP write-back, and the wedge-fidelity recompute it now triggers.
 *
 * A fact confirmation/correction stamps nap_verified_at / nap_owner_corrected,
 * which are wedge-fidelity verdict inputs (an attested NAP makes the listing
 * authoritative over the audit canonical — see evaluateSeedFidelity). Without
 * the recompute, a seed verified after its publish-time verdict keeps that
 * verdict forever and suppresses every claim surface.
 *
 * The method is private and reached only from much larger public flows, so it
 * is exercised directly through the instance.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockExecuteRaw, mockAudit, mockComputeFidelity } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockAudit: vi.fn(),
  mockComputeFidelity: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
  },
}));

vi.mock('../../audit', () => ({ audit: mockAudit }));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateDirectoryFieldProvenanceId: () => 'dfp-test',
  generateManualOutreachAnchorId: () => 'anchor-test',
  generateOutreachLogId: () => 'mol-test',
}));

vi.mock('../seed-fidelity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../seed-fidelity')>()),
  computeAndStoreSeedFidelity: mockComputeFidelity,
}));

import ManualOutreachAnchorService from '../intelligence/ManualOutreachAnchorService';

const CTX = { userId: 'op-1' } as any;

const run = (results: any[], callResult: string) =>
  (ManualOutreachAnchorService as any).processVerificationResults(
    'seed-1',
    results,
    callResult,
    CTX,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryRaw.mockResolvedValue([{ tenant_id: 'ten-1', listing_id: 'lst-1' }]);
  mockExecuteRaw.mockResolvedValue(1);
  mockComputeFidelity.mockResolvedValue('thin');
});

describe('processVerificationResults', () => {
  it('recomputes fidelity after a connected fact confirmation', async () => {
    await run([{ type: 'fact_confirmed', field: 'phone', value: '(317) 603-3274' }], 'connected');

    expect(mockComputeFidelity).toHaveBeenCalledWith('seed-1');
    // The verification ledger row and the nap_verified_at stamp both landed
    // before the recompute, so the verdict is computed against attested NAP.
    const sqlText = mockExecuteRaw.mock.calls.map((c) => (c[0] as readonly string[]).join(''));
    expect(sqlText.some((s) => s.includes('directory_seed_nap_verifications'))).toBe(true);
    expect(sqlText.some((s) => s.includes('nap_verified_at'))).toBe(true);
    const recomputeAt = mockComputeFidelity.mock.invocationCallOrder[0];
    const stampAt = mockExecuteRaw.mock.calls.findIndex((c) =>
      (c[0] as readonly string[]).join('').includes('nap_verified_at'),
    );
    expect(mockExecuteRaw.mock.invocationCallOrder[stampAt]).toBeLessThan(recomputeAt);
  });

  it('recomputes fidelity after a connected fact correction', async () => {
    await run(
      [{ type: 'fact_corrected', field: 'address', previous_value: '6667 W Washington St', new_value: '6667 W Washington St, Unit A' }],
      'connected',
    );

    expect(mockComputeFidelity).toHaveBeenCalledWith('seed-1');
    const sqlText = mockExecuteRaw.mock.calls.map((c) => (c[0] as readonly string[]).join(''));
    expect(sqlText.some((s) => s.includes('nap_owner_corrected'))).toBe(true);
  });

  it('does not recompute when nothing was verified', async () => {
    await run([{ type: 'pain_discovered', field: 'pain' }], 'connected');

    expect(mockComputeFidelity).not.toHaveBeenCalled();
  });

  it('does not recompute on an unconnected call — no fact can be verified', async () => {
    await run([{ type: 'fact_confirmed', field: 'phone', value: '(317) 603-3274' }], 'no_answer');

    expect(mockComputeFidelity).not.toHaveBeenCalled();
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('keeps the verification writes when the recompute fails', async () => {
    mockComputeFidelity.mockRejectedValue(new Error('db down'));

    await expect(
      run([{ type: 'fact_confirmed', field: 'phone', value: '(317) 603-3274' }], 'connected'),
    ).resolves.toBeUndefined();

    const sqlText = mockExecuteRaw.mock.calls.map((c) => (c[0] as readonly string[]).join(''));
    expect(sqlText.some((s) => s.includes('directory_seed_nap_verifications'))).toBe(true);
    expect(mockAudit).toHaveBeenCalled();
  });
});
