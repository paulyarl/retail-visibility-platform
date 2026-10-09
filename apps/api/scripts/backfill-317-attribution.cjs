/* One-off backfill: mkt_discovery_attributions rows for bp-6jnnq50a
 * (Arsema G Food Mart LLC) — migration 317.
 * Run: doppler run --config prd -- node scripts/backfill-317-attribution.cjs
 */
const { Client } = require('pg');
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const client = new Client({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url || '') ? false : { rejectUnauthorized: false },
});

const PROSPECT = 'bp-6jnnq50a';
const CAMPAIGN = 'mcamp-uvcasj3e';
const QUEUE = 'pque-sq1679ff';

const rows = [
  {
    id: 'dattr-bf-em01',
    source_campaign_id: 'mcamp-che54a5m',
    source_audit_id: 'maud-ujwlckjr',
    focus: 'emerging',
    source_category: 'African Grocery Store',
    business_seek_priority: 'high',
    category_fit: 'verified',
    identity_confidence: 'high',
    location_status: 'inside_city',
    discovery_signals: JSON.stringify([
      'INT_UNDEREXPOSED_CREDENTIAL', 'INT_MULTISOURCE_IDENTITY',
      'INT_ACTIVE_OPERATIONAL_EVIDENCE', 'INT_CATEGORY_SPECIALIZATION',
      'INT_VERTICAL_SOURCE_DISCOVERY', 'INT_POSSIBLE_CATEGORY_MISALIGNMENT',
    ]),
    discovery_provenance: JSON.stringify([
      { url: 'https://indiana-company.com/co/arsema-g-food-mart-llc', role: 'certification', source: 'Indiana Secretary of State Business Services Division (INBiz)', accessed_at: '2026-02-18', evidence_types: ['entity_registration', 'active_standing', 'principal_office_address'] },
      { url: 'https://www.affordablehousing411.com/food-assistances/snap-retailer-details-arsema-g-foodmart-llc-001-2724-w-10th-st-indianapolis-in-46222/', role: 'vertical_directory', source: 'USDA Food and Nutrition Service - SNAP Retailer Locator', accessed_at: '2026-02-18', evidence_types: ['snap_authorization', 'physical_address'] },
      { url: 'https://www.importgenius.com/importers/arsema-g-food-mart-llc', role: 'certification', source: 'ImportGenius (US Customs)', accessed_at: '2026-02-18', evidence_types: ['import_manifest', 'supplier_relationship', 'product_specialization'] },
    ]),
    bronze_attribution: JSON.stringify([
      { basis: 'platform-presence audit: operating storefront with no Yelp/Facebook profile', reason_key: 'absent_from_platform' },
      { basis: 'category-taxonomy sweep: GBP primary category "Convenience store" for a full Ethiopian grocery', reason_key: 'misaligned_platform_category' },
      { basis: 'endonym / transliteration sweep: "Arsema" carries no English category token', reason_key: 'no_category_token_in_name' },
      { basis: 'customs / trade records: importer of record with teff, berbere and shiro on the manifest', reason_key: 'trade_manifest_only' },
      { basis: 'identity-conflict detection: "Ethiopian Eritrean Store" at the same address and phone', reason_key: 'alternate_identity' },
      { basis: 'site-scoped sweep: arsemamart.square.site is the only web surface', reason_key: 'hosted_storefront_only' },
    ]),
    competitive_weaknesses: JSON.stringify([]),
    discovered_at: '2026-09-11T00:22:46.519Z',
  },
  {
    id: 'dattr-bf-cm01',
    source_campaign_id: 'mcamp-le9bilwj',
    source_audit_id: 'maud-xzrucw0z',
    focus: 'competitive',
    source_category: 'African Grocery Store',
    business_seek_priority: 'high',
    category_fit: 'verified',
    identity_confidence: 'high',
    location_status: 'inside_city',
    discovery_signals: JSON.stringify([
      'INT_UNDEREXPOSED_CREDENTIAL', 'INT_MULTISOURCE_IDENTITY',
      'INT_ACTIVE_OPERATIONAL_EVIDENCE', 'INT_CATEGORY_SPECIALIZATION',
      'INT_VERTICAL_SOURCE_DISCOVERY', 'INT_POSSIBLE_CATEGORY_MISALIGNMENT',
    ]),
    discovery_provenance: JSON.stringify([
      { url: 'https://indiana-company.com/co/arsema-g-food-mart-llc', role: 'certification', source: 'Indiana Secretary of State (INBiz)', accessed_at: '2026-09-10', evidence_types: ['entity', 'principal_office'] },
      { url: 'https://www.affordablehousing411.com/food-assistances/snap-retailer-details-arsema-g-foodmart-llc-001-2724-w-10th-st-indianapolis-in-46222/', role: 'vertical_directory', source: 'USDA FNS SNAP Retailer Locator (mirror)', accessed_at: '2026-09-10', evidence_types: ['snap_authorization', 'address'] },
    ]),
    bronze_attribution: JSON.stringify([]),
    competitive_weaknesses: JSON.stringify([
      { basis: 'GBP primary category is "Convenience store" while the shop sells Ethiopian staples', weakness_key: 'category_drift' },
      { basis: 'registry/SNAP principal office (2724 W 10th St) differs from the storefront address (6667 W Washington St)', weakness_key: 'nap_drift' },
    ]),
    discovered_at: '2026-09-30T19:12:15.853Z',
  },
];

(async () => {
  await client.connect();
  for (const r of rows) {
    await client.query(
      `INSERT INTO mkt_discovery_attributions (
         id, business_prospect_id, campaign_id, queue_entry_id,
         source_campaign_id, source_audit_id, source_execution_id,
         focus, source_category, business_seek_priority, category_fit,
         identity_confidence, location_status,
         discovery_signals, discovery_provenance, bronze_attribution,
         competitive_weaknesses, discovered_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18)
       ON CONFLICT (id) DO NOTHING`,
      [
        r.id, PROSPECT, CAMPAIGN, QUEUE,
        r.source_campaign_id, r.source_audit_id, null,
        r.focus, r.source_category, r.business_seek_priority, r.category_fit,
        r.identity_confidence, r.location_status,
        r.discovery_signals, r.discovery_provenance, r.bronze_attribution,
        r.competitive_weaknesses, r.discovered_at,
      ],
    );
    console.log('inserted', r.id);
  }
  const check = await client.query(
    `SELECT id, source_campaign_id, focus, jsonb_array_length(bronze_attribution) AS bronze_n,
            jsonb_array_length(competitive_weaknesses) AS weak_n
     FROM mkt_discovery_attributions WHERE business_prospect_id = $1`, [PROSPECT]);
  console.log(JSON.stringify(check.rows, null, 2));
  await client.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
