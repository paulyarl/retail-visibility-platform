'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@mantine/core';
import { validateContentConsistency, CONTENT_MAPPINGS } from '@/lib/tiers/content-consistency';

interface ContentConsistencyValidatorProps {
  showOnlyInconsistent?: boolean;
}

export function ContentConsistencyValidator({ showOnlyInconsistent = false }: ContentConsistencyValidatorProps) {
  const [validation, setValidation] = useState<{
    consistent: string[];
    inconsistent: { marketing: string; admin: string | null }[];
    missing: string[];
  } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Simulate validation - in real app, this would fetch from both pages
    const marketingFeatures = CONTENT_MAPPINGS.map(m => m.marketingTerm);
    const adminFeatures = CONTENT_MAPPINGS.map(m => m.adminTerm);
    
    const result = validateContentConsistency(marketingFeatures, adminFeatures);
    setValidation(result);
  }, []);

  if (!validation) {
    return (
      <Card className="p-6">
        <div className="text-center text-neutral-600">Loading content consistency validation...</div>
      </Card>
    );
  }

  const hasIssues = validation.inconsistent.length > 0 || validation.missing.length > 0;
  const consistencyScore = Math.round((validation.consistent.length / CONTENT_MAPPINGS.length) * 100);

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Content Consistency Check</h3>
            <p className="text-sm text-neutral-600">Alignment between /features and /settings/offerings</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge 
              variant={hasIssues ? "warning" : "success"} 
              className={`${hasIssues ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}
            >
              {consistencyScore}% Consistent
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Hide Details' : 'Show Details'}
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{validation.consistent.length}</div>
            <div className="text-sm text-green-700">Consistent</div>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-lg">
            <div className="text-2xl font-bold text-amber-600">{validation.inconsistent.length}</div>
            <div className="text-sm text-amber-700">Inconsistent</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{validation.missing.length}</div>
            <div className="text-sm text-red-700">Missing</div>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="space-y-4">
            {/* Consistent Items */}
            {validation.consistent.length > 0 && (
              <div>
                <h4 className="font-semibold text-green-700 mb-2">✅ Consistent Terms</h4>
                <div className="space-y-1">
                  {validation.consistent.map(item => (
                    <div key={item} className="flex items-center gap-2 text-sm">
                      <span className="text-green-500">✓</span>
                      <span className="text-neutral-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inconsistent Items */}
            {validation.inconsistent.length > 0 && (
              <div>
                <h4 className="font-semibold text-amber-700 mb-2">⚠️ Inconsistent Terms</h4>
                <div className="space-y-2">
                  {validation.inconsistent.map(({ marketing, admin }, index) => (
                    <div key={index} className="p-3 bg-amber-50 rounded-lg border-l-4 border-amber-300">
                      <div className="text-sm font-medium text-amber-900">Marketing: {marketing}</div>
                      <div className="text-sm text-amber-700">
                        Admin: {admin || 'Not found'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Items */}
            {validation.missing.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-700 mb-2">❌ Missing Terms</h4>
                <div className="space-y-1">
                  {validation.missing.map(item => (
                    <div key={item} className="flex items-center gap-2 text-sm">
                      <span className="text-red-500">✗</span>
                      <span className="text-neutral-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-700 mb-2">💡 Recommendations</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Standardize feature names across both pages</li>
                <li>• Use the content-consistency.ts dictionary for reference</li>
                <li>• Run this validator after making content changes</li>
                <li>• Update both pages simultaneously when adding features</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
