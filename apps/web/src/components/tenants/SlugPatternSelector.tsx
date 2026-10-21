'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { tenantSlugService } from '@/services/TenantSlugService';
import { clientLogger } from '@/lib/client-logger';

export interface SlugPattern {
  pattern: string;
  slug: string;
  isAvailable: boolean;
  isOwnSlug: boolean;
  description: string;
  unavailableReason?: string;
}

export interface SlugPatternSelectorProps {
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
  /**
   * 'subdomain' runs candidates through the platform subdomain ruleset
   * (format, reserved names, cross-namespace uniqueness) — use it for pickers
   * that feed PUT /api/tenants/:id/subdomain. 'place' runs the /place/{slug}
   * ruleset (reserved static routes + directory_listings_list uniqueness,
   * ownership by listing tenant) — use it for directory-presence seed
   * listings. Default 'directory'.
   */
  namespace?: 'directory' | 'subdomain' | 'place';
  /** Heading copy. Defaults to the shop-URL wording. */
  label?: string;
  /** Preview line label. Defaults to "Your shop URL:". */
  urlLabel?: string;
  /** Renders the selected slug as a URL. Defaults to `/shops/{slug}`. */
  urlTemplate?: (slug: string) => string;
  /**
   * Bump to force a pattern refetch — availability/ownership is stale after
   * the tenant writes a slug (e.g. PUT /tenants/:id/subdomain renames it).
   */
  refreshKey?: string | number;
}

/**
 * Decide whether the picker should auto-(re)select after patterns load.
 * - No selection → the first available pattern.
 * - Selection matches a pattern the platform marked unavailable → the first
 *   available replacement.
 * - Selection is NOT among the generated patterns (a seed's current suffixed
 *   slug like "name-2", or a previously typed custom slug) → null. Never
 *   silently rewrite a slug the picker didn't evaluate.
 */
export function resolveSlugAutoSelect(
  patterns: SlugPattern[],
  selectedSlug: string
): string | null {
  if (!patterns || patterns.length === 0) return null;
  if (selectedSlug) {
    const current = patterns.find((p) => p.slug === selectedSlug);
    if (!current || current.isAvailable) return null;
  }
  return patterns.find((p) => p.isAvailable)?.slug ?? null;
}

export default function SlugPatternSelector({
  businessName,
  location,
  tenantId,
  selectedSlug,
  onSlugSelect,
  className = '',
  namespace = 'directory',
  label = 'Choose Your Shop URL *',
  urlLabel = 'Your shop URL:',
  urlTemplate = (slug) => `/shops/${slug}`,
  refreshKey,
}: SlugPatternSelectorProps) {
  const [patterns, setPatterns] = useState<SlugPattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Free-text entry — a tenant may type their own slug; it gets the same
  // availability ruleset as the generated patterns before it can be selected.
  const [customInput, setCustomInput] = useState('');
  const [customStatus, setCustomStatus] = useState<{
    state: 'idle' | 'checking' | 'available' | 'unavailable';
    reason?: string;
    own?: boolean;
  }>({ state: 'idle' });
  // The debounced fetch resolves after more keystrokes; always call the latest props
  const onSlugSelectRef = useRef(onSlugSelect);
  const selectedSlugRef = useRef(selectedSlug);
  useEffect(() => {
    onSlugSelectRef.current = onSlugSelect;
    selectedSlugRef.current = selectedSlug;
  });

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
          namespace,
        });

        setPatterns(patterns);

        const autoSelect = resolveSlugAutoSelect(patterns, selectedSlugRef.current);
        if (autoSelect) {
          onSlugSelectRef.current(autoSelect);
        }
      } catch (err) {
        clientLogger.error('Error fetching slug patterns:', { detail: err });
        setError('Failed to load slug options. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(fetchPatterns, 500);
    return () => clearTimeout(timeoutId);
  }, [businessName, location?.city, location?.state, location?.country, tenantId, namespace, refreshKey]);

  const customSlug = customInput
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Debounced availability check for the free-text entry. An available typed
  // slug auto-selects so the tenant can just type and hit save.
  useEffect(() => {
    if (!customSlug) {
      setCustomStatus({ state: 'idle' });
      return;
    }
    setCustomStatus({ state: 'checking' });
    const timeoutId = setTimeout(async () => {
      try {
        const result = await tenantSlugService.checkSlugAvailability(customSlug, tenantId, namespace);
        setCustomStatus(
          result.available
            ? { state: 'available', own: result.ownedByCurrentUser }
            : { state: 'unavailable', reason: result.code }
        );
        if (result.available) onSlugSelectRef.current(customSlug);
      } catch (err) {
        clientLogger.error('Error checking slug availability:', { detail: err });
        setCustomStatus({ state: 'idle' });
      }
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [customSlug, tenantId, namespace]);

  if (!businessName || businessName.trim().length < 2) {
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
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
          {label}
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
          {label}
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
        {label}
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
                      : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
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
                          {pattern.unavailableReason === 'invalid_subdomain'
                            ? 'Too long'
                            : pattern.unavailableReason === 'reserved_subdomain' ||
                                pattern.unavailableReason === 'reserved_place_slug'
                              ? 'Reserved'
                              : 'Taken'}
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

          {/* Free-text entry — same availability ruleset as the suggestions */}
          <div
            className={`
              relative flex items-start p-4 rounded-lg border-2 transition-all
              ${customSlug && selectedSlug === customSlug
                ? 'border-blue-500 bg-blue-50'
                : 'border-dashed border-gray-300 bg-white'
              }
            `}
          >
            <div className="flex items-center h-5">
              <RadioGroupItem
                value={customSlug || '__custom__'}
                id="slug-custom"
                disabled={!customSlug || customStatus.state !== 'available'}
                className="mt-0.5"
              />
            </div>
            <div className="ml-3 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
                  {customSlug || 'custom-slug'}
                </code>
                {customStatus.state === 'checking' && (
                  <Badge variant="secondary" className="text-xs">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Checking
                  </Badge>
                )}
                {customStatus.state === 'available' && (
                  customStatus.own ? (
                    <Badge variant="success" className="text-xs bg-purple-600">
                      <Check className="h-3 w-3 mr-1" />
                      Yours
                    </Badge>
                  ) : (
                    <Badge variant="success" className="text-xs bg-green-600">
                      <Check className="h-3 w-3 mr-1" />
                      Available
                    </Badge>
                  )
                )}
                {customStatus.state === 'unavailable' && (
                  <Badge variant="error" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {customStatus.reason === 'invalid_subdomain'
                      ? 'Invalid'
                      : customStatus.reason === 'reserved_subdomain' ||
                          customStatus.reason === 'reserved_place_slug'
                        ? 'Reserved'
                        : 'Taken'}
                  </Badge>
                )}
              </div>
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onFocus={() => {
                  if (customSlug && customStatus.state === 'available') onSlugSelect(customSlug);
                }}
                placeholder="Or type your own…"
                className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lowercase letters, numbers, and hyphens{namespace === 'subdomain' ? ', up to 30 characters' : ''} — checked for availability as you type.
              </p>
            </div>
          </div>
        </div>
      </RadioGroup>

      {selectedSlug && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>{urlLabel}</strong>{' '}
            <code className="font-mono bg-white px-2 py-0.5 rounded">
              {urlTemplate(selectedSlug)}
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
