/**
 * ChallengeCard component for displaying individual challenges in grid view
 *
 * Features:
 * - Difficulty badges with color coding
 * - Category tags and challenge metadata
 * - Points display and estimated time
 * - Quick spawn button for launching challenges
 * - Progress indicator for completed/attempted challenges
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type Challenge,
  type UserProgress,
  DIFFICULTY_LEVELS,
  type OnSpawnChallenge,
  type OnViewDetails
} from '@/lib/types';
import { Clock, Play, Star, Tag, Trophy, CheckCircle, AlertCircle } from 'lucide-react';

interface ChallengeCardProps {
  challenge: Challenge;
  progress?: UserProgress;
  onSpawn: OnSpawnChallenge;
  onViewDetails: OnViewDetails;
  isSpawning?: boolean;
}

export function ChallengeCard({
  challenge,
  progress,
  onSpawn,
  onViewDetails,
  isSpawning = false
}: ChallengeCardProps) {
  const difficultyConfig = DIFFICULTY_LEVELS[challenge.difficulty];

  const getDifficultyVariant = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'default';
      case 'intermediate': return 'secondary';
      case 'advanced': return 'destructive';
      case 'expert': return 'outline';
      default: return 'default';
    }
  };

  const getProgressIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'attempted':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getProgressText = (progress?: UserProgress) => {
    if (!progress || progress.status === 'not-started') {
      return null;
    }

    if (progress.status === 'completed') {
      return (
        <div className="flex items-center gap-1 text-sm text-green-600">
          <CheckCircle className="h-3 w-3" />
          <span>Completed</span>
          {progress.best_time && progress.best_time > 0 && (
            <span className="text-xs text-muted-foreground">
              ({Math.floor(progress.best_time / 60)}m)
            </span>
          )}
        </div>
      );
    }

    if (progress.status === 'attempted') {
      return (
        <div className="flex items-center gap-1 text-sm text-yellow-600">
          <AlertCircle className="h-3 w-3" />
          {progress.attempts} attempt{progress.attempts !== 1 ? 's' : ''}
        </div>
      );
    }

    return null;
  };

  return (
    <Card className="relative group hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-3" onClick={() => onViewDetails(challenge.id)}>
        {/* Progress indicator */}
        {progress && (
          <div className="absolute top-3 right-3">
            {getProgressIcon(progress.status)}
          </div>
        )}

        {/* Title and difficulty */}
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg leading-tight">{challenge.name}</CardTitle>
            <Badge variant={getDifficultyVariant(challenge.difficulty)} className="ml-2">
              {difficultyConfig.label}
            </Badge>
          </div>

          {/* Category and tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              <Tag className="h-3 w-3 mr-1" />
              {challenge.category}
            </Badge>
            {challenge.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {challenge.tags.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{challenge.tags.length - 2}
              </Badge>
            )}
          </div>
        </div>

        <CardDescription className="line-clamp-2">
          {challenge.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Challenge metadata */}
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Trophy className="h-4 w-4" />
            <span>{challenge.points} pts</span>
          </div>

          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>~{challenge.estimated_time}</span>
          </div>
        </div>

        {/* Progress status */}
        {getProgressText(progress)}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onSpawn(challenge.id)}
            disabled={isSpawning}
          >
            <Play className="h-4 w-4 mr-1" />
            {isSpawning ? 'Spawning...' : 'Start Challenge'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails(challenge.id)}
          >
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}