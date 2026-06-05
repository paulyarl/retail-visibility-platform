'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import NutritionFacts from './NutritionFacts';
import AllergenWarnings from './AllergenWarnings';
import ProductSpecifications from './ProductSpecifications';
import EnvironmentalInfo from './EnvironmentalInfo';

interface EnrichedProductDetailsProps {
  metadata?: any;
  className?: string;
}

export default function EnrichedProductDetails({ metadata, className = '' }: EnrichedProductDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!metadata) {
    return null;
  }

  // Check what data is available
  const hasNutrition = metadata.nutrition && metadata.nutrition.per_100g;
  const hasAllergens = metadata.allergens || metadata.allergens_tags || metadata.ingredients_analysis;
  const hasSpecs = metadata.specifications || metadata.features || metadata.warranty || metadata.manufacturer;
  const hasEnvironmental = metadata.environmental || metadata.labels || metadata.nova_group;
  const hasIngredients = metadata.ingredients;

  const hasAnyEnrichedData = hasNutrition || hasAllergens || hasSpecs || hasEnvironmental || hasIngredients;

  if (!hasAnyEnrichedData) {
    return null;
  }

  return (
    <div className={`border-t border-neutral-200 dark:border-neutral-700 ${className}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full py-4 px-6 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-lg text-neutral-900 dark:text-white">
              Detailed Product Information
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {hasNutrition && 'Nutrition facts, '}
              {hasAllergens && 'allergens, '}
              {hasSpecs && 'specifications, '}
              {hasEnvironmental && 'environmental impact, '}
              and more
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
            {isExpanded ? 'Hide' : 'Show'} Details
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-6 bg-neutral-50 dark:bg-neutral-900/50">
          {/* Info Banner */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Automatically Enriched Product Data
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  This information was automatically retrieved when the product was scanned into our system.
                  We partner with Open Food Facts and UPC Database to provide you with comprehensive product details
                  - just like the big retailers!
                </p>
              </div>
            </div>
          </div>

          {/* Ingredients */}
          {hasIngredients && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 border border-neutral-200 dark:border-neutral-700">
              <h4 className="font-semibold text-neutral-900 dark:text-white mb-3">Ingredients</h4>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                {metadata.ingredients}
              </p>
            </div>
          )}

          {/* Nutrition Facts */}
          {hasNutrition && (
            <NutritionFacts nutrition={metadata.nutrition} />
          )}

          {/* Allergen Warnings */}
          {hasAllergens && (
            <AllergenWarnings
              allergens={metadata.allergens}
              allergens_tags={metadata.allergens_tags}
              traces={metadata.traces}
              traces_tags={metadata.traces_tags}
              ingredients_analysis={metadata.ingredients_analysis}
            />
          )}

          {/* Product Specifications */}
          {hasSpecs && (
            <ProductSpecifications
              specifications={metadata.specifications}
              features={metadata.features}
              warranty={metadata.warranty}
              manufacturer={metadata.manufacturer}
            />
          )}

          {/* Environmental Info */}
          {hasEnvironmental && (
            <EnvironmentalInfo
              environmental={metadata.environmental}
              labels={metadata.labels}
              labels_tags={metadata.labels_tags}
              nova_group={metadata.nova_group}
            />
          )}

          {/* Data Source Attribution */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
            <p className="text-xs text-neutral-600 dark:text-neutral-400 text-center">
              Product data sourced from{' '}
              <a
                href="https://world.openfoodfacts.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                Open Food Facts
              </a>
              {' '}and{' '}
              <a
                href="https://upcdatabase.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                UPC Database
              </a>
              . Information may vary by product batch. Always check product packaging for the most accurate details.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
