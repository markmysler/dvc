/**
 * React Query hooks for challenge operations
 *
 * Provides optimized queries and mutations for interacting with challenges:
 * - Challenge listing with caching
 * - Challenge spawning with optimistic updates
 * - Challenge stopping with cache invalidation
 * - Flag validation with immediate feedback
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchChallenges,
  spawnChallenge,
  stopChallenge,
  validateFlag,
  fetchRunningChallenges,
  APIError,
  type ChallengesListResponse,
  type RunningChallengesResponse,
  type SpawnChallengeRequest,
  type SpawnChallengeResponse,
  type ValidateFlagRequest,
  type ValidateFlagResponse,
  type StopChallengeResponse,
} from '@/lib/api';

// Query keys for consistent caching
export const challengeKeys = {
  all: ['challenges'] as const,
  lists: () => [...challengeKeys.all, 'list'] as const,
  running: () => [...challengeKeys.all, 'running'] as const,
};

/**
 * Hook for fetching all available challenges
 */
export function useChallenges() {
  return useQuery({
    queryKey: challengeKeys.lists(),
    queryFn: fetchChallenges,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: (failureCount, error) => {
      // Don't retry on client errors (400-499)
      if (error instanceof APIError && error.status >= 400 && error.status < 500) {
        return false;
      }
      // Retry up to 2 times for network/server errors
      return failureCount < 2;
    },
  });
}

/**
 * Hook for fetching running challenges
 */
export function useRunningChallenges() {
  return useQuery({
    queryKey: challengeKeys.running(),
    queryFn: fetchRunningChallenges,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
    retry: (failureCount, error) => {
      if (error instanceof APIError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook for spawning a new challenge
 */
export function useSpawnChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SpawnChallengeRequest) => spawnChallenge(data),
    onSuccess: async (data: SpawnChallengeResponse) => {
      // Invalidate and refetch running challenges immediately
      await queryClient.invalidateQueries({ 
        queryKey: challengeKeys.running(),
        refetchType: 'active'
      });
      
      // Force an immediate refetch to get the latest state
      await queryClient.refetchQueries({
        queryKey: challengeKeys.running()
      });
    },
    onError: (error: APIError) => {
      console.error('Failed to spawn challenge:', error.message);
    },
  });
}

/**
 * Hook for stopping a running challenge
 */
export function useStopChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => stopChallenge(sessionId),
    onSuccess: (data: StopChallengeResponse, sessionId: string) => {
      // Invalidate running challenges to remove the stopped challenge
      queryClient.invalidateQueries({ queryKey: challengeKeys.running() });

      // Optimistically remove the stopped challenge from cache
      queryClient.setQueryData<RunningChallengesResponse>(
        challengeKeys.running(),
        (oldData) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            challenges: oldData.challenges.filter(
              (session) => session.session_id !== sessionId
            ),
            count: Math.max(0, oldData.count - 1),
          };
        }
      );
    },
    onError: (error: APIError) => {
      console.error('Failed to stop challenge:', error.message);
    },
  });
}

/**
 * Hook for validating a flag submission
 */
export function useValidateFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ValidateFlagRequest) => validateFlag(data),
    onSuccess: (data: ValidateFlagResponse, variables: ValidateFlagRequest) => {
      // If flag was valid, potentially update challenge session status
      if (data.valid) {
        // Refresh running challenges to get updated status
        queryClient.invalidateQueries({ queryKey: challengeKeys.running() });
      }
    },
    onError: (error: APIError) => {
      console.error('Flag validation failed:', error.message);
    },
  });
}

/**
 * Combined hook for all challenge-related operations
 */
export function useChallengeOperations() {
  const challenges = useChallenges();
  const runningChallenges = useRunningChallenges();
  const spawnMutation = useSpawnChallenge();
  const stopMutation = useStopChallenge();
  const validateMutation = useValidateFlag();

  return {
    // Queries
    challenges,
    runningChallenges,

    // Mutations
    spawn: spawnMutation,
    stop: stopMutation,
    validate: validateMutation,

    // Helper methods
    isLoading: challenges.isLoading || runningChallenges.isLoading,
    hasError: challenges.error || runningChallenges.error,
  };
}

// Export the default hook
export default useChallenges;