/**
 * IdentityEvidenceService tests — scope resolution, owner-contact reuse, the
 * provenance mirror, and CHECK-constraint parity.
 *
 * The parity suite exists because mkt_identity_evidence's tier / evidence_state
 * / corroborates value sets are enforced by Postgres CHECK constraints that
 * Prisma does not manage (migrations 256/264/270/289 all drifted this way). The
 * service writes its enum members through those constraints, so a test that only
 * asserts the SQL text would stay green while every insert failed with 23514.
 * These tests parse the effective CHECK value sets out of database/migrations
 * and assert the service's emitted values are members.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const { mockQueryRaw, mockExecuteRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw, $executeRaw: mockExecuteRaw },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// IdentityEvidenceService dynamically imports the packet builder for the
// provenance mirror; stub it so the mirror test does not need the full packet
// query surface.
const { mockBuildForCampaign } = vi.hoisted(() => ({
  mockBuildForCampaign: vi.fn(),
}));

vi.mock('../IdentityPacketService', () => ({
  default: { buildForCampaign: mockBuildForCampaign },
}));

import IdentityEvidenceService, { EVIDENCE_PROVENANCE_NOTE } from '../IdentityEvidenceService';
import {
  IDENTITY_EVIDENCE_STATES,
  IDENTITY_FIELD_KEYS,
  IDENTITY_SOURCE_TIERS,
} from '../directory/identityScoring';

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
      const count = fs.readdirSync(candidate).filter((f) => /^\d+_.*\.sql$/.test(f)).length;
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

/** Newest-first migration contents (highest numeric prefix first). */
function migrationsNewestFirst(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
}

