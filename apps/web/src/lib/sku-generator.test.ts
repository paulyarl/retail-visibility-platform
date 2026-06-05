/**
 * Example usage and tests for SKU generator
 */

import { generateSKU, generateTenantKey } from './sku-generator';

// Example 1: Digital product with tenant key
const digitalSKU = generateSKU({
  tenantKey: generateTenantKey('tid-m8ijkrnk'),
  productType: 'digital',
  deliveryMethod: 'direct_download',
  accessControl: 'personal',
});
console.log('Digital Product SKU:', digitalSKU);
// Example output: M8IJ-DIGI-DWNL-PERS-A7K9

// Example 2: Physical product with tenant key
const physicalSKU = generateSKU({
  tenantKey: generateTenantKey('tid-abc123'),
  productType: 'physical',
  deliveryMethod: 'shipping',
  accessControl: 'public',
});
console.log('Physical Product SKU:', physicalSKU);
// Example output: ABC1-PHYS-SHIP-PUBL-B3M2

// Example 3: Hybrid product with external link
const hybridSKU = generateSKU({
  tenantKey: generateTenantKey('tid-xyz789'),
  productType: 'hybrid',
  deliveryMethod: 'external_link',
  accessControl: 'commercial',
});
console.log('Hybrid Product SKU:', hybridSKU);
// Example output: XYZ7-HYBR-LINK-COMM-C5N8

// Example 4: Without tenant key (fallback)
const noTenantSKU = generateSKU({
  productType: 'digital',
  deliveryMethod: 'email_delivery',
  accessControl: 'subscription',
});
console.log('No Tenant SKU:', noTenantSKU);
// Example output: DIGI-MAIL-SUBS-D9P4

// Test tenant key generation consistency
const key1 = generateTenantKey('tid-m8ijkrnk');
const key2 = generateTenantKey('tid-m8ijkrnk');
console.log('Tenant keys match:', key1 === key2); // Should be true (consistent)
console.log('Tenant key for tid-m8ijkrnk:', key1);
