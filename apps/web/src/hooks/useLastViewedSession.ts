"use client";

import { useAuth } from '@/contexts/AuthContext';
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
  const { user, isAuthenticated } = useAuth();
  const [sessionId, setSessionId] = useState<string | undefined>();

  useEffect(() => {
    // For authenticated users, use the userId from the auth context
    if (user?.id) {
      return; // Don't set sessionId for authenticated users
    }

    // For anonymous users, get or create sessionId from localStorage
    let storedSessionId = localStorage.getItem('lastViewedSessionId');
    if (!storedSessionId) {
      storedSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('lastViewedSessionId', storedSessionId);
    }
    setSessionId(storedSessionId);
  }, [user?.id]);

  return {
    userId: user?.id,
    sessionId,
    isAuthenticated
  };
}
