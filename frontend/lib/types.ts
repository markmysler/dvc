/**
 * Type definitions for the Cybersecurity Training Platform
 *
 * Provides TypeScript interfaces for all data structures used in the application:
 * - Challenge definitions and metadata
 * - Session management and container states
 * - API request/response types
 * - UI state management types
 */

// Core challenge definition - matches Flask API structure
export interface Challenge {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  points: number;
  tags: string[];
  estimated_time: number; // minutes
  container: {
    image: string;
    ports: Record<string, number>;
    environment?: Record<string, string>;
  };
  flag_format?: string;
  learning_objectives?: string[];
  hints?: string[];
}

// Challenge session tracking
export interface ChallengeSession {
  session_id: string;
  challenge_id: string;
  user_id: string;
  container_id: string;
  access_url: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  created_at: string;
  expires_at: string;
  challenge: Challenge;
}

// User progress and completion tracking
export interface UserProgress {
  user_id: string;
  challenge_id: string;
  status: 'not-started' | 'attempted' | 'completed';
  attempts: number;
  completed_at?: string;
  best_time?: number; // seconds
  flags_submitted: number;
  hints_used: number;
  points_earned: number;
}

// Discovery interface state management
export interface DiscoveryFilters {
  search: string;
  category: string;
  difficulty: string;
  completion_status: string;
  tags: string[];
  sort_by: 'name' | 'difficulty' | 'points' | 'estimated_time' | 'category';
  sort_order: 'asc' | 'desc';
}

export interface DiscoveryViewState {
  view: 'table' | 'grid';
  filters: DiscoveryFilters;
  pagination: {
    page: number;
    per_page: number;
    total: number;
  };
}

// UI component props
export interface ChallengeCardProps {
  challenge: Challenge;
  progress?: UserProgress;
  onSpawn: (challengeId: string) => void;
  onViewDetails: (challengeId: string) => void;
  isSpawning?: boolean;
}

export interface ChallengeDetailModalProps {
  challenge: Challenge | null;
  isOpen: boolean;
  onClose: () => void;
  onSpawn: (challengeId: string) => void;
  onStop?: (sessionId: string) => void;
  onValidateFlag?: (sessionId: string, flag: string) => void;
  session?: ChallengeSession;
  progress?: UserProgress;
}

// Table column definitions for TanStack Table
export interface ChallengeTableColumn {
  id: string;
  header: string;
  accessorKey?: string;
  cell?: (info: any) => React.ReactNode;
  enableSorting?: boolean;
  enableColumnFilter?: boolean;
  filterFn?: string;
}

// API request/response types (extending from api.ts)
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

// Component event handlers
export type OnSpawnChallenge = (challengeId: string) => void;
export type OnStopChallenge = (sessionId: string) => void;
export type OnValidateFlag = (sessionId: string, flag: string) => void;
export type OnViewDetails = (challengeId: string) => void;

// Difficulty level configurations
export const DIFFICULTY_LEVELS = {
  beginner: { label: 'Beginner', color: 'green', order: 1 },
  intermediate: { label: 'Intermediate', color: 'blue', order: 2 },
  advanced: { label: 'Advanced', color: 'orange', order: 3 },
  expert: { label: 'Expert', color: 'red', order: 4 },
} as const;

// Category configurations
export const CHALLENGE_CATEGORIES = [
  'web',
  'crypto',
  'forensics',
  'reverse',
  'pwn',
  'misc',
  'osint',
  'networking',
  'steganography'
] as const;

// Export commonly used type guards
export function isDifficultyLevel(value: string): value is Challenge['difficulty'] {
  return ['beginner', 'intermediate', 'advanced', 'expert'].includes(value);
}

export function isChallengeCategory(value: string): value is string {
  return CHALLENGE_CATEGORIES.includes(value as any);
}

export function isValidSessionStatus(value: string): value is ChallengeSession['status'] {
  return ['starting', 'running', 'stopping', 'stopped', 'error'].includes(value);
}