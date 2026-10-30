/**
 * Google Business Profile - Advanced Features Sync Service
 * 
 * Phase 4 Advanced Features:
 * - Photos/Logo upload and management
 * - GBP Posts (updates, offers, events)
 * - Reviews fetching and response
 * - Business Attributes sync
 * 
 * Uses My Business API v4 for media/reviews and v1 for other features
 */

import { prisma } from '../prisma';
import { findGoogleToken, resolveGoogleAccessToken } from '../lib/google/token-store';
import { resolveGbpLocation, resolveGbpTarget, resolveGbpToken } from '../lib/google/gbp-target';
import {
  gbpFetch,
  GBP_BUSINESS_INFORMATION_BASE,
  GBP_V4_BASE,
} from '../lib/google/gbp-transport';
import { logger } from '../logger';

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

export async function getValidAccessToken(tenantId: string): Promise<string | null> {
  try {
    // Resolve via the location's owning account (safe for DIY and model B —
    // the token follows gbp_locations_list.account_id, not the tenant).
    const location = await resolveGbpLocation({ tenantId });
    if (location) return resolveGbpToken(location);

    // No linked location row — tenant-scoped path (post-OAuth, pre-link).
    const tokenRecord = await findGoogleToken('gbp', { tenantId });

    if (tokenRecord) {
      const token = await resolveGoogleAccessToken('gbp', tokenRecord);
      if (!token) {
        logger.error(`[GBPAdvanced] Token refresh failed for tenant ${tenantId}`, undefined);
        return null;
      }
      return token;
    }

    // Fallback: legacy tenants table columns
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        google_business_access_token: true,
        google_business_refresh_token: true,
        google_business_token_expiry: true,
      }
    });

    if (!tenant?.google_business_access_token) {
      return null;
    }

    if (tenant.google_business_token_expiry && new Date(tenant.google_business_token_expiry) < new Date()) {
      if (tenant.google_business_refresh_token) {
        const { google } = await import('googleapis');
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_BUSINESS_CLIENT_ID,
          process.env.GOOGLE_BUSINESS_CLIENT_SECRET
        );
        oauth2Client.setCredentials({ refresh_token: tenant.google_business_refresh_token });
        
        try {
          const { credentials } = await oauth2Client.refreshAccessToken();
          
          await prisma.tenants.update({
            where: { id: tenantId },
            data: {
              google_business_access_token: credentials.access_token,
              google_business_token_expiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
            }
          });
          
          return credentials.access_token!;
        } catch (refreshError) {
          logger.error(`[GBPAdvanced] Legacy token refresh failed:`, undefined, { error: { name: (refreshError as any)?.name || 'Error', message: (refreshError as any)?.message || String(refreshError), stack: (refreshError as any)?.stack } });
          return null;
        }
      }
      return null;
    }

    return tenant.google_business_access_token;
  } catch (error) {
    logger.error(`[GBPAdvanced] Error getting token:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return null;
  }
}

export async function getLinkedLocation(tenantId: string): Promise<{ locationId: string; accountId: string } | null> {
  // Delegates to the location/token resolver (lib/google/gbp-target.ts) —
  // reads gbp_locations_list by tenant_id directly so platform-managed
  // locations resolve too (the merchant has no oauth account under model B).
  const target = await resolveGbpTarget({ tenantId });
  if (!target) return null;
  return { locationId: target.locationId, accountId: target.apiAccountId };
}

// ============================================================================
// PHOTOS & MEDIA
// ============================================================================

export interface MediaItem {
  id?: string;
  mediaFormat: 'PHOTO' | 'VIDEO';
  sourceUrl?: string;
  locationAssociation?: {
    category: 'COVER' | 'PROFILE' | 'LOGO' | 'EXTERIOR' | 'INTERIOR' | 'PRODUCT' | 'AT_WORK' | 'FOOD_AND_DRINK' | 'MENU' | 'COMMON_AREA' | 'ROOMS' | 'TEAMS' | 'ADDITIONAL';
  };
  description?: string;
}

export interface MediaUploadResult {
  success: boolean;
  mediaItemId?: string;
  error?: string;
}

/**
 * List all media items for a location
 */
export async function listMedia(tenantId: string): Promise<{
  success: boolean;
  media: MediaItem[];
  error?: string;
}> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, media: [], error: 'No valid access token' };
    }

    const location = await getLinkedLocation(tenantId);
    if (!location) {
      return { success: false, media: [], error: 'No GBP location linked' };
    }

    const response = await gbpFetch(
      `${GBP_V4_BASE}/accounts/${location.accountId}/locations/${location.locationId}/media`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, media: [], error: `API error: ${response.status}` };
    }

    const data = await response.json() as { mediaItems?: any[] };
    return { success: true, media: data.mediaItems || [] };
  } catch (error: any) {
    return { success: false, media: [], error: error.message };
  }
}

/**
 * Upload a photo to GBP
 * Note: This creates a media item reference. The actual upload requires a two-step process.
 */
export async function uploadPhoto(
  tenantId: string,
  photoUrl: string,
  category: 'COVER' | 'PROFILE' | 'LOGO' | 'EXTERIOR' | 'INTERIOR' | 'PRODUCT' | 'AT_WORK' | 'FOOD_AND_DRINK' | 'MENU' | 'COMMON_AREA' | 'ROOMS' | 'TEAMS' | 'ADDITIONAL' = 'ADDITIONAL',
  description?: string
): Promise<MediaUploadResult> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, error: 'No valid access token' };
    }

    const location = await getLinkedLocation(tenantId);
    if (!location) {
      return { success: false, error: 'No GBP location linked' };
    }

    // Create media item with source URL
    const response = await gbpFetch(
      `${GBP_V4_BASE}/accounts/${location.accountId}/locations/${location.locationId}/media`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaFormat: 'PHOTO',
          sourceUrl: photoUrl,
          locationAssociation: {
            category: category,
          },
          description: description,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error(`[GBPAdvanced] Failed to upload photo:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return { success: false, error: `API error: ${response.status}` };
    }

    const result = await response.json() as { name?: string };
    console.log(`[GBPAdvanced] Uploaded photo for tenant ${tenantId}`);
    return { success: true, mediaItemId: result.name };
  } catch (error: any) {
    logger.error(`[GBPAdvanced] Error uploading photo:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return { success: false, error: error.message };
  }
}

/**
 * Upload a photo to GBP via the two-step binary upload flow.
 *
 * Google's two-step upload:
 * 1. POST .../media:startUpload — returns an upload reference
 * 2. PUT {upload_reference} — write binary bytes to the reference
 * 3. POST .../media — create the media item from the upload reference
 *
 * Use this when the photo is not already hosted at a public URL (i.e., the
 * merchant is uploading a file directly from their device).
 */
export async function uploadPhotoBinary(
  tenantId: string,
  binary: Buffer,
  mimeType: string,
  category: 'COVER' | 'PROFILE' | 'LOGO' | 'EXTERIOR' | 'INTERIOR' | 'PRODUCT' | 'AT_WORK' | 'FOOD_AND_DRINK' | 'MENU' | 'COMMON_AREA' | 'ROOMS' | 'TEAMS' | 'ADDITIONAL' = 'ADDITIONAL',
  description?: string
): Promise<MediaUploadResult> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, error: 'No valid access token' };
    }

    const location = await getLinkedLocation(tenantId);
    if (!location) {
      return { success: false, error: 'No GBP location linked' };
    }

    const mediaBase = `${GBP_V4_BASE}/accounts/${location.accountId}/locations/${location.locationId}/media`;

    // Step 1: startUpload — get an upload reference
    const startResponse = await gbpFetch(`${mediaBase}:startUpload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      logger.error('[GBPAdvanced] startUpload failed', undefined, { status: startResponse.status, error: errorText });
      return { success: false, error: `startUpload API error: ${startResponse.status}` };
    }

    const startResult = await startResponse.json() as { uploadReference?: string };
    const uploadReference = startResult.uploadReference;
    if (!uploadReference) {
      return { success: false, error: 'No upload reference returned' };
    }

    // Step 2: PUT binary bytes to the upload reference
    const putResponse = await fetch(uploadReference, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(binary.length),
      },
      body: binary,
    });

    if (!putResponse.ok) {
      const errorText = await putResponse.text();
      logger.error('[GBPAdvanced] binary PUT failed', undefined, { status: putResponse.status, error: errorText });
      return { success: false, error: `binary PUT API error: ${putResponse.status}` };
    }

    // Step 3: create the media item from the upload reference
    const createResponse = await gbpFetch(mediaBase, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mediaFormat: 'PHOTO',
        locationAssociation: { category },
        description: description || undefined,
        dataRef: { resource_name: uploadReference },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      logger.error('[GBPAdvanced] create media failed', undefined, { status: createResponse.status, error: errorText });
      return { success: false, error: `create media API error: ${createResponse.status}` };
    }

    const createResult = await createResponse.json() as { name?: string };
    console.log(`[GBPAdvanced] Binary-uploaded photo for tenant ${tenantId}`);
    return { success: true, mediaItemId: createResult.name };
  } catch (error: any) {
    logger.error('[GBPAdvanced] Error in binary photo upload:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return { success: false, error: error.message };
  }
}

