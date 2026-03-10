// Test the adaptive compression implementation
import contextCacheManager, { AppContext } from './contextCacheManager';

async function testAdaptiveCompression() {
  // Use the singleton instance instead of creating a new one
  const manager = contextCacheManager;
  
  // Test data of different sizes
  const smallData = { message: "Hello World" };
  const mediumData = { 
    products: Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `Product ${i}`,
      description: `This is a detailed description for product ${i} with lots of text to compress`.repeat(10),
      price: Math.random() * 100,
      category: `Category ${i % 10}`
    }))
  };
  const largeData = {
    catalog: Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Product ${i}`,
      description: `Very detailed description for product ${i}`.repeat(50),
      specifications: {
        weight: Math.random() * 10,
        dimensions: { length: Math.random() * 100, width: Math.random() * 100, height: Math.random() * 100 },
        materials: Array.from({ length: 20 }, (_, j) => `Material ${j}`),
        features: Array.from({ length: 30 }, (_, j) => `Feature ${j}: ${`Detailed feature description ${j}`.repeat(5)}`)
      },
      reviews: Array.from({ length: 50 }, (_, j) => ({
        rating: Math.random() * 5,
        comment: `Review comment ${j}`.repeat(10),
        reviewer: `User ${j}`
      }))
    }))
  };

  console.log('=== Adaptive Compression Test ===\n');

  // Test different contexts with different compression levels
  const contexts = [
    { context: AppContext.PRODUCT, name: 'Product (Level 9, Brotli)', data: largeData },
    { context: AppContext.TENANT, name: 'Tenant (Level 6, Gzip)', data: mediumData },
    { context: AppContext.STORE, name: 'Store (Level 4, Gzip)', data: mediumData },
    { context: AppContext.ADMIN, name: 'Admin (No Compression)', data: smallData }
  ];

  for (const { context, name, data } of contexts) {
    console.log(`Testing ${name}:`);
    console.log(`Original size: ${JSON.stringify(data).length} bytes`);
    
    await manager.set(context, 'test-key', data);
    
    const retrieved = await manager.get(context, 'test-key');
    console.log(`Retrieved successfully: ${!!retrieved}`);
    console.log(`Data integrity: ${JSON.stringify(retrieved) === JSON.stringify(data)}`);
    console.log('---');
  }

  // Show compression stats
  const stats = manager.getStats();
  console.log('\n=== Compression Statistics ===');
  console.log(JSON.stringify(stats, null, 2));
}

// Run the test
testAdaptiveCompression().catch(console.error);
