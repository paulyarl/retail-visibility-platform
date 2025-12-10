'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui';

// Google Product Taxonomy mapping for common categories
const GOOGLE_TAXONOMY_MAPPINGS: Record<string, string[]> = {
  // Condiments & Sauces
  'en:condiments': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Condiments'],
  'en:sauces': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Sauces'],
  'en:tomato-sauces': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Sauces > Tomato Sauces'],
  'en:pasta-sauces': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Sauces > Pasta Sauces'],
  'en:mayonnaises': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Condiments > Mayonnaise'],
  'en:ketchups': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Condiments > Ketchup'],
  'en:mustards': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Condiments > Mustard'],
  'en:vinegars': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Condiments > Vinegar'],
  'en:olives': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Condiments > Olives'],
  'en:pickles': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Condiments > Pickles'],

  // Dairy
  'en:dairies': ['Food, Beverages & Tobacco > Food Items > Dairy & Eggs'],
  'en:milks': ['Food, Beverages & Tobacco > Food Items > Dairy & Eggs > Milk'],
  'en:cheeses': ['Food, Beverages & Tobacco > Food Items > Dairy & Eggs > Cheese'],
  'en:yogurts': ['Food, Beverages & Tobacco > Food Items > Dairy & Eggs > Yogurt'],
  'en:butters': ['Food, Beverages & Tobacco > Food Items > Dairy & Eggs > Butter'],
  'en:creams': ['Food, Beverages & Tobacco > Food Items > Dairy & Eggs > Cream'],
  'en:eggs': ['Food, Beverages & Tobacco > Food Items > Dairy & Eggs > Eggs'],

  // Beverages
  'en:beverages': ['Food, Beverages & Tobacco > Beverages'],
  'en:waters': ['Food, Beverages & Tobacco > Beverages > Water'],
  'en:juices': ['Food, Beverages & Tobacco > Beverages > Juice'],
  'en:sodas': ['Food, Beverages & Tobacco > Beverages > Soft Drinks'],
  'en:coffees': ['Food, Beverages & Tobacco > Beverages > Coffee'],
  'en:teas': ['Food, Beverages & Tobacco > Beverages > Tea'],
  'en:beers': ['Food, Beverages & Tobacco > Beverages > Beer'],
  'en:wines': ['Food, Beverages & Tobacco > Beverages > Wine'],
  'en:energy-drinks': ['Food, Beverages & Tobacco > Beverages > Energy Drinks'],

  // Snacks
  'en:snacks': ['Food, Beverages & Tobacco > Food Items > Snacks'],
  'en:chips': ['Food, Beverages & Tobacco > Food Items > Snacks > Chips & Crisps'],
  'en:cookies': ['Food, Beverages & Tobacco > Food Items > Snacks > Cookies'],
  'en:chocolates': ['Food, Beverages & Tobacco > Food Items > Snacks > Chocolate'],
  'en:nuts': ['Food, Beverages & Tobacco > Food Items > Snacks > Nuts & Seeds'],
  'en:popcorn': ['Food, Beverages & Tobacco > Food Items > Snacks > Popcorn'],
  'en:cereals': ['Food, Beverages & Tobacco > Food Items > Breakfast Foods > Cereals'],
  'en:bars': ['Food, Beverages & Tobacco > Food Items > Snacks > Nutrition Bars'],

  // Bakery
  'en:breads': ['Food, Beverages & Tobacco > Food Items > Bakery > Bread'],
  'en:cakes': ['Food, Beverages & Tobacco > Food Items > Bakery > Cakes'],
  'en:pastries': ['Food, Beverages & Tobacco > Food Items > Bakery > Pastries'],
  'en:muffins': ['Food, Beverages & Tobacco > Food Items > Bakery > Muffins'],
  'en:bagels': ['Food, Beverages & Tobacco > Food Items > Bakery > Bagels'],
  'en:rolls': ['Food, Beverages & Tobacco > Food Items > Bakery > Rolls'],

  // Meat & Seafood
  'en:meats': ['Food, Beverages & Tobacco > Food Items > Meat & Seafood'],
  'en:poultries': ['Food, Beverages & Tobacco > Food Items > Meat & Seafood > Poultry'],
  'en:beef': ['Food, Beverages & Tobacco > Food Items > Meat & Seafood > Beef'],
  'en:pork': ['Food, Beverages & Tobacco > Food Items > Meat & Seafood > Pork'],
  'en:fish': ['Food, Beverages & Tobacco > Food Items > Meat & Seafood > Fish & Seafood'],
  'en:seafood': ['Food, Beverages & Tobacco > Food Items > Meat & Seafood > Fish & Seafood'],
  'en:turkey': ['Food, Beverages & Tobacco > Food Items > Meat & Seafood > Poultry > Turkey'],
  'en:chicken': ['Food, Beverages & Tobacco > Food Items > Meat & Seafood > Poultry > Chicken'],

  // Produce
  'en:fruits': ['Food, Beverages & Tobacco > Food Items > Produce > Fruit'],
  'en:vegetables': ['Food, Beverages & Tobacco > Food Items > Produce > Vegetables'],
  'en:apples': ['Food, Beverages & Tobacco > Food Items > Produce > Fruit > Apples'],
  'en:bananas': ['Food, Beverages & Tobacco > Food Items > Produce > Fruit > Bananas'],
  'en:oranges': ['Food, Beverages & Tobacco > Food Items > Produce > Fruit > Oranges'],
  'en:lemons': ['Food, Beverages & Tobacco > Food Items > Produce > Fruit > Lemons'],
  'en:berries': ['Food, Beverages & Tobacco > Food Items > Produce > Fruit > Berries'],
  'en:potatoes': ['Food, Beverages & Tobacco > Food Items > Produce > Vegetables > Potatoes'],
  'en:tomatoes': ['Food, Beverages & Tobacco > Food Items > Produce > Vegetables > Tomatoes'],
  'en:onions': ['Food, Beverages & Tobacco > Food Items > Produce > Vegetables > Onions'],
  'en:lettuce': ['Food, Beverages & Tobacco > Food Items > Produce > Vegetables > Lettuce'],
  'en:carrots': ['Food, Beverages & Tobacco > Food Items > Produce > Vegetables > Carrots'],
  'en:broccoli': ['Food, Beverages & Tobacco > Food Items > Produce > Vegetables > Broccoli'],

  // Frozen Foods
  'en:frozen-foods': ['Food, Beverages & Tobacco > Food Items > Frozen Foods'],
  'en:frozen-vegetables': ['Food, Beverages & Tobacco > Food Items > Frozen Foods > Frozen Vegetables'],
  'en:frozen-fruits': ['Food, Beverages & Tobacco > Food Items > Frozen Foods > Frozen Fruit'],
  'en:frozen-meals': ['Food, Beverages & Tobacco > Food Items > Frozen Foods > Frozen Meals'],
  'en:ice-creams': ['Food, Beverages & Tobacco > Food Items > Frozen Foods > Ice Cream'],

  // Canned Foods
  'en:canned-foods': ['Food, Beverages & Tobacco > Food Items > Canned Foods'],
  'en:canned-vegetables': ['Food, Beverages & Tobacco > Food Items > Canned Foods > Canned Vegetables'],
  'en:canned-fruits': ['Food, Beverages & Tobacco > Food Items > Canned Foods > Canned Fruit'],
  'en:canned-fish': ['Food, Beverages & Tobacco > Food Items > Canned Foods > Canned Fish & Seafood'],

  // Breakfast Foods
  'en:breakfasts': ['Food, Beverages & Tobacco > Food Items > Breakfast Foods'],
  'en:oatmeals': ['Food, Beverages & Tobacco > Food Items > Breakfast Foods > Oatmeal'],
  'en:pancakes': ['Food, Beverages & Tobacco > Food Items > Breakfast Foods > Pancakes & Waffles'],

  // Pasta & Rice
  'en:pastas': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Pasta'],
  'en:rices': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Rice'],
  'en:noodles': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Noodles'],

  // Oils & Cooking
  'en:oils': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Cooking Oils'],
  'en:olive-oils': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Cooking Oils > Olive Oil'],
  'en:vegetable-oils': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Cooking Oils > Vegetable Oil'],
  'en:spices': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Spices & Seasonings'],
  'en:herbs': ['Food, Beverages & Tobacco > Food Items > Pantry Staples > Spices & Seasonings > Herbs'],

  // Baby Food
  'en:baby-foods': ['Food, Beverages & Tobacco > Food Items > Baby Food'],

  // Pet Food
  'en:pet-foods': ['Food, Beverages & Tobacco > Pet Supplies > Pet Food'],
  'en:dog-foods': ['Food, Beverages & Tobacco > Pet Supplies > Pet Food > Dog Food'],
  'en:cat-foods': ['Food, Beverages & Tobacco > Pet Supplies > Pet Food > Cat Food'],

  // Household
  'en:cleaners': ['Home & Garden > Household Supplies > Household Cleaners'],
  'en:detergents': ['Home & Garden > Household Supplies > Laundry Supplies > Laundry Detergent'],
  'en:soaps': ['Home & Garden > Household Supplies > Soaps & Body Wash'],

  // Personal Care
  'en:shampoos': ['Health & Beauty > Personal Care > Hair Care > Shampoos'],
  'en:toothpastes': ['Health & Beauty > Personal Care > Oral Care > Toothpaste'],
  'en:deodorants': ['Health & Beauty > Personal Care > Deodorants'],

  // Health & Nutrition
  'en:supplements': ['Health & Beauty > Health Care > Vitamins & Supplements'],
  'en:vitamins': ['Health & Beauty > Health Care > Vitamins & Supplements'],
  'en:protein-powders': ['Health & Beauty > Health Care > Vitamins & Supplements > Protein Supplements'],
};

