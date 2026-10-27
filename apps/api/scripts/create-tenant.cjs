#!/usr/bin/env node
/**
 * create-tenant — parameterised, idempotent tenant creation for bespoke deploys
 * (internal dogfood, partner showcase, migration assists). The deploy template
 * this implements is docs/VISIBLESHELF_INTERNAL_TENANT_SPEC.md §2/§7.
 *
 * Plain Node + node-postgres (same rationale as db-rescue.cjs: no build step,
 * pgbouncer-safe simple query protocol). Reads DIRECT_URL/DATABASE_URL — run
 * through doppler:
 *
 *   doppler run --config prd -- node scripts/create-tenant.cjs \
 *     --name "VisibleShelf Internal" --slug shelfvisible \
 *     --subdomain shelfvisible --tier enterprise \
 *     --owner-email admin@visibleshelf.com --internal
 *
 * Flags:
 *   --name <str>          Tenant display name (required)
 *   --slug <str>          Directory slug (required; unique, lowercase)
 *   --subdomain <str>     Subdomain on the platform apex (optional; unique,
 *                         reserved-name checked, {sub}.{apex} storefront host)
 *   --tier <tier>         shared/tier-contract.json key (default: discovery)
 *   --status <status>     subscription_status (default: active)
 *   --owner-email <email> users.email to grant OWNER membership (recommended)
 *   --internal            Internal-tenant flag set: data_policy_accepted,
 *                         manual_subscription_control, platform_fee_waived,
 *                         metadata.internal — plus seeds the platform NAP into
 *                         tenant_business_profiles_list
 *   --demo                Mark is_demo=true (noindex; excluded from sitemap/dir)
 *   --list-admins         List admin-ish users (owner discovery) and exit
 *   --dry-run             Print the plan and the SQL, change nothing
 *
 * Idempotent: an existing tenant matching slug, subdomain, or name is reported
 * and nothing is written (exit 0), so re-runs are safe.
 */

const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── connection preamble (mirrors db-rescue.cjs) ──────────────────────────────
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DIRECT_URL / DATABASE_URL not set — run under `doppler run --config <env>`');
  process.exit(1);
}
const SSL_PARAMS = /^(sslmode|sslcert|sslkey|sslrootcert|sslcrl|sslcompression|uselibpqcompat)=/;
const [base, ...qs] = dbUrl.split('?');
const cleanUrl = qs.length
  ? `${base}?${qs.join('?').split('&').filter((p) => p && !SSL_PARAMS.test(p)).join('&')}`.replace(/\?$/, '')
  : base;
const client = new Client({
  connectionString: cleanUrl,
  ssl: /localhost|127\.0\.0\.1/.test(cleanUrl) ? false : { rejectUnauthorized: false },
});

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name, dflt) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
}
const has = (name) => args.includes(`--${name}`);

const NAME = flag('name');
const SLUG = (flag('slug') || '').trim().toLowerCase();
const SUBDOMAIN = (flag('subdomain') || '').trim().toLowerCase();
const TIER = flag('tier', 'discovery');
const STATUS = flag('status', 'active');
const OWNER_EMAIL = flag('owner-email');
const INTERNAL = has('internal');
const DEMO = has('demo');
const DRY = has('dry-run');
const LIST_ADMINS = has('list-admins');

// ── id generation (mirrors src/lib/id-generator.ts) ───────────────────────────
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const nanoid = (n) => Array.from(crypto.randomBytes(n)).map((b) => ALPHABET[b % 36]).join('');
const generateTenantId = () => `tid-${nanoid(8)}`;
function generateTenantKey(tenantId) {
  let hash = 0;
  for (let i = 0; i < tenantId.length; i++) {
    hash = ((hash << 5) - hash) + tenantId.charCodeAt(i);
    hash = hash & hash;
  }
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let tempHash = Math.abs(hash);
  let key = '';
  for (let i = 0; i < 4; i++) {
    key += chars[tempHash % chars.length];
    tempHash = Math.floor(tempHash / chars.length);
  }
  return key;
}
const generateUserTenantId = (userId, tenantId) => `utid-${userId}-${generateTenantKey(tenantId)}-${nanoid(5)}`;

