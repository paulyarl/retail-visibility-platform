'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, Button } from '@/components/ui';
import { api } from '@/lib/api';

function AccessDeniedContent() {
  const searchParams = useSearchParams();
  const attemptedPath = searchParams.get('path');
  const timestamp = searchParams.get('timestamp');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // Log access denied with context for debugging
    console.warn('[Access Denied]', {
      attemptedPath,
      timestamp,
      url: window.location.href,
    });

    // Fetch current user info for debugging
    const fetchUser = async () => {
      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const res = await api.get(`${apiBaseUrl}/auth/me`);
        if (res.ok) {
          const data = await res.json();
          const user = data.user || data;
          setUserEmail(user.email);
          
          // Log with user context
          console.warn('[Access Denied] User context:', {
            user: user.email,
            role: user.role,
            attemptedPath,
          });
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    };
    fetchUser();
  }, [attemptedPath, timestamp]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          {/* Icon */}
          <div className="mb-6">
            <svg
              className="mx-auto h-16 w-16 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">
            Access Denied
          </h1>

          {/* Message */}
          <p className="text-neutral-600 mb-6">
            You don't have permission to access this page. This area is restricted to platform administrators only.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="primary"
              onClick={() => window.history.back()}
            >
              Go Back
            </Button>
            <Link href="/">
              <Button variant="secondary">
                Go to Home
              </Button>
            </Link>
          </div>

          {/* Help Text */}
          <p className="mt-6 text-sm text-neutral-500">
            If you believe you should have access, please contact your administrator.
          </p>

          {/* Debug Info */}
          {(attemptedPath || userEmail || timestamp) && (
            <div className="mt-6 pt-6 border-t border-neutral-200">
              <p className="text-xs font-semibold text-neutral-700 mb-2">Debug Information:</p>
              <div className="text-xs text-left bg-neutral-100 rounded p-3 space-y-1 font-mono">
                {userEmail && (
                  <div>
                    <span className="text-neutral-500">User:</span>{' '}
                    <span className="text-neutral-900">{userEmail}</span>
                  </div>
                )}
                {attemptedPath && (
                  <div>
                    <span className="text-neutral-500">Attempted Path:</span>{' '}
                    <span className="text-neutral-900">{attemptedPath}</span>
                  </div>
                )}
                {timestamp && (
                  <div>
                    <span className="text-neutral-500">Time:</span>{' '}
                    <span className="text-neutral-900">
                      {new Date(timestamp).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                Include this information when contacting support.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-neutral-600">Loading...</div>
      </div>
    }>
      <AccessDeniedContent />
    </Suspense>
  );
}
