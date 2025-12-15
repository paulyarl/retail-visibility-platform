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

const GBP_API_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const GBP_MEDIA_API = 'https://mybusiness.googleapis.com/v4';
const GBP_REVIEWS_API = 'https://mybusiness.googleapis.com/v4';
const GBP_POSTS_API = 'https://mybusiness.googleapis.com/v4';

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

async function getValidAccessToken(tenantId: string): Promise<string | null> {
  try {
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

    // Check if token is expired
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
          console.error(`[GBPAdvanced] Token refresh failed:`, refreshError);
          return null;
        }
      }
      return null;
    }

    return tenant.google_business_access_token;
  } catch (error) {
    console.error(`[GBPAdvanced] Error getting token:`, error);
    return null;
  }
}

async function getLinkedLocation(tenantId: string): Promise<{ locationId: string; accountId: string } | null> {
  try {
    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: {
        gbp_locations_list: {
          take: 1,
          orderBy: { updated_at: 'desc' }
        }
      }
    });

    if (!account?.gbp_locations_list[0]) return null;

    return {
      locationId: account.gbp_locations_list[0].location_id,
      accountId: account.google_account_id || account.id,
    };
  } catch (error) {
    console.error(`[GBPAdvanced] Error getting linked location:`, error);
    return null;
  }
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

    const response = await fetch(
      `${GBP_MEDIA_API}/accounts/${location.accountId}/locations/${location.locationId}/media`,
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

    const data = await response.json();
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
    const response = await fetch(
      `${GBP_MEDIA_API}/accounts/${location.accountId}/locations/${location.locationId}/media`,
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
      console.error(`[GBPAdvanced] Failed to upload photo:`, error);
      return { success: false, error: `API error: ${response.status}` };
    }

    const result = await response.json();
    console.log(`[GBPAdvanced] Uploaded photo for tenant ${tenantId}`);
    return { success: true, mediaItemId: result.name };
  } catch (error: any) {
    console.error(`[GBPAdvanced] Error uploading photo:`, error);
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

    const response = await fetch(
      `${GBP_MEDIA_API}/${mediaItemName}`,
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

    const location = await getLinkedLocation(tenantId);
    if (!location) {
      return { success: false, error: 'No GBP location linked' };
    }

    const postPayload: any = {
      languageCode: 'en-US',
      summary: post.summary,
      topicType: post.topicType || 'STANDARD',
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

    const response = await fetch(
      `${GBP_POSTS_API}/accounts/${location.accountId}/locations/${location.locationId}/localPosts`,
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
      console.error(`[GBPAdvanced] Failed to create post:`, error);
      return { success: false, error: `API error: ${response.status}` };
    }

    const result = await response.json();
    console.log(`[GBPAdvanced] Created post for tenant ${tenantId}`);
    
    // Store post in database
    await storePost(tenantId, result);
    
    return { success: true, postId: result.name };
  } catch (error: any) {
    console.error(`[GBPAdvanced] Error creating post:`, error);
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

    const response = await fetch(
      `${GBP_POSTS_API}/accounts/${location.accountId}/locations/${location.locationId}/localPosts`,
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

    const data = await response.json();
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

    const response = await fetch(
      `${GBP_POSTS_API}/${postName}`,
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
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
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

    let url = `${GBP_REVIEWS_API}/accounts/${location.accountId}/locations/${location.locationId}/reviews?pageSize=${pageSize}`;
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, reviews: [], error: `API error: ${response.status}` };
    }

    const data = await response.json();
    
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
    console.error(`[GBPAdvanced] Error listing reviews:`, error);
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

    const response = await fetch(
      `${GBP_REVIEWS_API}/${reviewName}/reply`,
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
      console.error(`[GBPAdvanced] Failed to reply to review:`, error);
      return { success: false, error: `API error: ${response.status}` };
    }

    console.log(`[GBPAdvanced] Replied to review for tenant ${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[GBPAdvanced] Error replying to review:`, error);
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

    const response = await fetch(
      `${GBP_REVIEWS_API}/${reviewName}/reply`,
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
 * Get available attributes for a location's category
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

    // First get the location to find its category
    const locationResponse = await fetch(
      `${GBP_API_BASE}/locations/${location.locationId}?readMask=categories`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!locationResponse.ok) {
      return { success: false, attributes: [], error: 'Failed to get location category' };
    }

    const locationData = await locationResponse.json();
    const primaryCategory = locationData.categories?.primaryCategory?.name;

    if (!primaryCategory) {
      return { success: false, attributes: [], error: 'No primary category set' };
    }

    // Get attributes for this category
    const response = await fetch(
      `${GBP_API_BASE}/attributes?parent=${primaryCategory}`,
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

    const data = await response.json();
    return { success: true, attributes: data.attributes || [] };
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

    const response = await fetch(
      `${GBP_API_BASE}/locations/${location.locationId}/attributes`,
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

    const data = await response.json();
    return { success: true, attributes: data.attributes || [] };
  } catch (error: any) {
    return { success: false, attributes: [], error: error.message };
  }
}

/**
 * Update business attributes
 */
export async function updateAttributes(
  tenantId: string,
  attributes: BusinessAttribute[]
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

    const response = await fetch(
      `${GBP_API_BASE}/locations/${location.locationId}/attributes`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attributes: attributes,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[GBPAdvanced] Failed to update attributes:`, error);
      return { success: false, error: `API error: ${response.status}` };
    }

    console.log(`[GBPAdvanced] Updated attributes for tenant ${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[GBPAdvanced] Error updating attributes:`, error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// DATABASE STORAGE HELPERS
// ============================================================================

async function storePost(tenantId: string, post: any): Promise<void> {
  try {
    const { generateQuickStart } = await import('../lib/id-generator');
    
    await prisma.gbp_posts.upsert({
      where: { id: post.name || generateQuickStart('gbpp') },
      create: {
        id: generateQuickStart('gbpp'),
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
    console.error(`[GBPAdvanced] Error storing post:`, error);
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
          star_rating: review.starRating,
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
    console.error(`[GBPAdvanced] Error storing reviews:`, error);
  }
}

// ============================================================================
// COMMON ATTRIBUTES HELPERS
// ============================================================================

/**
 * Set common boolean attributes like WiFi, wheelchair accessible, etc.
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
  }
): Promise<{ success: boolean; error?: string }> {
  const attributes: BusinessAttribute[] = [];

  if (options.hasWifi !== undefined) {
    attributes.push({
      attributeId: 'has_wifi',
      valueType: 'BOOL',
      values: [options.hasWifi],
    });
  }

  if (options.wheelchairAccessible !== undefined) {
    attributes.push({
      attributeId: 'wheelchair_accessible_entrance',
      valueType: 'BOOL',
      values: [options.wheelchairAccessible],
    });
  }

  if (options.acceptsCreditCards !== undefined) {
    attributes.push({
      attributeId: 'pay_credit_card_types_accepted',
      valueType: 'BOOL',
      values: [options.acceptsCreditCards],
    });
  }

  if (options.hasParking !== undefined) {
    attributes.push({
      attributeId: 'has_parking',
      valueType: 'BOOL',
      values: [options.hasParking],
    });
  }

  if (options.hasRestroom !== undefined) {
    attributes.push({
      attributeId: 'restroom',
      valueType: 'BOOL',
      values: [options.hasRestroom],
    });
  }

  if (options.lgbtqFriendly !== undefined) {
    attributes.push({
      attributeId: 'lgbtq_friendly',
      valueType: 'BOOL',
      values: [options.lgbtqFriendly],
    });
  }

  if (options.petFriendly !== undefined) {
    attributes.push({
      attributeId: 'dogs_allowed',
      valueType: 'BOOL',
      values: [options.petFriendly],
    });
  }

  if (attributes.length === 0) {
    return { success: true };
  }

  return updateAttributes(tenantId, attributes);
}
