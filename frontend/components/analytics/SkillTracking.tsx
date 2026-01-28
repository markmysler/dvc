/**
 * SkillTracking - Skill development tracking component
 *
 * Shows skill progress across vulnerability categories:
 * - Progress bars for each skill category
 * - Recommended next challenges
 * - Skill level indicators
 * - Recent activity tracking
 */

'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Challenge } from '@/lib/types';
import { type SkillProgress } from '@/hooks/useProgress';
import {
  Trophy,
  Target,
  Clock,
  TrendingUp,
  Star,
  ChevronRight,
  Activity,
} from 'lucide-react';

interface SkillTrackingProps {
  challenges: Challenge[];
  skillProgress: SkillProgress[];
}

export function SkillTracking({ challenges, skillProgress }: SkillTrackingProps) {
  // Calculate skill levels based on completion percentage
  const getSkillLevel = (percentage: number): { level: string; color: string; icon: React.ReactNode } => {
    if (percentage >= 90) {
      return { level: 'Expert', color: 'text-purple-600', icon: <Trophy className="h-4 w-4" /> };
    } else if (percentage >= 75) {
      return { level: 'Advanced', color: 'text-orange-600', icon: <Star className="h-4 w-4" /> };
    } else if (percentage >= 50) {
      return { level: 'Intermediate', color: 'text-blue-600', icon: <Target className="h-4 w-4" /> };
    } else if (percentage >= 25) {
      return { level: 'Beginner', color: 'text-green-600', icon: <TrendingUp className="h-4 w-4" /> };
    } else {
      return { level: 'Novice', color: 'text-gray-600', icon: <Activity className="h-4 w-4" /> };
    }
  };

  // Get recommended next challenges for each category
  const getRecommendedChallenges = (category: string): Challenge[] => {
    return challenges
      .filter(challenge => challenge.category === category)
      .sort((a, b) => {
        // Sort by difficulty, then by points
        const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
        const aDiff = difficultyOrder[a.difficulty];
        const bDiff = difficultyOrder[b.difficulty];
        if (aDiff !== bDiff) return aDiff - bDiff;
        return a.points - b.points;
      })
      .slice(0, 3); // Top 3 recommendations
  };

  // Format time duration
  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return 'No data';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // Sort skills by progress (completed skills first, then by percentage)
  const sortedSkills = useMemo(() => {
    return [...skillProgress].sort((a, b) => {
      if (a.completed > 0 && b.completed === 0) return -1;
      if (b.completed > 0 && a.completed === 0) return 1;
      return b.percentage - a.percentage;
    });
  }, [skillProgress]);

  // Get overall skill summary
  const skillSummary = useMemo(() => {
    const totalCategories = skillProgress.length;
    const startedCategories = skillProgress.filter(skill => skill.completed > 0).length;
    const masteredCategories = skillProgress.filter(skill => skill.percentage >= 90).length;
    const averageProgress = skillProgress.reduce((sum, skill) => sum + skill.percentage, 0) / totalCategories || 0;

    return {
      totalCategories,
      startedCategories,
      masteredCategories,
      averageProgress: Math.round(averageProgress),
    };
  }, [skillProgress]);

  return (
    <div className="space-y-6">
      {/* Skill Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{skillSummary.totalCategories}</div>
            <div className="text-xs text-muted-foreground">
              Available skill areas
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Started</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{skillSummary.startedCategories}</div>
            <div className="text-xs text-muted-foreground">
              Categories with progress
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mastered</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{skillSummary.masteredCategories}</div>
            <div className="text-xs text-muted-foreground">
              90%+ completion rate
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{skillSummary.averageProgress}%</div>
            <div className="text-xs text-muted-foreground">
              Overall skill progress
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Skill Progress Details */}
      <Card>
        <CardHeader>
          <CardTitle>Skill Development Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {sortedSkills.map((skill) => {
            const skillLevel = getSkillLevel(skill.percentage);
            const recommendedChallenges = getRecommendedChallenges(skill.category);

            return (
              <div key={skill.category} className="space-y-4 p-4 border rounded-lg">
                {/* Skill Header */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold capitalize">{skill.category}</h3>
                      <Badge variant="outline" className={`${skillLevel.color} flex items-center gap-1`}>
                        {skillLevel.icon}
                        {skillLevel.level}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {skill.completed} of {skill.total} challenges completed
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-2xl font-bold">{Math.round(skill.percentage)}%</div>
                    <div className="text-xs text-muted-foreground">Complete</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <Progress value={skill.percentage} className="h-3" />

                {/* Skill Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Avg Time:</span>
                    <span className="font-medium">{formatDuration(skill.averageTime)}</span>
                  </div>

                  {skill.bestTime > 0 && (
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Best Time:</span>
                      <span className="font-medium">{formatDuration(skill.bestTime)}</span>
                    </div>
                  )}

                  {skill.recentActivity && (
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Last Active:</span>
                      <span className="font-medium">
                        {new Date(skill.recentActivity).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Recommended Next Challenges */}
                {recommendedChallenges.length > 0 && skill.percentage < 100 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Recommended Next:</h4>
                    <div className="space-y-2">
                      {recommendedChallenges.slice(0, 2).map((challenge) => (
                        <div
                          key={challenge.id}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{challenge.name}</span>
                              <Badge
                                variant="outline"
                                className={
                                  challenge.difficulty === 'beginner'
                                    ? 'text-green-600'
                                    : challenge.difficulty === 'intermediate'
                                    ? 'text-blue-600'
                                    : challenge.difficulty === 'advanced'
                                    ? 'text-orange-600'
                                    : 'text-red-600'
                                }
                              >
                                {challenge.difficulty}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {challenge.points} points • ~{challenge.estimated_time}min
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completion Message */}
                {skill.percentage === 100 && (
                  <div className="text-center py-2">
                    <div className="inline-flex items-center gap-2 text-purple-600 font-medium">
                      <Trophy className="h-4 w-4" />
                      Congratulations! You've mastered {skill.category}!
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty State */}
          {sortedSkills.length === 0 && (
            <div className="text-center py-8 space-y-2">
              <Target className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-medium">No Skill Progress Yet</h3>
              <p className="text-muted-foreground">
                Complete some challenges to start tracking your skill development!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}