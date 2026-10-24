#!/usr/bin/env node
/**
 * check-backfill-enrichment — verify the 50-seed backfill-enrichment run
 * (2026-10-24). Reports status + enrichment coverage per seed so any gap
 * (e.g. the one seed without an SEO packet) is obvious.
 *
 *   doppler run --config prd -- node scripts/check-backfill-enrichment.cjs
 *   doppler run --config local -- node scripts/check-backfill-enrichment.cjs
 *
 * Plain node-postgres, same connection rules as db-rescue.cjs.
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

const SEED_IDS = [
  'dps-EPU6-3j68jsug', 'dps-CS2B-03vpr5v0', 'dps-RL3W-9oyi1md9', 'dps-F26B-0fmivqaz',
  'dps-XG25-4hslfvc4', 'dps-SAJ6-98rec57w', 'dps-9K4L-opdsd1xv', 'dps-94TA-gnfgftsn',
  'dps-8ZQW-4imzpa7u', 'dps-F7QN-brbu8a54', 'dps-U2QX-6qyj2lpg', 'dps-QDC9-auwxfwn2',
  'dps-UY9V-l83w4apn', 'dps-PJA6-mo3ooquw', 'dps-3ACN-93f1cgfp', 'dps-8ETG-r03u601u',
  'dps-87S5-aunnhq4r', 'dps-AC76-8gin3i0l', 'dps-RF7V-3eikwp9e', 'dps-JVDF-ykx3sxg8',
  'dps-Z755-6x1tjvo2', 'dps-U82B-h9qof5k5', 'dps-4TJ7-hehsckn1', 'dps-4YU5-96rryytr',
  'dps-VGPC-ygwgi81f', 'dps-DWJ7-7iauxabc', 'dps-8LZ6-zeq2v0vt', 'dps-5TXH-m3d4f0vs',
  'dps-JER6-w1pt34jm', 'dps-NLHX-eql4kpz1', 'dps-WA6W-1qt8shlx', 'dps-ZAX6-ad1zwitb',
  'dps-YTZQ-wj95o295', 'dps-XVGH-itg7zmig', 'dps-P86R-gb6z8uol', 'dps-MFGE-y0cgwbf0',
  'dps-RH74-kph55gbb', 'dps-TRKR-60gyvhot', 'dps-URZY-lhreobml', 'dps-3ZCE-vfxusu56',
  'dps-WX8K-35f7tqm9', 'dps-XAT3-3tqc27he', 'dps-2CFD-jac9jinh', 'dps-SVUM-5e12ffcj',
  'dps-FWLU-wygorhla', 'dps-P55S-afyqv3xt', 'dps-R5TM-vpimsjts', 'dps-ZSL2-8jiq3fik',
  'dps-ARHB-48779r1z', 'dps-JLQ8-jh3834vy',
];

(async () => {
  try {
    if (!dbUrl) throw new Error('No DATABASE_URL/DIRECT_URL — run via doppler run --config <env>');
    await client.connect();

    const { rows } = await client.query(
      `SELECT s.id, s.status, dl.business_name,
              s.seo_enrichment IS NOT NULL AS has_seo_json,
              NULLIF(BTRIM(dl.description), '') IS NOT NULL AS has_description,
              COALESCE(array_length(dl.keywords, 1), 0) > 0 AS has_keywords,
              COALESCE(array_length(dl.same_as, 1), 0) > 0 AS has_same_as,
              COALESCE(jsonb_array_length(dl.attributes), 0) AS attribute_chips,
              (SELECT count(*) FROM directory_field_provenance p WHERE p.seed_id = s.id) AS prov_rows
       FROM directory_presence_seeds s
       JOIN directory_listings_list dl ON dl.id = s.listing_id
       WHERE s.id = ANY($1::varchar[])
       ORDER BY s.id`,
      [SEED_IDS],
    );

    const gaps = rows.filter(
      (r) => !r.has_seo_json || !r.has_description || !r.has_keywords,
    );
    console.log(JSON.stringify(rows, null, 2));
    console.log(`\n${rows.length}/${SEED_IDS.length} seeds found, ${gaps.length} with gaps:`);
    for (const g of gaps) {
      console.log(
        `  ${g.id} (${g.business_name || '?'}) status=${g.status}` +
          `${g.has_seo_json ? '' : ' missing:seo_enrichment'}` +
          `${g.has_description ? '' : ' missing:description'}` +
          `${g.has_keywords ? '' : ' missing:keywords'}`,
      );
    }
  } catch (err) {
    console.error(`\nerror: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
