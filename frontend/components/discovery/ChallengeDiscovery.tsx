/**
 * ChallengeDiscovery - Main discovery interface component
 *
 * Netflix-style discovery interface for browsing cybersecurity challenges.
 * Features:
 * - Grid and table view modes
 * - Search and filtering capabilities
 * - Progress tracking integration
 * - Challenge spawning and management
 */

'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChallengeCard } from './ChallengeCard';
import { ChallengeTable } from './ChallengeTable';
import { ChallengeFilters } from './ChallengeFilters';
import { ChallengeDetailModal } from './ChallengeDetailModal';
import { useChallenges, useSpawnChallenge, useRunningChallenges } from '@/hooks/useChallenges';
import { useDiscoveryFilters, useViewMode, useModalState } from '@/hooks/useFilters';
import { type Challenge } from '@/lib/types';
import { Grid, List, AlertCircle, Loader2 } from 'lucide-react';

interface ChallengeDiscoveryProps {
  initialData?: any;
}

export function ChallengeDiscovery({ initialData }: ChallengeDiscoveryProps) {
  // API hooks
  const { data: challengesData, isLoading: isLoadingChallenges, error } = useChallenges();
  const { data: runningChallengesData } = useRunningChallenges();
  const spawnMutation = useSpawnChallenge();

  // URL state management
  const {
    filters,
    updateFilters,
    clearFilters,
    hasActiveFilters,
  } = useDiscoveryFilters();

  const { view, toggleView } = useViewMode();

  const { modalId: selectedChallengeId, openModal, closeModal } = useModalState('challenge');

  // Get challenges from API response
  const challenges: Challenge[] = useMemo(() => {
    if (challengesData?.challenges) {
      return challengesData.challenges;
    }
    if (initialData?.challenges) {
      return initialData.challenges;
    }
    return [];
  }, [challengesData, initialData]);

  // Filter and search challenges
  const filteredChallenges = useMemo(() => {
    let filtered = [...challenges];

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(
        (challenge) =>
          challenge.name.toLowerCase().includes(searchTerm) ||
          challenge.description.toLowerCase().includes(searchTerm) ||
          challenge.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Category filter
    if (filters.category) {
      filtered = filtered.filter((challenge) => challenge.category === filters.category);
    }

    // Difficulty filter
    if (filters.difficulty) {
      filtered = filtered.filter((challenge) => challenge.difficulty === filters.difficulty);
    }

    // Tag filters
    if (filters.tags.length > 0) {
      filtered = filtered.filter((challenge) =>
        filters.tags.some((tag) => challenge.tags.includes(tag))
      );
    }

    // Sort challenges
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (filters.sort_by) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'points':
          aValue = a.points;
          bValue = b.points;
          break;
        case 'estimated_time':
          aValue = a.estimated_time;
          bValue = b.estimated_time;
          break;
        case 'category':
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        case 'difficulty':
          const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
          aValue = difficultyOrder[a.difficulty];
          bValue = difficultyOrder[b.difficulty];
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return filters.sort_order === 'asc' ? -1 : 1;
      if (aValue > bValue) return filters.sort_order === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [challenges, filters]);

  // Handle challenge spawning
  const handleSpawnChallenge = async (challengeId: string) => {
    try {
      await spawnMutation.mutateAsync({
        challenge_id: challengeId,
        user_id: 'default-user', // TODO: Get from auth context
      });
    } catch (error) {
      console.error('Failed to spawn challenge:', error);
    }
  };

  // Handle view details
  const handleViewDetails = (challengeId: string) => {
    openModal(challengeId);
  };

  // Handle modal close
  const handleModalClose = () => {
    closeModal();
  };

  // Get selected challenge object
  const selectedChallenge = useMemo(() => {
    return selectedChallengeId
      ? challenges.find(c => c.id === selectedChallengeId) || null
      : null;
  }, [selectedChallengeId, challenges]);

  // Handle filter changes
  const handleFiltersChange = async (newFilters: any) => {
    await updateFilters(newFilters);
  };

  // Handle clear filters
  const handleClearFilters = async () => {
    await clearFilters();
  };

  // Loading state
  if (isLoadingChallenges && !initialData) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading challenges...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !initialData) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Failed to Load Challenges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Unable to connect to the challenge API. Please ensure the backend server is running.
            </p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Challenge Discovery</h1>
            <p className="text-muted-foreground">
              Discover and practice cybersecurity challenges
            </p>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={view === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={toggleView}
            >
              <Grid className="h-4 w-4 mr-1" />
              Grid
            </Button>
            <Button
              variant={view === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={toggleView}
            >
              <List className="h-4 w-4 mr-1" />
              Table
            </Button>
          </div>
        </div>

        {/* Filters */}
        <ChallengeFilters
          challenges={challenges}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
        />

        {/* Results summary */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredChallenges.length} challenge{filteredChallenges.length !== 1 ? 's' : ''} found
          </p>

          {runningChallengesData?.running_challenges && runningChallengesData.running_challenges.length > 0 && (
            <Badge variant="secondary">
              {runningChallengesData.running_challenges.length} running
            </Badge>
          )}
        </div>
      </div>

      {/* Challenge grid/table */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredChallenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onSpawn={handleSpawnChallenge}
              onViewDetails={handleViewDetails}
              isSpawning={spawnMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <ChallengeTable
          challenges={filteredChallenges}
          onSpawn={handleSpawnChallenge}
          onViewDetails={handleViewDetails}
          isSpawning={spawnMutation.isPending}
          spawningChallengeId={spawnMutation.variables?.challenge_id}
        />
      )}

      {/* Empty state */}
      {filteredChallenges.length === 0 && (
        <div className="text-center py-12 space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-medium">No challenges found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search terms or filters to find challenges.
            </p>
          </div>
          <Button variant="outline" onClick={handleClearFilters}>
            Clear Filters
          </Button>
        </div>
      )}

      {/* Challenge detail modal */}
      <ChallengeDetailModal
        challenge={selectedChallenge}
        isOpen={selectedChallengeId !== null}
        onClose={handleModalClose}
      />
    </div>
  );
}