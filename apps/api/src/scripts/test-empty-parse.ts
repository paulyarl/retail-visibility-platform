import { goldStandardScanSchema } from '../validators/gold-standard-scan.schema';

// Test what error is produced for various malformed inputs
const tests: Array<{ name: string; input: any }> = [
  { name: 'empty object', input: {} },
  { name: 'scan_metadata only', input: { scan_metadata: { platform_focus: 'all' } } },
  { name: 'expected_fields only', input: { expected_fields: {} } },
  { name: 'nested platform_evaluations element', input: { platform: 'google', quality_score: 8.5 } },
  { name: 'candidate object', input: { business_name: 'Test', platform_evaluations: [] } },
];

for (const t of tests) {
  const result = goldStandardScanSchema.safeParse(t.input);
  console.log(`\n=== ${t.name} ===`);
  console.log('success:', result.success);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    console.log('issues:', issues);
  }
}
