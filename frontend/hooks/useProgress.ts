/**
 * React hooks for progress tracking and analytics
 *
 * Provides client-side progress tracking using localStorage:
 * - Challenge completion tracking
 * - Time spent analytics
 * - Skill progress by category
 * - Local persistence with JSON storage
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { type Challenge, CHALLENGE_CATEGORIES } from '@/lib/types';

// Progress tracking data structures
export interface ChallengeProgress {
  challengeId: string;
  completed: boolean;
  timeSpent: number; // seconds
  flagFound: boolean;
  completedAt?: string;
  attempts: number;
  hintsUsed: number;
  startedAt: string;
  lastAttemptAt: string;
}

export interface ProgressStats {
  totalChallenges: number;
  completedChallenges: number;
  totalTimeSpent: number;
  averageTimePerChallenge: number;
  successRate: number;
  categoriesCompleted: Record<string, number>;
  difficultiesCompleted: Record<string, number>;
  streakDays: number;
  lastActivity: string | null;
}

export interface SkillProgress {
  category: string;
  total: number;
  completed: number;
  percentage: number;
  averageTime: number;
  bestTime: number;
  recentActivity: string | null;
}

// Local storage keys
const PROGRESS_STORAGE_KEY = 'challenge_progress';
const SETTINGS_STORAGE_KEY = 'progress_settings';

/**
 * Hook for managing individual challenge progress
 */
export function useProgress() {
  const [progressData, setProgressData] = useState<Record<string, ChallengeProgress>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load progress from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROGRESS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setProgressData(parsed);
      }
    } catch (error) {
      console.error('Failed to load progress data:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save progress to localStorage whenever it changes
  const saveProgress = useCallback((data: Record<string, ChallengeProgress>) => {
    try {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(data));
      setProgressData(data);
    } catch (error) {
      console.error('Failed to save progress data:', error);
    }
  }, []);

  // Track challenge completion
  const trackCompletion = useCallback((
    challengeId: string,
    timeSpent: number,
    flagFound: boolean = true
  ) => {
    const now = new Date().toISOString();

    setProgressData(current => {
      const existing = current[challengeId] || {
        challengeId,
        completed: false,
        timeSpent: 0,
        flagFound: false,
        attempts: 0,
        hintsUsed: 0,
        startedAt: now,
        lastAttemptAt: now,
      };

      const updated = {
        ...current,
        [challengeId]: {
          ...existing,
          completed: flagFound,
          timeSpent: existing.timeSpent + timeSpent,
          flagFound: flagFound,
          completedAt: flagFound ? now : existing.completedAt,
          attempts: existing.attempts + 1,
          lastAttemptAt: now,
        }
      };

      // Save to localStorage
      try {
        localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save progress:', error);
      }

      return updated;
    });
  }, []);

  // Start tracking a challenge session
  const startChallenge = useCallback((challengeId: string) => {
    const now = new Date().toISOString();

    setProgressData(current => {
      const existing = current[challengeId];

      // If already tracking this challenge, just update last attempt
      if (existing) {
        const updated = {
          ...current,
          [challengeId]: {
            ...existing,
            lastAttemptAt: now,
          }
        };

        try {
          localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(updated));
        } catch (error) {
          console.error('Failed to save progress:', error);
        }

        return updated;
      }

      // Create new progress entry
      const updated = {
        ...current,
        [challengeId]: {
          challengeId,
          completed: false,
          timeSpent: 0,
          flagFound: false,
          attempts: 0,
          hintsUsed: 0,
          startedAt: now,
          lastAttemptAt: now,
        }
      };

      try {
        localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save progress:', error);
      }

      return updated;
    });
  }, []);

  // Track hint usage
  const trackHintUsed = useCallback((challengeId: string) => {
    setProgressData(current => {
      const existing = current[challengeId];
      if (!existing) return current;

      const updated = {
        ...current,
        [challengeId]: {
          ...existing,
          hintsUsed: existing.hintsUsed + 1,
          lastAttemptAt: new Date().toISOString(),
        }
      };

      try {
        localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save progress:', error);
      }

      return updated;
    });
  }, []);

  // Get progress for specific challenge
  const getChallengeProgress = useCallback((challengeId: string): ChallengeProgress | null => {
    return progressData[challengeId] || null;
  }, [progressData]);

  // Reset all progress data
  const resetProgress = useCallback(() => {
    try {
      localStorage.removeItem(PROGRESS_STORAGE_KEY);
      setProgressData({});
    } catch (error) {
      console.error('Failed to reset progress:', error);
    }
  }, []);

  return {
    progressData,
    isLoaded,
    trackCompletion,
    startChallenge,
    trackHintUsed,
    getChallengeProgress,
    resetProgress,
  };
}

/**
 * Hook for progress statistics and analytics
 */