/**
 * Delete a media item
 */
export async function deleteMedia(
  tenantId: string,
  mediaItemName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, error: 'No valid access token' };
    }

    const response = await gbpFetch(
      `${GBP_V4_BASE}/${mediaItemName}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      return { success: false, error: `API error: ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// GBP POSTS (Updates, Offers, Events)
// ============================================================================

export interface GBPPost {
  summary: string;
  callToAction?: {
    actionType: 'BOOK' | 'ORDER' | 'SHOP' | 'LEARN_MORE' | 'SIGN_UP' | 'CALL';
    url?: string;
  };
  media?: {
    sourceUrl: string;
    mediaFormat: 'PHOTO' | 'VIDEO';
  }[];
  topicType?: 'STANDARD' | 'EVENT' | 'OFFER';
  event?: {
    title: string;
    schedule: {
      startDate: { year: number; month: number; day: number };
      startTime?: { hours: number; minutes: number };
      endDate: { year: number; month: number; day: number };
      endTime?: { hours: number; minutes: number };
    };
  };
  offer?: {
    couponCode?: string;
    redeemOnlineUrl?: string;
    termsConditions?: string;
  };
}

export interface PostResult {
  success: boolean;
  postId?: string;
  error?: string;
}

/**
 * Create a standard post (update)
 */
export async function createPost(
  tenantId: string,
  post: GBPPost
): Promise<PostResult> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, error: 'No valid access token' };
    }

    const target = await resolveGbpTarget({ tenantId });
    if (!target) {
      return { success: false, error: 'No GBP location linked' };
    }

    const postPayload: any = {
      languageCode: 'en-US',
      summary: post.summary,
      topicType: (post.topicType || 'STANDARD').toUpperCase(),
    };

    if (post.callToAction) {
      postPayload.callToAction = post.callToAction;
    }

    if (post.media && post.media.length > 0) {
      postPayload.media = post.media;
    }

    if (post.event) {
      postPayload.event = post.event;
    }

    if (post.offer) {
      postPayload.offer = post.offer;
    }

    const response = await gbpFetch(
      `${GBP_V4_BASE}/accounts/${target.apiAccountId}/locations/${target.locationId}/localPosts`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postPayload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error(`[GBPAdvanced] Failed to create post:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return { success: false, error: `API error: ${response.status}` };
    }

    const result = await response.json() as { name?: string };
    console.log(`[GBPAdvanced] Created post for tenant ${tenantId}`);
    
    // Store post in database — location row id lets portfolio queries and
    // the DFY publisher target the row's location (Sprint D1/D2).
    await storePost(tenantId, result, target.location.id);
    
    return { success: true, postId: result.name };
  } catch (error: any) {
    logger.error(`[GBPAdvanced] Error creating post:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return { success: false, error: error.message };
  }
}

