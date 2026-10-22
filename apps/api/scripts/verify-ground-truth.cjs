/**
 * verify-ground-truth.cjs — one-shot probe of the HasData REST contract
 * used by HasDataGroundTruthService: /search resolve → /details → /reviews.
 * Prints field-shape summaries only (no full payload dumps, no key).
 * Usage: doppler run --config prd -- node scripts/verify-ground-truth.cjs <campaign_id>
 */
const { Client } = require('pg');

const API_BASE = 'https://api.hasdata.com/scrape/google-maps';

function stripSsl(url) {
  const u = new URL(url);
  for (const k of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslcrl', 'sslcompression', 'uselibpqcompat']) {
    u.searchParams.delete(k);
  }
  return u.toString();
}

async function hasdata(path, params) {
  const url = `${API_BASE}${path}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { headers: { 'x-api-key': process.env.HASDATA_API_KEY } });
  const body = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body);
}

function shape(o, depth = 0) {
  if (depth > 2 || o === null || typeof o !== 'object') return typeof o;
  if (Array.isArray(o)) return `[${o.length}× ${o.length ? shape(o[0], depth + 1) : 'empty'}]`;
  const keys = Object.keys(o);
  return `{${keys.slice(0, 14).map((k) => `${k}:${typeof o[k]}`).join(', ')}${keys.length > 14 ? '…' : ''}}`;
}

(async () => {
  const campaignId = process.argv[2];
  if (!campaignId) { console.error('usage: node verify-ground-truth.cjs <campaign_id>'); process.exit(1); }

  const db = new Client({ connectionString: stripSsl(process.env.DATABASE_URL), ssl: { rejectUnauthorized: false } });
  await db.connect();
  const { rows } = await db.query(
    'select id, business_name, address_city, address_state, city, state from mkt_campaigns_list where id = $1',
    [campaignId],
  );
  await db.end();
  const c = rows[0];
  if (!c) { console.error('campaign not found'); process.exit(1); }
  const q = [c.business_name, c.address_city ?? c.city, c.address_state ?? c.state].filter(Boolean).join(', ');
  console.log('campaign:', c.business_name, '· query:', q);

  const search = await hasdata('/search', { q });
  console.log('SEARCH top-level:', shape(search));
  console.log('placeResults:', shape(search?.placeResults));
  const pr = search?.placeResults;
  const arr = Array.isArray(pr) ? pr : (pr?.results ?? pr?.localResults ?? pr?.places ?? []);
  const hit = arr[0] ?? (pr?.placeId || pr?.dataId ? pr : null)
    ?? search?.localResults?.[0] ?? search?.local_results?.[0] ?? search?.results?.[0];
  console.log('hit keys:', hit ? Object.keys(hit).join(', ') : 'NONE');
  const placeId = hit?.placeId ?? hit?.place_id ?? null;
  const dataId = hit?.dataId ?? hit?.data_id ?? null;
  console.log('resolved → placeId:', placeId, '· dataId:', dataId);
  if (!placeId && !dataId) { console.log('NO PLACE RESOLVED — normalize path dead-ends here'); process.exit(0); }

  const idParam = placeId ? { placeId } : { dataId };
  const details = await hasdata('/place', idParam);
  const dp = details?.placeResults ?? details;
  console.log('DETAILS placeResults keys:', dp ? Object.keys(dp).slice(0, 40).join(', ') : 'NONE');
  console.log('  title:', dp?.title, '· rating:', dp?.rating, '· reviews:', dp?.reviews, '· type:', dp?.type);
  console.log('  types:', shape(dp?.types), '· website:', dp?.website, '· userReviews:', shape(dp?.userReviews));
  const reviews = await hasdata('/reviews', { ...idParam, sort: 'newestFirst' });
  console.log('REVIEWS topics:', shape(reviews?.topics));
  const r0 = (reviews?.reviews ?? reviews?.userReviews?.reviews ?? [])[0];
  console.log('first review keys:', r0 ? Object.keys(r0).join(', ') : 'no rows');
  console.log('  r0.rating:', r0?.rating, '· date:', r0?.date, '· isoDate:', r0?.isoDate, '· response:', shape(r0?.response));
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
