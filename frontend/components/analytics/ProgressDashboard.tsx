/**
 * ProgressDashboard - Main analytics dashboard component
 *
 * Displays comprehensive progress tracking and analytics:
 * - Overview cards with key metrics
 * - Progress charts and visualizations
 * - Skill tracking by category
 * - Navigation tabs for different views
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ProgressCharts } from './ProgressCharts';
import { SkillTracking } from './SkillTracking';
import { useProgressStats, useSkillProgress } from '@/hooks/useProgress';
import { type Challenge } from '@/lib/types';
import {
  Trophy,
  Clock,
  Target,
  TrendingUp,
  Calendar,
  Award,
  BarChart3,
  Activity
} from 'lucide-react';

interface ProgressDashboardProps {
  challenges: Challenge[];
}

export function ProgressDashboard({ challenges }: ProgressDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const stats = useProgressStats(challenges);
  const skillProgress = useSkillProgress(challenges);

  // Helper to format time duration
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // Helper to format percentage
  const formatPercentage = (value: number): string => {
    return `${Math.round(value * 100)}%`;
  };

  // Calculate overall progress percentage
  const overallProgress = stats.totalChallenges > 0
    ? (stats.completedChallenges / stats.totalChallenges) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Progress Analytics</h2>
        <p className="text-muted-foreground">
          Track your security learning journey and skill development
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Challenges */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Challenges</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalChallenges}</div>
            <div className="text-xs text-muted-foreground">
              Available challenges
            </div>
          </CardContent>
        </Card>

        {/* Completed Challenges */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedChallenges}</div>
            <div className="space-y-1">
              <Progress value={overallProgress} className="h-2" />
              <div className="text-xs text-muted-foreground">
                {formatPercentage(overallProgress / 100)} completion rate
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(stats.successRate)}
            </div>
            <div className="text-xs text-muted-foreground">
              Challenges completed successfully
            </div>
          </CardContent>
        </Card>

        {/* Time Spent */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Spent</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(stats.totalTimeSpent)}
            </div>
            <div className="text-xs text-muted-foreground">
              Avg: {formatDuration(Math.round(stats.averageTimePerChallenge))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Streak and Activity Info */}
      {(stats.streakDays > 0 || stats.lastActivity) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Current Streak */}
          {stats.streakDays > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {stats.streakDays} day{stats.streakDays !== 1 ? 's' : ''}
                </div>
                <div className="text-xs text-muted-foreground">
                  Keep it up! 🔥
                </div>
              </CardContent>
            </Card>
          )}

          {/* Last Activity */}
          {stats.lastActivity && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Date(stats.lastActivity).toLocaleDateString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(stats.lastActivity).toLocaleTimeString()}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="charts" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="skills" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Skills
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Category Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Progress by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(stats.categoriesCompleted).map(([category, completed]) => {
                  const total = challenges.filter(c => c.category === category).length;
                  const percentage = total > 0 ? (completed / total) * 100 : 0;

                  if (total === 0) return null;

                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">{category}</span>
                        <Badge variant="secondary" className="text-xs">
                          {completed}/{total}
                        </Badge>
                      </div>
                      <Progress value={percentage} className="h-2" />
                      <div className="text-xs text-muted-foreground text-right">
                        {Math.round(percentage)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Difficulty Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Progress by Difficulty</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(stats.difficultiesCompleted).map(([difficulty, completed]) => {
                  const total = challenges.filter(c => c.difficulty === difficulty).length;
                  const percentage = total > 0 ? (completed / total) * 100 : 0;

                  if (total === 0) return null;

                  const difficultyColors = {
                    beginner: 'text-green-600',
                    intermediate: 'text-blue-600',
                    advanced: 'text-orange-600',
                    expert: 'text-red-600',
                  };

                  return (
                    <div key={difficulty} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium capitalize ${difficultyColors[difficulty as keyof typeof difficultyColors]}`}>
                          {difficulty}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {completed}/{total}
                        </Badge>
                      </div>
                      <Progress value={percentage} className="h-2" />
                      <div className="text-xs text-muted-foreground text-right">
                        {Math.round(percentage)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts">
          <ProgressCharts
            challenges={challenges}
            stats={stats}
            skillProgress={skillProgress}
          />
        </TabsContent>

        <TabsContent value="skills">
          <SkillTracking
            challenges={challenges}
            skillProgress={skillProgress}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}