# GBP Category Scraper Scripts

**Purpose:** Automatically scrape Google Business Profile categories from PlePer Tools and generate a ready-to-use JSON file.

---

## Available Scripts

### **1. Basic Scraper (Recommended First)**

**File:** `scrape-gbp-categories.js`

**Features:**
- ✅ No dependencies (uses built-in Node.js modules)
- ✅ Fast and lightweight
- ✅ Works for static HTML content
- ✅ Simple regex-based parsing

**Usage:**
```bash
node scripts/scrape-gbp-categories.js
```

**Pros:**
- No installation needed
- Fast execution
- Low memory usage

**Cons:**
- May not work if page uses JavaScript rendering
- Less robust parsing

---

### **2. Puppeteer Scraper (Advanced)**

**File:** `scrape-gbp-categories-puppeteer.js`

**Features:**
- ✅ Handles JavaScript-rendered content
- ✅ Full browser automation
- ✅ Takes screenshots for debugging
- ✅ More robust parsing

**Installation:**
```bash
npm install puppeteer
```

**Usage:**
```bash
node scripts/scrape-gbp-categories-puppeteer.js
```

**Pros:**
- Handles dynamic content
- More reliable
- Better debugging

**Cons:**
- Requires Puppeteer installation (~300MB)
- Slower execution
- Higher memory usage

---

## Quick Start

### **Step 1: Choose Your Scraper**

**Try the basic scraper first:**
```bash
cd retail-visibility-platform
node scripts/scrape-gbp-categories.js
```

**If it doesn't work, use Puppeteer:**
```bash
npm install puppeteer
node scripts/scrape-gbp-categories-puppeteer.js
```

### **Step 2: Review Output**

The scraper will create:
```
apps/api/src/data/platform-categories-seed.json
```

**Check the file:**
```bash
# View first 50 lines
head -n 50 apps/api/src/data/platform-categories-seed.json

# Count categories
cat apps/api/src/data/platform-categories-seed.json | grep '"name"' | wc -l
```

### **Step 3: Test Import**

```bash
# Start dev server
npm run dev

# Navigate to:
http://localhost:3000/admin/platform-categories

# Click "📥 Bulk Import"
# Search and select categories
# Verify import works
```

---

## How It Works

### **1. Fetch HTML**

The scraper fetches the PlePer Tools page:
```
https://pleper.com/index.php?do=tools&sdo=gmb_categories&go=1&lang=en&country=190&show_table=1
```

**Parameters:**
- `lang=en` - English language
- `country=190` - United States
- `show_table=1` - Show table format

### **2. Parse Categories**

Extracts category names from:
- Table rows (`<tr><td>`)
- List items (`<li>`)
- Divs/spans with category classes

### **3. Format Data**

For each category, generates:
```json
{
  "id": "gcid:grocery-store",
  "name": "Grocery Store",
  "slug": "grocery-store",
  "description": "Grocery Store business",
  "icon_emoji": "🛒",
  "google_category_id": "gcid:grocery-store",
  "sort_order": 10,
  "level": 0
}
```

### **4. Deduplicate**

Removes duplicates based on slug.

### **5. Save JSON**

Writes to `apps/api/src/data/platform-categories-seed.json`.

---

## Customization

### **Change Country**

Edit the URL in the script:
```javascript
// For UK (country code 229)
const BASE_URL = 'https://pleper.com/index.php?do=tools&sdo=gmb_categories&go=1&lang=en&country=229&show_table=1';

// For Canada (country code 38)
const BASE_URL = 'https://pleper.com/index.php?do=tools&sdo=gmb_categories&go=1&lang=en&country=38&show_table=1';
```

**Common country codes:**
- United States: 190
- United Kingdom: 229
- Canada: 38
- Australia: 13
- Germany: 81
- France: 73

### **Change Language**

```javascript
// For Spanish
const BASE_URL = '...&lang=es&...';

// For French
const BASE_URL = '...&lang=fr&...';
```

### **Add Custom Emojis**

Edit the `EMOJI_MAP` in the script:
```javascript
const EMOJI_MAP = {
  'your keyword': '🎯',
  'another keyword': '🚀',
  // ... add more
};
```

### **Change Output File**

```javascript
const OUTPUT_FILE = path.join(__dirname, '../your/custom/path.json');
```

---

## Troubleshooting

### **Problem: No categories found**

**Solution 1:** Try the Puppeteer scraper
```bash
npm install puppeteer
node scripts/scrape-gbp-categories-puppeteer.js
```

**Solution 2:** Check the page manually
```bash
# Open in browser
https://pleper.com/index.php?do=tools&sdo=gmb_categories&go=1&lang=en&country=190&show_table=1

# Inspect HTML structure
# Update regex patterns in script
```

**Solution 3:** Use debug screenshot
```bash
# Puppeteer creates: scripts/debug-screenshot.png
# Review to see page structure
```

### **Problem: Too few categories**

**Possible causes:**
- Page structure changed
- Parsing regex needs update
- Page requires multiple requests

**Solution:**
- Check PlePer Tools for pagination
- Update script to handle multiple pages
- Or manually combine multiple exports

### **Problem: Duplicate categories**

**Solution:**
The script already deduplicates by slug. If you still see duplicates:
```bash
# Check for case variations
cat apps/api/src/data/platform-categories-seed.json | grep -i "grocery"

# Manual cleanup if needed
```

### **Problem: Wrong emojis**

**Solution:**
Edit the `EMOJI_MAP` in the script and re-run.

### **Problem: Puppeteer installation fails**

**Solution:**
```bash
# Use basic scraper instead
node scripts/scrape-gbp-categories.js

# Or install Puppeteer with specific version
npm install puppeteer@21.0.0
```

