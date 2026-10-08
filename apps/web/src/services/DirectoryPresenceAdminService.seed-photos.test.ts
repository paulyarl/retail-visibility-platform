/**
 * DirectoryPresenceAdminService — seed photo writes must bust the public cache
 *
 * Regression: uploading and deleting a seed photo worked server-side (the
 * DELETE returned 204 and the row was gone) but the public place listing kept
 * rendering the deleted photo. The photos GET is cached in the persistent
 * DIRECTORY-context cache (`directory-photos-*`, ~10 minutes, localStorage-
 * backed), and neither write path cleared it.
 *
 * These tests pin the omission — the failure was that nothing called the
 * invalidator at all. They cannot catch a wrong *namespace*, which is a
 * property of the base class's scoping rule; see the comment on
 * DirectoryListingSingletonService.invalidateDirectoryPhotosCache.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInvalidatePhotos } = vi.hoisted(() => ({
  mockInvalidatePhotos: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/DirectoryListingSingletonService', () => ({
  directoryListingService: { invalidateDirectoryPhotosCache: mockInvalidatePhotos },
}));

vi.mock('@/lib/client-logger', () => ({
  clientLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import directoryPresenceAdminService from '@/services/DirectoryPresenceAdminService';

const LISTING = 'dll-329R-60ov7dj6';

function stubRequest(result: unknown) {
  return vi
    .spyOn(directoryPresenceAdminService as any, 'makeDefaultRequest')
    .mockResolvedValue(result as any);
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockInvalidatePhotos.mockClear();
});

describe('uploadSeedListingPhoto', () => {
  it('clears the public photo cache after a successful upload', async () => {
    stubRequest({ success: true, data: { id: 'photo-1' } });

    await directoryPresenceAdminService.uploadSeedListingPhoto(LISTING, { dataUrl: 'data:image/jpeg;base64,AA' });

    expect(mockInvalidatePhotos).toHaveBeenCalledTimes(1);
  });

  it('does not clear the cache when the upload fails', async () => {
    stubRequest({ success: false, error: 'upload failed' });

    await expect(
      directoryPresenceAdminService.uploadSeedListingPhoto(LISTING, { dataUrl: 'data:image/jpeg;base64,AA' })
    ).rejects.toThrow();

    expect(mockInvalidatePhotos).not.toHaveBeenCalled();
  });
});

describe('deleteSeedListingPhoto', () => {
  it('clears the public photo cache after a delete', async () => {
    stubRequest({ success: true });

    await directoryPresenceAdminService.deleteSeedListingPhoto(LISTING, 'photo-1');

    expect(mockInvalidatePhotos).toHaveBeenCalledTimes(1);
  });
});