/**
 * List all posts for a location
 */
export async function listPosts(tenantId: string): Promise<{
  success: boolean;
  posts: any[];
  error?: string;
}> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, posts: [], error: 'No valid access token' };
    }

    const location = await getLinkedLocation(tenantId);
    if (!location) {
      return { success: false, posts: [], error: 'No GBP location linked' };
    }

    const response = await gbpFetch(
      `${GBP_V4_BASE}/accounts/${location.accountId}/locations/${location.locationId}/localPosts`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return { success: false, posts: [], error: `API error: ${response.status}` };
    }

    const data = await response.json() as { localPosts?: any[] };
    return { success: true, posts: data.localPosts || [] };
  } catch (error: any) {
    return { success: false, posts: [], error: error.message };
  }
}

/**
 * Delete a post
 */
export async function deletePost(
  tenantId: string,
  postName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, error: 'No valid access token' };
    }

    const response = await gbpFetch(
      `${GBP_V4_BASE}/${postName}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      return { success: false, error: `API error: ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// REVIEWS MANAGEMENT
// ============================================================================

export interface Review {
  name: string;
  reviewId: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
  };
  // Google API returns enum strings ('ONE'..'FIVE'); we map to integers (1-5)
  // at the storage boundary (migration 238 changed gbp_reviews.star_rating to INTEGER).
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

/**
 * Maps Google's enum starRating ('ONE'..'FIVE') to integer (1-5).
 * Used at the storage boundary so gbp_reviews.star_rating stores Int, not enum string.
 * Migration 238 changed the column from VarChar(10) to INTEGER.
 */
function mapStarRatingToInt(starRating: Review['starRating'] | null | undefined): number | null {
  if (!starRating) return null;
  const map: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return map[starRating] ?? null;
}

export interface ReviewsResult {
  success: boolean;
  reviews: Review[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
  error?: string;
}

/**
 * List reviews for a location
 */
export async function listReviews(
  tenantId: string,
  pageSize: number = 50,
  pageToken?: string
): Promise<ReviewsResult> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, reviews: [], error: 'No valid access token' };
    }

    const location = await getLinkedLocation(tenantId);
    if (!location) {
      return { success: false, reviews: [], error: 'No GBP location linked' };
    }

    let url = `${GBP_V4_BASE}/accounts/${location.accountId}/locations/${location.locationId}/reviews?pageSize=${pageSize}`;
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    const response = await gbpFetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, reviews: [], error: `API error: ${response.status}` };
    }

    const data = await response.json() as {
      reviews?: Review[];
      averageRating?: number;
      totalReviewCount?: number;
      nextPageToken?: string;
    };
    
    // Store reviews in database
    if (data.reviews) {
      await storeReviews(tenantId, data.reviews);
    }

    return {
      success: true,
      reviews: data.reviews || [],
      averageRating: data.averageRating,
      totalReviewCount: data.totalReviewCount,
      nextPageToken: data.nextPageToken,
    };
  } catch (error: any) {
    logger.error(`[GBPAdvanced] Error listing reviews:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return { success: false, reviews: [], error: error.message };
  }
}

/**
 * Reply to a review
 */
export async function replyToReview(
  tenantId: string,
  reviewName: string,
  replyComment: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, error: 'No valid access token' };
    }

    const response = await gbpFetch(
      `${GBP_V4_BASE}/${reviewName}/reply`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: replyComment,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error(`[GBPAdvanced] Failed to reply to review:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return { success: false, error: `API error: ${response.status}` };
    }

    console.log(`[GBPAdvanced] Replied to review for tenant ${tenantId}`);
    return { success: true };
  } catch (error: any) {
    logger.error(`[GBPAdvanced] Error replying to review:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return { success: false, error: error.message };
  }
}

/**
 * Delete a review reply
 */
export async function deleteReviewReply(
  tenantId: string,
  reviewName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, error: 'No valid access token' };
    }

    const response = await gbpFetch(
      `${GBP_V4_BASE}/${reviewName}/reply`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      return { success: false, error: `API error: ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// BUSINESS ATTRIBUTES
// ============================================================================

export interface BusinessAttribute {
  attributeId: string;
  valueType: 'BOOL' | 'ENUM' | 'URL' | 'REPEATED_ENUM';
  values?: any[];
  repeatedEnumValue?: { setValues: string[]; unsetValues: string[] };
  urlValues?: { url: string }[];
}

/**
 * Get attributes available for a location (category- and country-driven).
 *
 * Uses `parent=locations/{id}` so Google resolves the location's primary
 * category + region itself and returns the attribute metadata (displayName,
 * valueType, valueMetadata, groupDisplayName) the UI renders.
 */
export async function getAvailableAttributes(tenantId: string): Promise<{
  success: boolean;
  attributes: any[];
  error?: string;
}> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, attributes: [], error: 'No valid access token' };
    }

    const location = await getLinkedLocation(tenantId);
    if (!location) {
      return { success: false, attributes: [], error: 'No GBP location linked' };
    }

    const response = await gbpFetch(
      `${GBP_BUSINESS_INFORMATION_BASE}/attributes?parent=locations/${location.locationId}&regionCode=US&languageCode=en&pageSize=200`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('[GBPAdvanced] Failed to list available attributes:', undefined, { status: response.status, error });
      return { success: false, attributes: [], error: `API error: ${response.status}` };
    }

    const data = await response.json() as { attributeMetadata?: any[] };
    return { success: true, attributes: data.attributeMetadata || [] };
  } catch (error: any) {
    return { success: false, attributes: [], error: error.message };
  }
}

