'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create QueryClient inside the component to ensure it's created once per session
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          // Stale time: how long data is considered fresh (5 minutes)
          staleTime: 5 * 60 * 1000,
          // Cache time: how long unused data stays in cache (10 minutes)
          gcTime: 10 * 60 * 1000,
          // Retry on failure
          retry: (failureCount, error) => {
            // Don't retry on 4xx errors
            if (error && 'status' in error && typeof error.status === 'number') {
              if (error.status >= 400 && error.status < 500) {
                return false;
              }
            }
            return failureCount < 2;
          },
          // Refetch on window focus (for real-time updates)
          refetchOnWindowFocus: true,
        },
        mutations: {
          // Retry mutations once on failure
          retry: 1,
        },
      },
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}