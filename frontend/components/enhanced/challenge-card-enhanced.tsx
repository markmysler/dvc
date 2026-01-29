"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const challengeCardVariants = cva(
  "group relative overflow-hidden transition-all duration-300 ease-in-out cursor-pointer",
  {
    variants: {
      variant: {
        default: "hover:shadow-lg hover:shadow-primary/10 hover:scale-[1.02] hover:-translate-y-1",
        featured: "ring-2 ring-primary/20 shadow-lg hover:ring-primary/40 hover:shadow-xl hover:scale-[1.03]",
        completed: "bg-muted/30 border-success hover:shadow-md hover:scale-[1.01]"
      },
      difficulty: {
        beginner: "border-green-200 dark:border-green-800",
        intermediate: "border-yellow-200 dark:border-yellow-800",
        advanced: "border-red-200 dark:border-red-800",
        expert: "border-purple-200 dark:border-purple-800"
      }
    },
    defaultVariants: {
      variant: "default",
      difficulty: "beginner"
    }
  }
)

const difficultyColors = {
  beginner: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  advanced: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  expert: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
}

interface ChallengeCardEnhancedProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof challengeCardVariants> {
  challenge: {
    id: string
    name: string
    description: string
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
    category: string
    points: number
    tags: string[]
    estimated_time?: string
  }
  isCompleted?: boolean
  isFeatured?: boolean
  progress?: number
  onCardClick?: (challengeId: string) => void
}

export function ChallengeCardEnhanced({
  className,
  variant,
  difficulty,
  challenge,
  isCompleted = false,
  isFeatured = false,
  progress,
  onCardClick,
  ...props
}: ChallengeCardEnhancedProps) {
  const cardVariant = isCompleted ? "completed" : isFeatured ? "featured" : variant

  const handleClick = () => {
    onCardClick?.(challenge.id)
  }

  return (
    <Card
      className={cn(
        challengeCardVariants({ variant: cardVariant, difficulty: challenge.difficulty as any }),
        "relative",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {/* Animated background overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Progress bar for completed/in-progress challenges */}
      {progress !== undefined && progress > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}

      {/* Completion indicator */}
      {isCompleted && (
        <div className="absolute top-3 right-3 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold leading-tight group-hover:text-primary transition-colors duration-200">
              {challenge.name}
            </CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs font-medium transition-colors",
                  difficultyColors[challenge.difficulty]
                )}
              >
                {challenge.difficulty}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {challenge.category}
              </Badge>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-medium text-primary">{challenge.points} pts</div>
            {challenge.estimated_time && (
              <div className="text-xs text-muted-foreground mt-1">
                {challenge.estimated_time}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <CardDescription className="text-sm text-muted-foreground leading-relaxed mb-4">
          {challenge.description}
        </CardDescription>

        {/* Tags */}
        {challenge.tags && challenge.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {challenge.tags.slice(0, 4).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-xs px-2 py-0.5 hover:bg-primary/10 transition-colors"
              >
                {tag}
              </Badge>
            ))}
            {challenge.tags.length > 4 && (
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                +{challenge.tags.length - 4} more
              </Badge>
            )}
          </div>
        )}

        {/* Hover action indicator */}
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="text-xs text-primary font-medium flex items-center gap-1">
            Start Challenge
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}