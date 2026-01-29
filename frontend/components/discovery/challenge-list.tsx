"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ChallengeCard } from "./ChallengeCard"
import { ChallengeTable } from "./ChallengeTable"
import { Download, Trash2, FileDown, Info, Package, Globe } from "lucide-react"
import challengeStore, { getChallenges, getImportStats, getImportedChallenges, isImported, removeImportedChallenge } from "@/lib/challenge-store"
import { cn } from "@/lib/utils"
import { useRunningChallenges } from "@/hooks/useChallenges"

interface ImportStats {
  totalBuiltIn: number
  totalImported: number
  categories: Record<string, { builtIn: number; imported: number }>
  importSources: string[]
}

interface ChallengeListProps {
  challenges: any[]
  view: 'grid' | 'table'
  onSpawn: (challengeId: string) => void
  onStop: (sessionId: string) => void
  onViewDetails: (challengeId: string) => void
  isSpawning: boolean
  spawningChallengeId?: string
  stoppingChallengeId?: string
  getChallengeProgress: (challengeId: string) => any
  className?: string
}

export function ChallengeList({
  challenges: builtInChallenges,
  view,
  onSpawn,
  onStop,
  onViewDetails,
  isSpawning,
  spawningChallengeId,
  stoppingChallengeId,
  getChallengeProgress,
  className
}: ChallengeListProps) {
  const [showImportStats, setShowImportStats] = React.useState(false)
  const [refreshKey, setRefreshKey] = React.useState(0)
  
  // Get running challenges data
  const { data: runningChallengesData } = useRunningChallenges()

  // Set built-in challenges in store for import management
  React.useEffect(() => {
    if (builtInChallenges.length > 0) {
      challengeStore.setBuiltInChallenges(builtInChallenges)
    }
  }, [builtInChallenges])

  // Get imported challenges and merge with filtered built-in challenges
  const allChallenges = React.useMemo(() => {
    const importedChallenges = getImportedChallenges()
    // Merge built-in (already filtered from parent) with imported challenges
    return [...builtInChallenges, ...importedChallenges].sort((a, b) => {
      // Sort by imported status (built-in first) then by name
      if (a.imported !== b.imported) {
        return a.imported ? 1 : -1
      }
      return a.name.localeCompare(b.name)
    })
  }, [builtInChallenges, refreshKey])
  
  const importStats = getImportStats() as ImportStats

  const handleRemoveImported = async (challengeId: string) => {
    if (confirm('Are you sure you want to remove this imported challenge?')) {
      try {
        // Call API to delete imported challenge
        const response = await fetch(`http://localhost:5000/api/import/${challengeId}`, {
          method: 'DELETE',
        })
        
        const data = await response.json()
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to delete challenge')
        }
        
        // Force re-render by updating refresh key
        setRefreshKey(prev => prev + 1)
        alert('Challenge deleted successfully')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        alert('Failed to remove challenge: ' + message)
      }
    }
  }

  const handleExportImported = () => {
    try {
      const exportData = challengeStore.exportImported()
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `imported-challenges-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      alert('Failed to export challenges: ' + message)
    }
  }

  const getChallengeCardActions = (challenge: any) => {
    if (!isImported(challenge.id)) return null

    return (
      <div className="flex gap-2 mt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            handleRemoveImported(challenge.id)
          }}
          className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Remove
        </Button>
      </div>
    )
  }

  const enhancedChallenges = allChallenges.map(challenge => ({
    ...challenge,
    additionalActions: getChallengeCardActions(challenge)
  }))
  
  // Helper to find running session for a challenge
  const getRunningSession = React.useCallback((challengeId: string) => {
    if (!runningChallengesData?.challenges) return null
    return runningChallengesData.challenges.find(
      (session) => session.challenge_id === challengeId
    )
  }, [runningChallengesData])

  return (
    <div className={cn("space-y-6", className)}>
      {/* Import Statistics Header */}
      {importStats.totalImported > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                Challenge Collection
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImportStats(!showImportStats)}
              >
                <Info className="w-4 h-4 mr-2" />
                {showImportStats ? 'Hide' : 'Show'} Stats
              </Button>
            </CardTitle>
            <CardDescription>
              {importStats.totalBuiltIn} built-in + {importStats.totalImported} imported = {allChallenges.length} total challenges
            </CardDescription>
          </CardHeader>

          {showImportStats && (
            <CardContent className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{importStats.totalBuiltIn}</div>
                  <div className="text-sm text-muted-foreground">Built-in</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{importStats.totalImported}</div>
                  <div className="text-sm text-muted-foreground">Imported</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{allChallenges.length}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{Object.keys(importStats.categories).length}</div>
                  <div className="text-sm text-muted-foreground">Categories</div>
                </div>
              </div>

              {/* Category Distribution */}
              {Object.keys(importStats.categories).length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Categories</h4>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(importStats.categories).map(([category, stats]: [string, any]) => (
                      <Badge key={category} variant="outline">
                        {category}: {stats.builtIn}
                        {stats.imported > 0 && (
                          <span className="text-green-600">+{stats.imported}</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Import Sources */}
              {importStats.importSources.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Import Sources</h4>
                  <div className="flex gap-2 flex-wrap">
                    {importStats.importSources.map((source: string) => (
                      <Badge key={source} variant="secondary">
                        <FileDown className="w-3 h-3 mr-1" />
                        {source}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportImported}
                  disabled={importStats.totalImported === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Imported
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Challenge Grid/Table */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {enhancedChallenges.map((challenge) => {
            const progress = getChallengeProgress(challenge.id)
            const runningSession = getRunningSession(challenge.id)
            const isStopping = stoppingChallengeId === challenge.id

            return (
              <div key={challenge.id} className="relative">
                <ChallengeCard
                  challenge={challenge}
                  progress={progress ? {
                    user_id: 'default-user',
                    challenge_id: challenge.id,
                    status: progress.completed ? 'completed' : 'attempted',
                    attempts: progress.attempts,
                    completed_at: progress.completedAt,
                    best_time: progress.timeSpent,
                    flags_submitted: progress.attempts,
                    hints_used: progress.hintsUsed,
                    points_earned: progress.completed ? challenge.points : 0,
                  } : undefined}
                  onSpawn={onSpawn}
                  onStop={onStop}
                  onViewDetails={onViewDetails}
                  isSpawning={isSpawning}
                  spawningChallengeId={spawningChallengeId}
                  isStopping={isStopping}
                  isRunning={!!runningSession}
                  sessionId={runningSession?.session_id}
                />

                {/* Challenge Source Indicator */}
                <div className="absolute top-2 left-2">
                  {challenge.imported ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                      <Package className="w-3 h-3 mr-1" />
                      Imported
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100">
                      <Globe className="w-3 h-3 mr-1" />
                      Built-in
                    </Badge>
                  )}
                </div>

                {/* Import Actions */}
                {challenge.imported && (
                  <div className="absolute top-2 right-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveImported(challenge.id)
                      }}
                      className="h-8 w-8 p-0 bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300 dark:bg-red-950 dark:border-red-800 dark:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <ChallengeTable
            challenges={enhancedChallenges}
            progress={enhancedChallenges.reduce((acc, challenge) => {
              const progress = getChallengeProgress(challenge.id);
              if (progress) {
                acc[challenge.id] = progress;
              }
              return acc;
            }, {} as Record<string, any>)}
            onSpawn={onSpawn}
            onViewDetails={onViewDetails}
            isSpawning={isSpawning}
            spawningChallengeId={spawningChallengeId}
          />

          {/* Import Management Table */}
          {importStats.totalImported > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Imported Challenges</CardTitle>
                <CardDescription>
                  Manage your custom imported challenges
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {enhancedChallenges.filter(c => c.imported).map((challenge) => (
                    <div key={challenge.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{challenge.category}</Badge>
                        <div>
                          <div className="font-medium text-sm">{challenge.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Source: {challenge.importSource} • {challenge.points} pts
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveImported(challenge.id)}
                        className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty State */}
      {allChallenges.length === 0 && (
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>
            No challenges available. Built-in challenges are loaded from the API, and you can import custom challenges using the import feature.
          </AlertDescription>
        </Alert>
      )}

      {/* Import Help */}
      {importStats.totalImported === 0 && allChallenges.length > 0 && (
        <Alert>
          <Package className="w-4 h-4" />
          <AlertDescription>
            <strong>Want to add custom challenges?</strong> Use the import feature to add your own challenge definitions.
            They'll appear here alongside the built-in challenges with the same functionality.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}