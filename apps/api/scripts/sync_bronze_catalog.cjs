const { Client } = require('pg');

function clientFor(connectionString) {
  const u = new URL(connectionString);
  u.searchParams.delete('sslmode');
  return new Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
}

(async () => {
  const prodUrl = process.env.PROD_DATABASE_URL;
  const localUrl = process.env.LOCAL_DATABASE_URL;
  if (!prodUrl || !localUrl) throw new Error('PROD_DATABASE_URL and LOCAL_DATABASE_URL must be set');

  const src = clientFor(prodUrl);
  const dst = clientFor(localUrl);
  await src.connect();
  await dst.connect();

  const { rows } = await src.query('select * from mkt_bronze_reason_catalog order by reason_key');
  let written = 0;
  for (const r of rows) {
    await dst.query(
      `insert into mkt_bronze_reason_catalog
         (reason_key, label, definition, signals, expected_vectors, priority,
          scope_category_key, scope_city, scope_state, scope_platform,
          provenance, introduced_in_revision, revised_in_revision,
          deprecated_in_revision, deprecated_reason, superseded_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       on conflict (reason_key) do update set
         label = excluded.label,
         definition = excluded.definition,
         signals = excluded.signals,
         expected_vectors = excluded.expected_vectors,
         priority = excluded.priority,
         scope_category_key = excluded.scope_category_key,
         scope_city = excluded.scope_city,
         scope_state = excluded.scope_state,
         scope_platform = excluded.scope_platform,
         provenance = excluded.provenance,
         introduced_in_revision = excluded.introduced_in_revision,
         revised_in_revision = excluded.revised_in_revision,
         deprecated_in_revision = excluded.deprecated_in_revision,
         deprecated_reason = excluded.deprecated_reason,
         superseded_by = excluded.superseded_by,
         updated_at = now()`,
      [
        r.reason_key, r.label, r.definition,
        JSON.stringify(r.signals ?? []), JSON.stringify(r.expected_vectors ?? []), r.priority,
        r.scope_category_key, r.scope_city, r.scope_state, r.scope_platform,
        r.provenance, r.introduced_in_revision, r.revised_in_revision,
        r.deprecated_in_revision, r.deprecated_reason, r.superseded_by,
      ],
    );
    written += 1;
  }

  const rev = await src.query("select catalog_revision from mkt_bronze_catalog_meta where id = 'catalog'");
  const target = rev.rows[0]?.catalog_revision ?? null;
  if (target != null) {
    await dst.query(
      "update mkt_bronze_catalog_meta set catalog_revision = $1, updated_at = now() where id = 'catalog'",
      [target],
    );
  }

  console.log(`synced ${written} reasons; local meta now at revision ${target}`);
  await src.end();
  await dst.end();
})().catch((e) => {
  console.error('catalog sync failed:', e.message);
  process.exit(1);
});
