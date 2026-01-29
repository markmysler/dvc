"use client"

import * as React from "react"
import { CheckCircle, XCircle, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface ValidationError {
  path: string
  message: string
  suggestion: string
  severity: 'error' | 'warning' | 'suggestion'
  value?: any
}

interface ValidationSummary {
  totalChallenges: number
  validChallenges: number
  errorCount: number
  warningCount: number
}

interface ValidationFeedbackProps {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  suggestions: ValidationError[]
  summary: ValidationSummary
  fileName?: string
  className?: string
  showDetails?: boolean
}

export function ValidationFeedback({
  valid,
  errors,
  warnings,
  suggestions,
  summary,
  fileName,
  className,
  showDetails = true
}: ValidationFeedbackProps) {
  const [showErrorDetails, setShowErrorDetails] = React.useState(false)
  const [showWarningDetails, setShowWarningDetails] = React.useState(false)
  const [showSuggestionDetails, setShowSuggestionDetails] = React.useState(false)

  const getStatusIcon = () => {
    if (valid) {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    }
    return <XCircle className="w-5 h-5 text-red-500" />
  }

  const getStatusMessage = () => {
    if (valid) {
      return {
        title: "Validation Successful",
        description: `All ${summary.totalChallenges} challenge(s) passed validation and are ready for import.`
      }
    }
    return {
      title: "Validation Failed",
      description: `Found ${summary.errorCount} error(s) that must be fixed before importing.`
    }
  }

  const { title, description } = getStatusMessage()

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          {title}
        </CardTitle>
        <CardDescription>
          {fileName && (
            <span className="block text-sm font-mono bg-muted px-2 py-1 rounded mb-2">
              {fileName}
            </span>
          )}
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary Statistics */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant={valid ? "default" : "secondary"}>
            {summary.validChallenges}/{summary.totalChallenges} valid
          </Badge>
          {summary.errorCount > 0 && (
            <Badge variant="destructive">
              {summary.errorCount} error{summary.errorCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {summary.warningCount > 0 && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-400">
              {summary.warningCount} warning{summary.warningCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {suggestions.length > 0 && (
            <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">
              {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {showDetails && (
          <div className="space-y-4">
            {/* Errors Section */}
            {errors.length > 0 && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowErrorDetails(!showErrorDetails)}
                  className="w-full justify-between p-0 h-auto text-red-600 dark:text-red-400"
                >
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    <span className="font-medium">
                      Errors ({errors.length})
                    </span>
                  </div>
                  {showErrorDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>

                {showErrorDetails && (
                  <div className="mt-2 space-y-3">
                    {errors.map((error, index) => (
                      <Alert key={index} variant="destructive">
                        <AlertTitle className="text-sm">
                          <span className="font-mono text-xs bg-destructive/20 px-1 py-0.5 rounded">
                            {error.path}
                          </span>
                          <span className="ml-2">{error.message}</span>
                        </AlertTitle>
                        {error.suggestion && (
                          <AlertDescription className="mt-2">
                            <div className="flex items-start gap-2">
                              <Info className="w-3 h-3 mt-0.5 text-muted-foreground" />
                              <span className="text-xs">{error.suggestion}</span>
                            </div>
                          </AlertDescription>
                        )}
                        {error.value !== undefined && (
                          <AlertDescription className="mt-2">
                            <div className="text-xs text-muted-foreground">
                              Current value: <code className="bg-muted px-1 py-0.5 rounded">{JSON.stringify(error.value)}</code>
                            </div>
                          </AlertDescription>
                        )}
                      </Alert>
                    ))}
                  </div>
                )}

                <Separator className="my-4" />
              </div>
            )}

            {/* Warnings Section */}
            {warnings.length > 0 && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowWarningDetails(!showWarningDetails)}
                  className="w-full justify-between p-0 h-auto text-yellow-600 dark:text-yellow-400"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">
                      Warnings ({warnings.length})
                    </span>
                  </div>
                  {showWarningDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>

                {showWarningDetails && (
                  <div className="mt-2 space-y-3">
                    {warnings.map((warning, index) => (
                      <Alert key={index} className="border-yellow-200 dark:border-yellow-800">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                        <AlertTitle className="text-sm">
                          <span className="font-mono text-xs bg-yellow-100 dark:bg-yellow-900 px-1 py-0.5 rounded">
                            {warning.path}
                          </span>
                          <span className="ml-2">{warning.message}</span>
                        </AlertTitle>
                        {warning.suggestion && (
                          <AlertDescription className="mt-2">
                            <div className="flex items-start gap-2">
                              <Info className="w-3 h-3 mt-0.5 text-muted-foreground" />
                              <span className="text-xs">{warning.suggestion}</span>
                            </div>
                          </AlertDescription>
                        )}
                      </Alert>
                    ))}
                  </div>
                )}

                <Separator className="my-4" />
              </div>
            )}

            {/* Suggestions Section */}
            {suggestions.length > 0 && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSuggestionDetails(!showSuggestionDetails)}
                  className="w-full justify-between p-0 h-auto text-blue-600 dark:text-blue-400"
                >
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    <span className="font-medium">
                      Suggestions ({suggestions.length})
                    </span>
                  </div>
                  {showSuggestionDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>

                {showSuggestionDetails && (
                  <div className="mt-2 space-y-3">
                    {suggestions.map((suggestion, index) => (
                      <Alert key={index} className="border-blue-200 dark:border-blue-800">
                        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <AlertTitle className="text-sm">
                          <span className="font-mono text-xs bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">
                            {suggestion.path}
                          </span>
                          <span className="ml-2">{suggestion.message}</span>
                        </AlertTitle>
                      </Alert>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Success Action */}
        {valid && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Ready to import</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Your challenge{summary.totalChallenges !== 1 ? 's' : ''} will be added to the discovery interface and available for spawning.
            </p>
          </div>
        )}

        {/* Error Action */}
        {!valid && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Import blocked</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Fix the errors above and upload your file again to proceed with the import.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Simplified feedback for inline display
export function ValidationSummaryBadge({
  valid,
  errorCount,
  warningCount,
  className
}: {
  valid: boolean
  errorCount: number
  warningCount: number
  className?: string
}) {
  if (valid) {
    return (
      <Badge variant="outline" className={cn("border-green-500 text-green-600 dark:text-green-400", className)}>
        <CheckCircle className="w-3 h-3 mr-1" />
        Valid
        {warningCount > 0 && ` (${warningCount} warnings)`}
      </Badge>
    )
  }

  return (
    <Badge variant="destructive" className={className}>
      <XCircle className="w-3 h-3 mr-1" />
      {errorCount} error{errorCount !== 1 ? 's' : ''}
    </Badge>
  )
}