/**
 * Get current attributes for a location
 */
export async function getLocationAttributes(tenantId: string): Promise<{
  success: boolean;
  attributes: BusinessAttribute[];
  error?: string;
}> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, attributes: [], error: 'No valid access token' };
    }

    const location = await getLinkedLocation(tenantId);
    if (!location) {
      return { success: false, attributes: [], error: 'No GBP location linked' };
    }

    const response = await gbpFetch(
      `${GBP_BUSINESS_INFORMATION_BASE}/locations/${location.locationId}/attributes`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return { success: false, attributes: [], error: `API error: ${response.status}` };
    }

    const data = await response.json() as { attributes?: BusinessAttribute[] };
    return { success: true, attributes: data.attributes || [] };
  } catch (error: any) {
    return { success: false, attributes: [], error: error.message };
  }
}

/**
 * Update business attributes.
 *
 * Google's `locations.updateAttributes` requires an `attributeMask` naming the
 * attributes being written (comma-separated `attributes/{id}`). When the caller
 * doesn't supply one it is derived from the attribute ids in the payload.
 */
export async function updateAttributes(
  tenantId: string,
  attributes: BusinessAttribute[],
  attributeMask?: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, error: 'No valid access token' };
    }

    const location = await getLinkedLocation(tenantId);
    if (!location) {
      return { success: false, error: 'No GBP location linked' };
    }

    const mask = (attributeMask && attributeMask.length > 0
      ? attributeMask
      : attributes.map((a) => a.attributeId)
    )
      .map((id) => (id.startsWith('attributes/') ? id : `attributes/${id}`))
      .join(',');

    const response = await gbpFetch(
      `${GBP_BUSINESS_INFORMATION_BASE}/locations/${location.locationId}/attributes?attributeMask=${encodeURIComponent(mask)}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `locations/${location.locationId}/attributes`,
          attributes: attributes,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error(`[GBPAdvanced] Failed to update attributes:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return { success: false, error: `API error: ${response.status}` };
    }

    console.log(`[GBPAdvanced] Updated attributes for tenant ${tenantId}`);
    return { success: true };
  } catch (error: any) {
    logger.error(`[GBPAdvanced] Error updating attributes:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return { success: false, error: error.message };
  }
}

// ============================================================================
// DATABASE STORAGE HELPERS
// ============================================================================

async function storePost(tenantId: string, post: any, gbpLocationId?: string): Promise<void> {
  try {
    const { generateQuickStart } = await import('../lib/id-generator');

    // Deduplicate on google_post_id — the old upsert looked up `id = post.name`
    // (a >50-char resource path that never matches), so every call inserted a
    // second row for the same Google post.
    const existing = post.name
      ? await prisma.gbp_posts.findFirst({ where: { google_post_id: post.name }, select: { id: true } })
      : null;

    await prisma.gbp_posts.upsert({
      where: { id: existing?.id || generateQuickStart('gbpp') },
      create: {
        id: generateQuickStart('gbpp'),
        location_id: gbpLocationId ?? null,
        tenant_id: tenantId,
        google_post_id: post.name,
        summary: post.summary || '',
        topic_type: (post.topicType || 'STANDARD').toLowerCase(),
        call_to_action_type: post.callToAction?.actionType,
        call_to_action_url: post.callToAction?.url,
        media_url: post.media?.[0]?.sourceUrl,
        event_title: post.event?.title,
        event_start_date: post.event?.schedule?.startDate ? new Date(
          post.event.schedule.startDate.year,
          post.event.schedule.startDate.month - 1,
          post.event.schedule.startDate.day
        ) : null,
        event_end_date: post.event?.schedule?.endDate ? new Date(
          post.event.schedule.endDate.year,
          post.event.schedule.endDate.month - 1,
          post.event.schedule.endDate.day
        ) : null,
        offer_coupon_code: post.offer?.couponCode,
        offer_redeem_url: post.offer?.redeemOnlineUrl,
        offer_terms: post.offer?.termsConditions,
        state: (post.state || 'LIVE').toLowerCase(),
        google_create_time: post.createTime ? new Date(post.createTime) : null,
        google_update_time: post.updateTime ? new Date(post.updateTime) : null,
      },
      update: {
        summary: post.summary || '',
        state: (post.state || 'LIVE').toLowerCase(),
        google_update_time: post.updateTime ? new Date(post.updateTime) : null,
        updated_at: new Date(),
      },
    });
    
    console.log(`[GBPAdvanced] Stored post for tenant ${tenantId}:`, post.name);
  } catch (error) {
    logger.error(`[GBPAdvanced] Error storing post:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  }
}

