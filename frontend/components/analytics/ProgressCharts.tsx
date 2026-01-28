/**
 * ProgressCharts - Analytics charts and visualizations
 *
 * Provides various chart types for progress visualization:
 * - Completion by category (bar chart)
 * - Difficulty progression (line chart)
 * - Time spent trends (area chart)
 * - Progress over time visualization
 */

'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { type Challenge } from '@/lib/types';
import { type ProgressStats, type SkillProgress } from '@/hooks/useProgress';

interface ProgressChartsProps {
  challenges: Challenge[];
  stats: ProgressStats;
  skillProgress: SkillProgress[];
}

export function ProgressCharts({ challenges, stats, skillProgress }: ProgressChartsProps) {
  // Prepare category completion data
  const categoryData = useMemo(() => {
    return Object.entries(stats.categoriesCompleted).map(([category, completed]) => {
      const total = challenges.filter(c => c.category === category).length;
      return {
        category: category.charAt(0).toUpperCase() + category.slice(1),
        completed,
        remaining: Math.max(0, total - completed),
        total,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }).filter(item => item.total > 0);
  }, [challenges, stats.categoriesCompleted]);

  // Prepare difficulty progression data
  const difficultyData = useMemo(() => {
    const difficulties = ['beginner', 'intermediate', 'advanced', 'expert'];
    return difficulties.map(difficulty => {
      const total = challenges.filter(c => c.difficulty === difficulty).length;
      const completed = stats.difficultiesCompleted[difficulty as keyof typeof stats.difficultiesCompleted] || 0;
      return {
        difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
        completed,
        total,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }).filter(item => item.total > 0);
  }, [challenges, stats.difficultiesCompleted]);

  // Prepare skill progress data for area chart
  const skillAreaData = useMemo(() => {
    return skillProgress.map(skill => ({
      category: skill.category.charAt(0).toUpperCase() + skill.category.slice(1),
      percentage: Math.round(skill.percentage),
      completed: skill.completed,
      total: skill.total,
      averageTime: Math.round(skill.averageTime / 60), // Convert to minutes
    }));
  }, [skillProgress]);

  // Prepare time distribution data
  const timeDistributionData = useMemo(() => {
    const timeRanges = [
      { label: '< 5 min', min: 0, max: 300 },
      { label: '5-15 min', min: 300, max: 900 },
      { label: '15-30 min', min: 900, max: 1800 },
      { label: '30-60 min', min: 1800, max: 3600 },
      { label: '> 1 hour', min: 3600, max: Infinity },
    ];

    // This would need actual completion time data from progress tracking
    // For now, we'll create a simplified version
    return timeRanges.map(range => ({
      timeRange: range.label,
      count: Math.floor(Math.random() * 10), // Placeholder data
    }));
  }, []);

  // Chart configurations
  const categoryChartConfig = {
    completed: {
      label: "Completed",
      color: "hsl(var(--chart-1))",
    },
    remaining: {
      label: "Remaining",
      color: "hsl(var(--chart-2))",
    },
  };

  const difficultyChartConfig = {
    percentage: {
      label: "Completion %",
      color: "hsl(var(--chart-3))",
    },
  };

  const skillChartConfig = {
    percentage: {
      label: "Progress %",
      color: "hsl(var(--chart-4))",
    },
  };

  const timeChartConfig = {
    count: {
      label: "Challenges",
      color: "hsl(var(--chart-5))",
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Category Completion Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Completion by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={categoryChartConfig}>
            <BarChart data={categoryData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="category"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <Bar
                dataKey="completed"
                stackId="a"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="remaining"
                stackId="a"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Difficulty Progression Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Progress by Difficulty</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={difficultyChartConfig}>
            <LineChart data={difficultyData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="difficulty"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent />}
              />
              <Line
                dataKey="percentage"
                type="monotone"
                stroke="var(--color-percentage)"
                strokeWidth={2}
                dot={{
                  fill: "var(--color-percentage)",
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Skill Development Area Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Skill Development Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={skillChartConfig}>
            <AreaChart data={skillAreaData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="category"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent />}
              />
              <Area
                dataKey="percentage"
                type="monotone"
                stroke="var(--color-percentage)"
                strokeWidth={2}
                fill="var(--color-percentage)"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Time Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Time Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={timeChartConfig}>
            <BarChart data={timeDistributionData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="timeRange"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      {stats.completedChallenges > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Progress Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round((stats.completedChallenges / stats.totalChallenges) * 100)}%
                </div>
                <div className="text-xs text-muted-foreground">Overall Progress</div>
              </div>

              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(stats.averageTimePerChallenge / 60)}m
                </div>
                <div className="text-xs text-muted-foreground">Avg Time</div>
              </div>

              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-purple-600">
                  {Object.values(stats.categoriesCompleted).filter(count => count > 0).length}
                </div>
                <div className="text-xs text-muted-foreground">Categories Started</div>
              </div>

              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.streakDays}
                </div>
                <div className="text-xs text-muted-foreground">Day Streak</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}