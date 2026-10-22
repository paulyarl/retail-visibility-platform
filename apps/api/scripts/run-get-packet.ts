import HasDataGroundTruthService from '../src/services/HasDataGroundTruthService';

(async () => {
  const campaignId = process.argv[2];
  const level = (process.argv[3] ?? 'latest') as 'latest' | 'deep';
  const packet = await HasDataGroundTruthService.getPacket(campaignId, level);
  if (!packet) {
    console.log('getPacket → null (unavailable)');
    process.exit(1);
  }
  console.log(JSON.stringify({
    business_name: packet.business_name,
    primary_type: packet.primary_type,
    types: packet.types,
    rating: packet.rating,
    review_count: packet.review_count,
    place_id: packet.place_id,
    review_corpus_size: packet.review_corpus_size,
    owner_response_rate: packet.owner_response_rate_observable,
    latest_review_at: packet.latest_review_at,
    topics: packet.topics,
    credits_spent: packet.credits_spent,
    website: packet.website,
  }, null, 1));
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
