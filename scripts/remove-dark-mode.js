/**
 * Remove Dark Mode Classes Script
 * 
 * This script removes all dark: prefixed Tailwind classes from the codebase
 * while preserving the base classes.
 * 
 * Example transformations:
 * - "bg-white dark:bg-neutral-900" → "bg-white"
 * - "text-neutral-900 dark:text-neutral-100" → "text-neutral-900"
 * - "border-neutral-200 dark:border-neutral-700" → "border-neutral-200"
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SOURCE_DIR = path.join(__dirname, '../apps/web/src');
const FILE_PATTERNS = ['**/*.tsx', '**/*.ts', '**/*.jsx', '**/*.js'];
const EXCLUDE_PATTERNS = ['**/node_modules/**', '**/dist/**', '**/.next/**'];

// Statistics
let stats = {
  filesProcessed: 0,
  filesModified: 0,
  classesRemoved: 0,
  errors: []
};

/**
 * Remove dark mode classes from a string
 */
function removeDarkClasses(content) {
  let modified = false;
  let darkClassCount = 0;
  
  // Pattern: Remove dark: classes in className strings
  // Matches: dark:bg-neutral-900, dark:text-white, etc.
  // Only removes the dark: variant, preserves spacing
  const darkClassPattern = /\s+dark:[^\s"'`}>\]]+/g;
  const matches = content.match(darkClassPattern);
  
  if (matches) {
    darkClassCount = matches.length;
    content = content.replace(darkClassPattern, '');
    modified = true;
  }
  
  // ONLY clean up double spaces within className strings
  // Don't touch newlines or formatting
  content = content.replace(/className="([^"]*)"/g, (match, classes) => {
    return `className="${classes.replace(/\s{2,}/g, ' ').trim()}"`;
  });
  
  content = content.replace(/className='([^']*)'/g, (match, classes) => {
    return `className='${classes.replace(/\s{2,}/g, ' ').trim()}'`;
  });
  
  content = content.replace(/className={`([^`]*)`}/g, (match, classes) => {
    return `className={\`${classes.replace(/\s{2,}/g, ' ').trim()}\`}`;
  });
  
  return { content, modified, darkClassCount };
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    const originalContent = fs.readFileSync(filePath, 'utf8');
    const { content: newContent, modified, darkClassCount } = removeDarkClasses(originalContent);
    
    if (modified) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      stats.filesModified++;
      stats.classesRemoved += darkClassCount;
      console.log(`✓ ${path.relative(SOURCE_DIR, filePath)} - Removed ${darkClassCount} dark: classes`);
    }
    
    stats.filesProcessed++;
  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    console.error(`✗ ${path.relative(SOURCE_DIR, filePath)} - Error: ${error.message}`);
  }
}

/**
 * Recursively find all files with given extensions
 */
function findFiles(dir, extensions = ['.tsx', '.ts', '.jsx', '.js']) {
  const files = [];
  
  function walk(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      // Skip excluded directories
      if (stat.isDirectory()) {
        if (item === 'node_modules' || item === 'dist' || item === '.next') {
          continue;
        }
        walk(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(fullPath);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  walk(dir);
  return files;
}

/**
 * Main execution
 */
function main() {
  console.log('🧹 Dark Mode Cleanup Script\n');
  console.log(`Source directory: ${SOURCE_DIR}\n`);
  
  // Find all files
  console.log('Finding files...');
  const allFiles = findFiles(SOURCE_DIR);
  
  console.log(`Found ${allFiles.length} files to process\n`);
  console.log('Processing files...\n');
  
  // Process each file
  allFiles.forEach(processFile);
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log(`Files processed: ${stats.filesProcessed}`);
  console.log(`Files modified: ${stats.filesModified}`);
  console.log(`Dark classes removed: ${stats.classesRemoved}`);
  console.log(`Errors: ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    stats.errors.forEach(({ file, error }) => {
      console.log(`  - ${path.relative(SOURCE_DIR, file)}: ${error}`);
    });
  }
  
  console.log('\n✅ Dark mode cleanup complete!');
  console.log(`\nNext steps:`);
  console.log(`1. Review the changes: git diff`);
  console.log(`2. Test the application`);
  console.log(`3. Commit the changes: git add . && git commit -m "refactor: Remove dark mode classes"`);
}

// Run the script
main();
