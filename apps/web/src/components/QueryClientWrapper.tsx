'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryClientWrapper({ children }: { children: React.ReactNode }) {
  // Create QueryClient inside component to avoid serialization issues
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
            gcTime: 10 * 60 * 1000, // 10 minutes - cache garbage collection
            retry: (failureCount, error) => {
              // Don't retry on 4xx errors (client errors)
              if (error instanceof Error && 'status' in error && typeof error.status === 'number') {
                return error.status >= 500; // Only retry server errors
              }
              return failureCount < 3;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
