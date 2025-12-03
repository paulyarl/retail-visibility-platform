/**
 * GBP Category Scraper (Puppeteer Version)
 * 
 * Uses Puppeteer to scrape Google Business Profile categories from PlePer Tools.
 * This version handles JavaScript-rendered content.
 * 
 * Installation:
 *   npm install puppeteer
 * 
 * Usage:
 *   node scripts/scrape-gbp-categories-puppeteer.js
 * 
 * Output:
 *   apps/api/src/data/platform-categories-seed.json
 */

const fs = require('fs');
const path = require('path');

// Check if puppeteer is installed
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (err) {
  console.error('❌ Puppeteer not installed!');
  console.log('\n📦 Install it with:');
  console.log('   npm install puppeteer\n');
  console.log('Or use the basic scraper:');
  console.log('   node scripts/scrape-gbp-categories.js\n');
  process.exit(1);
}

// Configuration
const BASE_URL = 'https://pleper.com/index.php?do=tools&sdo=gmb_categories&go=1&lang=en&country=190&show_table=1';
const OUTPUT_FILE = path.join(__dirname, '../apps/api/src/data/platform-categories-seed.json');

// Category emojis by keyword (same as basic version)
const EMOJI_MAP = {
  'restaurant': '🍽️', 'cafe': '☕', 'coffee': '☕', 'bar': '🍺', 'pub': '🍻',
  'bakery': '🥖', 'pizza': '🍕', 'burger': '🍔', 'sushi': '🍣', 'chinese': '🥡',
  'mexican': '🌮', 'italian': '🍝', 'fast food': '🍟', 'food truck': '🚚',
  'deli': '🥪', 'ice cream': '🍦', 'dessert': '🍰', 'grocery': '🛒',
  'supermarket': '🏪', 'store': '🏬', 'shop': '🛍️', 'boutique': '👗',
  'clothing': '👕', 'shoe': '👟', 'jewelry': '💍', 'watch': '⌚',
  'electronics': '📱', 'computer': '💻', 'phone': '📱', 'furniture': '🛋️',
  'home': '🏠', 'hardware': '🔧', 'tool': '🛠️', 'paint': '🎨',
  'garden': '🌱', 'plant': '🪴', 'flower': '💐', 'florist': '💐',
  'gift': '🎁', 'toy': '🧸', 'book': '📚', 'music': '🎵',
  'sporting': '⚽', 'sports': '🏀', 'bike': '🚴', 'outdoor': '🏕️',
  'pharmacy': '💊', 'drug': '💉', 'health': '🏥', 'medical': '⚕️',
  'dental': '🦷', 'doctor': '👨‍⚕️', 'clinic': '🏥', 'hospital': '🏥',
  'beauty': '💄', 'salon': '💇', 'spa': '🧖', 'barber': '💈',
  'nail': '💅', 'massage': '💆', 'gym': '💪', 'fitness': '🏋️',
  'yoga': '🧘', 'hotel': '🏨', 'motel': '🛏️', 'lodging': '🏨',
  'bank': '🏦', 'atm': '🏧', 'insurance': '🛡️', 'lawyer': '⚖️',
  'attorney': '⚖️', 'accountant': '📊', 'real estate': '🏘️', 'car': '🚗',
  'auto': '🚗', 'mechanic': '🔧', 'repair': '🔧', 'gas station': '⛽',
  'parking': '🅿️', 'pet': '🐾', 'veterinar': '🐕', 'animal': '🐾',
  'dog': '🐕', 'cat': '🐈', 'movie': '🎬', 'theater': '🎭',
  'cinema': '🎬', 'museum': '🏛️', 'art': '🎨', 'gallery': '🖼️',
  'park': '🌳', 'zoo': '🦁', 'aquarium': '🐠', 'bowling': '🎳',
  'casino': '🎰', 'night club': '🎉', 'school': '🏫', 'university': '🎓',
  'college': '🎓', 'library': '📚', 'tutor': '👨‍🏫', 'church': '⛪',
  'temple': '🛕', 'mosque': '🕌', 'synagogue': '🕍', 'cemetery': '⚰️',
  'funeral': '⚰️', 'post office': '📮', 'courier': '📦', 'shipping': '📦',
  'storage': '📦', 'laundry': '🧺', 'dry clean': '👔', 'tailor': '🧵',
};

