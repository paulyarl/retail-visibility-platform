const { Client } = require('pg');

const FROM =
  'This text will appear on a public directory listing page that visitors and the business owner will see, and it is the primary long-tail SEO surface for unclaimed listings — it must help the listing rank for the searches real customers actually type.';
const TO =
  "This copy has two readers: the operator, who sees it in the seed report as the summary of what public sources established about the business, and the general public, who reads it on the business's own page. Write for both — depth on ownership, history, operations and the range of what the business carries, drawn only from verified public information. It is NOT the directory shelf card: the category-identification pass owns that surface, and its shorter, shopper-facing copy wins there.";

(async () => {
  const u = new URL(process.env.DATABASE_URL);
  u.searchParams.delete('sslmode');
  const c = new Client({
    connectionString: u.toString(),
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const before = await c.query(
    `SELECT (body LIKE '%BUSINESS-PAGE COPY%') AS new_ba,
            (body LIKE '%it must help the listing rank%') AS old_ba
       FROM mkt_prompt_templates_list WHERE id = 'mpt-seed-seek-001'`,
  );
  console.log('before:', before.rows[0]);

  const upd = await c.query(
    `UPDATE mkt_prompt_templates_list
        SET body = replace(body, $1, $2), updated_at = now()
      WHERE id = 'mpt-seed-seek-001'
        AND body LIKE '%' || $3 || '%'
      RETURNING id`,
    [FROM, TO, 'it must help the listing rank for the searches real customers actually type.'],
  );
  console.log('rows updated:', upd.rowCount);

  const after = await c.query(
    `SELECT (body LIKE '%BUSINESS-PAGE COPY%') AS new_ba,
            (body LIKE '%it must help the listing rank%') AS old_ba,
            (body LIKE '%NOT the directory shelf card%') AS boundary
       FROM mkt_prompt_templates_list WHERE id = 'mpt-seed-seek-001'`,
  );
  console.log('after:', after.rows[0]);

  await c.end();
})().catch((e) => {
  console.error('failed:', e.message);
  process.exit(1);
});
