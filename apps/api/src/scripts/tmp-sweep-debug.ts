import { prisma } from '../prisma';
import CategoryMarketEnrichmentService from '../services/CategoryMarketEnrichmentService';

// Diagnostic: apply the real analyst packet for one market directly, to
// surface whatever error the import's best-effort catch is swallowing.
const packet: any = {
  category_name: 'African Grocery Store',
  category_key: 'african_grocery_store',
  city: 'Kansas City',
  state: 'MO',
  meta_title: 'African Grocery Stores in Kansas City, MO — VisibleShelf Places',
  description: 'Browse African grocery stores in Kansas City, Missouri. VisibleShelf lists markets from public information.',
  keywords: ['african grocery store', 'african market kansas city'],
  secondary_categories: ['Somali Grocery Store', 'Halal Grocery Store'],
  schema_type_hint: 'CollectionPage',
  body_copy: 'African grocery stores in Kansas City, Missouri are gathered on this page.',
  category_overview: 'An African grocery store is a walk-in food retailer.',
  super_categories: ['Grocery Stores', 'Food Retail'],
  sub_categories: ['East African Grocery'],
  adjacent_categories: ['Somali Grocery Store'],
  shopper_guide: 'Check whether a shop publishes a halal meat counter.',
  faq: [{ question: 'Where are African grocery stores located in Kansas City?', answer: 'Independence Avenue corridor.' }],
  context: { category_summary: 'Anchored by the Independence Avenue corridor.' },
};

async function main() {
  try {
    const result = await CategoryMarketEnrichmentService.getInstance().applyEnrichmentPacket({
      campaign: { id: 'mcamp-0ofyel0t', category: packet.category_name, city: packet.city, state: packet.state },
      packet,
      executionId: 'mpe-37etlxkl',
      enrichedBy: null,
    });
    console.log('APPLY OK:', JSON.stringify(result));
  } catch (err) {
    console.error('APPLY FAILED:', (err as Error).message);
    console.error((err as Error).stack?.split('\n').slice(0, 8).join('\n'));
  }
}

main().finally(() => prisma.$disconnect());
