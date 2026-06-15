'use client';

/**
 * ProductDetailTabs — tabbed interface for product detail sections.
 *
 * Consolidates Description, Specifications, Features, and Enriched Data
 * (Nutrition, Allergens, Environmental) into a single tabbed UI.
 *
 * Used by Layout B (Showcase) for desktop/tablet tabs.
 * Layout C (Quick Commerce) may use accordion mode instead.
 *
 * Only renders tabs that have content.
 */

import React, { useState, useMemo } from 'react';

export interface ProductDetailTabsProps {
  product: {
    description?: string;
    marketingDescription?: string;
    specifications?: Record<string, any>;
    features?: string[];
    ingredients?: string;
    nutritionFacts?: Record<string, any>;
    allergens?: string[];
    dietaryInfo?: string[];
    environmentalInfo?: string[];
    dimensions?: { length?: number; width?: number; height?: number; unit?: string };
    weight?: { value?: number; unit?: string };
  };
  /** Whether the merchant's tier grants marketing description */
  showMarketingDescription?: boolean;
  /** Default active tab key */
  defaultTab?: string;
  /** 'tabs' for horizontal tabs, 'accordion' for collapsible sections */
  displayMode?: 'tabs' | 'accordion';
}

interface TabDefinition {
  key: string;
  label: string;
  content: React.ReactNode;
}