export function useProgressStats(challenges: Challenge[]) {
  const { progressData, isLoaded } = useProgress();

  const stats: ProgressStats = useMemo(() => {
    if (!isLoaded) {
      return {
        totalChallenges: 0,
        completedChallenges: 0,
        totalTimeSpent: 0,
        averageTimePerChallenge: 0,
        successRate: 0,
        categoriesCompleted: {},
        difficultiesCompleted: {},
        streakDays: 0,
        lastActivity: null,
      };
    }

    const progressEntries = Object.values(progressData);
    const completedEntries = progressEntries.filter(p => p.completed);

    // Basic counts
    const totalChallenges = challenges.length;
    const completedChallenges = completedEntries.length;
    const totalTimeSpent = progressEntries.reduce((sum, p) => sum + p.timeSpent, 0);
    const averageTimePerChallenge = completedChallenges > 0 ? totalTimeSpent / completedChallenges : 0;
    const successRate = totalChallenges > 0 ? completedChallenges / totalChallenges : 0;

    // Category progress
    const categoriesCompleted: Record<string, number> = {};
    CHALLENGE_CATEGORIES.forEach(category => {
      categoriesCompleted[category] = completedEntries.filter(p => {
        const challenge = challenges.find(c => c.id === p.challengeId);
        return challenge?.category === category;
      }).length;
    });

    // Difficulty progress
    const difficultiesCompleted = {
      beginner: 0,
      intermediate: 0,
      advanced: 0,
      expert: 0,
    };

    completedEntries.forEach(p => {
      const challenge = challenges.find(c => c.id === p.challengeId);
      if (challenge) {
        difficultiesCompleted[challenge.difficulty]++;
      }
    });

    // Find last activity
    const lastActivity = progressEntries.reduce((latest, p) => {
      if (!latest) return p.lastAttemptAt;
      return p.lastAttemptAt > latest ? p.lastAttemptAt : latest;
    }, null as string | null);

    // Calculate streak (simplified - consecutive days with activity)
    const streakDays = calculateStreakDays(progressEntries);

    return {
      totalChallenges,
      completedChallenges,
      totalTimeSpent,
      averageTimePerChallenge,
      successRate,
      categoriesCompleted,
      difficultiesCompleted,
      streakDays,
      lastActivity,
    };
  }, [progressData, challenges, isLoaded]);

  return stats;
}

/**
 * Hook for skill-based progress tracking
 */
export function useSkillProgress(challenges: Challenge[]) {
  const { progressData, isLoaded } = useProgress();

  const skillProgress: SkillProgress[] = useMemo(() => {
    if (!isLoaded) return [];

    return CHALLENGE_CATEGORIES.map(category => {
      const categoryProblems = challenges.filter(c => c.category === category);
      const completedInCategory = categoryProblems.filter(c => {
        const progress = progressData[c.id];
        return progress?.completed;
      });

      const categoryTimes = completedInCategory
        .map(c => progressData[c.id]?.timeSpent || 0)
        .filter(time => time > 0);

      const averageTime = categoryTimes.length > 0
        ? categoryTimes.reduce((sum, time) => sum + time, 0) / categoryTimes.length
        : 0;

      const bestTime = categoryTimes.length > 0 ? Math.min(...categoryTimes) : 0;

      // Find most recent activity in this category
      const recentActivity = completedInCategory.reduce((latest, challenge) => {
        const progress = progressData[challenge.id];
        if (!progress?.completedAt) return latest;
        if (!latest) return progress.completedAt;
        return progress.completedAt > latest ? progress.completedAt : latest;
      }, null as string | null);

      return {
        category,
        total: categoryProblems.length,
        completed: completedInCategory.length,
        percentage: categoryProblems.length > 0 ? (completedInCategory.length / categoryProblems.length) * 100 : 0,
        averageTime,
        bestTime,
        recentActivity,
      };
    }).filter(skill => skill.total > 0); // Only show categories that have challenges
  }, [progressData, challenges, isLoaded]);

  return skillProgress;
}

// Helper function to calculate consecutive days streak
function calculateStreakDays(progressEntries: ChallengeProgress[]): number {
  if (progressEntries.length === 0) return 0;

  // Get unique activity dates, sorted descending
  const activityDates = [...new Set(
    progressEntries.map(p => p.lastAttemptAt.split('T')[0])
  )].sort().reverse();

  if (activityDates.length === 0) return 0;

  // Check if today or yesterday has activity
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  if (activityDates[0] !== today && activityDates[0] !== yesterday) {
    return 0; // No recent activity
  }

  // Count consecutive days
  let streak = 0;
  let currentDate = activityDates[0] === today ? today : yesterday;

  for (const date of activityDates) {
    if (date === currentDate) {
      streak++;
      // Move to previous day
      const prevDate = new Date(Date.parse(currentDate) - 24 * 60 * 60 * 1000);
      currentDate = prevDate.toISOString().split('T')[0];
    } else {
      break;
    }
  }

  return streak;
}