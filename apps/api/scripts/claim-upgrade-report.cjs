#!/usr/bin/env node
/**
 * claim-upgrade-report — claim → upgrade conversion for directory_presence
 * seeds (claim handoff spec "Measurement" section).
 *
 * Plain Node + node-postgres (same constraints as db-rescue: no prepared
 * statements, no implicit transaction). Reads DIRECT_URL/DATABASE_URL —
 * run through doppler:
 *
 *   doppler run --config prd -- node scripts/claim-upgrade-report.cjs report
 *
 * Commands:
 *   report [--days N] [--window N] [--verbose]
 *       Claims in the last N days (default 30; 0 = all time), each joined to
 *       the tenant's first directory_tier_upgrade audit event within N days
 *       of the claim (default 14 — the spec's metric window). Prints totals,
 *       conversion rate, claim-path split (self-serve vs operator-approved),
 *       and upgrade-src attribution. --verbose adds per-claim rows.
 *
 * Event sources:
 *   - claim  = directory_presence_seeds.claimed_at (authoritative — stamped
 *              on both the self-serve accept and operator-approval paths)
 *   - upgrade = audit_log rows with metadata->>'audit_action' = 'directory_tier_upgrade';
 *              rows written before audit() started recording the raw action
 *              name fall back to the diff-key heuristic (diff ? 'targetTier'
 *              AND 'billingCycle').
 *   - src    = diff->>'src' on the upgrade event ('claim_success' from the
 *              post-claim CTA, 'claim_welcome_email' from the welcome email).
 */

const { Client } = require('pg');
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const SSL_PARAMS = /^(sslmode|sslcert|sslkey|sslrootcert|sslcrl|sslcompression|uselibpqcompat)=/;
const [base, ...qs] = (dbUrl || '').split('?');
const cleanUrl = qs.length
  ? `${base}?${qs.join('?').split('&').filter((p) => p && !SSL_PARAMS.test(p)).join('&')}`.replace(/\?$/, '')
  : base;
const client = new Client({
  connectionString: cleanUrl,
  ssl: /localhost|127\.0\.0\.1/.test(cleanUrl) ? false : { rejectUnauthorized: false },
});
const q = async (sql) => (await client.query(sql)).rows;

const args = process.argv.slice(2);
const cmd = args[0];
function flag(name, dflt) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
}
const has = (name) => args.includes(name);
const intFlag = (name, dflt) => {
  const v = flag(name, String(dflt));
  if (!/^\d+$/.test(v)) throw new Error(`--${name} must be a non-negative integer`);
  return Number(v);
};

const CLAIM_WINDOW_SQL = (days) =>
  days > 0 ? `AND s.claimed_at >= now() - interval '${days} days'` : '';

