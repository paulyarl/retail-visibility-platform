/**
 * SeedPhotoCapturePanel — upload gating rules
 *
 * Two of these are non-negotiables from the capture workflow: nothing is
 * published that the owner has not approved, and the listing is capped at
 * MAX_SEED_PHOTOS rows in total (uploading does not replace — deleting is the
 * only way to make room).
 *
 * The rules live in a pure exported function precisely so they are testable
 * here without a DOM or a canvas.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services/DirectoryPresenceAdminService', () => ({ default: {} }));

import {
  MAX_SEED_PHOTOS,
  seedPhotoUploadBlocker,
  type PendingSeedPhoto,
} from './SeedPhotoCapturePanel';

function shot(approved: boolean, id = 'p1'): PendingSeedPhoto {
  return {
    id,
    fileName: 'photo.jpg',
    dataUrl: 'data:image/jpeg;base64,AAAA',
    contentType: 'image/jpeg',
    width: 800,
    height: 600,
    caption: '',
    alt: '',
    approved,
  };
}

describe('seedPhotoUploadBlocker', () => {
  it('blocks an empty pending list', () => {
    expect(seedPhotoUploadBlocker([], 0)).toMatch(/add at least one photo/i);
  });

  it('allows an approved batch that fits', () => {
    expect(seedPhotoUploadBlocker([shot(true, 'a'), shot(true, 'b')], 3)).toBeNull();
  });

  it('allows a batch that lands exactly on the cap', () => {
    expect(seedPhotoUploadBlocker([shot(true, 'a'), shot(true, 'b')], MAX_SEED_PHOTOS - 2)).toBeNull();
  });

  it('blocks a batch that would exceed the cap, naming the counts', () => {
    const blocker = seedPhotoUploadBlocker([shot(true, 'a'), shot(true, 'b')], MAX_SEED_PHOTOS - 1);
    expect(blocker).toMatch(/already has 9 of 10 photos/);
  });

  it('blocks an unapproved single shot', () => {
    expect(seedPhotoUploadBlocker([shot(false)], 0)).toMatch(/One photo still needs/);
  });

  it('counts multiple unapproved shots', () => {
    expect(seedPhotoUploadBlocker([shot(false, 'a'), shot(true, 'b'), shot(false, 'c')], 0)).toMatch(
      /2 photos still need/
    );
  });

  it('checks the cap before approval, so an over-cap batch reports the cap', () => {
    expect(seedPhotoUploadBlocker([shot(false, 'a')], MAX_SEED_PHOTOS)).toMatch(/already has 10 of 10/);
  });
});
