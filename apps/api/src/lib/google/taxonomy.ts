/**
 * Google Product Taxonomy
 * Source: https://support.google.com/merchants/answer/6324436
 * 
 * This is a simplified version. Full taxonomy has 6000+ categories.
 * For production, download the full taxonomy from Google.
 */

export interface CategoryNode {
  id: string;
  name: string;
  path: string[];
  children?: CategoryNode[];
}

/**
 * Top-level Google Product Categories
 * Full taxonomy: https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
 */
export const GOOGLE_PRODUCT_TAXONOMY: CategoryNode[] = [
  {
    id: "1",
    name: "Animals & Pet Supplies",
    path: ["Animals & Pet Supplies"],
    children: [
      { id: "2", name: "Live Animals", path: ["Animals & Pet Supplies", "Live Animals"] },
      { id: "3", name: "Pet Supplies", path: ["Animals & Pet Supplies", "Pet Supplies"] },
    ]
  },
  {
    id: "166",
    name: "Apparel & Accessories",
    path: ["Apparel & Accessories"],
    children: [
      {
        id: "1604",
        name: "Clothing",
        path: ["Apparel & Accessories", "Clothing"],
        children: [
          { id: "212", name: "Activewear", path: ["Apparel & Accessories", "Clothing", "Activewear"] },
          { id: "5322", name: "Dresses", path: ["Apparel & Accessories", "Clothing", "Dresses"] },
          { id: "213", name: "Outerwear", path: ["Apparel & Accessories", "Clothing", "Outerwear"] },
        ]
      },
      {
        id: "1581",
        name: "Shoes",
        path: ["Apparel & Accessories", "Shoes"],
        children: [
          { id: "3130", name: "Athletic Shoes", path: ["Apparel & Accessories", "Shoes", "Athletic Shoes"] },
          { id: "187", name: "Boots", path: ["Apparel & Accessories", "Shoes", "Boots"] },
          { id: "188", name: "Sandals", path: ["Apparel & Accessories", "Shoes", "Sandals"] },
        ]
      },
      {
        id: "167",
        name: "Clothing Accessories",
        path: ["Apparel & Accessories", "Clothing Accessories"],
      }
    ]
  },
  {
    id: "632",
    name: "Electronics",
    path: ["Electronics"],
    children: [
      {
        id: "222",
        name: "Computers",
        path: ["Electronics", "Computers"],
        children: [
          { id: "298", name: "Desktop Computers", path: ["Electronics", "Computers", "Desktop Computers"] },
          { id: "328", name: "Laptops", path: ["Electronics", "Computers", "Laptops"] },
        ]
      },
      {
        id: "249",
        name: "Electronics Accessories",
        path: ["Electronics", "Electronics Accessories"],
      }
    ]
  },
  {
    id: "436",
    name: "Food, Beverages & Tobacco",
    path: ["Food, Beverages & Tobacco"],
  },
  {
    id: "469",
    name: "Furniture",
    path: ["Furniture"],
  },
  {
    id: "536",
    name: "Health & Beauty",
    path: ["Health & Beauty"],
    children: [
      { id: "567", name: "Health Care", path: ["Health & Beauty", "Health Care"] },
      { id: "2915", name: "Personal Care", path: ["Health & Beauty", "Personal Care"] },
    ]
  },
  {
    id: "536",
    name: "Home & Garden",
    path: ["Home & Garden"],
    children: [
      { id: "696", name: "Home Decor", path: ["Home & Garden", "Home Decor"] },
      { id: "2962", name: "Kitchen & Dining", path: ["Home & Garden", "Kitchen & Dining"] },
    ]
  },
  {
    id: "888",
    name: "Sporting Goods",
    path: ["Sporting Goods"],
  },
  {
    id: "1279",
    name: "Toys & Games",
    path: ["Toys & Games"],
  },
];

/**
 * Flatten taxonomy for easy searching
 */
export function flattenTaxonomy(nodes: CategoryNode[], result: CategoryNode[] = []): CategoryNode[] {
  for (const node of nodes) {
    result.push(node);
    if (node.children) {
      flattenTaxonomy(node.children, result);
    }
  }
  return result;
}

/**
 * Search taxonomy by keyword
 */
export function searchCategories(query: string, limit = 10): CategoryNode[] {
  const flat = flattenTaxonomy(GOOGLE_PRODUCT_TAXONOMY);
  const lowerQuery = query.toLowerCase();
  
  return flat
    .filter(node => 
      node.name.toLowerCase().includes(lowerQuery) ||
      node.path.some(p => p.toLowerCase().includes(lowerQuery))
    )
    .slice(0, limit);
}

/**
 * Get category by ID
 */
export function getCategoryById(id: string): CategoryNode | null {
  const flat = flattenTaxonomy(GOOGLE_PRODUCT_TAXONOMY);
  return flat.find(node => node.id === id) || null;
}

/**
 * Validate category path against Google taxonomy
 */
export function validateCategoryPath(path: string[]): boolean {
  const flat = flattenTaxonomy(GOOGLE_PRODUCT_TAXONOMY);
  const pathString = path.join(' > ');
  
  return flat.some(node => 
    node.path.join(' > ') === pathString
  );
}

/**
 * Suggest categories based on product title/description
 */
export function suggestCategories(text: string, limit = 5): CategoryNode[] {
  const lowerText = text.toLowerCase();
  const flat = flattenTaxonomy(GOOGLE_PRODUCT_TAXONOMY);
  
  // Simple keyword matching (can be enhanced with ML)
  const scored = flat.map(node => {
    let score = 0;
    const keywords = node.path.join(' ').toLowerCase().split(' ');
    
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        score += 1;
      }
    }
    
    return { node, score };
  });
  
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.node);
}
