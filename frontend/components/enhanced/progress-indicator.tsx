"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

const progressVariants = cva(
  "relative transition-all duration-500 ease-out",
  {
    variants: {
      variant: {
        default: "h-2",
        thick: "h-4",
        thin: "h-1"
      },
      color: {
        default: "",
        success: "[&>div]:bg-green-500 dark:[&>div]:bg-green-400",
        warning: "[&>div]:bg-yellow-500 dark:[&>div]:bg-yellow-400",
        danger: "[&>div]:bg-red-500 dark:[&>div]:bg-red-400",
        info: "[&>div]:bg-blue-500 dark:[&>div]:bg-blue-400",
        gradient: "[&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-purple-600"
      },
      animation: {
        none: "",
        pulse: "animate-pulse",
        bounce: "[&>div]:animate-bounce",
        glow: "[&>div]:shadow-lg [&>div]:shadow-primary/50"
      }
    },
    defaultVariants: {
      variant: "default",
      color: "default",
      animation: "none"
    }
  }
)

interface ProgressIndicatorProps
  extends Omit<React.ComponentProps<typeof Progress>, "value">,
    VariantProps<typeof progressVariants> {
  value: number
  max?: number
  showPercentage?: boolean
  showValue?: boolean
  label?: string
  description?: string
  size?: "sm" | "md" | "lg"
  animated?: boolean
  striped?: boolean
  indeterminate?: boolean
}

export function ProgressIndicator({
  className,
  variant,
  color,
  animation,
  value,
  max = 100,
  showPercentage = false,
  showValue = false,
  label,
  description,
  size = "md",
  animated = true,
  striped = false,
  indeterminate = false,
  ...props
}: ProgressIndicatorProps) {
  const [displayValue, setDisplayValue] = React.useState(0)
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  // Animate value changes
  React.useEffect(() => {
    if (!animated) {
      setDisplayValue(percentage)
      return
    }

    const duration = 1000 // 1 second
    const steps = 60 // 60 FPS
    const stepValue = (percentage - displayValue) / steps
    const interval = duration / steps

    let currentStep = 0
    const timer = setInterval(() => {
      currentStep++
      setDisplayValue(prev => {
        const newValue = prev + stepValue
        if (currentStep >= steps) {
          clearInterval(timer)
          return percentage
        }
        return newValue
      })
    }, interval)

    return () => clearInterval(timer)
  }, [percentage, animated, displayValue])

  const progressHeight = {
    sm: "h-1",
    md: "h-2",
    lg: "h-4"
  }[size]

  const textSize = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  }[size]

  return (
    <div className={cn("w-full space-y-2", className)}>
      {/* Label and value display */}
      {(label || showPercentage || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className={cn("font-medium text-foreground", textSize)}>
              {label}
            </span>
          )}

          {(showPercentage || showValue) && (
            <span className={cn("text-muted-foreground tabular-nums", textSize)}>
              {showValue && `${Math.round(displayValue * max / 100)}/${max}`}
              {showValue && showPercentage && " • "}
              {showPercentage && `${Math.round(displayValue)}%`}
            </span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="relative">
        <Progress
          value={indeterminate ? undefined : displayValue}
          className={cn(
            progressVariants({ variant, color, animation }),
            progressHeight,
            striped && "bg-stripes bg-size-stripe animate-stripe",
            indeterminate && "overflow-hidden"
          )}
          {...props}
        />

        {/* Indeterminate animation */}
        {indeterminate && (
          <div
            className={cn(
              "absolute top-0 h-full w-1/3 bg-primary/60 animate-indeterminate",
              progressHeight
            )}
            style={{
              background: "linear-gradient(90deg, transparent, rgba(var(--primary), 0.8), transparent)",
              animation: "indeterminate 1.5s ease-in-out infinite"
            }}
          />
        )}

        {/* Striped overlay for striped variant */}
        {striped && !indeterminate && (
          <div
            className={cn(
              "absolute top-0 left-0 h-full bg-stripes opacity-20",
              progressHeight
            )}
            style={{
              width: `${displayValue}%`,
              backgroundImage: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 4px,
                rgba(255,255,255,0.3) 4px,
                rgba(255,255,255,0.3) 8px
              )`
            }}
          />
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

// Predefined progress indicators for common use cases
export function SkillProgress({
  skill,
  level,
  maxLevel = 5,
  className,
  ...props
}: {
  skill: string
  level: number
  maxLevel?: number
} & Omit<ProgressIndicatorProps, "value" | "max" | "label">) {
  return (
    <ProgressIndicator
      label={skill}
      value={level}
      max={maxLevel}
      showValue
      color="gradient"
      className={className}
      {...props}
    />
  )
}

export function ChallengeProgress({
  completed,
  total,
  className,
  ...props
}: {
  completed: number
  total: number
} & Omit<ProgressIndicatorProps, "value" | "max" | "showValue">) {
  return (
    <ProgressIndicator
      value={completed}
      max={total}
      showValue
      showPercentage
      color={completed === total ? "success" : "default"}
      description={`${completed} of ${total} challenges completed`}
      className={className}
      {...props}
    />
  )
}

export function LoadingProgress({
  className,
  ...props
}: Omit<ProgressIndicatorProps, "value" | "indeterminate">) {
  return (
    <ProgressIndicator
      value={0}
      indeterminate
      animated
      className={className}
      {...props}
    />
  )
}

// Add the indeterminate keyframes to global CSS (this would normally go in globals.css)
const IndeterminateStyles = () => (
  <style jsx global>{`
    @keyframes indeterminate {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(300%);
      }
    }
  `}</style>
)

// Export the styles component so it can be included in the app
export { IndeterminateStyles }