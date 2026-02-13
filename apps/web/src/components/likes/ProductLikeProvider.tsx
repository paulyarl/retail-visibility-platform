"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { productLikesService } from '@/services/ProductLikesSingletonService';

// Simple decryption for client-side caching (matches AuthContext)
function decrypt(text: string): string {
  try {
    return decodeURIComponent(atob(text));
  } catch {
    return text;
  }
}

interface LikeContextType {
  userId: string | null;
  sessionId: string | null;
  likeProduct: (productId: string) => Promise<{ success: boolean; likes: number; userLiked: boolean }>;
  unlikeProduct: (productId: string) => Promise<{ success: boolean; likes: number; userLiked: boolean }>;
  getLikeStatus: (productId: string) => Promise<{ likes: number; userLiked: boolean } | null>;
}

const LikeContext = createContext<LikeContextType | null>(null);

export function ProductLikeProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Extract user/session info from localStorage
    try {
      const authUser = localStorage.getItem('auth_user_cache');
      if (authUser) {
        const decrypted = decrypt(authUser);
        const parsed = JSON.parse(decrypted);
        if (parsed?.user?.id) {
          setUserId(parsed.user.id);
        }
      }

      // For anonymous users, use session ID from localStorage
      const lastViewedSession = localStorage.getItem('lastViewedSessionId');
      if (lastViewedSession && !userId) {
        setSessionId(lastViewedSession);
      }
    } catch (error) {
      console.error('[ProductLikeProvider] Error getting user data:', error);
    }
  }, []);

  const likeProduct = async (productId: string) => {
    console.log('[ProductLikeProvider] Liking product:', productId);
    try {
      const result = await productLikesService.likeProduct(productId, userId || undefined, sessionId || undefined);
      
      if (!result) {
        throw new Error('Failed to like product');
      }

      const data = await productLikesService.getProductLikeStatus(productId, userId || undefined, sessionId || undefined);
      
      return { success: true, likes: data.likesCount, userLiked: data.userLiked };
    } catch (error) {
      console.error('[ProductLikeProvider] Error liking product:', error);
      return { success: false, likes: 0, userLiked: false };
    }
  };

  const unlikeProduct = async (productId: string) => {
    try {
      const success = await productLikesService.unlikeProduct(productId, userId || undefined, sessionId || undefined);
      
      if (!success) {
        throw new Error('Failed to unlike product');
      }

      const data = await productLikesService.getProductLikeStatus(productId, userId || undefined, sessionId || undefined);
      
      return {
        success: true,
        likes: data.likesCount,
        userLiked: data.userLiked
      };
    } catch (error) {
      console.error('[ProductLikeProvider] Error unliking product:', error);
      return { success: false, likes: 0, userLiked: false };
    }
  };

  const getLikeStatus = async (productId: string) => {
    try {
      const data = await productLikesService.getProductLikeStatus(productId, userId || undefined, sessionId || undefined);
      
      return {
        likes: data.likesCount,
        userLiked: data.userLiked
      };
    } catch (error) {
      console.error('[ProductLikeProvider] Error getting like status:', error);
      return null;
    }
  };

  const value: LikeContextType = {
    userId,
    sessionId,
    likeProduct,
    unlikeProduct,
    getLikeStatus
  };

  return (
    <LikeContext.Provider value={value}>
      {children}
    </LikeContext.Provider>
  );
}

export function useProductLikes() {
  const context = useContext(LikeContext);
  if (!context) {
    throw new Error('useProductLikes must be used within a ProductLikeProvider');
  }
  return context;
}
