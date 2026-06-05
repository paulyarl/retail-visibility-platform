#!/usr/bin/env node
/**
 * GBP Categories Seeder
 * 
 * Seeds the gbp_categories table with stub data for pilot testing.
 * In Phase 2, this will be replaced with real data from Google's API.
 * 
 * Usage:
 *   doppler run --config local -- node seed-gbp-categories.js
 *   doppler run --config dev -- node seed-gbp-categories.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Stub GBP categories for pilot testing
// These are common business categories from Google Business Profile
const GBP_CATEGORIES = [
  { id: 'gcid:restaurant', name: 'Restaurant', displayName: 'Restaurant' },
  { id: 'gcid:cafe', name: 'Cafe', displayName: 'Café' },
  { id: 'gcid:bar', name: 'Bar', displayName: 'Bar' },
  { id: 'gcid:fast_food_restaurant', name: 'Fast Food Restaurant', displayName: 'Fast Food Restaurant' },
  { id: 'gcid:pizza_restaurant', name: 'Pizza Restaurant', displayName: 'Pizza Restaurant' },
  { id: 'gcid:bakery', name: 'Bakery', displayName: 'Bakery' },
  { id: 'gcid:coffee_shop', name: 'Coffee Shop', displayName: 'Coffee Shop' },
  { id: 'gcid:ice_cream_shop', name: 'Ice Cream Shop', displayName: 'Ice Cream Shop' },
  
  { id: 'gcid:clothing_store', name: 'Clothing Store', displayName: 'Clothing Store' },
  { id: 'gcid:shoe_store', name: 'Shoe Store', displayName: 'Shoe Store' },
  { id: 'gcid:jewelry_store', name: 'Jewelry Store', displayName: 'Jewelry Store' },
  { id: 'gcid:department_store', name: 'Department Store', displayName: 'Department Store' },
  { id: 'gcid:electronics_store', name: 'Electronics Store', displayName: 'Electronics Store' },
  { id: 'gcid:furniture_store', name: 'Furniture Store', displayName: 'Furniture Store' },
  { id: 'gcid:home_goods_store', name: 'Home Goods Store', displayName: 'Home Goods Store' },
  { id: 'gcid:sporting_goods_store', name: 'Sporting Goods Store', displayName: 'Sporting Goods Store' },
  { id: 'gcid:book_store', name: 'Book Store', displayName: 'Book Store' },
  { id: 'gcid:toy_store', name: 'Toy Store', displayName: 'Toy Store' },
  
  { id: 'gcid:grocery_store', name: 'Grocery Store', displayName: 'Grocery Store' },
  { id: 'gcid:supermarket', name: 'Supermarket', displayName: 'Supermarket' },
  { id: 'gcid:convenience_store', name: 'Convenience Store', displayName: 'Convenience Store' },
  { id: 'gcid:liquor_store', name: 'Liquor Store', displayName: 'Liquor Store' },
  
  { id: 'gcid:hair_salon', name: 'Hair Salon', displayName: 'Hair Salon' },
  { id: 'gcid:beauty_salon', name: 'Beauty Salon', displayName: 'Beauty Salon' },
  { id: 'gcid:nail_salon', name: 'Nail Salon', displayName: 'Nail Salon' },
  { id: 'gcid:spa', name: 'Spa', displayName: 'Spa' },
  { id: 'gcid:barber_shop', name: 'Barber Shop', displayName: 'Barber Shop' },
  
  { id: 'gcid:gym', name: 'Gym', displayName: 'Gym' },
  { id: 'gcid:fitness_center', name: 'Fitness Center', displayName: 'Fitness Center' },
  { id: 'gcid:yoga_studio', name: 'Yoga Studio', displayName: 'Yoga Studio' },
  
  { id: 'gcid:hotel', name: 'Hotel', displayName: 'Hotel' },
  { id: 'gcid:motel', name: 'Motel', displayName: 'Motel' },
  { id: 'gcid:bed_and_breakfast', name: 'Bed and Breakfast', displayName: 'Bed & Breakfast' },
  
  { id: 'gcid:car_dealer', name: 'Car Dealer', displayName: 'Car Dealer' },
  { id: 'gcid:auto_repair_shop', name: 'Auto Repair Shop', displayName: 'Auto Repair Shop' },
  { id: 'gcid:gas_station', name: 'Gas Station', displayName: 'Gas Station' },
  { id: 'gcid:car_wash', name: 'Car Wash', displayName: 'Car Wash' },
  
  { id: 'gcid:real_estate_agency', name: 'Real Estate Agency', displayName: 'Real Estate Agency' },
  { id: 'gcid:insurance_agency', name: 'Insurance Agency', displayName: 'Insurance Agency' },
  { id: 'gcid:bank', name: 'Bank', displayName: 'Bank' },
  { id: 'gcid:atm', name: 'ATM', displayName: 'ATM' },
  
  { id: 'gcid:dentist', name: 'Dentist', displayName: 'Dentist' },
  { id: 'gcid:doctor', name: 'Doctor', displayName: 'Doctor' },
  { id: 'gcid:hospital', name: 'Hospital', displayName: 'Hospital' },
  { id: 'gcid:pharmacy', name: 'Pharmacy', displayName: 'Pharmacy' },
];

async function main() {
  console.log('🏷️  GBP Categories Seeder\n');
  
  console.log(`📦 Seeding ${GBP_CATEGORIES.length} GBP categories...\n`);
  
  let created = 0;
  let updated = 0;
  
  for (const category of GBP_CATEGORIES) {
    const result = await prisma.gBPCategory.upsert({
      where: { id: category.id },
      update: {
        name: category.name,
        displayName: category.displayName,
        isActive: true,
      },
      create: {
        id: category.id,
        name: category.name,
        displayName: category.displayName,
        isActive: true,
      },
    });
    
    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
    } else {
      updated++;
    }
  }
  
  console.log('📊 Summary:');
  console.log('━'.repeat(60));
  console.log(`Total Categories: ${GBP_CATEGORIES.length}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log('━'.repeat(60));
  
  console.log('\n🎉 Seeding completed successfully!\n');
  console.log('💡 Note: These are stub categories for pilot testing.');
  console.log('   In Phase 2, these will be synced from Google\'s API.\n');
  
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
