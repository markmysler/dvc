/**
 * HintPanel component for progressive hint disclosure
 *
 * Features:
 * - Progressive hint display with unlock status
 * - Countdown timer for next hint unlock
 * - Request hint button for early access
 * - Hint numbering and progress indicators
 * - Loading states and error handling
 * - Responsive design with shadcn/ui components
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useHints, useRequestHint } from '@/hooks/useHints';
import {
  Clock,
  Lightbulb,
  Lock,
  Unlock,
  Timer,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HintPanelProps {
  challengeId: string;
  sessionId: string;
  className?: string;
}

/**
 * Format seconds into readable time string (mm:ss)
 */
function formatTime(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Progress indicator showing X of Y hints unlocked
 */
function HintProgress({
  available,
  total
}: {
  available: number;
  total: number;
}) {
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full",
              i < available ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>
      <span>{available} of {total} hints unlocked</span>
    </div>
  );
}

/**
 * Countdown timer component
 */
function CountdownTimer({
  targetTime,
  onComplete
}: {
  targetTime: number | null;
  onComplete?: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!targetTime) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now() / 1000;
      const remaining = Math.max(0, Math.floor(targetTime - now));
      setTimeLeft(remaining);

      if (remaining === 0 && onComplete) {
        onComplete();
      }
    };

    updateTimer(); // Initial update
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [targetTime, onComplete]);

  if (!targetTime || timeLeft === null) {
    return null;
  }

  if (timeLeft === 0) {
    return (
      <Badge variant="outline" className="text-green-600 border-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Ready!
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-blue-600 border-blue-200">
      <Timer className="w-3 h-3 mr-1" />
      Next in {formatTime(timeLeft)}
    </Badge>
  );
}

/**
 * Individual hint display component
 */
function HintItem({
  hint,
  index
}: {
  hint: {
    index: number;
    text: string;
    unlocked_by: 'time' | 'request';
    unlocked_at: number;
  };
  index: number;
}) {
  const unlockedByRequest = hint.unlocked_by === 'request';

  return (
    <div className="flex gap-3 p-3 rounded-lg border bg-card">
      <div className="flex-shrink-0">
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
          "bg-primary text-primary-foreground"
        )}>
          {index + 1}
        </div>
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Unlock className="w-4 h-4 text-green-600" />
          <span className="text-sm text-muted-foreground">
            Unlocked {unlockedByRequest ? 'by request' : 'by time'}
            {unlockedByRequest && (
              <Badge variant="secondary" className="ml-2 text-xs">
                Early Access
              </Badge>
            )}
          </span>
        </div>

        <p className="text-sm leading-relaxed">
          {hint.text}
        </p>
      </div>
    </div>
  );
}

/**
 * Empty state component when no hints are available
 */
function EmptyHintsState() {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
      <h3 className="font-medium mb-1">No hints available</h3>
      <p className="text-sm">This challenge doesn't include hints.</p>
    </div>
  );
}

/**
 * Main HintPanel component
 */
export function HintPanel({
  challengeId,
  sessionId,
  className
}: HintPanelProps) {
  const { data: hintsData, isLoading, error, refetch } = useHints(challengeId, sessionId);
  const requestHintMutation = useRequestHint();

  // Refresh data when countdown completes
  const handleTimerComplete = () => {
    refetch();
  };

  // Handle hint request
  const handleRequestHint = async () => {
    try {
      await requestHintMutation.mutateAsync({
        challenge_id: challengeId,
        session_id: sessionId,
        action: 'request'
      });
      // Data will be automatically updated via optimistic updates
    } catch (error) {
      console.error('Failed to request hint:', error);
      // Error handling is done by the mutation hook
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            <CardTitle>Hints</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            <CardTitle>Hints</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load hints. Please try again.
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-3"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!hintsData) {
    return null;
  }

  const {
    available_hints = [],
    total_hints = 0,
    next_unlock = null,
    hints_requested = 0
  } = hintsData;

  const { status } = hintsData;
  const canRequestHint = available_hints.length < total_hints;
  const nextUnlockTime = next_unlock ? next_unlock : null;

  // No hints available for this challenge
  if (total_hints === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            <CardTitle>Hints</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <EmptyHintsState />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            <CardTitle>Hints</CardTitle>
          </div>

          <HintProgress
            available={available_hints.length}
            total={total_hints}
          />
        </div>

        {available_hints.length > 0 && (
          <CardDescription>
            Use hints wisely to learn effectively while preserving the challenge.
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Hint request section */}
        {canRequestHint && (
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Next hint locked</p>
                <div className="flex items-center gap-2 mt-1">
                  {nextUnlockTime && (
                    <CountdownTimer
                      targetTime={nextUnlockTime}
                      onComplete={handleTimerComplete}
                    />
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={handleRequestHint}
              disabled={requestHintMutation.isPending}
              size="sm"
              variant="outline"
            >
              {requestHintMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Requesting...
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4 mr-2" />
                  Request Hint
                </>
              )}
            </Button>
          </div>
        )}

        {/* Display available hints */}
        {available_hints.length > 0 ? (
          <div className="space-y-3">
            {available_hints.map((hint, index) => (
              <HintItem
                key={hint.index}
                hint={hint}
                index={hint.index}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hints unlocked yet.</p>
            <p className="text-xs mt-1">
              Hints unlock automatically over time or can be requested early.
            </p>
          </div>
        )}

        {/* Status information */}
        {status && (
          <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
            <div className="flex justify-between">
              <span>Session time:</span>
              <span>{formatTime(status.session_duration_seconds || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Hints requested:</span>
              <span>{hints_requested}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default HintPanel;