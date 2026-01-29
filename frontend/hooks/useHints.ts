/**
 * React Query hooks for hint operations
 *
 * Provides optimized queries and mutations for progressive hint disclosure:
 * - Hint fetching with real-time updates
 * - Hint request mutations with optimistic updates
 * - Hint status tracking with automatic refresh
 * - Comprehensive error handling and retry logic
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// API types and interfaces for hints
export interface HintInfo {
  index: number;
  text: string;
  unlocked_by: 'time' | 'request';
  unlocked_at: number;
}

export interface HintStatus {
  challenge_id: string;
  session_id: string;
  total_hints: number;
  available_count: number;
  time_unlocked_count: number;
  request_unlocked_count: number;
  next_unlock_in_seconds: number | null;
  session_duration_seconds: number;
  hints_requested: number;
}

export interface HintsResponse {
  success: boolean;
  data: {
    available_hints: HintInfo[];
    total_hints: number;
    next_unlock: number | null;
    hints_requested: number;
    status: HintStatus;
  };
}

export interface HintRequestRequest {
  challenge_id: string;
  session_id: string;
  action: 'request';
}

export interface HintRequestResponse {
  success: boolean;
  message: string;
  data: {
    available_hints: HintInfo[];
    total_hints: number;
    next_unlock: number | null;
    hints_requested: number;
    status: HintStatus;
    request_result: {
      success: boolean;
      message: string;
      challenge_id: string;
      session_id: string;
      action_required: string;
    };
  };
}

// Error class for hint API errors
export class HintAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message);
    this.name = 'HintAPIError';
  }
}

// Base API configuration
const API_BASE_URL = 'http://localhost:5000';

// Helper function for making hint API requests
async function hintApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new HintAPIError(
        `Server returned ${response.status}: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();

    if (!response.ok) {
      throw new HintAPIError(
        data.message || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        data
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof HintAPIError) {
      throw error;
    }

    if (error instanceof Error) {
      // Network or other fetch errors
      throw new HintAPIError(
        `Request failed: ${error.message}`,
        0 // Use 0 for network errors
      );
    }

    throw new HintAPIError('Unknown error occurred', 0);
  }
}

// API functions for hints
export async function fetchHints(challengeId: string, sessionId: string): Promise<HintsResponse['data']> {
  const params = new URLSearchParams({
    challenge_id: challengeId,
    session_id: sessionId
  });

  const response = await hintApiRequest<HintsResponse>(
    `/api/hints?${params.toString()}`
  );

  return response.data;
}

export async function requestHint(data: HintRequestRequest): Promise<HintRequestResponse['data']> {
  const response = await hintApiRequest<HintRequestResponse>(
    '/api/hints',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );

  return response.data;
}

export async function fetchHintStatus(challengeId: string, sessionId: string): Promise<HintStatus> {
  const params = new URLSearchParams({
    challenge_id: challengeId,
    session_id: sessionId
  });

  const response = await hintApiRequest<{
    success: boolean;
    data: HintStatus;
  }>(`/api/hints/status?${params.toString()}`);

  return response.data;
}

// Query keys for consistent caching
export const hintKeys = {
  all: ['hints'] as const,
  challenges: (challengeId: string) => [...hintKeys.all, 'challenge', challengeId] as const,
  sessions: (challengeId: string, sessionId: string) => [
    ...hintKeys.challenges(challengeId), 'session', sessionId
  ] as const,
  status: (challengeId: string, sessionId: string) => [
    ...hintKeys.sessions(challengeId, sessionId), 'status'
  ] as const,
};

/**
 * Hook for fetching hints for a specific challenge session
 */
export function useHints(challengeId: string, sessionId: string) {
  return useQuery({
    queryKey: hintKeys.sessions(challengeId, sessionId),
    queryFn: () => fetchHints(challengeId, sessionId),
    enabled: Boolean(challengeId && sessionId), // Only fetch if both IDs are provided
    staleTime: 10 * 1000, // 10 seconds - hints change frequently
    gcTime: 2 * 60 * 1000, // 2 minutes garbage collection time
    refetchInterval: 30 * 1000, // Refresh every 30 seconds for timer updates
    refetchIntervalInBackground: true, // Keep updating when tab is not focused
    retry: (failureCount, error) => {
      // Don't retry on client errors (400-499)
      if (error instanceof HintAPIError && error.status >= 400 && error.status < 500) {
        return false;
      }
      // Retry up to 3 times for network/server errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
}

/**
 * Hook for fetching hint status only
 */
export function useHintStatus(challengeId: string, sessionId: string) {
  return useQuery({
    queryKey: hintKeys.status(challengeId, sessionId),
    queryFn: () => fetchHintStatus(challengeId, sessionId),
    enabled: Boolean(challengeId && sessionId),
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
    retry: (failureCount, error) => {
      if (error instanceof HintAPIError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * Hook for requesting early hint access
 */
export function useRequestHint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: HintRequestRequest) => requestHint(data),
    onMutate: async (variables) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: hintKeys.sessions(variables.challenge_id, variables.session_id),
      });

      // Snapshot the previous value
      const previousHints = queryClient.getQueryData(
        hintKeys.sessions(variables.challenge_id, variables.session_id)
      );

      // Optimistically update by incrementing hints_requested
      queryClient.setQueryData(
        hintKeys.sessions(variables.challenge_id, variables.session_id),
        (oldData: any) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            hints_requested: oldData.hints_requested + 1,
            // We can't optimistically add the actual hint since we don't know the text,
            // but we can update the request count
          };
        }
      );

      // Return snapshot for rollback
      return { previousHints };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousHints) {
        queryClient.setQueryData(
          hintKeys.sessions(variables.challenge_id, variables.session_id),
          context.previousHints
        );
      }

      console.error('Failed to request hint:', error);
    },
    onSuccess: (data, variables) => {
      // Update cache with the actual response data
      queryClient.setQueryData(
        hintKeys.sessions(variables.challenge_id, variables.session_id),
        data
      );

      // Also invalidate to ensure we have the latest data
      queryClient.invalidateQueries({
        queryKey: hintKeys.sessions(variables.challenge_id, variables.session_id),
      });

      console.log('Hint request successful:', data.message);
    },
  });
}

/**
 * Combined hook for all hint-related operations
 */
export function useHintOperations(challengeId: string, sessionId: string) {
  const hints = useHints(challengeId, sessionId);
  const hintStatus = useHintStatus(challengeId, sessionId);
  const requestMutation = useRequestHint();

  return {
    // Queries
    hints,
    hintStatus,

    // Mutations
    requestHint: requestMutation,

    // Helper methods
    isLoading: hints.isLoading || hintStatus.isLoading,
    hasError: hints.error || hintStatus.error,

    // Data
    data: hints.data,
    status: hintStatus.data,
  };
}

// Export the default hook
export default useHints;