/** Effective allowed value set for a `col IN (...)` CHECK. */
function effectiveAllowedValues(
  migrations: string[],
  constraintName: string,
  column: string,
): Set<string> {
  const re = new RegExp(
    `${constraintName}[\\s\\S]*?CHECK\\s*\\(\\s*${column}\\s+IN\\s*\\(([\\s\\S]*?)\\)\\s*\\)`,
    'i',
  );
  for (const sql of migrations) {
    if (!sql.includes(constraintName)) continue;
    const match = sql.match(re);
    if (!match) continue;
    return new Set([...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
  }
  return new Set();
}

/** Effective allowed value set for a `col <@ ARRAY[...]::text[]` CHECK. */
function effectiveArrayMembers(migrations: string[], constraintName: string): Set<string> {
  const re = new RegExp(
    `${constraintName}\\s*CHECK\\s*\\(\\s*corroborates\\s*<@\\s*ARRAY\\s*\\[([\\s\\S]*?)\\]\\s*::text\\[\\]`,
    'i',
  );
  for (const sql of migrations) {
    if (!sql.includes(constraintName)) continue;
    const match = sql.match(re);
    if (!match) continue;
    return new Set([...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
  }
  return new Set();
}

const migrationsDir = findMigrationsDir();
const migrations = migrationsDir ? migrationsNewestFirst(migrationsDir) : [];

/** Interpolated values of the Nth $executeRaw tagged-template call. */
function emittedValues(callIndex = 0): unknown[] {
  return mockExecuteRaw.mock.calls[callIndex].slice(1);
}

const storedRow = {
  id: 'idev-test0001',
  campaign_id: 'camp-1',
  business_prospect_id: 'pros-1',
  source_name: 'Owner phone call',
  source_url: null,
  tier: 'first_party',
  independence_group: 'owner-phone-call',
  evidence_state: 'owner_confirmed',
  corroborates: ['name', 'address', 'phone'],
  owner_name: 'Maria Daree',
  owner_phone: '608-555-0100',
  owner_email: null,
  accessed_at: new Date('2026-09-18T00:00:00Z'),
  notes: null,
  created_by: 'user-1',
  created_at: new Date('2026-09-18T10:00:00Z'),
};

/**
 * Route the mocked raw queries by SQL text. `seedLink` controls whether the
 * campaign looks seeded (drives the provenance mirror).
 */
function stubQueries(options: { seedLink?: boolean; campaigns?: any[] } = {}) {
  const { seedLink = false, campaigns = [] } = options;
  mockQueryRaw.mockImplementation((strings: any, ...values: any[]) => {
    const sql = strings.join('?');
    if (sql.includes('business_prospect_id FROM mkt_campaigns_list')) {
      return Promise.resolve([{ business_prospect_id: 'pros-1' }]);
    }
    if (sql.includes('FROM mkt_identity_evidence') && sql.includes('ORDER BY')) {
      return Promise.resolve([storedRow]);
    }
    if (sql.includes('FROM mkt_identity_evidence WHERE id')) {
      return Promise.resolve([storedRow]);
    }
    if (sql.includes('FROM directory_seed_campaign_links')) {
      return Promise.resolve(seedLink ? [{ seed_id: 'dps-1', tenant_id: 'tid-1' }] : []);
    }
    if (sql.includes('owner_names, phones, email, phone FROM mkt_campaigns_list')) {
      return Promise.resolve(campaigns);
    }
    return Promise.resolve([]);
  });
}

describe('mkt_identity_evidence CHECK constraint parity', () => {
  it('finds the real migrations directory', () => {
    expect(migrationsDir).toBeTruthy();
    expect(migrations.length).toBeGreaterThan(100);
  });

  it('tier CHECK allows exactly the IdentitySourceTier members', () => {
    const allowed = effectiveAllowedValues(migrations, 'chk_identity_evidence_tier', 'tier');
    expect([...allowed].sort()).toEqual([...IDENTITY_SOURCE_TIERS].sort());
  });

  it('evidence_state CHECK allows exactly the IdentityEvidenceState members', () => {
    const allowed = effectiveAllowedValues(
      migrations,
      'chk_identity_evidence_state',
      'evidence_state',
    );
    expect([...allowed].sort()).toEqual([...IDENTITY_EVIDENCE_STATES].sort());
  });

  it('corroborates CHECK allows exactly the IdentityFieldKey members', () => {
    const allowed = effectiveArrayMembers(migrations, 'chk_identity_evidence_corroborates');
    expect([...allowed].sort()).toEqual([...IDENTITY_FIELD_KEYS].sort());
  });

  it('the content CHECK is satisfiable by owner contact alone', () => {
    const sql = migrations.find((s) => s.includes('chk_identity_evidence_content'));
    expect(sql).toBeTruthy();
    expect(sql!).toMatch(/owner_name IS NOT NULL/);
    expect(sql!).toMatch(/owner_phone IS NOT NULL/);
    expect(sql!).toMatch(/owner_email IS NOT NULL/);
  });

  it('the content CHECK actually bites on an empty corroborates array', () => {
    // array_length('{}', 1) is NULL in Postgres and a NULL CHECK passes, so the
    // guard must COALESCE to 0 or it silently allows a contentless row.
    const sql = migrations.find((s) => s.includes('chk_identity_evidence_content'));
    expect(sql).toBeTruthy();
    expect(sql!).toMatch(/COALESCE\s*\(\s*array_length\s*\(\s*corroborates\s*,\s*1\s*\)\s*,\s*0\s*\)\s*>=\s*1/);
  });

  it('no migration leaves an owner-less content constraint in force', () => {
    // 297 rev A shipped chk_identity_evidence_corroborates_nonempty, which
    // rejected owner-contact-only rows. A later migration must drop it.
    const defined = migrations.some((s) => s.includes('chk_identity_evidence_corroborates_nonempty'));
    const dropped = migrations.some((s) =>
      /DROP CONSTRAINT IF EXISTS chk_identity_evidence_corroborates_nonempty/i.test(s),
    );
    if (defined) expect(dropped).toBe(true);
    expect(dropped).toBe(true);
  });
});

describe('IdentityEvidenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteRaw.mockResolvedValue(1);
    mockBuildForCampaign.mockResolvedValue({
      fields: [
        { field: 'name', value: 'Istanbul Super Market' },
        { field: 'address', value: '745 S Gammon Rd, Madison, WI 53719' },
        { field: 'phone', value: '(608) 277-1771' },
        { field: 'website', value: null },
        { field: 'hours', value: null },
        { field: 'primary_category', value: 'Middle Eastern Grocery Store' },
        { field: 'snap_ebt', value: null },
        { field: 'attributes', value: null },
      ],
    });
    stubQueries();
  });

  it('resolves the prospect scope so sibling campaigns share one ledger', async () => {
    const scope = await IdentityEvidenceService.resolveScope('camp-1');
    expect(scope).toEqual({ campaignId: 'camp-1', businessProspectId: 'pros-1' });
  });

  it('infers the tier from the source name when none is given', async () => {
    await IdentityEvidenceService.create({
      campaignId: 'camp-1',
      sourceName: 'Indiana Secretary of State',
      corroborates: ['name', 'address'],
    });

    const values = emittedValues();
    expect(values).toContain('authoritative');
    // Independence group is a slug of the source name, so a second spelling of
    // the same platform discounts instead of double-counting.
    expect(values).toContain('indiana-secretary-of-state');
    expect(values).toContain('observed');
  });

  it('rejects a source that carries neither a field nor owner contact', async () => {
    await expect(
      IdentityEvidenceService.create({ campaignId: 'camp-1', sourceName: 'Some blog' }),
    ).rejects.toThrow(/evidence_empty/);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('accepts owner contact on its own (no corroborated fields)', async () => {
    await IdentityEvidenceService.create({
      campaignId: 'camp-1',
      sourceName: 'Owner phone call',
      ownerPhone: '608-555-0100',
    });

    const [strings] = mockExecuteRaw.mock.calls[0];
    const sql = strings.join('?');
    expect(sql).toContain('INSERT INTO mkt_identity_evidence');
    // Empty text[] cast — the CHECK allows it when owner contact is present.
    expect(emittedValues()).toContainEqual([]);
  });

  it('drops unknown field keys instead of failing the CHECK', async () => {
    await IdentityEvidenceService.create({
      campaignId: 'camp-1',
      sourceName: 'Google Business Profile',
      corroborates: ['name', 'not_a_field' as any],
    });

    expect(emittedValues()).toContainEqual(['name']);
  });

  it('does not mirror provenance when the campaign has no linked seed', async () => {
    await IdentityEvidenceService.create({
      campaignId: 'camp-1',
      sourceName: 'Google Business Profile',
      corroborates: ['name'],
    });

    expect(mockBuildForCampaign).not.toHaveBeenCalled();
    expect(
      mockExecuteRaw.mock.calls.some((c: any) => c[0].join('?').includes('directory_field_provenance')),
    ).toBe(false);
  });

  it('mirrors corroborated fields into provenance with DO NOTHING', async () => {
    stubQueries({ seedLink: true });
    await IdentityEvidenceService.create({
      campaignId: 'camp-1',
      sourceName: 'USDA SNAP retailer list',
      corroborates: ['name', 'address'],
      accessedAt: '2026-09-18',
    });

    expect(mockBuildForCampaign).toHaveBeenCalledWith('camp-1');
    const provenanceCalls = mockExecuteRaw.mock.calls.filter((c: any) =>
      c[0].join('?').includes('directory_field_provenance'),
    );
    expect(provenanceCalls).toHaveLength(2);
    const sql = provenanceCalls[0][0].join('?');
    expect(sql).toContain('ON CONFLICT (seed_id, field_key) DO NOTHING');
    // Never auto-publishes operator evidence to the public listing.
    expect(sql).toContain('false');
    // Resolved value comes from the packet, not a duplicated canonicalization.
    expect(provenanceCalls[0].slice(1)).toContain('Istanbul Super Market');
    expect(provenanceCalls[0].slice(1)).toContain('high'); // authoritative → high confidence
    expect(provenanceCalls[0].slice(1)).toContain(EVIDENCE_PROVENANCE_NOTE);
  });

  it('back-fills owner contact onto the prospect group, filling empty slots only', async () => {
    stubQueries({
      campaigns: [
        {
          id: 'camp-1',
          owner_names: [],
          phones: [],
          email: null,
          phone: null,
        },
        {
          // Already carries the same contact on every channel → nothing to fill.
          id: 'camp-2',
          owner_names: ['Maria Daree'],
          phones: [{ label: 'owner', number: '608-555-0100' }],
          email: 'maria@example.com',
          phone: '608-555-9999',
        },
      ],
    });

    await IdentityEvidenceService.create({
      campaignId: 'camp-1',
      sourceName: 'Owner phone call',
      ownerName: 'Maria Daree',
      ownerPhone: '608-555-0100',
      ownerEmail: 'maria@example.com',
    });

    const updates = mockExecuteRaw.mock.calls.filter((c: any) =>
      c[0].join('?').includes('UPDATE mkt_campaigns_list'),
    );
    // The fully-populated sibling is skipped — a value on file is never clobbered.
    expect(updates).toHaveLength(1);
    const values = updates[0].slice(1);
    expect(values).toContain(JSON.stringify(['Maria Daree']));
    expect(values).toContain(JSON.stringify([{ label: 'owner', number: '608-555-0100' }]));
    expect(values).toContain('maria@example.com');
  });

  it('retracts the provenance rows it wrote when evidence is removed', async () => {
    stubQueries({ seedLink: true });
    await IdentityEvidenceService.remove('idev-test0001');

    const deletes = mockExecuteRaw.mock.calls.map((c: any) => c[0].join('?'));
    expect(deletes.some((sql: string) => sql.includes('DELETE FROM mkt_identity_evidence'))).toBe(true);
    const provenanceDelete = mockExecuteRaw.mock.calls.find((c: any) =>
      c[0].join('?').includes('DELETE FROM directory_field_provenance'),
    );
    expect(provenanceDelete).toBeTruthy();
    // Scoped to rows this service wrote — an upsert by another writer changes
    // source_name/notes and is therefore left alone.
    expect(provenanceDelete.slice(1)).toContain(EVIDENCE_PROVENANCE_NOTE);
    expect(provenanceDelete.slice(1)).toContainEqual(['name', 'address', 'phone']);
  });

  it('reports a missing row on remove', async () => {
    mockQueryRaw.mockImplementation(() => Promise.resolve([]));
    expect(await IdentityEvidenceService.remove('idev-missing')).toBe(false);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });
});
