/**
 * Script to download and parse Google Product Taxonomy
 * Run with: npx tsx scripts/download-google-taxonomy.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const TAXONOMY_URL = 'https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt';
const OUTPUT_FILE = path.join(__dirname, '../src/lib/google/taxonomy-data.json');

interface TaxonomyEntry {
  id: string;
  name: string;
  path: string[];
  fullPath: string;
}

async function downloadTaxonomy(): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(TAXONOMY_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
  });
}

function parseTaxonomy(content: string): TaxonomyEntry[] {
  const lines = content.split('\n');
  const entries: TaxonomyEntry[] = [];
  
  for (const line of lines) {
    // Skip header and empty lines
    if (line.startsWith('#') || line.trim() === '') continue;
    
    // Format: "ID - Category > Subcategory > Sub-subcategory"
    const match = line.match(/^(\d+)\s*-\s*(.+)$/);
    if (!match) continue;
    
    const [, id, fullPath] = match;
    const path = fullPath.split(' > ').map(s => s.trim());
    const name = path[path.length - 1]; // Last element is the category name
    
    entries.push({
      id,
      name,
      path,
      fullPath: fullPath.trim(),
    });
  }
  
  return entries;
}

async function main() {
  console.log('📥 Downloading Google Product Taxonomy...');
  const content = await downloadTaxonomy();
  
  console.log('📝 Parsing taxonomy...');
  const entries = parseTaxonomy(content);
  
  console.log(`✅ Parsed ${entries.length} categories`);
  
  // Create output directory if it doesn't exist
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Write to JSON file
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify({
      version: '2021-09-21',
      downloadedAt: new Date().toISOString(),
      totalCategories: entries.length,
      categories: entries,
    }, null, 2)
  );
  
  console.log(`💾 Saved to ${OUTPUT_FILE}`);
  console.log('\n📊 Sample categories:');
  entries.slice(0, 5).forEach(cat => {
    console.log(`  ${cat.id}: ${cat.fullPath}`);
  });
  
  console.log('\n✨ Done! Update taxonomy.ts to import this data.');
}

main().catch(console.error);
