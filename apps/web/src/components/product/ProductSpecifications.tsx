'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Package, Ruler, Palette } from 'lucide-react';

interface SpecificationsData {
  weight?: string | Record<string, string>;
  length?: string;
  width?: string;
  height?: string;
  color?: string;
  size?: string;
  material?: string;
  [key: string]: string | Record<string, string> | undefined;
}

interface ProductSpecificationsProps {
  specifications?: SpecificationsData;
  features?: string[];
  warranty?: string;
  manufacturer?: string;
  className?: string;
}

// Helper to render a specification value (handles nested objects)
function renderSpecValue(value: string | Record<string, string> | undefined): React.ReactNode {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return (
      <dl className="pl-2 space-y-1">
        {Object.entries(value).map(([subKey, subValue]) => (
          <div key={subKey} className="flex justify-between text-sm">
            <dt className="text-neutral-600 dark:text-neutral-400 capitalize">{subKey.replace(/_/g, ' ')}</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{subValue}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return null;
}

export default function ProductSpecifications({
  specifications,
  features,
  warranty,
  manufacturer,
  className = ''
}: ProductSpecificationsProps) {
  const hasSpecs = specifications && Object.values(specifications).some(v => v);
  const hasFeatures = features && features.length > 0;
  const hasOtherInfo = warranty || manufacturer;

  if (!hasSpecs && !hasFeatures && !hasOtherInfo) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="w-5 h-5" />
          Product Specifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dimensions & Physical Properties */}
        {hasSpecs && (
          <div>
            <h4 className="font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
              <Ruler className="w-4 h-4" />
              Dimensions & Properties
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {specifications.length && (
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Length</div>
                  <div className="font-medium text-neutral-900 dark:text-white">{renderSpecValue(specifications.length)}</div>
                </div>
              )}
              {specifications.width && (
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Width</div>
                  <div className="font-medium text-neutral-900 dark:text-white">{renderSpecValue(specifications.width)}</div>
                </div>
              )}
              {specifications.height && (
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Height</div>
                  <div className="font-medium text-neutral-900 dark:text-white">{renderSpecValue(specifications.height)}</div>
                </div>
              )}
              {specifications.weight && (
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Weight</div>
                  <div className="font-medium text-neutral-900 dark:text-white">{renderSpecValue(specifications.weight)}</div>
                </div>
              )}
              {specifications.color && (
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1 flex items-center gap-1">
                    <Palette className="w-3 h-3" />
                    Color
                  </div>
                  <div className="font-medium text-neutral-900 dark:text-white">{renderSpecValue(specifications.color)}</div>
                </div>
              )}
              {specifications.size && (
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Size</div>
                  <div className="font-medium text-neutral-900 dark:text-white">{renderSpecValue(specifications.size)}</div>
                </div>
              )}
              {specifications.material && (
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 col-span-2">
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Material</div>
                  <div className="font-medium text-neutral-900 dark:text-white">{renderSpecValue(specifications.material)}</div>
                </div>
              )}
              {/* Render any additional specifications not in the predefined list */}
              {Object.entries(specifications)
                .filter(([key]) => !['length', 'width', 'height', 'weight', 'color', 'size', 'material'].includes(key))
                .filter(([, value]) => value)
                .map(([key, value]) => (
                  <div key={key} className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 col-span-2">
                    <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1 capitalize">{key.replace(/_/g, ' ')}</div>
                    <div className="font-medium text-neutral-900 dark:text-white">{renderSpecValue(value)}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Features */}
        {hasFeatures && (
          <div>
            <h4 className="font-semibold text-neutral-900 dark:text-white mb-3">Key Features</h4>
            <ul className="space-y-2">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-primary-600 dark:text-primary-400 mt-1">•</span>
                  <span className="text-neutral-700 dark:text-neutral-300 text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Additional Info */}
        {hasOtherInfo && (
          <div className="space-y-3">
            {manufacturer && (
              <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Manufacturer</span>
                <span className="text-sm text-neutral-900 dark:text-white">{manufacturer}</span>
              </div>
            )}
            {warranty && (
              <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Warranty</span>
                <span className="text-sm text-neutral-900 dark:text-white">{warranty}</span>
              </div>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            * Product specifications are provided by UPC Database and may vary by model or version.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