---

## Advanced Usage

### **Scrape Multiple Countries**

Create a wrapper script:
```javascript
// scrape-all-countries.js
const countries = [
  { code: 190, name: 'US' },
  { code: 229, name: 'UK' },
  { code: 38, name: 'CA' },
];

for (const country of countries) {
  // Update URL with country code
  // Run scraper
  // Save to separate file
}
```

### **Merge Multiple Sources**

```bash
# Scrape from PlePer
node scripts/scrape-gbp-categories.js

# Scrape from another source
node scripts/scrape-from-source2.js

# Merge JSON files
node scripts/merge-categories.js
```

### **Schedule Regular Updates**

```bash
# Add to cron (Linux/Mac)
0 0 * * 0 cd /path/to/project && node scripts/scrape-gbp-categories.js

# Or use Node scheduler
npm install node-cron
```

---

## Output Format

### **File Structure:**

```json
{
  "categories": [
    {
      "id": "gcid:grocery-store",
      "name": "Grocery Store",
      "slug": "grocery-store",
      "description": "Grocery Store business",
      "icon_emoji": "🛒",
      "google_category_id": "gcid:grocery-store",
      "sort_order": 10,
      "level": 0
    },
    ...
  ]
}
```

### **Field Descriptions:**

- **id:** Unique identifier (format: `gcid:slug`)
- **name:** Display name (user-friendly)
- **slug:** URL-friendly identifier (lowercase, hyphens)
- **description:** Brief description
- **icon_emoji:** Visual identifier (single emoji)
- **google_category_id:** GBP category ID (same as id)
- **sort_order:** Display order (increments of 10)
- **level:** Hierarchy level (0 = top-level)

---

## Expected Results

### **Typical Output:**

- **Categories:** 500-2,000+ (depending on country)
- **File Size:** 100KB - 500KB
- **Time:** 5-30 seconds (basic) or 30-60 seconds (Puppeteer)

### **Sample Categories:**

```
1. 🛒 Grocery Store
2. 🏪 Supermarket
3. 🏬 Convenience Store
4. 💊 Pharmacy
5. 🐾 Pet Store
6. 👕 Clothing Store
7. 👟 Shoe Store
8. 📱 Electronics Store
9. 🛋️ Furniture Store
10. 🔧 Hardware Store
... and hundreds more
```

---

## Integration with Platform

### **After Scraping:**

1. **Review the file**
   ```bash
   cat apps/api/src/data/platform-categories-seed.json | less
   ```

2. **Test import**
   ```bash
   npm run dev
   # Navigate to /admin/platform-categories
   # Click "Bulk Import"
   # Search and test
   ```

3. **Deploy**
   ```bash
   git add apps/api/src/data/platform-categories-seed.json
   git commit -m "Update GBP categories (scraped from PlePer)"
   git push
   ```

### **Backend Compatibility:**

The backend is already configured to handle this format:
```typescript
// apps/api/src/routes/categories.platform.ts
const categoriesToImport = Array.isArray(rawData) 
  ? rawData 
  : (rawData.categories || []);
```

✅ **No code changes needed!**

---

## Maintenance

### **When to Re-scrape:**

- **Quarterly:** Check for new categories
- **Annually:** Full refresh
- **As Needed:** When tenants request missing categories

### **Version Control:**

```bash
# Backup before re-scraping
cp apps/api/src/data/platform-categories-seed.json \
   apps/api/src/data/platform-categories-seed-backup-$(date +%Y%m%d).json

# Re-scrape
node scripts/scrape-gbp-categories.js

# Compare
diff platform-categories-seed.json platform-categories-seed-backup-*.json

# Commit if satisfied
git add platform-categories-seed.json
git commit -m "Update GBP categories ($(date +%Y-%m-%d))"
```

---

## FAQ

**Q: How many categories will I get?**
A: Typically 500-2,000+ depending on country and language.

**Q: Do I need to scrape multiple times?**
A: No, one scrape gets all categories for that country/language.

**Q: Can I edit the JSON manually?**
A: Yes! Add, remove, or modify categories as needed.

**Q: What if the scraper breaks?**
A: Use the manual export from PlePer Tools and format it yourself.

**Q: How often should I update?**
A: Quarterly or annually is sufficient. GBP categories don't change often.

**Q: Can I use this for production?**
A: Yes! The output is production-ready.

---

## Alternative: Manual Export

If scrapers don't work, manually export from PlePer Tools:

1. Visit: https://pleper.com/index.php?do=tools&sdo=gmb_categories
2. Select country and language
3. Click "Show Table"
4. Copy all category names
5. Use this script to format:

```javascript
// format-manual-list.js
const fs = require('fs');

const categoryNames = [
  'Grocery Store',
  'Supermarket',
  // ... paste all names here
];

const categories = categoryNames.map((name, i) => ({
  id: `gcid:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  name: name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  description: `${name} business`,
  icon_emoji: '🏪',
  google_category_id: `gcid:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  sort_order: (i + 1) * 10,
  level: 0
}));

fs.writeFileSync(
  'platform-categories-seed.json',
  JSON.stringify({ categories }, null, 2)
);
```

---

## Summary

**Quick Start:**
```bash
# Try basic scraper first
node scripts/scrape-gbp-categories.js

# If that doesn't work, use Puppeteer
npm install puppeteer
node scripts/scrape-gbp-categories-puppeteer.js

# Test
npm run dev
# Navigate to /admin/platform-categories

# Deploy
git add apps/api/src/data/platform-categories-seed.json
git commit -m "Expand GBP categories"
git push
```

**Expected Result:** 500-2,000+ categories ready for import! 🎉
