/**
 * GBP Category Scraper
 * 
 * Scrapes Google Business Profile categories from PlePer Tools
 * and generates a JSON file ready for import.
 * 
 * Usage:
 *   node scripts/scrape-gbp-categories.js
 * 
 * Output:
 *   apps/api/src/data/platform-categories-seed.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'https://pleper.com/index.php?do=tools&sdo=gmb_categories&go=1&lang=en&country=190&show_table=1';
const OUTPUT_FILE = path.join(__dirname, '../apps/api/src/data/platform-categories-seed.json');

// Category emojis by keyword
const EMOJI_MAP = {
  // Food & Dining
  'restaurant': '🍽️',
  'cafe': '☕',
  'coffee': '☕',
  'bar': '🍺',
  'pub': '🍻',
  'bakery': '🥖',
  'pizza': '🍕',
  'burger': '🍔',
  'sushi': '🍣',
  'chinese': '🥡',
  'mexican': '🌮',
  'italian': '🍝',
  'fast food': '🍟',
  'food truck': '🚚',
  'deli': '🥪',
  'ice cream': '🍦',
  'dessert': '🍰',
  
  // Retail
  'grocery': '🛒',
  'supermarket': '🏪',
  'store': '🏬',
  'shop': '🛍️',
  'boutique': '👗',
  'clothing': '👕',
  'shoe': '👟',
  'jewelry': '💍',
  'watch': '⌚',
  'electronics': '📱',
  'computer': '💻',
  'phone': '📱',
  'furniture': '🛋️',
  'home': '🏠',
  'hardware': '🔧',
  'tool': '🛠️',
  'paint': '🎨',
  'garden': '🌱',
  'plant': '🪴',
  'flower': '💐',
  'florist': '💐',
  'gift': '🎁',
  'toy': '🧸',
  'book': '📚',
  'music': '🎵',
  'sporting': '⚽',
  'sports': '🏀',
  'bike': '🚴',
  'outdoor': '🏕️',
  
  // Health & Beauty
  'pharmacy': '💊',
  'drug': '💉',
  'health': '🏥',
  'medical': '⚕️',
  'dental': '🦷',
  'doctor': '👨‍⚕️',
  'clinic': '🏥',
  'hospital': '🏥',
  'beauty': '💄',
  'salon': '💇',
  'spa': '🧖',
  'barber': '💈',
  'nail': '💅',
  'massage': '💆',
  'gym': '💪',
  'fitness': '🏋️',
  'yoga': '🧘',
  
  // Services
  'hotel': '🏨',
  'motel': '🛏️',
  'lodging': '🏨',
  'bank': '🏦',
  'atm': '🏧',
  'insurance': '🛡️',
  'lawyer': '⚖️',
  'attorney': '⚖️',
  'accountant': '📊',
  'real estate': '🏘️',
  'car': '🚗',
  'auto': '🚗',
  'mechanic': '🔧',
  'repair': '🔧',
  'gas station': '⛽',
  'parking': '🅿️',
  
  // Pets
  'pet': '🐾',
  'veterinar': '🐕',
  'animal': '🐾',
  'dog': '🐕',
  'cat': '🐈',
  
  // Entertainment
  'movie': '🎬',
  'theater': '🎭',
  'cinema': '🎬',
  'museum': '🏛️',
  'art': '🎨',
  'gallery': '🖼️',
  'park': '🌳',
  'zoo': '🦁',
  'aquarium': '🐠',
  'bowling': '🎳',
  'casino': '🎰',
  'night club': '🎉',
  
  // Education
  'school': '🏫',
  'university': '🎓',
  'college': '🎓',
  'library': '📚',
  'tutor': '👨‍🏫',
  
  // Other
  'church': '⛪',
  'temple': '🛕',
  'mosque': '🕌',
  'synagogue': '🕍',
  'cemetery': '⚰️',
  'funeral': '⚰️',
  'post office': '📮',
  'courier': '📦',
  'shipping': '📦',
  'storage': '📦',
  'laundry': '🧺',
  'dry clean': '👔',
  'tailor': '🧵',
};

// Get emoji for category
function getEmoji(categoryName) {
  const lowerName = categoryName.toLowerCase();
  
  // Check for keyword matches
  for (const [keyword, emoji] of Object.entries(EMOJI_MAP)) {
    if (lowerName.includes(keyword)) {
      return emoji;
    }
  }
  
  // Default emoji
  return '🏪';
}

// Generate slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Generate GBP category ID
function generateCategoryId(name) {
  return `gcid:${generateSlug(name)}`;
}

// Fetch HTML from URL
function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Parse categories from HTML table
function parseCategories(html) {
  const categories = [];
  
  // Simple regex to extract table rows
  // PlePer Tools uses a table format with category names
  const tableRowRegex = /<tr[^>]*>.*?<td[^>]*>(.*?)<\/td>.*?<\/tr>/gis;
  const cellRegex = /<td[^>]*>(.*?)<\/td>/gi;
  
  let match;
  let sortOrder = 10;
  
  // Extract all table rows
  while ((match = tableRowRegex.exec(html)) !== null) {
    const rowHTML = match[0];
    const cells = [];
    
    // Extract cells from row
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
      // Remove HTML tags and decode entities
      const cellText = cellMatch[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .trim();
      
      if (cellText) {
        cells.push(cellText);
      }
    }
    
    // First cell is usually the category name
    if (cells.length > 0 && cells[0]) {
      const name = cells[0];
      
      // Skip header rows and empty cells
      if (name && 
          name !== 'Category' && 
          name !== 'Name' &&
          name.length > 2 &&
          !name.includes('©') &&
          !name.includes('PlePer')) {
        
        const slug = generateSlug(name);
        const categoryId = generateCategoryId(name);
        
        categories.push({
          id: categoryId,
          name: name,
          slug: slug,
          description: `${name} business`,
          icon_emoji: getEmoji(name),
          google_category_id: categoryId,
          sort_order: sortOrder,
          level: 0
        });
        
        sortOrder += 10;
      }
    }
  }
  
  return categories;
}

// Alternative: Parse from list format
function parseCategoriesFromList(html) {
  const categories = [];
  
  // Try to find category names in various formats
  const patterns = [
    // List items
    /<li[^>]*>(.*?)<\/li>/gi,
    // Divs with category class
    /<div[^>]*class="[^"]*category[^"]*"[^>]*>(.*?)<\/div>/gi,
    // Spans with category info
    /<span[^>]*class="[^"]*category[^"]*"[^>]*>(.*?)<\/span>/gi,
  ];
  
  let sortOrder = 10;
  const seen = new Set();
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const text = match[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .trim();
      
      if (text && 
          text.length > 2 && 
          text.length < 100 &&
          !seen.has(text) &&
          !text.includes('©') &&
          !text.includes('PlePer')) {
        
        seen.add(text);
        const slug = generateSlug(text);
        const categoryId = generateCategoryId(text);
        
        categories.push({
          id: categoryId,
          name: text,
          slug: slug,
          description: `${text} business`,
          icon_emoji: getEmoji(text),
          google_category_id: categoryId,
          sort_order: sortOrder,
          level: 0
        });
        
        sortOrder += 10;
      }
    }
  }
  
  return categories;
}

// Main scraper function
async function scrapeCategories() {
  console.log('🚀 Starting GBP category scraper...\n');
  console.log(`📡 Fetching from: ${BASE_URL}\n`);
  
  try {
    // Fetch the HTML
    const html = await fetchHTML(BASE_URL);
    console.log('✅ HTML fetched successfully\n');
    
    // Parse categories
    let categories = parseCategories(html);
    
    // If table parsing didn't work, try list parsing
    if (categories.length === 0) {
      console.log('⚠️  Table parsing found no categories, trying list parsing...\n');
      categories = parseCategoriesFromList(html);
    }
    
    if (categories.length === 0) {
      console.error('❌ No categories found. The page structure may have changed.');
      console.log('\n💡 Try these alternatives:');
      console.log('   1. Visit the URL in a browser and manually copy the list');
      console.log('   2. Use browser DevTools to inspect the HTML structure');
      console.log('   3. Check if the page requires JavaScript rendering');
      process.exit(1);
    }
    
    console.log(`✅ Parsed ${categories.length} categories\n`);
    
    // Remove duplicates by slug
    const uniqueCategories = [];
    const seenSlugs = new Set();
    
    for (const category of categories) {
      if (!seenSlugs.has(category.slug)) {
        seenSlugs.add(category.slug);
        uniqueCategories.push(category);
      }
    }
    
    console.log(`✅ ${uniqueCategories.length} unique categories after deduplication\n`);
    
    // Create output object
    const output = {
      categories: uniqueCategories
    };
    
    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
    
    console.log(`✅ Categories saved to: ${OUTPUT_FILE}\n`);
    console.log('📊 Summary:');
    console.log(`   - Total categories: ${uniqueCategories.length}`);
    console.log(`   - File size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
    console.log('\n🎉 Scraping complete!\n');
    console.log('Next steps:');
    console.log('   1. Review the generated file');
    console.log('   2. Test import: npm run dev');
    console.log('   3. Navigate to /admin/platform-categories');
    console.log('   4. Click "Bulk Import" and test search\n');
    
    // Show sample categories
    console.log('📋 Sample categories:');
    uniqueCategories.slice(0, 10).forEach((cat, i) => {
      console.log(`   ${i + 1}. ${cat.icon_emoji} ${cat.name}`);
    });
    if (uniqueCategories.length > 10) {
      console.log(`   ... and ${uniqueCategories.length - 10} more\n`);
    }
    
  } catch (error) {
    console.error('❌ Error scraping categories:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Check your internet connection');
    console.log('   2. Verify the URL is accessible');
    console.log('   3. Try running with: node --trace-warnings scripts/scrape-gbp-categories.js');
    process.exit(1);
  }
}

// Run the scraper
scrapeCategories();