async function storeReviews(tenantId: string, reviews: Review[]): Promise<void> {
  try {
    const { generateQuickStart } = await import('../lib/id-generator');
    
    for (const review of reviews) {
      await prisma.gbp_reviews.upsert({
        where: { google_review_id: review.name },
        create: {
          id: generateQuickStart('gbpr'),
          tenant_id: tenantId,
          google_review_id: review.name,
          reviewer_name: review.reviewer?.displayName,
          reviewer_photo_url: review.reviewer?.profilePhotoUrl,
          star_rating: mapStarRatingToInt(review.starRating),
          comment: review.comment,
          review_reply: review.reviewReply?.comment,
          reply_update_time: review.reviewReply?.updateTime ? new Date(review.reviewReply.updateTime) : null,
          is_replied: !!review.reviewReply,
          google_create_time: review.createTime ? new Date(review.createTime) : null,
          google_update_time: review.updateTime ? new Date(review.updateTime) : null,
        },
        update: {
          reviewer_name: review.reviewer?.displayName,
          reviewer_photo_url: review.reviewer?.profilePhotoUrl,
          comment: review.comment,
          review_reply: review.reviewReply?.comment,
          reply_update_time: review.reviewReply?.updateTime ? new Date(review.reviewReply.updateTime) : null,
          is_replied: !!review.reviewReply,
          google_update_time: review.updateTime ? new Date(review.updateTime) : null,
          updated_at: new Date(),
        },
      });
    }
    
    console.log(`[GBPAdvanced] Stored ${reviews.length} reviews for tenant ${tenantId}`);
  } catch (error) {
    logger.error(`[GBPAdvanced] Error storing reviews:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  }
}

// ============================================================================
// COMMON ATTRIBUTES HELPERS
// ============================================================================

/**
 * Set common boolean attributes like WiFi, wheelchair accessible, etc.
 *
 * `offers*` options are the storefront-retail fulfillment set
 * (delivery / curbside / in-store pickup / takeout / in-store shopping) —
 * Google's Service options group. Attribute ids verified against
 * attributes.list metadata (BOOL).
 */
export async function setCommonAttributes(
  tenantId: string,
  options: {
    hasWifi?: boolean;
    wheelchairAccessible?: boolean;
    acceptsCreditCards?: boolean;
    hasParking?: boolean;
    hasRestroom?: boolean;
    lgbtqFriendly?: boolean;
    petFriendly?: boolean;
    // Storefront-retail fulfillment options (Service options)
    offersDelivery?: boolean;
    offersCurbsidePickup?: boolean;
    offersInStorePickup?: boolean;
    offersTakeout?: boolean;
    offersInStoreShopping?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const attributes: BusinessAttribute[] = [];

  const pushBool = (id: string, value: boolean | undefined) => {
    if (value !== undefined) {
      attributes.push({ attributeId: id, valueType: 'BOOL', values: [value] });
    }
  };

  pushBool('has_wifi', options.hasWifi);
  pushBool('has_wheelchair_accessible_entrance', options.wheelchairAccessible);
  pushBool('has_parking', options.hasParking);
  pushBool('restroom', options.hasRestroom);
  pushBool('lgbtq_friendly', options.lgbtqFriendly);
  pushBool('dogs_allowed', options.petFriendly);
  pushBool('has_delivery', options.offersDelivery);
  pushBool('has_curbside_pickup', options.offersCurbsidePickup);
  pushBool('has_in_store_pickup', options.offersInStorePickup);
  pushBool('has_takeout', options.offersTakeout);
  pushBool('has_in_store_shopping', options.offersInStoreShopping);

  if (options.acceptsCreditCards !== undefined) {
    // pay_credit_card_types_accepted is REPEATED_ENUM — set/unset the common
    // card values rather than writing a boolean.
    const cardValues = ['visa', 'mastercard', 'amex', 'discover'];
    attributes.push({
      attributeId: 'pay_credit_card_types_accepted',
      valueType: 'REPEATED_ENUM',
      repeatedEnumValue: options.acceptsCreditCards
        ? { setValues: cardValues, unsetValues: [] }
        : { setValues: [], unsetValues: cardValues },
    });
  }

  if (attributes.length === 0) {
    return { success: true };
  }

  return updateAttributes(tenantId, attributes);
}