function getEmoji(categoryName) {
  const lowerName = categoryName.toLowerCase();
  for (const [keyword, emoji] of Object.entries(EMOJI_MAP)) {
    if (lowerName.includes(keyword)) return emoji;
  }
  return '🏪';
}

function generateSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function generateCategoryId(name) {
  return `gcid:${generateSlug(name)}`;
}

// Main scraper function
async function scrapeCategories() {
  console.log('🚀 Starting GBP category scraper (Puppeteer)...\n');
  console.log(`📡 Fetching from: ${BASE_URL}\n`);
  
  let browser;
  
  try {
    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to page
    console.log('📄 Loading page...');
    await page.goto(BASE_URL, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('✅ Page loaded\n');
    
    // Wait for content to load
    await page.waitForTimeout(2000);
    
    // Extract categories from the page
    console.log('🔍 Extracting categories...');
    
    const categories = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      
      // Try multiple selectors
      const selectors = [
        'table tr td',           // Table cells
        'table tbody tr td',     // Table body cells
        '.category',             // Category class
        '[data-category]',       // Data attribute
        'li',                    // List items
        '.result',               // Result class
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        
        elements.forEach(el => {
          const text = el.textContent.trim();
          
          // Filter valid category names
          if (text && 
              text.length > 2 && 
              text.length < 100 &&
              !text.includes('©') &&
              !text.includes('PlePer') &&
              !text.includes('Category') &&
              !text.match(/^\d+$/) &&
              !seen.has(text)) {
            
            seen.add(text);
            results.push(text);
          }
        });
      }
      
      return results;
    });
    
    console.log(`✅ Extracted ${categories.length} raw categories\n`);
    
    if (categories.length === 0) {
      console.error('❌ No categories found!');
      console.log('\n💡 The page structure may have changed.');
      console.log('   Taking a screenshot for debugging...\n');
      
      await page.screenshot({ 
        path: path.join(__dirname, 'debug-screenshot.png'),
        fullPage: true 
      });
      
      console.log('📸 Screenshot saved to: scripts/debug-screenshot.png');
      console.log('   Review it to see what the page looks like.\n');
      
      await browser.close();
      process.exit(1);
    }
    
    // Format categories
    let sortOrder = 10;
    const formattedCategories = categories.map(name => {
      const slug = generateSlug(name);
      const categoryId = generateCategoryId(name);
      
      const category = {
        id: categoryId,
        name: name,
        slug: slug,
        description: `${name} business`,
        icon_emoji: getEmoji(name),
        google_category_id: categoryId,
        sort_order: sortOrder,
        level: 0
      };
      
      sortOrder += 10;
      return category;
    });
    
    // Remove duplicates by slug
    const uniqueCategories = [];
    const seenSlugs = new Set();
    
    for (const category of formattedCategories) {
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
    
    // Show sample categories
    console.log('📋 Sample categories:');
    uniqueCategories.slice(0, 15).forEach((cat, i) => {
      console.log(`   ${i + 1}. ${cat.icon_emoji} ${cat.name}`);
    });
    if (uniqueCategories.length > 15) {
      console.log(`   ... and ${uniqueCategories.length - 15} more\n`);
    }
    
    console.log('Next steps:');
    console.log('   1. Review the generated file');
    console.log('   2. Test import: npm run dev');
    console.log('   3. Navigate to /admin/platform-categories');
    console.log('   4. Click "Bulk Import" and test search\n');
    
    await browser.close();
    
  } catch (error) {
    console.error('❌ Error scraping categories:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Check your internet connection');
    console.log('   2. Verify the URL is accessible');
    console.log('   3. Try the basic scraper: node scripts/scrape-gbp-categories.js');
    
    if (browser) {
      await browser.close();
    }
    
    process.exit(1);
  }
}

// Run the scraper
scrapeCategories();
