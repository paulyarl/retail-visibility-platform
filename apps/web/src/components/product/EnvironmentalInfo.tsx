'use client';

import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { Leaf, Recycle } from 'lucide-react';

interface EnvironmentalData {
  ecoscore_grade?: string;
  ecoscore_score?: number;
  carbon_footprint?: number;
  packaging_materials?: string[];
}

interface EnvironmentalInfoProps {
  environmental?: EnvironmentalData;
  labels?: string;
  labels_tags?: string[];
  nova_group?: number;
  className?: string;
}

export default function EnvironmentalInfo({
  environmental,
  labels,
  labels_tags,
  nova_group,
  className = ''
}: EnvironmentalInfoProps) {
  const hasEnvironmental = environmental && (
    environmental.ecoscore_grade ||
    environmental.carbon_footprint ||
    (environmental.packaging_materials && environmental.packaging_materials.length > 0)
  );
  const hasLabels = labels || (labels_tags && labels_tags.length > 0);
  const hasNovaScore = nova_group !== undefined;

  if (!hasEnvironmental && !hasLabels && !hasNovaScore) {
    return null;
  }

  // Eco-Score badge color
  const getEcoScoreColor = (grade?: string) => {
    switch (grade?.toUpperCase()) {
      case 'A': return 'bg-green-600 text-white';
      case 'B': return 'bg-lime-600 text-white';
      case 'C': return 'bg-yellow-600 text-white';
      case 'D': return 'bg-orange-600 text-white';
      case 'E': return 'bg-red-600 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  // NOVA group description
  const getNovaDescription = (group?: number) => {
    switch (group) {
      case 1: return 'Unprocessed or minimally processed foods';
      case 2: return 'Processed culinary ingredients';
      case 3: return 'Processed foods';
      case 4: return 'Ultra-processed food and drink products';
      default: return 'Unknown processing level';
    }
  };

  const getNovaColor = (group?: number) => {
    switch (group) {
      case 1: return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200';
      case 2: return 'bg-lime-100 dark:bg-lime-900/30 border-lime-300 dark:border-lime-700 text-lime-800 dark:text-lime-200';
      case 3: return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200';
      case 4: return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200';
      default: return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const formatLabelTag = (tag: string) => {
    return tag.replace('en:', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Leaf className="w-5 h-5 text-green-600" />
          Environmental & Sustainability
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Eco-Score */}
        {environmental?.ecoscore_grade && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-neutral-900 dark:text-white">Eco-Score</h4>
              <Badge className={`${getEcoScoreColor(environmental.ecoscore_grade)} font-bold text-lg px-3 py-1`}>
                {environmental.ecoscore_grade.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              Environmental impact score from A (best) to E (worst)
            </p>
            {environmental.ecoscore_score !== undefined && (
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                Score: {environmental.ecoscore_score}/100
              </p>
            )}
          </div>
        )}

        {/* Carbon Footprint */}
        {environmental?.carbon_footprint && (
          <div className="flex items-center justify-between py-3 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-2">
              <Recycle className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
              <span className="text-sm font-medium text-neutral-900 dark:text-white">Carbon Footprint</span>
            </div>
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              {environmental.carbon_footprint}g CO₂ per 100g
            </span>
          </div>
        )}

        {/* Packaging Materials */}
        {environmental?.packaging_materials && environmental.packaging_materials.length > 0 && (
          <div>
            <h4 className="font-semibold text-neutral-900 dark:text-white mb-2 text-sm">Packaging Materials</h4>
            <div className="flex flex-wrap gap-2">
              {environmental.packaging_materials.map((material, idx) => (
                <Badge key={idx} className="bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200">
                  {formatLabelTag(material)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* NOVA Score (Food Processing Level) */}
        {hasNovaScore && (
          <div className={`border rounded-lg p-4 ${getNovaColor(nova_group)}`}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">NOVA Group {nova_group}</h4>
              <Badge className="bg-white/50 dark:bg-black/20 text-current">
                Processing Level
              </Badge>
            </div>
            <p className="text-sm">{getNovaDescription(nova_group)}</p>
          </div>
        )}

        {/* Labels & Certifications */}
        {hasLabels && (
          <div>
            <h4 className="font-semibold text-neutral-900 dark:text-white mb-3 text-sm">Certifications & Labels</h4>
            {labels && (
              <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">{labels}</p>
            )}
            {labels_tags && labels_tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {labels_tags.map((tag, idx) => (
                  <Badge key={idx} className="bg-green-600 text-white">
                    {formatLabelTag(tag)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            * Environmental data is provided by Open Food Facts and calculated based on product composition and packaging.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