interface GoogleTaxonomySuggestionsProps {
  categoryPath: string[];
  onSelectSuggestion: (googleCategoryPath: string) => void;
  selectedGoogleCategory?: string;
}

export default function GoogleTaxonomySuggestions({
  categoryPath,
  onSelectSuggestion,
  selectedGoogleCategory,
}: GoogleTaxonomySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!categoryPath || categoryPath.length === 0) {
      setSuggestions([]);
      return;
    }

    const suggestedCategories = new Set<string>();

    // Map each category in the path to Google taxonomy
    categoryPath.forEach(category => {
      const normalizedCategory = category.toLowerCase().replace(/^en:/, '');
      const mappings = GOOGLE_TAXONOMY_MAPPINGS[normalizedCategory] ||
                      GOOGLE_TAXONOMY_MAPPINGS[`en:${normalizedCategory}`];

      if (mappings) {
        mappings.forEach(mapping => suggestedCategories.add(mapping));
      }
    });

    // If no direct mappings, try to infer from keywords
    if (suggestedCategories.size === 0) {
      categoryPath.forEach(category => {
        const normalized = category.toLowerCase().replace(/^en:/, '');

        // Keyword-based inference
        if (normalized.includes('condiment') || normalized.includes('sauce')) {
          suggestedCategories.add('Food, Beverages & Tobacco > Food Items > Pantry Staples > Condiments');
        }
        if (normalized.includes('beverage') || normalized.includes('drink')) {
          suggestedCategories.add('Food, Beverages & Tobacco > Beverages');
        }
        if (normalized.includes('snack')) {
          suggestedCategories.add('Food, Beverages & Tobacco > Food Items > Snacks');
        }
        if (normalized.includes('dairy') || normalized.includes('milk') || normalized.includes('cheese')) {
          suggestedCategories.add('Food, Beverages & Tobacco > Food Items > Dairy & Eggs');
        }
        if (normalized.includes('meat') || normalized.includes('fish') || normalized.includes('seafood')) {
          suggestedCategories.add('Food, Beverages & Tobacco > Food Items > Meat & Seafood');
        }
        if (normalized.includes('fruit') || normalized.includes('vegetable') || normalized.includes('produce')) {
          suggestedCategories.add('Food, Beverages & Tobacco > Food Items > Produce');
        }
      });
    }

    setSuggestions(Array.from(suggestedCategories));
  }, [categoryPath]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <h4 className="text-sm font-semibold text-green-800 dark:text-green-200">
          Google Taxonomy Suggestions
        </h4>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelectSuggestion(suggestion)}
            className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
              selectedGoogleCategory === suggestion
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-green-200 dark:border-green-700 hover:border-green-300 dark:hover:border-green-600 bg-green-50/50 dark:bg-green-900/10'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-green-900 dark:text-green-100">
                  {suggestion.split(' > ').pop()}
                </div>
                <div className="text-xs text-green-700 dark:text-green-300 mt-1 font-mono">
                  {suggestion}
                </div>
              </div>
              {selectedGoogleCategory === suggestion && (
                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2">
        💡 These suggestions are based on Google's Product Taxonomy for optimal Google Merchant Center sync
      </div>
    </div>
  );
}
