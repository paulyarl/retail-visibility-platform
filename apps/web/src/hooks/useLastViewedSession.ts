"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { getUserIdentification } from '@/utils/userIdentification';

interface LastViewedSession {
  userId?: string;
  sessionId?: string;
  isAuthenticated: boolean;
}

/**
 * Hook to manage session/user identification for last viewed functionality
 * Handles both authenticated users (userId) and anonymous users (sessionId)
 * Uses centralized getUserIdentification to benefit from in-memory cache
 */
export function useLastViewedSession(): LastViewedSession {
  const { user, isAuthenticated } = useAuth();
  const [sessionId, setSessionId] = useState<string | undefined>();

  useEffect(() => {
    // For authenticated users, use the userId from the auth context
    if (user?.id) {
      return; // Don't set sessionId for authenticated users
    }

    // For anonymous users, use centralized identification (with caching)
    const identification = getUserIdentification();
    setSessionId(identification.sessionId);
  }, [user?.id]);

  return {
    userId: user?.id,
    sessionId,
    isAuthenticated
  };
}