async function report() {
  const days = intFlag('days', 30);
  const window = intFlag('window', 14);
  const verbose = has('--verbose');

  const rows = await q(`
    WITH claims AS (
      SELECT
        s.id AS seed_id,
        s.tenant_id,
        s.claimed_at,
        dl.business_name,
        EXISTS (
          SELECT 1 FROM directory_claim_requests r
          WHERE r.seed_id = s.id AND r.status = 'approved'
        ) AS via_approval,
        t.subscription_tier AS current_tier
      FROM directory_presence_seeds s
      JOIN tenants t ON t.id = s.tenant_id
      JOIN directory_listings_list dl ON dl.id = s.listing_id
      WHERE s.status = 'claimed'
        ${CLAIM_WINDOW_SQL(days)}
    ),
    ups AS (
      SELECT
        a.diff->>'tenantId'   AS tenant_id,
        a.occurred_at         AS upgraded_at,
        a.diff->>'targetTier' AS target_tier,
        a.diff->>'src'        AS src,
        ROW_NUMBER() OVER (PARTITION BY a.diff->>'tenantId' ORDER BY a.occurred_at) AS rn
      FROM audit_log a
      WHERE a.metadata->>'audit_action' = 'directory_tier_upgrade'
         OR (a.diff ? 'targetTier' AND a.diff ? 'billingCycle')
    )
    SELECT
      c.seed_id, c.tenant_id, c.business_name, c.claimed_at, c.via_approval,
      c.current_tier,
      u.target_tier, u.src, u.upgraded_at
    FROM claims c
    LEFT JOIN ups u
      ON u.tenant_id = c.tenant_id
     AND u.rn = 1
     AND u.upgraded_at >= c.claimed_at
     AND u.upgraded_at <= c.claimed_at + interval '${window} days'
    ORDER BY c.claimed_at DESC
  `);

  // Upgrade events before any claim exist only if something else flipped the
  // tier — count them so missing joins are visible rather than silent.
  const orphanUpgrades = await q(`
    SELECT count(*)::int AS n FROM audit_log a
    WHERE a.metadata->>'audit_action' = 'directory_tier_upgrade'
       OR (a.diff ? 'targetTier' AND a.diff ? 'billingCycle')
  `);

  // Intake stage — claims=0 hides demand sitting in the review queue.
  const intake = await q(`
    SELECT status, count(*)::int AS n
    FROM directory_claim_requests
    GROUP BY status
  `);

  const claims = rows.length;
  const converted = rows.filter((r) => r.target_tier);
  const selfServe = rows.filter((r) => !r.via_approval);
  const approval = rows.filter((r) => r.via_approval);
  const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');

  console.log(`\nClaim → upgrade conversion (claims last ${days || 'all'} days, upgrade window ${window}d)\n`);
  if (intake.length) {
    console.log(`claim requests by status: ${intake.map((r) => `${r.status}=${r.n}`).join(', ')}`);
    if (intake.some((r) => r.status === 'pending')) {
      console.log(`  ⚠ pending requests are waiting on operator review — approve/reject at /settings/admin/directory/presence-seeds`);
    }
    console.log('');
  }
  console.log(`claims:                ${claims}`);
  console.log(`upgraded in window:    ${converted.length}  (${pct(converted.length, claims)})`);
  console.log(`  self-serve:          ${selfServe.filter((r) => r.target_tier).length}/${selfServe.length}  (${pct(selfServe.filter((r) => r.target_tier).length, selfServe.length)})`);
  console.log(`  operator-approved:   ${approval.filter((r) => r.target_tier).length}/${approval.length}  (${pct(approval.filter((r) => r.target_tier).length, approval.length)})`);

  const bySrc = {};
  for (const r of converted) bySrc[r.src || '(none)'] = (bySrc[r.src || '(none)'] || 0) + 1;
  console.log(`\nupgrade src:`);
  if (!converted.length) console.log('  (no upgrades yet)');
  for (const [k, n] of Object.entries(bySrc).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${n}`);
  }

  const stillFree = rows.filter((r) => !r.target_tier && r.current_tier === 'directory_presence').length;
  const offGatewayLate = rows.filter((r) => !r.target_tier && r.current_tier !== 'directory_presence');
  console.log(`\nstill on directory_presence: ${stillFree}`);
  if (offGatewayLate.length) {
    console.log(`off gateway outside window (tier changed late or via admin): ${offGatewayLate.length}`);
    offGatewayLate.forEach((r) => console.log(`  ${r.business_name} → ${r.current_tier}`));
  }
  console.log(`\ntotal upgrade audit events seen: ${orphanUpgrades[0]?.n ?? 0}`);
  if (!(orphanUpgrades[0]?.n)) {
    console.log(`  (zero — either no upgrades have happened, or the audit flag was off`);
    console.log(`   when they did. Claims alone still show above.)`);
  }

  if (verbose) {
    console.log(`\nper-claim detail:`);
    rows.forEach((r) =>
      console.log(
        `  ${String(r.claimed_at).slice(0, 10)}  ${r.business_name}  ` +
          `${r.via_approval ? 'approval' : 'self-serve'}  ` +
          (r.target_tier ? `→ ${r.target_tier} (${r.src || 'no src'})` : '— not upgraded'),
      ),
    );
  }
}

async function main() {
  if (!dbUrl) {
    console.error('DIRECT_URL/DATABASE_URL not set — run under doppler.');
    process.exit(1);
  }
  await client.connect();
  try {
    if (cmd === 'report' || !cmd) return await report();
    console.error(`unknown command: ${cmd} (try: report)`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
