"use client";

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

interface LastViewedSession {
  userId?: string;
  sessionId?: string;
  isAuthenticated: boolean;
}

/**
 * Hook to manage session/user identification for last viewed functionality
 * Handles both authenticated users (userId) and anonymous users (sessionId)
 */
export function useLastViewedSession(): LastViewedSession {
  const sessionResult = useSession();
  const session = sessionResult?.data;
  const [sessionId, setSessionId] = useState<string | undefined>();

  useEffect(() => {
    // For authenticated users, use the userId from session (handle NextAuth JWT strategy)
    // Extract user ID safely - handle different session structures like behaviorTracking.ts
    const userId = (session as any)?.user?.id || 
                   (session as any)?.userId || 
                   undefined;
    
    if (userId) {
      return; // Don't set sessionId for authenticated users
    }

    // For anonymous users, get or create sessionId from localStorage
    let storedSessionId = localStorage.getItem('lastViewedSessionId');
    if (!storedSessionId) {
      storedSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('lastViewedSessionId', storedSessionId);
    }
    setSessionId(storedSessionId);
  }, [session]);

  return {
    userId: (session as any)?.user?.id || (session as any)?.userId,
    sessionId,
    isAuthenticated: !!((session as any)?.user?.id || (session as any)?.userId)
  };
}
