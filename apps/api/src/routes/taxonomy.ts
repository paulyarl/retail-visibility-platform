import { Router } from 'express';
import { prisma } from '../prisma';
import { GOOGLE_PRODUCT_TAXONOMY } from '../lib/google/taxonomy';

const router = Router();

/**
 * GET /api/taxonomy/search?q=Electronics&limit=20
 * GET /api/taxonomy/search?branch=Food, Beverages & Tobacco > Food Items > Breakfast Foods&limit=500
 * Search Google taxonomy categories by name (q) or under a specific branch (public access)
 */
router.get('/search', async (req, res) => {
  try {
    const { q, branch, limit = '100' } = req.query;

    // Support both 'q' (name search) and 'branch' (path search)
    if (!q && !branch) {
      return res.status(400).json({ success: false, error: 'q or branch parameter is required' });
    }
    
    const limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      return res.status(400).json({ success: false, error: 'limit must be between 1 and 1000' });
    }
    
    // Name-based search (q parameter)
    if (q && typeof q === 'string') {
      const query = q.toLowerCase().trim();
      console.log(`[GET /api/taxonomy/search] Name search: "${query}", limit: ${limitNum}`);
      
      const results = GOOGLE_PRODUCT_TAXONOMY
        .filter(cat => {
          const name = cat.path[cat.path.length - 1].toLowerCase();
          const fullPath = cat.path.join(' > ').toLowerCase();
          return name.includes(query) || fullPath.includes(query);
        })
        .slice(0, limitNum)
        .map(cat => ({
          id: cat.id,
          name: cat.path[cat.path.length - 1],
          path: cat.path,
          level: cat.path.length
        }));
      
      console.log(`[GET /api/taxonomy/search] Found ${results.length} results for "${query}"`);
      
      return res.json({
        success: true,
        results,
        total: results.length
      });
    }

    // Branch-based search (original behavior)
    if (!branch || typeof branch !== 'string') {
      return res.status(400).json({ success: false, error: 'branch parameter is required' });
    }

    // Parse branch path
    const branchPath = branch.split('>').map(s => s.trim()).filter(s => s.length > 0);

    console.log(`[GET /api/taxonomy/search] Searching branch: ${branchPath.join(' > ')}, limit: ${limitNum}`);

    let categories: any[] = [];

    // Strategy 1: Try exact branch match (categories under this path)
    categories = GOOGLE_PRODUCT_TAXONOMY
      .filter(cat => cat.path.join(' > ').startsWith(branchPath.join(' > ')))
      .slice(0, limitNum)
      .map(cat => ({
        id: cat.id,
        path: cat.path,
        level: cat.path.length
      }));

    console.log(`[GET /api/taxonomy/search] Exact branch match found: ${categories.length} categories`);

    // If we found subcategories, include the parent category itself as well
    if (categories.length > 0) {
      // Check if the exact branch path exists as a category
      const exactCategory = GOOGLE_PRODUCT_TAXONOMY.find(cat => 
        cat.path.join(' > ') === branchPath.join(' > ')
      );
      
      if (exactCategory && !categories.find(c => c.id === exactCategory.id)) {
        categories.unshift({
          id: exactCategory.id,
          path: exactCategory.path,
          level: exactCategory.path.length
        });
      }
    }

    // Strategy 2: If no exact matches, search for categories containing key terms
    if (categories.length === 0) {
      console.log('[GET /api/taxonomy/search] No exact matches, trying keyword search');

      // Get the last few levels as search terms
      const searchTerms = branchPath.slice(-2); // Last 2 levels
      const searchPattern = searchTerms.join(' ').toLowerCase();

      categories = GOOGLE_PRODUCT_TAXONOMY
        .filter(cat => cat.path.join(' > ').toLowerCase().includes(searchPattern))
        .slice(0, limitNum)
        .map(cat => ({
          id: cat.id,
          path: cat.path,
          level: cat.path.length
        }));

      console.log(`[GET /api/taxonomy/search] Keyword search found: ${categories.length} categories for "${searchPattern}"`);
    }

    // Strategy 3: If still no matches, search for categories in the same top-level branch
    if (categories.length === 0 && branchPath.length >= 2) {
      console.log('[GET /api/taxonomy/search] No keyword matches, trying top-level branch search');

      const topBranch = branchPath.slice(0, 2).join(' > ').toLowerCase(); // First 2 levels

      categories = GOOGLE_PRODUCT_TAXONOMY
        .filter(cat => {
          const catPath = cat.path.join(' > ').toLowerCase();
          return catPath.startsWith(topBranch) && cat.path.length >= branchPath.length;
        })
        .slice(0, limitNum)
        .map(cat => ({
          id: cat.id,
          path: cat.path,
          level: cat.path.length
        }));

      console.log(`[GET /api/taxonomy/search] Top-level branch search found: ${categories.length} categories under "${topBranch}"`);
    }

    // Strategy 4: Always include categories that exactly match the search terms
    if (categories.length === 0) {
      console.log('[GET /api/taxonomy/search] No matches found, including exact matches for search terms');
      
      const allMatches = GOOGLE_PRODUCT_TAXONOMY
        .filter(cat => {
          const catPathStr = cat.path.join(' > ').toLowerCase();
          return branchPath.some(term => catPathStr.includes(term.toLowerCase()));
        })
        .slice(0, limitNum)
        .map(cat => ({
          id: cat.id,
          path: cat.path,
          level: cat.path.length
        }));
        
      categories = allMatches;
      console.log(`[GET /api/taxonomy/search] Found ${categories.length} categories matching any search term`);
    }

    // Always include the searched branch path as a selectable category
    const searchedCategory = {
      id: `custom-${branchPath.join('-').toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      path: branchPath,
      level: branchPath.length,
      isCustom: true // Mark as custom/generated category
    };
    
    // Add it to the beginning of results if it's not already there
    const existingIndex = categories.findIndex(c => c.path.join(' > ') === branchPath.join(' > '));
    if (existingIndex === -1) {
      categories.unshift(searchedCategory);
    } else {
      // Move existing match to front
      const [existing] = categories.splice(existingIndex, 1);
      categories.unshift(existing);
    }

    console.log(`[GET /api/taxonomy/search] Returning ${categories.length} categories`);

    res.json({
      success: true,
      branch: branchPath,
      categories: categories,
      total: categories.length,
      searchStrategy: categories.length > 0 ? 'found' : 'none'
    });
  } catch (error) {
    console.error('[GET /api/taxonomy/search] Error:', error);
    res.status(500).json({ success: false, error: 'failed_to_search_taxonomy' });
  }
});

/**
 * GET /api/taxonomy/browse?path=Food, Beverages & Tobacco/Food Items
 * Browse Google taxonomy categories at a specific path level
 * Returns immediate children of the specified path
 */
router.get('/browse', async (req, res) => {
  try {
    const { path: pathParam } = req.query;
    
    // Parse path - empty means root level
    const currentPath = pathParam && typeof pathParam === 'string' 
      ? pathParam.split('/').map(s => s.trim()).filter(s => s.length > 0)
      : [];
    
    console.log(`[GET /api/taxonomy/browse] Browsing path: ${currentPath.length > 0 ? currentPath.join(' > ') : 'ROOT'}`);
    
    // Find categories at the next level
    const targetDepth = currentPath.length + 1;
    
    // Get unique categories at the target depth that match the current path
    const categoriesMap = new Map<string, { id: string; name: string; path: string[]; hasChildren: boolean }>();
    
    for (const cat of GOOGLE_PRODUCT_TAXONOMY) {
      // Check if this category is under the current path
      if (currentPath.length > 0) {
        const matches = currentPath.every((segment, idx) => cat.path[idx] === segment);
        if (!matches) continue;
      }
      
      // Check if this category is at the target depth
      if (cat.path.length >= targetDepth) {
        const categoryName = cat.path[targetDepth - 1];
        const categoryPath = cat.path.slice(0, targetDepth);
        const key = categoryPath.join(' > ');
        
        if (!categoriesMap.has(key)) {
          // Check if this category has children
          const hasChildren = GOOGLE_PRODUCT_TAXONOMY.some(c => 
            c.path.length > targetDepth && 
            categoryPath.every((segment, idx) => c.path[idx] === segment)
          );
          
          // Find the exact category ID for this path
          const exactCat = GOOGLE_PRODUCT_TAXONOMY.find(c => 
            c.path.length === targetDepth && 
            c.path.join(' > ') === key
          );
          
          categoriesMap.set(key, {
            id: exactCat?.id || `path-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            name: categoryName,
            path: categoryPath,
            hasChildren
          });
        }
      }
    }
    
    // Convert to array and sort alphabetically
    const categories = Array.from(categoriesMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`[GET /api/taxonomy/browse] Found ${categories.length} categories at depth ${targetDepth}`);
    
    res.json({
      success: true,
      path: currentPath,
      categories,
      total: categories.length
    });
  } catch (error) {
    console.error('[GET /api/taxonomy/browse] Error:', error);
    res.status(500).json({ success: false, error: 'failed_to_browse_taxonomy' });
  }
});

export default router;
