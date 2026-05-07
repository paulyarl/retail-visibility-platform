'use client';

import { useState, useEffect } from 'react';
import { Check, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { tenantSlugService } from '@/services/TenantSlugService';

interface SlugPattern {
  pattern: string;
  slug: string;
  isAvailable: boolean;
  isOwnSlug: boolean;
  description: string;
}

interface SlugPatternSelectorProps {
  businessName: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  tenantId?: string;
  selectedSlug: string;
  onSlugSelect: (slug: string) => void;
  className?: string;
}

export default function SlugPatternSelector({
  businessName,
  location,
  tenantId,
  selectedSlug,
  onSlugSelect,
  className = '',
}: SlugPatternSelectorProps) {
  const [patterns, setPatterns] = useState<SlugPattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessName || businessName.trim().length < 2) {
      setPatterns([]);
      return;
    }

    const fetchPatterns = async () => {
      setLoading(true);
      setError(null);

      try {
        const patterns = await tenantSlugService.getSlugPatterns({
          businessName: businessName.trim(),
          location: location || {},
          tenantId,
        });

        setPatterns(patterns);

        // Auto-select first available pattern if none selected
        if (!selectedSlug && patterns && patterns.length > 0) {
          const firstAvailable = patterns.find((p: SlugPattern) => p.isAvailable);
          if (firstAvailable) {
            onSlugSelect(firstAvailable.slug);
          }
        } else if (selectedSlug && patterns) {
          // If current selection is no longer available (taken by another), select first available
          const currentPattern = patterns.find((p: SlugPattern) => p.slug === selectedSlug);
          if (!currentPattern?.isAvailable) {
            const firstAvailable = patterns.find((p: SlugPattern) => p.isAvailable);
            if (firstAvailable) {
              onSlugSelect(firstAvailable.slug);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching slug patterns:', err);
        setError('Failed to load slug options. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(fetchPatterns, 500);
    return () => clearTimeout(timeoutId);
  }, [businessName, location?.city, location?.state, location?.country, tenantId]);

  if (!businessName || businessName.trim().length < 2) {
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Shop URL Slug
        </label>
        <p className="text-sm text-gray-500">
          Enter a business name to see available URL options
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Shop URL Slug
        </label>
        <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="text-sm text-gray-600">Loading available URLs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Shop URL Slug
        </label>
        <Alert variant="error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (patterns.length === 0) {
    return null;
  }

  const recommendedPattern = patterns.find(p => p.isAvailable && !p.isOwnSlug);

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Choose Your Shop URL *
      </label>

      <RadioGroup value={selectedSlug} onValueChange={onSlugSelect}>
        <div className="space-y-2">
          {patterns.map((pattern, index) => {
            const isRecommended = recommendedPattern?.slug === pattern.slug;
            const isSelected = selectedSlug === pattern.slug;
            const isOwnSlug = pattern.isOwnSlug;

            return (
              <div
                key={pattern.slug}
                className={`
                  relative flex items-start p-4 rounded-lg border-2 transition-all cursor-pointer
                  ${isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : pattern.isAvailable 
                      ? 'border-gray-200 hover:border-gray-300 bg-white' 
                      : 'border-red-200 bg-red-50 opacity-70 cursor-not-allowed'
                  }
                `}
                onClick={() => pattern.isAvailable && onSlugSelect(pattern.slug)}
              >
                <div className="flex items-center h-5">
                  <RadioGroupItem
                    value={pattern.slug}
                    id={pattern.slug}
                    disabled={!pattern.isAvailable}
                    className="mt-0.5"
                  />
                </div>

                <div className="ml-3 flex-1">
                  <Label
                    htmlFor={pattern.slug}
                    className={`
                      block text-sm font-medium cursor-pointer
                      ${!pattern.isAvailable ? 'text-gray-400' : 'text-gray-900'}
                    `}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
                        {pattern.slug}
                      </code>
                      
                      {isRecommended && (
                        <Badge variant="default" className="text-xs bg-blue-600">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Recommended
                        </Badge>
                      )}
                      
                      {isOwnSlug ? (
                        <Badge variant="success" className="text-xs bg-purple-600">
                          <Check className="h-3 w-3 mr-1" />
                          Yours
                        </Badge>
                      ) : pattern.isAvailable ? (
                        <Badge variant="success" className="text-xs bg-green-600">
                          <Check className="h-3 w-3 mr-1" />
                          Available
                        </Badge>
                      ) : (
                        <Badge variant="error" className="text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Taken
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-xs text-gray-500 mt-1">
                      {pattern.description}
                    </p>
                  </Label>
                </div>
              </div>
            );
          })}
        </div>
      </RadioGroup>

      {selectedSlug && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Your shop URL:</strong>{' '}
            <code className="font-mono bg-white px-2 py-0.5 rounded">
              /shops/{selectedSlug}
            </code>
          </p>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-2">
        💡 Shorter URLs are easier to remember and share, but may already be taken.
      </p>
    </div>
  );
}
