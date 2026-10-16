import { describe, it, expect } from 'vitest';
import { resolveGalleryToken } from './galleryToken';

describe('resolveGalleryToken', () => {
  it('reads the token from the route segment (the canonical /preview/<token> form)', () => {
    expect(resolveGalleryToken('matXdMuXfzNuaZrKfdEjZqqDpg9JwQQ7', null)).toBe(
      'matXdMuXfzNuaZrKfdEjZqqDpg9JwQQ7',
    );
  });

  it('still accepts ?token= so legacy query links work', () => {
    expect(resolveGalleryToken(undefined, 'legacyToken')).toBe('legacyToken');
  });

  it('prefers the route segment when both are present', () => {
    expect(resolveGalleryToken('routeToken', 'queryToken')).toBe('routeToken');
  });

  it('takes the first value when the route segment repeats', () => {
    expect(resolveGalleryToken(['first', 'second'], null)).toBe('first');
  });

  it('returns an empty string when neither source carries a token', () => {
    expect(resolveGalleryToken(undefined, null)).toBe('');
    expect(resolveGalleryToken('', '   ')).toBe('');
  });
});
