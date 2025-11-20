/**
 * Testing framework for case transformation utilities
 * Validates both API and frontend transform approaches
 */

import { transformToCamel, transformToSnake, TransformOptions } from './case-transform';

export interface TransformTestCase {
  name: string;
  input: any;
  expectedCamel: any;
  expectedSnake: any;
  options?: TransformOptions;
}

/**
 * Test cases covering common transformation scenarios
 */
export const transformTestCases: TransformTestCase[] = [
  {
    name: 'Simple business profile',
    input: {
      business_name: 'Acme Corp',
      tenant_id: '123',
      created_at: '2025-01-01'
    },
    expectedCamel: {
      businessName: 'Acme Corp',
      tenantId: '123',
      createdAt: '2025-01-01'
    },
    expectedSnake: {
      business_name: 'Acme Corp',
      tenant_id: '123',
      created_at: '2025-01-01'
    }
  },
  
  {
    name: 'Nested object (deep transform)',
    input: {
      tenant_id: '123',
      business_profile: {
        business_name: 'Test Store',
        address_line1: '123 Main St',
        contact_info: {
          phone_number: '555-1234',
          email_address: 'test@example.com'
        }
      }
    },
    expectedCamel: {
      tenantId: '123',
      businessProfile: {
        businessName: 'Test Store',
        addressLine1: '123 Main St',
        contactInfo: {
          phoneNumber: '555-1234',
          emailAddress: 'test@example.com'
        }
      }
    },
    expectedSnake: {
      tenant_id: '123',
      business_profile: {
        business_name: 'Test Store',
        address_line1: '123 Main St',
        contact_info: {
          phone_number: '555-1234',
          email_address: 'test@example.com'
        }
      }
    },
    options: { deep: true }
  },
  
  {
    name: 'Array of objects',
    input: {
      items: [
        { item_id: '1', item_name: 'Product 1', price_cents: 1000 },
        { item_id: '2', item_name: 'Product 2', price_cents: 2000 }
      ]
    },
    expectedCamel: {
      items: [
        { itemId: '1', itemName: 'Product 1', priceCents: 1000 },
        { itemId: '2', itemName: 'Product 2', priceCents: 2000 }
      ]
    },
    expectedSnake: {
      items: [
        { item_id: '1', item_name: 'Product 1', price_cents: 1000 },
        { item_id: '2', item_name: 'Product 2', price_cents: 2000 }
      ]
    },
    options: { deep: true }
  },
  
  {
    name: 'Mixed case (should auto-detect)',
    input: {
      businessName: 'Already Camel',
      tenant_id: 'Mixed Case',
      normalField: 'No Change'
    },
    expectedCamel: {
      businessName: 'Already Camel',
      tenantId: 'Mixed Case',
      normalField: 'No Change'
    },
    expectedSnake: {
      business_name: 'Already Camel',
      tenant_id: 'Mixed Case',
      normal_field: 'No Change'
    },
    options: { autoDetect: false } // Force transform
  },
  
  {
    name: 'Whitelist transform',
    input: {
      business_name: 'Transform This',
      tenant_id: 'Transform This Too',
      keep_snake: 'Keep This Snake',
      another_field: 'Keep This Too'
    },
    expectedCamel: {
      businessName: 'Transform This',
      tenantId: 'Transform This Too',
      keep_snake: 'Keep This Snake',
      another_field: 'Keep This Too'
    },
    expectedSnake: {
      business_name: 'Transform This',
      tenant_id: 'Transform This Too',
      keep_snake: 'Keep This Snake',
      another_field: 'Keep This Too'
    },
    options: { whitelist: ['business_name', 'tenant_id'] }
  }
];

/**
 * Run transformation tests
 */
export const runTransformTests = (): { passed: number; failed: number; results: any[] } => {
  const results: any[] = [];
  let passed = 0;
  let failed = 0;
  
  for (const testCase of transformTestCases) {
    const result = {
      name: testCase.name,
      passed: true,
      errors: [] as string[]
    };
    
    try {
      // Test camelCase transform
      const camelResult = transformToCamel(testCase.input, testCase.options);
      if (!deepEqual(camelResult, testCase.expectedCamel)) {
        result.passed = false;
        result.errors.push(`Camel transform failed. Expected: ${JSON.stringify(testCase.expectedCamel)}, Got: ${JSON.stringify(camelResult)}`);
      }
      
      // Test snake_case transform
      const snakeResult = transformToSnake(testCase.input);
      if (!deepEqual(snakeResult, testCase.expectedSnake)) {
        result.passed = false;
        result.errors.push(`Snake transform failed. Expected: ${JSON.stringify(testCase.expectedSnake)}, Got: ${JSON.stringify(snakeResult)}`);
      }
      
    } catch (error) {
      result.passed = false;
      result.errors.push(`Test threw error: ${error}`);
    }
    
    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
    
    results.push(result);
  }
  
  return { passed, failed, results };
};

/**
 * Deep equality check for test validation
 */
const deepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  
  if (a == null || b == null) return false;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    
    return true;
  }
  
  return false;
};

/**
 * Performance benchmark for transforms
 */
export const benchmarkTransforms = (iterations: number = 1000): {
  camelTransformMs: number;
  snakeTransformMs: number;
  avgObjectSize: number;
} => {
  const testData = {
    business_name: 'Test Business',
    tenant_id: '123',
    created_at: '2025-01-01',
    business_profile: {
      address_line1: '123 Main St',
      phone_number: '555-1234',
      contact_info: {
        email_address: 'test@example.com',
        website_url: 'https://example.com'
      }
    },
    items: [
      { item_id: '1', item_name: 'Product 1', price_cents: 1000 },
      { item_id: '2', item_name: 'Product 2', price_cents: 2000 }
    ]
  };
  
  // Benchmark camelCase transform
  const camelStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    transformToCamel(testData, { deep: true });
  }
  const camelEnd = performance.now();
  
  // Benchmark snake_case transform
  const snakeStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    transformToSnake(testData);
  }
  const snakeEnd = performance.now();
  
  return {
    camelTransformMs: camelEnd - camelStart,
    snakeTransformMs: snakeEnd - snakeStart,
    avgObjectSize: JSON.stringify(testData).length
  };
};

/**
 * Console test runner for development
 */
export const runDevTests = () => {
  console.log('🧪 Running Case Transform Tests...\n');
  
  const testResults = runTransformTests();
  
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}\n`);
  
  if (testResults.failed > 0) {
    console.log('Failed Tests:');
    testResults.results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`- ${r.name}:`);
        r.errors.forEach((error: string) => console.log(`  ${error}`));
      });
    console.log('');
  }
  
  console.log('⚡ Running Performance Benchmark...');
  const benchmark = benchmarkTransforms();
  console.log(`Camel Transform: ${benchmark.camelTransformMs.toFixed(2)}ms (1000 iterations)`);
  console.log(`Snake Transform: ${benchmark.snakeTransformMs.toFixed(2)}ms (1000 iterations)`);
  console.log(`Avg Object Size: ${benchmark.avgObjectSize} bytes`);
  
  return testResults.failed === 0;
};