// ── reserved lists (mirrors src/lib/subdomain.ts + src/utils/slug.ts) ─────────
const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'admin', 'app', 'mail', 'email', 'cdn', 'static', 'assets',
  'status', 'support', 'help', 'docs', 'blog', 'dashboard', 'account',
  'billing', 'pay', 'checkout', 'store', 'shop', 'dev', 'staging', 'test',
  'ftp', 'smtp', 'ns1', 'ns2', 'localhost', 'internal', 'system', 'visibleshelf',
]);
const RESERVED_PLACE_SLUGS = new Set(['about', 'claim', 'search', 'category', 'city']);
const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$|^[a-z0-9]$/;

// ── platform NAP for --internal business-profile seed ─────────────────────────
const INTERNAL_PROFILE = {
  business_name: 'VisibleShelf',
  address_line1: 'Service-area business',
  city: 'Kansas City',
  state: 'MO',
  postal_code: '64101',
  country_code: 'US',
  phone_number: '+1 913-703-6157',
  email: 'contact@visibleshelf.com',
  website: 'https://visibleshelf.com',
  business_description:
    'VisibleShelf is the local visibility platform for independent retailers. We pre-list your store from public info so shoppers can already find you — claim it free and it becomes a full online presence: storefront, product catalog, Google Shopping feeds, QR codes, and automated Google Business Profile management. Connect Clover or Square in minutes. Plans from $29/mo. Your shelf, made visible.',
  social_links: {
    facebook: 'https://facebook.com/shelfvisible',
    instagram: 'https://instagram.com/shelfvisible',
    tiktok: 'https://tiktok.com/@shelfvisible',
    pinterest: 'https://pinterest.com/shelfvisible',
    x: 'https://x.com/shelfvisible',
  },
};

