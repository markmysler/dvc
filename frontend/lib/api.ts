/**
 * API client for the Damn Vulnerable Containers backend
 *
 * Provides typed functions to interact with the Flask API at localhost:5000
 * All functions include proper error handling and JSON serialization
 */

import { type Challenge, type ChallengeSession } from './types';

// TypeScript interfaces for API responses and requests

export interface SpawnChallengeRequest {
  challenge_id: string;
  user_id: string;
}

export interface SpawnChallengeResponse {
  success: boolean;
  session_id: string;
  message: string;
  challenge_session?: ChallengeSession;
}

export interface ValidateFlagRequest {
  flag: string;
  session_id: string;
}

export interface ValidateFlagResponse {
  valid: boolean;
  message: string;
  points_awarded?: number;
  completion_time?: number;
  hints_available?: boolean;
}

export interface StopChallengeResponse {
  success: boolean;
  message: string;
}

export interface ChallengesListResponse {
  success: boolean;
  challenges: Challenge[];
  total_count: number;
}

export interface RunningChallengesResponse {
  status: string;
  challenges: ChallengeSession[];
  count: number;
}

// Error types
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Base API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || `http://${process.env.HOST || 'localhost'}:5000`;

// Helper function for making API requests
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Default headers
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

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new APIError(
        `Server returned ${response.status}: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();

    // Handle HTTP errors
    if (!response.ok) {
      throw new APIError(
        data.message || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    // Network or other errors
    if (error instanceof TypeError) {
      throw new APIError(
        'Network error: Unable to connect to API server',
        0
      );
    }

    throw new APIError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      0
    );
  }
}

// API Functions

/**
 * Fetch all available challenges from the backend
 */
export async function fetchChallenges(): Promise<ChallengesListResponse> {
  return apiRequest<ChallengesListResponse>('/api/challenges', {
    method: 'GET',
  });
}

/**
 * Spawn a new challenge container for a user
 */
export async function spawnChallenge(
  request: SpawnChallengeRequest
): Promise<SpawnChallengeResponse> {
  return apiRequest<SpawnChallengeResponse>('/api/challenges', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Stop a running challenge container
 */
export async function stopChallenge(
  sessionId: string
): Promise<StopChallengeResponse> {
  return apiRequest<StopChallengeResponse>(`/api/challenges/${sessionId}`, {
    method: 'DELETE',
  });
}

/**
 * Validate a submitted flag against a challenge session
 */
export async function validateFlag(
  request: ValidateFlagRequest
): Promise<ValidateFlagResponse> {
  return apiRequest<ValidateFlagResponse>('/api/flags', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get all running challenge sessions for a user
 */
export async function fetchRunningChallenges(): Promise<RunningChallengesResponse> {
  return apiRequest<RunningChallengesResponse>('/api/challenges/running', {
    method: 'GET',
  });
}

/**
 * Health check for the API server
 */
export async function healthCheck(): Promise<{ status: string; message: string }> {
  return apiRequest<{ status: string; message: string }>('/api/health', {
    method: 'GET',
  });
}

// Types are already exported inline above