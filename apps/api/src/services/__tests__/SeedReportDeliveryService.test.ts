/**
 * SeedReportDeliveryService tests — delivery-touch idempotency + constraint parity.
 *
 * The constraint-parity suite exists because the delivery-touch insert silently
 * violated the directory_seed_outreach_touches CHECK constraints (G12 in
 * docs/LocalBiz/QR_OUTREACH_PIPELINE_INTEGRATION_SPEC.md): the previous test
 * only asserted the SQL text, so it stayed green while every insert was
 * rejected by Postgres. These tests assert the emitted channel/outcome values
 * against the effective CHECK value sets parsed from database/migrations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const { mockExecuteRaw } = vi.hoisted(() => ({
  mockExecuteRaw: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: { $executeRaw: mockExecuteRaw },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: {
    frontendUrl: 'https://app.example.com',
    webUrl: 'https://app.example.com',
    get: vi.fn(() => null),
  },
}));

vi.mock('../marketing/MarketingReceiptPdfService', () => ({
  loadPlatformBranding: vi.fn().mockResolvedValue({
    platformName: 'Visible Shelf',
    primaryColor: '#000000',
  }),
}));

vi.mock('qrcode', () => ({
  default: { toBuffer: vi.fn() },
}));

import SeedReportDeliveryService, {
  type ReportDeliveryKit,
  type ReportDeliveryChannel,
} from '../intelligence/SeedReportDeliveryService';

const kit: ReportDeliveryKit = {
  seedId: 'seed-1',
  reportVersion: 4,
  reportStatus: 'complete',
  token: 'claim-token',
  shortCode: 'abc123',
  qrUrlPhone: 'https://app.example.com/rp/abc123',
  qrUrlEmail: 'https://app.example.com/re/abc123',
  qrUrlSocial: 'https://app.example.com/rs/abc123',
  qrUrlInPerson: 'https://app.example.com/r/abc123',
  qrUrlText: 'https://app.example.com/rt/abc123',
  reportPreviewUrl: 'https://app.example.com/seed-report/seed-1',
  claimUrl: 'https://app.example.com/place/claim/claim-token',
  businessName: 'Acme Market',
  expiresAt: null,
};

/** Interpolated values of the Nth $executeRaw tagged-template call. */
function emittedValues(callIndex = 0): unknown[] {
  return mockExecuteRaw.mock.calls[callIndex].slice(1);
}

/** Canonical DB channel each report-delivery channel must map onto (spec §5.3.1). */
const EXPECTED_TOUCH_CHANNEL: Array<[ReportDeliveryChannel, string]> = [
  ['phone', 'call'],
  ['email', 'email'],
  ['social', 'other'],
  ['in_person', 'visit'],
  ['text', 'sms'],
];

// ─── Constraint-parity helpers ──────────────────────────────────────────────

/**
 * Locate the repo's database/migrations directory. There is a decoy
 * `apps/api/database/migrations` with a handful of unrelated legacy files, so
 * we walk every ancestor and pick the candidate with the most numbered
 * migrations (the real one).
 */
function findMigrationsDir(): string | null {
  let dir = process.cwd();
  let best: string | null = null;
  let bestCount = 0;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'database', 'migrations');
    if (fs.existsSync(candidate)) {
      const count = fs
        .readdirSync(candidate)
        .filter((f) => /^\d+_.*\.sql$/.test(f)).length;
      if (count > bestCount) {
        best = candidate;
        bestCount = count;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return best;
}

/**
 * Effective allowed value set for a named column CHECK. The last migration
 * (highest numeric prefix) that drops + re-adds the constraint wins, mirroring
 * how Postgres applies them.
 */
function effectiveAllowedValues(
  dir: string,
  constraintName: string,
  column: string,
): Set<string> {
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    if (!sql.includes(constraintName)) continue;
    const re = new RegExp(
      `${constraintName}[\\s\\S]*?CHECK\\s*\\(\\s*${column}\\s+IN\\s*\\(([\\s\\S]*?)\\)\\s*\\)`,
      'i',
    );
    const match = sql.match(re);
    if (!match) continue;
    return new Set([...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
  }
  return new Set();
}

const migrationsDir = findMigrationsDir();

describe('SeedReportDeliveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteRaw.mockResolvedValue(1);
  });

  it('uses a UUID and idempotent seed-touch insert for report delivery', async () => {
    await SeedReportDeliveryService.recordDeliveryEvent(kit, 'email', 'operator-1');

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    const [strings] = mockExecuteRaw.mock.calls[0];
    const sql = strings.join('?');
    expect(sql).toContain('INSERT INTO directory_seed_outreach_touches');
    expect(sql).toContain('::uuid');
    expect(sql).toContain('WHERE NOT EXISTS');
    expect(sql).toContain("outcome = 'report_delivered'");
  });

  it.each(EXPECTED_TOUCH_CHANNEL)(
    'maps report channel %s onto canonical touch channel %s',
    async (channel, canonical) => {
      await SeedReportDeliveryService.recordDeliveryEvent(kit, channel, null);

      const [strings] = mockExecuteRaw.mock.calls[0];
      const values = emittedValues();
      expect(values).toContain(canonical);
      // 'report_delivered' is a SQL literal, not an interpolated value.
      expect(strings.join('?')).toContain("'report_delivered'");
      // The raw report channel name must not leak into the channel column
      // (skip when the canonical value is identical, e.g. email → email).
      if (channel !== canonical) {
        expect(values).not.toContain(channel);
      }
    },
  );

  it('preserves the human-readable report channel in the delivery note', async () => {
    await SeedReportDeliveryService.recordDeliveryEvent(kit, 'in_person', null);

    const note = emittedValues().find(
      (v): v is string => typeof v === 'string' && v.startsWith('Report v'),
    );
    expect(note).toContain('delivered via in_person');
  });

  describe('CHECK-constraint parity (G12 regression)', () => {
    it.skipIf(!migrationsDir)(
      'emitted channels are all permitted by the effective channel CHECK',
      async () => {
        const allowed = effectiveAllowedValues(
          migrationsDir as string,
          'directory_seed_outreach_touches_channel_check',
          'channel',
        );
        expect(allowed.size).toBeGreaterThan(0);

        for (const [channel] of EXPECTED_TOUCH_CHANNEL) {
          mockExecuteRaw.mockClear();
          await SeedReportDeliveryService.recordDeliveryEvent(kit, channel, null);
          const canonical = EXPECTED_TOUCH_CHANNEL.find(([c]) => c === channel)![1];
          expect(
            allowed.has(canonical),
            `channel '${canonical}' (from report channel '${channel}') is not in the CHECK set: ${[...allowed].join(', ')}`,
          ).toBe(true);
        }
      },
    );

    it.skipIf(!migrationsDir)(
      "the 'report_delivered' outcome is permitted by the effective outcome CHECK",
      () => {
        const allowed = effectiveAllowedValues(
          migrationsDir as string,
          'directory_seed_outreach_touches_outcome_check',
          'outcome',
        );
        expect(allowed.size).toBeGreaterThan(0);
        expect(
          allowed.has('report_delivered'),
          `'report_delivered' is not in the CHECK set: ${[...allowed].join(', ')}`,
        ).toBe(true);
      },
    );
  });
});