const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function main() {
  await client.connect();
  const q = async (sql, params) => (await client.query(sql, params)).rows;

  if (LIST_ADMINS) {
    const rows = await q(
      `SELECT id, email, role FROM users
       WHERE role::text ILIKE '%admin%' OR role::text ILIKE '%owner%' OR role::text ILIKE '%support%'
       ORDER BY created_at LIMIT 25`,
    );
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (!NAME || !SLUG) {
    console.error('Required: --name and --slug. See header comment for usage.');
    process.exit(1);
  }

  // tier must exist in the contract fixture
  const fixturePath = path.join(__dirname, '..', '..', '..', 'shared', 'tier-contract.json');
  const tiers = JSON.parse(fs.readFileSync(fixturePath, 'utf8')).tier_order;
  if (!tiers.includes(TIER)) {
    console.error(`Unknown tier '${TIER}'. Valid: ${tiers.join(', ')}`);
    process.exit(1);
  }
  if (!/^[a-z0-9][a-z0-9-]{0,60}[a-z0-9]$/.test(SLUG) || RESERVED_PLACE_SLUGS.has(SLUG)) {
    console.error(`Slug '${SLUG}' is invalid or reserved for /place routes.`);
    process.exit(1);
  }
  if (SUBDOMAIN) {
    if (!SUBDOMAIN_RE.test(SUBDOMAIN)) {
      console.error(`Subdomain '${SUBDOMAIN}' fails the platform format rule.`);
      process.exit(1);
    }
    if (RESERVED_SUBDOMAINS.has(SUBDOMAIN)) {
      console.error(`Subdomain '${SUBDOMAIN}' is reserved for platform infrastructure.`);
      process.exit(1);
    }
  }

  // collision checks
  const conflicts = await q(
    `SELECT id, name, slug, subdomain FROM tenants
     WHERE slug = $1 OR (subdomain IS NOT NULL AND subdomain = $2) OR name = $3`,
    [SLUG, SUBDOMAIN || '\x00', NAME],
  );
  if (conflicts.length) {
    console.log('Existing tenant collides — nothing written:');
    console.log(JSON.stringify(conflicts, null, 2));
    return;
  }

  let owner = null;
  if (OWNER_EMAIL) {
    const rows = await q(`SELECT id, email, role FROM users WHERE email = $1`, [OWNER_EMAIL]);
    if (!rows.length) {
      console.error(`No user with email '${OWNER_EMAIL}'. Use --list-admins to find candidates.`);
      process.exit(1);
    }
    owner = rows[0];
  }

  const tenantId = generateTenantId();
  const metadata = INTERNAL
    ? { internal: true, purpose: 'platform-dogfood' }
    : {};

  const tenantInsert = {
    text: `INSERT INTO tenants
      (id, name, slug, subdomain, created_by,
       subscription_tier, subscription_status, location_status,
       is_demo, data_policy_accepted,
       manual_subscription_control, manual_subscription_reason,
       platform_fee_waived, platform_fee_waived_reason, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,$11,$12,$13,$14::jsonb)`,
    params: [
      tenantId, NAME, SLUG, SUBDOMAIN || null, owner ? owner.id : null,
      TIER, STATUS, DEMO,
      INTERNAL, INTERNAL, INTERNAL ? 'platform internal tenant' : null,
      INTERNAL, INTERNAL ? 'platform internal tenant' : null,
      JSON.stringify(metadata),
    ],
  };

  const membershipInsert = owner
    ? {
        text: `INSERT INTO user_tenants (id, user_id, tenant_id, role, created_at, updated_at)
               VALUES ($1,$2,$3,'OWNER',now(),now())
               ON CONFLICT (user_id, tenant_id) DO NOTHING`,
        params: [generateUserTenantId(owner.id, tenantId), owner.id, tenantId],
      }
    : null;

  const profileInsert = INTERNAL
    ? {
        text: `INSERT INTO tenant_business_profiles_list
          (tenant_id, business_name, address_line1, city, state, postal_code, country_code,
           phone_number, email, website, business_description, social_links, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,now())
         ON CONFLICT (tenant_id) DO NOTHING`,
        params: [
          tenantId,
          INTERNAL_PROFILE.business_name, INTERNAL_PROFILE.address_line1,
          INTERNAL_PROFILE.city, INTERNAL_PROFILE.state, INTERNAL_PROFILE.postal_code,
          INTERNAL_PROFILE.country_code, INTERNAL_PROFILE.phone_number,
          INTERNAL_PROFILE.email, INTERNAL_PROFILE.website,
          INTERNAL_PROFILE.business_description, JSON.stringify(INTERNAL_PROFILE.social_links),
        ],
      }
    : null;

  console.log(`Tenant plan: id=${tenantId} name=${sqlStr(NAME)} slug=${SLUG} subdomain=${SUBDOMAIN || '(none)'}`);
  console.log(`  tier=${TIER} status=${STATUS} demo=${DEMO} internal=${INTERNAL}`);
  console.log(`  owner=${owner ? `${owner.email} (${owner.id})` : '(none)'}`);

  if (DRY) {
    console.log('\nDRY RUN — statements that would run:');
    console.log(tenantInsert.text, tenantInsert.params);
    if (membershipInsert) console.log(membershipInsert.text, membershipInsert.params);
    if (profileInsert) console.log(profileInsert.text, profileInsert.params);
    return;
  }

  await client.query('BEGIN');
  try {
    await client.query(tenantInsert.text, tenantInsert.params);
    if (membershipInsert) await client.query(membershipInsert.text, membershipInsert.params);
    if (profileInsert) await client.query(profileInsert.text, profileInsert.params);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

  const created = await q(
    `SELECT id, name, slug, subdomain, subscription_tier, subscription_status,
            location_status, is_demo FROM tenants WHERE id = $1`,
    [tenantId],
  );
  console.log('\nCreated:');
  console.log(JSON.stringify(created[0], null, 2));
  console.log(`\nDashboard:  https://visibleshelf.com/t/${tenantId}`);
  console.log(`Storefront: https://visibleshelf.com/tenant/${tenantId}`);
  if (SUBDOMAIN) console.log(`Subdomain:  https://${SUBDOMAIN}.visibleshelf.com`);
}

main()
  .catch((err) => { console.error('create-tenant failed:', err.message); process.exitCode = 1; })
  .finally(() => client.end());
