import { describe, it, expect } from 'vitest';
import {
  resolveSlugAutoSelect,
  type SlugPattern,
  type SlugPatternSelectorProps,
} from './SlugPatternSelector';

const pattern = (slug: string, isAvailable: boolean, isOwnSlug = false): SlugPattern => ({
  pattern: 'business_name',
  slug,
  isAvailable,
  isOwnSlug,
  description: slug,
});

const PATTERNS = [
  pattern('dreamcast-african-market', true),
  pattern('dreamcast-african-market-pa', false, true),
  pattern('dreamcast-african-market-pittsburgh', false),
];

describe('resolveSlugAutoSelect', () => {
  it('selects the first available pattern when nothing is selected', () => {
    expect(resolveSlugAutoSelect(PATTERNS, '')).toBe('dreamcast-african-market');
  });

  it('returns null when there are no patterns', () => {
    expect(resolveSlugAutoSelect([], '')).toBeNull();
  });

  it('returns null when nothing is available and nothing is selected', () => {
    expect(resolveSlugAutoSelect([pattern('taken-a', false), pattern('taken-b', false)], '')).toBeNull();
  });

  it('rescues a selection the platform marked unavailable', () => {
    expect(resolveSlugAutoSelect(PATTERNS, 'dreamcast-african-market-pittsburgh'))
      .toBe('dreamcast-african-market');
  });

  it('leaves an available selection alone', () => {
    expect(resolveSlugAutoSelect(PATTERNS, 'dreamcast-african-market')).toBeNull();
  });

  it('leaves a selection that is not among the generated patterns alone', () => {
    // The seed-drawer case: the listing's current suffixed slug is a valid
    // selection the picker never generated — it must not be clobbered.
    expect(resolveSlugAutoSelect(PATTERNS, 'dreamcast-african-market-2')).toBeNull();
  });
});

describe('SlugPatternSelectorProps', () => {
  it('accepts the place namespace for /place/{slug} pickers', () => {
    const props: SlugPatternSelectorProps = {
      businessName: 'Dreamcast African Market',
      tenantId: 'tid-x',
      namespace: 'place',
      selectedSlug: 'dreamcast-african-market-2',
      onSlugSelect: () => {},
      urlTemplate: (slug) => `/place/${slug}`,
    };
    expect(props.urlTemplate?.('dreamcast-african-market-2')).toBe('/place/dreamcast-african-market-2');
  });
});
