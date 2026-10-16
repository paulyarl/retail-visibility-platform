/**
 * Diagnostic screenshot upload — canvas-encoded JSON payload
 *
 * Regression: the upload posted multipart FormData while every other image flow
 * on the platform (seed photos, directory photos, seed logos) posts a base64
 * dataUrl in a JSON body — the shape that lets the browser re-encode through a
 * canvas first, which is what strips EXIF and produces honest bytes for a file
 * the browser only typed by extension.
 *
 * This pins the wire shape the API's POST /:campaignId/files/upload accepts
 * (see the dataUrl branch in apps/api/src/routes/marketing-ops.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/image-upload', () => ({
  uploadImage: vi.fn().mockResolvedValue({
    dataUrl: 'data:image/png;base64,QUJD',
    contentType: 'image/png',
    width: 1200,
    height: 800,
  }),
  ImageUploadPresets: { diagnostic: { compressionLevel: 'low' } },
}));

import marketingOpsService from './MarketingOpsService';

const BASE_URL = '/api/admin/marketing-ops';

describe('MarketingOpsService.uploadDiagnosticScreenshot', () => {
  const service = marketingOpsService as any;

  beforeEach(() => {
    vi.restoreAllMocks();
    // The canvas branch is gated on a DOM; stub one so the pipeline path runs.
    vi.stubGlobal('document', {});
  });

  afterEach(() => vi.unstubAllGlobals());

  it('posts the canvas-encoded dataUrl as JSON, not multipart FormData', async () => {
    const request = vi.spyOn(service, 'makeDefaultRequest').mockResolvedValue({
      success: true,
      data: { success: true, data: { id: 'mfile-1' } },
    });

    await service.uploadDiagnosticScreenshot('mcamp-1', new File(['abc'], 'shot.png', { type: 'image/png' }));

    expect(request).toHaveBeenCalledTimes(1);
    const [url, options] = request.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/mcamp-1/files/upload`);
    expect(options.method).toBe('POST');
    expect(options.body).not.toBeInstanceOf(FormData);

    const payload = JSON.parse(options.body as string);
    expect(payload.dataUrl).toBe('data:image/png;base64,QUJD');
    expect(payload.contentType).toBe('image/png');
    expect(payload.fileName).toBe('shot.png');
  });

  it('returns the created file record from the response envelope', async () => {
    vi.spyOn(service, 'makeDefaultRequest').mockResolvedValue({
      success: true,
      data: { success: true, data: { id: 'mfile-1', file_name: 'shot.png' } },
    });

    await expect(
      service.uploadDiagnosticScreenshot('mcamp-1', new File(['abc'], 'shot.png', { type: 'image/png' })),
    ).resolves.toEqual({ id: 'mfile-1', file_name: 'shot.png' });
  });
});
