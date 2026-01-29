"use client"

import * as React from "react"
import Skeleton, { SkeletonTheme } from "react-loading-skeleton"
import "react-loading-skeleton/dist/skeleton.css"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface LoadingSkeletonProps {
  className?: string
  theme?: "light" | "dark" | "auto"
}

interface ChallengeCardSkeletonProps extends LoadingSkeletonProps {
  count?: number
}

interface DataTableSkeletonProps extends LoadingSkeletonProps {
  rows?: number
  columns?: number
}

interface FormSkeletonProps extends LoadingSkeletonProps {
  fields?: number
}

// Base skeleton theme configuration
const getSkeletonTheme = (theme: "light" | "dark" | "auto" = "auto") => {
  if (theme === "auto") {
    // Auto-detect based on system preference or current theme
    if (typeof window !== "undefined") {
      const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      return isDark ? darkTheme : lightTheme
    }
    return lightTheme
  }
  return theme === "dark" ? darkTheme : lightTheme
}

const lightTheme = {
  baseColor: "#f3f4f6",
  highlightColor: "#e5e7eb"
}

const darkTheme = {
  baseColor: "#374151",
  highlightColor: "#4b5563"
}

// Challenge Card Skeleton - matches ChallengeCardEnhanced structure
export function ChallengeCardSkeleton({
  className,
  count = 1,
  theme = "auto"
}: ChallengeCardSkeletonProps) {
  const skeletonTheme = getSkeletonTheme(theme)

  return (
    <SkeletonTheme {...skeletonTheme}>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className={cn("overflow-hidden", className)}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Title */}
                <Skeleton height={24} className="mb-2" />

                {/* Badges */}
                <div className="flex items-center gap-2 mt-2">
                  <Skeleton width={80} height={20} className="rounded-full" />
                  <Skeleton width={60} height={20} className="rounded-full" />
                </div>
              </div>

              {/* Points and time */}
              <div className="text-right shrink-0">
                <Skeleton width={60} height={16} className="mb-1" />
                <Skeleton width={80} height={12} />
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {/* Description */}
            <div className="mb-4">
              <Skeleton count={2} height={16} className="mb-1" />
              <Skeleton width="60%" height={16} />
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1">
              <Skeleton width={50} height={20} className="rounded-full" />
              <Skeleton width={40} height={20} className="rounded-full" />
              <Skeleton width={60} height={20} className="rounded-full" />
              <Skeleton width={45} height={20} className="rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </SkeletonTheme>
  )
}

// Data Table Skeleton
export function DataTableSkeleton({
  className,
  rows = 5,
  columns = 4,
  theme = "auto"
}: DataTableSkeletonProps) {
  const skeletonTheme = getSkeletonTheme(theme)

  return (
    <SkeletonTheme {...skeletonTheme}>
      <div className={cn("w-full", className)}>
        {/* Table Header */}
        <div className="flex border-b pb-3 mb-3">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="flex-1 px-2">
              <Skeleton height={20} />
            </div>
          ))}
        </div>

        {/* Table Rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex py-2 border-b last:border-b-0">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={colIndex} className="flex-1 px-2">
                <Skeleton
                  height={16}
                  width={colIndex === 0 ? "80%" : colIndex === columns - 1 ? "60%" : "90%"}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </SkeletonTheme>
  )
}

// Form Skeleton
export function FormSkeleton({
  className,
  fields = 3,
  theme = "auto"
}: FormSkeletonProps) {
  const skeletonTheme = getSkeletonTheme(theme)

  return (
    <SkeletonTheme {...skeletonTheme}>
      <div className={cn("space-y-4", className)}>
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="space-y-2">
            {/* Field Label */}
            <Skeleton width="25%" height={16} />

            {/* Field Input */}
            <Skeleton height={40} className="rounded-md" />

            {/* Optional field description */}
            {index === 0 && <Skeleton width="60%" height={12} />}
          </div>
        ))}

        {/* Submit button area */}
        <div className="pt-4 flex gap-2">
          <Skeleton width={100} height={36} className="rounded-md" />
          <Skeleton width={80} height={36} className="rounded-md" />
        </div>
      </div>
    </SkeletonTheme>
  )
}

// Generic content skeleton
export function ContentSkeleton({
  className,
  theme = "auto"
}: LoadingSkeletonProps) {
  const skeletonTheme = getSkeletonTheme(theme)

  return (
    <SkeletonTheme {...skeletonTheme}>
      <div className={cn("space-y-4", className)}>
        {/* Title */}
        <Skeleton height={32} width="40%" />

        {/* Paragraph */}
        <div>
          <Skeleton count={3} height={16} className="mb-2" />
          <Skeleton width="70%" height={16} />
        </div>

        {/* Another section */}
        <div className="pt-4">
          <Skeleton height={24} width="30%" className="mb-3" />
          <Skeleton count={2} height={16} className="mb-1" />
          <Skeleton width="85%" height={16} />
        </div>
      </div>
    </SkeletonTheme>
  )
}

// Analytics Chart Skeleton
export function ChartSkeleton({
  className,
  theme = "auto"
}: LoadingSkeletonProps) {
  const skeletonTheme = getSkeletonTheme(theme)

  return (
    <SkeletonTheme {...skeletonTheme}>
      <div className={cn("", className)}>
        {/* Chart title */}
        <Skeleton height={24} width="40%" className="mb-4" />

        {/* Chart area */}
        <Skeleton height={300} className="rounded-lg" />

        {/* Legend */}
        <div className="flex justify-center gap-4 mt-4">
          <Skeleton width={80} height={16} />
          <Skeleton width={90} height={16} />
          <Skeleton width={70} height={16} />
        </div>
      </div>
    </SkeletonTheme>
  )
}

// Export all skeletons
export {
  ChallengeCardSkeleton as default,
  DataTableSkeleton,
  FormSkeleton,
  ContentSkeleton,
  ChartSkeleton
}