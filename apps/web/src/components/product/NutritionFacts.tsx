'use client';

import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';

interface NutritionData {
  grade?: string;
  score?: number;
  per_100g?: {
    energy_kcal?: number;
    fat?: number;
    saturated_fat?: number;
    trans_fat?: number;
    carbohydrates?: number;
    sugars?: number;
    fiber?: number;
    proteins?: number;
    salt?: number;
    sodium?: number;
    vitamin_a?: number;
    vitamin_c?: number;
    vitamin_d?: number;
    calcium?: number;
    iron?: number;
  };
  serving_size?: string;
  serving_quantity?: string;
}

interface NutritionFactsProps {
  nutrition: NutritionData;
  className?: string;
}

export default function NutritionFacts({ nutrition, className = '' }: NutritionFactsProps) {
  if (!nutrition || !nutrition.per_100g) {
    return null;
  }

  const { per_100g, grade, serving_size } = nutrition;

  // Nutri-Score badge color
  const getGradeColor = (grade?: string) => {
    switch (grade?.toUpperCase()) {
      case 'A': return 'bg-green-500 text-white';
      case 'B': return 'bg-lime-500 text-white';
      case 'C': return 'bg-yellow-500 text-white';
      case 'D': return 'bg-orange-500 text-white';
      case 'E': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const formatValue = (value?: number, unit: string = 'g') => {
    if (value === undefined || value === null) return null;
    return `${value.toFixed(1)}${unit}`;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Nutrition Facts</CardTitle>
          {grade && (
            <Badge className={`${getGradeColor(grade)} font-bold text-lg px-3 py-1`}>
              Nutri-Score: {grade.toUpperCase()}
            </Badge>
          )}
        </div>
        {serving_size && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Per 100g {serving_size && `(Serving: ${serving_size})`}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Energy */}
          {per_100g.energy_kcal && (
            <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
              <span className="font-semibold text-neutral-900 dark:text-white">Energy</span>
              <span className="text-neutral-700 dark:text-neutral-300">{per_100g.energy_kcal} kcal</span>
            </div>
          )}

          {/* Fat */}
          {per_100g.fat !== undefined && (
            <>
              <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
                <span className="font-semibold text-neutral-900 dark:text-white">Fat</span>
                <span className="text-neutral-700 dark:text-neutral-300">{formatValue(per_100g.fat)}</span>
              </div>
              {per_100g.saturated_fat !== undefined && (
                <div className="flex justify-between items-center py-1 pl-4 text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">Saturated Fat</span>
                  <span className="text-neutral-600 dark:text-neutral-400">{formatValue(per_100g.saturated_fat)}</span>
                </div>
              )}
              {per_100g.trans_fat !== undefined && (
                <div className="flex justify-between items-center py-1 pl-4 text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">Trans Fat</span>
                  <span className="text-neutral-600 dark:text-neutral-400">{formatValue(per_100g.trans_fat)}</span>
                </div>
              )}
            </>
          )}

          {/* Carbohydrates */}
          {per_100g.carbohydrates !== undefined && (
            <>
              <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
                <span className="font-semibold text-neutral-900 dark:text-white">Carbohydrates</span>
                <span className="text-neutral-700 dark:text-neutral-300">{formatValue(per_100g.carbohydrates)}</span>
              </div>
              {per_100g.sugars !== undefined && (
                <div className="flex justify-between items-center py-1 pl-4 text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">Sugars</span>
                  <span className="text-neutral-600 dark:text-neutral-400">{formatValue(per_100g.sugars)}</span>
                </div>
              )}
              {per_100g.fiber !== undefined && (
                <div className="flex justify-between items-center py-1 pl-4 text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">Fiber</span>
                  <span className="text-neutral-600 dark:text-neutral-400">{formatValue(per_100g.fiber)}</span>
                </div>
              )}
            </>
          )}

          {/* Protein */}
          {per_100g.proteins !== undefined && (
            <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
              <span className="font-semibold text-neutral-900 dark:text-white">Protein</span>
              <span className="text-neutral-700 dark:text-neutral-300">{formatValue(per_100g.proteins)}</span>
            </div>
          )}

          {/* Salt/Sodium */}
          {(per_100g.salt !== undefined || per_100g.sodium !== undefined) && (
            <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-neutral-700">
              <span className="font-semibold text-neutral-900 dark:text-white">Salt</span>
              <span className="text-neutral-700 dark:text-neutral-300">
                {per_100g.salt !== undefined ? formatValue(per_100g.salt) : formatValue(per_100g.sodium)}
              </span>
            </div>
          )}

          {/* Vitamins & Minerals */}
          {(per_100g.vitamin_a || per_100g.vitamin_c || per_100g.vitamin_d || per_100g.calcium || per_100g.iron) && (
            <div className="pt-3 mt-3 border-t border-neutral-300 dark:border-neutral-600">
              <h4 className="font-semibold text-sm text-neutral-900 dark:text-white mb-2">Vitamins & Minerals</h4>
              <div className="space-y-1 text-sm">
                {per_100g.vitamin_a && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">Vitamin A</span>
                    <span className="text-neutral-600 dark:text-neutral-400">{formatValue(per_100g.vitamin_a, 'μg')}</span>
                  </div>
                )}
                {per_100g.vitamin_c && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">Vitamin C</span>
                    <span className="text-neutral-600 dark:text-neutral-400">{formatValue(per_100g.vitamin_c, 'mg')}</span>
                  </div>
                )}
                {per_100g.vitamin_d && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">Vitamin D</span>
                    <span className="text-neutral-600 dark:text-neutral-400">{formatValue(per_100g.vitamin_d, 'μg')}</span>
                  </div>
                )}
                {per_100g.calcium && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">Calcium</span>
                    <span className="text-neutral-600 dark:text-neutral-400">{formatValue(per_100g.calcium, 'mg')}</span>
                  </div>
                )}
                {per_100g.iron && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">Iron</span>
                    <span className="text-neutral-600 dark:text-neutral-400">{formatValue(per_100g.iron, 'mg')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            * Nutritional information is provided by Open Food Facts and may vary by product batch.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
