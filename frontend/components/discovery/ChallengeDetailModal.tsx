/**
 * ChallengeDetailModal component for viewing challenge details and managing sessions
 *
 * Features:
 * - Complete challenge information display with metadata
 * - Container status tracking and session management
 * - Challenge spawning and stopping with real-time feedback
 * - Flag submission and validation with immediate results
 * - Progress tracking and learning objectives display
 * - Responsive modal design with proper accessibility
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  useSpawnChallenge,
  useStopChallenge,
  useValidateFlag,
  useRunningChallenges,
} from '@/hooks/useChallenges';
import {
  type Challenge,
  type ChallengeSession,
  type UserProgress,
  DIFFICULTY_LEVELS,
} from '@/lib/types';
import {
  Play,
  Square,
  ExternalLink,
  Clock,
  Trophy,
  Tag,
  Target,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  Flag,
  X,
  Info,
  Server,
} from 'lucide-react';

interface ChallengeDetailModalProps {
  challenge: Challenge | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ChallengeDetailModal({
  challenge,
  isOpen,
  onClose,
}: ChallengeDetailModalProps) {
  // API hooks
  const spawnMutation = useSpawnChallenge();
  const stopMutation = useStopChallenge();
  const validateMutation = useValidateFlag();
  const { data: runningChallengesData } = useRunningChallenges();

  // Local state
  const [flagInput, setFlagInput] = useState('');
  const [showHints, setShowHints] = useState(false);

  // Find active session for this challenge
  const activeSession = useMemo(() => {
    if (!challenge || !runningChallengesData) return null;
    return runningChallengesData.running_challenges.find(
      (session) => session.challenge_id === challenge.id
    );
  }, [challenge, runningChallengesData]);

  // Reset flag input when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFlagInput('');
      setShowHints(false);
    }
  }, [isOpen]);

  if (!challenge) return null;

  // Handle challenge spawning
  const handleSpawn = async () => {
    try {
      await spawnMutation.mutateAsync({
        challenge_id: challenge.id,
        user_id: 'default-user', // TODO: Get from auth context
      });
    } catch (error) {
      console.error('Failed to spawn challenge:', error);
    }
  };

  // Handle challenge stopping
  const handleStop = async () => {
    if (!activeSession) return;
    try {
      await stopMutation.mutateAsync(activeSession.session_id);
    } catch (error) {
      console.error('Failed to stop challenge:', error);
    }
  };

  // Handle flag validation
  const handleValidateFlag = async () => {
    if (!activeSession || !flagInput.trim()) return;

    try {
      const result = await validateMutation.mutateAsync({
        session_id: activeSession.session_id,
        flag: flagInput.trim(),
      });

      if (result.valid) {
        setFlagInput('');
      }
    } catch (error) {
      console.error('Flag validation failed:', error);
    }
  };

  // Get difficulty configuration
  const difficultyConfig = DIFFICULTY_LEVELS[challenge.difficulty];

  // Get difficulty badge variant
  const getDifficultyVariant = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'default';
      case 'intermediate': return 'secondary';
      case 'advanced': return 'destructive';
      case 'expert': return 'outline';
      default: return 'default';
    }
  };

  // Format duration
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  // Get session status display
  const getSessionStatus = (status: ChallengeSession['status']) => {
    switch (status) {
      case 'starting':
        return { icon: <Loader2 className="h-4 w-4 animate-spin" />, text: 'Starting...', color: 'yellow' };
      case 'running':
        return { icon: <CheckCircle className="h-4 w-4" />, text: 'Running', color: 'green' };
      case 'stopping':
        return { icon: <Loader2 className="h-4 w-4 animate-spin" />, text: 'Stopping...', color: 'orange' };
      case 'stopped':
        return { icon: <Square className="h-4 w-4" />, text: 'Stopped', color: 'gray' };
      case 'error':
        return { icon: <AlertCircle className="h-4 w-4" />, text: 'Error', color: 'red' };
      default:
        return { icon: <Info className="h-4 w-4" />, text: 'Unknown', color: 'gray' };
    }
  };

  const sessionStatus = activeSession ? getSessionStatus(activeSession.status) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <DialogTitle className="text-2xl">{challenge.name}</DialogTitle>
              <div className="flex items-center gap-2">
                <Badge variant={getDifficultyVariant(challenge.difficulty)}>
                  {difficultyConfig.label}
                </Badge>
                <Badge variant="outline">
                  <Tag className="h-3 w-3 mr-1" />
                  {challenge.category}
                </Badge>
                <Badge variant="outline">
                  <Trophy className="h-3 w-3 mr-1" />
                  {challenge.points} pts
                </Badge>
                <Badge variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatTime(challenge.estimated_time)}
                </Badge>
              </div>
            </div>
          </div>
          <DialogDescription className="text-base">
            {challenge.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Container Status Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Container Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeSession ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {sessionStatus?.icon}
                    <span className="font-medium">{sessionStatus?.text}</span>
                    <Badge variant="outline">{activeSession.session_id.slice(-8)}</Badge>
                  </div>

                  {activeSession.status === 'running' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Access URL:</span>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded">
                          <code className="text-sm">{activeSession.access_url}</code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigator.clipboard.writeText(activeSession.access_url)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(activeSession.access_url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Expires: {new Date(activeSession.expires_at).toLocaleString()}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {activeSession.status === 'running' && (
                      <Button
                        onClick={handleStop}
                        disabled={stopMutation.isPending}
                        variant="destructive"
                        size="sm"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        {stopMutation.isPending ? 'Stopping...' : 'Stop Challenge'}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    No active session. Start the challenge to spawn a container.
                  </p>
                  <Button
                    onClick={handleSpawn}
                    disabled={spawnMutation.isPending}
                    className="w-full"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {spawnMutation.isPending ? 'Spawning...' : 'Start Challenge'}
                  </Button>
                </div>
              )}

              {/* Show spawn/stop errors */}
              {spawnMutation.error && (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to spawn challenge: {spawnMutation.error.message}
                  </AlertDescription>
                </Alert>
              )}

              {stopMutation.error && (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to stop challenge: {stopMutation.error.message}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Flag Submission Section */}
          {activeSession?.status === 'running' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flag className="h-5 w-5" />
                  Flag Submission
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder={challenge.flag_format || 'Enter flag here...'}
                      value={flagInput}
                      onChange={(e) => setFlagInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !validateMutation.isPending) {
                          handleValidateFlag();
                        }
                      }}
                    />
                    <Button
                      onClick={handleValidateFlag}
                      disabled={!flagInput.trim() || validateMutation.isPending}
                    >
                      {validateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Submit'
                      )}
                    </Button>
                  </div>

                  {challenge.flag_format && (
                    <p className="text-sm text-muted-foreground">
                      Expected format: <code>{challenge.flag_format}</code>
                    </p>
                  )}

                  {/* Validation results */}
                  {validateMutation.data && (
                    <Alert className={validateMutation.data.valid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                      {validateMutation.data.valid ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                      <AlertDescription className={validateMutation.data.valid ? "text-green-800" : "text-red-800"}>
                        {validateMutation.data.message}
                        {validateMutation.data.valid && validateMutation.data.points_awarded && (
                          <span className="block mt-1">
                            Points awarded: {validateMutation.data.points_awarded}
                          </span>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  {validateMutation.error && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Flag validation error: {validateMutation.error.message}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Challenge Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Learning Objectives */}
            {challenge.learning_objectives && challenge.learning_objectives.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Learning Objectives
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {challenge.learning_objectives.map((objective, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{objective}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {challenge.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hints */}
          {challenge.hints && challenge.hints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    Hints ({challenge.hints.length})
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHints(!showHints)}
                  >
                    {showHints ? 'Hide' : 'Show'} Hints
                  </Button>
                </CardTitle>
              </CardHeader>
              {showHints && (
                <CardContent>
                  <div className="space-y-3">
                    {challenge.hints.map((hint, index) => (
                      <Alert key={index}>
                        <Lightbulb className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Hint {index + 1}:</strong> {hint}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Container Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Container Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Image:</span>
                  <code className="bg-muted px-2 py-1 rounded">{challenge.container.image}</code>
                </div>
                <div className="flex items-center justify-between">
                  <span>Exposed Ports:</span>
                  <div className="flex gap-1">
                    {Object.entries(challenge.container.ports).map(([containerPort, hostPort]) => (
                      <code key={containerPort} className="bg-muted px-2 py-1 rounded text-xs">
                        {containerPort}→{hostPort}
                      </code>
                    ))}
                  </div>
                </div>
                {challenge.container.environment && Object.keys(challenge.container.environment).length > 0 && (
                  <div className="flex items-start justify-between">
                    <span>Environment:</span>
                    <div className="text-right">
                      {Object.entries(challenge.container.environment).map(([key, value]) => (
                        <div key={key} className="text-xs">
                          <code className="bg-muted px-2 py-1 rounded">{key}={value}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}