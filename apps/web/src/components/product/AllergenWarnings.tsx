'use client';

import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface AllergenWarningsProps {
  allergens?: string;
  allergens_tags?: string[];
  traces?: string;
  traces_tags?: string[];
  ingredients_analysis?: {
    vegan?: boolean;
    vegetarian?: boolean;
    palm_oil_free?: boolean;
  };
  className?: string;
}

export default function AllergenWarnings({
  allergens,
  allergens_tags,
  traces,
  traces_tags,
  ingredients_analysis,
  className = ''
}: AllergenWarningsProps) {
  const hasAllergens = allergens || (allergens_tags && allergens_tags.length > 0);
  const hasTraces = traces || (traces_tags && traces_tags.length > 0);
  const hasDietaryInfo = ingredients_analysis && (
    ingredients_analysis.vegan !== undefined ||
    ingredients_analysis.vegetarian !== undefined ||
    ingredients_analysis.palm_oil_free !== undefined
  );

  if (!hasAllergens && !hasTraces && !hasDietaryInfo) {
    return null;
  }

  const formatAllergenTag = (tag: string) => {
    return tag.replace('en:', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Allergens & Dietary Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Allergens */}
        {hasAllergens && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2">Contains Allergens</h4>
                {allergens && (
                  <p className="text-sm text-red-800 dark:text-red-200 mb-2">{allergens}</p>
                )}
                {allergens_tags && allergens_tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {allergens_tags.map((tag, idx) => (
                      <Badge key={idx} className="bg-red-600 text-white">
                        {formatAllergenTag(tag)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Traces */}
        {hasTraces && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">May Contain Traces</h4>
                {traces && (
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">{traces}</p>
                )}
                {traces_tags && traces_tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {traces_tags.map((tag, idx) => (
                      <Badge key={idx} className="bg-yellow-600 text-white">
                        {formatAllergenTag(tag)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dietary Information */}
        {hasDietaryInfo && (
          <div className="space-y-2">
            <h4 className="font-semibold text-neutral-900 dark:text-white">Dietary Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ingredients_analysis?.vegan !== undefined && (
                <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                  ingredients_analysis.vegan
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  {ingredients_analysis.vegan ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <div className="font-medium text-sm">Vegan</div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">
                      {ingredients_analysis.vegan ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
              )}

              {ingredients_analysis?.vegetarian !== undefined && (
                <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                  ingredients_analysis.vegetarian
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  {ingredients_analysis.vegetarian ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <div className="font-medium text-sm">Vegetarian</div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">
                      {ingredients_analysis.vegetarian ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
              )}

              {ingredients_analysis?.palm_oil_free !== undefined && (
                <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                  ingredients_analysis.palm_oil_free
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  {ingredients_analysis.palm_oil_free ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <div className="font-medium text-sm">Palm Oil Free</div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">
                      {ingredients_analysis.palm_oil_free ? 'Yes' : 'Contains'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            * Allergen information is provided by Open Food Facts. Always check product packaging for the most accurate information.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
