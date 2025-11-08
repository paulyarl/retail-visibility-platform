'use client';

import Link from 'next/link';
import { Card, CardContent, Button } from '@/components/ui';

export default function AccessDeniedPage() {
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
        </CardContent>
      </Card>
    </div>
  );
}
