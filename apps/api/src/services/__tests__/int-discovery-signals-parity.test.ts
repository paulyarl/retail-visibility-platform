/**
 * INT_* discovery-signal parity + display-only guard (spec §S1 / §5).
 *
 * The signal registry (mkt_signal_registry) is the runtime authority for
 * INT_* codes; this test guards the three static surfaces that must stay
 * in parity with it:
 *
 *   1. seed-intelligence-discovery-signals.ts — the code list that seeds
 *      the registry rows.
 *   2. INT_SIGNAL_LABELS in MarketingCampaignService.ts — label map used
 *      when rendering campaign-level signal context.
 *   3. INT_SIGNAL_LABELS in MarketingExecutionService.ts — the second,
 *      independently maintained label map.
 *
 * §S1 invariant: INT_* codes are display-only intelligence signals. They
 * must never appear in KNOWN_SIGNAL_CODES (the business-signal union that
 * feeds detected_signals, triage, and playbook evaluation).
 *
 * File-parse approach (same pattern as the CHECK-constraint parity tests):
 * the two service modules pull heavy dependency graphs; parsing the source
 * keeps this guard fast and side-effect free.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = resolve(__dirname, '..', '..');

const seedSrc = readFileSync(
  resolve(SRC, 'scripts/seed-intelligence-discovery-signals.ts'),
  'utf-8',
);
const campaignSrc = readFileSync(
  resolve(SRC, 'services/MarketingCampaignService.ts'),
  'utf-8',
);
const executionSrc = readFileSync(
  resolve(SRC, 'services/MarketingExecutionService.ts'),
  'utf-8',
);
const taxonomySrc = readFileSync(
  resolve(SRC, 'services/triage/signal-taxonomy.ts'),
  'utf-8',
);

/** `code: 'INT_FOO'` entries in the seed's INTELLIGENCE_DISCOVERY_SIGNALS array. */
const seedCodes = [...seedSrc.matchAll(/code:\s*'(INT_[A-Z_]+)'/g)].map((m) => m[1]);

/** Keys inside the INT_SIGNAL_LABELS literal of a service source. */
const labelMapCodes = (src: string): string[] => {
  const mapBody = src.match(/INT_SIGNAL_LABELS[^=]*=\s*\{([\s\S]*?)\};/);
  expect(mapBody, 'INT_SIGNAL_LABELS map not found').toBeTruthy();
  return [...mapBody![1].matchAll(/(INT_[A-Z_]+):/g)].map((m) => m[1]);
};

const campaignLabels = labelMapCodes(campaignSrc);
const executionLabels = labelMapCodes(executionSrc);

describe('INT_* discovery-signal parity (spec §S1)', () => {
  it('the seed list is non-empty and uniquely coded', () => {
    expect(seedCodes.length).toBeGreaterThanOrEqual(12);
    expect(new Set(seedCodes).size).toBe(seedCodes.length);
  });

  it('includes the platform-signal-divergence code', () => {
    expect(seedCodes).toContain('INT_PLATFORM_SIGNAL_DIVERGENCE');
  });

  it('both label maps carry exactly the seeded INT codes', () => {
    for (const code of seedCodes) {
      expect(campaignLabels, `MarketingCampaignService missing label for ${code}`).toContain(code);
      expect(executionLabels, `MarketingExecutionService missing label for ${code}`).toContain(code);
    }
    // No stale labels for codes the seed no longer registers.
    for (const code of campaignLabels) expect(seedCodes).toContain(code);
    for (const code of executionLabels) expect(seedCodes).toContain(code);
  });

  it('INT_* codes never enter the business-signal union (display-only)', () => {
    const knownBlock = taxonomySrc.match(/KNOWN_SIGNAL_CODES\s*=\s*\[([\s\S]*?)\]/);
    expect(knownBlock, 'KNOWN_SIGNAL_CODES not found').toBeTruthy();
    for (const code of seedCodes) {
      expect(knownBlock![1], `${code} must not be a triage/business signal`).not.toContain(code);
    }
  });

  it('the signal extractor never emits INT_* codes', () => {
    const extractorSrc = readFileSync(
      resolve(SRC, 'services/triage/signal-extractor.ts'),
      'utf-8',
    );
    // INT codes may only appear as the 'INT' family tag, never as an emitted code.
    const emitted = [...extractorSrc.matchAll(/'(INT_[A-Z_]+)'/g)].map((m) => m[1]);
    expect(emitted).toHaveLength(0);
  });
});