export function ProductDetailTabs({
  product,
  showMarketingDescription = true,
  defaultTab,
  displayMode = 'tabs',
}: ProductDetailTabsProps) {
  // Build tab list from available content
  const tabs = useMemo<TabDefinition[]>(() => {
    const result: TabDefinition[] = [];

    // Description tab
    if (product.description || (showMarketingDescription && product.marketingDescription)) {
      result.push({
        key: 'description',
        label: 'Description',
        content: (
          <div className="space-y-4">
            {product.description && (
              <div>
                {showMarketingDescription && product.marketingDescription && (
                  <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Product Details
                  </h4>
                )}
                <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}
            {showMarketingDescription && product.marketingDescription && (
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  Marketing
                </h4>
                <p className="text-lg text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                  {product.marketingDescription}
                </p>
              </div>
            )}
          </div>
        ),
      });
    }

    // Specifications tab
    const hasSpecs =
      (product.specifications && Object.keys(product.specifications).length > 0) ||
      product.dimensions ||
      product.weight;
    if (hasSpecs) {
      result.push({
        key: 'specifications',
        label: 'Specifications',
        content: (
          <dl className="space-y-2 text-sm">
            {product.dimensions && (
              <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                <dt className="font-medium text-neutral-700 dark:text-neutral-300">Dimensions</dt>
                <dd className="text-neutral-900 dark:text-white">
                  {product.dimensions.length} x {product.dimensions.width} x{' '}
                  {product.dimensions.height} {product.dimensions.unit}
                </dd>
              </div>
            )}
            {product.weight && (
              <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                <dt className="font-medium text-neutral-700 dark:text-neutral-300">Weight</dt>
                <dd className="text-neutral-900 dark:text-white">
                  {product.weight.value} {product.weight.unit}
                </dd>
              </div>
            )}
            {product.specifications &&
              Object.entries(product.specifications).map(([key, value]) => (
                <div
                  key={key}
                  className="py-2 border-b border-neutral-200 dark:border-neutral-700"
                >
                  <dt className="font-medium text-neutral-700 dark:text-neutral-300 capitalize">
                    {key.replace(/_/g, ' ')}
                  </dt>
                  <dd className="text-neutral-900 dark:text-white mt-1">
                    {typeof value === 'object' && value !== null ? (
                      <dl className="pl-4 space-y-1">
                        {Object.entries(value as Record<string, any>).map(
                          ([subKey, subValue]) => (
                            <div key={subKey} className="flex justify-between text-sm">
                              <dt className="text-neutral-600 dark:text-neutral-400 capitalize">
                                {subKey.replace(/_/g, ' ')}
                              </dt>
                              <dd className="text-neutral-800 dark:text-neutral-200">
                                {String(subValue)}
                              </dd>
                            </div>
                          ),
                        )}
                      </dl>
                    ) : (
                      String(value)
                    )}
                  </dd>
                </div>
              ))}
          </dl>
        ),
      });
    }

    // Features tab
    if (product.features && product.features.length > 0) {
      result.push({
        key: 'features',
        label: 'Features',
        content: (
          <ul className="space-y-2">
            {product.features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <span className="text-green-600 dark:text-green-400 font-bold mt-0.5">
                  ✓
                </span>
                <span className="text-neutral-700 dark:text-neutral-300">{feature}</span>
              </li>
            ))}
          </ul>
        ),
      });
    }

    // Nutrition / Allergens / Environmental tab (combined)
    const hasNutrition =
      product.ingredients ||
      (product.nutritionFacts && Object.keys(product.nutritionFacts).length > 0) ||
      (product.allergens && product.allergens.length > 0) ||
      (product.dietaryInfo && product.dietaryInfo.length > 0) ||
      (product.environmentalInfo && product.environmentalInfo.length > 0);
    if (hasNutrition) {
      result.push({
        key: 'nutrition',
        label: 'Nutrition & Info',
        content: (
          <div className="space-y-6">
            {product.ingredients && (
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  Ingredients
                </h4>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  {product.ingredients}
                </p>
              </div>
            )}
            {product.allergens && product.allergens.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                  Contains Allergens
                </h4>
                <div className="flex flex-wrap gap-2">
                  {product.allergens.map((allergen, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-sm font-medium"
                    >
                      {allergen}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {product.dietaryInfo && product.dietaryInfo.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  Dietary Information
                </h4>
                <div className="flex flex-wrap gap-2">
                  {product.dietaryInfo.map((info, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium"
                    >
                      {info}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {product.environmentalInfo && product.environmentalInfo.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  Environmental Information
                </h4>
                <ul className="space-y-1">
                  {product.environmentalInfo.map((info, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-green-600 dark:text-green-400 font-bold mt-0.5">
                        ✓
                      </span>
                      <span className="text-neutral-700 dark:text-neutral-300">
                        {info}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ),
      });
    }

    return result;
  }, [product, showMarketingDescription]);

  // Active tab state
  const [activeTab, setActiveTab] = useState(
    defaultTab || tabs[0]?.key || 'description',
  );

  if (tabs.length === 0) return null;

  // Ensure activeTab is valid
  const validActiveTab = tabs.find((t) => t.key === activeTab)
    ? activeTab
    : tabs[0]?.key;

  // ---- Accordion mode ----
  if (displayMode === 'accordion') {
    return <AccordionView tabs={tabs} />;
  }

  // ---- Tabs mode ----
  return (
    <div className="w-full">
      {/* Tab headers */}
      <div
        className="flex border-b border-neutral-200 dark:border-neutral-700 overflow-x-auto"
        role="tablist"
        aria-label="Product details"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={tab.key === validActiveTab}
            aria-controls={`tabpanel-${tab.key}`}
            id={`tab-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab.key === validActiveTab
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`tabpanel-${tab.key}`}
          aria-labelledby={`tab-${tab.key}`}
          hidden={tab.key !== validActiveTab}
          className="py-6"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accordion sub-component (for Quick Commerce / mobile)
// ---------------------------------------------------------------------------

function AccordionView({ tabs }: { tabs: TabDefinition[] }) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
      {tabs.map((tab) => {
        const isOpen = openKeys.has(tab.key);
        return (
          <div key={tab.key}>
            <button
              onClick={() => toggle(tab.key)}
              className="flex items-center justify-between w-full py-4 text-left text-sm font-semibold text-neutral-900 dark:text-white hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              aria-expanded={isOpen}
              aria-controls={`accordion-${tab.key}`}
            >
              {tab.label}
              <svg
                className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {isOpen && (
              <div
                id={`accordion-${tab.key}`}
                className="pb-4"
              >
                {tab.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
