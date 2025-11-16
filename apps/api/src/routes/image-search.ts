import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import fetch from 'node-fetch';

const router = Router();

// Unsplash API configuration
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || '';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

interface ImageResult {
  id: string;
  url: string;
  thumbnail: string;
  description: string;
  photographer: string;
  photographerUrl: string;
  source: 'unsplash' | 'pexels';
  downloadUrl: string;
}

/**
 * GET /api/v1/images/search
 * Search for product images from Unsplash and Pexels
 */
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Missing query parameter',
      });
    }

    const images: ImageResult[] = [];

    // Search Unsplash (if API key available)
    if (UNSPLASH_ACCESS_KEY) {
      try {
        const unsplashResponse = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&orientation=squarish`,
          {
            headers: {
              'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
            },
          }
        );

        if (unsplashResponse.ok) {
          const unsplashData: any = await unsplashResponse.json();
          
          for (const photo of unsplashData.results || []) {
            images.push({
              id: `unsplash-${photo.id}`,
              url: photo.urls.regular,
              thumbnail: photo.urls.small,
              description: photo.description || photo.alt_description || query,
              photographer: photo.user.name,
              photographerUrl: photo.user.links.html,
              source: 'unsplash',
              downloadUrl: photo.urls.regular,
            });
          }
        }
      } catch (error) {
        console.error('[Image Search] Unsplash error:', error);
      }
    }

    // Search Pexels (if API key available and need more results)
    if (PEXELS_API_KEY && images.length < 12) {
      try {
        const pexelsResponse = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${12 - images.length}&orientation=square`,
          {
            headers: {
              'Authorization': PEXELS_API_KEY,
            },
          }
        );

        if (pexelsResponse.ok) {
          const pexelsData: any = await pexelsResponse.json();
          
          for (const photo of pexelsData.photos || []) {
            images.push({
              id: `pexels-${photo.id}`,
              url: photo.src.large,
              thumbnail: photo.src.medium,
              description: photo.alt || query,
              photographer: photo.photographer,
              photographerUrl: photo.photographer_url,
              source: 'pexels',
              downloadUrl: photo.src.large,
            });
          }
        }
      } catch (error) {
        console.error('[Image Search] Pexels error:', error);
      }
    }

    res.json({
      success: true,
      query,
      count: images.length,
      images,
    });
  } catch (error: any) {
    console.error('[Image Search] Error:', error);
    res.status(500).json({
      error: 'Failed to search for images',
      message: error.message,
    });
  }
});

export default router;
