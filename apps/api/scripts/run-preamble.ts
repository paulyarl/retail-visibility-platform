import { buildGroundTruthPreamble } from '../src/services/hasdata-ground-truth-directive';

(async () => {
  const campaignId = process.argv[2];
  const level = process.argv[3] ?? 'latest';
  const out = await buildGroundTruthPreamble(campaignId, { google_maps_ground_truth: level });
  console.log('=== PREAMBLE OUTPUT ===');
  console.log(out || '(empty string)');
})().catch((e) => { console.error('THREW:', e); process.exit(1); });
