/**
 * Script to sync availability status for all items in a tenant
 * Usage: node sync-availability.js <tenantId>
 */

const tenantId = process.argv[2] || 'chain_location_1762183000976_0';
const apiUrl = process.env.API_URL || 'http://localhost:4000';

async function syncAvailability() {
  try {
    console.log(`Syncing availability for tenant: ${tenantId}`);
    
    const response = await fetch(`${apiUrl}/items/sync-availability`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenantId }),
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Success!');
      console.log(`   Total items: ${result.total}`);
      console.log(`   Synced items: ${result.synced}`);
      console.log(`   Message: ${result.message}`);
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

syncAvailability();
