import { Router } from 'express';
import { prisma } from '../prisma';
import { GOOGLE_PRODUCT_TAXONOMY } from '../lib/google/taxonomy';

const router = Router();

/**
 * GET /api/taxonomy/search?branch=Food, Beverages & Tobacco > Food Items > Breakfast Foods&limit=500
 * Search Google taxonomy categories under a specific branch (public access)
 */
router.get('/search', async (req, res) => {
  try {
    const { branch, limit = '100' } = req.query;

    if (!branch || typeof branch !== 'string') {
      return res.status(400).json({ success: false, error: 'branch parameter is required' });
    }

    const limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      return res.status(400).json({ success: false, error: 'limit must be between 1 and 1000' });
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

export default router;
